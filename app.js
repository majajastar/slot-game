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
    
    // Debug: Check if containers exist after a delay
    setTimeout(() => {
        console.log('[INIT] Checking DOM elements:');
        console.log('[INIT] paytable:', document.getElementById('paytable'));
        console.log('[INIT] paylinesDisplay:', document.getElementById('paylinesDisplay'));
        console.log('[INIT] gameContent hidden:', document.getElementById('gameContent')?.classList.contains('hidden'));
    }, 1000);
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
    // Draw paylines after grid is created
    setTimeout(() => {
        if (PAYLINES.length > 0) {
            drawPaylinesOnGrid();
        }
    }, 100);
}

// Manual render for debugging
window.debugRender = function() {
    console.log('[MANUAL] debugRender called');
    console.log('[MANUAL] SYMBOLS:', Object.keys(SYMBOLS));
    console.log('[MANUAL] PAYLINES:', PAYLINES.length);
    renderPaytable();
    renderPaylines();
};

// Render paytable using server data
function renderPaytable() {
    console.log('[DEBUG] renderPaytable called');
    const container = document.getElementById('paytable');
    if (!container) {
        console.error('[DEBUG] paytable container NOT FOUND in DOM!');
        return;
    }
    
    console.log('[DEBUG] paytable container:', container);
    console.log('[DEBUG] paytable parent:', container.parentElement);
    console.log('[DEBUG] paytable display:', getComputedStyle(container).display);
    console.log('[DEBUG] paytable visibility:', getComputedStyle(container).visibility);
    
    // TEMP: Add border to see container
    container.style.border = '2px solid red';
    
    const symbolCount = Object.keys(SYMBOLS).length;
    console.log('[DEBUG] symbolCount:', symbolCount);
    if (symbolCount === 0) {
        container.innerHTML = '<div style="color:#888;padding:10px;">Loading paytable...</div>';
        return;
    }
    
    const symbols = Object.entries(SYMBOLS).filter(([id]) => id !== 'SCATTER');
    
    // Header
    let html = `
        <div class="paytable-row" style="border-bottom:2px solid #e94560;margin-bottom:8px;padding-bottom:6px;">
            <span style="font-size:0.65rem;color:#888;text-align:center;">Icon</span>
            <span style="font-size:0.65rem;color:#888;">Symbol</span>
            <span class="paytable-payout" style="font-size:0.65rem;color:#888;">5x</span>
            <span class="paytable-payout" style="font-size:0.65rem;color:#888;">4x</span>
            <span class="paytable-payout" style="font-size:0.65rem;color:#888;">3x</span>
        </div>
    `;
    
    // Data rows
    console.log('[DEBUG] Rendering paytable rows for:', symbols.map(([id]) => id).join(', '));
    html += symbols.map(([id, s]) => {
        console.log(`[DEBUG] Rendering row: ${id} = ${s.display} ${s.name}`);
        return `
        <div class="paytable-row" style="${id === 'WILD' ? 'background:rgba(233,69,96,0.1);border-left:3px solid #e94560;padding-left:4px;' : ''}">
            <span class="paytable-icon">${s.display || '?'}</span>
            <span class="paytable-name">${s.name || id}${id === 'WILD' ? ' ⭐' : ''}</span>
            <span class="paytable-payout" style="font-weight:bold;color:#ffd700;">${s.payout?.[5] || 0}x</span>
            <span class="paytable-payout">${s.payout?.[4] || 0}x</span>
            <span class="paytable-payout">${s.payout?.[3] || 0}x</span>
        </div>
    `}).join('');
    
    container.innerHTML = html;
    console.log('[DEBUG] Paytable HTML inserted into container');
    console.log('[DEBUG] Container innerHTML length:', container.innerHTML.length);
}

// Render paylines using server data
function renderPaylines() {
    console.log('[DEBUG] renderPaylines called');
    const container = document.getElementById('paylinesDisplay');
    if (!container) {
        console.error('[DEBUG] paylinesDisplay container NOT FOUND in DOM!');
        return;
    }
    
    console.log('[DEBUG] PAYLINES count:', PAYLINES.length);
    if (PAYLINES.length === 0) {
        container.innerHTML = '<div style="color:#888;padding:10px;">Loading paylines...</div>';
        return;
    }
    
    // Draw SVG paylines on the grid
    drawPaylinesOnGrid();
    
    // Also show payline list
    container.innerHTML = PAYLINES.map((line, idx) => `
        <div class="payline-item" onclick="highlightPayline(${idx})" style="cursor:pointer;">
            <div class="payline-name">${line.name}</div>
        </div>
    `).join('');
    console.log('[DEBUG] Paylines rendered successfully with', PAYLINES.length, 'lines');
}

// Draw paylines as SVG lines on the grid
function drawPaylinesOnGrid() {
    const svg = document.getElementById('paylineOverlay');
    const grid = document.getElementById('reelGrid');
    if (!svg || !grid) return;
    
    // Clear existing lines
    svg.innerHTML = '';
    
    // Get cell dimensions
    const cells = grid.querySelectorAll('.reel-cell');
    if (cells.length === 0) return;
    
    const cellWidth = cells[0].offsetWidth;
    const cellHeight = cells[0].offsetHeight;
    const gap = 10; // match CSS gap
    
    // Colors for different paylines
    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da', '#fcbad3', '#ffffd2', '#a8e6cf', '#fdffb6', '#ffd3b6', '#ffaaa5', '#ff8b94', '#c7ceea'];
    
    PAYLINES.forEach((line, idx) => {
        const pattern = line.pattern;
        let path = '';
        
        // Calculate points for the payline
        const points = pattern.map((row, col) => {
            const x = col * (cellWidth + gap) + cellWidth / 2;
            const y = row * (cellHeight + gap) + cellHeight / 2;
            return `${x},${y}`;
        });
        
        // Create polyline
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', points.join(' '));
        polyline.setAttribute('fill', 'none');
        polyline.setAttribute('stroke', colors[idx % colors.length]);
        polyline.setAttribute('stroke-width', '3');
        polyline.setAttribute('stroke-linecap', 'round');
        polyline.setAttribute('stroke-linejoin', 'round');
        polyline.setAttribute('opacity', '0.6');
        polyline.setAttribute('id', `payline-${idx}`);
        polyline.style.display = 'none'; // Hidden by default
        
        svg.appendChild(polyline);
    });
    
    console.log('[DEBUG] Drew', PAYLINES.length, 'paylines on grid');
}

// Highlight a specific payline
function highlightPayline(idx) {
    // Hide all paylines
    document.querySelectorAll('#paylineOverlay polyline').forEach(line => {
        line.style.display = 'none';
    });
    
    // Show selected payline
    const line = document.getElementById(`payline-${idx}`);
    if (line) {
        line.style.display = 'block';
        // Auto-hide after 2 seconds
        setTimeout(() => {
            line.style.display = 'none';
        }, 2000);
    }
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

// Render bonus info using server data
function renderBonusInfo() {
    const container = document.getElementById('bonusInfo');
    if (!container || Object.keys(BONUSES).length === 0) return;
    
    container.innerHTML = Object.entries(BONUSES).map(([key, bonus]) => `
        <div class="bonus-item">
            <div class="bonus-name">${bonus.name}</div>
            <div class="bonus-desc">${bonus.description}</div>
            <div class="bonus-meta">${bonus.scatterCount} scatters • ${bonus.buyPriceDisplay || bonus.buyPrice + 'x'}</div>
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
            console.log('[SERVER →]', JSON.parse(JSON.stringify(msg)));
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
    console.log('[→ SERVER]', JSON.parse(JSON.stringify(msg)));
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
    
    console.log('[DEBUG] Join room data:', data);
    console.log('[DEBUG] betInfo:', data.betInfo?.[0]);

    // Get game data from Join Room response (moved from SyncRoomInfo)
    const betInfo = data.betInfo?.[0];
    if (betInfo) {
        console.log('[DEBUG] Loading game data from Join Room');
        console.log('[DEBUG] betInfo has symbols:', !!betInfo.symbols);
        console.log('[DEBUG] betInfo has paylines:', !!betInfo.paylines);
        
        if (betInfo.symbols) {
            console.log('[DEBUG] Setting SYMBOLS from Join Room, count:', Object.keys(betInfo.symbols).length);
            SYMBOLS = betInfo.symbols;
        }
        if (betInfo.paylines) {
            console.log('[DEBUG] Setting PAYLINES from Join Room, count:', betInfo.paylines.length);
            PAYLINES = betInfo.paylines;
        }
        if (betInfo.jackpots) {
            JACKPOTS = betInfo.jackpots;
        }
        if (betInfo.bonuses) {
            BONUSES = betInfo.bonuses;
        }
    }

    // Show game panel
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('gameContent').classList.remove('hidden');
    
    console.log('[DEBUG] Game panel now visible');

    // Update UI with server data
    document.getElementById('balance').textContent = '$' + data.balance.toLocaleString();

    // Update betSizeList from server if available
    if (betInfo?.betSizeList) {
        BET_SIZE_LIST = betInfo.betSizeList;
        renderBetSelector();
        updateBetSizeListDisplay();
    }
    
    // Render paytable/paylines now that we have data and DOM is visible
    console.log('[DEBUG] Checking data after Join Room - symbols:', Object.keys(SYMBOLS).length, 'paylines:', PAYLINES.length);
    if (Object.keys(SYMBOLS).length > 0) {
        console.log('[DEBUG] Calling renderPaytable from handleJoinRoom');
        renderPaytable();
    }
    if (PAYLINES.length > 0) {
        console.log('[DEBUG] Calling renderPaylines from handleJoinRoom');
        renderPaylines();
    }
}

// Render bet display with current value
function renderBetSelector() {
    const display = document.getElementById('betDisplay');
    if (!display || BET_SIZE_LIST.length === 0) return;

    // Set default to middle of list
    const defaultBet = BET_SIZE_LIST[Math.floor(BET_SIZE_LIST.length / 2)] || BET_SIZE_LIST[0] || 10;
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
            console.log('[DEBUG] SyncRoomInfo received');
            console.log('[DEBUG] Full subData:', JSON.parse(JSON.stringify(subData)));
            if (subData.roomInfo) {
                console.log('[DEBUG] roomInfo keys:', Object.keys(subData.roomInfo));
                console.log('[DEBUG] has symbols:', !!subData.roomInfo.symbols, 'count:', subData.roomInfo.symbols ? Object.keys(subData.roomInfo.symbols).length : 0);
                console.log('[DEBUG] has paylines:', !!subData.roomInfo.paylines, 'count:', subData.roomInfo.paylines ? subData.roomInfo.paylines.length : 0);
                console.log('[DEBUG] roomInfo.symbols type:', typeof subData.roomInfo.symbols);
                console.log('[DEBUG] roomInfo.paylines type:', typeof subData.roomInfo.paylines);
                
                // Load game data from server
                if (subData.roomInfo.symbols) {
                    console.log('[DEBUG] RECEIVED PAYTABLE FROM SERVER:');
                    console.log('[DEBUG] Symbols object:', subData.roomInfo.symbols);
                    console.log('[DEBUG] Symbol IDs:', Object.keys(subData.roomInfo.symbols));
                    Object.entries(subData.roomInfo.symbols).forEach(([id, data]) => {
                        console.log(`[DEBUG]   ${id}: ${data.display} ${data.name} - payouts:`, data.payout);
                    });
                    SYMBOLS = subData.roomInfo.symbols;
                    renderPaytable();
                } else {
                    console.error('[DEBUG] No symbols in roomInfo!');
                }
                if (subData.roomInfo.paylines) {
                    console.log('[DEBUG] Setting PAYLINES and calling renderPaylines');
                    PAYLINES = subData.roomInfo.paylines;
                    renderPaylines();
                } else {
                    console.error('[DEBUG] No paylines in roomInfo!');
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
                    renderBetSelector();
                    updateBetSizeListDisplay();
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
    let bet = parseInt(betDisplay?.textContent?.replace('$', '')) || 10;

    // Validate bet is in allowed list, auto-correct if not
    if (!BET_SIZE_LIST.includes(bet)) {
        console.log('Bet ' + bet + ' not in list, auto-correcting');
        bet = getClosestBetSize(bet);
        // Update display to corrected value
        if (betDisplay) {
            betDisplay.textContent = '$' + bet;
        }
    }
    
    console.log('Starting spin with bet:', bet);

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
    try {
        const betInfo = data.betInfo?.[0];
        if (!betInfo) {
            console.error('No betInfo in result', data);
            resetSpin();
            return;
        }
        
        const result = betInfo.gameResult;
        if (!result) {
            console.error('No gameResult in betInfo', betInfo);
            resetSpin();
            return;
        }
        
        const winAmount = result.totalWinAmount || 0;
        
        // Update server data
        currentBalance = betInfo.finalBalance;
        const balanceEl = document.getElementById('balance');
        if (balanceEl) {
            balanceEl.textContent = '$' + (betInfo.finalBalance || 0).toLocaleString();
        }
        
        // Update fake state
        fakeState.spinCount++;
        fakeState.totalWin += winAmount;
        
        const spinCountEl = document.getElementById('spinCount');
        if (spinCountEl) spinCountEl.textContent = fakeState.spinCount;
        
        const totalWinEl = document.getElementById('totalWin');
        if (totalWinEl) totalWinEl.textContent = '$' + fakeState.totalWin.toLocaleString();
        
        // Render grid with frames if in bonus
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
    if (result.isBonus) {
        if (!fakeState.inBonus && result.bonusSpinsLeft > 0) {
            // Bonus just triggered
            fakeState.inBonus = true;
            fakeState.bonusType = result.bonusType;
            fakeState.bonusSpinsLeft = result.bonusSpinsLeft;
            showBonusBanner(result.bonusType, result.bonusSpinsLeft);
            log('BONUS TRIGGERED: ' + result.bonusType + '!', 'info');
        } else if (fakeState.inBonus) {
            // Continue bonus
            fakeState.bonusSpinsLeft = result.bonusSpinsLeft;
            updateBonusBanner(result.bonusSpinsLeft);
            
            if (result.lastFreeSpin) {
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
    
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (!cell) continue;
            
            const symbol = grid[r][c];
            const symbolData = symbolMap[symbol];
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
    if (!display) return;

    const current = parseInt(display.textContent.replace('$', '')) || 10;
    const idx = BET_SIZE_LIST.indexOf(current);

    // Find next valid index
    let newIdx;
    if (idx === -1) {
        // Current bet not in list, find closest
        newIdx = BET_SIZE_LIST.findIndex(b => b >= current);
        if (newIdx === -1) newIdx = BET_SIZE_LIST.length - 1;
    } else {
        newIdx = Math.max(0, Math.min(BET_SIZE_LIST.length - 1, idx + dir));
    }

    const newBet = BET_SIZE_LIST[newIdx];
    display.textContent = '$' + newBet;
    log('Bet changed to $' + newBet);
}

function buyBonus(type) {
    if (isSpinning) return;
    log('Bonus buy not implemented yet: ' + type);
    alert('Bonus buy coming soon!');
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
