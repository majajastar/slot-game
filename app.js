/**
 * TheLuxe Slot Game - Direct WebSocket Client
 * Uses fake data for fields not available from server
 */

// Data from server (populated after SyncRoomInfo)
let SYMBOLS = {};
let PAYLINES = [];
let JACKPOTS = {};
let BONUSES = {};
let GAME_CONFIG = {};
let FRAME_CONFIG = {};
let BET_SIZE_LIST = [1, 2, 5, 10, 20, 50, 100]; // Default fallback
let CURRENT_BET_INDEX = 0; // Track current bet index directly (avoids float comparison issues)

// Line is always 14 (all paylines)
const ACTIVE_LINES = 14;

// Fake game state for fields not in server response
let fakeState = {
    spinCount: 0,
    totalWin: 0,
    history: [],
    inBonus: false,
    bonusType: null,
    bonusSpinsLeft: 0
};

// Mega Boost mode state (10x cost, 10x bonus entry chance)
let megaBoostEnabled = false;

// Current sticky frames (for bonus game persistence during spins)
let currentStickyFrames = null;

// Real game state from server
let socket = null;
let isSpinning = false;
let pingInterval = null;
let currentBalance = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initGrid();
    connect();
});

// Create 4x5 grid
function initGrid() {
    const grid = document.getElementById('reelGrid');
    grid.innerHTML = '';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const cell = document.createElement('div');
            cell.className = 'reel-cell';
            cell.id = `cell-${r}-${c}`;
            cell.textContent = '◯';
            grid.appendChild(cell);
        }
    }
}

// Render paytable using server data
function renderPaytable() {
    const container = document.getElementById('paytable');
    if (!container) return;

    const symbolCount = Object.keys(SYMBOLS).length;
    if (symbolCount === 0) {
        container.innerHTML = '<div style="color:#888;padding:10px;">Loading paytable...</div>';
        return;
    }

    const symbols = Object.entries(SYMBOLS).filter(([id]) => id !== 'SCATTER');

    // Header
    let html = `
        <div class="paytable-header">
            <span>Icon</span>
            <span>Symbol</span>
            <span>5x</span>
            <span>4x</span>
            <span>3x</span>
        </div>
    `;

    // Data rows
    html += symbols.map(([id, s]) => `
        <div class="paytable-row ${id === 'WILD' ? 'wild' : ''}">
            <span class="paytable-icon">${s.display || '?'}</span>
            <span class="paytable-name">${s.name || id}${id === 'WILD' ? ' ⭐' : ''}</span>
            <span class="paytable-payout high">${s.payout?.[5] || 0}x</span>
            <span class="paytable-payout">${s.payout?.[4] || 0}x</span>
            <span class="paytable-payout">${s.payout?.[3] || 0}x</span>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Render paylines using server data - OpenClawAutoGen style with mini grids
function renderPaylines() {
    const container = document.getElementById('paylinesDisplay');
    if (!container) return;
    
    if (PAYLINES.length === 0) {
        container.innerHTML = '<div style="color:#888;padding:10px;">Loading paylines...</div>';
        return;
    }
    
    // Render paylines as mini grids showing the pattern
    container.innerHTML = PAYLINES.map((line, idx) => `
        <div class="payline-item" style="background:rgba(0,0,0,0.3);padding:6px;border-radius:6px;text-align:center;">
            <div style="font-size:0.6rem;color:#888;margin-bottom:4px;">${line.name}</div>
            <div style="display:grid;grid-template-columns:repeat(5,10px);grid-template-rows:repeat(4,10px);gap:1px;margin:0 auto;width:54px;">
                ${Array.from({length: 20}).map((_, i) => {
                    const r = Math.floor(i / 5);
                    const c = i % 5;
                    const isActive = line.pattern[c] === r;
                    return `<div style="width:10px;height:10px;background:${isActive ? '#2ecc71' : 'rgba(255,255,255,0.1)'};border-radius:2px;"></div>`;
                }).join('')}
            </div>
        </div>
    `).join('');
}

// Render jackpots using server data
function renderJackpots() {
    const container = document.getElementById('jackpotDisplay');
    if (!container || !JACKPOTS.display) return;
    
    container.innerHTML = Object.entries(JACKPOTS.display).map(([value, data]) => `
        <div class="jackpot-item ${data.name.toLowerCase()}">
            ${data.icon}<br>
            ${data.name}<br>
            ${data.multiplier}
        </div>
    `).join('');
}

// Render bonus info using server data (in rules panel)
function renderBonusInfo() {
    // Update buy bonus button costs from server config
    if (BONUSES.blackAndGold) {
        const blackAndGoldCost = document.getElementById('blackAndGoldCost');
        if (blackAndGoldCost) {
            const cost = BONUSES.blackAndGold.buyPriceDisplay || (BONUSES.blackAndGold.buyPriceMultiplier + 'x');
            blackAndGoldCost.textContent = `${BONUSES.blackAndGold.scatterCount} scatters • ${cost}`;
        }
    }
    if (BONUSES.goldenHit) {
        const goldenHitCost = document.getElementById('goldenHitCost');
        if (goldenHitCost) {
            const cost = BONUSES.goldenHit.buyPriceDisplay || (BONUSES.goldenHit.buyPriceMultiplier + 'x');
            goldenHitCost.textContent = `${BONUSES.goldenHit.scatterCount} scatters • ${cost}`;
        }
    }
    
    // Update Mega Boost display from server config
    if (BONUSES.megaBoost) {
        // Initialize the full display
        updateMegaBoostDisplay();
    }
}

// Toggle Mega Boost mode on/off
function toggleMegaBoost() {
    const toggle = document.getElementById('megaBoostToggle');
    if (!toggle) return;

    megaBoostEnabled = toggle.checked;
    
    // Update all Mega Boost display elements
    updateMegaBoostDisplay();
    
    // Update main bet display to show boosted amount
    updateBetDisplayWithBoost();
    
    log(megaBoostEnabled ? '⚡ MEGA BOOST ENABLED! Spins cost 10x with 10x bonus entry chance!' : '⚡ Mega Boost disabled', megaBoostEnabled ? 'highlight' : 'info');
}

// Update all Mega Boost display elements based on current state
function updateMegaBoostDisplay() {
    const statusEl = document.getElementById('megaBoostStatus');
    const costEl = document.getElementById('megaBoostCost');
    const chanceEl = document.getElementById('megaBoostChance');
    const descEl = document.getElementById('megaBoostDesc');
    
    const boostMultiplier = BONUSES.megaBoost?.costMultiplier || 10;
    const entryMult = BONUSES.megaBoost?.bonusEntryMultiplier || 10;
    const baseChance = BONUSES.megaBoost?.baseEntryChance || 0.01;
    const boostedChance = (baseChance * entryMult * 100).toFixed(1);
    
    if (megaBoostEnabled) {
        if (statusEl) {
            statusEl.textContent = 'ENABLED ⚡';
            statusEl.style.color = '#ff6b35';
        }
        if (costEl) costEl.textContent = `${boostMultiplier}x per spin`;
        if (chanceEl) chanceEl.textContent = `${boostedChance}% (${entryMult}x normal)`;
        if (descEl) descEl.textContent = 'Boost is ACTIVE! Each spin costs 10x more but has 10x higher chance to trigger bonus games. Perfect for bonus hunting!';
    } else {
        if (statusEl) {
            statusEl.textContent = 'DISABLED';
            statusEl.style.color = '#888';
        }
        if (costEl) costEl.textContent = '1x per spin (normal)';
        if (chanceEl) chanceEl.textContent = `${(baseChance * 100).toFixed(1)}% (normal)`;
        if (descEl) descEl.textContent = 'When enabled, each spin costs 10x more but has 10x higher chance to trigger Black & Gold or Golden Hit bonus games.';
    }
    
    // Update the boosted bet display
    updateMegaBoostBetDisplay();
}

// Update the boosted bet display in Mega Boost details
function updateMegaBoostBetDisplay() {
    const betDisplay = document.getElementById('betDisplay');
    const megaBoostBetDisplay = document.getElementById('megaBoostBetDisplay');

    if (!betDisplay || !megaBoostBetDisplay) return;

    // Always use baseBet from dataset to avoid double multiplication
    const baseBet = parseFloat(betDisplay.dataset.baseBet) || 10;
    const boostMultiplier = BONUSES.megaBoost?.costMultiplier || 10;

    if (megaBoostEnabled) {
        const boostedBet = baseBet * boostMultiplier;
        megaBoostBetDisplay.textContent = `$${formatBet(boostedBet)} (${boostMultiplier}x $${formatBet(baseBet)})`;
        megaBoostBetDisplay.classList.add('active');
    } else {
        megaBoostBetDisplay.textContent = `$${formatBet(baseBet)} (${boostMultiplier}x = $${formatBet(baseBet * boostMultiplier)})`;
        megaBoostBetDisplay.classList.remove('active');
    }
}

// Update main bet display to show boosted amount when enabled
function updateBetDisplayWithBoost() {
    const betDisplay = document.getElementById('betDisplay');
    if (!betDisplay) return;
    
    // Get current bet from display
    let currentBet = parseFloat(betDisplay.dataset.baseBet || betDisplay.textContent.replace('$', '')) || 10;
    
    // Store base bet if not already stored
    if (!betDisplay.dataset.baseBet) {
        betDisplay.dataset.baseBet = currentBet;
    } else {
        currentBet = parseFloat(betDisplay.dataset.baseBet);
    }
    
    const boostMultiplier = BONUSES.megaBoost?.costMultiplier || 10;
    
    if (megaBoostEnabled) {
        const boostedBet = currentBet * boostMultiplier;
        betDisplay.textContent = '$' + formatBet(boostedBet);
        betDisplay.style.color = '#ff9f43';
        betDisplay.style.textShadow = '0 0 10px rgba(255, 159, 67, 0.5)';
    } else {
        betDisplay.textContent = '$' + formatBet(currentBet);
        betDisplay.style.color = '';
        betDisplay.style.textShadow = '';
    }
}

// Toggle Mega Boost details panel
function toggleMegaBoostDetails() {
    const details = document.getElementById('megaBoostDetails');
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

// Render frame configuration info from server
function renderFrameInfo() {
    console.log(`FRAME_CONFIG = ${JSON.stringify(FRAME_CONFIG)}`)
    // Update frame chance info (chances are ok to show, weights are secret)
    const normalChance = document.getElementById('frameChanceNormal');
    const bonusChance = document.getElementById('frameChanceBonus');
    if (normalChance) normalChance.textContent = (FRAME_CONFIG.frameChanceNormal * 100).toFixed(2) + '%';
    if (bonusChance) bonusChance.textContent = (FRAME_CONFIG.frameChanceBonus * 100).toFixed(2) + '%';

    // Update max values from config
    const maxMultiplierEl = document.getElementById('maxMultiplier');
    const maxMultiplierFinalEl = document.getElementById('maxMultiplierFinal');
    const maxJackpotEl = document.getElementById('maxJackpot');
    
    if (maxMultiplierEl && FRAME_CONFIG.goldenHitMaxMultiplier) {
        maxMultiplierEl.textContent = FRAME_CONFIG.goldenHitMaxMultiplier;
    }
    if (maxMultiplierFinalEl && FRAME_CONFIG.maxFinalMultiplier) {
        maxMultiplierFinalEl.textContent = FRAME_CONFIG.maxFinalMultiplier;
    }
    if (maxJackpotEl && JACKPOTS.values) {
        const maxJackpot = Math.max(...JACKPOTS.values);
        maxJackpotEl.textContent = maxJackpot;
    }

    // Render multiplier values only (weights kept secret in backend)
    const container = document.getElementById('multiplierTable');
    if (!container) return;

    const values = FRAME_CONFIG.multiplierValues;

    let html = '<div class="multiplier-grid">';
    for (let i = 0; i < values.length; i++) {
        html += `
            <div class="multiplier-item">
                <span class="multiplier-value">${values[i]}x</span>
            </div>
        `;
    }
    html += '</div>';
    container.innerHTML = html;
}

// Update game info from server config
function updateGameInfo() {
    if (!GAME_CONFIG.name) return;

    const headerTitle = document.querySelector('.header h1');
    if (headerTitle && GAME_CONFIG.icon && GAME_CONFIG.name) {
        headerTitle.textContent = `${GAME_CONFIG.icon} ${GAME_CONFIG.name}`;
    }

    const subtitle = document.querySelector('.subtitle');
    if (subtitle && GAME_CONFIG.grid && GAME_CONFIG.paylines) {
        subtitle.textContent = `${GAME_CONFIG.grid.rows}x${GAME_CONFIG.grid.cols} Grid | ${GAME_CONFIG.paylines.count} Paylines | RTP ${GAME_CONFIG.rtp}%`;
    }
}

// Update bet size list display
function updateBetSizeListDisplay() {
    const display = document.getElementById('betSizeListDisplay');
    if (display && BET_SIZE_LIST.length > 0) {
        display.textContent = BET_SIZE_LIST.join(', ');
    }
}

// ==================== CONNECTION ====================

async function connect() {
    updateLoading('Fetching token...');
    
    try {
        // Step 1: Get SID
        const sidRes = await fetch(`${CONFIG.sidUrl}?authToken=${CONFIG.authToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: CONFIG.testUuid, userId: CONFIG.testUserId })
        });
        const { sid } = await sidRes.json();
        log('SID fetched');
        
        // Step 2: Launch API
        updateLoading('Launching game...');
        const launchRes = await fetch(CONFIG.launchUrl, {
            method: 'POST',
            // use 'text/plain'
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                operatorId: CONFIG.operatorId,
                gameTypeId: CONFIG.gameTypeId,
                player: {
                    userId: CONFIG.testUserId,
                    currency: CONFIG.currency,
                    language: 'en',
                    sid,
                    name: 'testUser'
                },
                apiSecret: CONFIG.apiSecret
            })
        });
        const launchData = await launchRes.json();
        const redirectUrl = launchData.vals?.data?.redirectUrl;
        const url = new URL(redirectUrl);
        const token = url.searchParams.get('token');
        const lang = url.searchParams.get('lang') || 'en';
        log('Token received');
        
        // Step 3: WebSocket
        updateLoading('Connecting to game...');
        const wsUrl = `${CONFIG.wsBaseUrl}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            log('WebSocket connected');
            send({ type: '0', data: [{ subType: 0 }] }); // Login
        };
        
        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
        };
        
        socket.onerror = (err) => {
            log('WebSocket error', 'error');
            updateLoading('Connection failed - retry?', true);
        };
        
        socket.onclose = () => {
            log('WebSocket closed');
            updateLoading('Disconnected', true);
            clearInterval(pingInterval);
        };
        
    } catch (err) {
        log('Connection failed: ' + err.message, 'error');
        updateLoading('Failed - Click to retry', true);
    }
}

function send(msg) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
    }
}

// ==================== MESSAGE HANDLER ====================

function handleMessage(msg) {
    if (msg.errCode !== 0) {
        log('Server error: ' + msg.errCode, 'error');
        return;
    }

    const { type, data } = msg.vals;

    switch (type) {
        case 1: // Login
            handleLogin(data);
            break;
        case 3: // Lobby
            handleLobby(data);
            break;
        case 100000: // Game messages
            handleGameMessage(data);
            break;
    }
}

function handleLogin(data) {
    log(`Logged in: ${data.sessionId}`);
    send({ type: '2', data: [{ subType: 0 }] }); // Lobby
}

function handleLobby(data) {
    log(`Lobby: ${data.gameId}, Balance: ${data.balance}`);
    currentBalance = data.balance;
    updateBalance(data.balance);

    // Join room
    send({ type: '100000', data: [{ subType: 100004 }] });

    // Sync room info - only called once on initial connection (page refresh)
    send({ type: '100000', data: [{ subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] }] });

    // Start ping - simple keepalive, not SyncRoomInfo
    pingInterval = setInterval(() => {
        send({ type: '100000', data: [{ subType: 100072 }] }); // Heartbeat only
    }, 20000);
}

function handleGameMessage(data) {
    const subType = data.subType;
    const subData = data.subData?.[0];
    
    switch (subType) {
        case 100005: // Join room
            handleJoinRoom(subData);
            break;
        case 100071: // Sub data
            handleSubData(subData);
            break;
    }
}

function handleJoinRoom(data) {
    log(`Joined room: ${data.roomId}`);
    currentBalance = data.balance;

    // Get game data from Join Room response (moved from SyncRoomInfo)
    const betInfo = data.betInfo?.[0];
    if (betInfo) {
        if (betInfo.symbols) {
            SYMBOLS = betInfo.symbols;
        }
        if (betInfo.paylines) {
            PAYLINES = betInfo.paylines;
        }
        if (betInfo.jackpots) {
            JACKPOTS = betInfo.jackpots;
        }
        if (betInfo.bonuses) {
            BONUSES = betInfo.bonuses;
            renderBonusInfo();
        }
        if (betInfo.gameConfig) {
            GAME_CONFIG = betInfo.gameConfig;
            updateGameInfo();
        }
        if (betInfo.frameConfig) {
            FRAME_CONFIG = betInfo.frameConfig;
        }
    }

    // Show game panel
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('gameContent').classList.remove('hidden');

    // Update UI with server data
    document.getElementById('balance').textContent = '$' + data.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // Update betSizeList from server if available
    if (betInfo?.betSizeList) {
        BET_SIZE_LIST = betInfo.betSizeList;
        // Only set default bet if current bet is not in the valid list
        const display = document.getElementById('betDisplay');
        if (display) {
            const currentBet = parseFloat(display.textContent.replace('$', '')) || 0;
            // If current bet is not in the new list, set to default
            const currentIdx = BET_SIZE_LIST.indexOf(currentBet);
            if (currentIdx === -1) {
                const defaultBet = betInfo.defaultBet || BET_SIZE_LIST[0] || 10;
                CURRENT_BET_INDEX = BET_SIZE_LIST.indexOf(defaultBet);
                if (CURRENT_BET_INDEX === -1) CURRENT_BET_INDEX = 0;
                display.textContent = '$' + formatBet(defaultBet);
            } else {
                CURRENT_BET_INDEX = currentIdx;
            }
        }
        updateBetSizeListDisplay();
    }
    
    // Render paytable/paylines now that we have data and DOM is visible
    if (Object.keys(SYMBOLS).length > 0) {
        renderPaytable();
    }
    if (PAYLINES.length > 0) {
        renderPaylines();
    }
    if (Object.keys(JACKPOTS).length > 0) {
        renderJackpots();
    }
    console.log(`DEBUG FRAME_CONFIG = ${JSON.stringify(FRAME_CONFIG)}`)
    renderFrameInfo();
}

// Render bet display with current value (fallback if needed)
function renderBetSelector() {
    const display = document.getElementById('betDisplay');
    if (!display || BET_SIZE_LIST.length === 0) return;

    // Use first bet from list as default, set index
    CURRENT_BET_INDEX = 0;
    const defaultBet = BET_SIZE_LIST[0] || 10;
    display.textContent = '$' + formatBet(defaultBet);
    display.dataset.baseBet = defaultBet; // Store base bet for boost calculation
}

function updateBetSizeListDisplay() {
    const hint = document.getElementById('betSizeListDisplay');
    if (hint && BET_SIZE_LIST.length > 0) {
        hint.textContent = BET_SIZE_LIST.join(', ');
    }
}

function handleSubData(subData) {
    if (!subData?.opCode) return;

    switch (subData.opCode) {
        case 'SyncRoomInfo':
            if (subData.roomInfo) {
                // Load game data from server
                if (subData.roomInfo.symbols) {
                    SYMBOLS = subData.roomInfo.symbols;
                    renderPaytable();
                }
                if (subData.roomInfo.paylines) {
                    PAYLINES = subData.roomInfo.paylines;
                    renderPaylines();
                }
                if (subData.roomInfo.jackpots) {
                    JACKPOTS = subData.roomInfo.jackpots;
                    renderJackpots();
                }
                if (subData.roomInfo.bonuses) {
                    BONUSES = subData.roomInfo.bonuses;
                    renderBonusInfo();
                }
                if (subData.roomInfo.gameConfig) {
                    GAME_CONFIG = subData.roomInfo.gameConfig;
                    updateGameInfo();
                }
                if (subData.roomInfo.betSizeList) {
                    BET_SIZE_LIST = subData.roomInfo.betSizeList;
                    // Validate current index is still valid, adjust if needed
                    CURRENT_BET_INDEX = Math.max(0, Math.min(CURRENT_BET_INDEX, BET_SIZE_LIST.length - 1));
                    // Update display to ensure it matches the tracked index
                    const display = document.getElementById('betDisplay');
                    if (display && BET_SIZE_LIST.length > 0) {
                        display.textContent = '$' + formatBet(BET_SIZE_LIST[CURRENT_BET_INDEX]);
                    }
                    updateBetSizeListDisplay();
                }

                // Restore previous game state if available
                const lastResumeInfo = subData.roomInfo.lastResumeInfo;
                if (lastResumeInfo) {
                    log('Restoring previous game state');

                    // Render the previous grid
                    if (lastResumeInfo.grid) {
                        renderGrid(lastResumeInfo.grid, lastResumeInfo.stickyFrames);
                    }

                    // Check if bonus is active and restore it
                    if (lastResumeInfo.bonusGameState && lastResumeInfo.bonusGameState.spinsLeft > 0) {
                        fakeState.inBonus = true;
                        fakeState.bonusType = lastResumeInfo.bonusGameState.type;
                        fakeState.bonusSpinsLeft = lastResumeInfo.bonusGameState.spinsLeft;
                        fakeState.totalWin = lastResumeInfo.bonusGameState.totalWin || 0;
                        showBonusBanner(lastResumeInfo.bonusGameState.type, lastResumeInfo.bonusGameState.spinsLeft, fakeState.totalWin);
                        log('Bonus game restored: ' + lastResumeInfo.bonusGameState.type + ' with ' + lastResumeInfo.bonusGameState.spinsLeft + ' spins left, total win: $' + fakeState.totalWin);
                    }
                }
            }
            break;

        case 'SetBet':
            handleSpinResult(subData);
            break;
    }
}

// ==================== SPIN & RENDER ====================

function spin() {
    if (isSpinning) {
        console.log('Already spinning, ignoring click');
        return;
    }

    const betDisplay = document.getElementById('betDisplay');
    
    // Use base bet if available (when boost is enabled), otherwise parse from display
    let bet = parseFloat(betDisplay?.dataset.baseBet) || 10;
    
    console.log('[BET DEBUG] Base bet:', bet);
    console.log('[BET DEBUG] Mega Boost enabled:', megaBoostEnabled);
    console.log('[BET DEBUG] BET_SIZE_LIST:', BET_SIZE_LIST);

    // Validate bet is in allowed list, auto-correct if not
    if (!BET_SIZE_LIST.includes(bet)) {
        console.log('[BET DEBUG] Bet ' + bet + ' not in list, auto-correcting');
        bet = getClosestBetSize(bet);
        // Update display to corrected value
        if (betDisplay) {
            betDisplay.dataset.baseBet = bet;
            if (megaBoostEnabled) {
                const boostMultiplier = BONUSES.megaBoost?.costMultiplier || 10;
                betDisplay.textContent = '$' + formatBet(bet * boostMultiplier);
            } else {
                betDisplay.textContent = '$' + formatBet(bet);
            }
        }
    }
    
    // Calculate the actual cost for balance deduction
    const boostMultiplier = megaBoostEnabled ? (BONUSES.megaBoost?.costMultiplier || 10) : 1;
    const actualCost = bet * boostMultiplier;
    
    console.log('[BET DEBUG] Final base bet to send:', bet);
    console.log('[BET DEBUG] Actual cost (with boost):', actualCost);

    // Deduct bet from balance immediately for UX (only if not in bonus)
    if (!fakeState.inBonus) {
        const balanceEl = document.getElementById('balance');
        const currentBalance = parseFloat(balanceEl?.textContent?.replace('$', '').replace(/,/g, '')) || 0;
        const newBalance = Math.max(0, currentBalance - actualCost);
        if (balanceEl) {
            balanceEl.textContent = '$' + newBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        if (megaBoostEnabled) {
            log('Mega Boost Spin: -$' + actualCost + ' (10x $' + bet + ') (Balance: $' + newBalance + ')', 'highlight');
        } else {
            log('Spin: -$' + bet + ' (Balance: $' + newBalance + ')');
        }
    } else {
        log('Bonus Spin: Free! (Spins left: ' + fakeState.bonusSpinsLeft + ')');
    }

    isSpinning = true;
    const btn = document.getElementById('spinBtn');
    btn.disabled = true;
    btn.textContent = '...';

    // Clear previous wins
    document.querySelectorAll('.reel-cell').forEach(c => {
        c.classList.remove('winning');
        c.textContent = '◯';
    });
    document.getElementById('winAmount').classList.add('hidden');
    document.getElementById('winDetails').textContent = '';
    document.getElementById('winWays').innerHTML = '<div class="no-win">Spin to see your wins...</div>';
    
    // Reset payline highlights
    renderPaylines();

    // Spin animation
    const displays = Object.keys(SYMBOLS).length > 0 ? Object.values(SYMBOLS).map(s => s.display) : ['💎', '👑', '💍', '🏆', '💵'];
    let spins = 0;
    const animInterval = setInterval(() => {
        document.querySelectorAll('.reel-cell').forEach((c, idx) => {
            const r = Math.floor(idx / 5);
            const col = idx % 5;
            c.textContent = displays[Math.floor(Math.random() * displays.length)];
            
            // During bonus game, keep showing sticky frames
            if (fakeState.inBonus && currentStickyFrames && currentStickyFrames[r] && currentStickyFrames[r][col] && currentStickyFrames[r][col].value > 0) {
                const frame = currentStickyFrames[r][col];
                const isJackpot = frame.type === 'jackpot';
                let label, color;
                
                if (isJackpot) {
                    const jackpotDisplay = getJackpotFrameDisplay(frame.value);
                    label = jackpotDisplay.label;
                    color = jackpotDisplay.color;
                } else {
                    label = frame.value >= 100 ? '99' : frame.value.toString();
                    color = '#ffd700';
                }
                
                const fontSize = isJackpot ? '0.7rem' : (label.length > 1 ? '0.5rem' : '0.55rem');
                c.innerHTML += `<div class="frame-overlay jackpot-frame" style="border-color:${color};color:${color};font-size:${fontSize};">${label}</div>`;
            }
        });
        spins++;
        if (spins >= 10) clearInterval(animInterval);
    }, 60);

    // Send spin request (line is always 14 on server, only send bet)
    // Include megaBoost flag if enabled (10x cost, 10x bonus entry chance)
    console.log('[BET DEBUG] Sending bet:', bet, 'Type:', typeof bet, 'MegaBoost:', megaBoostEnabled);
    const spinMessage = { bet };
    if (megaBoostEnabled) {
        spinMessage.megaBoost = true;
    }
    send({
        type: '100000',
        data: [{
            subType: 100070,
            subData: [{ opCode: 'SetBet', message: spinMessage }]
        }]
    });
}

function getClosestBetSize(bet) {
    return BET_SIZE_LIST.reduce((prev, curr) =>
        Math.abs(curr - bet) < Math.abs(prev - bet) ? curr : prev
    );
}

function handleSpinResult(data) {
    console.log('[DEBUG] handleSpinResult received:', JSON.stringify(data, null, 2));
    
    try {
        const betInfo = data.betInfo?.[0];
        console.log('[DEBUG] betInfo:', JSON.stringify(betInfo, null, 2));
        
        if (!betInfo) {
            console.error('No betInfo in result', data);
            resetSpin();
            return;
        }
        
        const result = betInfo.gameResult;
        console.log('[DEBUG] gameResult:', JSON.stringify(result, null, 2));
        
        if (!result) {
            console.error('No gameResult in betInfo', betInfo);
            resetSpin();
            return;
        }

        // DEBUG: Log bet info
        console.log('[BET DEBUG] Sent bet vs Received bet:', {
            sent: betInfo.bet,
            awardBase: result.awardBase,
            totalWin: result.totalWinAmount
        });

        // Log bonus buy if awardBase is larger than bet (indicates bonus buy)
        if (result.awardBase > betInfo.bet) {
            log('Bonus bought: -$' + result.awardBase, 'info');
        }

        // DEBUG: Log raw reel data
        console.log('[FRONTEND DEBUG] Raw grid:');
        if (result.grid) {
            result.grid.forEach((row, r) => {
                console.log(`  Row ${r}:`, row.join(' | '));
            });
        }

        // DEBUG: Log win data
        const winAmount = result.totalWinAmount || 0;
        if (result.lineWins && result.lineWins.length > 0) {
            console.log('[FRONTEND DEBUG] Winning lines:', result.lineWins.length);
            result.lineWins.forEach((lw, idx) => {
                const [lineIdx, symbol, count, win] = lw.info;
                console.log(`  Line ${lineIdx + 1}: ${symbol} x${count} = $${win}`);
            });
        } else {
            console.log('[FRONTEND DEBUG] No winning lines');
        }
        
        // Update balance from server result
        currentBalance = betInfo.finalBalance;
        const balanceEl = document.getElementById('balance');
        if (balanceEl) {
            balanceEl.textContent = '$' + (betInfo.finalBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        
        // Log win if applicable
        if (winAmount > 0) {
            log('Win: +$' + winAmount + ' (Balance: $' + (betInfo.finalBalance || 0) + ')', 'success');
        }
        
        // Update fake state
        fakeState.spinCount++;
        fakeState.totalWin += winAmount;
        
        const spinCountEl = document.getElementById('spinCount');
        if (spinCountEl) spinCountEl.textContent = fakeState.spinCount;
        
        const totalWinEl = document.getElementById('totalWin');
        if (totalWinEl) totalWinEl.textContent = '$' + fakeState.totalWin.toLocaleString();
        
        // Render grid with frames (golden/jackpot frames can appear in any spin)
        if (result.grid) {
            // Store sticky frames for bonus game persistence
            if (result.stickyFrames) {
                currentStickyFrames = result.stickyFrames;
            }
            renderGrid(result.grid, result.stickyFrames);
        }
        
        // Show wins
        const winWaysEl = document.getElementById('winWays');
        if (winAmount > 0 && result.lineWins?.length > 0) {
            showWins(result.lineWins, winAmount);
        } else if (winWaysEl) {
            winWaysEl.innerHTML = '<div class="no-win">No win this spin</div>';
        }
    
    // Handle bonus game
    const spinsLeft = result.bonusGameState?.spinsLeft;
    console.log(`@@@@@@@@ spinsLeft = ${spinsLeft}`)
    if (result.isBonus && spinsLeft !== undefined) {
        if (!fakeState.inBonus && spinsLeft > 0) {
            // Bonus just triggered
            fakeState.inBonus = true;
            fakeState.bonusType = result.bonusType;
            fakeState.bonusSpinsLeft = spinsLeft;
            
            // Show trigger overlay with the triggering grid
            showBonusTrigger(result.bonusType, result.grid, result.lineWins, result.totalWinAmount);
            
            // Also show banner for in-game display
            showBonusBanner(result.bonusType, spinsLeft);
            log('BONUS TRIGGERED: ' + result.bonusType + '!', 'info');
            
            // Also highlight winning paylines when bonus triggers
            if (result.lineWins?.length > 0) {
                highlightWinningPaylines(result.lineWins);
            }
        } else if (fakeState.inBonus) {
            // Continue bonus
            fakeState.bonusSpinsLeft = spinsLeft;
            const bonusTotalWin = result.bonusGameState?.totalWin || 0;
            updateBonusBanner(spinsLeft, bonusTotalWin);

            if (result.lastFreeSpin || spinsLeft <= 0) {
                hideBonusBanner();
                fakeState.inBonus = false;
                fakeState.bonusType = null;
                fakeState.bonusSpinsLeft = 0;
                currentStickyFrames = null; // Clear sticky frames when bonus ends
                log('Bonus completed!', 'info');
            }
        }
    } else if (fakeState.inBonus && (!result.isBonus || spinsLeft === 0)) {
        // Bonus ended (server no longer reports bonus or spinsLeft is 0)
        hideBonusBanner();
        fakeState.inBonus = false;
        fakeState.bonusType = null;
        fakeState.bonusSpinsLeft = 0;
        currentStickyFrames = null; // Clear sticky frames when bonus ends
        log('Bonus completed!', 'info');
    }
    
        // Add to history
        addToHistory(betInfo.bet, winAmount, fakeState.inBonus);
        
        log('Win: ' + winAmount + ', Balance: ' + betInfo.finalBalance);
    } catch (err) {
        console.error('Error in handleSpinResult:', err);
        log('Error processing spin: ' + err.message, 'error');
    }
    
    resetSpin();
}

// Helper to get jackpot frame display (icon + color) matching jackpot display
function getJackpotFrameDisplay(value) {
    // Default labels and colors if JACKPOTS not loaded
    if (!JACKPOTS.display) {
        return {
            label: value === 25 ? 'M' : value === 100 ? 'J' : value === 500 ? 'E' : 'X',
            color: value === 25 ? '#87ceeb' : value === 100 ? '#ffa500' : value === 500 ? '#ff69b4' : '#ffd700'
        };
    }
    
    // Find matching jackpot from JACKPOTS.display
    const jackpotEntry = Object.entries(JACKPOTS.display).find(([k, v]) => v.multiplier === `${value}x`);
    if (jackpotEntry) {
        const [key, data] = jackpotEntry;
        return { label: data.icon, color: getJackpotColor(data.name) };
    }
    
    // Fallback
    return {
        label: value === 25 ? 'M' : value === 100 ? 'J' : value === 500 ? 'E' : 'X',
        color: value === 25 ? '#87ceeb' : value === 100 ? '#ffa500' : value === 500 ? '#ff69b4' : '#ffd700'
    };
}

function getJackpotColor(name) {
    const colors = {
        'MINI': '#87ceeb',
        'MAJOR': '#ffa500',
        'MEGA': '#ff69b4',
        'MAX': '#ffd700'
    };
    return colors[name] || '#ffd700';
}

function renderGrid(grid, frames) {
    // Ensure SYMBOLS is loaded, fallback to default if not
    const symbolMap = Object.keys(SYMBOLS).length > 0 ? SYMBOLS : {
        'WILD': { display: '💎' }, 'SCATTER': { display: '⭐' },
        'SYM_1': { display: '👑' }, 'SYM_2': { display: '💍' },
        'SYM_3': { display: '🏆' }, 'SYM_4': { display: '💵' },
        'SYM_5': { display: '🎲' }, 'SYM_6': { display: '🎯' },
        'SYM_7': { display: '🎰' }, 'SYM_8': { display: '🪙' },
        'SYM_9': { display: '💠' }
    };

    // DEBUG: Check symbol mapping
    console.log('[FRONTEND DEBUG] SYMBOLS loaded:', Object.keys(SYMBOLS).length > 0);
    console.log('[FRONTEND DEBUG] Symbol map keys:', Object.keys(symbolMap));

    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (!cell) continue;

            const symbol = grid[r][c];
            const symbolData = symbolMap[symbol];

            // DEBUG: Log symbol mapping
            if (r === 0 && c === 0) {
                console.log(`[FRONTEND DEBUG] Raw symbol: "${symbol}" -> Display: "${symbolData?.display || symbol}"`);
            }

            let html = symbolData?.display || symbol;
            
            // Add frame overlay if present (only during bonus)
            if (frames && Array.isArray(frames) && frames[r] && frames[r][c] && frames[r][c].value > 0) {
                const frame = frames[r][c];
                const isJackpot = frame.type === 'jackpot';
                let label, color;
                
                if (isJackpot) {
                    const jackpotDisplay = getJackpotFrameDisplay(frame.value);
                    label = jackpotDisplay.label;
                    color = jackpotDisplay.color;
                } else {
                    label = frame.value >= 100 ? '99' : frame.value.toString();
                    color = '#ffd700';
                }
                
                const fontSize = isJackpot ? '0.7rem' : (label.length > 1 ? '0.5rem' : '0.55rem');
                html += `<div class="frame-overlay jackpot-frame" style="border-color:${color};color:${color};font-size:${fontSize};">${label}</div>`;
            }
            
            cell.innerHTML = html;
            cell.className = `reel-cell symbol-${symbol}`;
        }
    }
}

function showWins(lineWins, totalWin) {
    // Highlight winning cells
    lineWins.forEach(lw => {
        const positions = lw.positions;
        positions.forEach(([r, c]) => {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (cell) cell.classList.add('winning');
        });
    });

    // Highlight winning paylines in the paylines display
    highlightWinningPaylines(lineWins);

    // Show win amount
    const winEl = document.getElementById('winAmount');
    winEl.textContent = '+$' + totalWin.toLocaleString();
    winEl.classList.remove('hidden');
    document.getElementById('winDetails').textContent = lineWins.length + ' winning line(s)';

    // Show detailed win breakdown
    const winWaysEl = document.getElementById('winWays');
    if (winWaysEl) {
        // Calculate total multiplier contribution
        let totalMultiplier = 1;
        let hasJackpot = false;
        lineWins.forEach(lw => {
            const fc = lw.frameContribution;
            if (fc) {
                if (fc.multipliers.length > 0) {
                    totalMultiplier *= fc.multipliers.reduce((a, b) => a * b, 1);
                }
                if (fc.jackpotWins.length > 0) {
                    hasJackpot = true;
                }
            }
        });

        let html = `
        <div class="win-summary" style="background:linear-gradient(135deg, rgba(46,204,113,0.2), rgba(255,215,0,0.1));padding:12px;border-radius:10px;margin-bottom:12px;text-align:center;border:2px solid rgba(46,204,113,0.4);">
            <div style="color:#2ecc71;font-weight:bold;font-size:1.2rem;text-shadow:0 0 10px rgba(46,204,113,0.3);">${lineWins.length} WINNING LINE${lineWins.length>1?'S':''}!</div>
            <div style="color:#ffd700;font-size:1.6rem;font-weight:bold;margin-top:6px;text-shadow:0 0 15px rgba(255,215,0,0.4);">+$${totalWin.toLocaleString()}</div>
            ${totalMultiplier > 1 ? `<div style="color:#ff6b6b;font-size:0.85rem;margin-top:4px;font-weight:bold;">🔥 ${totalMultiplier}x Multiplier Boost!</div>` : ''}
            ${hasJackpot ? `<div style="color:#ffd700;font-size:0.85rem;margin-top:4px;font-weight:bold;">💎 Jackpot Win!</div>` : ''}
        </div>
        `;
        
        lineWins.forEach((lw, idx) => {
            const [lineIdx, symbol, count, win] = lw.info;
            const symbolName = SYMBOLS[symbol]?.name || symbol;
            const symbolDisplay = SYMBOLS[symbol]?.display || symbol;
            const fc = lw.frameContribution;
            
            let boostInfo = '';
            if (fc) {
                const parts = [];
                if (fc.multipliers.length > 0) {
                    const multTotal = fc.multipliers.reduce((a, b) => a * b, 1);
                    parts.push(`🔥 ${fc.multipliers.join('×')}× = ${multTotal}x`);
                }
                if (fc.jackpotWins.length > 0) {
                    parts.push(`💎 Jackpot: ${fc.jackpotWins.join('x, ')}x`);
                }
                if (parts.length > 0) {
                    boostInfo = `<div style="color:#ff6b6b;font-size:0.75rem;margin-top:4px;font-weight:bold;">${parts.join(' • ')}</div>`;
                }
            }
            
            html += `
                <div class="win-way-item" style="background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;margin:8px 0;border-left:3px solid #2ecc71;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="color:#888;font-size:0.8rem;">Line ${lineIdx + 1}</span>
                        <span style="color:#2ecc71;font-weight:bold;">+$${win.toLocaleString()}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                        <span style="font-size:1.5rem;">${symbolDisplay}</span>
                        <span style="color:#fff;font-size:0.9rem;">${symbolName}</span>
                        <span style="color:#ffd700;font-size:0.85rem;font-weight:bold;">${count} of a kind</span>
                    </div>
                    ${boostInfo}
                </div>
            `;
        });
        winWaysEl.innerHTML = html;
    }
}

// Highlight winning paylines in the paylines display
function highlightWinningPaylines(lineWins) {
    const container = document.getElementById('paylinesDisplay');
    if (!container || PAYLINES.length === 0) return;
    
    // Get winning line indices
    const winningLineIndices = lineWins.map(lw => lw.info[0]);
    
    // Re-render paylines with winning ones highlighted
    container.innerHTML = PAYLINES.map((line, idx) => {
        const isWinning = winningLineIndices.includes(idx);
        return `
            <div class="payline-item" style="background:${isWinning ? 'rgba(46,204,113,0.3)' : 'rgba(0,0,0,0.3)'};padding:6px;border-radius:6px;text-align:center;border:${isWinning ? '2px solid #2ecc71' : 'none'};">
                <div style="font-size:0.6rem;color:${isWinning ? '#2ecc71' : '#888'};margin-bottom:4px;font-weight:${isWinning ? 'bold' : 'normal'};">${line.name}${isWinning ? ' ✓' : ''}</div>
                <div style="display:grid;grid-template-columns:repeat(5,10px);grid-template-rows:repeat(4,10px);gap:1px;margin:0 auto;width:54px;">
                    ${Array.from({length: 20}).map((_, i) => {
                        const r = Math.floor(i / 5);
                        const c = i % 5;
                        const isActive = line.pattern[c] === r;
                        const bgColor = isActive 
                            ? (isWinning ? '#2ecc71' : 'rgba(255,255,255,0.3)') 
                            : 'rgba(255,255,255,0.05)';
                        return `<div style="width:10px;height:10px;background:${bgColor};border-radius:2px;"></div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    // Reset after 3 seconds
    setTimeout(() => {
        renderPaylines();
    }, 3000);
}

function addToHistory(bet, win, isBonus) {
    const container = document.getElementById('spinHistory');
    const item = document.createElement('div');
    item.className = 'history-item';

    const winText = win > 0 ? `<span style="color:#2ecc71;font-weight:bold;">+$${win}</span>` :
                    '<span style="color:#888;">No win</span>';
    const bonusTag = isBonus ? '<span style="color:#ffd700;font-size:0.7rem;"> [BONUS]</span>' : '';

    item.innerHTML = `Spin ${fakeState.spinCount}: <span style="color:#666;">-$${bet}</span> → ${winText}${bonusTag}`;
    container.insertBefore(item, container.firstChild);

    // Keep last 10
    while (container.children.length > 10) {
        container.removeChild(container.lastChild);
    }
}

// ==================== BONUS GAME UI ====================

function showBonusBanner(bonusType, spinsLeft, totalWin = 0) {
    const banner = document.getElementById('bonusBanner');
    const nameEl = document.getElementById('bonusName');
    const descEl = document.getElementById('bonusDesc');
    const spinsEl = document.getElementById('spinsLeft');
    const winEl = document.getElementById('bonusTotalWin');

    const name = bonusType === 'BLACK_AND_GOLD' ? 'BLACK AND GOLD' : 
                 bonusType === 'MEGA_BONUS' ? 'MEGA BONUS' : 'GOLDEN HIT';
    const desc = bonusType === 'BLACK_AND_GOLD'
        ? '10 free spins with sticky golden frames'
        : bonusType === 'MEGA_BONUS'
        ? '50x per spin with 10x bonus entry chance! 10 free spins'
        : 'Enhanced bonus with doubled multipliers';

    nameEl.textContent = name + ' BONUS!';
    descEl.textContent = desc;
    spinsEl.textContent = spinsLeft;
    if (winEl) winEl.textContent = '$' + totalWin.toLocaleString();

    // Show bonus mode content, hide normal mode text
    const normalModeText = document.getElementById('normalModeText');
    const bonusContent = document.getElementById('bonusModeContent');
    if (normalModeText) normalModeText.classList.add('hidden');
    if (bonusContent) bonusContent.classList.remove('hidden');

    banner.classList.add('bonus-active');
    document.getElementById('gameContainer').classList.add('bonus-mode');

    // Trigger bonus entry animation
    banner.style.animation = 'none';
    setTimeout(() => {
        banner.style.animation = '';
    }, 10);
}

function updateBonusBanner(spinsLeft, totalWin) {
    const spinsEl = document.getElementById('spinsLeft');
    if (spinsEl) {
        spinsEl.textContent = spinsLeft;
    }
    const winEl = document.getElementById('bonusTotalWin');
    if (winEl && totalWin !== undefined) {
        winEl.textContent = '$' + totalWin.toLocaleString();
    }
}

function hideBonusBanner() {
    const banner = document.getElementById('bonusBanner');
    const normalModeText = document.getElementById('normalModeText');
    const bonusContent = document.getElementById('bonusModeContent');

    // Show normal mode text, hide bonus content
    if (normalModeText) normalModeText.classList.remove('hidden');
    if (bonusContent) bonusContent.classList.add('hidden');

    banner.classList.remove('bonus-active');
    document.getElementById('gameContainer').classList.remove('bonus-mode');
}

// ==================== BONUS TRIGGER OVERLAY ====================

function showBonusTrigger(bonusType, grid, lineWins, totalWin) {
    const overlay = document.getElementById('triggerOverlay');
    const textEl = document.getElementById('triggerText');
    const gridEl = document.getElementById('triggerGrid');
    const winEl = document.getElementById('triggerWin');

    // Set text based on bonus type
    const bonusName = bonusType === 'BLACK_AND_GOLD' ? 'Black & Gold' : 
                      bonusType === '' ? 'Mega Bonus' : 'Golden Hit';
    const scatterCount = bonusType === 'GOLDEN_HIT' ? '4' : '3';
    textEl.textContent = `${scatterCount} Scatters! You won ${bonusName} Bonus!`;

    // Render the triggering grid
    let gridHtml = '';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const symbol = grid[r][c];
            const isScatter = symbol === 'SCATTER';
            const display = SYMBOLS[symbol]?.display || symbol;
            gridHtml += `<div class="trigger-cell ${isScatter ? 'scatter' : ''}">${display}</div>`;
        }
    }
    gridEl.innerHTML = gridHtml;

    // Show win amount
    winEl.textContent = totalWin > 0 ? `Win: +$${totalWin.toLocaleString()}` : '';

    // Show overlay
    overlay.classList.add('active');
}

function hideBonusTrigger() {
    const overlay = document.getElementById('triggerOverlay');
    overlay.classList.remove('active');
}

function enterBonus() {
    hideBonusTrigger();
    // Bonus game continues automatically
    log('Entering bonus game...', 'info');
}

function resetSpin() {
    console.log('Resetting spin button');
    isSpinning = false;
    const btn = document.getElementById('spinBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = '🎰 SPIN';
        console.log('Spin button reset successfully');
    } else {
        console.error('Spin button not found!');
    }
}

// ==================== UI HELPERS ====================

function updateBalance(balance) {
    document.getElementById('balance').textContent = '$' + (balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function updateStatus(text, type) {
    const status = document.getElementById('connection-status');
    status.textContent = text;
    status.className = `status ${type}`;
}

// ==================== BET FORMATTING ====================

function formatBet(bet) {
    return Number.isInteger(bet) ? bet : bet.toFixed(2);
}

// ==================== CONTROLS ====================

function changeBet(dir) {
    const display = document.getElementById('betDisplay');
    if (!display || BET_SIZE_LIST.length === 0) return;

    // Use tracked index instead of indexOf (avoids float comparison issues)
    let newIdx = CURRENT_BET_INDEX + dir;
    newIdx = Math.max(0, Math.min(BET_SIZE_LIST.length - 1, newIdx));

    CURRENT_BET_INDEX = newIdx;
    const newBet = BET_SIZE_LIST[newIdx];
    
    // Store base bet for boost calculation
    display.dataset.baseBet = newBet;
    
    // Update display with boost if enabled
    if (megaBoostEnabled) {
        const boostMultiplier = BONUSES.megaBoost?.costMultiplier || 10;
        const boostedBet = newBet * boostMultiplier;
        display.textContent = '$' + formatBet(boostedBet);
        display.style.color = '#ff9f43';
        display.style.textShadow = '0 0 10px rgba(255, 159, 67, 0.5)';
    } else {
        display.textContent = '$' + formatBet(newBet);
        display.style.color = '';
        display.style.textShadow = '';
    }
    
    // Update the boost details panel
    updateMegaBoostBetDisplay();
    
    log('Bet changed to $' + formatBet(newBet) + (megaBoostEnabled ? ' (Boosted: $' + formatBet(newBet * (BONUSES.megaBoost?.costMultiplier || 10)) + ')' : '') + ' [index=' + newIdx + ']');
}

function buyBonus(key) {
    if (isSpinning) return;
    if (fakeState.inBonus) {
        log('Cannot buy bonus during bonus game!', 'error');
        return;
    }

    // Convert key to bonus type
    const bonusTypeMap = {
        'blackAndGold': 'BLACK_AND_GOLD',
        'goldenHit': 'GOLDEN_HIT'
    };
    const bonusType = bonusTypeMap[key];
    if (!bonusType) {
        log('Unknown bonus type: ' + key, 'error');
        return;
    }

    // Get current bet and calculate cost
    const betDisplay = document.getElementById('betDisplay');
    const betText = betDisplay?.textContent || '';
    const bet = parseFloat(betText.replace('$', '')) || 10;

    const bonus = BONUSES[key];
    const cost = bonus?.buyPriceMultiplier ? bet * bonus.buyPriceMultiplier : 0;

    // Deduct bonus cost from balance immediately
    const balanceEl = document.getElementById('balance');
    const currentBalance = parseFloat(balanceEl?.textContent?.replace('$', '').replace(/,/g, '')) || 0;
    const newBalance = Math.max(0, currentBalance - cost);
    if (balanceEl) {
        balanceEl.textContent = '$' + newBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }

    log('Buying bonus: ' + bonus?.name + ' for $' + cost + ' (Balance: $' + newBalance + ')');

    isSpinning = true;
    const btn = document.getElementById('spinBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '...';
    }

    // Clear previous wins
    document.querySelectorAll('.reel-cell').forEach(c => {
        c.classList.remove('winning');
        c.textContent = '◯';
    });
    document.getElementById('winAmount')?.classList.add('hidden');
    document.getElementById('winDetails').textContent = '';
    const winWaysEl = document.getElementById('winWays');
    if (winWaysEl) winWaysEl.innerHTML = '<div class="no-win">Spin to see your wins...</div>';

    // Reset payline highlights
    renderPaylines();

    // Send spin request with force bonus
    send({
        type: '100000',
        data: [{
            subType: 100070,
            subData: [{
                opCode: 'SetBet',
                message: {
                    bet,
                    forceBonusType: bonusType
                }
            }]
        }]
    });
}

// ==================== UI HELPERS ====================

function updateLoading(text, showRetry = false) {
    const el = document.getElementById('loading');
    el.textContent = text;
    if (showRetry) {
        el.style.cursor = 'pointer';
        el.onclick = () => {
            el.style.cursor = 'default';
            el.onclick = null;
            connect();
        };
    }
}

function log(msg, type = 'info') {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.insertBefore(entry, logs.firstChild);
    while (logs.children.length > 100) logs.removeChild(logs.lastChild);
}

function clearLogs() {
    document.getElementById('logs').innerHTML = '';
}
