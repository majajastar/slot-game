/**
 * Fake TheLuxe Game Server for Testing
 * Simulates the WebSocket backend without AWS dependencies
 */

const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const HTTP_PORT = 3001;
const WS_PORT = 3002;

// Game state
const GAME_STATE = {
    sessionId: 'test-session-' + Date.now(),
    balance: 10000,
    spinCount: 0,
    totalWin: 0,
    inBonus: false,
    bonusType: null,
    bonusSpinsLeft: 0,
    stickyFrames: null
};

// Game data (matches minesweeper backend)
const GAME_DATA = {
    gameConfig: {
        id: 'theluxe',
        name: 'TheLuxe',
        icon: '💎',
        grid: { rows: 4, cols: 5 },
        rtp: 96.0,
        volatility: 'High',
        wildInfo: 'Wild substitutes for all symbols. 5 Wilds = 100x payout!',
        paylines: { count: 14, description: '14 paylines on 4x5 grid' }
    },
    symbols: {
        'WILD': { display: '💎', name: 'Diamond Wild', payout: { 5: 100, 4: 0, 3: 0 } },
        'SCATTER': { display: '⭐', name: 'Star Scatter', payout: { 5: 0, 4: 0, 3: 0 } },
        'SYM_1': { display: '👑', name: 'Crown', payout: { 5: 50, 4: 25, 3: 10 } },
        'SYM_2': { display: '💍', name: 'Ring', payout: { 5: 40, 4: 20, 3: 8 } },
        'SYM_3': { display: '🏆', name: 'Trophy', payout: { 5: 30, 4: 15, 3: 6 } },
        'SYM_4': { display: '💵', name: 'Cash', payout: { 5: 20, 4: 10, 3: 4 } },
        'SYM_5': { display: '🎲', name: 'Dice', payout: { 5: 5, 4: 2, 3: 1 } },
        'SYM_6': { display: '🎯', name: 'Target', payout: { 5: 5, 4: 2, 3: 1 } },
        'SYM_7': { display: '🎰', name: 'Slot', payout: { 5: 5, 4: 2, 3: 1 } },
        'SYM_8': { display: '🪙', name: 'Coin', payout: { 5: 5, 4: 2, 3: 1 } },
        'SYM_9': { display: '💠', name: 'Gem', payout: { 5: 5, 4: 2, 3: 1 } }
    },
    paylines: [
        { name: 'Line 1', pattern: [1, 1, 1, 1, 1] },
        { name: 'Line 2', pattern: [0, 0, 0, 0, 0] },
        { name: 'Line 3', pattern: [2, 2, 2, 2, 2] },
        { name: 'Line 4', pattern: [3, 3, 3, 3, 3] },
        { name: 'Line 5', pattern: [0, 1, 2, 1, 0] },
        { name: 'Line 6', pattern: [2, 1, 0, 1, 2] },
        { name: 'Line 7', pattern: [0, 0, 1, 0, 0] },
        { name: 'Line 8', pattern: [2, 2, 1, 2, 2] },
        { name: 'Line 9', pattern: [1, 0, 0, 0, 1] },
        { name: 'Line 10', pattern: [1, 2, 2, 2, 1] },
        { name: 'Line 11', pattern: [3, 2, 1, 2, 3] },
        { name: 'Line 12', pattern: [0, 1, 0, 1, 0] },
        { name: 'Line 13', pattern: [2, 1, 2, 1, 2] },
        { name: 'Line 14', pattern: [3, 3, 2, 3, 3] }
    ],
    jackpots: {
        values: [25, 100, 500, 1000],
        display: {
            25: { name: 'MINI', icon: '🔷', multiplier: '25x' },
            100: { name: 'MAJOR', icon: '🔶', multiplier: '100x' },
            500: { name: 'MEGA', icon: '💎', multiplier: '500x' },
            1000: { name: 'MAX', icon: '👑', multiplier: '1000x' }
        }
    },
    bonuses: {
        blackAndGold: { name: 'Black and Gold', description: '10 free spins with sticky golden frames', spins: 10, scatterCount: 3, buyPrice: 80, buyPriceDisplay: '80x' },
        goldenHit: { name: 'Golden Hit', description: 'Enhanced bonus with doubled multipliers', spins: 10, scatterCount: 4, buyPrice: 250, buyPriceDisplay: '250x' }
    },
    betSizeList: [1, 2, 3, 5, 8, 12, 18, 30, 50, 80, 130, 220, 400, 800, 2000]
};

const PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2],
    [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [3, 2, 1, 2, 3], [0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2], [3, 3, 2, 3, 3]
];

const PAYOUTS = {
    'WILD': [100, 0, 0], 'SYM_1': [50, 25, 10], 'SYM_2': [40, 20, 8],
    'SYM_3': [30, 15, 6], 'SYM_4': [20, 10, 4], 'SYM_5': [5, 2, 1],
    'SYM_6': [5, 2, 1], 'SYM_7': [5, 2, 1], 'SYM_8': [5, 2, 1], 'SYM_9': [5, 2, 1]
};

// Adjusted weights for better win frequency (higher RTP)
const SYMBOL_WEIGHTS = {
    'WILD': 0.08,      // Increased from 0.05
    'SYM_1': 0.10,     // Decreased from 0.13
    'SYM_2': 0.12,     // Decreased from 0.15
    'SYM_3': 0.14,     // Decreased from 0.18
    'SYM_4': 0.16,     // Decreased from 0.20
    'SYM_5': 0.40,     // Decreased from 0.67
    'SYM_6': 0.40,     // Decreased from 0.67
    'SYM_7': 0.40,     // Decreased from 0.67
    'SYM_8': 0.40,     // Decreased from 0.67
    'SYM_9': 0.40      // Decreased from 0.67
};

// HTTP Server for SID and Launch API
const httpServer = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);

    // SID endpoint
    if (parsedUrl.pathname.includes('/sid')) {
        console.log('[HTTP] SID request');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sid: 'fake-sid-' + Date.now() }));
        return;
    }

    // Launch endpoint
    if (parsedUrl.pathname.includes('/launch')) {
        console.log('[HTTP] Launch request');
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            console.log('[HTTP] Launch body:', body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                vals: {
                    errCode: 0,
                    data: {
                        redirectUrl: `http://localhost:${HTTP_PORT}/game?token=fake-token-${Date.now()}&lang=en`
                    }
                }
            }));
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

// Generate random grid
function generateGrid() {
    const grid = [];
    for (let r = 0; r < 4; r++) {
        grid[r] = [];
        for (let c = 0; c < 5; c++) {
            const rand = Math.random();
            let cumProb = 0;
            let selected = 'SYM_9';
            for (const [sym, weight] of Object.entries(SYMBOL_WEIGHTS)) {
                cumProb += weight;
                if (rand <= cumProb) {
                    selected = sym;
                    break;
                }
            }
            grid[r][c] = selected;
        }
    }
    return grid;
}

// Calculate line win
function calculateLineWin(grid, linePattern, bet) {
    const symbols = linePattern.map((row, col) => grid[row][col]);
    let firstSym = symbols[0];

    if (firstSym === 'WILD') {
        for (const s of symbols) {
            if (s !== 'SCATTER') {
                firstSym = s;
                break;
            }
        }
    }

    let matchCount = 0;
    for (const s of symbols) {
        if (s === firstSym || s === 'WILD') {
            matchCount++;
        } else {
            break;
        }
    }

    if (matchCount < 3 || firstSym === 'SCATTER') {
        return { win: 0, symbol: '', count: 0, positions: [] };
    }

    const payout = PAYOUTS[firstSym]?.[5 - matchCount] || 0;
    if (payout <= 0) {
        return { win: 0, symbol: '', count: 0, positions: [] };
    }

    const win = payout * bet;
    const positions = linePattern.slice(0, matchCount).map((row, col) => [row, col]);

    return { win, symbol: firstSym, count: matchCount, positions };
}

// Generate frames for bonus games
function generateFrames(isGoldenHit = false) {
    const frames = [];
    const frameChance = 0.10;

    for (let r = 0; r < 4; r++) {
        frames[r] = [];
        for (let c = 0; c < 5; c++) {
            if (Math.random() < frameChance) {
                const isJackpot = Math.random() < 0.30;
                if (isJackpot) {
                    const jackpots = [25, 100, 500, 1000];
                    const weights = [50, 30, 15, 5];
                    const totalWeight = weights.reduce((a, b) => a + b, 0);
                    let random = Math.random() * totalWeight;
                    let selected = jackpots[0];
                    for (let i = 0; i < jackpots.length; i++) {
                        random -= weights[i];
                        if (random <= 0) {
                            selected = jackpots[i];
                            break;
                        }
                    }
                    frames[r][c] = { type: 'jackpot', value: selected };
                } else {
                    const multipliers = [2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 100];
                    const weights = [40, 30, 15, 8, 4, 2, 1, 1, 1, 0.5, 0.3, 0.2];
                    const totalWeight = weights.reduce((a, b) => a + b, 0);
                    let random = Math.random() * totalWeight;
                    let selected = multipliers[0];
                    for (let i = 0; i < multipliers.length; i++) {
                        random -= weights[i];
                        if (random <= 0) {
                            selected = multipliers[i];
                            break;
                        }
                    }
                    if (isGoldenHit && selected <= 10) {
                        selected *= 2;
                    }
                    frames[r][c] = { type: 'multiplier', value: selected };
                }
            } else {
                frames[r][c] = { type: 'multiplier', value: 0 };
            }
        }
    }
    return frames;
}

// Calculate line win with frames
function calculateLineWinWithFrames(grid, linePattern, bet, frames) {
    const symbols = linePattern.map((row, col) => grid[row][col]);

    let firstSym = symbols[0];
    if (firstSym === 'WILD') {
        for (const s of symbols) {
            if (s !== 'SCATTER') {
                firstSym = s;
                break;
            }
        }
    }

    let matchCount = 0;
    const winPositions = [];
    let frameMultiplierSum = 0;
    let jackpotSum = 0;

    for (let i = 0; i < symbols.length; i++) {
        const s = symbols[i];
        const row = linePattern[i];
        const col = i;

        if (s === firstSym || s === 'WILD') {
            matchCount++;
            winPositions.push([row, col]);

            const frame = frames[row]?.[col];
            if (frame && frame.value > 0) {
                if (frame.type === 'jackpot') {
                    jackpotSum += frame.value;
                } else {
                    frameMultiplierSum += frame.value;
                }
            }
        } else {
            break;
        }
    }

    if (matchCount < 3 || firstSym === 'SCATTER') {
        return { win: 0, symbol: '', count: 0, positions: [] };
    }

    const payout = PAYOUTS[firstSym]?.[5 - matchCount] || 0;
    if (payout <= 0) {
        return { win: 0, symbol: '', count: 0, positions: [] };
    }

    let multiplier = 1;
    const wildCount = symbols.filter(s => s === 'WILD').length;
    if (wildCount > 0) multiplier += wildCount * 2;
    if (frameMultiplierSum > 0) multiplier += frameMultiplierSum;

    const lineWin = payout * bet * multiplier;
    const jackpotWin = jackpotSum * bet;
    const totalWin = lineWin + jackpotWin;

    return { win: totalWin, symbol: firstSym, count: matchCount, positions: winPositions };
}

// Check for bonus entry (10% chance for testing)
function checkBonusEntry() {
    if (Math.random() < 0.10) {
        return Math.random() < 0.7 ? 'BLACK_AND_GOLD' : 'GOLDEN_HIT';
    }
    return null;
}

// Process bonus spin
function processBonusSpin(bet) {
    const { bonusType, stickyFrames } = GAME_STATE;
    const newFrames = generateFrames(bonusType === 'GOLDEN_HIT');

    const finalFrames = [];
    for (let r = 0; r < 4; r++) {
        finalFrames[r] = [];
        for (let c = 0; c < 5; c++) {
            if (bonusType === 'BLACK_AND_GOLD') {
                finalFrames[r][c] = stickyFrames[r][c].value > 0 ? stickyFrames[r][c] : newFrames[r][c];
            } else {
                if (stickyFrames[r][c].type === 'jackpot' && stickyFrames[r][c].value > 0) {
                    finalFrames[r][c] = newFrames[r][c];
                } else {
                    finalFrames[r][c] = stickyFrames[r][c].value > 0 ? stickyFrames[r][c] : newFrames[r][c];
                }
            }
        }
    }

    const grid = generateGrid();
    const scatterCount = bonusType === 'BLACK_AND_GOLD' ? 3 : 4;
    const replaceable = ['SYM_1', 'SYM_2', 'SYM_3', 'SYM_4', 'SYM_5', 'SYM_6', 'SYM_7', 'SYM_8', 'SYM_9'];
    const positions = [];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            if (replaceable.includes(grid[r][c])) {
                positions.push([r, c]);
            }
        }
    }
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    for (let i = 0; i < scatterCount && i < shuffled.length; i++) {
        const [r, c] = shuffled[i];
        grid[r][c] = 'SCATTER';
    }

    let totalWin = 0;
    const lineWins = [];

    for (let i = 0; i < 14; i++) {
        const result = calculateLineWinWithFrames(grid, PAYLINES[i], bet, finalFrames);
        if (result.win > 0) {
            totalWin += result.win;
            lineWins.push({
                positions: result.positions,
                info: [i, result.symbol, result.count, result.win]
            });
        }
    }

    GAME_STATE.stickyFrames = finalFrames;
    GAME_STATE.bonusSpinsLeft--;

    const isLastSpin = GAME_STATE.bonusSpinsLeft <= 0;

    if (isLastSpin) {
        GAME_STATE.inBonus = false;
        GAME_STATE.bonusType = null;
        GAME_STATE.bonusSpinsLeft = 0;
        GAME_STATE.stickyFrames = null;
    }

    GAME_STATE.balance += totalWin;

    return {
        bet,
        grid,
        totalWinAmount: totalWin,
        lineWins,
        isBonus: true,
        bonusType,
        bonusSpinsLeft: GAME_STATE.bonusSpinsLeft,
        stickyFrames: finalFrames,
        lastFreeSpin: isLastSpin
    };
}

// Process normal spin
function processNormalSpin(requestedBet) {
    let bet = requestedBet;
    if (!GAME_DATA.betSizeList.includes(bet)) {
        const originalBet = bet;
        bet = GAME_DATA.betSizeList.reduce((prev, curr) =>
            Math.abs(curr - bet) < Math.abs(prev - bet) ? curr : prev
        );
        console.log(`[SPIN] Bet ${originalBet} auto-corrected to ${bet}`);
    }

    const grid = generateGrid();
    let totalWin = 0;
    const lineWins = [];

    for (let i = 0; i < 14; i++) {
        const result = calculateLineWin(grid, PAYLINES[i], bet);
        if (result.win > 0) {
            totalWin += result.win;
            lineWins.push({
                positions: result.positions,
                info: [i, result.symbol, result.count, result.win]
            });
        }
    }

    // Debug logging
    if (lineWins.length > 0) {
        console.log(`[WIN] ${lineWins.length} winning lines, total: $${totalWin}`);
        lineWins.forEach(lw => {
            console.log(`      Line ${lw.info[0]+1}: ${lw.info[1]} x${lw.info[2]} = $${lw.info[3]}`);
        });
    } else {
        // Log losing spin occasionally
        if (Math.random() < 0.1) {
            console.log(`[SPIN] No win (bet: $${bet})`);
        }
    }

    // Check for bonus entry
    const bonusType = checkBonusEntry();
    if (bonusType) {
        GAME_STATE.inBonus = true;
        GAME_STATE.bonusType = bonusType;
        GAME_STATE.bonusSpinsLeft = 10;
        GAME_STATE.stickyFrames = generateFrames(bonusType === 'GOLDEN_HIT');
        console.log(`[BONUS] ${bonusType} triggered!`);
    }

    GAME_STATE.balance = GAME_STATE.balance - bet + totalWin;
    GAME_STATE.spinCount++;
    GAME_STATE.totalWin += totalWin;

    return {
        bet,
        grid,
        totalWinAmount: totalWin,
        lineWins,
        isBonus: bonusType !== null,
        bonusType,
        bonusSpinsLeft: bonusType ? 10 : 0
    };
}

// Main process spin function
function processSpin(requestedBet) {
    if (GAME_STATE.inBonus) {
        return processBonusSpin(requestedBet);
    }
    return processNormalSpin(requestedBet);
}

// WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws, req) => {
    console.log('[WS] Client connected');

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);
            console.log('[WS] Received:', msg.type || msg.vals?.type);

            const { type, data } = msg;

            // Login
            if (type === '0') {
                ws.send(JSON.stringify({
                    vals: { type: 1, data: { sessionId: GAME_STATE.sessionId, errCode: 0 } }
                }));
                return;
            }

            // Lobby
            if (type === '2') {
                ws.send(JSON.stringify({
                    vals: {
                        type: 3,
                        data: {
                            gameId: 'theluxe',
                            balance: GAME_STATE.balance,
                            serverTime: Date.now(),
                            currency: 'USD',
                            walletType: 'real',
                            errCode: 0
                        }
                    }
                }));
                return;
            }

            // Game messages
            if (type === '100000') {
                const subType = data?.[0]?.subType;

                // Join room
                if (subType === 100004) {
                    ws.send(JSON.stringify({
                        vals: {
                            type: 100000,
                            data: {
                                subType: 100005,
                                subData: [{
                                    gameType: 'theluxe',
                                    roomId: 'room-' + GAME_STATE.sessionId,
                                    balance: GAME_STATE.balance,
                                    betInfo: [{
                                        gameName: 'theluxe',
                                        minBet: 1,
                                        maxBet: 2000,
                                        defaultBet: 10,
                                        betSizeList: GAME_DATA.betSizeList
                                    }],
                                    currencyInfo: [{ currencyId: 'USD', currency: '$' }],
                                    errCode: 0
                                }]
                            }
                        }
                    }));
                    return;
                }

                // SyncRoomInfo / SetBet
                if (subType === 100070) {
                    const subData = data?.[0]?.subData?.[0];

                    // SyncRoomInfo
                    if (subData?.opCode === 'SyncRoomInfo') {
                        const roomInfo = {
                            minBet: 1,
                            maxBet: 2000,
                            ...GAME_DATA,
                            lines: 14
                        };
                        console.log('[SERVER] SyncRoomInfo - GAME_DATA keys:', Object.keys(GAME_DATA));
                        console.log('[SERVER] SyncRoomInfo - has symbols:', !!GAME_DATA.symbols, 'count:', GAME_DATA.symbols ? Object.keys(GAME_DATA.symbols).length : 0);
                        console.log('[SERVER] SyncRoomInfo - has paylines:', !!GAME_DATA.paylines, 'count:', GAME_DATA.paylines ? GAME_DATA.paylines.length : 0);
                        console.log('[SERVER] SyncRoomInfo - roomInfo keys:', Object.keys(roomInfo));
                        console.log('[SERVER] SyncRoomInfo - roomInfo has symbols:', !!roomInfo.symbols);
                        console.log('[SERVER] SyncRoomInfo - roomInfo has paylines:', !!roomInfo.paylines);
                        
                        const response = {
                            vals: {
                                type: 100000,
                                data: {
                                    subType: 100071,
                                    subData: [{
                                        opCode: 'SyncRoomInfo',
                                        roomInfo
                                    }]
                                }
                            }
                        };
                        console.log('[SERVER] Sending response:', JSON.stringify(response, null, 2).substring(0, 2000));
                        ws.send(JSON.stringify(response));
                        console.log('[SERVER] SyncRoomInfo sent');
                        return;
                    }

                    // SetBet (spin)
                    if (subData?.opCode === 'SetBet') {
                        const requestedBet = subData.message?.bet || 10;
                        const result = processSpin(requestedBet);
                        const actualBet = result.bet; // Use the corrected bet

                        ws.send(JSON.stringify({
                            vals: {
                                type: 100000,
                                data: {
                                    subType: 100071,
                                    subData: [{
                                        opCode: 'SetBet',
                                        betInfo: [{
                                            bet: actualBet,
                                            gameResult: result,
                                            roundId: 'round-' + Date.now(),
                                            balance: GAME_STATE.balance - result.totalWinAmount + actualBet,
                                            finalBalance: GAME_STATE.balance
                                        }]
                                    }]
                                }
                            }
                        }));
                        return;
                    }
                }
            }

            console.log('[WS] Unhandled message type:', type);

        } catch (err) {
            console.error('[WS] Error:', err);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
    });
});

// Start servers
httpServer.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Fake SID/Launch server running on http://localhost:${HTTP_PORT}`);
});

console.log(`[WS] Fake WebSocket server running on ws://localhost:${WS_PORT}`);
console.log('\n========================================');
console.log('FAKE THELUXE SERVER RUNNING');
console.log('========================================');
console.log('HTTP (SID/Launch): http://localhost:' + HTTP_PORT);
console.log('WebSocket: ws://localhost:' + WS_PORT);
console.log('Starting balance: $' + GAME_STATE.balance);
console.log('Bet sizes: ' + GAME_DATA.betSizeList.join(', '));
console.log('Lines: 14 (always active)');
console.log('========================================\n');

// Keep alive
setInterval(() => {}, 1000);
