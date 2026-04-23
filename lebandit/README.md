# LeBandit Frontend Integration Guide

This guide explains how to build a frontend for the LeBandit slot game using the shared WebSocket client architecture.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Configuration](#configuration)
4. [WebSocket Connection Flow](#websocket-connection-flow)
5. [Message Handling](#message-handling)
6. [Grid Rendering](#grid-rendering)
7. [Cascade Animation](#cascade-animation)
8. [Rainbow Feature](#rainbow-feature)
9. [Bonus Games](#bonus-games)
10. [Complete Example](#complete-example)

---

## Architecture Overview

LeBandit uses a **shared WebSocket client** (`SlotGameWebSocketClient`) that handles:
- Connection management
- Authentication
- Message routing
- Ping/keep-alive

The frontend only needs to:
1. Create a `SlotGameWebSocketClient` instance
2. Register event handlers
3. Render game state based on server responses

**Key Principle:** All game logic is in the backend. The frontend is purely for rendering.

---

## Project Structure

```
slot-game/
├── shared/
│   ├── websocket-client.js    # Shared WebSocket client
│   ├── global-config.js       # Server mode & credentials
│   └── API.md                 # Full API reference
├── lebandit/
│   ├── index.html             # Game HTML
│   ├── app.js                 # Game logic & rendering
│   ├── config.js              # LeBandit-specific config
│   └── styles.css             # Game styles
└── server.js                  # Local dev server
```

---

## Configuration

### Global Config (`shared/global-config.js`)

Controls fake/real server mode and credentials:

```javascript
const GLOBAL_CONFIG = {
    serverMode: 'fake', // 'fake' for local testing, 'real' for production
    
    fakeServers: {
        lebandit: 'ws://localhost:3003'
    },
    
    realServers: {
        sidUrl: 'https://.../sid',
        launchUrl: 'https://.../game/launch',
        wsBaseUrl: 'wss://.../uat'
    },
    
    credentials: {
        authToken: 's3cr3tV4lu3',
        testUuid: 'test_uuid',
        testUserId: 'demo_has_balance',
        apiSecret: '...',
        operatorId: 'op001',
        currency: 'USD'
    },
    
    gameSettings: {
        pingInterval: 20000
    }
};
```

### LeBandit Config (`lebandit/config.js`)

Extends global config with game-specific settings:

```javascript
const CONFIG = {
    // Server settings (inherited from global)
    get serverMode() { return GLOBAL_CONFIG.serverMode; },
    get fakeWsUrl() { return GLOBAL_CONFIG.fakeServers.lebandit; },
    get wsBaseUrl() { return GLOBAL_CONFIG.realServers.wsBaseUrl; },
    
    gameTypeId: 'lebandit',
    
    // Grid dimensions
    rows: 5,
    cols: 6,
    
    // Symbol mappings
    symbols: {
        '1': '💎',      // WILD
        '2': '🎯',      // SCATTER
        '201': '👑',    // Crown
        '202': '💍',    // Ring
        '203': '🏆',    // Trophy
        '204': '💵',    // Cash
        '205': '🎰',    // Slot
        '101': '10',    // Ten
        '102': 'J',     // Jack
        '103': 'Q',     // Queen
        '104': 'K',     // King
        '105': 'A',     // Ace
        '300': '🌈',    // RAINBOW
        '301': '🪙',    // BRONZE_COIN
        '302': '🪙',    // SILVER_COIN
        '303': '🪙',    // GOLD_COIN
        '304': '🍀',    // FOUR_LEAF_CLOVER
        '305': '🏺'     // POT_OF_GOLD
    },
    
    // Rainbow mode
    rainbowMode: {
        enabled: true,
        costMultiplier: 10
    },
    
    // Bonus games
    bonusGame: {
        enabled: true,
        buyCostMultiplier: 100,
        freeSpins: 8
    },
    
    treasureBonus: {
        enabled: true,
        buyCostMultiplier: 100,
        freeSpins: 10
    }
};
```

---

## WebSocket Connection Flow

### Step 1: Create Client

```javascript
import { SlotGameWebSocketClient } from '../shared/websocket-client.js';

const wsClient = new SlotGameWebSocketClient('lebandit', CONFIG);
```

### Step 2: Register Event Handlers

```javascript
wsClient.on('joinRoom', (data) => {
    handleJoinRoom(data);
});

wsClient.on('syncRoom', (data) => {
    handleSyncRoom(data);
});

wsClient.on('setBet', (data) => {
    handleSpinResult(data);
});
```

### Step 3: Connect

```javascript
await wsClient.connect();
```

This automatically triggers:
1. `Login` (type 0)
2. `Lobby Request` (type 2)
3. `Join Room` (type 100000, subType 100004)
4. `Sync Room Info` (type 100000, subType 100070)

---

## Message Handling

### 1. Join Room Response

Fired when `subType === 100005`. Contains game configuration.

**Parameters in `data.betInfo[0]`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `symbols` | `Array<{id}>` | Available symbol IDs |
| `betSizeList` | `number[]` | Allowed bet amounts |
| `defaultBet` | `number` | Default bet size |
| `clusterPayoutsKeys` | `string[]` | Symbol IDs with payouts |
| `clusterPayouts` | `object` | Payout table by symbol ID |
| `clusterSizeLabels` | `string[]` | Cluster size column labels |
| `bonusConfig` | `object` | Bonus buy configuration |

**Example:**

```javascript
function handleJoinRoom(data) {
    const info = data.betInfo?.[0];
    
    if (info.betSizeList) {
        BET_SIZE_LIST = info.betSizeList;
    }
    
    if (info.clusterPayouts) {
        CLUSTER_PAYOUTS = info.clusterPayouts;
        renderPaytable();
    }
    
    if (info.bonusConfig) {
        BONUS_CONFIG = info.bonusConfig;
        updateBonusButtons();
    }
}
```

### 2. Sync Room Response

Fired when `subType === 100071` with `opCode: 'SyncRoomInfo'`. Used for state restoration after disconnect.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `roomInfo.lastResumeInfo.grid` | `string[][]` | Grid to restore |
| `roomInfo.lastResumeInfo.bonusGameState` | `object` | Active bonus state |

**Example:**

```javascript
function handleSyncRoom(data) {
    if (data.roomInfo?.lastResumeInfo) {
        const resume = data.roomInfo.lastResumeInfo;
        renderGrid(resume.grid);
        
        if (resume.bonusGameState) {
            showBonusProgress(resume.bonusGameState);
        }
    }
}
```

### 3. SetBet Response (Spin Result)

Fired when `subType === 100071` with `opCode: 'SetBet'`. Contains the full spin result.

**Parameters in `data.betInfo[0].gameResult`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `grid` | `string[][]` | Final 6x5 symbol grid |
| `totalWinAmount` | `number` | Total win for this spin |
| `cascadeSteps` | `array` | Step-by-step cascade data |
| `rainbowResult` | `object` | Rainbow feature result |
| `goldenSquares` | `array` | Accumulated golden square positions |
| `bonusGameState` | `object` | Active bonus state |

**Example:**

```javascript
async function handleSpinResult(data) {
    const betInfo = data.betInfo?.[0];
    const result = betInfo?.gameResult;
    
    // Update balance
    currentBalance = betInfo.finalBalance;
    
    // Render cascade animation
    if (result.cascadeSteps?.length > 0) {
        await renderCascade(result.cascadeSteps);
    }
    
    // Render final grid
    renderGrid(result.grid);
    
    // Handle rainbow feature
    if (result.rainbowResult?.hasRainbow) {
        await renderRainbowFeature(result.rainbowResult);
    }
    
    // Handle bonus state
    if (result.bonusGameState) {
        showBonusProgress(result.bonusGameState);
    }
}
```

---

## Sending Messages

### Normal Spin

```javascript
await wsClient.setBet({
    bet: 20,
    rainbowMode: false
});
```

### Rainbow Mode Spin

```javascript
await wsClient.setBet({
    bet: 20,
    rainbowMode: true  // Costs 10x
});
```

### Buy Bonus

```javascript
// Luck of the Bandit (Black & Gold style)
await wsClient.setBet({
    bet: 20,
    forceBonusType: 'LUCK_OF_THE_BANDIT'
});

// Treasure at End of Rainbow
await wsClient.setBet({
    bet: 20,
    forceBonusType: 'TREASURE_AT_END_OF_RAINBOW'
});
```

### Debug Options (Fake Server Only)

```javascript
await wsClient.setBet({
    bet: 20,
    debugScatterCount: 3,     // Force 3 scatters
    debugForceRainbow: true   // Force rainbow
});
```

---

## Grid Rendering

LeBandit uses a **6x5 grid** with **5 buffer rows above** for cascade animations.

### Grid Structure

```javascript
// Total cells: 10 rows × 6 cols = 60 cells
// Visible: rows 0-4 (5 rows)
// Buffer: rows -5 to -1 (5 rows above)

function initGrid() {
    const grid = document.getElementById('reelGrid');
    grid.innerHTML = '';
    
    // Buffer rows (hidden above)
    for (let r = -5; r < 0; r++) {
        for (let c = 0; c < 6; c++) {
            const cell = document.createElement('div');
            cell.className = 'reel-cell buffer-cell';
            cell.id = `cell-${r}-${c}`;
            grid.appendChild(cell);
        }
    }
    
    // Visible rows
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 6; c++) {
            const cell = document.createElement('div');
            cell.className = 'reel-cell';
            cell.id = `cell-${r}-${c}`;
            grid.appendChild(cell);
        }
    }
}
```

### Rendering Symbols

```javascript
function renderGrid(grid) {
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 6; c++) {
            const cell = document.getElementById(`cell-${r}-${c}`);
            const symbolId = grid[r][c];
            cell.textContent = CONFIG.symbols[symbolId] || symbolId;
            cell.dataset.symbol = symbolId;
        }
    }
}
```

---

## Cascade Animation

A cascade consists of multiple steps. Each step has:

| Field | Description |
|-------|-------------|
| `symbolGridBefore` | Grid before win removal |
| `winningClusters` | Winning clusters to highlight |
| `symbolGridAfterRemoval` | Grid after removing wins |
| `movements` | Symbols dropping + new symbols falling in |
| `symbolGridAfterDropAndFill` | Final grid for this step |
| `goldenSquares` | Golden squares created in this step |

**Animation Sequence:**
1. Show `symbolGridBefore`
2. Highlight winning clusters
3. Wait 800ms
4. Remove winning symbols
5. Show `symbolGridAfterRemoval`
6. Wait 400ms
7. Animate `movements` (drop existing + fall in new)
8. Show `symbolGridAfterDropAndFill`
9. Wait 400ms
10. Repeat for next step

---

## Rainbow Feature

The rainbow feature transforms golden squares into coins, clovers, and pots.

### Rainbow Result Structure

```javascript
{
    hasRainbow: true,
    coinWin: 75.50,
    rainbowPosition: { row: 2, col: 3 },
    rounds: [
        {
            round: 1,
            coins: [...],
            clovers: [...],
            pots: [...],
            steps: [...]
        }
    ]
}
```

### Step Types

| Step Type | Description |
|-----------|-------------|
| `initial` | First reveal of coins/clovers/pots |
| `clover` | Clover multiplies adjacent coins/pots |
| `pot` | Pot collects all coins (and smaller pots) |

---

## Bonus Games

### Bonus Game State

```javascript
{
    type: 'LUCK_OF_THE_BANDIT',
    spinsLeft: 5,
    totalSpins: 8,
    isActive: true,
    accumulatedGoldenSquares: [...]
}
```

### Detecting Bonus Entry

```javascript
const isFirstEntry = bonusState.spinsLeft === bonusState.totalSpins;
const isNewBonus = bonusState.isActive && !wasAlreadyInBonus;

if ((isFirstEntry || isNewBonus) && bonusState.spinsLeft > 0) {
    await renderBonusTrigger(bonusState);
}
```

### Golden Squares in Bonus

Golden squares accumulate across bonus spins and persist until the rainbow feature resolves them.

```javascript
function renderGoldenSquares(squares) {
    const overlay = document.getElementById('goldenSquaresOverlay');
    overlay.innerHTML = '';
    
    for (const sq of squares) {
        if (sq.row < 0 || sq.row >= 5) continue;
        
        const el = document.createElement('div');
        el.className = 'golden-square';
        el.style.gridColumn = sq.col + 1;
        el.style.gridRow = sq.row + 1;
        overlay.appendChild(el);
    }
}
```

---

## Complete Example

Here's a minimal complete frontend:

```html
<!DOCTYPE html>
<html>
<head>
    <title>LeBandit</title>
    <script src="../shared/global-config.js"></script>
    <script src="../shared/websocket-client.js"></script>
    <script src="config.js"></script>
</head>
<body>
    <div id="balance">Balance: $0</div>
    <div id="reelGrid"></div>
    <div id="goldenSquaresOverlay"></div>
    <button id="spinBtn" onclick="spin()">Spin ($20)</button>
    <button id="rainbowBtn" onclick="spinRainbow()">Rainbow ($200)</button>
    
    <script>
        let wsClient;
        let balance = 0;
        let bet = 20;
        
        // Initialize
        async function init() {
            initGrid();
            
            wsClient = new SlotGameWebSocketClient('lebandit', CONFIG);
            
            wsClient.on('joinRoom', (data) => {
                const info = data.betInfo?.[0];
                if (info?.betSizeList) {
                    bet = info.defaultBet || info.betSizeList[0];
                }
            });
            
            wsClient.on('syncRoom', (data) => {
                if (data.roomInfo?.lastResumeInfo?.grid) {
                    renderGrid(data.roomInfo.lastResumeInfo.grid);
                }
            });
            
            wsClient.on('setBet', (data) => {
                const betInfo = data.betInfo?.[0];
                const result = betInfo?.gameResult;
                
                balance = betInfo.finalBalance || 0;
                document.getElementById('balance').textContent = `Balance: $${balance}`;
                
                renderGrid(result.grid);
                
                if (result.goldenSquares?.length > 0) {
                    renderGoldenSquares(result.goldenSquares);
                }
            });
            
            await wsClient.connect();
        }
        
        function initGrid() {
            const grid = document.getElementById('reelGrid');
            for (let r = -5; r < 5; r++) {
                for (let c = 0; c < 6; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'reel-cell' + (r < 0 ? ' buffer-cell' : '');
                    cell.id = `cell-${r}-${c}`;
                    grid.appendChild(cell);
                }
            }
        }
        
        function renderGrid(gridData) {
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 6; c++) {
                    const cell = document.getElementById(`cell-${r}-${c}`);
                    const symbolId = gridData?.[r]?.[c] || '';
                    cell.textContent = CONFIG.symbols[symbolId] || symbolId;
                }
            }
        }
        
        function renderGoldenSquares(squares) {
            const overlay = document.getElementById('goldenSquaresOverlay');
            overlay.innerHTML = '';
            for (const sq of squares) {
                if (sq.row < 0 || sq.row >= 5) continue;
                const el = document.createElement('div');
                el.className = 'golden-square';
                el.style.left = `${sq.col * 60}px`;
                el.style.top = `${sq.row * 60}px`;
                overlay.appendChild(el);
            }
        }
        
        async function spin() {
            document.getElementById('spinBtn').disabled = true;
            await wsClient.setBet({ bet, rainbowMode: false });
            document.getElementById('spinBtn').disabled = false;
        }
        
        async function spinRainbow() {
            document.getElementById('rainbowBtn').disabled = true;
            await wsClient.setBet({ bet, rainbowMode: true });
            document.getElementById('rainbowBtn').disabled = false;
        }
        
        init().catch(console.error);
    </script>
</body>
</html>
```

---

## Running the Game

### Local Development (Fake Server)

```bash
# Terminal 1: Start fake WebSocket server
cd /path/to/backend
node fake-ws-server.js

# Terminal 2: Start frontend server
cd slot-game
node server.js

# Open http://localhost:8080/lebandit/
```

### Production (Real Server)

Change `GLOBAL_CONFIG.serverMode` to `'real'` in `shared/global-config.js`.

---

## Additional Resources

- **Full API Reference:** `../shared/API.md`
- **Backend Integration:** `minesweeper_login_lambda/src/services/game/lebandit/`
- **WebSocket Client:** `../shared/websocket-client.js`
