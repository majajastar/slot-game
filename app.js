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
    const container = document.getElementById('bonusInfo');
    if (!container || Object.keys(BONUSES).length === 0) return;

    container.innerHTML = Object.entries(BONUSES).map(([key, bonus]) => `
        <div class="bonus-item">
            <div class="bonus-name">${bonus.name}</div>
            <div class="bonus-desc">${bonus.scatterCount} Scatters • ${bonus.description}</div>
        </div>
    `).join('');
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
    
    // Sync room info
    send({ type: '100000', data: [{ subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] }] });
    
    // Start ping
    pingInterval = setInterval(() => {
        send({ type: '100000', data: [{ subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] }] });
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
        }
        if (betInfo.gameConfig) {
            GAME_CONFIG = betInfo.gameConfig;
            updateGameInfo();
        }
    }

    // Show game panel
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('gameContent').classList.remove('hidden');

    // Update UI with server data
    document.getElementById('balance').textContent = '$' + data.balance.toLocaleString();

    // Update betSizeList from server if available
    if (betInfo?.betSizeList) {
        BET_SIZE_LIST = betInfo.betSizeList;
        // Only set default bet if current bet is not in the valid list
        const display = document.getElementById('betDisplay');
        if (display) {
            const currentBet = parseInt(display.textContent.replace('$', '')) || 0;
            // If current bet is not in the new list, set to default
            const currentIdx = BET_SIZE_LIST.indexOf(currentBet);
            if (currentIdx === -1) {
                const defaultBet = betInfo.defaultBet || BET_SIZE_LIST[0] || 10;
                CURRENT_BET_INDEX = BET_SIZE_LIST.indexOf(defaultBet);
                if (CURRENT_BET_INDEX === -1) CURRENT_BET_INDEX = 0;
                display.textContent = '$' + defaultBet;
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
}

// Render bet display with current value (fallback if needed)
function renderBetSelector() {
    const display = document.getElementById('betDisplay');
    if (!display || BET_SIZE_LIST.length === 0) return;

    // Use first bet from list as default, set index
    CURRENT_BET_INDEX = 0;
    const defaultBet = BET_SIZE_LIST[0] || 10;
    display.textContent = '$' + defaultBet;
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
                        display.textContent = '$' + BET_SIZE_LIST[CURRENT_BET_INDEX];
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
                        showBonusBanner(lastResumeInfo.bonusGameState.type, lastResumeInfo.bonusGameState.spinsLeft);
                        log('Bonus game restored: ' + lastResumeInfo.bonusGameState.type + ' with ' + lastResumeInfo.bonusGameState.spinsLeft + ' spins left');
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
    const betText = betDisplay?.textContent || '';
    const betNumber = parseInt(betText.replace('$', ''));
    
    console.log('[BET DEBUG] Bet display text:', betText);
    console.log('[BET DEBUG] Parsed bet number:', betNumber);
    console.log('[BET DEBUG] BET_SIZE_LIST:', BET_SIZE_LIST);
    
    let bet = betNumber || 10;

    // Validate bet is in allowed list, auto-correct if not
    if (!BET_SIZE_LIST.includes(bet)) {
        console.log('[BET DEBUG] Bet ' + bet + ' not in list, auto-correcting');
        bet = getClosestBetSize(bet);
        // Update display to corrected value
        if (betDisplay) {
            betDisplay.textContent = '$' + bet;
        }
    }
    
    console.log('[BET DEBUG] Final bet to send:', bet);

    // Deduct bet from balance immediately for UX
    const balanceEl = document.getElementById('balance');
    const currentBalance = parseInt(balanceEl?.textContent?.replace('$', '').replace(/,/g, '')) || 0;
    const newBalance = Math.max(0, currentBalance - bet);
    if (balanceEl) {
        balanceEl.textContent = '$' + newBalance.toLocaleString();
    }
    log('Spin: -$' + bet + ' (Balance: $' + newBalance + ')');

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
    document.getElementById('winWays').innerHTML = '<div class="no-win">...</div>';
    
    // Reset payline highlights
    renderPaylines();

    // Spin animation
    const displays = Object.keys(SYMBOLS).length > 0 ? Object.values(SYMBOLS).map(s => s.display) : ['💎', '👑', '💍', '🏆', '💵'];
    let spins = 0;
    const animInterval = setInterval(() => {
        document.querySelectorAll('.reel-cell').forEach(c => {
            c.textContent = displays[Math.floor(Math.random() * displays.length)];
        });
        spins++;
        if (spins >= 10) clearInterval(animInterval);
    }, 60);

    // Send spin request (line is always 14 on server, only send bet)
    console.log('[BET DEBUG] Sending bet:', bet, 'Type:', typeof bet);
    send({
        type: '100000',
        data: [{
            subType: 100070,
            subData: [{ opCode: 'SetBet', message: { bet } }]
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
            balanceEl.textContent = '$' + (betInfo.finalBalance || 0).toLocaleString();
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
    if (result.isBonus && spinsLeft !== undefined) {
        if (!fakeState.inBonus && spinsLeft > 0) {
            // Bonus just triggered
            fakeState.inBonus = true;
            fakeState.bonusType = result.bonusType;
            fakeState.bonusSpinsLeft = spinsLeft;
            showBonusBanner(result.bonusType, spinsLeft);
            log('BONUS TRIGGERED: ' + result.bonusType + '!', 'info');
        } else if (fakeState.inBonus) {
            // Continue bonus
            fakeState.bonusSpinsLeft = spinsLeft;
            updateBonusBanner(spinsLeft);
            
            if (result.lastFreeSpin || spinsLeft <= 0) {
                hideBonusBanner();
                fakeState.inBonus = false;
                fakeState.bonusType = null;
                fakeState.bonusSpinsLeft = 0;
                log('Bonus completed!', 'info');
            }
        }
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
                    label = frame.value === 25 ? 'M' : frame.value === 100 ? 'J' : frame.value === 500 ? 'E' : 'X';
                    color = frame.value === 25 ? '#87ceeb' : frame.value === 100 ? '#ffa500' : frame.value === 500 ? '#ff69b4' : '#ffd700';
                } else {
                    label = frame.value >= 100 ? '99' : frame.value.toString();
                    color = '#ffd700';
                }
                
                const fontSize = isJackpot ? '0.6rem' : (label.length > 1 ? '0.5rem' : '0.55rem');
                html += `<div class="frame-overlay" style="border-color:${color};color:${color};font-size:${fontSize};">${label}</div>`;
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
    
    // Update win ways panel
    const winWaysEl = document.getElementById('winWays');
    winWaysEl.innerHTML = `
        <div style="background:rgba(46,204,113,0.2);padding:10px;border-radius:8px;margin-bottom:12px;text-align:center;border:1px solid rgba(46,204,113,0.3);">
            <div style="color:#2ecc71;font-weight:bold;font-size:1.1rem;">${lineWins.length} WAY${lineWins.length>1?'S':''} TO WIN!</div>
            <div style="color:#ffd700;font-size:1.4rem;font-weight:bold;margin-top:4px;">+$${totalWin.toLocaleString()}</div>
        </div>
    ` + lineWins.map((lw, i) => {
        const [line, symbol, count, win] = lw.info;
        const symData = SYMBOLS[symbol] || { display: symbol, name: symbol };
        return `
            <div class="win-way-item" style="animation:fadeIn 0.3s ${i*0.1}s both;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#2ecc71;font-weight:bold;">+$${win}</span>
                    <span style="color:#888;font-size:0.7rem;">Line ${line+1}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
                    <span style="color:#fff;font-size:0.8rem;">${symData.display} ${symData.name}</span>
                    <span style="color:#ffd700;font-size:0.8rem;font-weight:bold;">${count} of a kind</span>
                </div>
            </div>
        `;
    }).join('');
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

function showBonusBanner(bonusType, spinsLeft) {
    const banner = document.getElementById('bonusBanner');
    const nameEl = document.getElementById('bonusName');
    const descEl = document.getElementById('bonusDesc');
    const spinsEl = document.getElementById('spinsLeft');

    const name = bonusType === 'BLACK_AND_GOLD' ? 'BLACK AND GOLD' : 'GOLDEN HIT';
    const desc = bonusType === 'BLACK_AND_GOLD'
        ? '10 free spins with sticky golden frames'
        : 'Enhanced bonus with doubled multipliers';

    nameEl.textContent = name + ' BONUS!';
    descEl.textContent = desc;
    spinsEl.textContent = spinsLeft;

    banner.classList.remove('hidden');
    document.getElementById('gameContainer').classList.add('bonus-mode');
}

function updateBonusBanner(spinsLeft) {
    const spinsEl = document.getElementById('spinsLeft');
    if (spinsEl) {
        spinsEl.textContent = spinsLeft;
    }
}

function hideBonusBanner() {
    const banner = document.getElementById('bonusBanner');
    banner.classList.add('hidden');
    document.getElementById('gameContainer').classList.remove('bonus-mode');
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
    document.getElementById('balance').textContent = balance?.toLocaleString() || '0';
}

function updateStatus(text, type) {
    const status = document.getElementById('connection-status');
    status.textContent = text;
    status.className = `status ${type}`;
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
    display.textContent = '$' + newBet;
    log('Bet changed to $' + newBet + ' [index=' + newIdx + ']');
}

function buyBonus(key) {
    if (isSpinning) return;

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
    const bet = parseInt(betText.replace('$', '')) || 10;

    const bonus = BONUSES[key];
    const cost = bonus?.buyPriceMultiplier ? bet * bonus.buyPriceMultiplier : 0;

    // Deduct bonus cost from balance immediately
    const balanceEl = document.getElementById('balance');
    const currentBalance = parseInt(balanceEl?.textContent?.replace('$', '').replace(/,/g, '')) || 0;
    const newBalance = Math.max(0, currentBalance - cost);
    if (balanceEl) {
        balanceEl.textContent = '$' + newBalance.toLocaleString();
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
    const winWaysEl = document.getElementById('winWays');
    if (winWaysEl) winWaysEl.innerHTML = '<div class="no-win">...</div>';

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

function updateBalance(balance) {
    document.getElementById('balance').textContent = '$' + (balance || 0).toLocaleString();
}

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
