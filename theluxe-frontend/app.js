/**
 * TheLuxe Slot Game - Direct WebSocket Client
 * Simple approach: connect → handle messages → render UI
 */

// Symbol emojis
const SYMBOLS = {
    'WILD': '💎', 'SCATTER': '⭐',
    'SYM_1': '👑', 'SYM_2': '💍', 'SYM_3': '🏆', 'SYM_4': '💵',
    'SYM_5': '🎲', 'SYM_6': '🎯', 'SYM_7': '🎰', 'SYM_8': '🪙', 'SYM_9': '💠'
};

const SYMBOL_NAMES = {
    'WILD': 'Wild', 'SCATTER': 'Scatter',
    'SYM_1': 'Crown', 'SYM_2': 'Ring', 'SYM_3': 'Trophy', 'SYM_4': 'Cash',
    'SYM_5': 'Dice', 'SYM_6': 'Dart', 'SYM_7': 'Slot', 'SYM_8': 'Coin', 'SYM_9': 'Gem'
};

// Game state
let socket = null;
let isSpinning = false;
let pingInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initGrid();
    bindControls();
    connect();
});

// Create 4x5 grid
function initGrid() {
    const reels = document.getElementById('reels');
    reels.innerHTML = '';
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${r}-${c}`;
            cell.textContent = '❓';
            reels.appendChild(cell);
        }
    }
}

// Bind controls
function bindControls() {
    document.getElementById('spin-btn').addEventListener('click', spin);
    document.getElementById('bet-select').addEventListener('change', updateTotalBet);
    document.getElementById('lines-select').addEventListener('change', updateTotalBet);
    document.getElementById('clear-logs').addEventListener('click', () => {
        document.getElementById('logs').innerHTML = '';
    });
}

function updateTotalBet() {
    const bet = parseInt(document.getElementById('bet-select').value);
    const lines = parseInt(document.getElementById('lines-select').value);
    document.getElementById('total-bet').textContent = bet * lines;
}

// ==================== CONNECTION ====================

async function connect() {
    updateStatus('Fetching token...', 'connecting');
    
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
        updateStatus('Launching game...', 'connecting');
        const launchRes = await fetch(CONFIG.launchUrl, {
            method: 'POST',
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
        updateStatus('Connecting...', 'connecting');
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
            updateStatus('Error', 'disconnected');
        };
        
        socket.onclose = () => {
            log('WebSocket closed');
            updateStatus('Disconnected', 'disconnected');
            clearInterval(pingInterval);
        };
        
    } catch (err) {
        log('Connection failed: ' + err.message, 'error');
        updateStatus('Failed - Retry?', 'disconnected');
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
    console.log(`data = ${JSON.stringify(data)}`)
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
    updateStatus('Connected', 'connected');
    
    // Show game panel
    document.getElementById('game-panel').classList.remove('hidden');
    
    // Update UI
    document.getElementById('game-name').textContent = data.gameType;
    document.getElementById('room-id').textContent = data.roomId;
    updateBalance(data.balance);
    
    if (data.betInfo?.[0]) {
        document.getElementById('min-bet').textContent = data.betInfo[0].minBet;
        document.getElementById('max-bet').textContent = data.betInfo[0].maxBet;
    }
}

function handleSubData(subData) {
    if (!subData?.opCode) return;
    
    switch (subData.opCode) {
        case 'SyncRoomInfo':
            if (subData.roomInfo) {
                document.getElementById('min-bet').textContent = subData.roomInfo.minBet;
                document.getElementById('max-bet').textContent = subData.roomInfo.maxBet;
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
    
    const bet = parseInt(document.getElementById('bet-select').value);
    const line = parseInt(document.getElementById('lines-select').value);
    
    isSpinning = true;
    document.getElementById('spin-btn').disabled = true;
    document.getElementById('spin-btn').textContent = 'Spinning...';
    
    // Clear wins
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('winner'));
    document.querySelectorAll('.payline').forEach(p => p.classList.remove('winner'));
    hideWinDisplay();
    
    // Animate
    document.querySelectorAll('.cell').forEach(c => c.classList.add('spinning'));
    
    // Send spin
    send({
        type: '100000',
        data: [{
            subType: 100070,
            subData: [{ opCode: 'SetBet', message: { bet, line } }]
        }]
    });
}

function handleSpinResult(data) {
    // Stop animation
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('spinning'));
    
    const betInfo = data.betInfo?.[0];
    if (!betInfo) {
        resetSpin();
        return;
    }
    
    const result = betInfo.gameResult;
    
    // Update balance
    updateBalance(betInfo.finalBalance);
    document.getElementById('last-win').textContent = result.totalWinAmount || 0;
    
    // Render grid
    renderGrid(result.grid);
    
    // Show wins
    if (result.totalWinAmount > 0 && result.lineWins?.length > 0) {
        showWins(result.lineWins, result.totalWinAmount);
    }
    
    // Show details
    showDetails(result, betInfo);
    
    log(`Win: ${result.totalWinAmount}, Balance: ${betInfo.finalBalance}`);
    resetSpin();
}

function renderGrid(grid) {
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            const symbol = grid[r][c];
            cell.textContent = SYMBOLS[symbol] || symbol;
            cell.className = `cell symbol-${symbol}`;
        }
    }
}

function showWins(lineWins, totalWin) {
    // Highlight cells and paylines
    lineWins.forEach(lw => {
        const lineIdx = lw.info[0];
        const positions = lw.positions;
        
        // Payline indicator
        const indicator = document.querySelector(`.payline[data-line="${lineIdx}"]`);
        if (indicator) indicator.classList.add('winner');
        
        // Cells
        positions.forEach(([r, c]) => {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (cell) cell.classList.add('winner');
        });
    });
    
    // Show popup
    const popup = document.getElementById('win-display');
    document.getElementById('win-amount').textContent = totalWin;
    document.getElementById('win-lines').textContent = lineWins.length + ' lines won';
    popup.classList.remove('hidden');
    
    setTimeout(() => popup.classList.add('hidden'), 3000);
}

function hideWinDisplay() {
    document.getElementById('win-display').classList.add('hidden');
}

function showDetails(result, betInfo) {
    const container = document.getElementById('last-spin-info');
    const details = document.getElementById('spin-details');
    
    let html = `<div>Bet: ${betInfo.bet} × ${betInfo.line} = ${betInfo.bet * betInfo.line}</div>`;
    html += `<div>Win: ${result.totalWinAmount || 0}</div>`;
    
    if (result.lineWins?.length > 0) {
        html += `<div style="margin-top:8px">Winning Lines:</div>`;
        result.lineWins.forEach(lw => {
            const [line, sym, count, win] = lw.info;
            html += `<div>Line ${line+1}: ${SYMBOL_NAMES[sym]} ×${count} = ${win}</div>`;
        });
    }
    
    details.innerHTML = html;
    container.classList.remove('hidden');
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
}

function log(msg, type = 'info') {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.insertBefore(entry, logs.firstChild);
    while (logs.children.length > 100) logs.removeChild(logs.lastChild);
}
