/**
 * TheLuxe Slot Game - Main Application
 */

// Global client instance
let wsClient = null;
let isSpinning = false;

// Symbol display names
const SYMBOL_NAMES = {
    'WILD': 'Wild',
    'SCATTER': 'Scatter',
    'SYM_1': 'Crown',
    'SYM_2': 'Ring',
    'SYM_3': 'Trophy',
    'SYM_4': 'Cash',
    'SYM_5': 'Dice',
    'SYM_6': 'Dart',
    'SYM_7': 'Slot',
    'SYM_8': 'Coin',
    'SYM_9': 'Gem'
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeGrid();
    bindEvents();
    updateTotalBet();
});

// Initialize the 4x5 grid
function initializeGrid() {
    const reels = document.getElementById('reels');
    reels.innerHTML = '';
    
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${row}-${col}`;
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.textContent = '❓';
            reels.appendChild(cell);
        }
    }
}

// Bind UI events
function bindEvents() {
    // Connection
    document.getElementById('connect-btn').addEventListener('click', handleConnect);
    
    // Game controls
    document.getElementById('spin-btn').addEventListener('click', handleSpin);
    document.getElementById('bet-select').addEventListener('change', updateTotalBet);
    document.getElementById('lines-select').addEventListener('change', updateTotalBet);
    
    // Logs
    document.getElementById('clear-logs').addEventListener('click', clearLogs);
}

// Update total bet display
function updateTotalBet() {
    const bet = parseInt(document.getElementById('bet-select').value);
    const lines = parseInt(document.getElementById('lines-select').value);
    document.getElementById('total-bet').textContent = bet * lines;
}

// Handle connect button
async function handleConnect() {
    const btn = document.getElementById('connect-btn');
    const status = document.getElementById('connection-status');
    
    btn.disabled = true;
    status.textContent = 'Connecting...';
    status.className = 'status connecting';
    
    try {
        let token = document.getElementById('token').value;
        const lang = document.getElementById('lang').value;
        
        // If no token provided, fetch one
        if (!token) {
            log('Fetching token...', 'info');
            token = await fetchToken();
        }
        
        // Create and connect WebSocket client
        wsClient = new TheLuxeWSClient();
        
        // Set up callbacks
        wsClient.on('Connect', () => {
            status.textContent = 'Connected';
            status.className = 'status connected';
            btn.textContent = 'Disconnect';
            btn.disabled = false;
            btn.onclick = handleDisconnect;
            
            // Show game panel
            document.getElementById('game-panel').classList.remove('hidden');
            
            // Send login
            wsClient.sendLogin();
        });
        
        wsClient.on('Disconnect', () => {
            status.textContent = 'Disconnected';
            status.className = 'status disconnected';
            btn.textContent = 'Connect';
            btn.disabled = false;
            btn.onclick = handleConnect;
            
            // Hide game panel
            document.getElementById('game-panel').classList.add('hidden');
        });
        
        wsClient.on('Error', (error) => {
            log('Connection error: ' + JSON.stringify(error), 'error');
            status.textContent = 'Error';
            status.className = 'status disconnected';
            btn.disabled = false;
        });
        
        wsClient.on('Message', (direction, msg) => {
            const type = direction === 'send' ? 'SEND' : 'RECV';
            const className = direction === 'send' ? 'send' : 'receive';
            const shortMsg = JSON.stringify(msg).substring(0, 200);
            log(`[${type}] ${shortMsg}...`, className);
        });
        
        wsClient.on('Login', (data) => {
            log(`Logged in - Session: ${data.sessionId}`, 'info');
        });
        
        wsClient.on('Lobby', (data) => {
            updateBalance(data.balance);
            log(`Lobby - Game: ${data.gameId}, Balance: ${data.balance}`, 'info');
        });
        
        wsClient.on('JoinRoom', (data) => {
            document.getElementById('game-name').textContent = data.gameType;
            document.getElementById('room-id').textContent = data.roomId;
            updateBalance(data.balance);
            
            // Update bet info
            if (data.betInfo && data.betInfo[0]) {
                const betInfo = data.betInfo[0];
                document.getElementById('min-bet').textContent = betInfo.minBet;
                document.getElementById('max-bet').textContent = betInfo.maxBet;
            }
            
            log(`Joined room ${data.roomId}`, 'info');
        });
        
        wsClient.on('SyncRoom', (data) => {
            if (data.roomInfo) {
                document.getElementById('min-bet').textContent = data.roomInfo.minBet;
                document.getElementById('max-bet').textContent = data.roomInfo.maxBet;
            }
        });
        
        wsClient.on('SetBet', (data) => {
            handleSpinResult(data);
        });
        
        await wsClient.connect(token, lang);
        
    } catch (error) {
        log('Failed to connect: ' + error.message, 'error');
        status.textContent = 'Failed';
        status.className = 'status disconnected';
        btn.disabled = false;
    }
}

// Handle disconnect
function handleDisconnect() {
    if (wsClient) {
        wsClient.disconnect();
        wsClient = null;
    }
}

// Fetch token from API
async function fetchToken() {
    try {
        // Step 1: Get SID
        const sidResponse = await fetch(`${CONFIG.sidUrl}?authToken=${CONFIG.authToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: CONFIG.testUuid, userId: CONFIG.testUserId })
        });
        
        if (!sidResponse.ok) throw new Error('SID request failed');
        const sidData = await sidResponse.json();
        
        // Step 2: Call launch API
        const launchResponse = await fetch(CONFIG.launchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                operatorId: CONFIG.operatorId,
                gameTypeId: CONFIG.gameTypeId,
                player: {
                    userId: CONFIG.testUserId,
                    currency: CONFIG.currency,
                    language: 'en',
                    sid: sidData.sid,
                    name: 'testUser'
                },
                apiSecret: CONFIG.apiSecret
            })
        });
        
        if (!launchResponse.ok) throw new Error('Launch API failed');
        const launchData = await launchResponse.json();
        
        // Extract token from redirect URL
        const redirectUrl = launchData.vals?.data?.redirectUrl;
        if (!redirectUrl) throw new Error('No redirect URL in response');
        
        const url = new URL(redirectUrl);
        const token = url.searchParams.get('token');
        
        if (!token) throw new Error('No token in redirect URL');
        
        log('Token fetched successfully', 'info');
        return token;
        
    } catch (error) {
        log('Failed to fetch token: ' + error.message, 'error');
        throw error;
    }
}

// Handle spin button
async function handleSpin() {
    if (isSpinning || !wsClient || !wsClient.isConnected) return;
    
    const bet = parseInt(document.getElementById('bet-select').value);
    const lines = parseInt(document.getElementById('lines-select').value);
    
    isSpinning = true;
    const btn = document.getElementById('spin-btn');
    btn.disabled = true;
    btn.textContent = 'Spinning...';
    
    // Clear previous wins
    clearWinners();
    hideWinDisplay();
    
    // Start spin animation
    startSpinAnimation();
    
    // Send spin request
    wsClient.sendSetBet(bet, lines);
}

// Start cell spin animation
function startSpinAnimation() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.add('spinning'));
}

// Stop cell spin animation
function stopSpinAnimation() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.remove('spinning'));
}

// Handle spin result
function handleSpinResult(data) {
    stopSpinAnimation();
    
    if (!data.betInfo || !data.betInfo[0]) {
        log('Invalid spin result', 'error');
        isSpinning = false;
        resetSpinButton();
        return;
    }
    
    const betInfo = data.betInfo[0];
    const gameResult = betInfo.gameResult;
    
    // Update balance
    updateBalance(betInfo.finalBalance);
    
    // Update grid with symbols
    if (gameResult.grid) {
        updateGrid(gameResult.grid);
    }
    
    // Show win if any
    const totalWin = gameResult.totalWinAmount || 0;
    if (totalWin > 0 && gameResult.lineWins && gameResult.lineWins.length > 0) {
        highlightWinners(gameResult.lineWins);
        showWinDisplay(totalWin, gameResult.lineWins);
    }
    
    // Show last spin details
    showLastSpinDetails(gameResult, betInfo);
    
    log(`Spin complete - Win: ${totalWin}, Balance: ${betInfo.finalBalance}`, 'info');
    
    isSpinning = false;
    resetSpinButton();
}

// Update grid display
function updateGrid(grid) {
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            const cell = document.getElementById(`cell-${row}-${col}`);
            const symbol = grid[row][col];
            cell.textContent = CONFIG.symbols[symbol] || symbol;
            cell.className = `cell symbol-${symbol}`;
        }
    }
}

// Highlight winning cells
function highlightWinners(lineWins) {
    // Reset all payline indicators
    document.querySelectorAll('.payline').forEach(p => p.classList.remove('winner', 'active'));
    
    lineWins.forEach((lineWin, index) => {
        const lineIndex = lineWin.info[0]; // payline number
        const positions = lineWin.positions;
        
        // Highlight payline indicator
        const indicator = document.querySelector(`.payline[data-line="${lineIndex}"]`);
        if (indicator) indicator.classList.add('winner');
        
        // Highlight cells
        positions.forEach(pos => {
            const [row, col] = pos;
            const cell = document.getElementById(`cell-${row}-${col}`);
            if (cell) cell.classList.add('winner');
        });
    });
}

// Clear winner highlights
function clearWinners() {
    document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('winner'));
    document.querySelectorAll('.payline').forEach(p => p.classList.remove('winner'));
}

// Show win display popup
function showWinDisplay(amount, lineWins) {
    const display = document.getElementById('win-display');
    document.getElementById('win-amount').textContent = amount.toLocaleString();
    
    const linesText = lineWins.map(lw => `Line ${lw.info[0] + 1}: ${SYMBOL_NAMES[lw.info[1]] || lw.info[1]} x${lw.info[2]}`).join(', ');
    document.getElementById('win-lines').textContent = linesText;
    
    display.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
        hideWinDisplay();
    }, 3000);
}

// Hide win display
function hideWinDisplay() {
    document.getElementById('win-display').classList.add('hidden');
}

// Show last spin details
function showLastSpinDetails(gameResult, betInfo) {
    const container = document.getElementById('last-spin-info');
    const details = document.getElementById('spin-details');
    
    let html = `<div>Bet: ${betInfo.bet} × ${betInfo.line} lines = ${betInfo.bet * betInfo.line}</div>`;
    html += `<div>Win: ${gameResult.totalWinAmount || 0}</div>`;
    
    if (gameResult.lineWins && gameResult.lineWins.length > 0) {
        html += `<div style="margin-top: 8px;">Winning Lines:</div>`;
        gameResult.lineWins.forEach(lw => {
            const [line, symbol, count, win] = lw.info;
            html += `<div>• Line ${line + 1}: ${SYMBOL_NAMES[symbol] || symbol} ×${count} = ${win}</div>`;
        });
    }
    
    details.innerHTML = html;
    container.classList.remove('hidden');
}

// Update balance display
function updateBalance(balance) {
    document.getElementById('balance').textContent = balance.toLocaleString();
}

// Reset spin button
function resetSpinButton() {
    const btn = document.getElementById('spin-btn');
    btn.disabled = false;
    btn.textContent = '🎰 SPIN';
}

// Logging
function log(message, type = 'info') {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logs.insertBefore(entry, logs.firstChild);
    
    // Keep only last 100 entries
    while (logs.children.length > 100) {
        logs.removeChild(logs.lastChild);
    }
}

// Clear logs
function clearLogs() {
    document.getElementById('logs').innerHTML = '';
}
