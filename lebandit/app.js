/**
 * LeBandit Slot Game - Direct WebSocket Client
 * 6x5 grid with cluster wins and cascading reels
 */

// Data from server (populated after SyncRoomInfo)
let SYMBOLS = {};
let CLUSTER_PAYOUTS = {};
let GAME_CONFIG = {};
let BET_SIZE_LIST = [5, 10, 20, 50, 100];
let CURRENT_BET_INDEX = 2; // Default $20

// Fake game state for fields not in server response
let fakeState = {
    spinCount: 0,
    totalWin: 0,
    history: [],
    cascadeSteps: [],
    rainbowResult: null
};

// Current game state from server
let socket = null;
let isSpinning = false;
let pingInterval = null;
let currentBalance = 0;

// Grid state
let currentGrid = [];
let goldenSquares = [];
let symbolInstances = {}; // Track symbol IDs

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initGrid();
    renderPaytable();
    updateBetDisplay();
    updateServerModeDisplay();
    connect();
});

// Update server mode display
function updateServerModeDisplay() {
    const modeEl = document.getElementById('serverMode');
    if (!modeEl) return;
    
    if (CONFIG.serverMode === 'fake') {
        modeEl.textContent = '🧪 Fake Server';
        modeEl.className = 'server-mode fake';
    } else {
        modeEl.textContent = '🔴 Real Server';
        modeEl.className = 'server-mode real';
    }
}

// Create 6x5 grid
function initGrid() {
    const grid = document.getElementById('reelGrid');
    grid.innerHTML = '';
    for (let r = 0; r < CONFIG.rows; r++) {
        for (let c = 0; c < CONFIG.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'reel-cell lebandit-cell';
            cell.id = `cell-${r}-${c}`;
            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.textContent = '◯';
            grid.appendChild(cell);
        }
    }
}

// Render cluster paytable
function renderPaytable() {
    const container = document.getElementById('paytable');
    if (!container) return;

    // Default cluster payouts (will be overridden by server data)
    const clusterPayouts = {
        '1':   { name: 'Wild',   payouts: [0, 0, 0, 0, 0, 5, 10, 20, 40, 80, 150, 300, 500] },
        '201': { name: 'Crown',  payouts: [0, 0, 0, 0, 0, 4, 8, 16, 32, 60, 120, 250, 400] },
        '202': { name: 'Ring',   payouts: [0, 0, 0, 0, 0, 3, 6, 12, 25, 50, 100, 200, 350] },
        '203': { name: 'Trophy', payouts: [0, 0, 0, 0, 0, 2.5, 5, 10, 20, 40, 80, 160, 300] },
        '204': { name: 'Cash',   payouts: [0, 0, 0, 0, 0, 2, 4, 8, 16, 32, 64, 120, 250] },
        '205': { name: 'Slot',   payouts: [0, 0, 0, 0, 0, 1.5, 3, 6, 12, 24, 48, 100, 200] },
        '101': { name: 'Spades', payouts: [0, 0, 0, 0, 0, 1, 2, 4, 8, 16, 32, 64, 150] },
        '102': { name: 'Hearts', payouts: [0, 0, 0, 0, 0, 1, 2, 4, 8, 16, 32, 64, 150] },
        '103': { name: 'Diamonds', payouts: [0, 0, 0, 0, 0, 1, 2, 4, 8, 16, 32, 64, 150] }
    };

    let html = `
        <div class="cluster-paytable-header">
            <span>Icon</span>
            <span>Symbol</span>
            <span>5</span>
            <span>6</span>
            <span>7</span>
            <span>8</span>
            <span>9-10</span>
            <span>11-12</span>
            <span>13+</span>
        </div>
    `;

    Object.entries(clusterPayouts).forEach(([id, data]) => {
        const display = CONFIG.symbols[id] || '?';
        const payouts = data.payouts;
        const isWild = id === '1';
        const rowClass = isWild ? 'cluster-paytable-row wild-row' : 'cluster-paytable-row';
        html += `
            <div class="${rowClass}">
                <span class="paytable-icon">${display}</span>
                <span class="paytable-name">${data.name}</span>
                <span class="paytable-payout">${payouts[5]}x</span>
                <span class="paytable-payout">${payouts[6]}x</span>
                <span class="paytable-payout">${payouts[7]}x</span>
                <span class="paytable-payout">${payouts[8]}x</span>
                <span class="paytable-payout">${payouts[10]}x</span>
                <span class="paytable-payout">${payouts[12]}x</span>
                <span class="paytable-payout high">${payouts[13]}x</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

// WebSocket Connection
function connect() {
    const wsUrl = getWebSocketUrl(CONFIG.authToken, 'en');
    const modeText = CONFIG.serverMode === 'fake' ? 'FAKE' : 'REAL';
    console.log(`[LeBandit] Connecting to ${modeText} server:`, wsUrl);
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log(`[LeBandit] Connected to ${modeText} server`);
        hideLoading();
        sendLogin();
    };
    
    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    };
    
    socket.onclose = () => {
        console.log('WebSocket closed');
        showLoading('Reconnecting...');
        setTimeout(connect, 3000);
    };
    
    socket.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
}

// Send message wrapper
function send(type, data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error('Socket not ready');
        return;
    }
    
    const msg = { type: String(type), data: data || [] };
    console.log('→ Sending:', msg);
    socket.send(JSON.stringify(msg));
}

// Message handlers
function handleMessage(msg) {
    console.log('← Received:', msg);
    
    if (!msg.vals) return;
    
    const type = msg.vals.type;
    const data = msg.vals.data;
    
    switch (type) {
        case 1: // Login response
            handleLoginResponse(data);
            break;
        case 100000: // Room messages
            handleRoomMessage(data);
            break;
    }
}

function handleLoginResponse(data) {
    console.log('Login successful:', data);
    if (data.sessionId) {
        joinRoom();
    }
}

function handleRoomMessage(data) {
    const subType = data.subType;
    const subData = data.subData?.[0];
    
    switch (subType) {
        case 100005: // Join room response
            handleJoinRoom(subData);
            break;
        case 100071: // Sync room info
            handleSyncRoom(subData);
            break;
        case 100012: // Set bet response (includes spin result)
            handleSpinResult(subData);
            break;
    }
}

// API Calls
function sendLogin() {
    send('0', [{ subType: 0 }]);
}

function joinRoom() {
    send('100000', [{ 
        subType: 100004,
        subData: [{ roomId: 'lebandit-room-001' }]
    }]);
}

function sendSyncRoom() {
    send('100000', [{
        subType: 100070,
        subData: [{ opCode: 'SyncRoomInfo' }]
    }]);
}

function sendSetBet(bet) {
    const betIndex = BET_SIZE_LIST.indexOf(bet);
    send('100000', [{
        subType: 100012,
        subData: [{ 
            opCode: 'SetBet',
            message: { betSizeListIndex: betIndex }
        }]
    }]);
}

// Response Handlers
function handleJoinRoom(data) {
    console.log('Joined room:', data);
    if (data.betInfo?.[0]) {
        const info = data.betInfo[0];
        if (info.betSizeList) {
            BET_SIZE_LIST = info.betSizeList;
        }
        renderPaytable();
        updateBetDisplay();
    }
    sendSyncRoom();
}

function handleSyncRoom(data) {
    if (data.roomInfo) {
        currentBalance = data.roomInfo.balance || 0;
        updateBalance();
        
        // Restore grid if in middle of game
        if (data.roomInfo.gameState?.grid) {
            renderGrid(data.roomInfo.gameState.grid);
        }
    }
}

function handleSpinResult(data) {
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
    
    if (!data.result) return;
    
    const result = data.result;
    
    // Update balance
    if (data.balance !== undefined) {
        currentBalance = data.balance;
        updateBalance();
    }
    
    // Render cascade if present
    if (result.cascadeSteps && result.cascadeSteps.length > 0) {
        renderCascade(result.cascadeSteps, result.totalWinAmount);
    } else {
        // Simple grid render
        renderGrid(result.grid);
        showWin(result.totalWinAmount);
    }
    
    // Render rainbow feature if present
    if (result.rainbowResult && result.rainbowResult.hasRainbow) {
        renderRainbowFeature(result.rainbowResult);
    }
    
    // Update history
    fakeState.history.unshift({
        win: result.totalWinAmount,
        bet: result.bet,
        timestamp: new Date().toLocaleTimeString()
    });
}

// Grid Rendering
function renderGrid(grid) {
    if (!grid || !grid.length) return;
    
    currentGrid = grid;
    
    for (let r = 0; r < CONFIG.rows; r++) {
        for (let c = 0; c < CONFIG.cols; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (cell && grid[r] && grid[r][c]) {
                const symbolId = grid[r][c];
                cell.textContent = CONFIG.symbols[symbolId] || symbolId;
                cell.dataset.symbol = symbolId;
                cell.classList.remove('wild', 'scatter', 'highlight');
                
                if (symbolId === '1') cell.classList.add('wild');
                if (symbolId === '2') cell.classList.add('scatter');
            }
        }
    }
}

// Cascade Animation
async function renderCascade(steps, totalWin) {
    const cascadeInfo = document.getElementById('cascadeInfo');
    const cascadeStepEl = document.getElementById('cascadeStep');
    const cascadeHistory = document.getElementById('cascadeHistory');
    const cascadeStepsList = document.getElementById('cascadeStepsList');
    
    cascadeInfo.classList.remove('hidden');
    cascadeHistory.classList.remove('hidden');
    cascadeStepsList.innerHTML = '';
    
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        cascadeStepEl.textContent = step.step;
        
        // Render grid before removal
        renderGrid(step.gridBefore);
        highlightWinningSymbols(step.winningClusters);
        
        await sleep(800);
        
        // Show removal animation
        highlightRemovedSymbols(step.removedSymbols);
        
        await sleep(500);
        
        // Render after removal
        renderGrid(step.gridAfterRemoval);
        
        await sleep(300);
        
        // Render after drop
        renderGrid(step.gridAfterDrop);
        animateDrops(step.movements);
        
        await sleep(500);
        
        // Render final with new symbols
        renderGrid(step.gridAfterFill);
        animateNewSymbols(step.newSymbols);
        
        // Add to history
        const stepDiv = document.createElement('div');
        stepDiv.className = 'cascade-step-item';
        stepDiv.innerHTML = `
            <span class="step-number">${step.step}</span>
            <span class="step-win">+$${step.totalWin.toFixed(2)}</span>
        `;
        cascadeStepsList.appendChild(stepDiv);
        
        await sleep(600);
    }
    
    cascadeInfo.classList.add('hidden');
    showWin(totalWin);
}

// Rainbow Feature Rendering
async function renderRainbowFeature(rainbowResult) {
    const rainbowOverlay = document.getElementById('rainbowOverlay');
    const rainbowContent = document.getElementById('rainbowContent');
    const rainbowHistory = document.getElementById('rainbowHistory');
    const rainbowRoundsList = document.getElementById('rainbowRoundsList');
    
    rainbowOverlay.classList.remove('hidden');
    rainbowHistory.classList.remove('hidden');
    
    // Highlight rainbow position
    if (rainbowResult.rainbowPosition) {
        const { row, col } = rainbowResult.rainbowPosition;
        const cell = document.getElementById(`cell-${row}-${col}`);
        if (cell) {
            cell.textContent = CONFIG.symbols['RAINBOW'];
            cell.classList.add('rainbow');
        }
    }
    
    // Render each round
    for (const round of rainbowResult.rounds) {
        let roundHtml = `<div class="rainbow-round"><div class="round-title">Round ${round.round}</div>`;
        
        // Show coins
        if (round.coins.length > 0) {
            roundHtml += `<div class="round-coins">`;
            for (const coin of round.coins) {
                const coinEmoji = CONFIG.symbols[coin.type.toUpperCase()];
                roundHtml += `
                    <div class="coin-item ${coin.type}">
                        <span class="coin-emoji">${coinEmoji}</span>
                        <span class="coin-value">${coin.finalMultiplier}x</span>
                    </div>
                `;
            }
            roundHtml += `</div>`;
        }
        
        // Show clovers
        if (round.clovers.length > 0) {
            roundHtml += `<div class="round-clovers">`;
            for (const clover of round.clovers) {
                roundHtml += `
                    <div class="clover-item">
                        <span class="clover-emoji">${CONFIG.symbols['CLOVER']}</span>
                        <span class="clover-multiplier">${clover.multiplier}x</span>
                    </div>
                `;
            }
            roundHtml += `</div>`;
        }
        
        // Show pots
        if (round.pots.length > 0) {
            roundHtml += `<div class="round-pots">`;
            for (const pot of round.pots) {
                roundHtml += `
                    <div class="pot-item">
                        <span class="pot-emoji">${CONFIG.symbols['POT']}</span>
                        <span class="pot-value">${pot.finalMultiplier}x</span>
                    </div>
                `;
            }
            roundHtml += `</div>`;
        }
        
        roundHtml += `</div>`;
        
        const roundDiv = document.createElement('div');
        roundDiv.innerHTML = roundHtml;
        rainbowRoundsList.appendChild(roundDiv);
        
        await sleep(1000);
    }
    
    await sleep(2000);
    rainbowOverlay.classList.add('hidden');
}

// Animation Helpers
function highlightWinningSymbols(clusters) {
    if (!clusters) return;
    
    for (const cluster of clusters) {
        for (const pos of cluster.positions) {
            const cell = document.getElementById(`cell-${pos.row}-${pos.col}`);
            if (cell) cell.classList.add('highlight');
        }
    }
}

function highlightRemovedSymbols(removedSymbols) {
    for (const rs of removedSymbols) {
        const cell = document.getElementById(`cell-${rs.row}-${rs.col}`);
        if (cell) {
            cell.classList.add('removing');
            cell.style.transform = 'scale(0)';
        }
    }
}

function animateDrops(movements) {
    for (const move of movements) {
        const cell = document.getElementById(`cell-${move.to.row}-${move.to.col}`);
        if (cell) {
            cell.style.animation = 'drop 0.3s ease-out';
        }
    }
}

function animateNewSymbols(newSymbols) {
    for (const ns of newSymbols) {
        const cell = document.getElementById(`cell-${ns.row}-${ns.col}`);
        if (cell) {
            cell.style.animation = 'popIn 0.3s ease-out';
        }
    }
}

// UI Helpers
function showWin(amount) {
    const winEl = document.getElementById('winAmount');
    winEl.textContent = amount.toFixed(2);
    winEl.classList.add('win-animation');
    setTimeout(() => winEl.classList.remove('win-animation'), 1000);
}

function updateBalance() {
    const el = document.getElementById('balance');
    if (el) el.textContent = '$' + currentBalance.toFixed(2);
}

function updateBetDisplay() {
    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    const el = document.getElementById('currentBet');
    if (el) el.textContent = '$' + bet;
    
    // Update quick bet button active states
    document.querySelectorAll('.quick-bet').forEach(btn => {
        btn.classList.remove('active');
        const btnAmount = parseInt(btn.textContent.replace('$', ''));
        if (btnAmount === bet) {
            btn.classList.add('active');
        }
    });
}

function changeBet(delta) {
    CURRENT_BET_INDEX += delta;
    if (CURRENT_BET_INDEX < 0) CURRENT_BET_INDEX = 0;
    if (CURRENT_BET_INDEX >= BET_SIZE_LIST.length) CURRENT_BET_INDEX = BET_SIZE_LIST.length - 1;
    
    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    updateBetDisplay();
    sendSetBet(bet);
}

function setBet(amount) {
    const index = BET_SIZE_LIST.indexOf(amount);
    if (index >= 0) {
        CURRENT_BET_INDEX = index;
        updateBetDisplay();
        sendSetBet(amount);
    }
}

function spin() {
    if (isSpinning) return;
    
    isSpinning = true;
    document.getElementById('spinButton').disabled = true;
    
    // Clear previous animations
    document.querySelectorAll('.reel-cell').forEach(cell => {
        cell.classList.remove('highlight', 'removing', 'rainbow');
        cell.style.transform = '';
        cell.style.animation = '';
    });
    
    // Clear history displays
    document.getElementById('cascadeHistory').classList.add('hidden');
    document.getElementById('rainbowHistory').classList.add('hidden');
    document.getElementById('cascadeStepsList').innerHTML = '';
    document.getElementById('rainbowRoundsList').innerHTML = '';
    
    // Send spin (SetBet triggers spin)
    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    sendSetBet(bet);
}

function showLoading(text = 'Loading...') {
    document.getElementById('loading').textContent = text;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('gameContent').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('gameContent').classList.remove('hidden');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
