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

// Game state
let socket = null;
let isSpinning = false;
let pingInterval = null;
let currentBalance = 0;

// Grid state
let currentGrid = [];

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

// Create 6x5 grid with buffer rows above for animation
function initGrid() {
    const grid = document.getElementById('reelGrid');
    grid.innerHTML = '';

    // Create buffer rows above (negative rows) for new symbols to start from
    const bufferRows = 5; // Rows -5, -4, -3, -2, -1
    for (let r = -bufferRows; r < 0; r++) {
        for (let c = 0; c < CONFIG.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'reel-cell lebandit-cell buffer-cell';
            cell.id = `cell-${r}-${c}`;
            cell.dataset.row = r;
            cell.dataset.col = c;
            grid.appendChild(cell);
        }
    }

    // Create visible grid rows (0-4)
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

    // Use payouts from server (CLUSTER_PAYOUTS) or fallback to CONFIG
    const hasServerData = Object.keys(CLUSTER_PAYOUTS).length > 0;
    const clusterPayouts = hasServerData ? CLUSTER_PAYOUTS : CONFIG.clusterPayouts;
    const symbols = Object.keys(SYMBOLS).length > 0 ? SYMBOLS : CONFIG.symbols;
    const names = CONFIG.symbolNames;

    console.log('[renderPaytable] Using server data:', hasServerData);
    console.log('[renderPaytable] CLUSTER_PAYOUTS keys:', Object.keys(CLUSTER_PAYOUTS));
    console.log('[renderPaytable] First payout:', Object.values(clusterPayouts)[0]?.payouts);

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
        // Skip Wild (id='1') - it has no direct payout, only substitutes
        if (id === '1') return;

        // Skip symbols with no payouts (like Scatter) - check if all payouts are 0
        const hasPayout = data.payouts?.some((p, idx) => idx >= 5 && p > 0);
        if (!hasPayout) return;

        const display = symbols[id] || '?';
        const name = names[id] || data.name || 'Unknown';
        const payouts = data.payouts;
        html += `
            <div class="cluster-paytable-row">
                <span class="paytable-icon">${display}</span>
                <span class="paytable-name">${name}</span>
                <span class="paytable-payout">${formatPayout(payouts[5])}</span>
                <span class="paytable-payout">${formatPayout(payouts[6])}</span>
                <span class="paytable-payout">${formatPayout(payouts[7])}</span>
                <span class="paytable-payout">${formatPayout(payouts[8])}</span>
                <span class="paytable-payout">${formatPayout(payouts[9])}</span>
                <span class="paytable-payout">${formatPayout(payouts[11])}</span>
                <span class="paytable-payout high">${formatPayout(payouts[13])}</span>
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

    if (!msg.vals) return;
    console.log()
    const type = msg.vals.type;
    const data = msg.vals.data;
    console.log(`type = ${type}`)
    console.log(`data = ${JSON.stringify(data)}`)

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
        case 100071: // Sync room info AND SetBet response (same as TheLuxe)
            if (subData?.opCode === 'SyncRoomInfo') {
                handleSyncRoom(subData);
            } else if (subData?.opCode === 'SetBet') {
                handleSpinResult(subData);
            }
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
    send('100000', [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: { bet: bet }  // Send bet value directly, not index
        }]
    }]);
}

// Response Handlers
function handleJoinRoom(data) {
    console.log('Joined room:', data);
    if (data.betInfo?.[0]) {
        const info = data.betInfo[0];

        // Store server config
        if (info.betSizeList) {
            BET_SIZE_LIST = info.betSizeList;
            console.log('[JoinRoom] Bet sizes:', BET_SIZE_LIST);
        }
        if (info.clusterPayouts) {
            CLUSTER_PAYOUTS = info.clusterPayouts;
            console.log('[JoinRoom] Received clusterPayouts:', CLUSTER_PAYOUTS);
            // Check first symbol's payouts
            const firstKey = Object.keys(CLUSTER_PAYOUTS)[0];
            console.log('[JoinRoom] First symbol payouts:', firstKey, CLUSTER_PAYOUTS[firstKey]?.payouts);
        }
        if (info.symbols) {
            // Convert array to id -> display mapping
            SYMBOLS = {};
            info.symbols.forEach(s => {
                SYMBOLS[s.id] = s.display;
            });
            console.log('[JoinRoom] Symbols received:', info.symbols.map(s => s.display).join(', '));
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

    console.log('[handleSpinResult] Raw data:', data);

    // Match TheLuxe structure - betInfo contains the result
    const betInfo = data.betInfo?.[0];
    console.log('[handleSpinResult] betInfo:', betInfo);

    if (!betInfo) {
        console.error('No betInfo in SetBet response', data);
        return;
    }

    console.log('[handleSpinResult] bet:', betInfo.bet, 'finalBalance:', betInfo.finalBalance);

    const result = betInfo.gameResult;
    if (!result) {
        console.error('No gameResult in betInfo', betInfo);
        return;
    }

    // Pretty print grid for debugging (show symbol IDs)
    console.log('%c[Grid Result]', 'color: #4ecdc4; font-weight: bold;');
    if (result.grid) {
        console.log('Final Grid:');
        result.grid.forEach((row, i) => {
            console.log(`  Row ${i}: ${row.join(' | ')}`);
        });
    }

    // Pretty print cascade steps if present
    if (result.cascadeSteps && result.cascadeSteps.length > 0) {
        console.log(`%c[Cascade: ${result.cascadeSteps.length} steps]`, 'color: #ffd700; font-weight: bold;');
        result.cascadeSteps.forEach((step, idx) => {
            console.log(`%c  Step ${idx + 1}:`, 'color: #4ecdc4; font-weight: bold;', `${step.winningClusters.length} clusters, win: ${step.totalWin}`);

            // Print grid BEFORE (initial state for this step)
            if (step.gridBefore) {
                console.log('  Before:');
                step.gridBefore.forEach((row, i) => {
                    const rowStr = row.join(' | ');
                    console.log(`    Row ${i}: ${rowStr}`);
                });
            }

            // Print grid AFTER REMOVAL (winning symbols removed)
            if (step.gridAfterRemoval) {
                console.log('  After Removal:');
                step.gridAfterRemoval.forEach((row, i) => {
                    const rowStr = row.map(s => s === '' ? '·' : s).join(' | ');
                    console.log(`    Row ${i}: ${rowStr}`);
                });
            }

            // Print grid AFTER DROP & FILL (combined stage)
            if (step.gridAfterDropAndFill) {
                console.log('%c  ┌─ AFTER DROP & FILL ──┐', 'color: #95e1d3;');
                step.gridAfterDropAndFill.forEach((row, i) => {
                    const rowStr = row.map(s => s === '' ? '·' : s).join(' | ');
                    console.log(`    Row ${i}: ${rowStr}`);
                });
            } else if (step.gridAfterFill) {
                // Fallback for backwards compatibility
                console.log('%c  ┌─ AFTER DROP & FILL ──┐', 'color: #95e1d3;');
                step.gridAfterFill.forEach((row, i) => {
                    const rowStr = row.map(s => s === '' ? '·' : s).join(' | ');
                    console.log(`    Row ${i}: ${rowStr}`);
                });
            }

            // Print winning clusters
            if (step.winningClusters.length > 0) {
                console.log('  Wins:');
                step.winningClusters.forEach(c => {
                    console.log(`    ${c.symbol} cluster x${c.count} = $${c.payout}`);
                });
            }
            console.log(''); // Empty line between steps
        });
    }

    // Log rainbow result if present
    if (result.rainbowResult?.hasRainbow) {
        console.log('%c[Rainbow Feature!]', 'color: #ff6b6b; font-weight: bold;',
            `Coin win: ${result.rainbowResult.coinWin}, Rounds: ${result.rainbowResult.rounds?.length}`);
    }

    // Update balance from server
    currentBalance = betInfo.finalBalance || 0;
    updateBalance();

    // Log win
    const winAmount = result.totalWinAmount || 0;
    if (winAmount > 0) {
        console.log('[SpinResult] Win: +$' + winAmount.toFixed(2));
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
}

// Grid Rendering
function renderGrid(grid) {
    if (!grid || !grid.length) return;

    currentGrid = grid;

    for (let r = 0; r < CONFIG.rows; r++) {
        for (let c = 0; c < CONFIG.cols; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (cell){
                if ( grid[r] && grid[r][c]) {
                    const symbolId = grid[r][c];
                    cell.textContent = CONFIG.symbols[symbolId] || symbolId;
                    cell.dataset.symbol = symbolId;

                    // Clear animation/transform styles from previous cascade
                    cell.style.transform = '';
                    cell.style.animation = '';
                    cell.classList.remove('wild', 'scatter', 'highlight', 'removing');

                    if (symbolId === '1') cell.classList.add('wild');
                    if (symbolId === '2') cell.classList.add('scatter');
                }
            } else {
                cell.style.transform = 'scale(0)';
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

        // Step 1: Show grid before and highlight wins
        renderGrid(step.gridBefore);
        highlightWinningSymbols(step.winningClusters);
        await sleep(800);

        // Step 2: Animate removal
        highlightRemovedSymbols(step.removedSymbols);
        await sleep(600);

        // Step 3: Show "after removal" grid (with empty spaces)
        renderGrid(step.gridAfterRemoval);
        await sleep(400);

        // Step 4: Animate drops and new symbols
        // animateCombined will visually move symbols from their "from" positions
        animateCombined(step.movements);
        await sleep(700);

        // Step 5: Render final grid to ensure everything is in sync
        renderGrid(step.gridAfterDropAndFill || step.gridAfterFill);
        await sleep(400);

        // Add to history
        const stepDiv = document.createElement('div');
        stepDiv.className = 'cascade-step-item';
        stepDiv.innerHTML = `
            <span class="step-number">${step.step}</span>
            <span class="step-win">+$${step.totalWin.toFixed(2)}</span>
        `;
        cascadeStepsList.appendChild(stepDiv);

        await sleep(300);
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

// Combined animation for drops and new symbols (happens simultaneously)
// Lower symbols (larger row numbers) drop first
function animateCombined(movements) {
    const animationDuration = 400; // ms
    const staggerDelay = 50; // ms between rows

    // Sort movements by destination row (descending - lower rows first)
    const sortedMovements = [...movements].sort((a, b) => b.to.row - a.to.row);

    // Animate all movements (existing and new symbols)
    sortedMovements.forEach((move) => {
        // Check if this is a new symbol (falling in from above / buffer row)
        if (move.isNew || move.from.row < 0) {
            const bufferCell = document.getElementById(`cell-${move.from.row}-${move.from.col}`);
            const targetCell = document.getElementById(`cell-${move.to.row}-${move.to.col}`);

            if (!targetCell) return;

            // Calculate delay (lower rows animate first)
            const delay = (4 - move.to.row) * staggerDelay;

            // Set up the symbol in the buffer cell
            if (bufferCell) {
                const icon = CONFIG.symbols[move.symbol] || '❓';
                bufferCell.textContent = icon;
                bufferCell.dataset.symbol = move.symbol;
                bufferCell.classList.remove('wild', 'scatter', 'highlight', 'removing');
                if (move.symbol === '1') bufferCell.classList.add('wild');
                if (move.symbol === '2') bufferCell.classList.add('scatter');

                // Also set up target cell (will be revealed as symbol falls)
                targetCell.textContent = icon;
                targetCell.dataset.symbol = move.symbol;
                targetCell.className = bufferCell.className;
                targetCell.classList.remove('buffer-cell');

                // Calculate the distance to fall
                const rowDiff = move.to.row - move.from.row;
                const cellHeight = 76; // 70px + 6px gap
                const fallDistance = rowDiff * cellHeight;

                // Animate from buffer position to target
                setTimeout(() => {
                    bufferCell.style.transition = `transform ${animationDuration}ms ease-out`;
                    bufferCell.style.transform = `translateY(${fallDistance}px)`;

                    setTimeout(() => {
                        // Reset buffer cell
                        bufferCell.style.transition = '';
                        bufferCell.style.transform = '';
                        bufferCell.textContent = '';
                        bufferCell.className = 'reel-cell lebandit-cell buffer-cell';
                    }, animationDuration);
                }, delay);
            } else {
                // Fallback: animate target cell from above
                const icon = CONFIG.symbols[move.symbol] || '❓';
                targetCell.textContent = icon;
                targetCell.dataset.symbol = move.symbol;
                targetCell.classList.remove('wild', 'scatter', 'highlight', 'removing');
                if (move.symbol === '1') targetCell.classList.add('wild');
                if (move.symbol === '2') targetCell.classList.add('scatter');

                const cellHeight = 76;
                const fromRow = move.from.row;
                const fallDistance = Math.abs(fromRow - move.to.row) * cellHeight;

                targetCell.style.transform = `translateY(-${fallDistance}px)`;
                targetCell.style.opacity = '0';
                targetCell.offsetHeight; // Force reflow

                setTimeout(() => {
                    targetCell.style.transition = `transform ${animationDuration}ms ease-out, opacity ${animationDuration * 0.7}ms ease-out`;
                    targetCell.style.transform = 'translateY(0)';
                    targetCell.style.opacity = '1';

                    setTimeout(() => {
                        targetCell.style.transition = '';
                    }, animationDuration);
                }, delay);
            }
        } else {
            // Existing symbol dropping from one position to another
            const fromCell = document.getElementById(`cell-${move.from.row}-${move.from.col}`);
            const toCell = document.getElementById(`cell-${move.to.row}-${move.to.col}`);

            if (!fromCell || !toCell) return;

            // Calculate delay (lower rows animate first)
            const delay = (4 - move.to.row) * staggerDelay;

            // Calculate distance from "from" position to "to" position
            const rowDiff = move.to.row - move.from.row;
            const cellHeight = 76; // 70px + 6px gap
            const translateY = rowDiff * cellHeight;

            // Animate from current position to new position
            fromCell.style.zIndex = '10';

            setTimeout(() => {
                fromCell.style.transition = `transform ${animationDuration}ms ease-out`;
                fromCell.style.transform = `translateY(${translateY}px)`;

                // After animation, copy content and reset
                setTimeout(() => {
                    toCell.innerHTML = fromCell.innerHTML;
                    toCell.className = fromCell.className;

                    fromCell.style.transition = '';
                    fromCell.style.transform = '';
                    fromCell.style.zIndex = '';
                    fromCell.innerHTML = '';
                    fromCell.className = 'reel-cell lebandit-cell';
                }, animationDuration);
            }, delay);
        }
    });
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
