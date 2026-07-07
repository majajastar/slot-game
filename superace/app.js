/**
 * Super Ace Slot Game - Frontend Client
 * 5x4 grid, no gravity cascade, Golden Card, Joker, Combo Multiplier
 */

// Data from server (populated after SyncRoomInfo)
let SYMBOLS = {};
let WIN_TABLE = {};
let BET_SIZE_LIST = [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00];
let CURRENT_BET_INDEX = 2;

// Game state
let wsClient = null;
let isSpinning = false;
let currentBalance = 0;

// Debug options
let debugOptions = {
    forceScatterCount: null,
    forceGoldenCard: false
};

// Bonus state
let isInBonus = false;
let bonusState = null;

// Combo multiplier display
let currentComboMultiplier = 1;

// Combo levels from server (populated on each spin)
let comboLevels = [1, 2, 3, 5];
let currentComboIndex = 0;

let spinTimeout = null;

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

        wsClient.on('login', (data) => {
            console.log('[SuperAce] Login success:', data);
            const loginData = data.vals?.data || data;
            currentBalance = loginData.balance || 0;
            updateBalanceDisplay();
            statusEl.textContent = '🟢 Connected';
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('gameContent').classList.remove('hidden');
        });

        wsClient.on('joinRoom', (data) => {
            console.log('[SuperAce] Join room:', data);
            handleJoinRoom(data);
        });

        wsClient.on('setBet', (data) => {
            console.log('[SuperAce] SetBet result:', data);
            handleSetBetResult(data);
        });

        wsClient.on('syncRoom', (data) => {
            console.log('[SuperAce] Sync room:', data);
            handleSyncRoom(data);
        });

        wsClient.on('getRecords', (data) => {
            console.log('[SuperAce] Records:', data);
        });

        wsClient.on('error', (error) => {
            console.error('[SuperAce] WebSocket error:', error);
            statusEl.textContent = '🔴 Error';
        });

        wsClient.on('close', () => {
            console.log('[SuperAce] WebSocket closed');
            statusEl.textContent = '🔴 Disconnected';
        });

        await wsClient.connect();

    } catch (error) {
        console.error('[SuperAce] Connection failed:', error);
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
        console.log('[handleJoinRoom] No betInfo available');
        return;
    }

    if (betInfo.symbols) {
        betInfo.symbols.forEach(sym => {
            SYMBOLS[sym.id] = sym;
        });
    }

    if (betInfo.winTable) {
        WIN_TABLE = betInfo.winTable;
    }

    if (betInfo.betSizeList) {
        BET_SIZE_LIST = betInfo.betSizeList;
    }

    if (betInfo.buyBonus) {
        BUY_BONUS = betInfo.buyBonus;
        updateBuyBonusButton();
    }

    renderPaytable();
    updateBetDisplay();
}

function updateBuyBonusButton() {
    const buyButton = document.getElementById('buyBonusButton');
    if (!buyButton) return;

    if (BUY_BONUS.enabled) {
        buyButton.classList.remove('hidden');
        buyButton.textContent = `💎 BUY BONUS (${BUY_BONUS.priceMultiplier}x)`;
    } else {
        buyButton.classList.add('hidden');
    }
}

function toggleDebugOption(option, value) {
    if (option === 'forceScatterCount') {
        debugOptions.forceScatterCount = value === '' || value === null ? null : parseInt(value);
        if (debugOptions.forceScatterCount != null) {
            if (debugOptions.forceScatterCount < 1) debugOptions.forceScatterCount = 1;
            if (debugOptions.forceScatterCount > 5) debugOptions.forceScatterCount = 5;
        }
    } else {
        debugOptions[option] = value;
    }
    updateDebugStatus();
    console.log('[Debug] Options:', debugOptions);
}

function updateDebugStatus() {
    const statusEl = document.getElementById('debugStatus');
    if (statusEl) {
        const active = [];
        if (debugOptions.forceGoldenCard) active.push('GoldenCard');
        if (debugOptions.forceScatterCount != null) active.push('Scatter:' + debugOptions.forceScatterCount);
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

    const lastResumeInfo = data.roomInfo?.lastResumeInfo;
    if (lastResumeInfo) {
        const spinType = lastResumeInfo.spinType;
        console.log(`[handleSyncRoom] Server resume info: spinType=${spinType}`);

        if (lastResumeInfo.symbolGrid) {
            const symbolGrid = lastResumeInfo.symbolGrid;
            if (symbolGrid.mainGrid && symbolGrid.mainGrid[0]) {
                renderSymbolGrid(symbolGrid, document.getElementById('mainGrid'));
            }
        }

        if (lastResumeInfo.bonusGameState && lastResumeInfo.bonusGameState.freeSpinsRemaining > 0) {
            isInBonus = true;
            bonusState = lastResumeInfo.bonusGameState;
            showBonusUI(bonusState);
        }
    }
}

async function handleSetBetResult(data) {
    const betInfo = data.betInfo?.[0];
    if (!betInfo) {
        console.log('[handleSetBetResult] No betInfo in data');
        return;
    }

    await handleSpinResult(betInfo);
}

async function handleSpinResult(betInfo) {
    isSpinning = false;
    if (spinTimeout) {
        clearTimeout(spinTimeout);
        spinTimeout = null;
    }

    const spinButton = document.getElementById('spinButton');
    const buyButton = document.getElementById('buyBonusButton');
    if (spinButton) {
        spinButton.disabled = false;
        spinButton.classList.remove('spinning');
    }
    if (buyButton) {
        buyButton.disabled = false;
    }

    const gameResult = betInfo.gameResult;
    if (!gameResult) return;

    const info = gameResult.info;
    if (!info) return;

    // Update balance
    currentBalance = betInfo.finalBalance || currentBalance;
    updateBalanceDisplay();

    // Reset combo multiplier display
    currentComboMultiplier = 1;
    updateComboMultiplierDisplay(1);

    // Get combo levels and final index from server response
    if (info.comboLevels && Array.isArray(info.comboLevels)) {
        comboLevels = info.comboLevels;
        currentComboIndex = info.finalComboIndex || 0;
        updateComboLevelsDisplay(comboLevels, -1); // Reset to no active during spin
    } else {
        // Fallback: use config defaults
        comboLevels = CONFIG.comboLevels || [1, 2, 3, 5];
        currentComboIndex = 0;
        updateComboLevelsDisplay(comboLevels, -1);
    }

    // Show cascade animation if there are steps
    if (info.steps && info.steps.length > 0) {
        await renderCascade(info.steps, info.symbolGrid || info.grid);
    } else {
        if (info.symbolGrid) {
            renderSymbolGrid(info.symbolGrid, document.getElementById('mainGrid'));
        }
    }

    // Show win amount
    const winAmount = gameResult.winAmount || 0;
    if (winAmount > 0) {
        showWin(winAmount);
    }

    // Calculate total ways to win
    let totalWaysToWin = 0;
    if (info.steps && info.steps.length > 0) {
        info.steps.forEach(step => {
            if (step.waysToWin && step.waysToWin > totalWaysToWin) {
                totalWaysToWin = step.waysToWin;
            }
        });
    } else if (info.waysToWin > 0) {
        totalWaysToWin = info.waysToWin;
    }

    const waysDisplay = totalWaysToWin > 0 ? ` (${totalWaysToWin} ways)` : '';
    document.getElementById('winAmount').textContent = winAmount.toFixed(2) + waysDisplay;

    // Clear bonus panel for normal spins
    if (!isInBonus && !info.bonusGameState) {
        hideBonusUI();
    }

    // Bonus spin result
    if (info.bonusGameState) {
        const bonus = info.bonusGameState;
        console.log('[handleSpinResult] Bonus spin result:', bonus);

        if (!isInBonus) {
            isInBonus = true;
            bonusState = bonus;
            showBonusUI(bonus);
        } else {
            bonusState = bonus;
            updateBonusUI(bonusState);
        }

        if (bonus.retriggerSpinsAwarded && bonus.retriggerSpinsAwarded > 0) {
            const winDisplay = document.getElementById('winDisplay');
            if (winDisplay) {
                winDisplay.textContent = `+${bonus.retriggerSpinsAwarded} FREE SPINS!`;
                winDisplay.classList.add('show', 'bonus-retrigger');
                setTimeout(() => winDisplay.classList.remove('show', 'bonus-retrigger'), 2000);
            }
        }

        if (bonus.freeSpinsRemaining <= 0) {
            console.log('[handleSpinResult] Bonus ended');
            isInBonus = false;
            bonusState = null;
            hideBonusUI();
        }
    }
}

// ==========================================
// COMBO MULTIPLIER DISPLAY
// ==========================================

function updateComboLevelsDisplay(levels, activeIndex) {
    const container = document.getElementById('comboLevels');
    const list = document.getElementById('comboLevelsList');
    if (!container || !list) return;

    if (!levels || levels.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    list.innerHTML = '';

    levels.forEach((level, index) => {
        const item = document.createElement('div');
        item.className = 'combo-level-item';
        item.textContent = `x${level}`;

        if (index < activeIndex) {
            item.classList.add('reached');
        } else if (index === activeIndex) {
            item.classList.add('active');
        }

        list.appendChild(item);
    });
}

function updateComboMultiplierDisplay(multiplier) {
    const el = document.getElementById('comboMultiplier');
    if (!el) return;

    if (multiplier <= 1) {
        el.classList.add('hidden');
        return;
    }

    el.textContent = `x${multiplier}`;
    el.classList.remove('hidden');
    el.classList.remove('level-1', 'level-2', 'level-3', 'level-5');

    if (multiplier === 2) el.classList.add('level-2');
    else if (multiplier === 3) el.classList.add('level-3');
    else if (multiplier >= 5) el.classList.add('level-5');
    else el.classList.add('level-1');
}

// ==========================================
// GRID RENDERING
// ==========================================

function initGrid() {
    const mainGrid = document.getElementById('mainGrid');
    mainGrid.innerHTML = '';

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
}

function renderSymbolGrid(symbolGrid, mainGridEl) {
    if (!symbolGrid || !symbolGrid.mainGrid) return;

    const cells = mainGridEl.children;

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        cell.textContent = '';
        cell.className = 'grid-cell';
        delete cell.dataset.symbolId;
    }

    for (let row = 0; row < symbolGrid.mainGrid.length; row++) {
        for (let col = 0; col < symbolGrid.mainGrid[row].length; col++) {
            const index = row * CONFIG.cols + col;
            if (index >= cells.length) continue;

            const cell = cells[index];
            const symbolInstance = symbolGrid.mainGrid[row][col];

            if (!symbolInstance || !symbolInstance.symbol) {
                cell.classList.add('empty');
                continue;
            }

            const emoji = getSymbolEmoji(symbolInstance);
            cell.textContent = emoji;
            cell.dataset.symbolId = symbolInstance.id || `${row}-${col}`;

            const symbol = symbolInstance.symbol;
            if (symbol === '1') {
                // WILD - check jokerType for styling
                if (symbolInstance.jokerType === 'big') cell.classList.add('big-joker-symbol');
                else if (symbolInstance.jokerType === 'little') cell.classList.add('little-joker-symbol');
                else cell.classList.add('wild-symbol');
            }
            else if (symbol === '2') cell.classList.add('scatter-symbol');
            // Golden is an attribute, not a symbol
            if (symbolInstance.isGolden) cell.classList.add('golden-symbol');
        }
    }
}

function getSymbolEmoji(symbolInstance) {
    if (!symbolInstance) return '';
    if (typeof symbolInstance === 'string') {
        return symbolInstance === '' ? '' : (CONFIG.symbols[symbolInstance] || '❓');
    }
    const symbolId = String(symbolInstance.symbol || '');
    if (symbolId === '') return '';
    const baseEmoji = CONFIG.symbols[symbolId] || '❓';
    // WILD with jokerType shows the joker type emoji
    if (symbolId === '1' && symbolInstance.jokerType) {
        return CONFIG.jokerTypeEmojis[symbolInstance.jokerType] || '🃏';
    }
    // Golden is an attribute - show a golden indicator alongside the symbol
    if (symbolInstance.isGolden) {
        return baseEmoji + '✨';
    }
    return baseEmoji;
}

// ==========================================
// CASCADE ANIMATION (No Gravity)
// ==========================================

async function renderCascade(steps, finalGrid) {
    const cascadeInfo = document.getElementById('cascadeInfo');
    const cascadeStepEl = document.getElementById('cascadeStep');
    const cascadeHistory = document.getElementById('cascadeHistory');
    const cascadeStepsList = document.getElementById('cascadeStepsList');

    cascadeInfo.classList.remove('hidden');
    cascadeHistory.classList.remove('hidden');
    cascadeStepsList.innerHTML = '';

    console.log(`%c[renderCascade] ${steps.length} steps`, 'color: #ffd700; font-size: 14px; font-weight: bold;');

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        cascadeStepEl.textContent = `${i + 1}/${steps.length}`;

        // Pretty print this step to console
        prettyPrintStep(step, i + 1);

        if (step.comboMultiplier && step.comboMultiplier > 1) {
            currentComboMultiplier = step.comboMultiplier;
            updateComboMultiplierDisplay(step.comboMultiplier);

            // Find the index of this combo multiplier in the levels array
            const stepIndex = comboLevels.findIndex(l => l === step.comboMultiplier);
            if (stepIndex >= 0) {
                updateComboLevelsDisplay(comboLevels, stepIndex);
            }
        }

        // Show grid before win
        if (step.symbolGridBefore) {
            renderSymbolGrid(step.symbolGridBefore, document.getElementById('mainGrid'));
            if (step.winningColumns) {
                const positions = [];
                step.winningColumns.forEach(win => {
                    if (win.positions) positions.push(...win.positions);
                });
                highlightWinningSymbols(positions);
            }
            await sleep(400);
        }

        // Animate removals (symbols changing)
        if (step.removedSymbols && step.removedSymbols.length > 0) {
            animateSymbolChanges(step.removedSymbols);
            await sleep(400);
        }

        // Show grid after change
        if (step.symbolGridAfterRemoval) {
            renderSymbolGrid(step.symbolGridAfterRemoval, document.getElementById('mainGrid'));
            await sleep(300);
        }

        // Show final grid for this step
        if (step.symbolGridAfterFill) {
            renderSymbolGrid(step.symbolGridAfterFill, document.getElementById('mainGrid'));
            await sleep(400);
            clearAnimations();
        }

        // Add to cascade history
        const stepDiv = document.createElement('div');
        stepDiv.className = 'cascade-step-item';
        const stepWin = step.totalWin || 0;
        const waysToWin = step.waysToWin || 0;
        const waysDisplay = waysToWin > 0 ? ` <span class="ways-to-win">${waysToWin} ways</span>` : '';
        const comboDisplay = step.comboMultiplier > 1 ? ` <span class="step-combo">(x${step.comboMultiplier})</span>` : '';

        let changeDetails = '';
        if (step.removedSymbols && step.removedSymbols.length > 0) {
            changeDetails = '<div class="step-changes">';
            step.removedSymbols.forEach(rs => {
                const oldEmoji = CONFIG.symbols[rs.symbol] || '❓';
                const newEmoji = rs.changedTo ? (CONFIG.symbols[rs.changedTo] || '❓') : '✨';
                changeDetails += `<div class="change-line">${oldEmoji} → ${newEmoji} @(${rs.row},${rs.col})</div>`;
            });
            changeDetails += '</div>';
        }

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
                <span class="step-win">+$${stepWin.toFixed(2)}${waysDisplay}${comboDisplay}</span>
            </div>
            ${winDetails}
            ${changeDetails}
        `;
        cascadeStepsList.appendChild(stepDiv);

        await sleep(300);
    }

    cascadeInfo.classList.add('hidden');

    if (finalGrid) {
        renderSymbolGrid(finalGrid, document.getElementById('mainGrid'));
    }
}

// ==========================================
// PRETTY PRINT CASCADE STEP (Console)
// ==========================================

function prettyPrintStep(step, stepNum) {
    console.log(`%c\n========== CASCADE STEP ${stepNum} ==========`, 'color: #ffd700; font-size: 16px; font-weight: bold;');

    // Print grid before
    console.log('%c[BEFORE]', 'color: #4ecdc4; font-weight: bold;');
    printGrid(step.symbolGridBefore);

    // Print winning info
    if (step.winningColumns && step.winningColumns.length > 0) {
        console.log('%c[WINS]', 'color: #ffd700; font-weight: bold;');
        step.winningColumns.forEach((win, idx) => {
            const emoji = CONFIG.symbols[win.symbol] || win.symbol;
            console.log(`  ${String(idx + 1).padStart(2, ' ')}. ${emoji} sym=${String(win.symbol).padStart(3, ' ')} | ${String(win.consecutiveCols).padStart(2, ' ')} cols | ${String(win.winRoad).padStart(4, ' ')} ways | payout=${String(win.payout).padStart(4, ' ')} | total=${String(win.totalWin).padStart(6, ' ')}`);
        });
    }

    // Print symbol changes
    if (step.removedSymbols && step.removedSymbols.length > 0) {
        console.log('%c[SYMBOL CHANGES]', 'color: #ff6b6b; font-weight: bold;');
        step.removedSymbols.forEach(rs => {
            const oldEmoji = CONFIG.symbols[rs.symbol] || rs.symbol;
            const newEmoji = rs.changedTo ? (CONFIG.symbols[rs.changedTo] || rs.changedTo) : '✨';
            const jokerTag = rs.jokerType ? ` (${rs.jokerType === 'big' ? 'BigJoker' : 'LittleJoker'})` : '';
            const oldId = (rs.symbolId || '').substring(0, 8).padEnd(8, ' ');
            const goldenIndicator = rs.goldenToJoker ? '✨' : '  ';
            console.log(`  (${String(rs.row).padStart(2, ' ')},${String(rs.col).padStart(2, ' ')}): ${oldEmoji}${goldenIndicator} id=${oldId} sym=${String(rs.symbol).padStart(3, ' ')} → ${newEmoji}${jokerTag} ${rs.changedTo ? 'sym=' + String(rs.changedTo).padStart(3, ' ') : 'REMOVED    '}`);
        });
    }

    // Print golden to joker transforms
    if (step.goldenToJokerTransforms && step.goldenToJokerTransforms.length > 0) {
        console.log('%c[GOLDEN→JOKER]', 'color: #ffd700; font-weight: bold;');
        step.goldenToJokerTransforms.forEach(t => {
            const jokerEmoji = t.jokerType === 'big' ? '🤡' : '🎭';
            console.log(`  (${String(t.row).padStart(2, ' ')},${String(t.col).padStart(2, ' ')}): Golden → ${jokerEmoji} ${t.jokerType}Joker`);
        });
    }

    // Print big joker extra replacements
    if (step.bigJokerReplacements && step.bigJokerReplacements.length > 0) {
        console.log('%c[BIG JOKER EXTRAS]', 'color: #ff6b6b; font-weight: bold;');
        step.bigJokerReplacements.forEach(r => {
            const oldEmoji = CONFIG.symbols[r.oldSymbol] || r.oldSymbol;
            console.log(`  (${String(r.row).padStart(2, ' ')},${String(r.col).padStart(2, ' ')}): ${oldEmoji} → 🤡 BigJoker`);
        });
    }

    // Print combo multiplier
    console.log('%c[COMBO] x' + step.comboMultiplier, 'color: #ff6b6b; font-weight: bold;');
    console.log('%c[STEP WIN] $' + (step.totalWin || 0).toFixed(2), 'color: #ffd700; font-weight: bold;');

    // Print grid after
    console.log('%c[AFTER]', 'color: #4ecdc4; font-weight: bold;');
    printGrid(step.symbolGridAfterFill);

    console.log('%c=====================================\n', 'color: #ffd700; font-size: 16px; font-weight: bold;');
}

function printGrid(symbolGrid) {
    if (!symbolGrid || !symbolGrid.mainGrid) {
        console.log('  [Empty grid]');
        return;
    }

    const grid = symbolGrid.mainGrid;
    const cellWidth = 14;  // Width for "emoji+golden+id" combined

    // Header
    let header = '     ';
    for (let col = 0; col < grid[0].length; col++) {
        header += String(col).padStart(cellWidth, ' ') + ' ';
    }
    console.log('%c' + header, 'color: #666;');

    // Separator
    let sep = '    +';
    for (let col = 0; col < grid[0].length; col++) {
        sep += '-'.repeat(cellWidth) + '+';
    }
    console.log(sep);

    // Rows - each cell shows "emoji+golden/joker+id" together
    for (let row = 0; row < grid.length; row++) {
        let line = ' ' + row + '  |';
        for (let col = 0; col < grid[row].length; col++) {
            const cell = grid[row][col];
            let display = '';
            if (cell && cell.symbol) {
                let emoji = CONFIG.symbols[cell.symbol] || cell.symbol;
                // WILD with jokerType shows joker emoji
                if (cell.symbol === '1' && cell.jokerType) {
                    emoji = CONFIG.jokerTypeEmojis[cell.jokerType] || '🃏';
                }
                const goldenTag = cell.isGolden ? '✨' : '';
                const idStr = (cell.id || '').substring(0, 4);
                display = emoji + goldenTag + idStr;
            }
            line += display.padStart(cellWidth, ' ') + '|';
        }
        console.log(line);
    }

    console.log(sep);
}

function animateSymbolChanges(removedSymbols) {
    if (!removedSymbols || removedSymbols.length === 0) return;

    const mainGrid = document.getElementById('mainGrid');
    removedSymbols.forEach(rs => {
        const index = rs.row * CONFIG.cols + rs.col;
        if (index < mainGrid.children.length) {
            const cell = mainGrid.children[index];
            cell.classList.remove('winning');
            cell.classList.add('changing');
            // Update emoji to new symbol if available
            if (rs.changedTo) {
                cell.textContent = CONFIG.symbols[rs.changedTo] || rs.changedTo;
            }
        }
    });
}

function animateFill(symbolGridAfterFill, symbolGridAfterRemoval) {
    if (!symbolGridAfterFill || !symbolGridAfterRemoval) return;

    const mainGrid = document.getElementById('mainGrid');
    const cells = mainGrid.children;

    for (let row = 0; row < symbolGridAfterFill.mainGrid.length; row++) {
        for (let col = 0; col < symbolGridAfterFill.mainGrid[row].length; col++) {
            const index = row * CONFIG.cols + col;
            if (index >= cells.length) continue;

            const cell = cells[index];
            const afterFill = symbolGridAfterFill.mainGrid[row][col];
            const afterRemoval = symbolGridAfterRemoval.mainGrid[row][col];

            if (afterFill && afterFill.symbol && (!afterRemoval || !afterRemoval.symbol)) {
                cell.classList.add('filling');
            }
        }
    }
}

function highlightWinningSymbols(positions) {
    if (!positions || positions.length === 0) return;

    const mainGrid = document.getElementById('mainGrid');
    positions.forEach(pos => {
        const index = pos.row * CONFIG.cols + pos.col;
        if (index < mainGrid.children.length) {
            mainGrid.children[index].classList.add('winning');
        }
    });
}

function animateRemovals(removedSymbols) {
    if (!removedSymbols || removedSymbols.length === 0) return;

    const mainGrid = document.getElementById('mainGrid');
    removedSymbols.forEach(rs => {
        const index = rs.row * CONFIG.cols + rs.col;
        if (index < mainGrid.children.length) {
            const cell = mainGrid.children[index];
            cell.classList.remove('winning');
            cell.classList.add('removing');
        }
    });
}

function clearAnimations() {
    const mainGrid = document.getElementById('mainGrid');
    for (let cell of mainGrid.children) {
        cell.classList.remove('winning', 'removing', 'filling', 'changing');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// UI FUNCTIONS
// ==========================================

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
// BONUS UI
// ==========================================

function showBonusUI(state) {
    let panel = document.getElementById('bonusPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'bonusPanel';
        panel.className = 'bonus-panel';
        document.body.appendChild(panel);
    }
    panel.classList.remove('hidden');

    const retriggerHtml = state.retriggerSpinsAwarded && state.retriggerSpinsAwarded > 0
        ? `<div class="bonus-retrigger">+${state.retriggerSpinsAwarded} Retrigger Spins</div>`
        : '';

    panel.innerHTML = `
        <div class="bonus-title">🎰 FREE SPINS</div>
        <div class="bonus-info">
            <div><span class="bonus-value">${state.freeSpinsRemaining}</span> Spins Remaining</div>
            <div><span class="bonus-value">${state.multiplier}x</span> Multiplier</div>
        </div>
        ${retriggerHtml}
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

    let retriggerEl = panel.querySelector('.bonus-retrigger');
    if (state.retriggerSpinsAwarded && state.retriggerSpinsAwarded > 0) {
        if (!retriggerEl) {
            retriggerEl = document.createElement('div');
            retriggerEl.className = 'bonus-retrigger';
            panel.insertBefore(retriggerEl, panel.querySelector('.bonus-total'));
        }
        retriggerEl.textContent = `+${state.retriggerSpinsAwarded} Retrigger Spins`;
    } else if (retriggerEl) {
        retriggerEl.remove();
    }

    const totalEl = panel.querySelector('.bonus-total');
    if (totalEl) {
        totalEl.innerHTML = `Total Win: <span class="bonus-win">$${state.totalWin.toFixed(2)}</span>`;
    }
}

// ==========================================
// CONTROLS
// ==========================================

function spin() {
    if (isSpinning) {
        console.log('[SuperAce] Spin ignored - already spinning');
        return;
    }
    if (!wsClient) return;

    isSpinning = true;
    const spinButton = document.getElementById('spinButton');
    const buyButton = document.getElementById('buyBonusButton');
    if (spinButton) {
        spinButton.disabled = true;
        spinButton.classList.add('spinning');
    }
    if (buyButton) {
        buyButton.disabled = true;
    }

    currentComboMultiplier = 1;
    updateComboMultiplierDisplay(1);

    spinTimeout = setTimeout(() => {
        if (isSpinning) {
            console.warn('[SuperAce] Spin timeout - auto unlocking');
            isSpinning = false;
            if (spinButton) {
                spinButton.disabled = false;
                spinButton.classList.remove('spinning');
            }
            if (buyButton) {
                buyButton.disabled = false;
            }
        }
    }, 10000);

    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];

    const spinPayload = { bet };
    if (debugOptions.forceScatterCount != null) spinPayload.forceScatterCount = debugOptions.forceScatterCount;
    if (debugOptions.forceGoldenCard) spinPayload.forceGoldenCard = true;

    console.log(`[spin] spinPayload = ${JSON.stringify(spinPayload)}`);
    wsClient.setBet(spinPayload);
}

function buyBonus() {
    if (isSpinning) {
        console.log('[SuperAce] Buy bonus ignored - already spinning');
        return;
    }
    if (!wsClient) return;

    isSpinning = true;
    const spinButton = document.getElementById('spinButton');
    const buyButton = document.getElementById('buyBonusButton');
    if (spinButton) {
        spinButton.disabled = true;
        spinButton.classList.add('spinning');
    }
    if (buyButton) {
        buyButton.disabled = true;
    }

    spinTimeout = setTimeout(() => {
        if (isSpinning) {
            console.warn('[SuperAce] Buy bonus timeout - auto unlocking');
            isSpinning = false;
            if (spinButton) {
                spinButton.disabled = false;
                spinButton.classList.remove('spinning');
            }
            if (buyButton) {
                buyButton.disabled = false;
            }
        }
    }, 10000);

    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];

    console.log(`[buyBonus] Buy bonus payload: bet=${bet}, buyBonus=true`);
    wsClient.setBet({ bet, buyBonus: true });
}

function changeBet(direction) {
    if (isSpinning) return;

    CURRENT_BET_INDEX += direction;
    if (CURRENT_BET_INDEX < 0) CURRENT_BET_INDEX = 0;
    if (CURRENT_BET_INDEX >= BET_SIZE_LIST.length) CURRENT_BET_INDEX = BET_SIZE_LIST.length - 1;

    updateBetDisplay();
}
