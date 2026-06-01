# Casishenwin Frontend Integration Guide

**Purpose:** Build a new frontend for the Casishenwin slot game  
**Protocol:** WebSocket (JSON messages)  
**Server:** `ws://localhost:3004` (fake server) or AWS API Gateway (production)

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Connection & Authentication](#connection--authentication)
3. [Game Setup](#game-setup)
4. [Grid Rendering](#grid-rendering)
   - [Single-Row Symbols](#single-row-symbols)
   - [Multi-Row Symbols](#multi-row-symbols)
5. [Spin Flow](#spin-flow)
6. [Cascade Animation](#cascade-animation)
7. [Bonus System](#bonus-system)
8. [Complete Example](#complete-example)

---

## Getting Started

### What You Need to Build

1. **WebSocket client** - Connect to the game server
2. **Grid renderer** - Display 5x6 main grid + 4-cell top row
3. **Spin handler** - Send bets and receive results
4. **Cascade animator** - Animate symbol removals and drops
5. **Multi-row symbol renderer** - Handle symbols spanning 2-4 rows
6. **Bonus UI** - Handle gambling and free spins

### Grid Layout

```
Top Row (cols 1-4):    [  ?  ] [  ?  ] [  ?  ] [  ?  ]
                         
Main Grid (5 rows x 6 cols):
Row 0:  [ sym ] [ sym ] [ sym ] [ sym ] [ sym ] [ sym ]
Row 1:  [ sym ] [ sym ] [ sym ] [ sym ] [ sym ] [ sym ]
Row 2:  [ sym ] [ sym ] [ sym ] [ sym ] [ sym ] [ sym ]
Row 3:  [ sym ] [ sym ] [ sym ] [ sym ] [ sym ] [ sym ]
Row 4:  [ sym ] [ sym ] [ sym ] [ sym ] [ sym ] [ sym ]
        Col 0   Col 1   Col 2   Col 3   Col 4   Col 5
```

**Key facts:**
- Main grid: 5 rows × 6 columns
- Top row: 4 symbols above columns 1-4 (rolls right to left)
- Edge columns (0, 5): Always single-row symbols
- Middle columns (1-4): Can have multi-row symbols (2-4 rows)
- WILD symbols: Always single-row

---

## Connection & Authentication

### Step 1: Connect and Login

```javascript
const ws = new WebSocket('ws://localhost:3004');

ws.onopen = () => {
  // Send login request
  ws.send(JSON.stringify({ type: '0' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleResponse(data);
};
```

**Login Response:**
```json
{
  "errCode": 0,
  "vals": {
    "type": 1,
    "data": {
      "sessionId": "fake-session-1234567890",
      "userId": "demo_user",
      "balance": 10000000000,
      "serverTime": 1234567890000
    }
  }
}
```

Store the `balance` for display. After login, request the lobby, then join the room.

---

## Game Setup

### Step 2: Join Room

```javascript
ws.send(JSON.stringify({
  type: '100000',
  data: [{ subType: 100004 }]
}));
```

**Join Room Response:**
```json
{
  "errCode": 0,
  "vals": {
    "type": 100000,
    "data": {
      "subType": 100005,
      "subData": [{
        "balance": 10000000000,
        "roomId": "casishenwin-room-001",
        "gameTypeId": "casishenwin",
        "betInfo": [{
          "symbols": [
            { "id": "1" },    // WILD
            { "id": "2" },    // SCATTER
            { "id": "201" },  // CROWN (high)
            { "id": "202" },  // RING (high)
            { "id": "101" },  // ACE (low)
            { "id": "102" }   // KING (low)
          ],
          "betSizeList": [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00],
          "defaultBet": 0.20,
          "winTable": {
            "201": [10, 25, 50, 100],
            "202": [5, 10, 20, 40]
          }
        }]
      }]
    }
  }
}
```

**Store these values:**
- `betSizeList` - For bet selector UI
- `symbols` - For symbol assets mapping
- `winTable` - For paytable display

---

## Grid Rendering

### Understanding the Grid Data

The server sends grids in two formats:

1. **`grid`** - Simple string grid (for quick reference)
```json
{
  "mainGrid": [["201", "101", "202", ...], ...],
  "topRow": ["1", "2", "201", "202"]
}
```

2. **`symbolGrid`** - Full object grid (for rendering)
```json
{
  "mainGrid": [
    [{"id": "_1", "symbol": "201"}, {"id": "_2", "symbol": "101"}, ...],
    [{"id": "_6", "symbol": "102"}, {"id": "_7", "symbol": "103"}, ...]
  ],
  "topRow": [{"id": "_31", "symbol": "1"}, ...]
}
```

**Always use `symbolGrid` for rendering** - it contains the unique `id` for each symbol instance.

### SymbolInstance Structure

```typescript
interface SymbolInstance {
  id: string;           // Unique ID per symbol instance (e.g., "_1", "_42")
  symbol: string;       // Symbol type (e.g., "201"=CROWN, "1"=WILD)
  frame?: 'silver' | 'golden'; // Optional frame state
}
```

---

## Single-Row Symbols

Most symbols occupy exactly 1 cell. Render them normally:

```javascript
function renderSingleRowSymbol(cell, row, col) {
  const element = document.createElement('div');
  element.className = `symbol symbol-${cell.symbol}`;
  element.style.width = CELL_WIDTH + 'px';
  element.style.height = CELL_HEIGHT + 'px';
  element.style.left = (col * CELL_WIDTH) + 'px';
  element.style.top = (row * CELL_HEIGHT) + 'px';
  return element;
}
```

---

## Multi-Row Symbols

### What Are Multi-Row Symbols?

Multi-row symbols are symbols that occupy **2-4 consecutive rows in the same column**. They are represented by the **same `id` appearing in multiple consecutive cells**.

**Example grid with multi-row symbol:**
```json
{
  "mainGrid": [
    // Row 0
    [{"id": "_1", "symbol": "201"}, {"id": "_2", "symbol": "101"}, {"id": "_5", "symbol": "201", "frame": "silver"}, {"id": "_3", "symbol": "102"}, {"id": "_4", "symbol": "103"}, {"id": "_8", "symbol": "104"}],
    // Row 1
    [{"id": "_6", "symbol": "105"}, {"id": "_7", "symbol": "101"}, {"id": "_5", "symbol": "201", "frame": "silver"}, {"id": "_9", "symbol": "102"}, {"id": "_10", "symbol": "103"}, {"id": "_11", "symbol": "104"}],
    // Row 2
    [{"id": "_12", "symbol": "105"}, {"id": "_13", "symbol": "101"}, {"id": "_14", "symbol": "202"}, {"id": "_15", "symbol": "102"}, {"id": "_16", "symbol": "103"}, {"id": "_17", "symbol": "104"}]
  ]
}
```

**Notice:** `id: "_5"` appears in both row 0 and row 1 of column 2. This is a **2-row symbol** with a silver frame.

### How to Identify Multi-Row Symbols

```javascript
/**
 * Find all multi-row symbols in a symbolGrid
 * @param {Object} symbolGrid - The symbolGrid from server response
 * @returns {Array} - List of multi-row symbol info
 */
function findMultiRowSymbols(symbolGrid) {
  const multiRowSymbols = [];
  
  // Check each column (0-5)
  for (let col = 0; col < 6; col++) {
    const idCounts = new Map(); // id -> { count, positions }
    
    // Count occurrences of each id in this column
    for (let row = 0; row < 5; row++) {
      const cell = symbolGrid.mainGrid[row][col];
      if (!cell) continue;
      
      if (!idCounts.has(cell.id)) {
        idCounts.set(cell.id, { count: 0, positions: [] });
      }
      const info = idCounts.get(cell.id);
      info.count++;
      info.positions.push({ row, col });
    }
    
    // Find ids that appear more than once (multi-row)
    for (const [id, info] of idCounts) {
      if (info.count > 1) {
        multiRowSymbols.push({
          id,
          symbol: symbolGrid.mainGrid[info.positions[0].row][info.positions[0].col].symbol,
          rowSpan: info.count,
          startRow: info.positions[0].row,
          col: info.positions[0].col,
          positions: info.positions,
          frame: symbolGrid.mainGrid[info.positions[0].row][info.positions[0].col].frame
        });
      }
    }
  }
  
  return multiRowSymbols;
}
```

### How to Render Multi-Row Symbols

**Key rule:** Render the multi-row symbol **only at the top cell** (`startRow`). The cells below are visually part of the same symbol.

```javascript
/**
 * Render the complete grid including multi-row symbols
 * @param {Object} symbolGrid - The symbolGrid from server response
 */
function renderGrid(symbolGrid) {
  // Step 1: Find all multi-row symbols
  const multiRowSymbols = findMultiRowSymbols(symbolGrid);
  
  // Create a set of multi-row ids for quick lookup
  const multiRowIds = new Set(multiRowSymbols.map(s => s.id));
  
  // Step 2: Render each cell
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = symbolGrid.mainGrid[row][col];
      if (!cell) continue; // Empty cell (null)
      
      const multiRowInfo = multiRowSymbols.find(s => s.id === cell.id);
      
      if (multiRowInfo && multiRowInfo.startRow === row) {
        // === RENDER MULTI-ROW SYMBOL (top cell only) ===
        renderMultiRowSymbol(cell, multiRowInfo, row, col);
      } else if (multiRowInfo) {
        // === PART OF MULTI-ROW SYMBOL (not top cell) ===
        // Skip - the multi-row symbol above covers this cell
        continue;
      } else {
        // === SINGLE-ROW SYMBOL ===
        renderSingleRowSymbol(cell, row, col);
      }
    }
  }
  
  // Step 3: Render top row (always single-row)
  for (let col = 0; col < 4; col++) {
    const cell = symbolGrid.topRow[col];
    if (!cell) continue;
    renderTopRowSymbol(cell, col);
  }
}

/**
 * Render a multi-row symbol that spans multiple rows
 */
function renderMultiRowSymbol(cell, multiRowInfo, row, col) {
  const element = document.createElement('div');
  element.className = 'multi-row-symbol';
  element.dataset.symbolId = cell.id;
  
  // Add frame class if present (silver or golden)
  if (multiRowInfo.frame) {
    element.classList.add(`${multiRowInfo.frame}-frame`);
  }
  
  // Position at top cell
  element.style.left = (col * CELL_WIDTH) + 'px';
  element.style.top = (row * CELL_HEIGHT) + 'px';
  element.style.width = CELL_WIDTH + 'px';
  
  // Height spans multiple rows
  element.style.height = (multiRowInfo.rowSpan * CELL_HEIGHT) + 'px';
  
  // Higher z-index to appear above single-row symbols
  element.style.zIndex = '10';
  
  // Add symbol image
  const symbolImg = document.createElement('img');
  symbolImg.src = `/assets/symbols/${cell.symbol}.png`;
  symbolImg.style.width = '100%';
  symbolImg.style.height = '100%';
  symbolImg.style.objectFit = 'cover';
  
  element.appendChild(symbolImg);
  gridContainer.appendChild(element);
}

/**
 * Render a single-row symbol
 */
function renderSingleRowSymbol(cell, row, col) {
  const element = document.createElement('div');
  element.className = 'symbol';
  element.dataset.symbolId = cell.id;
  element.style.left = (col * CELL_WIDTH) + 'px';
  element.style.top = (row * CELL_HEIGHT) + 'px';
  element.style.width = CELL_WIDTH + 'px';
  element.style.height = CELL_HEIGHT + 'px';
  
  const symbolImg = document.createElement('img');
  symbolImg.src = `/assets/symbols/${cell.symbol}.png`;
  symbolImg.style.width = '100%';
  symbolImg.style.height = '100%';
  
  element.appendChild(symbolImg);
  gridContainer.appendChild(element);
}

/**
 * Render top row symbol (above main grid)
 */
function renderTopRowSymbol(cell, col) {
  const element = document.createElement('div');
  element.className = 'top-row-symbol';
  element.dataset.symbolId = cell.id;
  // Top row is above columns 1-4 (index 0-3 in topRow array = columns 1-4)
  element.style.left = ((col + 1) * CELL_WIDTH) + 'px';
  element.style.top = '-' + CELL_HEIGHT + 'px';
  element.style.width = CELL_WIDTH + 'px';
  element.style.height = CELL_HEIGHT + 'px';
  
  const symbolImg = document.createElement('img');
  symbolImg.src = `/assets/symbols/${cell.symbol}.png`;
  symbolImg.style.width = '100%';
  symbolImg.style.height = '100%';
  
  element.appendChild(symbolImg);
  topRowContainer.appendChild(element);
}
```

### Multi-Row Symbol Rules Summary

| Rule | Description |
|------|-------------|
| **Where** | Only middle columns (1-4) can have multi-row symbols |
| **WILD** | WILD symbols (`"1"`) are always single-row |
| **Identification** | Same `id` in multiple consecutive cells = multi-row |
| **Rendering** | Only render at `startRow` (top cell) |
| **Height** | Height = `rowSpan × CELL_HEIGHT` |
| **Frame** | `frame: "silver"` or `"golden"` - render border/frame |
| **Cascade** | All cells with same `id` removed together |

---

## Spin Flow

### Step 3: Send a Spin Request

```javascript
ws.send(JSON.stringify({
  type: '100000',
  data: [{
    subType: 100070,
    subData: [{
      opCode: 'SetBet',
      message: { bet: 1.00 }
    }]
  }]
}));
```

### Step 4: Handle Spin Response

```javascript
function handleSpinResponse(data) {
  const subData = data.vals?.data?.subData?.[0];
  if (!subData) return;
  
  // Check for errors
  if (subData.errCode !== 0) {
    console.error('Spin error:', subData.errMsg);
    if (subData.bonusGambling) {
      showGamblingUI(subData.bonusGambling);
    }
    return;
  }
  
  const gameResult = subData.gameResult;
  
  // 1. Render the initial grid
  renderGrid(gameResult.info.symbolGrid);
  
  // 2. Check for bonus gambling trigger
  if (gameResult.bonusGambling) {
    showGamblingUI(gameResult.bonusGambling);
    return; // Wait for player to gamble or enter
  }
  
  // 3. Check for bonus state
  if (gameResult.bonusGameState) {
    showBonusUI(gameResult.bonusGameState);
  }
  
  // 4. Update balance
  updateBalance(gameResult.finalBalance);
  
  // 5. Animate cascades if there are wins
  if (gameResult.info.steps.length > 0) {
    animateCascades(gameResult.info.steps);
  }
}
```

**Spin Response Structure:**
```json
{
  "gameResult": {
    "awardBase": 1.00,
    "winAmount": 25.50,
    "info": {
      "symbolGrid": { /* grid with SymbolInstance objects */ },
      "steps": [ /* cascade steps */ ],
      "totalWin": 25.50,
      "scatterCount": 2,
      "bonusGambling": null,
      "bonusGameState": null
    },
    "balance": 9999999999,
    "finalBalance": 10000000023.50
  }
}
```

---

## Cascade Animation

### Understanding Cascade Steps

When symbols form winning combinations, they are removed and new symbols drop in. Each step provides three grid states:

```typescript
interface CascadeStep {
  step: number;                        // Step number (1, 2, 3...)
  symbolGridBefore: SymbolGrid;        // Grid before removing wins
  symbolGridAfterRemoval: SymbolGrid; // Grid after removing wins (nulls where wins were)
  symbolGridAfterFill: SymbolGrid;    // Grid after new symbols dropped
  winningColumns: ColumnWin[];         // Which symbols won
  removedSymbols: SymbolRemoval[];    // Which symbols were removed
  movements: SymbolMovement[];        // Backend-calculated animation data
  totalWin: number;                   // Win amount for this step
}
```

### Cascade Animation Flow

```javascript
async function animateCascades(steps) {
  for (const step of steps) {
    // 1. Show winning symbols (highlight them)
    highlightWins(step.winningColumns);
    await wait(500); // Show wins for 500ms
    
    // 2. Remove winning symbols (fade out)
    await removeSymbols(step.removedSymbols);
    
    // 3. Show grid after removal (with nulls)
    renderGrid(step.symbolGridAfterRemoval);
    
    // 4. Animate symbols falling down
    await animateMovements(step.movements);
    
    // 5. Show grid after fill (new symbols dropped in)
    renderGrid(step.symbolGridAfterFill);
    
    // 6. Show win amount for this step
    showStepWin(step.totalWin);
  }
}
```

### Multi-Row Symbols in Cascades

When a multi-row symbol is part of a win:

```javascript
// Example: Multi-row symbol with id "_5" spanning rows 0-1 in column 2
// If it wins, BOTH cells are removed:

// Before removal:
// Row 0: [{"id":"_1"}, {"id":"_2"}, {"id":"_5"}, ...]
// Row 1: [{"id":"_6"}, {"id":"_7"}, {"id":"_5"}, ...]

// After removal:
// Row 0: [{"id":"_1"}, {"id":"_2"}, null, ...]
// Row 1: [{"id":"_6"}, {"id":"_7"}, null, ...]

// The removedSymbols array will contain BOTH cells:
// [
//   {"symbolId": "_5", "symbol": "201", "row": 0, "col": 2},
//   {"symbolId": "_5", "symbol": "201", "row": 1, "col": 2}
// ]
```

**Important:** When animating multi-row symbol removal, remove ALL cells with the same `id` simultaneously.

---

## Bonus System

### Bonus Gambling (4+ Scatters)

When a spin results in 4+ scatters, the server returns a `bonusGambling` state:

```json
{
  "bonusGambling": {
    "freeSpinIndex": 0,          // Current position in values array
    "multiplierIndex": 0,        // Current position in values array
    "freeSpinValues": [8, 10, 12, 14, 16],
    "multiplierValues": [18, 20, 22, 24],
    "canGambleFreeSpin": true,
    "canGambleMultiplier": true,
    "currentFreeSpins": 8,
    "currentMultiplier": 18
  }
}
```

**UI Actions:**

```javascript
// Gamble for more free spins
ws.send(JSON.stringify({
  type: '100000',
  data: [{
    subType: 100070,
    subData: [{
      opCode: 'SetBet',
      message: { bet: 0, action: 'freeSpin' }
    }]
  }]
}));

// Gamble for higher multiplier
ws.send(JSON.stringify({
  type: '100000',
  data: [{
    subType: 100070,
    subData: [{
      opCode: 'SetBet',
      message: { bet: 0, action: 'multiplier' }
    }]
  }]
}));

// Enter bonus with current values
ws.send(JSON.stringify({
  type: '100000',
  data: [{
    subType: 100070,
    subData: [{
      opCode: 'SetBet',
      message: { bet: 0, action: 'enter' }
    }]
  }]
}));
```

### Bonus Free Spins

During bonus, the server returns `bonusGameState`:

```json
{
  "bonusGameState": {
    "freeSpinsRemaining": 4,
    "multiplier": 20,
    "totalWin": 1250.50,
    "retriggerSpinsAwarded": 0
  }
}
```

**Note:** During bonus spins, `awardBase` is 0 (no bet deducted).

---

## Complete Example

### Minimal Working Frontend

```javascript
class CasishenwinFrontend {
  constructor() {
    this.ws = null;
    this.balance = 0;
    this.betSizeList = [];
    this.currentBet = 0.20;
    this.gridContainer = document.getElementById('grid');
    this.topRowContainer = document.getElementById('top-row');
  }
  
  async connect() {
    this.ws = new WebSocket('ws://localhost:3004');
    
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: '0' }));
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }
  
  handleMessage(data) {
    const type = data.vals?.type;
    
    if (type === 1) {
      // Login response
      this.balance = data.vals.data.balance;
      this.joinRoom();
    } else if (type === 100000) {
      const subType = data.vals.data.subType;
      
      if (subType === 100005) {
        // Join room response
        this.handleJoinRoom(data);
      } else if (subType === 100071) {
        // Spin/gamble response
        this.handleGameResult(data);
      }
    }
  }
  
  joinRoom() {
    this.ws.send(JSON.stringify({
      type: '100000',
      data: [{ subType: 100004 }]
    }));
  }
  
  handleJoinRoom(data) {
    const betInfo = data.vals.data.subData[0].betInfo[0];
    this.betSizeList = betInfo.betSizeList;
    this.currentBet = betInfo.defaultBet;
    
    // Setup bet selector UI
    this.setupBetSelector();
  }
  
  spin() {
    this.ws.send(JSON.stringify({
      type: '100000',
      data: [{
        subType: 100070,
        subData: [{
          opCode: 'SetBet',
          message: { bet: this.currentBet }
        }]
      }]
    }));
  }
  
  handleGameResult(data) {
    const subData = data.vals.data.subData[0];
    
    if (subData.errCode !== 0) {
      console.error('Error:', subData.errMsg);
      return;
    }
    
    const gameResult = subData.gameResult;
    
    // Render the grid
    this.renderGrid(gameResult.info.symbolGrid);
    
    // Handle bonus gambling
    if (gameResult.bonusGambling) {
      this.showGamblingUI(gameResult.bonusGambling);
    }
    
    // Handle bonus state
    if (gameResult.bonusGameState) {
      this.showBonusUI(gameResult.bonusGameState);
    }
    
    // Update balance
    this.balance = gameResult.finalBalance;
    this.updateBalanceDisplay();
  }
  
  // ===== GRID RENDERING =====
  
  renderGrid(symbolGrid) {
    this.gridContainer.innerHTML = '';
    this.topRowContainer.innerHTML = '';
    
    const multiRowSymbols = this.findMultiRowSymbols(symbolGrid);
    
    // Render main grid
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const cell = symbolGrid.mainGrid[row][col];
        if (!cell) continue;
        
        const multiRowInfo = multiRowSymbols.find(s => s.id === cell.id);
        
        if (multiRowInfo && multiRowInfo.startRow === row) {
          this.renderMultiRowSymbol(cell, multiRowInfo);
        } else if (!multiRowInfo) {
          this.renderSingleSymbol(cell, row, col);
        }
      }
    }
    
    // Render top row
    for (let col = 0; col < 4; col++) {
      const cell = symbolGrid.topRow[col];
      if (cell) this.renderTopRowSymbol(cell, col);
    }
  }
  
  findMultiRowSymbols(symbolGrid) {
    const multiRowSymbols = [];
    
    for (let col = 0; col < 6; col++) {
      const idCounts = new Map();
      
      for (let row = 0; row < 5; row++) {
        const cell = symbolGrid.mainGrid[row][col];
        if (!cell) continue;
        
        if (!idCounts.has(cell.id)) {
          idCounts.set(cell.id, { count: 0, positions: [] });
        }
        const info = idCounts.get(cell.id);
        info.count++;
        info.positions.push({ row, col });
      }
      
      for (const [id, info] of idCounts) {
        if (info.count > 1) {
          multiRowSymbols.push({
            id,
            rowSpan: info.count,
            startRow: info.positions[0].row,
            col: info.positions[0].col,
            positions: info.positions,
            frame: symbolGrid.mainGrid[info.positions[0].row][info.positions[0].col].frame
          });
        }
      }
    }
    
    return multiRowSymbols;
  }
  
  renderMultiRowSymbol(cell, info) {
    const el = document.createElement('div');
    el.className = `multi-row-symbol ${info.frame ? info.frame + '-frame' : ''}`;
    el.style.cssText = `
      position: absolute;
      left: ${info.col * 100}px;
      top: ${info.startRow * 100}px;
      width: 100px;
      height: ${info.rowSpan * 100}px;
      z-index: 10;
    `;
    el.innerHTML = `<img src="/assets/${cell.symbol}.png" style="width:100%;height:100%">`;
    this.gridContainer.appendChild(el);
  }
  
  renderSingleSymbol(cell, row, col) {
    const el = document.createElement('div');
    el.className = 'symbol';
    el.style.cssText = `
      position: absolute;
      left: ${col * 100}px;
      top: ${row * 100}px;
      width: 100px;
      height: 100px;
    `;
    el.innerHTML = `<img src="/assets/${cell.symbol}.png" style="width:100%;height:100%">`;
    this.gridContainer.appendChild(el);
  }
  
  renderTopRowSymbol(cell, col) {
    const el = document.createElement('div');
    el.className = 'top-row-symbol';
    el.style.cssText = `
      position: absolute;
      left: ${(col + 1) * 100}px;
      top: -100px;
      width: 100px;
      height: 100px;
    `;
    el.innerHTML = `<img src="/assets/${cell.symbol}.png" style="width:100%;height:100%">`;
    this.topRowContainer.appendChild(el);
  }
  
  // ===== UI METHODS =====
  
  setupBetSelector() {
    const selector = document.getElementById('bet-selector');
    selector.innerHTML = '';
    this.betSizeList.forEach(bet => {
      const btn = document.createElement('button');
      btn.textContent = bet.toFixed(2);
      btn.onclick = () => { this.currentBet = bet; };
      selector.appendChild(btn);
    });
  }
  
  showGamblingUI(gamblingState) {
    document.getElementById('gambling-ui').style.display = 'block';
    document.getElementById('free-spins').textContent = gamblingState.currentFreeSpins;
    document.getElementById('multiplier').textContent = gamblingState.currentMultiplier;
  }
  
  showBonusUI(bonusState) {
    document.getElementById('bonus-ui').style.display = 'block';
    document.getElementById('spins-remaining').textContent = bonusState.freeSpinsRemaining;
    document.getElementById('bonus-multiplier').textContent = bonusState.multiplier;
  }
  
  updateBalanceDisplay() {
    document.getElementById('balance').textContent = this.balance.toFixed(2);
  }
}

// Initialize
const game = new CasishenwinFrontend();
game.connect();

// Spin button
document.getElementById('spin-btn').onclick = () => game.spin();
```

---

## Symbol Reference

| ID | Symbol | Name | Type | Notes |
|----|--------|------|------|-------|
| 1 | 💎 | WILD | Special | Always single-row |
| 2 | ⭐ | SCATTER | Special | Triggers bonus gambling (4+) |
| 201 | 👑 | CROWN | High | Can be multi-row |
| 202 | 💍 | RING | High | Can be multi-row |
| 203 | 🏆 | TROPHY | High | Can be multi-row |
| 204 | 💵 | CASH | High | Can be multi-row |
| 205 | 🎴 | CARD | Medium | Can be multi-row |
| 206 | 🌟 | STAR | Medium | Can be multi-row |
| 101 | 🅰️ | ACE | Low | Can be multi-row |
| 102 | 🇰 | KING | Low | Can be multi-row |
| 103 | 🇶 | QUEEN | Low | Can be multi-row |
| 104 | 🇯 | JACK | Low | Can be multi-row |
| 105 | 🔟 | TEN | Low | Can be multi-row |

---

## Win Table Format

```javascript
// winTable[symbolID] = [3x payout, 4x payout, 5x payout, 6x payout]
{
  "201": [10, 25, 50, 100],   // CROWN
  "202": [5, 10, 20, 40],     // RING
  "203": [4, 8, 15, 30],      // TROPHY
  "204": [3, 6, 12, 24],      // CASH
  "205": [2, 5, 10, 20],      // CARD
  "206": [2, 4, 8, 16],       // STAR
  "101": [1, 3, 6, 12],       // ACE
  "102": [1, 2, 5, 10],       // KING
  "103": [1, 2, 4, 8],        // QUEEN
  "104": [1, 2, 3, 6],        // JACK
  "105": [1, 2, 3, 5]         // TEN
}
```

**Win Calculation:**
```
win = bet × payout × multiplier
ways = product of symbol counts per consecutive column
winRoad = payout × ways
totalWin = sum of all winRoad values
```

---

*Document version: 1.0*  
*For: Building new Casishenwin frontends*  
*Last updated: 2026-06-01*
