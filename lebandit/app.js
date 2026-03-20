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
let rainbowModeEnabled = false; // Rainbow mode state

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

function sendSetBet(bet) {
    const message = { 
        bet: bet,
        rainbowMode: rainbowModeEnabled
    };
    
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

// Helper to convert SymbolGrid to display Grid
function symbolGridToGrid(symbolGrid) {
    if (!symbolGrid || !symbolGrid.length) return [];
    return symbolGrid.map(row =>
        row.map(cell => cell?.symbol || '')
    );
}

async function handleSpinResult(data) {
    console.log('[handleSpinResult] Raw data:', data);

    // Match TheLuxe structure - betInfo contains the result
    const betInfo = data.betInfo?.[0];
    console.log('[handleSpinResult] betInfo:', betInfo);

    if (!betInfo) {
        console.error('No betInfo in SetBet response', data);
        isSpinning = false;
        document.getElementById('spinButton').disabled = false;
        return;
    }

    console.log('[handleSpinResult] bet:', betInfo.bet, 'finalBalance:', betInfo.finalBalance);

    const result = betInfo.gameResult;
    if (!result) {
        console.error('No gameResult in betInfo', betInfo);
        isSpinning = false;
        document.getElementById('spinButton').disabled = false;
        return;
    }

    // Pretty print grid for debugging (show symbol IDs with icons)
    console.log('%c[Grid Result]', 'color: #4ecdc4; font-weight: bold;');
    if (result.grid) {
        console.log('Final Grid:');
        result.grid.forEach((row, i) => {
            const cells = row.map(s => {
                if (s === '' || s === null || s === undefined) return '    ·   ';
                const icon = CONFIG.symbols[s] || '❓';
                const id = String(s).padStart(3, ' ');
                return `${id}${icon}`;
            });
            console.log(`  Row ${i}: ${cells.join('│')}`);
        });
    }

    // Pretty print cascade steps if present
    if (result.cascadeSteps && result.cascadeSteps.length > 0) {
        console.log(`%c[Cascade: ${result.cascadeSteps.length} steps]`, 'color: #ffd700; font-weight: bold;');
        result.cascadeSteps.forEach((step, idx) => {
            console.log(`%c  Step ${idx + 1}:`, 'color: #4ecdc4; font-weight: bold;', `${step.winningClusters.length} clusters, win: ${step.totalWin}`);

            // Helper to format grid row with symbol IDs and icons
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

            // Print grid BEFORE (initial state for this step)
            if (step.symbolGridBefore) {
                console.log('%c  ┌─ BEFORE ─────────────┐', 'color: #888;');
                step.symbolGridBefore.forEach((row, i) => {
                    console.log('%c' + formatRow(row, i), 'color: #ccc;');
                });
                printSeparator();
            }

            // Print grid AFTER REMOVAL (winning symbols removed)
            if (step.symbolGridAfterRemoval) {
                console.log('%c  ┌─ AFTER REMOVAL ──────┐', 'color: #ff6b6b;');
                step.symbolGridAfterRemoval.forEach((row, i) => {
                    console.log('%c' + formatRow(row, i), 'color: #ff6b6b;');
                });
                printSeparator();
            }

            // Print grid AFTER DROP & FILL (combined stage)
            if (step.symbolGridAfterDropAndFill) {
                console.log('%c  ┌─ AFTER DROP & FILL ──┐', 'color: #95e1d3;');
                step.symbolGridAfterDropAndFill.forEach((row, i) => {
                    console.log('%c' + formatRow(row, i), 'color: #95e1d3;');
                });
                printSeparator();
            }

            // Print winning clusters
            if (step.winningClusters.length > 0) {
                console.log('%c  💰 Wins:', 'color: #ffd700; font-weight: bold;');
                step.winningClusters.forEach(c => {
                    const icon = CONFIG.symbols[c.symbol] || '❓';
                    const positions = c.positions.map(p => `(${p.row},${p.col})`).join(' ');
                    console.log(`     ${c.symbol}${icon} cluster x${c.count} = $${c.payout}  [${positions}]`);
                });
            }
            
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

    // Render rainbow feature if present
    if (result.rainbowResult?.hasRainbow) {
        await renderRainbowFeature(result.rainbowResult);
    }

    // All animations complete - allow next spin
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
}

// Grid Rendering
function renderGrid(grid, instant = false) {
    if (!grid || !grid.length) return;

    currentGrid = grid;

    for (let r = -5; r < CONFIG.rows; r++) {
        for (let c = 0; c < CONFIG.cols; c++) {
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

    // Clear existing golden squares first
    overlay.innerHTML = '';

    // Use CSS Grid to match the main grid structure - responsive!
    overlay.style.display = 'grid';
    overlay.style.gridTemplateColumns = 'repeat(6, 1fr)';
    overlay.style.gridTemplateRows = 'repeat(5, 1fr)';
    overlay.style.gap = '6px';
    overlay.style.padding = '15px';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.boxSizing = 'border-box';

    // Log rendering info
    console.log(`[Golden Squares] Rendering ${squares.length} squares at positions:`,
        squares.filter(sq => sq.row >= 0 && sq.row < 5).map(sq => `(${sq.row},${sq.col})`).join(', '));

    for (const sq of squares) {
        // Only render if row is in visible area (0-4)
        if (sq.row < 0 || sq.row >= 5) continue;

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

// Render Golden Frames for Bonus Games
function renderGoldenFrames(frames) {
    if (!frames || !frames.length) return;

    for (let r = 0; r < frames.length; r++) {
        for (let c = 0; c < frames[r].length; c++) {
            const frame = frames[r][c];
            if (!frame || frame.value <= 0) continue;

            const cell = document.getElementById(`cell-${r}-${c}`);
            if (!cell) continue;

            // Add golden frame styling based on type
            cell.classList.add('golden-frame');
            cell.classList.add(`frame-${frame.type}`);
            
            if (frame.active) {
                cell.classList.add('frame-active');
            }

            // Show frame value
            const valueEl = document.createElement('div');
            valueEl.className = 'frame-value';
            valueEl.textContent = frame.value + 'x';
            cell.appendChild(valueEl);
        }
    }
}

// Clear Golden Frames
function clearGoldenFrames() {
    document.querySelectorAll('.golden-frame').forEach(cell => {
        cell.classList.remove('golden-frame', 'frame-bronze', 'frame-silver', 'frame-gold', 'frame-jackpot', 'frame-active');
        const valueEl = cell.querySelector('.frame-value');
        if (valueEl) valueEl.remove();
    });
}

// Clear All Golden Effects (squares + frames)
function clearAllGoldenEffects() {
    clearGoldenSquares();
    clearGoldenFrames();
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

        // Step 4: Animate drops and new symbols
        // Golden squares in overlay stay visible (independent of grid animation)
        await animateCombined(step.movements);

        // Step 5: Render final grid
        renderGrid(symbolGridToGrid(step.symbolGridAfterDropAndFill), true);

        // Golden squares persist in overlay - no need to re-render

        // Render golden frames if in bonus game
        if (step.bonusGameState?.goldenFrames) {
            renderGoldenFrames(step.bonusGameState.goldenFrames);
        }

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

    // Highlight rainbow position first (before any other rendering)
    const rainbowPos = rainbowResult.rainbowPosition;
    if (rainbowPos) {
        const { row, col } = rainbowPos;
        console.log(`[renderRainbowFeature] Setting rainbow at (${row},${col})`);
        const cell = document.getElementById(`cell-${row}-${col}`);
        if (cell) {
            cell.textContent = CONFIG.symbols['RAINBOW'];
            cell.classList.add('rainbow');
        }
    }

    // Helper to pretty print rainbow grid
    function prettyPrintRainbowGrid(round, stepLabel) {
        console.log(`%c[Rainbow Grid - Round ${round.round}, ${stepLabel}]`, 'color: #ff6b6b; font-weight: bold;');
        
        const grid = [];
        for (let r = 0; r < CONFIG.rows; r++) {
            grid[r] = [];
            for (let c = 0; c < CONFIG.cols; c++) {
                grid[r][c] = '  ·  ';
            }
        }

        // Mark rainbow position
        if (rainbowPos) {
            grid[rainbowPos.row][rainbowPos.col] = '🌈R🌈';
        }

        // Mark coins - show original and final multiplier
        for (const coin of round.coins) {
            const emoji = CONFIG.symbols[coin.type.toUpperCase()];
            const orig = coin.originalMultiplier;
            const final = coin.finalMultiplier;
            if (orig !== final) {
                grid[coin.row][coin.col] = `${emoji}${orig}>${final}`;
            } else {
                grid[coin.row][coin.col] = `${emoji}${final}`;
            }
        }

        // Mark clovers
        for (const clover of round.clovers) {
            grid[clover.row][clover.col] = `🍀${clover.multiplier}`;
        }

        // Mark pots
        for (const pot of round.pots) {
            grid[pot.row][pot.col] = `🏺${pot.finalMultiplier}`;
        }

        // Print grid with box drawing
        console.log('  ┌─────┬─────┬─────┬─────┬─────┬─────┐');
        for (let r = 0; r < CONFIG.rows; r++) {
            const rowStr = grid[r].map(cell => cell.padStart(5, ' ')).join('│');
            console.log(`${r} │${rowStr}│`);
            if (r < CONFIG.rows - 1) {
                console.log('  ├─────┼─────┼─────┼─────┼─────┼─────┤');
            }
        }
        console.log('  └─────┴─────┴─────┴─────┴─────┴─────┘');
        console.log('     0     1     2     3     4     5   ');
        
        // Summary
        console.log(`  Coins: ${round.coins.length}, Clovers: ${round.clovers.length}, Pots: ${round.pots.length}`);
        console.log(`  Total: ${round.totalCoinValue + round.totalPotValue}x`);
    }

    // Render each round
    for (const round of rainbowResult.rounds) {
        console.log(`%c[Rainbow Round ${round.round}]`, 'color: #ffd700; font-weight: bold; font-size: 14px;');
        
        // Check if we have steps data
        if (round.steps && round.steps.length > 0) {
            for (const step of round.steps) {
                console.log(`%c  Step ${step.stepNumber}: ${step.description}`, 'color: #4ecdc4;');
                
                // Clean previous styles before each step (except initial)
                if (step.stepType !== 'initial') {
                    document.querySelectorAll('.reel-cell').forEach(cell => {
                        cell.classList.remove('rainbow-coin', 'clover-symbol', 'pot-symbol', 
                                              'bronze', 'silver', 'gold', 
                                              'active-clover', 'active-pot', 'affected-by-clover');
                        cell.dataset.originalMultiplier = '';
                        cell.dataset.finalMultiplier = '';
                        cell.dataset.multiplier = '';
                    });
                }
                
                // Render based on step type
                if (step.stepType === 'initial') {
                    // Initial reveal - render all symbols
                    for (const coin of step.coins) {
                        const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                        if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                            const coinEmoji = CONFIG.symbols[coin.type.toUpperCase()];
                            cell.textContent = coinEmoji;
                            cell.classList.add('rainbow-coin', coin.type);
                            // Store both original and final
                            cell.dataset.originalMultiplier = coin.originalMultiplier;
                            cell.dataset.finalMultiplier = coin.finalMultiplier;
                        }
                    }
                    for (const clover of step.clovers) {
                        const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                        if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols['CLOVER'];
                            cell.classList.add('clover-symbol');
                            cell.dataset.multiplier = clover.multiplier + 'x';
                        }
                    }
                    for (const pot of step.pots) {
                        const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                        if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols['POT'];
                            cell.classList.add('pot-symbol');
                            cell.dataset.multiplier = pot.finalMultiplier + 'x';
                        }
                    }
                    await sleep(500);
                    
                } else if (step.stepType === 'clover') {
                    // Re-render all symbols first
                    for (const coin of step.coins) {
                        const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                        if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                            const coinEmoji = CONFIG.symbols[coin.type.toUpperCase()];
                            cell.textContent = coinEmoji;
                            cell.classList.add('rainbow-coin', coin.type);
                            cell.dataset.originalMultiplier = coin.originalMultiplier;
                            cell.dataset.finalMultiplier = coin.finalMultiplier;
                        }
                    }
                    for (const clover of step.clovers) {
                        const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                        if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols['CLOVER'];
                            cell.classList.add('clover-symbol');
                            cell.dataset.multiplier = clover.multiplier + 'x';
                        }
                    }
                    for (const pot of step.pots) {
                        const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                        if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols['POT'];
                            cell.classList.add('pot-symbol');
                            cell.dataset.multiplier = pot.finalMultiplier + 'x';
                        }
                    }
                    
                    // Highlight active clover and affected symbols
                    console.log(`  🍀 Clover at (${step.activeClover?.row},${step.activeClover?.col}) applies ${step.activeClover?.multiplier}x to:`);
                    
                    if (step.affectedCoins) {
                        for (const coin of step.affectedCoins) {
                            console.log(`     - Coin at (${coin.row},${coin.col}): ${coin.originalMultiplier}x → ${coin.finalMultiplier}x`);
                            const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                            if (cell) {
                                cell.classList.add('affected-by-clover');
                                cell.dataset.finalMultiplier = coin.finalMultiplier;
                            }
                        }
                    }
                    if (step.activeClover) {
                        const cloverCell = document.getElementById(`cell-${step.activeClover.row}-${step.activeClover.col}`);
                        if (cloverCell) cloverCell.classList.add('active-clover');
                    }
                    await sleep(800);
                    // Clear affected highlight
                    document.querySelectorAll('.affected-by-clover').forEach(cell => {
                        cell.classList.remove('affected-by-clover');
                    });
                    if (step.activeClover) {
                        const cloverCell = document.getElementById(`cell-${step.activeClover.row}-${step.activeClover.col}`);
                        if (cloverCell) cloverCell.classList.remove('active-clover');
                    }
                    
                } else if (step.stepType === 'pot') {
                    // Re-render all symbols first
                    for (const coin of step.coins) {
                        const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                        if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                            const coinEmoji = CONFIG.symbols[coin.type.toUpperCase()];
                            cell.textContent = coinEmoji;
                            cell.classList.add('rainbow-coin', coin.type);
                            cell.dataset.originalMultiplier = coin.originalMultiplier;
                            cell.dataset.finalMultiplier = coin.finalMultiplier;
                        }
                    }
                    for (const clover of step.clovers) {
                        const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                        if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols['CLOVER'];
                            cell.classList.add('clover-symbol');
                            cell.dataset.multiplier = clover.multiplier + 'x';
                        }
                    }
                    for (const pot of step.pots) {
                        const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                        if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                            cell.textContent = CONFIG.symbols['POT'];
                            cell.classList.add('pot-symbol');
                            cell.dataset.multiplier = pot.finalMultiplier + 'x';
                        }
                    }
                    
                    // Highlight active pot collecting
                    console.log(`  🏺 Pot at (${step.activePot?.row},${step.activePot?.col}) collects:`);
                    if (step.collectedCoins) {
                        let total = 0;
                        for (const coin of step.collectedCoins) {
                            console.log(`     - ${coin.type} at (${coin.row},${coin.col}): ${coin.finalMultiplier}x`);
                            total += coin.finalMultiplier;
                        }
                        console.log(`     Total collected: ${total}x → Final: ${step.activePot?.finalMultiplier}x`);
                    }
                    if (step.activePot) {
                        const potCell = document.getElementById(`cell-${step.activePot.row}-${step.activePot.col}`);
                        if (potCell) {
                            potCell.classList.add('active-pot');
                            potCell.dataset.multiplier = step.activePot.finalMultiplier + 'x';
                        }
                    }
                    await sleep(800);
                    if (step.activePot) {
                        const potCell = document.getElementById(`cell-${step.activePot.row}-${step.activePot.col}`);
                        if (potCell) potCell.classList.remove('active-pot');
                    }
                }

                // Pretty print grid at this step
                prettyPrintRainbowGrid(round, `Step ${step.stepNumber}: ${step.description}`);
            }
        } else {
            // Fallback: render all at once if no steps data
            for (const coin of round.coins) {
                const cell = document.getElementById(`cell-${coin.row}-${coin.col}`);
                if (cell && !(rainbowPos && coin.row === rainbowPos.row && coin.col === rainbowPos.col)) {
                    const coinEmoji = CONFIG.symbols[coin.type.toUpperCase()];
                    cell.textContent = coinEmoji;
                    cell.classList.add('rainbow-coin', coin.type);
                    cell.dataset.originalMultiplier = coin.originalMultiplier;
                    cell.dataset.finalMultiplier = coin.finalMultiplier;
                }
            }
            for (const clover of round.clovers) {
                const cell = document.getElementById(`cell-${clover.row}-${clover.col}`);
                if (cell && !(rainbowPos && clover.row === rainbowPos.row && clover.col === rainbowPos.col)) {
                    cell.textContent = CONFIG.symbols['CLOVER'];
                    cell.classList.add('clover-symbol');
                    cell.dataset.multiplier = clover.multiplier + 'x';
                }
            }
            for (const pot of round.pots) {
                const cell = document.getElementById(`cell-${pot.row}-${pot.col}`);
                if (cell && !(rainbowPos && pot.row === rainbowPos.row && pot.col === rainbowPos.col)) {
                    cell.textContent = CONFIG.symbols['POT'];
                    cell.classList.add('pot-symbol');
                    cell.dataset.multiplier = pot.finalMultiplier + 'x';
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
                roundHtml += `
                    <div class="clover-item">
                        <span class="clover-emoji">${CONFIG.symbols['CLOVER']}</span>
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

// Combined animation for drops and new symbols (happens simultaneously)
// Lower symbols (larger row numbers) drop first
async function animateCombined(movements) {
    const animationDuration = 400; // ms
    const staggerDelay = 50; // ms between rows

    // Sort movements by destination row (descending - lower rows first)
    const sortedMovements = [...movements].sort((a, b) => b.to.row - a.to.row);

    // 1. Create a Promise for every movement
    const animationPromises = sortedMovements.map((move) => {
        return new Promise((resolve) => {
            const fromCell = document.getElementById(`cell-${move.from.row}-${move.from.col}`);
            const targetCell = document.getElementById(`cell-${move.to.row}-${move.to.col}`);

            // Set up the symbol in the starting cell (buffer or old position)
            const icon = CONFIG.symbols[move.symbol] || '❓';
            if (move.isNew) {
                fromCell.style.transform = '';
                fromCell.textContent = icon;
                fromCell.dataset.symbol = move.symbol;
            }

            // Calculate movement math
            const rowDiff = move.to.row - move.from.row;
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
            const fromCell = document.getElementById(`cell-${move.from.row}-${move.from.col}`);
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

    // Update quick bet button active states
    document.querySelectorAll('.quick-bet').forEach(btn => {
        btn.classList.remove('active');
        const btnAmount = parseInt(btn.textContent.replace('$', ''));
        if (btnAmount === bet) {
            btn.classList.add('active');
        }
    });
}

// Rainbow Mode Toggle
function toggleRainbowMode() {
    const checkbox = document.getElementById('rainbowModeCheck');
    rainbowModeEnabled = checkbox.checked;
    
    console.log('[Rainbow Mode]', rainbowModeEnabled ? 'ENABLED' : 'DISABLED');
    
    // Update UI to show cost
    updateBetDisplay();
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
        cell.classList.remove('highlight', 'removing', 'rainbow', 'coin-symbol', 'clover-symbol', 'pot-symbol', 'rainbow-coin');
        cell.style.transform = '';
        cell.style.animation = '';
        cell.dataset.multiplier = '';
        cell.dataset.originalMultiplier = '';
        cell.dataset.finalMultiplier = '';
    });

    // Clear golden frames
    clearAllGoldenEffects();

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
