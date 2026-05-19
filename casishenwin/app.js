/**
 * Casishenwin Slot Game - Direct WebSocket Client
 * 6x5 grid with multi-row occupancy, top row rolling, and frame progression
 */

// Data from server (populated after SyncRoomInfo)
let SYMBOLS = {};
let WIN_TABLE = {};
let WIN_TABLE_DISPLAY = [];
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
        WIN_TABLE_DISPLAY = betInfo.winTableDisplay;
    }

    // Store bet sizes
    if (betInfo.betSizeList) {
        BET_SIZE_LIST = betInfo.betSizeList;
    }

    // Update UI
    renderPaytable();
    updateBetDisplay();
}

function handleSyncRoom(data) {
    if (data.balance != null) {
        currentBalance = data.balance;
        updateBalanceDisplay();
    }

    // Restore grid if available
    const lastResumeInfo = data.roomInfo?.lastResumeInfo;
    if (lastResumeInfo?.grid) {
        renderGrid(lastResumeInfo.grid);
    }
}

async function handleSpinResult(data) {
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;

    const gameResult = data.gameResult;
    if (!gameResult) return;

    const info = gameResult.info;
    if (!info) return;

    // Update balance
    currentBalance = gameResult.finalBalance || currentBalance;
    updateBalanceDisplay();

    // Show cascade animation if there are steps
    if (info.steps && info.steps.length > 0) {
        await renderCascade(info.steps, info.grid);
    } else {
        // No cascade - just render final grid
        if (info.grid) {
            renderGrid(info.grid);
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

function renderGrid(grid) {
    if (!grid) return;

    const mainGrid = document.getElementById('mainGrid');
    const topRow = document.getElementById('topRow');

    // Render main grid
    if (grid.mainGrid) {
        const cells = mainGrid.children;
        for (let row = 0; row < grid.mainGrid.length; row++) {
            for (let col = 0; col < grid.mainGrid[row].length; col++) {
                const index = row * CONFIG.cols + col;
                if (index < cells.length) {
                    const cell = cells[index];
                    const symbolId = String(grid.mainGrid[row][col]);
                    const emoji = CONFIG.symbols[symbolId] || '❓';
                    cell.textContent = emoji;
                    cell.className = 'grid-cell';

                    // Apply frame styling if present
                    if (grid.frames) {
                        const frame = grid.frames.find(f => f.row === row && f.col === col);
                        if (frame) {
                            cell.classList.add(frame.type === 'silver' ? 'silver-frame' : 'golden-frame');
                        }
                    }
                }
            }
        }
    }

    // Render top row
    if (grid.topRow) {
        const topCells = topRow.children;
        for (let col = 0; col < grid.topRow.length; col++) {
            if (col < topCells.length) {
                const cell = topCells[col];
                const symbolId = String(grid.topRow[col]);
                const emoji = CONFIG.symbols[symbolId] || '❓';
                cell.textContent = emoji;
            }
        }
    }
}

// Cascade Animation
async function renderCascade(steps, finalGrid) {
    const cascadeInfo = document.getElementById('cascadeInfo');
    const cascadeStepEl = document.getElementById('cascadeStep');
    const cascadeHistory = document.getElementById('cascadeHistory');
    const cascadeStepsList = document.getElementById('cascadeStepsList');

    // Show cascade UI
    cascadeInfo.classList.remove('hidden');
    cascadeHistory.classList.remove('hidden');
    cascadeStepsList.innerHTML = '';

    console.log(`[renderCascade] Starting cascade with ${steps.length} steps`);

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        cascadeStepEl.textContent = `${i + 1}/${steps.length}`;

        // Step 1: Show grid before win and highlight winning symbols
        if (step.gridBefore) {
            renderGrid(step.gridBefore);
            
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
            await sleep(800);
        }

        // Step 2: Animate removal of winning symbols
        if (step.winningColumns) {
            const positions = [];
            step.winningColumns.forEach(win => {
                if (win.positions) {
                    positions.push(...win.positions);
                }
            });
            animateRemoval(positions);
            await sleep(600);
        }

        // Step 3: Show grid after removal (if available)
        if (step.gridAfter) {
            renderGrid(step.gridAfter);
            await sleep(400);
        }

        // Step 4: Show final grid for this step
        if (step.gridAfter) {
            renderGrid(step.gridAfter);
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
        renderGrid(finalGrid);
    }
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

function animateRemoval(positions) {
    if (!positions || positions.length === 0) return;

    const mainGrid = document.getElementById('mainGrid');
    const topRow = document.getElementById('topRow');
    
    positions.forEach(pos => {
        if (pos.row === -1) {
            // Top row
            const topRowIndex = pos.col - 1;
            if (topRowIndex >= 0 && topRowIndex < topRow.children.length) {
                const cell = topRow.children[topRowIndex];
                cell.classList.remove('winning');
                cell.classList.add('removing');
            }
        } else {
            // Main grid
            const index = pos.row * CONFIG.cols + pos.col;
            if (index < mainGrid.children.length) {
                const cell = mainGrid.children[index];
                cell.classList.remove('winning');
                cell.classList.add('removing');
            }
        }
    });
}

async function animateMovements(movements) {
    const mainGrid = document.getElementById('mainGrid');

    movements.forEach(movement => {
        const index = movement.to.row * CONFIG.cols + movement.to.col;
        if (index < mainGrid.children.length) {
            const cell = mainGrid.children[index];
            cell.classList.add('falling');
        }
    });

    await sleep(500);

    // Remove falling animation
    for (let cell of mainGrid.children) {
        cell.classList.remove('falling');
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
        const payoutText = Object.entries(payouts)
            .map(([count, value]) => `${count}x: ${value}x`)
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

function spin() {
    if (isSpinning) return;
    if (!wsClient) return;

    isSpinning = true;
    document.getElementById('spinButton').disabled = true;

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
