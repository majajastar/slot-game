/**
 * Casishenwin Slot Game - Direct WebSocket Client
 * 6x5 grid with multi-row occupancy, top row rolling, and frame progression
 * 
 * Backend sends SymbolInstance objects and pre-calculated movements
 */

// Data from server (populated after SyncRoomInfo)
let SYMBOLS = {};
let WIN_TABLE = {};
let GAME_CONFIG = {};
let BET_SIZE_LIST = [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00];
let CURRENT_BET_INDEX = 2;

// Game state
let wsClient = null;
let isSpinning = false;
let currentBalance = 0;

// Grid state
let currentGrid = null;
let currentTopRow = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    initGrid();
    updateBetDisplay();
    updateServerModeDisplay();
    await connect();
});

// ==========================================
// WEBSOCKET CONNECTION
// ==========================================

async function connect() {
    const statusEl = document.getElementById('serverMode');
    statusEl.textContent = '🟡 Connecting...';

    try {
        wsClient = new SlotGameWebSocketClient(CONFIG.gameTypeId, {
            serverMode: CONFIG.serverMode,
            fakeWsUrl: CONFIG.fakeWsUrl,
            sidUrl: CONFIG.sidUrl,
            launchUrl: CONFIG.launchUrl,
            wsBaseUrl: CONFIG.wsBaseUrl,
            authToken: CONFIG.authToken,
            testUuid: CONFIG.testUuid,
            testUserId: CONFIG.testUserId,
            apiSecret: CONFIG.apiSecret,
            operatorId: CONFIG.operatorId,
            currency: CONFIG.currency,
            gameTypeId: CONFIG.gameTypeId,
            pingInterval: CONFIG.pingInterval
        });

        // Event: Login success
        wsClient.on('login', (data) => {
            console.log('[Casishenwin] Login success:', data);
            const loginData = data.vals?.data || data;
            currentBalance = loginData.balance || 0;
            updateBalanceDisplay();
            statusEl.textContent = '🟢 Connected';
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('gameContent').classList.remove('hidden');
        });

        // Event: Join room (game config)
        wsClient.on('joinRoom', (data) => {
            console.log('[Casishenwin] Join room:', data);
            handleJoinRoom(data);
        });

        // Event: Spin result
        wsClient.on('setBet', (data) => {
            console.log('[Casishenwin] Spin result:', data);
            handleSpinResult(data);
        });

        // Event: Sync room info (reconnect)
        wsClient.on('syncRoomInfo', (data) => {
            console.log('[Casishenwin] Sync room:', data);
            handleSyncRoom(data);
        });

        // Event: Records
        wsClient.on('getRecords', (data) => {
            console.log('[Casishenwin] Records:', data);
        });

        // Event: Error
        wsClient.on('error', (error) => {
            console.error('[Casishenwin] WebSocket error:', error);
            statusEl.textContent = '🔴 Error';
        });

        // Event: Close
        wsClient.on('close', () => {
            console.log('[Casishenwin] WebSocket closed');
            statusEl.textContent = '🔴 Disconnected';
        });

        await wsClient.connect();

    } catch (error) {
        console.error('[Casishenwin] Connection failed:', error);
        statusEl.textContent = '🔴 Failed';
        document.getElementById('loading').textContent = 'Connection failed. Please refresh.';
    }
}

// ==========================================
// MESSAGE HANDLERS
// ==========================================

function handleJoinRoom(data) {
    const betInfo = data.betInfo?.[0];
    if (!betInfo) return;

    // Store symbols
    if (betInfo.symbols) {
        betInfo.symbols.forEach(sym => {
            SYMBOLS[sym.id] = sym;
        });
    }

    // Store win table
    if (betInfo.winTable) {
        WIN_TABLE = betInfo.winTable;
    }

    if (betInfo.winTableDisplay) {
        // winTableDisplay is unused - we calculate display from winTable
    }

    // Store bet sizes
    if (betInfo.betSizeList) {
        BET_SIZE_LIST = betInfo.betSizeList;
    }

    // Update UI
    renderPaytable();
    updateBetDisplay();
    initDebugPanel();
}

function initDebugPanel() {
    // Debug spins removed - no longer supported
}

function selectDebugSpin(spinId) {
    // Debug spins removed - no longer supported
    console.log('[Debug] Debug spins no longer supported');
}

function updateDebugStatus() {
    const statusEl = document.getElementById('debugStatus');
    if (statusEl) {
        statusEl.textContent = 'Random spins';
        statusEl.classList.remove('active');
    }
}

function handleSyncRoom(data) {
    if (data.balance != null) {
        currentBalance = data.balance;
        updateBalanceDisplay();
    }

    // Restore grid if available
    const lastResumeInfo = data.roomInfo?.lastResumeInfo;
    if (lastResumeInfo?.grid) {
        // Always use renderSymbolGrid for proper multi-row rendering
        if (lastResumeInfo.grid.mainGrid && lastResumeInfo.grid.mainGrid[0] && typeof lastResumeInfo.grid.mainGrid[0][0] === 'object') {
            renderSymbolGrid(lastResumeInfo.grid, document.getElementById('mainGrid'), document.getElementById('topRow'));
        } else {
            console.warn('[handleSyncRoom] Grid is not SymbolGrid, skipping render');
        }
    }
}

async function handleSpinResult(data) {
    isSpinning = false;
    
    // Clear timeout if it exists
    if (spinTimeout) {
        clearTimeout(spinTimeout);
        spinTimeout = null;
    }
    
    const spinButton = document.getElementById('spinButton');
    if (spinButton) {
        spinButton.disabled = false;
        spinButton.classList.remove('spinning');
    }

    const gameResult = data.gameResult;
    if (!gameResult) return;

    const info = gameResult.info;
    if (!info) return;

    // Update balance
    currentBalance = gameResult.finalBalance || currentBalance;
    updateBalanceDisplay();

    // Show cascade animation if there are steps
    if (info.steps && info.steps.length > 0) {
        await renderCascade(info.steps, info.symbolGrid || info.grid);
    } else {
        // No cascade - just render final grid
        if (info.symbolGrid) {
            // Use SymbolGrid if available (has IDs for multi-row detection)
            renderSymbolGrid(info.symbolGrid, document.getElementById('mainGrid'), document.getElementById('topRow'));
            
            // Debug: pretty print the grid even when no cascade
            console.log('%c[No Cascade - Final Grid]', 'color: #4ecdc4; font-weight: bold;');
            prettyPrintGrid(info.symbolGrid, null, null);
        } else if (info.grid) {
            // Fallback - but we need SymbolGrid for proper multi-row rendering
            console.warn('[handleSpinResult] No symbolGrid available, multi-row symbols may not render correctly');
        }
    }

    // Show win amount
    const winAmount = gameResult.winAmount || 0;
    if (winAmount > 0) {
        showWin(winAmount);
    }

    // Update win display
    document.getElementById('winAmount').textContent = winAmount.toFixed(2);
}

// ==========================================
// UI FUNCTIONS
// ==========================================

function initGrid() {
    const mainGrid = document.getElementById('mainGrid');
    const topRow = document.getElementById('topRow');

    mainGrid.innerHTML = '';
    topRow.innerHTML = '';

    // Create main grid cells
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.textContent = '❓';
            mainGrid.appendChild(cell);
        }
    }

    // Create top row cells
    for (let col = 0; col < CONFIG.topRowCols; col++) {
        const cell = document.createElement('div');
        cell.className = 'top-cell';
        cell.dataset.col = col;
        cell.textContent = '❓';
        topRow.appendChild(cell);
    }
}

/**
 * Render SymbolGrid (SymbolInstance[][])
 * Multi-row symbols show 1 icon in a rectangle that spans multiple rows
 * Symbol is centered vertically in the middle of the rectangle
 */
function renderSymbolGrid(symbolGrid, mainGridEl, topRowEl) {
    if (!symbolGrid || !symbolGrid.mainGrid) return;

    const cells = mainGridEl.children;
    
    // Reset main grid cells first - clear any previous multi-row styling
    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        cell.textContent = '';
        cell.className = 'grid-cell';
        delete cell.dataset.symbolId;
        delete cell.dataset.multiRow;
        delete cell.dataset.masterCell;
        delete cell.dataset.rowSpan;
        delete cell.dataset.minRow;
        delete cell.dataset.maxRow;
        
        // Explicitly remove all inline styles
        cell.removeAttribute('style');
        
        // Re-apply base styles
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'center';
    }
    
    // Reset top row cells
    if (topRowEl) {
        const topCells = topRowEl.children;
        for (let i = 0; i < topCells.length; i++) {
            const cell = topCells[i];
            cell.textContent = '';
            cell.className = 'top-cell';
            delete cell.dataset.symbolId;
            cell.style = '';
            cell.style.display = 'flex';
        }
    }
    
    // First pass: identify multi-row symbols and their positions
    const multiRowInfo = new Map();
    for (let row = 0; row < symbolGrid.mainGrid.length; row++) {
        for (let col = 0; col < symbolGrid.mainGrid[row].length; col++) {
            const symbolInstance = symbolGrid.mainGrid[row][col];
            if (symbolInstance && symbolInstance.id) {
                if (!multiRowInfo.has(symbolInstance.id)) {
                    multiRowInfo.set(symbolInstance.id, []);
                }
                multiRowInfo.get(symbolInstance.id).push({row, col});
            }
        }
    }
    
    // Debug: log ALL symbols with their IDs
    if (CONFIG.debug) {
        console.log('[renderSymbolGrid] All symbols in grid:');
        for (let col = 0; col < symbolGrid.mainGrid[0].length; col++) {
            const colSymbols = [];
            for (let row = 0; row < symbolGrid.mainGrid.length; row++) {
                const si = symbolGrid.mainGrid[row][col];
                if (si) {
                    colSymbols.push(`${si.symbol}(${si.id})`);
                } else {
                    colSymbols.push('null');
                }
            }
            console.log(`  Col ${col}: ${colSymbols.join(', ')}`);
        }
    }
    
    // Debug: log multi-row symbols
    if (CONFIG.debug) {
        console.log('[renderSymbolGrid] Multi-row detection:');
        multiRowInfo.forEach((positions, id) => {
            if (positions.length > 1) {
                const symbol = symbolGrid.mainGrid[positions[0].row][positions[0].col].symbol;
                console.log(`  ID ${id} (symbol ${symbol}): ${positions.length} cells - rows ${positions.map(p => p.row).join(',')} col ${positions[0].col}`);
            }
        });
    }
    
    // Second pass: render cells
    for (let row = 0; row < symbolGrid.mainGrid.length; row++) {
        for (let col = 0; col < symbolGrid.mainGrid[row].length; col++) {
            const index = row * CONFIG.cols + col;
            if (index >= cells.length) continue;
            
            const cell = cells[index];
            const symbolInstance = symbolGrid.mainGrid[row][col];
            
            if (!symbolInstance || !symbolInstance.id) {
                // Clear cell content for removed/null symbols
                cell.textContent = '';
                cell.className = 'grid-cell';
                delete cell.dataset.symbolId;
                delete cell.dataset.multiRow;
                delete cell.dataset.masterCell;
                cell.style = '';
                cell.style.display = 'flex';
                continue;
            }
            
            const emoji = getSymbolEmoji(symbolInstance);
            const positions = multiRowInfo.get(symbolInstance.id);
            const isMultiRow = positions && positions.length > 1;
            
            // Debug log for multi-row detection
            if (CONFIG.debug && isMultiRow && row === Math.min(...positions.map(p => p.row))) {
                console.log(`[renderSymbolGrid] Multi-row at col ${col}: ID ${symbolInstance.id}, symbol ${symbolInstance.symbol}, span ${positions.length} rows`);
            }
            
            if (isMultiRow) {
                // Calculate vertical span
                const minRow = Math.min(...positions.map(p => p.row));
                const maxRow = Math.max(...positions.map(p => p.row));
                const rowSpan = maxRow - minRow + 1;
                
                if (row === minRow) {
                    // This is the top cell - render as master with CSS Grid spanning
                    cell.textContent = emoji;
                    
                    // Apply frame styling
                    const frameClass = symbolInstance.frame ? `${symbolInstance.frame}-frame` : '';
                    cell.className = `grid-cell multi-row-master ${frameClass}`;
                    
                    cell.dataset.symbolId = symbolInstance.id;
                    cell.dataset.masterCell = 'true';
                    delete cell.dataset.multiRow;
                    
                    // Use CSS grid to span multiple rows
                    // grid-row: start-line / span count
                    cell.style.gridRow = `${minRow + 1} / span ${rowSpan}`;
                    cell.style.gridColumn = `${col + 1}`;
                    cell.style.display = 'flex';
                    
                    // Store span info for debugging
                    cell.dataset.rowSpan = String(rowSpan);
                    cell.dataset.minRow = String(minRow);
                    cell.dataset.maxRow = String(maxRow);
                } else {
                    // This is a continuation cell - hide it completely
                    cell.className = 'grid-cell multi-row-continuation';
                    cell.dataset.symbolId = symbolInstance.id;
                    cell.dataset.multiRow = 'true';
                    delete cell.dataset.masterCell;
                    cell.style.display = 'none';
                    // Reset grid placement
                    cell.style.gridRow = 'auto';
                    cell.style.gridColumn = 'auto';
                }
            } else {
                // Single row symbol - normal rendering
                cell.textContent = emoji;
                
                // Apply frame styling
                const frameClass = symbolInstance.frame ? `${symbolInstance.frame}-frame` : '';
                cell.className = `grid-cell ${frameClass}`;
                
                cell.dataset.symbolId = symbolInstance.id;
                cell.dataset.masterCell = 'true';
                delete cell.dataset.multiRow;
                
                // Set explicit grid position for single-row symbols too
                cell.style.gridRow = `${row + 1}`;
                cell.style.gridColumn = `${col + 1}`;
            }
        }
    }

    // Render top row if present
    if (symbolGrid.topRow && topRowEl) {
        const topCells = topRowEl.children;
        for (let col = 0; col < symbolGrid.topRow.length; col++) {
            if (col < topCells.length) {
                const cell = topCells[col];
                const symbolInstance = symbolGrid.topRow[col];
                const emoji = getSymbolEmoji(symbolInstance);
                cell.textContent = emoji;
                
                // Store symbol ID
                if (symbolInstance && symbolInstance.id) {
                    cell.dataset.symbolId = symbolInstance.id;
                } else {
                    delete cell.dataset.symbolId;
                }
            }
        }
    }
}

/**
 * Get emoji from SymbolInstance or symbol string
 */
function getSymbolEmoji(symbolInstance) {
    if (!symbolInstance) return '';
    if (typeof symbolInstance === 'string') {
        return symbolInstance === '' ? '' : (CONFIG.symbols[symbolInstance] || '❓');
    }
    const symbolId = String(symbolInstance.symbol || '');
    return symbolId === '' ? '' : (CONFIG.symbols[symbolId] || '❓');
}

// ==========================================
// CASCADE ANIMATION
// ==========================================

async function renderCascade(steps, finalGrid) {
    const cascadeInfo = document.getElementById('cascadeInfo');
    const cascadeStepEl = document.getElementById('cascadeStep');
    const cascadeHistory = document.getElementById('cascadeHistory');
    const cascadeStepsList = document.getElementById('cascadeStepsList');

    // Show cascade UI
    cascadeInfo.classList.remove('hidden');
    cascadeHistory.classList.remove('hidden');
    cascadeStepsList.innerHTML = '';

    console.log(`[renderCascade] ${steps.length} steps`);

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        cascadeStepEl.textContent = `${i + 1}/${steps.length}`;

        // Step 1: Show grid before win and highlight winning symbols
        if (step.symbolGridBefore) {
            renderSymbolGrid(step.symbolGridBefore, document.getElementById('mainGrid'), document.getElementById('topRow'));
            
            // Pretty print grid with winning symbols highlighted
            console.log('%c[Step ' + (i + 1) + ' BEFORE]', 'color: #ffd700; font-weight: bold;');
            prettyPrintGrid(step.symbolGridBefore, step.winningColumns, step.removedSymbols);
            
            // Highlight winning positions
            if (step.winningColumns) {
                const positions = [];
                step.winningColumns.forEach(win => {
                    if (win.positions) {
                        positions.push(...win.positions);
                    }
                });
                highlightWinningSymbols(positions);
            }
            await sleep(300);
        }
        // Step 2: Animate removal of winning symbols
        if (step.removedSymbols && step.removedSymbols.length > 0) {
            animateRemovals(step.removedSymbols);
            await sleep(300);
        }
        // Step 3: Show grid after removal (empty spaces visible)
        if (step.symbolGridAfterRemoval) {
            renderSymbolGrid(step.symbolGridAfterRemoval, document.getElementById('mainGrid'), document.getElementById('topRow'));
            console.log('%c[Step ' + (i + 1) + ' AFTER REMOVAL]', 'color: #ff6b6b; font-weight: bold;');
            prettyPrintGrid(step.symbolGridAfterRemoval, null, null);
            await sleep(200);
        }
        
        // Step 4: Animate movements (backend calculated)
        if (step.movements && step.movements.length > 0) {
            if (step.symbolGridAfterFill) {
                renderSymbolGrid(step.symbolGridAfterFill, document.getElementById('mainGrid'), document.getElementById('topRow'));
                applyMovementAnimations(step.movements);
                await sleep(500);
                clearAnimations();
            }
            
            console.log('%c[Step ' + (i + 1) + ' AFTER FILL]', 'color: #4ecdc4; font-weight: bold;');
            if (step.symbolGridAfterFill) {
                prettyPrintGrid(step.symbolGridAfterFill, null, null);
            }
        }

        // Add to cascade history
        const stepDiv = document.createElement('div');
        stepDiv.className = 'cascade-step-item';
        const stepWin = step.totalWin || 0;

        let winDetails = '';
        if (step.winningColumns && step.winningColumns.length > 0) {
            winDetails = '<div class="step-wins">';
            step.winningColumns.forEach(win => {
                const symbolEmoji = CONFIG.symbols[win.symbol] || '❓';
                winDetails += `<div>${symbolEmoji} ${win.consecutiveCols} cols × ${win.winRoad} ways = $${(win.payout * win.winRoad).toFixed(2)}</div>`;
            });
            winDetails += '</div>';
        }

        stepDiv.innerHTML = `
            <div class="step-header">
                <span class="step-number">Step ${i + 1}</span>
                <span class="step-win">+$${stepWin.toFixed(2)}</span>
            </div>
            ${winDetails}
        `;
        cascadeStepsList.appendChild(stepDiv);

        await sleep(300);
    }

    // Hide cascade info, show final grid
    cascadeInfo.classList.add('hidden');

    if (finalGrid) {
        if (finalGrid.mainGrid && finalGrid.mainGrid[0] && typeof finalGrid.mainGrid[0][0] === 'object') {
            // This is a SymbolGrid
            renderSymbolGrid(finalGrid, document.getElementById('mainGrid'), document.getElementById('topRow'));
        } else {
            // Simple grid fallback - not supported anymore
            console.warn('[renderCascade] finalGrid is not SymbolGrid, multi-row symbols may not render correctly');
        }
    }
}

/**
 * Apply movement animations using backend-calculated movements
 * Uses symbol IDs to track which cells animate
 */
function applyMovementAnimations(movements) {
    const mainGrid = document.getElementById('mainGrid');
    const topRow = document.getElementById('topRow');
    
    // Apply all animation classes at once
    movements.forEach(movement => {
        const isTopRow = movement.to.row === -1;
        
        if (isTopRow) {
            // Top row
            const topRowIndex = movement.to.col - 1; // convert actual col to top row index
            if (topRowIndex >= 0 && topRowIndex < topRow.children.length) {
                const cell = topRow.children[topRowIndex];
                
                if (movement.isNew) {
                    // New symbols slide in from right
                    cell.classList.add('slide-in-right');
                } else if (movement.from) {
                    // Existing symbols shift left
                    cell.classList.add('shift-left');
                }
                
                // Update symbol ID
                if (movement.symbolInstance && movement.symbolInstance.id) {
                    cell.dataset.symbolId = movement.symbolInstance.id;
                }
            }
        } else {
            // Main grid
            const index = movement.to.row * CONFIG.cols + movement.to.col;
            if (index < mainGrid.children.length) {
                const cell = mainGrid.children[index];
                
                if (movement.isNew) {
                    // New symbols: offset UP so they appear above the grid
                    // Then fall down to their final position
                    const cellHeight = cell.offsetHeight || 70;
                    const gap = 6;
                    const rowsAbove = movement.to.row + 1; // +1 because -1 is above row 0
                    const offsetY = -(rowsAbove * (cellHeight + gap));
                    
                    cell.style.setProperty('--fall-offset', `${offsetY}px`);
                    cell.classList.add('falling');
                } else if (movement.from) {
                    // Existing symbols: offset UP to their original position
                    // Then fall down to their final position
                    const rowDelta = movement.from.row - movement.to.row;
                    const cellHeight = cell.offsetHeight || 70;
                    const gap = 6;
                    const offsetY = rowDelta * (cellHeight + gap);
                    
                    cell.style.setProperty('--fall-offset', `${offsetY}px`);
                    cell.classList.add('falling');
                }
                
                // Update symbol ID
                if (movement.symbolInstance && movement.symbolInstance.id) {
                    cell.dataset.symbolId = movement.symbolInstance.id;
                }
            }
        }
    });
}

/**
 * Pretty print grid from backend response
 * Handles both SymbolGrid (with IDs) and simple grid (string[][])
 * Combines top row with main grid
 * Multi-row symbols are tagged with their span count
 * Winning symbols are tagged with letters (a, b, c) for different winning groups
 * Removed symbols are marked with X
 */
function prettyPrintGrid(gridData, winningColumns, removedSymbols) {
    if (!gridData || !gridData.mainGrid) {
        console.log('  [Empty grid]');
        return;
    }
    
    // Detect if this is a SymbolGrid (has objects with .id) or simple grid (strings)
    const isSymbolGrid = gridData.mainGrid[0][0] && typeof gridData.mainGrid[0][0] === 'object';
    
    // Build winning groups with letters
    const winningGroups = new Map(); // position -> group letter
    const groupLetters = ['a', 'b', 'c', 'd', 'e'];
    
    if (winningColumns) {
        winningColumns.forEach((win, index) => {
            const letter = groupLetters[index % groupLetters.length];
            if (win.positions) {
                win.positions.forEach(pos => {
                    winningGroups.set(pos.row + ',' + pos.col, letter);
                });
            }
        });
    }
    
    // Build removed positions set
    const removedPositions = new Set();
    if (removedSymbols) {
        removedSymbols.forEach(rs => {
            removedPositions.add(rs.row + ',' + rs.col);
        });
    }
    
    // First pass: identify multi-row symbols and their span
    // For SymbolGrid: use cell.id. For simple grid: use col+symbol key
    const multiRowInfo = new Map();
    for (let row = 0; row < gridData.mainGrid.length; row++) {
        for (let col = 0; col < gridData.mainGrid[row].length; col++) {
            const cell = gridData.mainGrid[row][col];
            if (cell) {
                if (isSymbolGrid) {
                    // SymbolGrid: use cell.id for grouping
                    if (cell.id) {
                        if (!multiRowInfo.has(cell.id)) {
                            multiRowInfo.set(cell.id, []);
                        }
                        multiRowInfo.get(cell.id).push({row, col});
                    }
                } else {
                    // Simple grid: use col+symbol key for grouping
                    const symbol = cell;
                    if (symbol !== '') {
                        const key = col + '-' + symbol;
                        if (!multiRowInfo.has(key)) {
                            multiRowInfo.set(key, []);
                        }
                        multiRowInfo.get(key).push(row);
                    }
                }
            }
        }
    }
    
    // Build span info for quick lookup
    const spanInfo = new Map();
    multiRowInfo.forEach((positions, key) => {
        if (isSymbolGrid) {
            // SymbolGrid: positions are {row, col} objects
            if (positions.length > 1) {
                const minRow = Math.min(...positions.map(p => p.row));
                const maxRow = Math.max(...positions.map(p => p.row));
                const span = maxRow - minRow + 1;
                positions.forEach(pos => {
                    spanInfo.set(pos.row + ',' + pos.col, span);
                });
            }
        } else {
            // Simple grid: positions are row numbers
            if (positions.length > 1) {
                // Check if rows are consecutive
                let consecutive = true;
                for (let i = 1; i < positions.length; i++) {
                    if (positions[i] !== positions[i-1] + 1) {
                        consecutive = false;
                        break;
                    }
                }
                if (consecutive) {
                    const col = parseInt(key.split('-')[0]);
                    const minRow = positions[0];
                    const maxRow = positions[positions.length - 1];
                    const span = maxRow - minRow + 1;
                    positions.forEach(row => {
                        spanInfo.set(row + ',' + col, span);
                    });
                }
            }
        }
    });
    
    // Calculate column widths
    const colWidths = [3, 3, 3, 3, 3, 3]; // Minimum width for symbol IDs
    
    // Check top row for max width
    if (gridData.topRow) {
        for (let col = 1; col <= 4; col++) {
            const topRowIndex = col - 1;
            if (topRowIndex < gridData.topRow.length) {
                const cell = gridData.topRow[topRowIndex];
                const symbolId = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                const groupLetter = winningGroups.get('-1,' + col) || '';
                const isRemoved = removedPositions.has('-1,' + col);
                let displayStr = symbolId;
                if (groupLetter) {
                    displayStr += groupLetter;
                }
                if (isRemoved) {
                    displayStr += 'X';
                }
                colWidths[col] = Math.max(colWidths[col], displayStr.length);
            }
        }
    }
    
    // Check main grid for max width
    for (let row = 0; row < gridData.mainGrid.length; row++) {
        for (let col = 0; col < gridData.mainGrid[row].length; col++) {
            const cell = gridData.mainGrid[row][col];
            const symbolId = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
            const span = spanInfo.get(row + ',' + col);
            const spanTag = span ? 'x' + span : '';
            const groupLetter = winningGroups.get(row + ',' + col) || '';
            const isRemoved = removedPositions.has(row + ',' + col);
            const frameTag = (cell && typeof cell === 'object' && cell.frame) ? cell.frame[0].toUpperCase() : '';
            let displayStr = symbolId + spanTag + frameTag;
            if (groupLetter) {
                displayStr += groupLetter;
            }
            if (isRemoved) {
                displayStr += 'X';
            }
            colWidths[col] = Math.max(colWidths[col], displayStr.length);
        }
    }
    
    // Build separator line
    const separator = '  +' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    
    console.log('  Combined Grid (Top Row + Main Grid):');
    console.log(separator);
    
    // Print top row first (row -1)
    if (gridData.topRow) {
        let topRowStr = ' -1 |';
        for (let col = 0; col < 6; col++) {
            let symbolId = '';
            let groupLetter = '';
            let isRemoved = false;
            let frameTag = '';
            
            if (col >= 1 && col <= 4) {
                const topRowIndex = col - 1;
                if (topRowIndex < gridData.topRow.length) {
                    const cell = gridData.topRow[topRowIndex];
                    if (cell && typeof cell === 'object') {
                        symbolId = cell.symbol || '';
                        frameTag = cell.frame ? cell.frame[0].toUpperCase() : '';
                    } else if (typeof cell === 'string') {
                        symbolId = cell;
                    }
                    groupLetter = winningGroups.get('-1,' + col) || '';
                    isRemoved = removedPositions.has('-1,' + col);
                }
            }
            
            let displayStr = symbolId + frameTag;
            if (groupLetter) {
                displayStr += groupLetter;
            }
            if (isRemoved) {
                displayStr += 'X';
            }
            const paddedStr = displayStr.padStart(colWidths[col], ' ').padEnd(colWidths[col], ' ');
            topRowStr += ' ' + paddedStr + ' |';
        }
        console.log(topRowStr);
        console.log(separator);
    }
    
    // Print main grid
    for (let row = 0; row < gridData.mainGrid.length; row++) {
        let rowStr = '  ' + row + ' |';
        for (let col = 0; col < gridData.mainGrid[row].length; col++) {
            const cell = gridData.mainGrid[row][col];
            const symbolId = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
            
            const span = spanInfo.get(row + ',' + col);
            const spanTag = span ? 'x' + span : '';
            const groupLetter = winningGroups.get(row + ',' + col) || '';
            const isRemoved = removedPositions.has(row + ',' + col);
            const frameTag = (cell && typeof cell === 'object' && cell.frame) ? cell.frame[0].toUpperCase() : '';
            
            let displayStr = symbolId + spanTag + frameTag;
            if (groupLetter) {
                displayStr += groupLetter;
            }
            if (isRemoved) {
                displayStr += 'X';
            }
            const paddedStr = displayStr.padStart(colWidths[col], ' ').padEnd(colWidths[col], ' ');
            rowStr += ' ' + paddedStr + ' |';
        }
        console.log(rowStr);
        if (row < gridData.mainGrid.length - 1) {
            console.log(separator);
        }
    }
    console.log(separator);
    
    // Print column indices
    let indexStr = '     |';
    for (let col = 0; col < 6; col++) {
        const paddedIndex = String(col).padStart(colWidths[col], ' ').padEnd(colWidths[col], ' ');
        indexStr += ' ' + paddedIndex + ' |';
    }
    console.log(indexStr);
}

function highlightWinningSymbols(positions) {
    if (!positions || positions.length === 0) return;

    const mainGrid = document.getElementById('mainGrid');
    const topRow = document.getElementById('topRow');
    
    positions.forEach(pos => {
        if (pos.row === -1) {
            // Top row
            const topRowIndex = pos.col - 1; // top row starts at col 1
            if (topRowIndex >= 0 && topRowIndex < topRow.children.length) {
                topRow.children[topRowIndex].classList.add('winning');
            }
        } else {
            // Main grid
            const index = pos.row * CONFIG.cols + pos.col;
            if (index < mainGrid.children.length) {
                mainGrid.children[index].classList.add('winning');
            }
        }
    });
}

/**
 * Animate removals using backend-calculated removedSymbols
 */
function animateRemovals(removedSymbols) {
    if (!removedSymbols || removedSymbols.length === 0) return;

    const mainGrid = document.getElementById('mainGrid');
    const topRow = document.getElementById('topRow');

    console.log('[animateRemovals]', removedSymbols.length, 'symbols');

    removedSymbols.forEach(rs => {
        if (rs.row === -1) {
            // Top row
            const topRowIndex = rs.col - 1;
            if (topRowIndex >= 0 && topRowIndex < topRow.children.length) {
                const cell = topRow.children[topRowIndex];
                cell.classList.remove('winning');
                cell.classList.add('removing');
            }
        } else {
            // Main grid
            const index = rs.row * CONFIG.cols + rs.col;
            if (index < mainGrid.children.length) {
                const cell = mainGrid.children[index];
                cell.classList.remove('winning');
                cell.classList.add('removing');
            }
        }
    });
}

function clearAnimations() {
    const mainGrid = document.getElementById('mainGrid');
    const topRow = document.getElementById('topRow');
    
    // Clear animation classes but preserve grid positioning
    for (let cell of mainGrid.children) {
        cell.classList.remove('winning', 'removing', 'falling', 'shifting');
        cell.style.removeProperty('--fall-offset');
        // Don't remove gridRow/gridColumn - they were set by renderSymbolGrid
    }
    
    for (let cell of topRow.children) {
        cell.classList.remove('winning', 'removing', 'falling', 'slide-in-right', 'shift-left');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function renderPaytable() {
    const container = document.getElementById('paytable');
    if (!container) return;

    container.innerHTML = '';

    Object.entries(CONFIG.symbolNames).forEach(([id, name]) => {
        const payouts = WIN_TABLE[id];
        if (!payouts) return;

        const item = document.createElement('div');
        item.className = 'paytable-item';

        const emoji = CONFIG.symbols[id] || '❓';
        // payouts format: [3x, 4x, 5x, 6x]
        const payoutText = payouts
            .map((value, index) => `${index + 3}x: ${value}x`)
            .join(', ');

        item.innerHTML = `
            <span class="paytable-symbol">${emoji}</span>
            <span class="paytable-value">${name}<br>${payoutText}</span>
        `;

        container.appendChild(item);
    });
}

function updateBalanceDisplay() {
    const el = document.getElementById('balance');
    if (el) {
        el.textContent = '$' + currentBalance.toFixed(2);
    }
}

function updateBetDisplay() {
    const el = document.getElementById('currentBet');
    if (el && BET_SIZE_LIST[CURRENT_BET_INDEX]) {
        el.textContent = '$' + BET_SIZE_LIST[CURRENT_BET_INDEX].toFixed(2);
    }
}

function updateServerModeDisplay() {
    const el = document.getElementById('serverMode');
    if (el) {
        el.textContent = CONFIG.serverMode === 'fake' ? '🔵 Fake Server' : '🌐 Real Server';
    }
}

function showWin(amount) {
    const display = document.getElementById('winDisplay');
    if (display) {
        display.textContent = `+${amount.toFixed(2)}`;
        display.classList.add('show');
        setTimeout(() => display.classList.remove('show'), 1500);
    }
}

// ==========================================
// CONTROLS
// ==========================================

let spinTimeout = null;

function spin() {
    if (isSpinning) {
        console.log('[Casishenwin] Spin ignored - already spinning');
        return;
    }
    if (!wsClient) return;

    isSpinning = true;
    const spinButton = document.getElementById('spinButton');
    if (spinButton) {
        spinButton.disabled = true;
        spinButton.classList.add('spinning');
    }

    // Failsafe: auto-unlock after 10 seconds if server doesn't respond
    spinTimeout = setTimeout(() => {
        if (isSpinning) {
            console.warn('[Casishenwin] Spin timeout - auto unlocking');
            isSpinning = false;
            if (spinButton) {
                spinButton.disabled = false;
                spinButton.classList.remove('spinning');
            }
        }
    }, 10000);

    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    
    wsClient.setBet({ bet });
}

function changeBet(direction) {
    if (isSpinning) return;

    CURRENT_BET_INDEX += direction;
    if (CURRENT_BET_INDEX < 0) CURRENT_BET_INDEX = 0;
    if (CURRENT_BET_INDEX >= BET_SIZE_LIST.length) CURRENT_BET_INDEX = BET_SIZE_LIST.length - 1;

    updateBetDisplay();
}