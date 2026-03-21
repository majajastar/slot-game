// Helper to convert SymbolGrid to display Grid
function symbolGridToGrid(symbolGrid) {
    if (!symbolGrid || !symbolGrid.length) return [];
    return symbolGrid.map(row =>
        row.map(cell => cell?.symbol || '')
    );
}

// ==========================================
// SPIN RESULT HANDLER - REFACTORED HELPERS
// ==========================================

/**
 * Extract and validate spin result from server response
 */
function extractSpinResult(data) {
    const betInfo = data.betInfo?.[0];
    if (!betInfo) {
        console.error('No betInfo in SetBet response', data);
        return null;
    }
    const result = betInfo.gameResult;
    if (!result) {
        console.error('No gameResult in betInfo', betInfo);
        return null;
    }
    return { betInfo, result };
}

/**
 * Log spin result details to console
 */
function logSpinResult(result) {
    console.log('%c[Grid Result]', 'color: #4ecdc4; font-weight: bold;');
    if (result.grid) {
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
}

/**
 * Log cascade steps to console
 */
function logCascadeSteps(result) {
    if (!result.cascadeSteps?.length) return;
    console.log(`%c[Cascade: ${result.cascadeSteps.length} steps]`, 'color: #ffd700; font-weight: bold;');
}

/**
 * Log rainbow result to console
 */
function logRainbowResult(result) {
    if (!result.rainbowResult?.hasRainbow) return;
    console.log('%c[Rainbow Feature!]', 'color: #ff6b6b; font-weight: bold;',
        `Coin win: ${result.rainbowResult.coinWin}`);
}

/**
 * Update balance and log win
 */
function updateBalanceAndLogWin(betInfo, result) {
    currentBalance = betInfo.finalBalance || 0;
    updateBalance();
    if (result.totalWinAmount > 0) {
        console.log('[SpinResult] Win: +$' + result.totalWinAmount.toFixed(2));
    }
}

/**
 * Render main spin animations (cascade or simple)
 */
async function renderMainAnimation(result) {
    if (result.cascadeSteps?.length > 0) {
        await renderCascade(result.cascadeSteps, result.totalWinAmount);
        if (result.grid) renderGrid(result.grid, true);
    } else {
        renderGrid(result.grid);
        showWin(result.totalWinAmount);
    }
}

/**
 * Render golden squares from result
 */
function renderGoldenSquaresFromResult(result) {
    if (result.goldenSquares?.length > 0) {
        renderGoldenSquares(result.goldenSquares);
    } else {
        clearGoldenSquares();
    }
}

/**
 * Render rainbow feature if won
 */
async function renderRainbowIfWon(result) {
    if (result.rainbowResult?.hasRainbow && result.rainbowResult.coinWin > 0) {
        await renderRainbowFeature(result.rainbowResult, result.goldenSquares);
    }
}

/**
 * Check if new bonus entry
 */
function isNewBonusEntry(bonusState) {
    return (bonusState.spinsLeft === bonusState.totalSpins || bonusState.isActive) 
        && !bonusGameActive && bonusState.spinsLeft > 0;
}

/**
 * Handle bonus game UI updates
 */
async function handleBonusUI(result) {
    const bonusState = result.bonusGameState;
    if (!bonusState) {
        if (bonusGameActive) hideBonusProgress();
        return;
    }
    
    if (isNewBonusEntry(bonusState)) {
        await renderBonusTrigger(bonusState, result.grid);
    }
    
    if (bonusState.isActive && bonusState.spinsLeft > 0) {
        bonusGameActive = true;
        showBonusProgress(bonusState);
    } else {
        hideBonusProgress();
    }
}

/**
 * Finalize spin - reset state
 */
function finalizeSpin() {
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
    updateBonusButton();
}

// ==========================================
// MAIN SPIN RESULT HANDLER
// ==========================================

async function handleSpinResult(data) {
    // Step 1: Extract and validate
    const extracted = extractSpinResult(data);
    if (!extracted) {
        finalizeSpin();
        return;
    }
    const { betInfo, result } = extracted;
    
    // Step 2: Log debug info
    logSpinResult(result);
    logCascadeSteps(result);
    logRainbowResult(result);
    
    // Step 3: Update balance
    updateBalanceAndLogWin(betInfo, result);
    
    // Step 4-6: Render animations
    await renderMainAnimation(result);
    renderGoldenSquaresFromResult(result);
    await renderRainbowIfWon(result);
    
    // Step 7: Handle bonus
    await handleBonusUI(result);
    
    // Step 8: Finalize
    finalizeSpin();
}
