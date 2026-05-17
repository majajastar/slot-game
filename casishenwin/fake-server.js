const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Game configuration matching backend
const CONFIG = {
    rows: 5,
    cols: 6,
    topRowCols: 4,
    topRowStartCol: 1
};

// Symbol definitions with weights matching backend
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

// Paytable matching backend
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

// Multi-row occupancy config
const ROW_OCCUPANCY = {
    '1': { minRows: 2, maxRows: 3, chance: 0.5 },
    '201': { minRows: 2, maxRows: 4, chance: 0.4 },
    '202': { minRows: 2, maxRows: 3, chance: 0.35 },
    '203': { minRows: 2, maxRows: 4, chance: 0.3 },
    '204': { minRows: 2, maxRows: 3, chance: 0.25 },
    '205': { minRows: 2, maxRows: 4, chance: 0.35 },
    '101': { minRows: 2, maxRows: 4, chance: 0.5 },
    '102': { minRows: 2, maxRows: 3, chance: 0.45 },
    '103': { minRows: 2, maxRows: 4, chance: 0.4 },
    '104': { minRows: 2, maxRows: 3, chance: 0.35 },
    '105': { minRows: 2, maxRows: 4, chance: 0.45 }
};

// Helper functions
function getRandomSymbol() {
    const entries = Object.values(SYMBOLS);
    const totalWeight = entries.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const symbol of entries) {
        random -= symbol.weight;
        if (random <= 0) return symbol.id;
    }
    return SYMBOLS.CROWN.id;
}

function determineRowOccupancy(symbolId, colIndex) {
    if (colIndex === 0 || colIndex === 5) return 1;
    
    const config = ROW_OCCUPANCY[symbolId];
    if (!config) return 1;
    
    if (Math.random() > config.chance) return 1;
    
    const range = config.maxRows - config.minRows + 1;
    return config.minRows + Math.floor(Math.random() * range);
}

function generateGrid() {
    const grid = [];
    const occupancyMap = [];
    
    for (let col = 0; col < CONFIG.cols; col++) {
        const column = [];
        const colOccupancy = [];
        let row = 0;
        
        while (row < CONFIG.rows) {
            const symbol = getRandomSymbol();
            const occupancy = determineRowOccupancy(symbol, col);
            const actualOccupancy = Math.min(occupancy, CONFIG.rows - row);
            
            for (let i = 0; i < actualOccupancy; i++) {
                column.push(symbol);
                colOccupancy.push(actualOccupancy);
            }
            
            row += actualOccupancy;
        }
        
        grid.push(column);
        occupancyMap.push(colOccupancy);
    }
    
    // Transpose to row-major
    const rowMajor = [];
    for (let row = 0; row < CONFIG.rows; row++) {
        const rowData = [];
        for (let col = 0; col < CONFIG.cols; col++) {
            rowData.push(grid[col][row]);
        }
        rowMajor.push(rowData);
    }
    
    return { grid: rowMajor, occupancyMap };
}

function generateTopRow() {
    const topRow = [];
    for (let col = 0; col < CONFIG.topRowCols; col++) {
        topRow.push(getRandomSymbol());
    }
    return topRow;
}

function applyFrames(grid) {
    const frames = new Map();
    
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            const symbol = grid[row][col];
            
            if (FRAME_CONFIG.excludedSymbols.includes(symbol)) continue;
            if (!FRAME_CONFIG.eligibleSymbols.includes(symbol)) continue;
            
            if (Math.random() < FRAME_CONFIG.silverFrameChance) {
                const key = `${row},${col}`;
                frames.set(key, 'silver');
            }
        }
    }
    
    return frames;
}

function findClusters(grid, topRow) {
    const clusters = [];
    const visited = new Set();
    
    // Check all positions including top row
    const positionsToCheck = [];
    
    // Add top row positions (row -1)
    for (let col = CONFIG.topRowStartCol; col < CONFIG.topRowStartCol + CONFIG.topRowCols; col++) {
        positionsToCheck.push({ row: -1, col });
    }
    
    // Add main grid positions
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            positionsToCheck.push({ row, col });
        }
    }
    
    for (const pos of positionsToCheck) {
        const key = `${pos.row},${pos.col}`;
        if (visited.has(key)) continue;
        
        const symbol = getSymbolAt(grid, topRow, pos.row, pos.col);
        if (!symbol || symbol === '2') continue; // Skip scatter
        
        const cluster = floodFill(grid, topRow, pos.row, pos.col, symbol, visited);
        if (cluster.length >= 5) {
            const payout = getClusterPayout(symbol, cluster.length);
            
            // Calculate WinRoad
            const colCounts = new Map();
            for (const p of cluster) {
                colCounts.set(p.col, (colCounts.get(p.col) || 0) + 1);
            }
            
            let winRoad = 1;
            for (const count of colCounts.values()) {
                winRoad *= count;
            }
            
            clusters.push({
                symbol,
                count: cluster.length,
                positions: cluster,
                payout,
                winRoad
            });
        }
    }
    
    return clusters;
}

function getSymbolAt(grid, topRow, row, col) {
    if (row === -1) {
        if (col >= CONFIG.topRowStartCol && col < CONFIG.topRowStartCol + CONFIG.topRowCols) {
            return topRow[col - CONFIG.topRowStartCol];
        }
        return null;
    }
    return grid[row][col];
}

function floodFill(grid, topRow, startRow, startCol, targetSymbol, visited) {
    const cluster = [];
    const queue = [{ row: startRow, col: startCol }];
    visited.add(`${startRow},${startCol}`);
    
    while (queue.length > 0) {
        const current = queue.shift();
        cluster.push(current);
        
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of directions) {
            const newRow = current.row + dr;
            const newCol = current.col + dc;
            
            if (newCol < 0 || newCol >= CONFIG.cols) continue;
            if (newRow < -1 || newRow >= CONFIG.rows) continue;
            if (newRow === -1 && (newCol < CONFIG.topRowStartCol || newCol >= CONFIG.topRowStartCol + CONFIG.topRowCols)) continue;
            
            const key = `${newRow},${newCol}`;
            if (visited.has(key)) continue;
            
            const symbol = getSymbolAt(grid, topRow, newRow, newCol);
            if (symbolsMatch(symbol, targetSymbol)) {
                visited.add(key);
                queue.push({ row: newRow, col: newCol });
            }
        }
    }
    
    return cluster;
}

function symbolsMatch(a, b) {
    if (a === '1' || b === '1') return true;
    return a === b;
}

function getClusterPayout(symbol, count) {
    const payouts = PAYTABLE[symbol];
    if (!payouts) return 0;
    const index = Math.min(count, 6);
    return payouts[index] || 0;
}

function calculateWin(clusters) {
    let totalWin = 0;
    for (const cluster of clusters) {
        totalWin += cluster.payout * cluster.winRoad;
    }
    return totalWin;
}

function applyCascade(grid, topRow, clusters) {
    const newGrid = grid.map(row => [...row]);
    const newTopRow = [...topRow];
    
    const winningPositions = new Set();
    for (const cluster of clusters) {
        for (const pos of cluster.positions) {
            winningPositions.add(`${pos.row},${pos.col}`);
        }
    }
    
    // Remove from main grid
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            if (winningPositions.has(`${row},${col}`)) {
                newGrid[row][col] = '';
            }
        }
    }
    
    // Remove from top row
    for (let col = CONFIG.topRowStartCol; col < CONFIG.topRowStartCol + CONFIG.topRowCols; col++) {
        if (winningPositions.has(`-1,${col}`)) {
            newTopRow[col - CONFIG.topRowStartCol] = '';
        }
    }
    
    // Apply gravity
    for (let col = 0; col < CONFIG.cols; col++) {
        const column = [];
        for (let row = CONFIG.rows - 1; row >= 0; row--) {
            if (newGrid[row][col] !== '') {
                column.push(newGrid[row][col]);
            }
        }
        
        for (let row = CONFIG.rows - 1; row >= 0; row--) {
            const idx = CONFIG.rows - 1 - row;
            newGrid[row][col] = idx < column.length ? column[idx] : '';
        }
    }
    
    return { grid: newGrid, topRow: newTopRow };
}

function fillGrid(grid, topRow) {
    const newGrid = grid.map(row => [...row]);
    const newTopRow = [...topRow];
    
    // Fill main grid
    for (let col = 0; col < CONFIG.cols; col++) {
        let row = 0;
        while (row < CONFIG.rows) {
            if (newGrid[row][col] === '') {
                const symbol = getRandomSymbol();
                const occupancy = determineRowOccupancy(symbol, col);
                const actualOccupancy = Math.min(occupancy, CONFIG.rows - row);
                
                for (let i = 0; i < actualOccupancy; i++) {
                    if (row + i < CONFIG.rows && newGrid[row + i][col] === '') {
                        newGrid[row + i][col] = symbol;
                    }
                }
                
                row += actualOccupancy;
            } else {
                row++;
            }
        }
    }
    
    // Fill top row
    for (let i = 0; i < CONFIG.topRowCols; i++) {
        if (newTopRow[i] === '') {
            newTopRow[i] = getRandomSymbol();
        }
    }
    
    return { grid: newGrid, topRow: newTopRow };
}

function rollTopRow(topRow) {
    const newSymbol = getRandomSymbol();
    return [newSymbol, ...topRow.slice(0, -1)];
}

function executeCascade(initialGrid, initialTopRow) {
    const steps = [];
    let currentGrid = initialGrid.map(row => [...row]);
    let currentTopRow = [...initialTopRow];
    let totalWin = 0;
    let stepCount = 0;
    
    while (true) {
        const clusters = findClusters(currentGrid, currentTopRow);
        if (clusters.length === 0) break;
        
        const stepWin = calculateWin(clusters);
        totalWin += stepWin;
        stepCount++;
        
        steps.push({
            step: stepCount,
            gridBefore: currentGrid.map(row => [...row]),
            topRowBefore: [...currentTopRow],
            winningClusters: clusters,
            totalWin: stepWin
        });
        
        const cascadeResult = applyCascade(currentGrid, currentTopRow, clusters);
        currentGrid = cascadeResult.grid;
        currentTopRow = cascadeResult.topRow;
        
        const fillResult = fillGrid(currentGrid, currentTopRow);
        currentGrid = fillResult.grid;
        currentTopRow = fillResult.topRow;
        
        currentTopRow = rollTopRow(currentTopRow);
    }
    
    return {
        grid: currentGrid,
        topRow: currentTopRow,
        steps,
        totalWin
    };
}

function countScatters(grid, topRow) {
    let count = 0;
    
    for (let row = 0; row < CONFIG.rows; row++) {
        for (let col = 0; col < CONFIG.cols; col++) {
            if (grid[row][col] === '2') count++;
        }
    }
    
    for (const symbol of topRow) {
        if (symbol === '2') count++;
    }
    
    return count;
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

// Client state management
const clients = new Map();

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    const clientId = Date.now().toString();
    const clientState = {
        balance: 1000,
        bet: 1,
        grid: null,
        topRow: null,
        frames: new Map()
    };
    clients.set(clientId, clientState);
    
    // Send initial state
    const initialGrid = generateGrid();
    const initialTopRow = generateTopRow();
    clientState.grid = initialGrid.grid;
    clientState.topRow = initialTopRow;
    
    ws.send(JSON.stringify({
        type: 'init',
        data: {
            balance: clientState.balance,
            grid: initialGrid.grid,
            topRow: initialTopRow,
            frames: Array.from(applyFrames(initialGrid.grid).entries())
        }
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const client = clients.get(clientId);
            
            switch (data.type) {
                case 'spin':
                    handleSpin(ws, client, data);
                    break;
                case 'setBet':
                    handleSetBet(ws, client, data);
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
        clients.delete(clientId);
    });
});

function handleSpin(ws, client, data) {
    const bet = data.bet || client.bet || 1;
    
    if (client.balance < bet) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Insufficient balance'
        }));
        return;
    }
    
    client.balance -= bet;
    
    // Generate new grid or use existing
    const gridResult = generateGrid();
    const topRow = generateTopRow();
    
    client.grid = gridResult.grid;
    client.topRow = topRow;
    
    // Apply frames
    const frames = applyFrames(gridResult.grid);
    
    // Execute cascade
    const cascadeResult = executeCascade(gridResult.grid, topRow);
    
    // Calculate total win
    const win = cascadeResult.totalWin * bet;
    client.balance += win;
    
    // Update client state
    client.grid = cascadeResult.grid;
    client.topRow = cascadeResult.topRow;
    
    ws.send(JSON.stringify({
        type: 'spinResult',
        data: {
            grid: gridResult.grid,
            topRow: topRow,
            steps: cascadeResult.steps,
            totalWin: win,
            balance: client.balance,
            frames: Array.from(frames.entries()),
            scatterCount: countScatters(cascadeResult.grid, cascadeResult.topRow)
        }
    }));
}

function handleSetBet(ws, client, data) {
    client.bet = data.bet || 1;
    
    ws.send(JSON.stringify({
        type: 'betSet',
        data: {
            bet: client.bet,
            balance: client.balance
        }
    }));
}

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
    console.log(`Casishenwin Fake Server running on port ${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log(`HTTP: http://localhost:${PORT}`);
});
