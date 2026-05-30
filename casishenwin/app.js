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

// Debug options (can be set via console for testing)
let debugOptions = {
    forceTopAllWild: false,
    forceSilverFrame: false,
    forceScatterCount: null,  // null = random, 1-6 = force specific scatter count
    forceBonusRetrigger: false // true = force scatter count to 4, 5, or 6 for bonus retrigger testing
};

// Bonus gambling state
let bonusGamblingState = null;  // Set when 4+ scatters appear
let isInBonusGambling = false;
let isInBonus = false;
let bonusState = null;  // { freeSpinsRemaining, multiplier, totalWin }

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

        // Event: Spin result (now also handles gambling results)
        wsClient.on('setBet', (data) => {
            console.log('[Casishenwin] SetBet result:', data);
            handleSetBetResult(data);
        });

        // DEPRECATED: GambleForBonus is now handled through SetBet with action field
        // wsClient.on('gambleForBonus', ...) removed

        // Event: Sync room info (reconnect)
        wsClient.on('syncRoom', (data) => {
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
    if (!betInfo) {
        console.log(`[handleJoinRoom] No betInfo available, betInfo=${JSON.stringify(betInfo)}`)
        return;
    }
 
    // console.log(`betInfo: ${JSON.stringify(betInfo)}`)
    // Store symbols
    if (betInfo.symbols) {
        betInfo.symbols.forEach(sym => {
            SYMBOLS[sym.id] = sym;
        });
    }

    // Store win table
    if (betInfo.winTable) {
        WIN_TABLE = betInfo.winTable
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

function toggleDebugOption(option, checked) {
    debugOptions[option] = checked;
    updateDebugStatus();
    console.log('[Debug] Options:', debugOptions);
}

function setScatterCount(value) {
    debugOptions.forceScatterCount = value === '' ? null : parseInt(value);
    // Clamp to valid range: 1-6 (1-3 for base game, 4-6 for bonus retrigger)
    if (debugOptions.forceScatterCount != null) {
        if (debugOptions.forceScatterCount < 1) debugOptions.forceScatterCount = 1;
        if (debugOptions.forceScatterCount > 6) debugOptions.forceScatterCount = 6;
    }
    updateDebugStatus();
    console.log('[Debug] Scatter count:', debugOptions.forceScatterCount);
}

function updateDebugStatus() {
    const statusEl = document.getElementById('debugStatus');
    if (statusEl) {
        const active = [];
        if (debugOptions.forceTopAllWild) active.push('TopAllWild');
        if (debugOptions.forceSilverFrame) active.push('SilverFrame');
        if (debugOptions.forceScatterCount != null) active.push('Scatter:' + debugOptions.forceScatterCount);
        if (debugOptions.forceBonusRetrigger) active.push('BonusRetrigger');
        if (active.length > 0) {
            statusEl.textContent = 'Active: ' + active.join(', ');
            statusEl.classList.add('active');
        } else {
            statusEl.textContent = 'Random spins';
            statusEl.classList.remove('active');
        }
    }
}

function handleSyncRoom(data) {
    if (data.balance != null) {
        currentBalance = data.balance;
        updateBalanceDisplay();
    }

    // Restore grid/state from server's lastResumeInfo
    const lastResumeInfo = data.roomInfo?.lastResumeInfo;
    if (lastResumeInfo) {
        const spinType = lastResumeInfo.spinType;
        console.log(`[handleSyncRoom] Server resume info: spinType=${spinType}`);
        
        if (spinType === 'base' || spinType === 'bonus') {
            // Resume from SpinResult - restore the grid
            if (lastResumeInfo.grid) {
                const grid = lastResumeInfo.grid;
                if (grid.mainGrid && grid.mainGrid[0] && typeof grid.mainGrid[0][0] === 'object') {
                    renderSymbolGrid(grid, document.getElementById('mainGrid'), document.getElementById('topRow'));
                    console.log('[handleSyncRoom] Grid restored from server');
                }
            }
            
            // Restore bonus game state if present
            if (lastResumeInfo.bonusGameState) {
                isInBonus = true;
                bonusState = lastResumeInfo.bonusGameState;
                showBonusUI(bonusState);
                console.log('[handleSyncRoom] Bonus state restored from server');
            }
        } else if (spinType === 'bonusGambling') {
            // Resume from GambleResult - restore gambling state
            if (lastResumeInfo.bonusGambling) {
                isInBonusGambling = true;
                bonusGamblingState = lastResumeInfo.bonusGambling;
                showBonusGamblingUI(bonusGamblingState);
                console.log('[handleSyncRoom] Bonus gambling state restored from server');
            }
        }
    } else {
        console.log('[handleSyncRoom] No lastResumeInfo from server');
    }
}

async function handleSpinResult(betInfo) {
    isSpinning = false;
    // Clear timeout if it exists
    if (spinTimeout) {
        clearTimeout(spinTimeout);
        spinTimeout = null;
    }
    const gameResult = betInfo.gameResult
    const spinButton = document.getElementById('spinButton');
    if (spinButton) {
        spinButton.disabled = false;
        spinButton.classList.remove('spinning');
    }

    if (!gameResult) return;

    const info = gameResult.info;
    if (!info) return;

    // Update balance
    currentBalance = betInfo.finalBalance || currentBalance;
    updateBalanceDisplay();

    // Show TOP ALL WILD!!! message FIRST (before any animation)
    if (info.topAllWild) {
        await showTopAllWild();
    }

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

    // Show win amount and ways to win info
    const winAmount = gameResult.winAmount || 0;
    if (winAmount > 0) {
        showWin(winAmount);
    }

    // Calculate total ways to win from all steps
    let totalWaysToWin = 0;
    if (info.steps && info.steps.length > 0) {
        info.steps.forEach(step => {
            if (step.waysToWin && step.waysToWin > totalWaysToWin) {
                totalWaysToWin = step.waysToWin;
            }
        });
    }

    // Update win display with ways to win
    const waysDisplay = totalWaysToWin > 0 ? ` (${totalWaysToWin} ways)` : '';
    document.getElementById('winAmount').textContent = winAmount.toFixed(2) + waysDisplay;

    // --- BONUS SPIN RESULT: Server sends bonusGameState to separate bonus spins from normal spins ---
    // When bonusGameState is present, this is a bonus spin result (not a normal spin).
    // The server handles all bonus logic (retriggers, extra spins, multiplier application).
    // Frontend only renders the updated bonus state.
    if (gameResult.bonusGameState) {
        const bonus = gameResult.bonusGameState;
        console.log('[handleSpinResult] Bonus spin result:', bonus);
        
        // Enter bonus mode if not already
        if (!isInBonus) {
            isInBonus = true;
            bonusState = bonus;
            showBonusUI(bonus);
        } else {
            // Already in bonus — update state (server may have added retrigger spins)
            bonusState = bonus;
            updateBonusUI(bonusState);
        }
        
        // Show retrigger notification if server awarded extra spins this spin
        if (bonus.retriggerSpinsAwarded && bonus.retriggerSpinsAwarded > 0) {
            const winDisplay = document.getElementById('winDisplay');
            if (winDisplay) {
                winDisplay.textContent = `+${bonus.retriggerSpinsAwarded} FREE SPINS!`;
                winDisplay.classList.add('show', 'bonus-retrigger');
                setTimeout(() => winDisplay.classList.remove('show', 'bonus-retrigger'), 2000);
            }
        }
        
        // Bonus ended?
        if (bonus.freeSpinsRemaining <= 0) {
            console.log('[handleSpinResult] Bonus ended');
            isInBonus = false;
            bonusState = null;
            hideBonusUI();
        }
    }

    // Check for bonus gambling trigger (4+ scatters) — only outside bonus
    if (!isInBonus && gameResult.bonusGambling) {
        console.log('[handleSpinResult] Bonus gambling triggered!', gameResult.bonusGambling);
        bonusGamblingState = gameResult.bonusGambling;
        isInBonusGambling = true;
        showBonusGamblingUI(bonusGamblingState);
    }
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

        // Get ways to win for this step (from all symbols in grid)
        const waysToWin = step.waysToWin || 0;
        const waysDisplay = waysToWin > 0 ? ` <span class="ways-to-win">${waysToWin} ways</span>` : '';

        let winDetails = '';
        if (step.winningColumns && step.winningColumns.length > 0) {
            winDetails = '<div class="step-wins">';
            step.winningColumns.forEach(win => {
                const symbolEmoji = CONFIG.symbols[win.symbol] || '❓';
                const waysInfo = win.winRoad ? `<span class="ways">${win.winRoad} ways</span>` : '<span class="ways">0 ways</span>';
                winDetails += `<div class="win-line">${symbolEmoji} ${win.consecutiveCols} cols ${waysInfo} = $${(win.payout * win.winRoad).toFixed(2)}</div>`;
            });
            winDetails += '</div>';
        }

        stepDiv.innerHTML = `
            <div class="step-header">
                <span class="step-number">Step ${i + 1}</span>
                <span class="step-win">+$${stepWin.toFixed(2)}${waysDisplay}</span>
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
            const waysText = win.winRoad ? ` (${win.winRoad} ways)` : ' (0 ways)';
            console.log(`  ${letter.toUpperCase()}. ${win.symbol}: ${win.consecutiveCols} cols${waysText} × ${win.winRoad || 0} ways = payout ${win.payout}`);
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
            // Group by column first
            const colGroups = new Map();
            positions.forEach(pos => {
                if (!colGroups.has(pos.col)) {
                    colGroups.set(pos.col, []);
                }
                colGroups.get(pos.col).push(pos.row);
            });
            
            // For each column, find consecutive row spans
            colGroups.forEach((rows, col) => {
                // Sort rows
                rows.sort((a, b) => a - b);
                
                // Find consecutive groups
                let currentGroup = [rows[0]];
                for (let i = 1; i < rows.length; i++) {
                    if (rows[i] === rows[i - 1] + 1) {
                        currentGroup.push(rows[i]);
                    } else {
                        // Process current group
                        const span = currentGroup.length;
                        currentGroup.forEach(row => {
                            spanInfo.set(row + ',' + col, span);
                        });
                        // Start new group
                        currentGroup = [rows[i]];
                    }
                }
                // Process last group
                const span = currentGroup.length;
                currentGroup.forEach(row => {
                    spanInfo.set(row + ',' + col, span);
                });
            });
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
    
    // Calculate column widths (now includes ID)
    const colWidths = [10, 10, 10, 10, 10, 10]; // Minimum width for symbol+id
    
    // Check top row for max width
    if (gridData.topRow) {
        for (let col = 1; col <= 4; col++) {
            const topRowIndex = col - 1;
            if (topRowIndex < gridData.topRow.length) {
                const cell = gridData.topRow[topRowIndex];
                const symbol = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
                const id = (cell && typeof cell === 'object' && cell.id) ? cell.id : '';
                const shortId = id ? id.slice(-4) : ''; // Last 4 chars of ID
                const groupLetter = winningGroups.get('-1,' + col) || '';
                const isRemoved = removedPositions.has('-1,' + col);
                let displayStr = symbol + (shortId ? ':' + shortId : '');
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
            const symbol = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
            const id = (cell && typeof cell === 'object' && cell.id) ? cell.id : '';
            const shortId = id ? id.slice(-4) : '';
            const span = spanInfo.get(row + ',' + col);
            const spanTag = span ? 'x' + span : '';
            const groupLetter = winningGroups.get(row + ',' + col) || '';
            const isRemoved = removedPositions.has(row + ',' + col);
            const frameTag = (cell && typeof cell === 'object' && cell.frame) ? cell.frame[0].toUpperCase() : '';
            let displayStr = symbol + (shortId ? ':' + shortId : '') + spanTag + frameTag;
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
            let symbol = '';
            let shortId = '';
            let groupLetter = '';
            let isRemoved = false;
            let frameTag = '';
            
            if (col >= 1 && col <= 4) {
                const topRowIndex = col - 1;
                if (topRowIndex < gridData.topRow.length) {
                    const cell = gridData.topRow[topRowIndex];
                    if (cell && typeof cell === 'object') {
                        symbol = cell.symbol || '';
                        shortId = cell.id ? cell.id.slice(-4) : '';
                        frameTag = cell.frame ? cell.frame[0].toUpperCase() : '';
                    } else if (typeof cell === 'string') {
                        symbol = cell;
                    }
                    groupLetter = winningGroups.get('-1,' + col) || '';
                    isRemoved = removedPositions.has('-1,' + col);
                }
            }
            
            let displayStr = symbol + (shortId ? ':' + shortId : '') + frameTag;
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
            const symbol = (cell && typeof cell === 'object') ? (cell.symbol || '') : (cell || '');
            const shortId = (cell && typeof cell === 'object' && cell.id) ? cell.id.slice(-4) : '';
            
            const span = spanInfo.get(row + ',' + col);
            const spanTag = span ? 'x' + span : '';
            const groupLetter = winningGroups.get(row + ',' + col) || '';
            const isRemoved = removedPositions.has(row + ',' + col);
            const frameTag = (cell && typeof cell === 'object' && cell.frame) ? cell.frame[0].toUpperCase() : '';
            
            let displayStr = symbol + (shortId ? ':' + shortId : '') + spanTag + frameTag;
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

function showTopAllWild() {
    return new Promise((resolve) => {
        const display = document.getElementById('winDisplay');
        if (display) {
            display.textContent = 'TOP ALL WILD!!!';
            display.classList.add('show', 'top-all-wild');
            setTimeout(() => {
                display.classList.remove('show', 'top-all-wild');
                resolve();
            }, 2000);
        } else {
            resolve();
        }
    });
}

// ==========================================
// BONUS GAMBLING UI
// ==========================================

function showBonusGamblingUI(state) {
    // Hide normal controls
    const controls = document.querySelector('.controls');
    if (controls) controls.classList.add('hidden');

    // Create or show bonus gambling panel
    let panel = document.getElementById('bonusGamblingPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'bonusGamblingPanel';
        panel.className = 'bonus-gambling-panel';
        document.body.appendChild(panel);
    }
    panel.classList.remove('hidden');

    updateBonusGamblingUI(state);
}

function updateBonusGamblingUI(state) {
    const panel = document.getElementById('bonusGamblingPanel');
    if (!panel) return;

    const freeSpinsValues = state.freeSpinValues || [8, 10, 12, 14, 16];
    const multiplierValues = state.multiplierValues || [18, 20, 22, 24];
    const currentFreeSpinIndex = state.freeSpinIndex || 0;
    const currentMultiplierIndex = state.multiplierIndex || 0;

    // Build free spins display
    const freeSpinsHtml = freeSpinsValues.map((val, idx) => {
        const isCurrent = idx === currentFreeSpinIndex;
        const isPast = idx < currentFreeSpinIndex;
        const isFuture = idx > currentFreeSpinIndex;
        let className = 'gamble-value';
        if (isCurrent) className += ' current';
        if (isPast) className += ' past';
        if (isFuture) className += ' future';
        return `<span class="${className}">${val}</span>`;
    }).join(' → ');

    // Build multiplier display
    const multiplierHtml = multiplierValues.map((val, idx) => {
        const isCurrent = idx === currentMultiplierIndex;
        const isPast = idx < currentMultiplierIndex;
        const isFuture = idx > currentMultiplierIndex;
        let className = 'gamble-value';
        if (isCurrent) className += ' current';
        if (isPast) className += ' past';
        if (isFuture) className += ' future';
        return `<span class="${className}">${val}x</span>`;
    }).join(' → ');

    panel.innerHTML = `
        <div class="bonus-gambling-title">🎰 BONUS GAMBLE</div>
        <div class="bonus-gambling-subtitle">4+ Scatters! Gamble for bigger bonus!</div>
        
        <div class="gamble-track">
            <div class="gamble-label">Free Spins:</div>
            <div class="gamble-values">${freeSpinsHtml}</div>
            ${state.canGambleFreeSpin ? `<button class="gamble-btn" onclick="gambleFor('freeSpin')">🎲 Gamble for More Spins</button>` : '<div class="max-reached">MAX REACHED</div>'}
        </div>
        
        <div class="gamble-track">
            <div class="gamble-label">Multiplier:</div>
            <div class="gamble-values">${multiplierHtml}</div>
            ${state.canGambleMultiplier ? `<button class="gamble-btn" onclick="gambleFor('multiplier')">🎲 Gamble for Higher Multiplier</button>` : '<div class="max-reached">MAX REACHED</div>'}
        </div>
        
        <div class="current-values">
            Current: <span class="highlight">${state.currentFreeSpins || 8} Free Spins</span> @ <span class="highlight">${state.currentMultiplier || 18}x Multiplier</span>
        </div>
        
        <button class="enter-bonus-btn" onclick="handleBonusGambling()">✅ ENTER BONUS</button>
        
        <div id="gambleResult" class="gamble-result"></div>
    `;
}

function hideBonusGamblingUI() {
    const panel = document.getElementById('bonusGamblingPanel');
    if (panel) panel.classList.add('hidden');
    
    const controls = document.querySelector('.controls');
    if (controls) controls.classList.remove('hidden');
}

async function gambleFor(action) {
    if (!wsClient || !bonusGamblingState) return;
    
    console.log('[gambleFor] Gambling for:', action);
    
    // Send through SetBet with action field — backend handles gambling
    wsClient.setBet({ bet: 0, action: action });
}

async function handleBonusGambling() {
    if (!wsClient || !bonusGamblingState) return;
    
    console.log('[handleBonusGambling] Entering bonus with:', bonusGamblingState.currentFreeSpins, 'spins @', bonusGamblingState.currentMultiplier + 'x');
    
    // Send SetBet with action='enter' — backend handles bonus entry
    wsClient.setBet({ bet: 0, action: 'enter' });
}

async function handleSetBetResult(data) {
    const betInfo = data.betInfo[0];
    if (!betInfo) {
        console.log(`[handleSetBetResult] No gameResult in data:`)
        return;
    }

    const info = betInfo.gameResult.info;
    // A gambling ACTION response has gambleAction field (freeSpin, multiplier, enter)
    // A base spin that triggered gambling has gameState='gambling' but NO gambleAction
    const isGamblingAction = info && info.gambleAction != null;

    if (isGamblingAction) {
        // Handle gambling action result (freeSpin, multiplier, enter)
        handleGamblingResult(betInfo.gameResult);
        return;
    }

    // Regular spin result — handleSpinResult will detect bonusGambling trigger
    await handleSpinResult(betInfo);
}

async function handleGamblingResult(gameResult) {
    const info = gameResult.info;
    const action = info.gambleAction;
    // bonusGambling is in info (the SpinResult), not gameResult.bonusGambling
    const bonusGambling = info.bonusGambling;

    console.log('[handleGamblingResult] action=' + action, 'bonusGambling=', bonusGambling);

    // Handle entering bonus (action='enter' or gameState='bonus')
    if (action === 'enter' || info.gameState === 'bonus') {
        hideBonusGamblingUI();
        isInBonusGambling = false;
        isInBonus = true;
        bonusGamblingState = null;
        bonusState = gameResult.bonusGameState || {
            freeSpinsRemaining: info.currentFreeSpins || 8,
            multiplier: info.currentMultiplier || 18,
            totalWin: 0
        };
        showBonusUI(bonusState);
        return;
    }

    // Handle gamble lost (no bonusGambling and gameState is normal)
    if (bonusGambling == null && info.gameState === 'normal') {
        const resultEl = document.getElementById('gambleResult');
        if (resultEl) {
            resultEl.innerHTML = `<div class="gamble-lost">❌ Gamble lost! Bonus forfeited.</div>`;
        }
        hideBonusGamblingUI();
        isInBonusGambling = false;
        bonusGamblingState = null;
        return;
    }

    // Gamble won — update state immediately
    const resultEl = document.getElementById('gambleResult');
    if (resultEl) {
        resultEl.innerHTML = `<div class="gamble-won">✅ Gamble successful!</div>`;
    }

    // Update gambling state from info (SpinResult)
    bonusGamblingState = bonusGambling;
    updateBonusGamblingUI(bonusGamblingState);
}


function showBonusUI(state) {
    let panel = document.getElementById('bonusPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'bonusPanel';
        panel.className = 'bonus-panel';
        document.body.appendChild(panel);
    }
    panel.classList.remove('hidden');
    
    panel.innerHTML = `
        <div class="bonus-title">🎰 FREE SPINS</div>
        <div class="bonus-info">
            <div><span class="bonus-value">${state.freeSpinsRemaining}</span> Spins Remaining</div>
            <div><span class="bonus-value">${state.multiplier}x</span> Multiplier</div>
        </div>
        <div class="bonus-total">Total Win: <span class="bonus-win">$${state.totalWin.toFixed(2)}</span></div>
    `;
}

function hideBonusUI() {
    const panel = document.getElementById('bonusPanel');
    if (panel) panel.classList.add('hidden');
}

function updateBonusUI(state) {
    const panel = document.getElementById('bonusPanel');
    if (!panel) return;
    
    const infoEl = panel.querySelector('.bonus-info');
    if (infoEl) {
        infoEl.innerHTML = `
            <div><span class="bonus-value">${state.freeSpinsRemaining}</span> Spins Remaining</div>
            <div><span class="bonus-value">${state.multiplier}x</span> Multiplier</div>
        `;
    }
    
    const totalEl = panel.querySelector('.bonus-total');
    if (totalEl) {
        totalEl.innerHTML = `Total Win: <span class="bonus-win">$${state.totalWin.toFixed(2)}</span>`;
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
    
    // Include debug options if any are enabled
    const spinPayload = { bet };
    if (debugOptions.forceTopAllWild || debugOptions.forceSilverFrame || debugOptions.forceScatterCount != null || debugOptions.forceBonusRetrigger) {
        if (debugOptions.forceTopAllWild) spinPayload.forceTopAllWild = true;
        if (debugOptions.forceSilverFrame) spinPayload.forceSilverFrame = true;
        if (debugOptions.forceScatterCount != null) spinPayload.forceScatterCount = debugOptions.forceScatterCount;
        if (debugOptions.forceBonusRetrigger) spinPayload.forceBonusRetrigger = true;
    }
    console.log(`spinPayload = ${JSON.stringify(spinPayload)}`)
    wsClient.setBet(spinPayload);
}

function changeBet(direction) {
    if (isSpinning) return;

    CURRENT_BET_INDEX += direction;
    if (CURRENT_BET_INDEX < 0) CURRENT_BET_INDEX = 0;
    if (CURRENT_BET_INDEX >= BET_SIZE_LIST.length) CURRENT_BET_INDEX = BET_SIZE_LIST.length - 1;

    updateBetDisplay();
}