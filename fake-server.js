/**
 * Fake TheLuxe Game Server for Testing
 * Simulates the WebSocket backend without AWS dependencies
 * Updated with new numeric symbol IDs
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

// Symbol IDs: WILD=1, SCATTER=2, High=201-205, Low=101-104, COLLECT=777
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
        '1': { display: '💎', name: 'Diamond Wild', tier: 'special', payout: { 5: 200, 4: 0, 3: 0 } },
        '2': { display: '⭐', name: 'Star Scatter', tier: 'special', payout: { 5: 0, 4: 0, 3: 0 } },
        '201': { display: '👑', name: 'Crown', tier: 'high', payout: { 5: 200, 4: 50, 3: 20 } },
        '202': { display: '💍', name: 'Ring', tier: 'high', payout: { 5: 100, 4: 30, 3: 10 } },
        '203': { display: '🏆', name: 'Trophy', tier: 'high', payout: { 5: 50, 4: 12, 3: 5 } },
        '204': { display: '💵', name: 'Cash', tier: 'high', payout: { 5: 25, 4: 10, 3: 2 } },
        '205': { display: '🎴', name: 'Card', tier: 'high', payout: { 5: 5, 4: 2, 3: 0.5 } },
        '101': { display: '♠️', name: 'Spades', tier: 'low', payout: { 5: 1, 4: 0.5, 3: 0.2 } },
        '102': { display: '♥️', name: 'Hearts', tier: 'low', payout: { 5: 1, 4: 0.5, 3: 0.2 } },
        '103': { display: '♦️', name: 'Diamonds', tier: 'low', payout: { 5: 1, 4: 0.5, 3: 0.2 } },
        '104': { display: '♣️', name: 'Clubs', tier: 'low', payout: { 5: 1, 4: 0.5, 3: 0.2 } },
        '777': { display: '🍀', name: 'Collect', tier: 'special', payout: { 5: 0, 4: 0, 3: 0 } }
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
        blackAndGold: { name: 'Black and Gold', description: '10 free spins with sticky golden frames', spins: 10, scatterCount: 3, buyPriceMultiplier: 80, buyPriceDisplay: '80x' },
        goldenHit: { name: 'Golden Hit', description: 'Enhanced bonus with doubled multipliers', spins: 10, scatterCount: 4, buyPriceMultiplier: 200, buyPriceDisplay: '200x' },
        megaBoost: { name: 'Mega Boost', description: '10x cost with 10x bonus entry chance', costMultiplier: 10, bonusEntryMultiplier: 10 }
    },
    betSizeList: [5, 10, 20, 40, 50]
};

const PAYLINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 0, 0], [2, 2, 1, 2, 2],
    [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [3, 2, 1, 2, 3], [0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2], [3, 3, 2, 3, 3]
];

// Payouts for numeric symbol IDs (index 0=5 matches, 1=4 matches, 2=3 matches)
const PAYOUTS = {
    '1': [200, 0, 0],
    '201': [200, 50, 20], '202': [100, 30, 10], '203': [50, 12, 5], '204': [25, 10, 2], '205': [5, 2, 0.5],
    '101': [1, 0.5, 0.2], '102': [1, 0.5, 0.2], '103': [1, 0.5, 0.2], '104': [1, 0.5, 0.2]
};

// Symbol weights for grid generation
const SYMBOL_WEIGHTS = {
    '1': 0.05,      // WILD
    '201': 0.08,    // High 1
    '202': 0.10,    // High 2
    '203': 0.12,    // High 3
    '204': 0.14,    // High 4
    '205': 0.16,    // High 5
    '101': 0.35,    // Low 1
    '102': 0.35,    // Low 2
    '103': 0.35,    // Low 3
    '104': 0.35     // Low 4
};

// HTTP Server for SID and Launch API
const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);

    // SID endpoint - returns WebSocket token
    if (parsedUrl.pathname === '/mock-wallet/sid' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            console.log('[HTTP] SID request:', body);
            
            const response = {
                errCode: 0,
                errMsg: '',
                vals: {
                    token: 'fake-ws-token-' + Date.now(),
                    sessionId: GAME_STATE.sessionId,
                    balance: GAME_STATE.balance
                }
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        });
        return;
    }

    // Launch endpoint
    if (parsedUrl.pathname === '/rest/game/launch' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            console.log('[HTTP] Launch request:', body);
            
            const response = {
                errCode: 0,
                errMsg: '',
                vals: {
                    gameUrl: `ws://localhost:${WS_PORT}`,
                    sessionId: GAME_STATE.sessionId
                }
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
        });
        return;
    }

    // 404 for other paths
    res.writeHead(404);
    res.end('Not Found');
});

// WebSocket Server
const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`[Server] HTTP server on port ${HTTP_PORT}`);
console.log(`[Server] WebSocket server on port ${WS_PORT}`);

wss.on('connection', (ws, req) => {
    console.log('[WS] Client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('[WS] Received:', data.type || 'unknown');
            
            handleMessage(ws, data);
        } catch (e) {
            console.error('[WS] Error parsing message:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('[WS] Client disconnected');
    });
});

function handleMessage(ws, data) {
    const { type, data: msgData } = data;
    
    // Login (type: 0)
    if (type === '0') {
        sendResponse(ws, {
            errCode: 0,
            vals: {
                type: 1,
                data: {
                    sessionId: GAME_STATE.sessionId,
                    userId: 'test-user',
                    balance: GAME_STATE.balance
                }
            }
        });
        return;
    }
    
    // Game messages (type: 100000)
    if (type === '100000') {
        const { subType, subData } = msgData?.[0] || {};
        
        // Join Room (subType: 100004)
        if (subType === 100004) {
            handleJoinRoom(ws);
            return;
        }
        
        // SetBet/SyncRoom (subType: 100070)
        if (subType === 100070) {
            const opCode = subData?.[0]?.opCode;
            const message = subData?.[0]?.message || {};
            
            if (opCode === 'SyncRoomInfo') {
                handleSyncRoom(ws);
            } else if (opCode === 'SetBet') {
                handleSetBet(ws, message);
            } else if (opCode === 'GetRecords') {
                handleGetRecords(ws);
            }
            return;
        }
    }
}

function handleJoinRoom(ws) {
    console.log('[WS] Join Room');
    
    sendResponse(ws, {
        errCode: 0,
        vals: {
            type: 100000,
            data: {
                subType: 100005,
                subData: [{
                    roomId: 'theluxe-room-001',
                    gameTypeId: 'theluxe',
                    betInfo: [{
                        symbols: GAME_DATA.symbols,
                        paylines: GAME_DATA.paylines,
                        jackpots: GAME_DATA.jackpots,
                        bonuses: GAME_DATA.bonuses,
                        gameConfig: GAME_DATA.gameConfig
                    }]
                }]
            }
        }
    });
}

function handleSyncRoom(ws) {
    sendResponse(ws, {
        errCode: 0,
        vals: {
            type: 100000,
            data: {
                subType: 100071,
                subData: [{
                    opCode: 'SyncRoomInfo',
                    roomInfo: {
                        roomId: 'theluxe-room-001',
                        balance: GAME_STATE.balance,
                        currency: 'USD',
                        isInPlay: false
                    }
                }]
            }
        }
    });
}

function handleSetBet(ws, message) {
    const { bet, forceBonusType, megaBoost } = message;
    const actualBet = megaBoost ? bet * 10 : bet;
    
    console.log(`[WS] SetBet: bet=${bet}, forceBonus=${forceBonusType}, megaBoost=${megaBoost}`);
    
    // Check balance
    if (GAME_STATE.balance < actualBet && !forceBonusType) {
        sendResponse(ws, {
            errCode: 1001,
            errMsg: 'Insufficient balance'
        });
        return;
    }
    
    // Handle bonus buy
    if (forceBonusType) {
        const cost = forceBonusType === 'BLACK_AND_GOLD' ? bet * 80 : bet * 200;
        if (GAME_STATE.balance < cost) {
            sendResponse(ws, {
                errCode: 1001,
                errMsg: 'Insufficient balance for bonus buy'
            });
            return;
        }
        
        GAME_STATE.balance -= cost;
        GAME_STATE.inBonus = true;
        GAME_STATE.bonusType = forceBonusType;
        GAME_STATE.bonusSpinsLeft = 10;
        GAME_STATE.stickyFrames = generateInitialFrames();
        
        // Return bonus trigger result
        sendResponse(ws, {
            errCode: 0,
            vals: {
                type: 100000,
                data: {
                    subType: 100071,
                    subData: [{
                        opCode: 'SetBet',
                        betInfo: [{
                            bet: bet,
                            awardBase: cost,
                            gameResult: {
                                awardBase: cost,
                                winAmount: 0,
                                info: {
                                    grid: generateGrid(),
                                    lineWins: [],
                                    totalWinAmount: 0,
                                    bonusGameState: {
                                        type: forceBonusType,
                                        spinsLeft: 10,
                                        totalSpins: 10
                                    },
                                    stickyFrames: GAME_STATE.stickyFrames,
                                    isInBonus: true,
                                    bonusSpinsLeft: 10
                                }
                            }
                        }]
                    }]
                }
            }
        });
        return;
    }
    
    // Normal spin
    GAME_STATE.balance -= actualBet;
    GAME_STATE.spinCount++;
    
    const grid = generateGrid();
    const lineWins = calculateWins(grid);
    const totalWin = lineWins.reduce((sum, lw) => sum + (lw.info?.[3] || 0), 0);
    
    GAME_STATE.balance += totalWin;
    GAME_STATE.totalWin += totalWin;
    
    // Check for bonus trigger (only in normal mode)
    let bonusGameState = null;
    if (!GAME_STATE.inBonus && Math.random() < 0.02) {
        GAME_STATE.inBonus = true;
        GAME_STATE.bonusType = Math.random() < 0.7 ? 'BLACK_AND_GOLD' : 'GOLDEN_HIT';
        GAME_STATE.bonusSpinsLeft = 10;
        GAME_STATE.stickyFrames = generateInitialFrames();
        bonusGameState = {
            type: GAME_STATE.bonusType,
            spinsLeft: 10,
            totalSpins: 10
        };
    }
    
    sendResponse(ws, {
        errCode: 0,
        vals: {
            type: 100000,
            data: {
                subType: 100071,
                subData: [{
                    opCode: 'SetBet',
                    betInfo: [{
                        bet: actualBet,
                        awardBase: actualBet,
                        gameResult: {
                            awardBase: actualBet,
                            winAmount: totalWin,
                            info: {
                                grid: grid,
                                lineWins: lineWins,
                                totalWinAmount: totalWin,
                                bonusGameState: bonusGameState,
                                stickyFrames: GAME_STATE.stickyFrames,
                                isInBonus: GAME_STATE.inBonus,
                                bonusSpinsLeft: GAME_STATE.bonusSpinsLeft
                            }
                        }
                    }]
                }]
            }
        }
    });
}

function handleGetRecords(ws) {
    sendResponse(ws, {
        errCode: 0,
        vals: {
            type: 100000,
            data: {
                subType: 100071,
                subData: [{
                    opCode: 'GetRecords',
                    records: []
                }]
            }
        }
    });
}

function sendResponse(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// Generate random grid
function generateGrid() {
    const grid = [];
    for (let r = 0; r < 4; r++) {
        const row = [];
        for (let c = 0; c < 5; c++) {
            row.push(weightedRandomSymbol());
        }
        grid.push(row);
    }
    return grid;
}

function weightedRandomSymbol() {
    const rand = Math.random();
    let cumulative = 0;
    
    const symbols = Object.keys(SYMBOL_WEIGHTS);
    const weights = Object.values(SYMBOL_WEIGHTS);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < symbols.length; i++) {
        cumulative += weights[i] / totalWeight;
        if (rand <= cumulative) {
            return symbols[i];
        }
    }
    return symbols[symbols.length - 1];
}

// Calculate wins on paylines
function calculateWins(grid) {
    const lineWins = [];
    
    for (let lineIdx = 0; lineIdx < PAYLINES.length; lineIdx++) {
        const pattern = PAYLINES[lineIdx];
        const symbols = pattern.map((row, col) => grid[row][col]);
        
        // Find first non-wild symbol
        let firstSym = symbols[0];
        let startIdx = 0;
        
        while (firstSym === '1' && startIdx < symbols.length - 1) {
            startIdx++;
            firstSym = symbols[startIdx];
        }
        
        // Count consecutive matches
        let matchCount = startIdx;
        for (let i = startIdx; i < symbols.length; i++) {
            if (symbols[i] === firstSym || symbols[i] === '1') {
                matchCount++;
            } else {
                break;
            }
        }
        
        if (matchCount >= 3 && firstSym !== '2') { // Not scatter
            const payout = PAYOUTS[firstSym];
            if (payout) {
                const win = payout[5 - matchCount] || 0;
                if (win > 0) {
                    lineWins.push({
                        positions: pattern.slice(0, matchCount).map((row, i) => [row, i]),
                        info: [lineIdx, firstSym, matchCount, win]
                    });
                }
            }
        }
    }
    
    return lineWins;
}

// Generate initial sticky frames for bonus
function generateInitialFrames() {
    const frames = [];
    for (let r = 0; r < 4; r++) {
        const row = [];
        for (let c = 0; c < 5; c++) {
            if (Math.random() < 0.3) {
                row.push({
                    type: Math.random() < 0.7 ? 'multiplier' : 'jackpot',
                    value: Math.random() < 0.7 ? Math.floor(Math.random() * 10) + 2 : [25, 100, 500, 1000][Math.floor(Math.random() * 4)]
                });
            } else {
                row.push({ type: 'none', value: 0 });
            }
        }
        frames.push(row);
    }
    return frames;
}

// Start servers
httpServer.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Server running on http://localhost:${HTTP_PORT}`);
    console.log(`[HTTP] SID endpoint: http://localhost:${HTTP_PORT}/mock-wallet/sid`);
    console.log(`[HTTP] Launch endpoint: http://localhost:${HTTP_PORT}/rest/game/launch`);
});

console.log(`[WS] WebSocket server running on ws://localhost:${WS_PORT}`);
console.log('[Server] Fake TheLuxe server ready!');
console.log('[Server] Symbol IDs: WILD=1, SCATTER=2, High=201-205, Low=101-104');
