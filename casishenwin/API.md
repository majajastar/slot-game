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
8. [Buy Bonus Feature](#buy-bonus-feature)
9. [Complete Example](#complete-example)

---

## Getting Started

### What You Need to Build

1. **WebSocket client** - Connect to the game server
2. **Grid renderer** - Display 5x6 main grid + 4-cell top row
3. **Spin handler** - Send bets and receive results
4. **Cascade animator** - Animate symbol removals and drops
5. **Multi-row symbol renderer** - Handle symbols spanning 2-4 rows
6. **Bonus UI** - Handle gambling and free spins
7. **Buy Bonus UI** - Handle buy bonus feature

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
  data: [{
    subType: 100070,
    subData: [{
      opCode: 'JoinRoom',
      message: { gameTypeId: 'moneygod' }
    }]
  }]
}));
```

**Join Room Response:**
```json
{
  "errCode": 0,
  "vals": {
    "type": 100070,
    "data": {
      "subData": [{
        "subType": 100070,
        "betInfo": [{
          "symbols": [
            { "id": 1, "symbol": "1", "name": "WILD" },
            { "id": 2, "symbol": "2", "name": "SCATTER" },
            { "id": 201, "symbol": "201", "name": "CROWN" },
            { "id": 202, "symbol": "202", "name": "RING" },
            { "id": 203, "symbol": "203", "name": "TROPHY" },
            { "id": 204, "symbol": "204", "name": "CASH" },
            { "id": 205, "symbol": "205", "name": "CARD" },
            { "id": 206, "symbol": "206", "name": "STAR" },
            { "id": 101, "symbol": "101", "name": "ACE" },
            { "id": 102, "symbol": "102", "name": "KING" },
            { "id": 103, "symbol": "103", "name": "QUEEN" },
            { "id": 104, "symbol": "104", "name": "JACK" },
            { "id": 105, "symbol": "105", "name": "TEN" }
          ],
          "winTable": {
            "201": [0.5, 1.0, 2.0, 5.0],
            "202": [0.4, 0.8, 1.5, 3.0],
            "203": [0.3, 0.6, 1.0, 2.0],
            "204": [0.2, 0.4, 0.8, 1.5],
            "205": [0.2, 0.4, 0.6, 1.0],
            "206": [0.1, 0.3, 0.5, 0.8],
            "101": [0.1, 0.2, 0.4, 0.6],
            "102": [0.1, 0.2, 0.3, 0.5],
            "103": [0.05, 0.1, 0.2, 0.4],
            "104": [0.05, 0.1, 0.2, 0.3],
            "105": [0.05, 0.1, 0.15, 0.2]
          },
          "betSizeList": [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00],
          "defaultBet": 1.00,
          "buyBonus": {
            "enabled": true,
            "priceMultiplier": 50
          }
        }]
      }]
    }
  }
}
```

Store `symbols`, `winTable`, `betSizeList`, and `buyBonus` for later use.

**Buy Bonus Info (`buyBonus`):**
| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Whether the buy bonus feature is available |
| `priceMultiplier` | `number` | Cost multiplier (e.g., `50` means cost = `bet × 50`) |

Use `buyBonus.enabled` to conditionally show/hide the buy bonus button, and `buyBonus.priceMultiplier` to calculate and display the buy price dynamically.

---

## Grid Rendering

### SymbolInstance

Each cell in the grid is a `SymbolInstance` object:

```typescript
interface SymbolInstance {
  id: string;        // Unique ID (e.g., "sym_001", "sym_002")
  symbol: string;    // Symbol type (e.g., "201", "1", "2")
  frame?: string;    // "silver" or "golden" (optional)
}
```

**Key rule:** Symbols with the same `id` in the same column are the SAME multi-row symbol.

### Single-Row Symbols

Most symbols occupy exactly 1 cell:

```javascript
// Example: Single-row symbol at row 2, col 3
{
  id: "sym_007",
  symbol: "201"  // CROWN
}
```

Render as a normal 1×1 cell.

### Multi-Row Symbols

Symbols in middle columns (1-4) can span 2-4 rows. Same `id` = same symbol:

```javascript
// Example: 3-row symbol in column 2
// Row 0, col 2
{ id: "sym_012", symbol: "202" }
// Row 1, col 2
{ id: "sym_012", symbol: "202" }
// Row 2, col 2
{ id: "sym_012", symbol: "202" }
// Row 3, col 2
null  // Empty cell (symbol doesn't reach here)
```

**Multi-row symbol rules:**
- Only in middle columns (1-4)
- Edge columns (0, 5): Always single-row
- WILD ("1") and SCATTER ("2"): Always single-row
- Same `id` in same column = one symbol spanning multiple rows
- Consecutive rows only (no gaps)
- Max 4 rows per symbol

**How to render multi-row symbols:**

```javascript
function findMultiRowSymbols(symbolGrid) {
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
```

**Render the grid:**

```javascript
function renderGrid(symbolGrid) {
  const mainGrid = document.getElementById('mainGrid');
  const topRow = document.getElementById('topRow');
  
  // Clear cells
  for (let cell of mainGrid.children) {
    cell.textContent = '';
    cell.className = 'grid-cell';
    cell.style = '';
  }
  
  // Find multi-row symbols
  const multiRowSymbols = findMultiRowSymbols(symbolGrid);
  
  // Render main grid
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) {
      const cell = symbolGrid.mainGrid[row][col];
      if (!cell) continue;
      
      const multiRowInfo = multiRowSymbols.find(s => s.id === cell.id);
      const index = row * 6 + col;
      const cellEl = mainGrid.children[index];
      
      if (multiRowInfo && multiRowInfo.startRow === row) {
        // Master cell: render symbol spanning multiple rows
        cellEl.textContent = getSymbolEmoji(cell.symbol);
        cellEl.className = 'grid-cell multi-row-master';
        cellEl.style.gridRow = `${row + 1} / span ${multiRowInfo.rowSpan}`;
        cellEl.style.gridColumn = `${col + 1}`;
        
        if (cell.frame) {
          cellEl.classList.add(`${cell.frame}-frame`);
        }
      } else if (!multiRowInfo) {
        // Single-row symbol
        cellEl.textContent = getSymbolEmoji(cell.symbol);
        cellEl.className = 'grid-cell';
        
        if (cell.frame) {
          cellEl.classList.add(`${cell.frame}-frame`);
        }
      }
      // Multi-row continuation cells: leave empty (hidden by CSS)
    }
  }
  
  // Render top row
  for (let col = 0; col < 4; col++) {
    const cell = symbolGrid.topRow[col];
    if (cell) {
      topRow.children[col].textContent = getSymbolEmoji(cell.symbol);
    }
  }
}
```

**CSS for multi-row symbols:**

```css
.grid-cell.multi-row-master {
  border: 2px solid rgba(255, 215, 0, 0.5);
  z-index: 10;
  aspect-ratio: auto;
  min-height: 100%;
  height: 100%;
}

.grid-cell.multi-row-continuation {
  display: none !important;
}
```

---

## Spin Flow

### Step 3: Send Spin Request

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

### Step 4: Handle Spin Result

```json
{
  "errCode": 0,
  "vals": {
    "type": 100070,
    "data": {
      "subData": [{
        "subType": 100070,
        "gameResult": {
          "info": {
            "symbolGrid": {
              "mainGrid": [[...], [...], ...],  // 5x6 SymbolInstance[][]
              "topRow": [...]  // 4 SymbolInstance[]
            },
            "steps": [...],  // Cascade steps (optional)
            "topAllWild": false,
            "bonusGambling": null,  // Or gambling state
            "bonusGameState": null  // Or bonus state
          },
          "winAmount": 12.50,
          "finalBalance": 999999987.50
        }
      }]
    }
  }
}
```

**Process the result:**
1. Update balance from `finalBalance`
2. If `topAllWild` is true, show special message
3. If `steps` exist, play cascade animation
4. Otherwise, render final grid directly
5. Show win amount if > 0
6. Check for `bonusGambling` (4+ scatters) or `bonusGameState` (in bonus)

---

## Cascade Animation

### Step Data

Each cascade step contains:

```typescript
interface CascadeStep {
  symbolGridBefore: SymbolGrid;     // Grid before win
  symbolGridAfterRemoval: SymbolGrid;  // Grid after removing wins
  symbolGridAfterFill: SymbolGrid;  // Grid after filling
  removedSymbols: RemovedSymbol[];  // Which symbols were removed
  movements: Movement[];            // How symbols moved
  winningColumns: WinInfo[];        // Win details
  totalWin: number;                 // Step win amount
  waysToWin: number;                // Total ways to win
}

interface RemovedSymbol {
  row: number;
  col: number;
  id: string;
  symbol: string;
}

interface Movement {
  from: { row: number; col: number } | null;  // null = new symbol
  to: { row: number; col: number };
  symbolInstance: SymbolInstance;
  isNew: boolean;
}
```

**Animation sequence:**
1. Render `symbolGridBefore` and highlight winning symbols
2. Animate removal of `removedSymbols`
3. Render `symbolGridAfterRemoval`
4. Apply movement animations from `movements`
5. Render `symbolGridAfterFill`
6. Repeat for next step

---

## Bonus System

### Bonus Gambling

When 4+ scatters appear, the server sends `bonusGambling`:

```json
{
  "bonusGambling": {
    "freeSpinValues": [8, 10, 12, 14, 16],
    "multiplierValues": [18, 20, 22, 24],
    "freeSpinIndex": 0,
    "multiplierIndex": 0,
    "currentFreeSpins": 8,
    "currentMultiplier": 18,
    "canGambleFreeSpin": true,
    "canGambleMultiplier": true
  }
}
```

**Gamble actions:**
- Send `SetBet` with `action: 'freeSpin'` to gamble for more spins
- Send `SetBet` with `action: 'multiplier'` to gamble for higher multiplier
- Send `SetBet` with `action: 'enter'` to enter bonus with current values

### Free Spins Bonus

When in bonus, `bonusGameState` is present:

```json
{
  "bonusGameState": {
    "freeSpinsRemaining": 8,
    "multiplier": 18,
    "totalWin": 0,
    "retriggerSpinsAwarded": 0
  }
}
```

---

## Buy Bonus Feature

The buy bonus feature allows players to pay a fixed price to instantly trigger a bonus round. The backend generates the pre-defined grid with the required scatter count.

### Buy Bonus Request

Send a `SetBet` message with `buyBonus: true`:

```json
{
  "type": "setBet",
  "bet": 1.00,
  "buyBonus": true
}
```

**Fields:**
- `buyBonus`: `true` to activate buy bonus mode
- `bet`: The current bet amount (cost will be `bet × priceMultiplier` from join room info)

The backend handles:
- Deducting the buy price from balance (`bet × priceMultiplier`)
- Generating a pre-defined grid with exactly 4 scatter symbols
- Ensuring no regular wins occur on the buy spin
- Entering bonus gambling automatically after the spin

### Buy Bonus Response

The server responds with a normal `SetBet` result. The response will contain:

```json
{
  "gameResult": {
    "info": {
      "symbolGrid": {
        "mainGrid": [...],
        "topRow": [...]
      },
      "bonusGambling": {
        "freeSpinValues": [8, 10, 12, 14, 16],
        "multiplierValues": [18, 20, 22, 24],
        "freeSpinIndex": 0,
        "multiplierIndex": 0,
        "currentFreeSpins": 8,
        "currentMultiplier": 18,
        "canGambleFreeSpin": true,
        "canGambleMultiplier": true
      }
    }
  }
}
```

**Key behaviors:**
- The buy bonus spin renders the server-generated grid immediately
- No cascade animation occurs (no wins on buy spin)
- The player enters bonus gambling UI automatically
- The cost is deducted from balance before the spin
- The backend ensures exactly 4 scatter symbols are present on the grid
- Buy bonus can only be used during normal game (not in bonus or gambling)

### Frontend Implementation

```javascript
function buyBonus() {
  const currentBet = BET_SIZE_LIST[CURRENT_BET_INDEX];
  const buyPrice = currentBet * BUY_BONUS_MULTIPLIER; // from join room info

  // Check balance
  if (currentBalance < buyPrice) {
    alert(`Insufficient balance! Buy bonus costs $${buyPrice.toFixed(2)}`);
    return;
  }

  const buyPayload = { 
    bet: currentBet,
    buyBonus: true
  };

  wsClient.setBet(buyPayload);
}
```

### Buy Bonus Button

Add a buy bonus button to your UI. Use the `buyBonus` info from join room to conditionally render it and show the correct price:

```html
<button id="buyBonusButton" class="buy-bonus-button" onclick="buyBonus()">
  💎 BUY BONUS (50x)
</button>
```

### Dynamic Price Display

Use the `priceMultiplier` from join room to show the correct buy price when the bet changes:

```javascript
function updateBuyBonusButton() {
  const currentBet = BET_SIZE_LIST[CURRENT_BET_INDEX];
  const buyPrice = currentBet * BUY_BONUS_MULTIPLIER;
  
  const btn = document.getElementById('buyBonusButton');
  btn.textContent = `💎 BUY BONUS (${BUY_BONUS_MULTIPLIER}x) — $${buyPrice.toFixed(2)}`;
  
  // Disable if insufficient balance or not in normal game
  btn.disabled = currentBalance < buyPrice || isInBonus || isGambling;
}
```

```css
.buy-bonus-button {
  width: 100%;
  padding: 12px;
  font-size: 1rem;
  font-weight: bold;
  border: 2px solid #ff6b6b;
  background: linear-gradient(135deg, #ff6b6b, #ffd700);
  color: #1a1a2e;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 10px;
}

.buy-bonus-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
}

.buy-bonus-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

---

## Complete Example

```javascript
class CasishenwinFrontend {
  constructor() {
    this.ws = null;
    this.balance = 0;
    this.betSizeList = [];
    this.currentBet = 1.00;
    this.gridContainer = document.getElementById('grid');
    this.topRowContainer = document.getElementById('top-row');
  }
  
  connect() {
    this.ws = new WebSocket('ws://localhost:3004');
    
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: '0' }));
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleResponse(data);
    };
  }
  
  handleResponse(data) {
    const type = data.vals?.type;
    
    switch (type) {
      case 1: // Login
        this.balance = data.vals.data.balance;
        this.updateBalanceDisplay();
        this.joinRoom();
        break;
      case 100070: // Game action
        this.handleGameResult(data);
        break;
    }
  }
  
  joinRoom() {
    this.ws.send(JSON.stringify({
      type: '100000',
      data: [{
        subType: 100070,
        subData: [{
          opCode: 'JoinRoom',
          message: { gameTypeId: 'moneygod' }
        }]
      }]
    }));
  }
  
  handleJoinRoom(data) {
    const betInfo = data.vals.data.subData[0].betInfo[0];
    this.betSizeList = betInfo.betSizeList;
    this.currentBet = betInfo.defaultBet;
    this.buyBonusInfo = betInfo.buyBonus; // { enabled, priceMultiplier }
    
    // Setup bet selector UI
    this.setupBetSelector();
    
    // Setup buy bonus button
    this.setupBuyBonusButton();
  }
  
  setupBuyBonusButton() {
    const btn = document.getElementById('buy-bonus-btn');
    if (!this.buyBonusInfo?.enabled) {
      btn.style.display = 'none';
      return;
    }
    this.updateBuyBonusButton();
  }
  
  updateBuyBonusButton() {
    const btn = document.getElementById('buy-bonus-btn');
    const buyPrice = this.currentBet * this.buyBonusInfo.priceMultiplier;
    btn.textContent = `💎 BUY BONUS (${this.buyBonusInfo.priceMultiplier}x) — $${buyPrice.toFixed(2)}`;
    btn.disabled = this.balance < buyPrice || this.isInBonus || this.isGambling;
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
  
  buyBonus() {
    const buyPrice = this.currentBet * this.buyBonusInfo.priceMultiplier;
    
    if (this.balance < buyPrice) {
      alert(`Insufficient balance! Buy bonus costs $${buyPrice.toFixed(2)}`);
      return;
    }
    
    this.ws.send(JSON.stringify({
      type: '100000',
      data: [{
        subType: 100070,
        subData: [{
          opCode: 'SetBet',
          message: {
            bet: this.currentBet,
            buyBonus: true
          }
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
    
    // Track bonus/gambling state for buy bonus button
    this.isGambling = !!gameResult.bonusGambling;
    this.isInBonus = !!gameResult.bonusGameState;
    
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
    
    // Update buy bonus button state
    this.updateBuyBonusButton();
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
      btn.onclick = () => { 
        this.currentBet = bet; 
        this.updateBuyBonusButton();
      };
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

// Buy bonus button
document.getElementById('buy-bonus-btn').onclick = () => game.buyBonus();
```
