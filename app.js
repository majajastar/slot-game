/**
 * TheLuxe Slot Game - Direct WebSocket Client
 * Uses fake data for fields not available from server
 */

// Symbol definitions with emojis
const SYMBOLS = {
    'WILD': { display: '💎', name: 'Diamond Wild', payout: { 5: 100, 4: 0, 3: 0 } },
    'SCATTER': { display: '⭐', name: 'Star Scatter', payout: { 5: 0, 4: 0, 3: 0 } },
    'SYM_1': { display: '👑', name: 'Crown', payout: { 5: 50, 4: 25, 3: 10 } },
    'SYM_2': { display: '💍', name: 'Ring', payout: { 5: 40, 4: 20, 3: 8 } },
    'SYM_3': { display: '🏆', name: 'Trophy', payout: { 5: 30, 4: 15, 3: 6 } },
    'SYM_4': { display: '💵', name: 'Cash', payout: { 5: 20, 4: 10, 3: 4 } },
    'SYM_5': { display: '🎲', name: 'Dice', payout: { 5: 5, 4: 2, 3: 1 } },
    'SYM_6': { display: '🎯', name: 'Target', payout: { 5: 5, 4: 2, 3: 1 } },
    'SYM_7': { display: '🎰', name: 'Slot', payout: { 5: 5, 4: 2, 3: 1 } },
    'SYM_8': { display: '🪙', name: 'Coin', payout: { 5: 5, 4: 2, 3: 1 } },
    'SYM_9': { display: '💠', name: 'Gem', payout: { 5: 5, 4: 2, 3: 1 } }
};

// Payline patterns (fake data - 14 paylines on 4x5 grid)
const PAYLINES = [
    { name: 'Line 1', pattern: [0, 0, 0, 0, 0] },
    { name: 'Line 2', pattern: [1, 1, 1, 1, 1] },
    { name: 'Line 3', pattern: [2, 2, 2, 2, 2] },
    { name: 'Line 4', pattern: [3, 3, 3, 3, 3] },
    { name: 'Line 5', pattern: [0, 1, 0, 1, 0] },
    { name: 'Line 6', pattern: [1, 2, 1, 2, 1] },
    { name: 'Line 7', pattern: [2, 3, 2, 3, 2] },
    { name: 'Line 8', pattern: [1, 0, 1, 0, 1] },
    { name: 'Line 9', pattern: [2, 1, 2, 1, 2] },
    { name: 'Line 10', pattern: [3, 2, 3, 2, 3] },
    { name: 'Line 11', pattern: [0, 1, 2, 1, 0] },
    { name: 'Line 12', pattern: [1, 2, 3, 2, 1] },
    { name: 'Line 13', pattern: [3, 2, 1, 2, 3] },
    { name: 'Line 14', pattern: [2, 1, 0, 1, 2] }
];

// Fake game state for fields not in server response
let fakeState = {
    spinCount: 0,
    totalWin: 0,
    history: [],
    inBonus: false,
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
    renderPaytable();
    renderPaylines();
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

// Render paytable using fake data
function renderPaytable() {
    const container = document.getElementById('paytable');
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
    html += symbols.map(([id, s]) => `
        <div class="paytable-row" style="${id === 'WILD' ? 'background:rgba(233,69,96,0.1);border-left:3px solid #e94560;padding-left:4px;' : ''}">
            <span class="paytable-icon">${s.display}</span>
            <span class="paytable-name">${s.name}${id === 'WILD' ? ' ⭐' : ''}</span>
            <span class="paytable-payout" style="font-weight:bold;color:#ffd700;">${s.payout[5]}x</span>
            <span class="paytable-payout">${s.payout[4]}x</span>
            <span class="paytable-payout">${s.payout[3]}x</span>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Render paylines using fake data
function renderPaylines() {
    const container = document.getElementById('paylinesDisplay');
    container.innerHTML = PAYLINES.map((line, idx) => `
        <div class="payline-item">
            <div class="payline-name">${line.name}</div>
            <div class="payline-mini">
                ${Array.from({length: 20}).map((_, i) => {
                    const r = Math.floor(i / 5);
                    const c = i % 5;
                    const isActive = line.pattern[c] === r;
                    return `<div class="payline-mini-cell ${isActive ? 'active' : ''}"></div>`;
                }).join('')}
            </div>
        </div>
    `).join('');
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
        log('→ ' + JSON.stringify(msg).substring(0, 100));
    }
}

// ==================== MESSAGE HANDLER ====================

function handleMessage(msg) {
    if (msg.errCode !== 0) {
        log('Server error: ' + msg.errCode, 'error');
        return;
    }
    
    log('← ' + JSON.stringify(msg).substring(0, 150));
    
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
    
    // Show game panel
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('gameContent').classList.remove('hidden');
    
    // Update UI with server data
    document.getElementById('balance').textContent = '$' + data.balance.toLocaleString();
    
    if (data.betInfo?.[0]) {
        // Could update min/max bet here if needed
    }
}

function handleSubData(subData) {
    if (!subData?.opCode) return;
    
    switch (subData.opCode) {
        case 'SyncRoomInfo':
            if (subData.roomInfo) {
                // Update room info if needed
            }
            break;
            
        case 'SetBet':
            handleSpinResult(subData);
            break;
    }
}

// ==================== SPIN & RENDER ====================

function spin() {
    if (isSpinning) return;
    
    const bet = parseInt(document.getElementById('betDisplay').textContent.replace('$', '')) || 10;
    const line = 14; // Always 14 lines for now
    
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
    const displays = Object.values(SYMBOLS).map(s => s.display);
    let spins = 0;
    const animInterval = setInterval(() => {
        document.querySelectorAll('.reel-cell').forEach(c => {
            c.textContent = displays[Math.floor(Math.random() * displays.length)];
        });
        spins++;
        if (spins >= 10) clearInterval(animInterval);
    }, 60);
    
    // Send spin request
    send({
        type: '100000',
        data: [{
            subType: 100070,
            subData: [{ opCode: 'SetBet', message: { bet, line } }]
        }]
    });
}

function handleSpinResult(data) {
    const betInfo = data.betInfo?.[0];
    if (!betInfo) {
        resetSpin();
        return;
    }
    
    const result = betInfo.gameResult;
    const winAmount = result.totalWinAmount || 0;
    
    // Update server data
    currentBalance = betInfo.finalBalance;
    document.getElementById('balance').textContent = '$' + betInfo.finalBalance.toLocaleString();
    
    // Update fake state
    fakeState.spinCount++;
    fakeState.totalWin += winAmount;
    document.getElementById('spinCount').textContent = fakeState.spinCount;
    document.getElementById('totalWin').textContent = '$' + fakeState.totalWin.toLocaleString();
    
    // Render grid
    renderGrid(result.grid);
    
    // Show wins
    if (winAmount > 0 && result.lineWins?.length > 0) {
        showWins(result.lineWins, winAmount);
    } else {
        document.getElementById('winWays').innerHTML = '<div class="no-win">No win this spin</div>';
    }
    
    // Add to history
    addToHistory(betInfo.bet, winAmount);
    
    log(`Win: ${winAmount}, Balance: ${betInfo.finalBalance}`);
    resetSpin();
}

function renderGrid(grid) {
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            const symbol = grid[r][c];
            cell.textContent = SYMBOLS[symbol]?.display || symbol;
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
        const symData = SYMBOLS[symbol];
        return `
            <div class="win-way-item" style="animation:fadeIn 0.3s ${i*0.1}s both;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#2ecc71;font-weight:bold;">+$${win}</span>
                    <span style="color:#888;font-size:0.7rem;">Line ${line+1}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
                    <span style="color:#fff;font-size:0.8rem;">${symData?.display} ${symData?.name}</span>
                    <span style="color:#ffd700;font-size:0.8rem;font-weight:bold;">${count} of a kind</span>
                </div>
            </div>
        `;
    }).join('');
}

function addToHistory(bet, win) {
    const container = document.getElementById('spinHistory');
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const winText = win > 0 ? `<span style="color:#2ecc71;font-weight:bold;">+$${win}</span>` : 
                    '<span style="color:#888;">No win</span>';
    
    item.innerHTML = `Spin ${fakeState.spinCount}: <span style="color:#666;">-$${bet}</span> → ${winText}`;
    container.insertBefore(item, container.firstChild);
    
    // Keep last 10
    while (container.children.length > 10) {
        container.removeChild(container.lastChild);
    }
}

function resetSpin() {
    isSpinning = false;
    const btn = document.getElementById('spin-btn');
    btn.disabled = false;
    btn.textContent = '🎰 SPIN';
}

// ==================== UI HELPERS ====================

function updateBalance(balance) {
    document.getElementById('balance').textContent = balance?.toLocaleString() || '0';
}

function updateStatus(text, type) {
    const status = document.getElementById('connection-status');
    status.textContent = text;
    status.className = `status ${type}`;

    const btn = document.getElementById('spinSpin');
    if (btn) {
        btn.disabled = false;
        btn.textContent = '🎰 SPIN';
    }
}

// ==================== CONTROLS ====================

function changeBet(dir) {
    const display = document.getElementById('betDisplay');
    const sizes = [1, 2, 5, 10, 20, 50, 100];
    const current = parseInt(display.textContent.replace('$', '')) || 10;
    const idx = sizes.indexOf(current);
    const newIdx = Math.max(0, Math.min(sizes.length - 1, idx + dir));
    display.textContent = '$' + sizes[newIdx];
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
