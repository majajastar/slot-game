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
10. [Bonus Boost Mode](#bonus-boost-mode)
11. [Complete Example](#complete-example)

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
    
    // Bonus Boost mode - cost multiplier from server
    bonusBoostMode: {
        enabled: true,
        costMultiplier: 5,  // Default, will be updated from server config
        description: '3x bonus entry chance'
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

**Bonus Config Structure:**

```javascript
{
    buyBonusEnabled: true,
    rainbowModeEnabled: true,
    rainbowModeCostMultiplier: 10,
    bonusBoostEnabled: true,        // Whether bonus boost is available
    bonusBoostCostMultiplier: 3,    // Cost multiplier for bonus boost mode
    bonusGames: [
        {
            typeId: 1,
            name: 'Luck of the Bandit',
            buyCostMultiplier: 100,
            freeSpins: 8,
            description: '8 spins with accumulating golden squares'
        },
        // ... more bonus games
    ]
}
```

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
        
        // Update bonus boost cost multiplier from server
        if (info.bonusConfig.bonusBoostCostMultiplier) {
            bonusBoostCostMultiplier = info.bonusConfig.bonusBoostCostMultiplier;
            updateBonusBoostText();
        }
        
        updateBonusButtons();
    }
}
```

### 2. Sync Room Response

Fired when `subType === 100071` with `opCode: 'SyncRoomInfo'`. Used for state restoration after disconnect.

**Parameters in `data.roomInfo.lastResumeInfo`:**

The `lastResumeInfo` contains the full `SpinResult` from the last spin, including:

| Parameter | Type | Description |
|-----------|------|-------------|
| `grid` | `string[][]` | Final symbol grid (6x5) |
| `totalWinAmount` | `number` | Total win from last spin |
| `cascadeSteps` | `array` | Cascade step data (if cascade occurred) |
| `rainbowResult` | `object` | Rainbow feature result (if triggered) |
| `goldenSquares` | `array` | Golden square positions |
| `bonusGameState` | `object` | Active bonus game state |
| `bet` | `number` | Bet amount |
| `cost` | `number` | Cost amount |

**Note:** `lastResumeInfo` is only present if there was a previous spin in this session.

**Example:**

```javascript
function handleSyncRoom(data) {
    if (data.roomInfo?.lastResumeInfo) {
        const resume = data.roomInfo.lastResumeInfo;
        
        // Restore the grid
        if (resume.grid) {
            renderGrid(resume.grid);
        }
        
        // Restore golden squares
        if (resume.goldenSquares?.length > 0) {
            renderGoldenSquares(resume.goldenSquares);
        } else {
            clearGoldenSquares();
        }
        
        // Restore bonus game state
        if (resume.bonusGameState?.isActive) {
            showBonusProgress(resume.bonusGameState);
        }
        
        // Show last win amount
        if (resume.totalWinAmount > 0) {
            showWin(resume.totalWinAmount);
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
| `totalWinAmount` | `number` | Total win for this spin (includes cascade + rainbow) |
| `cascadeSteps` | `array` | Step-by-step cascade data |
| `cascadeWin` | `number` | Win from cascade only |
| `rainbowResult` | `object` | Rainbow feature result |
| `totalCoinWin` | `number` | Win from rainbow feature (with bet applied) |
| `goldenSquares` | `array` | Accumulated golden square positions |
| `bonusGameState` | `object` | Active bonus state |
| `bet` | `number` | Bet amount |
| `cost` | `number` | Cost amount (bet × multipliers) |
| `isRainbowMode` | `boolean` | Whether rainbow mode was active |

**Example:**

```javascript
async function handleSpinResult(data) {
    const betInfo = data.betInfo?.[0];
    const result = betInfo?.gameResult;
    
    // Update balance
    currentBalance = betInfo.finalBalance;
    
    // Render cascade animation (if there are cascade steps)
    if (result.cascadeSteps?.length > 0) {
        await renderCascade(result.cascadeSteps, result.totalWinAmount);
        // Render final grid after cascade completes
        if (result.grid) {
            renderGrid(result.grid, true);
        }
    } else {
        // Simple grid render (no cascade)
        renderGrid(result.grid);
        showWin(result.totalWinAmount);
    }
    
    // Render golden squares
    if (result.goldenSquares?.length > 0) {
        renderGoldenSquares(result.goldenSquares);
    } else {
        clearGoldenSquares();
    }
    
    // Handle rainbow feature
    if (result.rainbowResult?.hasRainbow) {
        await renderRainbowFeature(result.rainbowResult, result.goldenSquares);
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
    rainbowMode: false,
    bonusBoost: false
});
```

### Rainbow Mode Spin

```javascript
await wsClient.setBet({
    bet: 20,
    rainbowMode: true,  // Costs 10x
    bonusBoost: false
});
```

### Bonus Boost Mode Spin

```javascript
await wsClient.setBet({
    bet: 20,
    rainbowMode: false,
    bonusBoost: true    // Costs 3x (configurable server-side), 3x bonus entry chance
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
    debugForceRainbow: true,    // Force rainbow
    bonusBoost: true          // Enable bonus boost mode
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
    totalCoinWin: 75.50,
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

### Rainbow Result Fields

| Field | Type | Description |
|-------|------|-------------|
| `hasRainbow` | boolean | Whether rainbow feature triggered |
| `totalCoinWin` | number | Total win amount from rainbow (with bet) |
| `rainbowPosition` | object | Position of rainbow symbol `{row, col}` |
| `rounds` | array | Collection rounds with coins/clovers/pots |

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
    type: 'LUCK_OF_THE_BANDIT',           // Bonus type name
    typeId: 1,                            // 1=Luck, 2=Glitters, 3=Treasure
    spinsLeft: 5,
    totalSpins: 8,                        // Total spins including retriggered spins
    accumulatedGoldenSquares: [...],      // For Luck of the Bandit (persists until rainbow)
    persistentGoldenSquares: [...],       // For Glitters/Treasure
    totalWin: 150.50,                     // Accumulated bonus win
    isActive: true,
    retriggerInfo: {                      // If retriggered
        scatterCount: 3,
        freeSpinsAdded: 4,
        targetBonusId: 0
    }
}
```

### Detecting Bonus Entry

```javascript
const bonusState = result.bonusGameState;

// Check if this is first entry (spinsLeft === totalSpins) or retrigger
const isFirstEntry = bonusState.spinsLeft === bonusState.totalSpins && !bonusGameActive;
const isNewBonus = bonusState.isActive && !bonusGameActive;

if ((isFirstEntry || isNewBonus) && bonusState.spinsLeft > 0) {
    // Show bonus trigger overlay
    await renderBonusTrigger(bonusState, result.grid);
}

// Update bonus progress display
if (bonusState.isActive && bonusState.spinsLeft > 0) {
    bonusGameActive = true;
    showBonusProgress(bonusState);
} else {
    bonusGameActive = false;
    hideBonusProgress();
}
```

### Golden Squares in Bonus

Golden squares accumulate across bonus spins and persist until the rainbow feature triggers.

**Luck of the Bandit Mode:**
- Golden squares persist between spins
- They accumulate until a rainbow symbol appears
- When rainbow triggers, all golden squares are resolved (coins/clovers/pots placed)
- After rainbow resolves, golden squares are cleared
- If no rainbow in a spin, golden squares carry over to next spin

**Glitters/Treasure Mode:**
- Golden squares persist for entire bonus duration
- Multiple rainbow triggers can occur, each using available golden squares

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
    <button id="boostBtn" onclick="spinBonusBoost()">Boost ($60)</button>
    
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
            await wsClient.setBet({ bet, rainbowMode: true, bonusBoost: false });
            document.getElementById('rainbowBtn').disabled = false;
        }
        
        async function spinBonusBoost() {
            document.getElementById('boostBtn').disabled = true;
            await wsClient.setBet({ bet, rainbowMode: false, bonusBoost: true });
            document.getElementById('boostBtn').disabled = false;
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

---

## Bonus Boost Mode

Bonus Boost mode increases the chance of entering bonus games during normal spins.

### How It Works

- **Cost**: 3x normal bet (configurable server-side via `bonusBoostCostMultiplier`)
- **Effect**: 3x higher bonus entry chance (increased scatter weights)
- **Server-driven**: Cost multiplier comes from backend config, not hardcoded

### Configuration

Backend config (`bonus-buy-config.ts`):

```typescript
export const DEFAULT_BONUS_BOOST_CONFIG: BonusBoostConfig = {
    enabled: true,
    costMultiplier: 3,        // 3x bet cost
    bonusBoostMultiplier: 5,    // 5x scatter weight multiplier
    description: '3x cost with 5x bonus entry chance'
}
```

### Frontend Implementation

```javascript
// State variables
let bonusBoostEnabled = false;
let bonusBoostCostMultiplier = 5; // Updated from server

// Toggle function
function toggleBonusBoostMode() {
    const checkbox = document.getElementById('bonusBoostCheck');
    bonusBoostEnabled = checkbox.checked;
    updateBetDisplay();
}

// Update display text from server config
function updateBonusBoostText() {
    const textEl = document.getElementById('bonusBoostText');
    if (textEl) {
        textEl.textContent = `🚀 Bonus Boost (${bonusBoostCostMultiplier}x)`;
    }
}

// Calculate total cost
function updateBetDisplay() {
    const bet = BET_SIZE_LIST[CURRENT_BET_INDEX];
    let cost = bet;
    if (rainbowModeEnabled) cost *= RAINBOW_MODE_COST_MULTIPLIER;
    if (bonusBoostEnabled) cost *= bonusBoostCostMultiplier;
    
    // Update spin button to show total cost
    const spinBtn = document.getElementById('spinButton');
    if (cost !== bet) {
        spinBtn.textContent = `🎰 SPIN ($${cost})`;
    } else {
        spinBtn.textContent = '🎰 SPIN';
    }
}
```

### HTML Toggle

```html
<div class="bonus-boost-toggle">
    <label class="toggle-label">
        <input type="checkbox" id="bonusBoostCheck" onchange="toggleBonusBoostMode()">
        <span class="toggle-slider"></span>
        <span class="toggle-text" id="bonusBoostText">🚀 Bonus Boost (3x)</span>
    </label>
    <div class="bonus-boost-desc">3x bonus entry chance</div>
</div>
```

### CSS Styles

```css
.bonus-boost-toggle {
    margin: 10px 0;
    padding: 10px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 8px;
    text-align: center;
}

.bonus-boost-toggle .toggle-text {
    font-weight: bold;
    background: linear-gradient(45deg, #ff6b6b, #ee5a5a);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
```
