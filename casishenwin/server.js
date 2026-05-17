const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Game configuration
const CONFIG = {
    rows: 5,
    cols: 6,
    topRowCols: 4,
    topRowStartCol: 1
};

// Symbol definitions
const SYMBOLS = {
    WILD: { id: '1', emoji: '💎', weight: 5 },
    SCATTER: { id: '2', emoji: '⭐', weight: 3 },
    CROWN: { id: '201', emoji: '👑', weight: 10 },
    RING: { id: '202', emoji: '💍', weight: 10 },
    TROPHY: { id: '203', emoji: '🏆', weight: 10 },
    CASH: { id: '204', emoji: '💵', weight: 10 },
    CARD: { id: '205', emoji: '🎴', weight: 10 },
    SPADE: { id: '101', emoji: '♠️', weight: 15 },
    HEART: { id: '102', emoji: '♥️', weight: 15 },
    DIAMOND: { id: '103', emoji: '♦️', weight: 15 },
    CLUB: { id: '104', emoji: '♣️', weight: 15 },
    JOKER: { id: '105', emoji: '🃏', weight: 15 }
};

// Paytable
const PAYTABLE = {
    '201': { 3: 0.5, 4: 1.5, 5: 5, 6: 15 },
    '202': { 3: 0.5, 4: 1.5, 5: 5, 6: 15 },
    '203': { 3: 0.5, 4: 1.5, 5: 5, 6: 15 },
    '204': { 3: 0.5, 4: 1.5, 5: 5, 6: 15 },
    '205': { 3: 0.5, 4: 1.5, 5: 5, 6: 15 },
    '101': { 3: 0.2, 4: 0.5, 5: 2, 6: 8 },
    '102': { 3: 0.2, 4: 0.5, 5: 2, 6: 8 },
    '103': { 3: 0.2, 4: 0.5, 5: 2, 6: 8 },
    '104': { 3: 0.2, 4: 0.5, 5: 2, 6: 8 },
    '105': { 3: 0.2, 4: 0.5, 5: 2, 6: 8 },
    '1': { 3: 1, 4: 3, 5: 10, 6: 25 }
};

// Frame configuration
const FRAME_CONFIG = {
    silverFrameChance: 0.10,
    eligibleSymbols: ['201', '202', '203', '204', '205', '101', '102', '103', '104', '105'],
    excludedSymbols: ['1', '2'],
    minRowSpan: 2,
    maxRowSpan: 4
};

// Generate random symbol
function getRandomSymbol() {
    const totalWeight = Object.values(SYMBOLS).reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const symbol of Object.values(SYMBOLS)) {
        random -= symbol.weight;
        if (random <= 0) return symbol.id;
    }
    return SYMBOLS.CROWN.id;
}

// Generate grid
function generateGrid() {
    const grid = [];
    for (let row = 0; row < CONFIG.rows; row++) {
        const rowData = [];
        for (let col = 0; col < CONFIG.cols; col++) {
            rowData.push(getRandomSymbol());
        }
        grid.push(rowData);
    }
    return grid;
}

// Generate top row
function generateTopRow() {
    const topRow = [];
    for (let col = 0; col < CONFIG.topRowCols; col++) {
        topRow.push(getRandomSymbol());
    }
    return topRow;
}

// Apply frames to multi-row symbols
function applyFrames(grid) {
    const frames = new Map();
    
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            const symbol = grid[row][col];
            
            // Check eligibility
            if (FRAME_CONFIG.excludedSymbols.includes(symbol)) continue;
            if (!FRAME_CONFIG.eligibleSymbols.includes(symbol)) continue;
            
            // For demo, randomly apply silver frame
            if (Math.random() < FRAME_CONFIG.silverFrameChance) {
                const key = `${row},${col}`;
                frames.set(key, 'silver');
            }
        }
    }
    
    return frames;
}

// Calculate win (simplified)
function calculateWin(grid, topRow) {
    // This is a simplified win calculation for demo
    // Real implementation would check clusters and calculate WinRoad
    let win = 0;
    
    // Random win for demo
    if (Math.random() > 0.6) {
        win = Math.random() * 5;
    }
    
    return win;
}

// Create HTTP server for static files
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Send initial state
    ws.send(JSON.stringify({
        type: 'init',
        data: {
            balance: 1000,
            grid: generateGrid(),
            topRow: generateTopRow()
        }
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'spin':
                    handleSpin(ws, data);
                    break;
                case 'setBet':
                    handleSetBet(ws, data);
                    break;
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type'
                    }));
            }
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Handle spin
function handleSpin(ws, data) {
    const bet = data.bet || 1;
    const grid = generateGrid();
    const topRow = generateTopRow();
    const frames = applyFrames(grid);
    const win = calculateWin(grid, topRow);
    
    ws.send(JSON.stringify({
        type: 'spinResult',
        data: {
            grid,
            topRow,
            frames: Array.from(frames.entries()),
            win,
            balance: 1000 + win // Simplified balance update
        }
    }));
}

// Handle set bet
function handleSetBet(ws, data) {
    ws.send(JSON.stringify({
        type: 'betSet',
        data: {
            bet: data.bet,
            balance: 1000
        }
    }));
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
