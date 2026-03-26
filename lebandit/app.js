/**
 * LeBandit Slot Game - Direct WebSocket Client
 * 6x5 grid with cluster wins and cascading reels
 */

// Data from server (populated after SyncRoomInfo)
let SYMBOLS = {};
let CLUSTER_PAYOUTS_KEYS = []
let CLUSTER_PAYOUTS = {};
let CLUSTER_SIZE_LABELS = ['5', '6', '7', '8', '9-10', '11-12', '13+']; // Default labels
let GAME_CONFIG = {};
let BET_SIZE_LIST = [5, 10, 20, 50, 100];
let CURRENT_BET_INDEX = 2; // Default $20

// Game state
let socket = null;
let isSpinning = false;
let pingInterval = null;
let currentBalance = 0;
let rainbowModeEnabled = false; // Rainbow mode state

// Grid state
let currentGrid = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initGrid();
    renderPaytable();
    updateBetDisplay();
    updateBonusButton();
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

    const layout = CONFIG.gridLayout;

    // Create buffer rows above (negative rows) for new symbols to start from
    for (let r = -layout.ROWS_BUFFER; r < 0; r++) {
        for (let c = 0; c < layout.COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'reel-cell lebandit-cell buffer-cell';
            cell.id = `cell-${r}-${c}`;
            cell.dataset.row = r;
            cell.dataset.col = c;
            grid.appendChild(cell);
        }
    }

    // Create visible grid rows (0 to ROWS_VISIBLE-1)
    for (let r = 0; r < layout.ROWS_VISIBLE; r++) {
        for (let c = 0; c < layout.COLS; c++) {
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

    // Use payouts from server (CLUSTER_PAYOUTS) - must come from backend
    const hasServerData = Object.keys(CLUSTER_PAYOUTS).length > 0;
    if (!hasServerData) {
        console.log('[renderPaytable] Waiting for server data...');
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Loading paytable...</div>';
        return;
    }

    const clusterPayouts = CLUSTER_PAYOUTS;
    const symbols = Object.keys(SYMBOLS).length > 0 ? SYMBOLS : CONFIG.symbols;
    const names = CONFIG.symbolNames;

    console.log('[renderPaytable] Using server data:', hasServerData);
    console.log('[renderPaytable] CLUSTER_PAYOUTS keys:', Object.keys(CLUSTER_PAYOUTS));
    console.log('[renderPaytable] First payout:', Object.values(clusterPayouts)[0]?.payouts);

    let html = `
        <div class="cluster-paytable-header">
            <span>Icon</span>
            <span>Symbol</span>
            ${CLUSTER_SIZE_LABELS.map(label => `<span>${label}</span>`).join('')}
        </div>
    `;
    Object.entries(CLUSTER_PAYOUTS_KEYS).forEach(([idx, id]) => {
        const data = clusterPayouts[id];
        // Skip symbols with no payouts (like Scatter) - check if all payouts are 0
        const hasPayout = data.payouts?.some((p, idx) => p > 0);
        if (!hasPayout) return;

        const display = symbols[id] || '?';
        const name = names[id] || data.name || 'Unknown';
        const payouts = data.payouts;
        
        // Dynamically generate payout cells based on payout array size
        let payoutCells = '';
        for (let i = 0; i < payouts.length; i++) {
            const isHigh = i === payouts.length - 1; // Last column is highlighted
            const className = isHigh ? 'paytable-payout high' : 'paytable-payout';
            payoutCells += `<span class="${className}">${formatPayout(payouts[i])}</span>`;
        }
        
        html += `
            <div class="cluster-paytable-row">
                <span class="paytable-icon">${display}</span>
                <span class="paytable-name">${name}</span>
                ${payoutCells}
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
    //console.log(`type = ${type}`)
    //console.log(`data = ${JSON.stringify(data)}`)

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

function sendSetBet(bet, forceBonusType = null) {
    const message = {
        bet: bet,
        rainbowMode: rainbowModeEnabled
    };

    // Add forceBonusType if provided (for buying bonus)
    if (forceBonusType) {
        message.forceBonusType = forceBonusType;
    }

    send('100000', [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: message
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

        if (info.clusterPayoutsKeys){
            CLUSTER_PAYOUTS_KEYS = info.clusterPayoutsKeys;
            console.log('[JoinRoom] Received clusterPayoutsKeys:', CLUSTER_PAYOUTS_KEYS);

        }

        if (info.clusterPayouts) {
            CLUSTER_PAYOUTS = info.clusterPayouts;
            console.log('[JoinRoom] Received clusterPayouts:', CLUSTER_PAYOUTS);
            // Check first symbol's payouts
            const firstKey = Object.keys(CLUSTER_PAYOUTS)[0];
            console.log('[JoinRoom] First symbol payouts:', firstKey, CLUSTER_PAYOUTS[firstKey]?.payouts);
        }
        if (info.clusterSizeLabels) {
            CLUSTER_SIZE_LABELS = info.clusterSizeLabels;
            console.log('[JoinRoom] Received clusterSizeLabels:', CLUSTER_SIZE_LABELS);
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

// Helper to convert SymbolGrid to display Grid
function symbolGridToGrid(symbolGrid) {
    if (!symbolGrid || !symbolGrid.length) return [];
    return symbolGrid.map(row =>
        row.map(cell => cell?.symbol || '')
    );
}

async function handleSpinResult(data) {
    console.log('[handleSpinResult] Raw data:', data);

    // Step 1: Extract and validate result
    const { betInfo, result, isValid } = extractAndValidateResult(data);
    if (!isValid) return;

    console.log('[handleSpinResult] bet:', betInfo.bet, 'finalBalance:', betInfo.finalBalance);

    // Step 2: Log result details
    logGridResult(result);
    logCascadeSteps(result);
    logRainbowResult(result);

    // Step 3: Update balance
    updateBalanceFromResult(betInfo);

    // Step 4: Log win amount
    logWinAmount(result);

    // Step 5: Render cascade or simple grid
    await renderSpinAnimation(result);

    // Step 6: Render golden squares
    renderGoldenSquaresFromResult(result);

    // Step 7: Render rainbow feature if present
    await renderRainbowFromResult(result);

    // Step 8: Handle bonus game state
    await handleBonusGameState(result);

    // Step 9: Finalize spin (re-enable controls)
    finalizeSpin();
}

// ==========================================
// STEP 1: Extract and Validate Result
// ==========================================
function extractAndValidateResult(data) {
    const betInfo = data.betInfo?.[0];
    console.log('[handleSpinResult] betInfo:', betInfo);

    if (!betInfo) {
        console.error('No betInfo in SetBet response', data);
        isSpinning = false;
        document.getElementById('spinButton').disabled = false;
        return { isValid: false };
    }

    const result = betInfo.gameResult;
    if (!result) {
        console.error('No gameResult in betInfo', betInfo);
        isSpinning = false;
        document.getElementById('spinButton').disabled = false;
        return { isValid: false };
    }

    return { betInfo, result, isValid: true };
}

// ==========================================
// STEP 2: Logging Functions
// ==========================================
function logGridResult(result) {
    console.log('%c[Grid Result]', 'color: #4ecdc4; font-weight: bold;');
    if (result.grid) {
        console.log('Final Grid:');
        result.grid.forEach((row, i) => {
            const cells = row.map(s => {
                if (s === '' || s === null || s === undefined) return '    ·   ';
                const icon = CONFIG.symbols[s] || '❓';
                const id = String(s).padStart(3, ' ');
                return `${icon}(${id})`;
            });
            console.log(`  Row ${i}: ${cells.join('│')}`);
        });
    }
}

function logCascadeSteps(result) {
    if (!result.cascadeSteps || result.cascadeSteps.length === 0) return;

    if (!result.bonusGameState?.isActive && !result.bonusGameState?.accumulatedGoldenSquares) {
        clearGoldenSquares();
    }

    console.log(`%c[Cascade: ${result.cascadeSteps.length} steps]`, 'color: #ffd700; font-weight: bold;');
    result.cascadeSteps.forEach((step, idx) => {
        logSingleCascadeStep(step, idx);
    });

    logGoldenSquaresSummary(result.goldenSquares);
}

function logSingleCascadeStep(step, idx) {
    console.log(`%c  Step ${idx + 1}:`, 'color: #4ecdc4; font-weight: bold;', `${step.winningClusters.length} clusters, win: ${step.totalWin}`);

    const formatRow = (symbolRow, rowIdx) => {
        const cells = symbolRow.map(cell => {
            const s = cell?.symbol || '';
            if (s === '') return '    ·   ';
            const icon = CONFIG.symbols[s] || '❓';
            const id = String(s).padStart(3, ' ');
            return `${id}${icon}`;
        });
        return `    Row ${rowIdx}: ${cells.join('│')}`;
    };

    const printSeparator = () => {
        const sep = '───────'.repeat(6).slice(0, -1);
        console.log(`           ${sep}`);
    };

    if (step.symbolGridBefore) {
        console.log('%c  ┌─ BEFORE ─────────────┐', 'color: #888;');
        step.symbolGridBefore.forEach((row, i) => {
            console.log('%c' + formatRow(row, i), 'color: #ccc;');
        });
        printSeparator();
    }

    if (step.symbolGridAfterRemoval) {
        console.log('%c  ┌─ AFTER REMOVAL ──────┐', 'color: #ff6b6b;');
        step.symbolGridAfterRemoval.forEach((row, i) => {
            console.log('%c' + formatRow(row, i), 'color: #ff6b6b;');
        });
        printSeparator();
    }

    if (step.symbolGridAfterDropAndFill) {
        console.log('%c  ┌─ AFTER DROP & FILL ──┐', 'color: #95e1d3;');
        step.symbolGridAfterDropAndFill.forEach((row, i) => {
            console.log('%c' + formatRow(row, i), 'color: #95e1d3;');
        });
        printSeparator();
    }

    if (step.winningClusters.length > 0) {
        console.log('%c  💰 Wins:', 'color: #ffd700; font-weight: bold;');
        step.winningClusters.forEach(c => {
            const icon = CONFIG.symbols[c.symbol] || '❓';
            const positions = c.positions.map(p => `(${p.row},${p.col})`).join(' ');
            console.log(`     ${c.symbol}${icon} cluster x${c.count} = $${c.payout}  [${positions}]`);
        });
    }

    logStepGoldenSquares(step, idx);
    console.log('');
}

function logStepGoldenSquares(step, idx) {
    if (!step.goldenSquares || step.goldenSquares.length === 0) return;

    const stepSquares = step.goldenSquares.filter(sq => sq.stepCreated === idx + 1);
    if (stepSquares.length === 0) return;

    console.log('%c  ✨ Golden Squares:', 'color: #ffd700; font-weight: bold;');

    const gridLines = [];
    gridLines.push('    ┌───┬───┬───┬───┬───┬───┐');
    for (let r = 0; r < 5; r++) {
        let rowStr = `  ${r} │`;
        for (let c = 0; c < 6; c++) {
            const isGolden = step.goldenSquares.some(sq => sq.row === r && sq.col === c);
            const isNew = stepSquares.some(sq => sq.row === r && sq.col === c);
            if (isNew) {
                rowStr += ' ✨│';
            } else if (isGolden) {
                rowStr += ' ✓ │';
            } else {
                rowStr += '   │';
            }
        }
        gridLines.push(rowStr);
        if (r < 4) {
            gridLines.push('    ├───┼───┼───┼───┼───┼───┤');
        }
    }
    gridLines.push('    └───┴───┴───┴───┴───┴───┘');
    gridLines.push('      0   1   2   3   4   5  ');

    gridLines.forEach(line => console.log('%c' + line, 'color: #ffd700;'));
    console.log(`     New this step: ${stepSquares.length}, Total: ${step.goldenSquares.length}`);
}

function logGoldenSquaresSummary(goldenSquares) {
    if (!goldenSquares || goldenSquares.length === 0) return;

    console.log('%c[Golden Squares Summary]', 'color: #ffd700; font-weight: bold;');
    console.log(`  Total: ${goldenSquares.length} positions`);

    const gridLines = [];
    gridLines.push('  ┌───┬───┬───┬───┬───┬───┐');
    for (let r = 0; r < 5; r++) {
        let rowStr = `${r} │`;
        for (let c = 0; c < 6; c++) {
            const isGolden = goldenSquares.some(sq => sq.row === r && sq.col === c);
            rowStr += isGolden ? ' ✨│' : '   │';
        }
        gridLines.push(rowStr);
        if (r < 4) {
            gridLines.push('  ├───┼───┼───┼───┼───┼───┤');
        }
    }
    gridLines.push('  └───┴───┴───┴───┴───┴───┘');
    gridLines.push('    0   1   2   3   4   5  ');

    gridLines.forEach(line => console.log('%c' + line, 'color: #ffd700;'));
}

function logRainbowResult(result) {
    if (!result.rainbowResult?.hasRainbow) return;

    console.log('%c[Rainbow Feature!]', 'color: #ff6b6b; font-weight: bold;',
        `Coin win: ${result.rainbowResult.coinWin}, Rounds: ${result.rainbowResult.rounds?.length}`);
    console.log('[Rainbow] Position:', result.rainbowResult.rainbowPosition);
    console.log('[Rainbow] Previous symbol:', result.rainbowResult.previousSymbol);

    if (result.rainbowResult.rainbowPosition && result.grid) {
        const { row, col } = result.rainbowResult.rainbowPosition;
        console.log(`[Rainbow] Grid at (${row},${col}):`, result.grid[row]?.[col]);
    }
}

function logWinAmount(result) {
    const winAmount = result.totalWinAmount || 0;
    if (winAmount > 0) {
        console.log('[SpinResult] Win: +$' + winAmount.toFixed(2));
    }
}

// ==========================================
// STEP 3: Update Balance
// ==========================================
function updateBalanceFromResult(betInfo) {
    currentBalance = betInfo.finalBalance || 0;
    updateBalance();
}

// ==========================================
// STEP 4: Render Spin Animation
// ==========================================
async function renderSpinAnimation(result) {
    if (result.cascadeSteps && result.cascadeSteps.length > 0) {
        await renderCascade(result.cascadeSteps, result.totalWinAmount);
        console.log('[handleSpinResult] Rendering final grid after cascade');
        if (result.grid) {
            renderGrid(result.grid, true);
        }
    } else {
        renderGrid(result.grid);
        showWin(result.totalWinAmount);
    }
}

// ==========================================
// STEP 5: Render Golden Squares
// ==========================================
function renderGoldenSquaresFromResult(result) {
    if (result.goldenSquares && result.goldenSquares.length > 0) {
        console.log(`[handleSpinResult] Rendering ${result.goldenSquares.length} golden squares from result`);
        renderGoldenSquares(result.goldenSquares);
    } else {
        clearGoldenSquares();
    }
}

// ==========================================
// STEP 6: Render Rainbow Feature
// ==========================================
async function renderRainbowFromResult(result) {
    if (result.rainbowResult?.hasRainbow && result.rainbowResult.coinWin > 0) {
        await renderRainbowFeature(result.rainbowResult, result.goldenSquares);
    }
}

// ==========================================
// STEP 7: Handle Bonus Game State
// ==========================================
async function handleBonusGameState(result) {
    if (!result.bonusGameState) {
        if (bonusGameActive) {
            hideBonusProgress();
        }
        return;
    }

    const bonusState = result.bonusGameState;
    console.log(`[Bonus State] spinsLeft=${bonusState.spinsLeft}, totalSpins=${bonusState.totalSpins}, isActive=${bonusState.isActive}, bonusGameActive=${bonusGameActive}`);

    const isFirstEntry = bonusState.spinsLeft === bonusState.totalSpins && !bonusGameActive;
    const isNewBonus = bonusState.isActive && !bonusGameActive;
    console.log(`[Bonus State] isFirstEntry=${isFirstEntry}, isNewBonus=${isNewBonus}`);

    if ((isFirstEntry || isNewBonus) && bonusState.spinsLeft > 0) {
        console.log('[Bonus Trigger] First entry or new bonus detected! Showing trigger overlay...');
        const scatterPositions = findScatterPositions(result.grid);
        console.log(`[Bonus Trigger] Found ${scatterPositions.length} scatters in grid`);
        await renderBonusTrigger(bonusState, result.grid);
    }

    if (bonusState.isActive && bonusState.spinsLeft > 0) {
        bonusGameActive = true;
        showBonusProgress(bonusState);
    } else {
        hideBonusProgress();
    }
}

function findScatterPositions(grid) {
    const positions = [];
    if (!grid) return positions;

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === '2' || grid[r][c] === SYMBOLS.SCATTER) {
                positions.push({ row: r, col: c });
            }
        }
    }
    return positions;
}

// ==========================================
// STEP 8: Finalize Spin
// ==========================================
function finalizeSpin() {
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
    updateBonusButton();
}

// Grid Rendering
function renderGrid(grid, instant = false) {

            // Print golden squares created in this step (as grid layout)
            if (step.goldenSquares && step.goldenSquares.length > 0) {
                const stepSquares = step.goldenSquares.filter(sq => sq.stepCreated === idx + 1);
                if (stepSquares.length > 0) {
                    console.log('%c  ✨ Golden Squares:', 'color: #ffd700; font-weight: bold;');

                    // Create grid layout for golden squares
                    const gridLines = [];
                    gridLines.push('    ┌───┬───┬───┬───┬───┬───┐');
                    for (let r = 0; r < 5; r++) {
                        let rowStr = `  ${r} │`;
                        for (let c = 0; c < 6; c++) {
                            const isGolden = step.goldenSquares.some(sq => sq.row === r && sq.col === c);
                            const isNew = stepSquares.some(sq => sq.row === r && sq.col === c);
                            if (isNew) {
                                rowStr += ' ✨│';  // New golden square this step
                            } else if (isGolden) {
                                rowStr += ' ✓ │';  // Existing golden square
                            } else {
                                rowStr += '   │';
                            }
                        }
                        gridLines.push(rowStr);
                        if (r < 4) {
                            gridLines.push('    ├───┼───┼───┼───┼───┼───┤');
                        }
                    }
                    gridLines.push('    └───┴───┴───┴───┴───┴───┘');
                    gridLines.push('      0   1   2   3   4   5  ');

                    gridLines.forEach(line => console.log('%c' + line, 'color: #ffd700;'));
                    console.log(`     New this step: ${stepSquares.length}, Total: ${step.goldenSquares.length}`);
                }
            }

            console.log(''); // Empty line between steps
        });
        
        // Print summary of all golden squares from the cascade (as grid layout)
        if (result.goldenSquares && result.goldenSquares.length > 0) {
            console.log('%c[Golden Squares Summary]', 'color: #ffd700; font-weight: bold;');
            console.log(`  Total: ${result.goldenSquares.length} positions`);

            // Create grid layout for all golden squares
            const gridLines = [];
            gridLines.push('  ┌───┬───┬───┬───┬───┬───┐');
            for (let r = 0; r < 5; r++) {
                let rowStr = `${r} │`;
                for (let c = 0; c < 6; c++) {
                    const isGolden = result.goldenSquares.some(sq => sq.row === r && sq.col === c);
                    if (isGolden) {
                        rowStr += ' ✨│';
                    } else {
                        rowStr += '   │';
                    }
                }
                gridLines.push(rowStr);
                if (r < 4) {
                    gridLines.push('  ├───┼───┼───┼───┼───┼───┤');
                }
            }
            gridLines.push('  └───┴───┴───┴───┴───┴───┘');
            gridLines.push('    0   1   2   3   4   5  ');

            gridLines.forEach(line => console.log('%c' + line, 'color: #ffd700;'));
        }
    }

    // Log rainbow result if present
    if (result.rainbowResult?.hasRainbow) {
        console.log('%c[Rainbow Feature!]', 'color: #ff6b6b; font-weight: bold;',
            `Coin win: ${result.rainbowResult.coinWin}, Rounds: ${result.rainbowResult.rounds?.length}`);
        console.log('[Rainbow] Position:', result.rainbowResult.rainbowPosition);
        console.log('[Rainbow] Previous symbol:', result.rainbowResult.previousSymbol);

        // Debug: Check what's in the final grid at rainbow position
        if (result.rainbowResult.rainbowPosition && result.grid) {
            const { row, col } = result.rainbowResult.rainbowPosition;
            console.log(`[Rainbow] Grid at (${row},${col}):`, result.grid[row]?.[col]);
        }
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
        await renderCascade(result.cascadeSteps, result.totalWinAmount);
        // After cascade animation, render the final grid (includes rainbow symbol if triggered)
        console.log('[handleSpinResult] Rendering final grid after cascade');
        if (result.grid) {
            renderGrid(result.grid, true);
        }
    } else {
        // Simple grid render
        renderGrid(result.grid);
        showWin(result.totalWinAmount);
    }

    // Render golden squares from result (important for bonus game with no win)
    if (result.goldenSquares && result.goldenSquares.length > 0) {
        console.log(`[handleSpinResult] Rendering ${result.goldenSquares.length} golden squares from result`);
        renderGoldenSquares(result.goldenSquares);
    } else {
        // Clear golden squares if none in result
        clearGoldenSquares();
    }
    // Render rainbow feature if present AND there's a win from it
    if (result.rainbowResult?.hasRainbow && result.rainbowResult.coinWin > 0) {
        await renderRainbowFeature(result.rainbowResult, result.goldenSquares);
    }

    // Handle bonus game state
    if (result.bonusGameState) {
        const bonusState = result.bonusGameState;
        
        console.log(`[Bonus State] spinsLeft=${bonusState.spinsLeft}, totalSpins=${bonusState.totalSpins}, isActive=${bonusState.isActive}, bonusGameActive=${bonusGameActive}`);
        
        // Check if this is the first entry (buy bonus trigger) or bonus just started
        const isFirstEntry = bonusState.spinsLeft === bonusState.totalSpins && !bonusGameActive;
        const isNewBonus = bonusState.isActive && !bonusGameActive;
        console.log(`[Bonus State] isFirstEntry=${isFirstEntry}, isNewBonus=${isNewBonus}`);

        if ((isFirstEntry || isNewBonus) && bonusState.spinsLeft > 0) {
            console.log('[Bonus Trigger] First entry or new bonus detected! Showing trigger overlay...');
            // First time entering bonus - show trigger overlay
            const scatterPositions = [];
            if (result.grid) {
                for (let r = 0; r < result.grid.length; r++) {
                    for (let c = 0; c < result.grid[r].length; c++) {
                        if (result.grid[r][c] === '2' || result.grid[r][c] === SYMBOLS.SCATTER) {
                            scatterPositions.push({row: r, col: c});
                        }
                    }
                }
            }
            console.log(`[Bonus Trigger] Found ${scatterPositions.length} scatters in grid`);
            await renderBonusTrigger(bonusState, result.grid);
        }
        
        if (bonusState.isActive && bonusState.spinsLeft > 0) {
            // Bonus is active - show/update progress
            bonusGameActive = true;
            showBonusProgress(bonusState);
        } else {
            // Bonus ended
            hideBonusProgress();
        }
    } else {
        // No bonus state - hide progress if showing
        if (bonusGameActive) {
            hideBonusProgress();
        }
    }

    // All animations complete - allow next spin
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
    updateBonusButton();
}

// Grid Rendering
function renderGrid(grid, instant = false) {
    if (!grid || !grid.length) return;

    currentGrid = grid;
    const layout = CONFIG.gridLayout;

    for (let r = -layout.ROWS_BUFFER; r < layout.ROWS_VISIBLE; r++) {
        for (let c = 0; c < layout.COLS; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            if (r < 0) {
                cell.style.transform = '';
                cell.style.animation = '';
                cell.style.transform = 'scale(0)';
            } else if (cell) {
                if (grid[r] && grid[r][c]) {
                    const symbolId = grid[r][c];
                    cell.textContent = CONFIG.symbols[symbolId] || symbolId;
                    cell.dataset.symbol = symbolId;

                    // Clear animation/transform styles from previous cascade
                    if (instant)
                        cell.style.transition = 'none'
                    else
                        cell.style.transition = '';
                    cell.style.transform = '';
                    cell.style.animation = '';
                    cell.classList.remove('highlight', 'removing');
                }
            } else {
                cell.style.transform = 'scale(0)';
            }
        }
    }
}

// Render Golden Squares in overlay (independent of grid cells)
function renderGoldenSquares(squares) {
    if (!squares || !squares.length) return;

    const overlay = document.getElementById('goldenSquaresOverlay');
    if (!overlay) return;

    const layout = CONFIG.gridLayout;

    // Clear existing golden squares first
    overlay.innerHTML = '';

    // Log rendering info
    console.log(`[Golden Squares] Rendering ${squares.length} squares at positions:`,
        squares.filter(sq => sq.row >= 0 && sq.row < layout.ROWS_VISIBLE).map(sq => `(${sq.row},${sq.col})`).join(', '));

    for (const sq of squares) {
        // Only render if row is in visible area
        if (sq.row < 0 || sq.row >= layout.ROWS_VISIBLE) continue;

        const squareEl = document.createElement('div');
        squareEl.className = 'golden-square-item';
        // Position in grid: row+1 (1-based), col+1 (1-based)
        squareEl.style.gridColumn = `${sq.col + 1}`;
        squareEl.style.gridRow = `${sq.row + 1}`;

        overlay.appendChild(squareEl);
    }
}

// Clear Golden Squares from overlay
function clearGoldenSquares() {
    const overlay = document.getElementById('goldenSquaresOverlay');
    if (overlay) overlay.innerHTML = '';
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

    // Track all golden squares accumulated across steps
    const accumulatedGoldenSquares = [];
    console.log
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        cascadeStepEl.textContent = step.step;

        // Step 1: Show grid before and highlight wins
        // Convert SymbolGrid to Grid for rendering
        renderGrid(symbolGridToGrid(step.symbolGridBefore));
        highlightWinningSymbols(step.winningClusters);
        await sleep(800);

        // Accumulate golden squares from this step
        if (step.goldenSquares && step.goldenSquares.length > 0) {
            for (const sq of step.goldenSquares) {
                // Avoid duplicates
                const exists = accumulatedGoldenSquares.some(
                    existing => existing.row === sq.row && existing.col === sq.col
                );
                if (!exists) {
                    accumulatedGoldenSquares.push(sq);
                }
            }
        }

        // Render all accumulated golden squares in overlay
        // This is independent of grid cells, so grid animations won't affect it
        if (accumulatedGoldenSquares.length > 0) {
            renderGoldenSquares(accumulatedGoldenSquares);
        }

        // Step 2: Animate removal
        highlightRemovedSymbols(step.removedSymbols);
        await sleep(600);

        // Step 3: Show "after removal" grid
        renderGrid(symbolGridToGrid(step.symbolGridAfterRemoval));

        await sleep(400);

        // Log dropping symbols
        if (step.movements && step.movements.length > 0) {
            console.log(`%c[Cascade Step ${step.step}] Dropping symbols:`, 'color: #4ecdc4; font-weight: bold;');
            const droppingSymbols = step.movements.filter(m => m.isNew);
            const existingSymbols = step.movements.filter(m => !m.isNew);

            if (existingSymbols.length > 0) {
                console.log('[Drop] Existing symbols dropping:');
                existingSymbols.forEach(m => {
                    const symbol = m.symbolInstance?.symbol || '?';
                    console.log(`[Drop] ${symbol} (${m.symbolInstance?.id}) from (${m.from.row},${m.from.col}) → (${m.to.row},${m.to.col})`);
                });
            }

            if (droppingSymbols.length > 0) {
                console.log('[Drop] New symbols falling in:');
                droppingSymbols.forEach(m => {
                    const symbol = m.symbolInstance?.symbol || '?';
                    // For new symbols, calculate from position (frontend determines it)
                    const fromRow = m.from?.row ?? calculateBufferRow(m.to.row, droppingSymbols.length);
                    console.log(`[Drop] ${symbol} (${m.symbolInstance?.id}) from buffer (${fromRow},${m.to.col}) → (${m.to.row},${m.to.col})`);
                });
            }
        }

        // Step 4: Animate drops and new symbols
        // Golden squares in overlay stay visible (independent of grid animation)
        await animateCombined(step.movements);

        // Step 5: Render final grid
        renderGrid(symbolGridToGrid(step.symbolGridAfterDropAndFill), true);

        // Golden squares persist in overlay - no need to re-render

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

// Add step detail to rainbow details panel
function addStepDetailToPanel(step, container, round) {
    if (!container) return;

    const stepDiv = document.createElement('div');
    stepDiv.className = `rainbow-step-detail ${step.stepType}`;

    let title = '';
    let info = '';

    switch (step.stepType) {
        case 'initial':
            title = '🎲 Initial Reveal';
            info = `${step.coins?.length || 0} coins, ${step.clovers?.length || 0} clovers, ${step.pots?.length || 0} pots`;
            break;
        case 'clover':
            const cloverMultiplier = step.activeClover?.multiplier || 1;
            title = `🍀 Clover x${cloverMultiplier}`;

            // Find the contribution for this clover
            const contribution = round?.cloverContributions?.find(c =>
                c.clover.row === step.activeClover?.row &&
                c.clover.col === step.activeClover?.col
            );
            if (contribution) {
                const coinCount = contribution.affectedCoins.length;
                const potCount = contribution.affectedPots.length;
                info = `Multiplied ${coinCount} coins${potCount > 0 ? ` and ${potCount} pots` : ''}`;

                // Show detailed multiplier changes
                if (contribution.affectedCoins.length > 0) {
                    info += `<div class="rainbow-coin-list">${contribution.affectedCoins.map(ac =>
                        `<span class="rainbow-coin-tag">(${ac.row},${ac.col}) ${ac.beforeMultiplier}x→${ac.afterMultiplier}x</span>`
                    ).join('')}</div>`;
                }

                if (contribution.affectedPots.length > 0) {
                    info += `<div class="rainbow-pot-list" style="margin-top:5px;">${contribution.affectedPots.map(ap =>
                        `<span class="rainbow-pot-tag" style="background:rgba(155,89,182,0.3);padding:2px 6px;border-radius:4px;">Pot (${ap.row},${ap.col}) ${ap.beforeMultiplier}x→${ap.afterMultiplier}x</span>`
                    ).join('')}</div>`;
                }
            } else {
                info = `Multiplied ${step.affectedCoins?.length || 0} coins`;
            }
            break;
        case 'pot':
            title = '🏺 Pot Collects';
            const pot = step.activePot;
            if (pot) {
                info = `Pot at (${pot.row},${pot.col}) collected `;
                if (step.collectedCoins && step.collectedCoins.length > 0) {
                    const totalValue = step.collectedCoins.reduce((sum, c) => sum + c.finalMultiplier, 0);
                    info += `${step.collectedCoins.length} coins = ${totalValue}x`;
                    
                    // Show collected pots if any
                    if (step.collectedPots && step.collectedPots.length > 0) {
                        const potsValue = step.collectedPots.reduce((sum, p) => sum + p.value, 0);
                        info += ` + ${step.collectedPots.length} pots = ${potsValue}x`;
                    }
                    
                    if (pot.cloverMultipliers && pot.cloverMultipliers.length > 0) {
                        info += ` ×${pot.cloverMultipliers.join('×')} = ${pot.finalMultiplier}x`;
                    }
                    info += `<div class="rainbow-coin-list">${step.collectedCoins.map(c =>
                        `<span class="rainbow-coin-tag">(${c.row},${c.col}) ${c.originalMultiplier}x→${c.finalMultiplier}x</span>`
                    ).join('')}</div>`;
                    
                    // Show collected pots tags
                    if (step.collectedPots && step.collectedPots.length > 0) {
                        info += `<div class="rainbow-pot-list" style="margin-top:5px;">${step.collectedPots.map(p =>
                            `<span class="rainbow-pot-tag" style="background:rgba(155,89,182,0.3);padding:2px 6px;border-radius:4px;">Pot (${p.row},${p.col}) ${p.value}x</span>`
                        ).join('')}</div>`;
                    }
                }
            }
            break;
    }

    stepDiv.innerHTML = `
        <div class="rainbow-step-title">${title}</div>
        <div class="rainbow-step-info">${info}</div>
    `;

    container.appendChild(stepDiv);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Rainbow Feature Rendering
async function renderRainbowFeature(rainbowResult, goldenSquares) {
    // Show rainbow overlay if rainbow result exists
    if (!rainbowResult || !rainbowResult.hasRainbow) {
        console.log('[Rainbow] No rainbow result, skipping rainbow feature');
        return;
    }

    const rainbowOverlay = document.getElementById('rainbowOverlay');
    const rainbowContent = document.getElementById('rainbowContent');
    const rainbowDetailsPanel = document.getElementById('rainbowDetailsPanel');
    const rainbowDetailsContent = document.getElementById('rainbowDetailsContent');
    const rainbowDetailsRound = document.getElementById('rainbowDetailsRound');

    rainbowOverlay.classList.remove('hidden');

    // Show details panel and clear previous content
    if (rainbowDetailsPanel) {
        rainbowDetailsPanel.classList.remove('hidden');
    }
    if (rainbowDetailsContent) {
        rainbowDetailsContent.innerHTML = '';
    }

    // Highlight rainbow position first (before any other rendering)
    const rainbowPos = rainbowResult.rainbowPosition;
    if (rainbowPos) {
        const { row, col } = rainbowPos;
        console.log(`[renderRainbowFeature] Setting rainbow at (${row},${col})`);
        const cell = document.getElementById(`cell-${row}-${col}`);
        if (cell) {
            cell.classList.add('rainbow');
        }
    }

    // Helper to pretty print rainbow grid
    function prettyPrintRainbowGrid(round, stepLabel, stepData = null) {
        console.log(`%c[Rainbow Grid - Round ${round.round}, ${stepLabel}]`, 'color: #ff6b6b; font-weight: bold;');

        const layout = CONFIG.gridLayout;
        const grid = [];
        for (let r = 0; r < layout.ROWS_VISIBLE; r++) {
            grid[r] = [];
            for (let c = 0; c < layout.COLS; c++) {
                grid[r][c] = '  ·  ';
            }
        }

        // Mark rainbow position
        if (rainbowPos) {
            grid[rainbowPos.row][rainbowPos.col] = '🌈R';
        }

        // Use step data if provided, otherwise use round data
        const coins = stepData?.coins || round.coins;
        const clovers = stepData?.clovers || round.clovers;
        const pots = stepData?.pots || round.pots;

        // Mark coins - show multiplier at this step
        for (const coin of coins) {
            const emoji = CONFIG.symbols[coin.symbolId] || '🪙';
            // Use the multiplier at this step (finalMultiplier represents current state)
            grid[coin.row][coin.col] = `${emoji}${coin.finalMultiplier}`;
        }

        // Mark clovers
        for (const clover of clovers) {
            const emoji = CONFIG.symbols[clover.symbolId] || '🍀';
            grid[clover.row][clover.col] = `${emoji}${clover.multiplier}`;
        }

        // Mark pots - show multiplier at this step
        for (const pot of pots) {
            const emoji = CONFIG.symbols[pot.symbolId] || '🏺';
            grid[pot.row][pot.col] = `${emoji}${pot.finalMultiplier}`;
        }

        // Print grid with box drawing
        console.log('  ┌─────┬─────┬─────┬─────┬─────┬─────┐');
        for (let r = 0; r < CONFIG.gridLayout.ROWS_VISIBLE; r++) {
            const rowStr = grid[r].map(cell => cell.padStart(5, ' ')).join('│');
            console.log(`${r} │${rowStr}│`);
            if (r < CONFIG.gridLayout.ROWS_VISIBLE - 1) {
                console.log('  ├─────┼─────┼─────┼─────┼─────┼─────┤');
            }
        }
        console.log('  └─────┴─────┴─────┴─────┴─────┴─────┘');
        console.log('     0     1     2     3     4     5   ');

        // Summary
        const totalCoinValue = coins.reduce((sum, c) => sum + c.finalMultiplier, 0);
        const totalPotValue = pots.reduce((sum, p) => sum + p.finalMultiplier, 0);
        console.log(`  Coins: ${coins.length}, Clovers: ${clovers.length}, Pots: ${pots.length}`);
        console.log(`  Total: ${totalCoinValue + totalPotValue}x`);
    }

    // Helper to animate coins flying to pot
    async function animateCoinsToPot(collectedCoins, potRow, potCol) {
        const potCell = document.getElementById(`cell-${potRow}-${potCol}`);
        if (!potCell) return;

        const potRect = potCell.getBoundingClientRect();

        // Create flying coin elements
        const flyingCoins = [];

        for (const coin of collectedCoins) {
            const coinCell = document.getElementById(`cell-${coin.row}-${coin.col}`);
            if (!coinCell) continue;

            const coinRect = coinCell.getBoundingClientRect();

            // Create flying coin element
            const flyer = document.createElement('div');
            flyer.textContent = CONFIG.symbols[coin.symbolId] || '🪙';
            flyer.style.cssText = `
                position: fixed;
                left: ${coinRect.left}px;
                top: ${coinRect.top}px;
                width: ${coinRect.width}px;
                height: ${coinRect.height}px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.8rem;
                z-index: 1000;
                pointer-events: none;
                transition: all 0.6s ease-in-out;
                text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
            `;
            document.body.appendChild(flyer);
            flyingCoins.push(flyer);

            // Start animation after a small delay
            await sleep(50);
        }

        // Animate all coins to pot position
        await sleep(100);
        flyingCoins.forEach(flyer => {
            flyer.style.left = `${potRect.left + potRect.width/2 - 20}px`;
            flyer.style.top = `${potRect.top + potRect.height/2 - 20}px`;
            flyer.style.transform = 'scale(0.5)';
            flyer.style.opacity = '0.7';
        });

        // Wait for animation to complete
        await sleep(600);

        // Remove flying coins
        flyingCoins.forEach(flyer => flyer.remove());

        // Flash the pot
        potCell.style.transform = 'scale(1.3)';
        potCell.style.boxShadow = '0 0 40px rgba(255, 215, 0, 0.9)';
        await sleep(200);
        potCell.style.transform = 'scale(1)';
        potCell.style.boxShadow = '';
    }

    // Render each round
    for (const round of rainbowResult.rounds) {
        console.log(`%c[Rainbow Round ${round.round}]`, 'color: #ffd700; font-weight: bold; font-size: 14px;');

        // Update details panel round number (show total rounds)
        if (rainbowDetailsRound) {
            rainbowDetailsRound.textContent = `Round ${round.round} of ${rainbowResult.rounds.length}`;
        }

        // Add round header to details panel (accumulate all rounds)
        if (rainbowDetailsContent) {
            const roundTotal = round.totalCoinValue + round.totalPotValue;
            const roundHeader = document.createElement('div');
            roundHeader.className = 'rainbow-round-header';
            roundHeader.innerHTML = `<strong>Round ${round.round}</strong> (${round.coins.length} coins, ${round.clovers.length} clovers, ${round.pots.length} pots) - <span style="color:#4ecdc4">Win: ${roundTotal}x</span>`;
            roundHeader.style.cssText = 'margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,215,0,0.3); color: #ffd700;';
            rainbowDetailsContent.appendChild(roundHeader);
        }

        // Check if we have steps data
        if (round.steps && round.steps.length > 0) {
            for (const step of round.steps) {
                console.log(`%c  Step ${step.stepNumber}: ${step.description}`, 'color: #4ecdc4;');

                // Add step detail to panel
                addStepDetailToPanel(step, rainbowDetailsContent, round);

                // Clean previous styles before each step (except initial)
                if (step.stepType !== 'initial') {
                    document.querySelectorAll('.reel-cell').forEach(cell => {
                        cell.classList.remove('rainbow-coin', 'clover-symbol', 'pot-symbol',
                                              'bronze', 'silver', 'gold',
                                              'active-clover', 'active-pot',
                                              'pot-collected');
                        // Also clear any inline styles from animations
                        cell.style.transform = '';
                        cell.style.boxShadow = '';
                        cell.style.filter = '';
                        cell.style.zIndex = '';
                        cell.style.background = '';
                    });
                }

                // Render based on step type
                if (step.stepType === 'initial') {
                    // Initial reveal - render all symbols
                    for (const coin of step.coins) {
                        const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                        if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                            const coinEmoji = CONFIG.symbols[coin.symbolId] || CONFIG.symbols[coin.type.toUpperCase()] || '🪙';
                            cell.textContent = coinEmoji;
                            cell.classList.add('rainbow-coin', coin.type);
                            // Store both original and final
                            cell.dataset.multiplier = coin.originalMultiplier;
                        }
                    }
                    for (const clover of step.clovers) {
                        const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                        if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols[clover.symbolId] || '🍀';
                            cell.classList.add('clover-symbol');
                            cell.dataset.multiplier = clover.multiplier;
                        }
                    }
                    for (const pot of step.pots) {
                        const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                        if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols[pot.symbolId] || '🏺';
                            cell.classList.add('pot-symbol');
                            // Only show multiplier if pot has collected coins (has value > 0)
                            if (pot.finalMultiplier > 0) {
                                cell.dataset.multiplier = pot.finalMultiplier;
                            } else {
                                cell.dataset.multiplier = '0';
                            }
                        }
                    }
                    await sleep(500);

                } else if (step.stepType === 'clover') {
                    // Re-render all symbols first with ORIGINAL values
                    for (const coin of step.coins) {
                        const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                        if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                            const coinEmoji = CONFIG.symbols[coin.symbolId] || CONFIG.symbols[coin.type.toUpperCase()] || '🪙';
                            cell.textContent = coinEmoji;
                            cell.classList.add('rainbow-coin', coin.type);
                        }
                    }
                    for (const clover of step.clovers) {
                        const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                        if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols[clover.symbolId] || '🍀';
                            cell.classList.add('clover-symbol');
                            cell.dataset.multiplier = clover.multiplier;
                        }
                    }
                    for (const pot of step.pots) {
                        const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                        if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols[pot.symbolId] || '🏺';
                            cell.classList.add('pot-symbol');
                            // Add collected class for visual distinction
                            if (pot.collected) {
                                cell.classList.add('pot-collected');
                            }
                        }
                    }

                    // Small delay to let symbols settle
                    await sleep(300);

                    // Highlight active clover
                    if (step.activeClover) {
                        const cloverCell = document.getElementById(`cell-${step.activeClover.row}-${step.activeClover.col}`);
                        if (cloverCell) cloverCell.classList.add('active-clover');
                    }

                    // Use cloverContributions to animate each clover one by one
                    if (round.cloverContributions && round.cloverContributions.length > 0) {
                        // Find the contribution for this step's activeClover
                        const contribution = round.cloverContributions.find(c =>
                            c.clover.row === step.activeClover?.row &&
                            c.clover.col === step.activeClover?.col
                        );

                        if (contribution && (contribution.affectedCoins.length > 0 || contribution.affectedPots.length > 0)) {
                            console.log(`[Clover] Processing contribution at (${contribution.clover.row},${contribution.clover.col})`);

                            // Animate each affected coin one by one with before/after values
                            for (const affectedCoin of contribution.affectedCoins) {
                                const cell = document.getElementById(`cell-${affectedCoin.row}-${affectedCoin.col}`);
                                if (cell) {
                                    console.log(`[Clover] Animating coin at (${affectedCoin.row},${affectedCoin.col}): ${affectedCoin.beforeMultiplier} → ${affectedCoin.afterMultiplier}`);

                                    // Store original transition
                                    cell.dataset.originalTransition = cell.style.transition;
                                    cell.style.transition = 'all 0.5s ease';

                                    // Set initial multiplier (before)
                                    cell.dataset.multiplier = affectedCoin.beforeMultiplier;

                                    // Phase 1: Scale up
                                    cell.style.transform = 'scale(1.3)';
                                    cell.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.8)';
                                    cell.style.filter = 'brightness(1.5)';
                                    cell.style.zIndex = '100';
                                    await sleep(300);

                                    // Phase 2: Update multiplier (show after value)
                                    cell.dataset.multiplier = affectedCoin.afterMultiplier;
                                    cell.style.background = 'linear-gradient(135deg, rgba(255,215,0,0.9), rgba(255,215,0,0.5))';
                                    await sleep(300);

                                    // Phase 3: Scale back
                                    cell.style.transform = 'scale(1)';
                                    cell.style.boxShadow = '';
                                    cell.style.filter = '';
                                    cell.style.zIndex = '';
                                    cell.style.background = '';
                                    cell.style.transition = cell.dataset.originalTransition || '';
                                }
                            }

                            // Animate each affected pot one by one
                            for (const affectedPot of contribution.affectedPots) {
                                const cell = document.getElementById(`cell-${affectedPot.row}-${affectedPot.col}`);
                                if (cell) {
                                    console.log(`[Clover] Animating pot at (${affectedPot.row},${affectedPot.col}): ${affectedPot.beforeMultiplier} → ${affectedPot.afterMultiplier}`);

                                    cell.dataset.multiplier = affectedPot.beforeMultiplier;
                                    cell.dataset.originalTransition = cell.style.transition;
                                    cell.style.transition = 'all 0.5s ease';

                                    cell.style.transform = 'scale(1.3)';
                                    cell.style.boxShadow = '0 0 30px rgba(155, 89, 182, 0.8)';
                                    cell.style.filter = 'brightness(1.5)';
                                    cell.style.zIndex = '100';
                                    await sleep(300);

                                    cell.dataset.multiplier = affectedPot.afterMultiplier;
                                    cell.style.background = 'linear-gradient(135deg, rgba(155,89,182,0.9), rgba(155,89,182,0.5))';
                                    await sleep(300);

                                    cell.style.transform = 'scale(1)';
                                    cell.style.boxShadow = '';
                                    cell.style.filter = '';
                                    cell.style.zIndex = '';
                                    cell.style.background = '';
                                    cell.style.transition = cell.dataset.originalTransition || '';
                                }
                            }
                        }

                        // Pretty print grid AFTER this clover's contribution
                        // prettyPrintRainbowGrid(round, `AFTER Clover at (${contribution.clover.row},${contribution.clover.col})`, step);
                    }

                    // Clear highlights
                    if (step.activeClover) {
                        const cloverCell = document.getElementById(`cell-${step.activeClover.row}-${step.activeClover.col}`);
                        if (cloverCell) cloverCell.classList.remove('active-clover');
                    }

                    // 500ms delay between clovers
                    await sleep(500);

                } else if (step.stepType === 'pot') {
                    // Re-render all symbols first
                    for (const coin of step.coins) {
                        const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                        if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                            const coinEmoji = CONFIG.symbols[coin.symbolId] || CONFIG.symbols[coin.type.toUpperCase()] || '🪙';
                            cell.textContent = coinEmoji;
                            cell.classList.add('rainbow-coin', coin.type);
                        }
                    }
                    for (const clover of step.clovers) {
                        const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                        if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols[clover.symbolId] || '🍀';
                            cell.classList.add('clover-symbol');
                            cell.dataset.multiplier = clover.multiplier;
                        }
                    }
                    for (const pot of step.pots) {
                        const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                        if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols[pot.symbolId] || '🏺';
                            cell.classList.add('pot-symbol');
                            // Only show multiplier if pot has value > 0
                            if (pot.finalMultiplier > 0) {
                                cell.dataset.multiplier = pot.finalMultiplier;
                            } else {
                                cell.dataset.multiplier = '';
                            }
                        }
                    }

                    // Highlight active pot collecting
                    console.log(`  🏺 Pot at (${step.activePot?.row},${step.activePot?.col}) collects:`);
                    if (step.collectedCoins) {
                        for (const coin of step.collectedCoins) {
                            console.log(`     - ${coin.type} at (${coin.row},${coin.col}): ${coin.finalMultiplier}x`);
                        }
                        for (const pot of step.collectedPots){
                            console.log(`     - Pot at (${pot.row},${pot.col}): ${pot.value}x`);
                        }
                        console.log(`     Total collected: ${step.activePot?.finalMultiplier}x`);

                        // Animate coins flying to pot
                        if (step.activePot) {
                            await animateCoinsToPot(step.collectedCoins, step.activePot.row, step.activePot.col);
                        }
                    }
                    if (step.activePot) {
                        const potCell = document.getElementById(`cell-${step.activePot.row}-${step.activePot.col}`);
                        if (potCell) {
                            potCell.classList.add('active-pot');
                            potCell.dataset.multiplier = step.activePot.originalMultiplier;
                        }
                    }
                    await sleep(400);
                    if (step.activePot) {
                        const potCell = document.getElementById(`cell-${step.activePot.row}-${step.activePot.col}`);
                        if (potCell) potCell.classList.remove('active-pot');
                    }
                }

                // Pretty print grid at this step
                prettyPrintRainbowGrid(round, `Step ${step.stepNumber}: ${step.description}`, step);
            }
        } else {
            // Fallback: render all at once if no steps data
            for (const coin of round.coins) {
                const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                    const coinEmoji = CONFIG.symbols[coin.type.toUpperCase()];
                    cell.textContent = coinEmoji;
                    cell.classList.add('rainbow-coin', coin.type);
                    cell.dataset.multiplier = coin.finalMultiplier;
                }
            }
            for (const clover of round.clovers) {
                const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                    cell.textContent = CONFIG.symbols[clover.symbolId] || '🍀';
                    cell.classList.add('clover-symbol');
                    cell.dataset.multiplier = clover.multiplier;
                }
            }
            for (const pot of round.pots) {
                const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                    cell.textContent = CONFIG.symbols[pot.symbolId] || '🏺';
                    cell.classList.add('pot-symbol');
                    cell.dataset.multiplier = pot.finalMultiplier;
                }
            }
            await sleep(400);

            // Pretty print final grid
            prettyPrintRainbowGrid(round, 'Final');
        }

        // 4. Build round summary HTML for overlay
        let roundHtml = `<div class="rainbow-round"><div class="round-title">Round ${round.round}</div>`;

        // Show coins in overlay
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

        // Show clovers in overlay
        if (round.clovers.length > 0) {
            roundHtml += `<div class="round-clovers">`;
            for (const clover of round.clovers) {
                const cloverEmoji = CONFIG.symbols[clover.symbolId] || '🍀';
                roundHtml += `
                    <div class="clover-item">
                        <span class="clover-emoji">${cloverEmoji}</span>
                        <span class="clover-multiplier">${clover.multiplier}x</span>
                    </div>
                `;
            }
            roundHtml += `</div>`;
        }

        // Show pots in overlay
        if (round.pots.length > 0) {
            roundHtml += `<div class="round-pots">`;
            for (const pot of round.pots) {
                const potEmoji = CONFIG.symbols[pot.symbolId] || '🏺';
                roundHtml += `
                    <div class="pot-item">
                        <span class="pot-emoji">${potEmoji}</span>
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

    // Add overall total win to details panel
    if (rainbowDetailsContent && rainbowResult.totalCoinWin !== undefined && rainbowResult.totalPotWin !== undefined) {
        const overallTotal = rainbowResult.totalCoinWin + rainbowResult.totalPotWin;
        const totalDiv = document.createElement('div');
        totalDiv.className = 'rainbow-total-win';

        // Build detailed breakdown
        let detailsHtml = '';

        // Show raw values (before bet)
        if (rainbowResult.totalCoinValue > 0 || rainbowResult.totalPotValue > 0) {
            detailsHtml += '<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,215,0,0.3);">';
            detailsHtml += '<span style="color: #888; font-size: 0.85rem;">Raw Multipliers:</span><br/>';
            if (rainbowResult.totalCoinValue > 0) {
                detailsHtml += `<span style="color: #4ecdc4; font-size: 0.9rem;">Coins: ${rainbowResult.totalCoinValue.toFixed(2)}x</span>`;
            }
            if (rainbowResult.totalPotValue > 0) {
                if (rainbowResult.totalCoinValue > 0) detailsHtml += ' | ';
                detailsHtml += `<span style="color: #9b59b6; font-size: 0.9rem;">Pots: ${rainbowResult.totalPotValue.toFixed(2)}x</span>`;
            }
            detailsHtml += '</div>';
        }

        // Show win amounts (with bet)
        detailsHtml += '<div style="margin-top: 8px;">';
        detailsHtml += '<span style="color: #888; font-size: 0.85rem;">Win Amount:</span><br/>';
        if (rainbowResult.totalCoinWin > 0) {
            detailsHtml += `<span style="color: #4ecdc4; font-size: 0.9rem;">Coins: ${rainbowResult.totalCoinWin.toFixed(2)}x</span>`;
        }
        if (rainbowResult.totalPotWin > 0) {
            if (rainbowResult.totalCoinWin > 0) detailsHtml += ' | ';
            detailsHtml += `<span style="color: #9b59b6; font-size: 0.9rem;">Pots: ${rainbowResult.totalPotWin.toFixed(2)}x</span>`;
        }
        detailsHtml += '</div>';

        totalDiv.innerHTML = `
            <div style="margin-top: 15px; padding: 15px; border-top: 2px solid #ffd700; text-align: center; background: rgba(0,0,0,0.3); border-radius: 8px;">
                <strong style="color: #ffd700; font-size: 1.2rem;">🌈 Rainbow Total: ${overallTotal.toFixed(2)}</strong>
                ${detailsHtml}
            </div>
        `;
        rainbowDetailsContent.appendChild(totalDiv);
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

function  highlightRemovedSymbols(removedSymbols) {
    console.log(`${JSON.stringify(removedSymbols)}`)
    for (const rs of removedSymbols) {
        const cell = document.getElementById(`cell-${rs.row}-${rs.col}`);
        if (cell) {
            cell.classList.add('removing');
            cell.style.transform = 'scale(0)';
        }
    }
}

// Calculate buffer row for new symbols (frontend determines this)
function calculateBufferRow(toRow, newSymbolCount) {
    // Match server logic: distribute in buffer rows (-5 to -1)
    const bufferIndex = Math.floor((toRow / Math.max(newSymbolCount - 1, 1)) * 4);
    return -5 + bufferIndex;
}

// Combined animation for drops and new symbols (happens simultaneously)
// Lower symbols (larger row numbers) drop first
async function animateCombined(movements) {
    const animationDuration = 400; // ms
    const staggerDelay = 50; // ms between rows

    // Sort movements by destination row (descending - lower rows first)
    const sortedMovements = [...movements].sort((a, b) => b.to.row - a.to.row);

    // Count new symbols per column to calculate buffer positions
    const newSymbolsPerCol = {};
    movements.filter(m => m.isNew).forEach(m => {
        newSymbolsPerCol[m.to.col] = (newSymbolsPerCol[m.to.col] || 0) + 1;
    });

    // 1. Create a Promise for every movement
    const animationPromises = sortedMovements.map((move) => {
        return new Promise((resolve) => {
            // For new symbols, calculate from position (frontend determines it)
            const fromRow = move.from?.row ?? calculateBufferRow(move.to.row, newSymbolsPerCol[move.to.col] || 1);
            const fromCol = move.from?.col ?? move.to.col;
            
            const fromCell = document.getElementById(`cell-${fromRow}-${fromCol}`);
            const targetCell = document.getElementById(`cell-${move.to.row}-${move.to.col}`);

            // Set up the symbol in the starting cell (buffer or old position)
            const icon = CONFIG.symbols[move.symbolInstance.symbol] || '❓';
            if (move.isNew) {
                fromCell.style.transform = '';
                fromCell.textContent = icon;
                fromCell.dataset.symbol = move.symbol;
            }

            // Calculate movement math
            const rowDiff = move.to.row - fromRow;
            const cellHeight = 76;
            const fallDistance = rowDiff * cellHeight;
            const delay = (4 - move.to.row) * staggerDelay;

            // 2. Execute the staggered animation
            setTimeout(() => {
                fromCell.style.transition = `transform ${animationDuration}ms ease-out`;
                fromCell.style.transform = `translateY(${fallDistance}px)`;

                // 3. Resolve this specific promise once the movement finishes
                setTimeout(resolve, animationDuration);
            }, delay);
        });
    });

    // 4. Wait for ALL animations to complete
    return Promise.all(animationPromises).then(() => {
        sortedMovements.forEach((move) => {
            // For new symbols, calculate from position
            const fromRow = move.from?.row ?? calculateBufferRow(move.to.row, newSymbolsPerCol[move.to.col] || 1);
            const fromCol = move.from?.col ?? move.to.col;
            
            const fromCell = document.getElementById(`cell-${fromRow}-${fromCol}`);
            if (fromCell) {
                // STEP 1: Kill the transition immediately
                fromCell.style.transition = 'none';

                // STEP 2: Force a reflow (tells the browser: "Stop animating NOW")
                void fromCell.offsetHeight;

                // STEP 3: Reset everything else
                fromCell.textContent = '';
                fromCell.dataset.symbol = '';
                // Restore original buffer classes
                fromCell.className = 'reel-cell lebandit-cell buffer-cell';
            }
        });

        console.log("All symbols disappeared instantly without fallback.");
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

    // Update bonus button
    updateBonusButton();
}

// Rainbow Mode Toggle
function toggleRainbowMode() {
    const checkbox = document.getElementById('rainbowModeCheck');
    rainbowModeEnabled = checkbox.checked;

    console.log('[Rainbow Mode]', rainbowModeEnabled ? 'ENABLED' : 'DISABLED');

    // Update UI to show cost
    updateBetDisplay();
}

// Bonus Game State
let bonusGameActive = false;

// Buy Bonus Function
function buyBonus() {
    if (!CONFIG.bonusGame.enabled) {
        console.log('[Buy Bonus] Bonus game is disabled');
        return;
    }

    if (isSpinning) {
        console.log('[Buy Bonus] Cannot buy bonus while spinning');
        return;
    }

    const currentBet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    const bonusCost = currentBet * CONFIG.bonusGame.buyCostMultiplier;

    console.log(`[Buy Bonus] Buying Luck of the Bandit bonus for ${bonusCost}x bet ($${bonusCost})`);

    // Use sendSetBet with forceBonusType to trigger bonus
    sendSetBet(currentBet, 'LUCK_OF_THE_BANDIT');

    updateBonusButton();
}

// Buy Glitters Bonus Function
function buyGlittersBonus() {
    if (!CONFIG.bonusGame.enabled) {
        console.log('[Buy Glitters Bonus] Bonus game is disabled');
        return;
    }

    if (isSpinning) {
        console.log('[Buy Glitters Bonus] Cannot buy bonus while spinning');
        return;
    }

    const currentBet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    const bonusCost = currentBet * CONFIG.bonusGame.buyCostMultiplier;

    console.log(`[Buy Glitters Bonus] Buying All That Glitters Is Gold bonus for ${bonusCost}x bet ($${bonusCost})`);

    // Clean up previous reel effects before buying bonus
    cleanupReelEffects();

    // Use sendSetBet with forceBonusType to trigger Glitters bonus
    sendSetBet(currentBet, 'ALL_THAT_GLITTERS_IS_GOLD');

    updateBonusButton();
}

// Buy Treasure Bonus Function
function buyTreasureBonus() {
    if (!CONFIG.treasureBonus.enabled) {
        console.log('[Buy Treasure Bonus] Treasure bonus is disabled');
        return;
    }

    if (isSpinning) {
        console.log('[Buy Treasure Bonus] Cannot buy bonus while spinning');
        return;
    }

    const currentBet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    const bonusCost = currentBet * CONFIG.treasureBonus.buyCostMultiplier;

    console.log(`[Buy Treasure Bonus] Buying Treasure at the End of the Rainbow bonus for ${bonusCost}x bet ($${bonusCost})`);

    // Clean up previous reel effects before buying bonus
    cleanupReelEffects();

    // Use sendSetBet with forceBonusType to trigger Treasure bonus
    sendSetBet(currentBet, 'TREASURE_AT_END_OF_RAINBOW');

    updateBonusButton();
}

// Update Bonus Button State
function updateBonusButton() {
    const bonusSection = document.getElementById('bonusGameSection');
    const buyButton = document.getElementById('buyBonusButton');
    const buyGlittersButton = document.getElementById('buyGlittersBonusButton');
    const buyTreasureButton = document.getElementById('buyTreasureBonusButton');

    if (!bonusSection) return;

    // Show/hide based on config
    if (CONFIG.bonusGame.enabled || CONFIG.treasureBonus.enabled) {
        bonusSection.classList.remove('hidden');
    } else {
        bonusSection.classList.add('hidden');
        return;
    }

    const currentBet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    const bonusCost = currentBet * CONFIG.bonusGame.buyCostMultiplier;
    const treasureCost = currentBet * CONFIG.treasureBonus.buyCostMultiplier;

    // Update Luck of the Bandit button
    if (buyButton) {
        buyButton.textContent = `🎁 Buy Bonus (${CONFIG.bonusGame.buyCostMultiplier}x) - $${bonusCost}`;
        buyButton.disabled = isSpinning || bonusGameActive;
        buyButton.style.display = CONFIG.bonusGame.enabled ? 'block' : 'none';
    }

    // Update Glitters button
    if (buyGlittersButton) {
        buyGlittersButton.textContent = `✨ Buy Glitters (${CONFIG.bonusGame.buyCostMultiplier}x) - $${bonusCost}`;
        buyGlittersButton.disabled = isSpinning || bonusGameActive;
        buyGlittersButton.style.display = CONFIG.bonusGame.enabled ? 'block' : 'none';
    }

    // Update Treasure button
    if (buyTreasureButton) {
        buyTreasureButton.textContent = `🌈 Buy Treasure (${CONFIG.treasureBonus.buyCostMultiplier}x) - $${treasureCost}`;
        buyTreasureButton.disabled = isSpinning || bonusGameActive;
        buyTreasureButton.style.display = CONFIG.treasureBonus.enabled ? 'block' : 'none';
    }
}

// Show Bonus Progress
function showBonusProgress(bonusState) {
    const progressDiv = document.getElementById('bonusProgress');
    if (!progressDiv) return;

    progressDiv.classList.remove('hidden');
    
    // Hide buy button section during bonus
    const bonusSection = document.getElementById('bonusGameSection');
    if (bonusSection) bonusSection.classList.add('hidden');

    updateBonusProgress(bonusState);
}

// Update Bonus Progress Display
function updateBonusProgress(bonusState) {
    const spinsLeftEl = document.getElementById('bonusSpinsLeft');
    const totalSpinsEl = document.getElementById('bonusTotalSpins');
    const frameCountEl = document.getElementById('bonusFrameCount');
    const totalWinEl = document.getElementById('bonusTotalWin');
    const bonusNameEl = document.getElementById('bonusName');

    if (spinsLeftEl) spinsLeftEl.textContent = bonusState.spinsLeft;
    if (totalSpinsEl) totalSpinsEl.textContent = bonusState.totalSpins;
    if (frameCountEl) frameCountEl.textContent = bonusState.goldenFrames?.length || 0;
    if (totalWinEl) totalWinEl.textContent = '$' + (bonusState.totalWin || 0).toFixed(2);
    
    // Update bonus name display
    if (bonusNameEl) {
        const isGlitters = bonusState.type === 'ALL_THAT_GLITTERS_IS_GOLD';
        bonusNameEl.textContent = isGlitters ? '✨ All That Glitters Is Gold' : '🎰 Luck of the Bandit';
        bonusNameEl.style.color = isGlitters ? '#f1c40f' : '#9b59b6';
    }
}

// Hide Bonus Progress
function hideBonusProgress() {
    const progressDiv = document.getElementById('bonusProgress');
    if (progressDiv) progressDiv.classList.add('hidden');
    
    // Show buy button section again
    const bonusSection = document.getElementById('bonusGameSection');
    if (bonusSection && CONFIG.bonusGame.enabled) bonusSection.classList.remove('hidden');
    
    bonusGameActive = false;
    updateBonusButton();
}

// Show Bonus Trigger Overlay
function showBonusTrigger(grid, scatterPositions) {
    console.log('[showBonusTrigger] Called with', scatterPositions.length, 'scatters');
    
    const overlay = document.getElementById('bonusTriggerOverlay');
    const gridEl = document.getElementById('bonusTriggerGrid');
    
    if (!overlay || !gridEl) {
        console.error('[showBonusTrigger] Missing elements:', { overlay: !!overlay, gridEl: !!gridEl });
        return;
    }
    
    // Build grid HTML with highlighted scatters
    let gridHtml = '';
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const symbol = grid[r][c];
            const isScatter = symbol === '2' || symbol === SYMBOLS.SCATTER;
            const display = CONFIG.symbols[symbol] || symbol;
            gridHtml += `<div class="trigger-cell ${isScatter ? 'scatter' : ''}">${display}</div>`;
        }
    }
    gridEl.innerHTML = gridHtml;
    
    // Show overlay
    overlay.classList.remove('hidden');
    overlay.classList.add('active');
    
    console.log('[Bonus Trigger] Overlay shown');
}

// Hide Bonus Trigger Overlay
function hideBonusTrigger() {
    const overlay = document.getElementById('bonusTriggerOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.classList.add('hidden');
    }
}

// Enter Bonus Game
function enterBonus() {
    hideBonusTrigger();
    console.log('[Bonus] Entering bonus game...');
}

// Render Bonus Trigger - Similar to rainbow feature style
async function renderBonusTrigger(bonusState, grid) {
    console.log('[renderBonusTrigger] Rendering bonus trigger animation');
    
    if (!bonusState || !grid) {
        console.log('[renderBonusTrigger] Missing bonusState or grid');
        return;
    }
    
    // Remove any existing trigger text first
    const existingText = document.getElementById('bonusTriggerText');
    if (existingText) existingText.remove();
    
    // Find scatter positions
    const scatterPositions = [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === '2' || grid[r][c] === SYMBOLS.SCATTER) {
                scatterPositions.push({row: r, col: c});
            }
        }
    }
    
    console.log(`[renderBonusTrigger] Found ${scatterPositions.length} scatters`);
    
    // Determine bonus type and display info
    const isGlittersBonus = bonusState.type === 'ALL_THAT_GLITTERS_IS_GOLD';
    const bonusName = isGlittersBonus ? 'All That Glitters Is Gold' : 'Luck of the Bandit';
    const bonusSpins = isGlittersBonus ? '12' : '8';
    const bonusDescription = isGlittersBonus 
        ? '12 Free Spins with Persistent Golden Squares' 
        : '8 Free Spins with Accumulating Golden Squares';
    const bonusColor = isGlittersBonus ? '#f1c40f' : '#9b59b6'; // Gold vs Purple
    
    // Create and show bonus trigger text overlay
    const triggerText = document.createElement('div');
    triggerText.id = 'bonusTriggerText';
    triggerText.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${isGlittersBonus ? 'rgba(241, 196, 15, 0.85)' : 'rgba(155, 89, 182, 0.85)'};
        color: #fff;
        padding: 20px 40px;
        border-radius: 15px;
        font-size: 1.5rem;
        font-weight: bold;
        text-align: center;
        z-index: 1001;
        box-shadow: 0 0 30px ${isGlittersBonus ? 'rgba(241, 196, 15, 0.8)' : 'rgba(155, 89, 182, 0.8)'};
        animation: bonusTextPulse 1s ease-in-out 3;
        backdrop-filter: blur(5px);
    `;
    triggerText.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 10px;">🎁 BONUS TRIGGERED!</div>
        <div style="color: #ffd700;">${scatterPositions.length} SCATTERS</div>
        <div style="font-size: 1.2rem; margin-top: 10px;">${bonusName}</div>
        <div style="font-size: 1rem; color: #ccc; margin-top: 5px;">${bonusDescription}</div>
    `;
    document.body.appendChild(triggerText);
    
    // Highlight scatter positions with animation
    for (const pos of scatterPositions) {
        const cell = document.getElementById(`cell-${pos.row}-${pos.col}`);
        if (cell) {
            cell.classList.add('scatter-highlight');
            cell.style.animation = 'scatterPulse 0.5s ease-in-out 3';
        }
    }
    
    // Show bonus triggered message
    const statusBar = document.getElementById('cascadeInfo');
    const statusLabel = document.getElementById('cascadeLabel');
    const statusStep = document.getElementById('cascadeStep');
    
    if (statusBar && statusLabel && statusStep) {
        statusBar.classList.remove('hidden');
        statusLabel.textContent = '🎁 BONUS TRIGGERED!';
        statusStep.textContent = `${scatterPositions.length} Scatters → ${bonusName}`;
        statusLabel.style.color = bonusColor;
        statusLabel.style.fontWeight = 'bold';
    }
    
    // Wait for animation
    await sleep(1500);
    
    // Remove trigger text with fade out
    const textEl = document.getElementById('bonusTriggerText');
    if (textEl) {
        textEl.style.transition = 'opacity 0.5s ease';
        textEl.style.opacity = '0';
        await sleep(500);
        textEl.remove();
    }
    
    // Clear scatter highlights
    document.querySelectorAll('.scatter-highlight').forEach(cell => {
        cell.classList.remove('scatter-highlight');
        cell.style.animation = '';
    });
    
    // Hide status after delay
    if (statusBar && statusLabel) {
        await sleep(1000);
        statusBar.classList.add('hidden');
        statusLabel.style.color = '';
        statusLabel.style.fontWeight = '';
    }
    
    console.log('[renderBonusTrigger] Animation complete');
}

function changeBet(delta) {
    CURRENT_BET_INDEX += delta;
    if (CURRENT_BET_INDEX < 0) CURRENT_BET_INDEX = 0;
    if (CURRENT_BET_INDEX >= BET_SIZE_LIST.length) CURRENT_BET_INDEX = BET_SIZE_LIST.length - 1;

    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    updateBetDisplay();
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
        cell.classList.remove('highlight', 'removing', 'rainbow', 'coin-symbol', 'clover-symbol', 'pot-symbol', 'rainbow-coin', 'pot-collected');
        cell.style.transform = '';
        cell.style.animation = '';
        cell.dataset.multiplier = '';
    });

    // Clear golden squares
    //clearGoldenSquares();

    // Clear history displays
    document.getElementById('cascadeHistory').classList.add('hidden');
    document.getElementById('rainbowHistory').classList.add('hidden');
    document.getElementById('cascadeStepsList').innerHTML = '';
    document.getElementById('rainbowRoundsList').innerHTML = '';

    // Hide rainbow overlay from previous spin
    document.getElementById('rainbowOverlay').classList.add('hidden');

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
