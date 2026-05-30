# Casishenwin WebSocket API Documentation

**Game:** Casishenwin Slot Game  
**Protocol:** WebSocket (JSON messages)  
**Fake Server:** `ws://localhost:3004`  
**Real Server:** AWS API Gateway (see `shared/global-config.js`)

---

## Table of Contents

1. [Connection Flow](#connection-flow)
2. [Message Format](#message-format)
3. [API Endpoints](#api-endpoints)
   - [Login](#1-login)
   - [Join Room](#2-join-room)
   - [Sync Room Info](#3-sync-room-info)
   - [Set Bet (Spin)](#4-set-bet-spin)
   - [Gamble For Bonus](#5-gamble-for-bonus)
   - [Get Records](#6-get-records)
4. [Data Types](#data-types)
5. [State Machine](#state-machine)
6. [Error Handling](#error-handling)
7. [Examples](#examples)

---

## Connection Flow

```
┌─────────┐     connect      ┌─────────────┐
│ Frontend│ ────────────────▶ │ Fake Server │
│ (Browser)│                  │  (ws://...)  │
└─────────┘                  └─────────────┘
     │                              │
     │ 1. Login (type: '0')         │
     │─────────────────────────────▶│
     │                              │
     │ 2. Login Response (type: 1)  │
     │◀─────────────────────────────│
     │                              │
     │ 3. Lobby Request (type: '2') │
     │─────────────────────────────▶│
     │                              │
     │ 4. Lobby Response (type: 3)  │
     │◀─────────────────────────────│
     │                              │
     │ 5. Join Room (type: '100000')│
     │─────────────────────────────▶│
     │                              │
     │ 6. Join Room Response        │
     │    (subType: 100005)         │
     │◀─────────────────────────────│
     │                              │
     │ 7. Sync Room (type: '100000')│
     │─────────────────────────────▶│
     │                              │
     │ 8. Sync Room Response        │
     │    (subType: 100071)         │
     │◀─────────────────────────────│
     │                              │
     │ 9. Set Bet / Gamble / etc.   │
     │─────────────────────────────▶│
     │                              │
     │ 10. Response (subType:100071)│
     │◀─────────────────────────────│
```

---

## Message Format

### Request Format (Frontend → Server)

```json
{
  "type": "100000",
  "data": [
    {
      "subType": 100070,
      "subData": [
        {
          "opCode": "SetBet",
          "message": { /* action-specific data */ }
        }
      ]
    }
  ]
}
```

### Response Format (Server → Frontend)

```json
{
  "errCode": 0,
  "errMsg": "success",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 0,
          "opCode": "SetBet",
          /* response data */
        }
      ]
    }
  }
}
```

---

## API Endpoints

### 1. Login

Authenticate with the server and get session info.

**Request:**
```json
{
  "type": "0"
}
```

**Parameters:** None

**Response:**
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

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Unique session identifier |
| `userId` | string | Player user ID |
| `balance` | number | Current player balance (in cents or smallest currency unit) |
| `serverTime` | number | Server timestamp (ms since epoch) |

**Example:**
```javascript
wsClient.send(JSON.stringify({ type: '0' }));
```

---

### 2. Join Room

Join the casishenwin game room and receive game configuration.

**Request:**
```json
{
  "type": "100000",
  "data": [
    {
      "subType": 100004
    }
  ]
}
```

**Parameters:** None

**Response:**
```json
{
  "errCode": 0,
  "vals": {
    "type": 100000,
    "data": {
      "subType": 100005,
      "subData": [
        {
          "balance": 10000000000,
          "roomId": "casishenwin-room-001",
          "gameTypeId": "casishenwin",
          "betInfo": [
            {
              "symbols": [
                { "id": "1" },
                { "id": "2" },
                { "id": "201" },
                { "id": "202" }
              ],
              "betSizeList": [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00],
              "defaultBet": 0.20,
              "winTable": {
                "201": [10, 25, 50, 100],
                "202": [5, 10, 20, 40]
              },
              "winTableDisplay": { /* formatted display version */ }
            }
          ]
        }
      ]
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `balance` | number | Current player balance |
| `roomId` | string | Room identifier |
| `gameTypeId` | string | Game type (`"casishenwin"`) |
| `symbols` | Array<{id: string}> | Available symbol IDs |
| `betSizeList` | number[] | Allowed bet amounts |
| `defaultBet` | number | Default bet amount |
| `winTable` | Record<string, number[]> | Payout multipliers per symbol [3x, 4x, 5x, 6x] |

**Example:**
```javascript
wsClient.send(JSON.stringify({
  type: '100000',
  data: [{ subType: 100004 }]
}));
```

---

### 3. Sync Room Info

Request current room state. Used on reconnect or periodic sync to restore game state.

**Request:**
```json
{
  "type": "100000",
  "data": [
    {
      "subType": 100070,
      "subData": [
        {
          "opCode": "SyncRoomInfo"
        }
      ]
    }
  ]
}
```

**Parameters:** None

**Response:**
```json
{
  "errCode": 0,
  "errMsg": "success",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 0,
          "opCode": "SyncRoomInfo",
          "roomInfo": {
            "minBet": 0.20,
            "maxBet": 100.00,
            "defaultBet": 0.20,
            "lastResumeInfo": {
              "spinType": "base",
              "grid": {
                "mainGrid": [ /* SymbolInstance[][] */ ],
                "topRow": [ /* SymbolInstance[] */ ]
              },
              "bonusGameState": null,
              "bonusGambling": null
            }
          }
        }
      ]
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `minBet` | number | Minimum allowed bet |
| `maxBet` | number | Maximum allowed bet |
| `defaultBet` | number | Default bet amount |
| `lastResumeInfo` | object \| null | State to restore (null if no previous play) |

**lastResumeInfo Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `spinType` | string | `"base"`, `"bonus"`, or `"bonusGambling"` |
| `grid` | SymbolGrid \| null | Last grid state (for base/bonus spins) |
| `bonusGameState` | BonusGameState \| null | Active bonus state (if spinType=bonus) |
| `bonusGambling` | BonusGambleState \| null | Gambling state (if spinType=bonusGambling) |

**Example - Base Spin Resume:**
```json
{
  "lastResumeInfo": {
    "spinType": "base",
    "grid": {
      "mainGrid": [
        [{"id":"_1","symbol":"201"},{"id":"_2","symbol":"101"}, ...],
        [...]
      ],
      "topRow": [{"id":"_31","symbol":"1"}, ...]
    },
    "bonusGameState": null,
    "bonusGambling": null
  }
}
```

**Example - Bonus Game Resume:**
```json
{
  "lastResumeInfo": {
    "spinType": "bonus",
    "grid": {
      "mainGrid": [ /* current bonus grid */ ],
      "topRow": [ /* current top row */ ]
    },
    "bonusGameState": {
      "freeSpinsRemaining": 5,
      "multiplier": 20,
      "totalWin": 1250.50
    },
    "bonusGambling": null
  }
}
```

**Example - Bonus Gambling Resume:**
```json
{
  "lastResumeInfo": {
    "spinType": "bonusGambling",
    "grid": null,
    "bonusGameState": null,
    "bonusGambling": {
      "freeSpinIndex": 2,
      "multiplierIndex": 1,
      "freeSpinValues": [8, 10, 12, 14, 16],
      "multiplierValues": [18, 20, 22, 24],
      "canGambleFreeSpin": true,
      "canGambleMultiplier": true,
      "currentFreeSpins": 12,
      "currentMultiplier": 20
    }
  }
}
```

**Example:**
```javascript
wsClient.send(JSON.stringify({
  type: '100000',
  data: [{
    subType: 100070,
    subData: [{ opCode: 'SyncRoomInfo' }]
  }]
}));
```

---

### 4. Set Bet (Spin)

Place a bet and spin the reels.

**Request:**
```json
{
  "type": "100000",
  "data": [
    {
      "subType": 100070,
      "subData": [
        {
          "opCode": "SetBet",
          "message": {
            "bet": 1.00,
            "debugOptions": {
              "forceTopAllWild": false,
              "forceSilverFrame": false,
              "forceScatterCount": null,
              "forceBonusRetrigger": false
            }
          }
        }
      ]
    }
  ]
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bet` | number | Yes | Bet amount (must be in `betSizeList`) |
| `debugOptions` | object | No | Debug/testing options (fake server only) |
| `debugOptions.forceTopAllWild` | boolean | No | Force top row to be all WILDs |
| `debugOptions.forceSilverFrame` | boolean | No | Force silver frame appearance |
| `debugOptions.forceScatterCount` | number | No | Force specific scatter count (1-6) |
| `debugOptions.forceBonusRetrigger` | boolean | No | Force scatter count to 4-6 for retrigger |

**Response (Success - Base Spin):**
```json
{
  "errCode": 0,
  "errMsg": "success",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 0,
          "opCode": "SetBet",
          "gameResult": {
            "awardBase": 1.00,
            "winAmount": 25.50,
            "info": {
              "grid": { "mainGrid": [["201","101",...]], "topRow": ["1","2",...] },
              "symbolGrid": { "mainGrid": [[{"id":"_1","symbol":"201"},...]], "topRow": [...] },
              "symbolMap": { /* id -> SymbolInstance */ },
              "steps": [ /* CascadeStep[] */ ],
              "totalWin": 25.50,
              "scatterCount": 2,
              "awardBase": 1.00,
              "topAllWild": false,
              "bonusGambling": null
            },
            "balance": 9999999999,
            "finalBalance": 10000000023.50,
            "bonusGambling": null,
            "bonusGameState": null
          }
        }
      ]
    }
  }
}
```

**Response (Success - Bonus Spin):**
```json
{
  "gameResult": {
    "awardBase": 0,
    "winAmount": 50.00,
    "info": { /* spin result with symbolGrid */ },
    "balance": 9999999999,
    "finalBalance": 9999999999,
    "bonusGameState": {
      "freeSpinsRemaining": 4,
      "multiplier": 20,
      "totalWin": 1250.50,
      "retriggerSpinsAwarded": 0
    }
  }
}
```

**Response (Success - Base Spin with Gambling Trigger):**
```json
{
  "gameResult": {
    "awardBase": 1.00,
    "winAmount": 0,
    "info": { /* spin result */ },
    "balance": 9999999999,
    "finalBalance": 9999999998,
    "bonusGambling": {
      "freeSpinIndex": 0,
      "multiplierIndex": 0,
      "freeSpinValues": [8, 10, 12, 14, 16],
      "multiplierValues": [18, 20, 22, 24],
      "canGambleFreeSpin": true,
      "canGambleMultiplier": true,
      "currentFreeSpins": 8,
      "currentMultiplier": 18
    }
  }
}
```

**Response (Error - In Gambling State):**
```json
{
  "errCode": 1,
  "errMsg": "Please resolve your bonus gambling first",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 1,
          "opCode": "SetBet",
          "errMsg": "Please resolve your bonus gambling first",
          "bonusGambling": {
            "freeSpinIndex": 1,
            "multiplierIndex": 0,
            "currentFreeSpins": 10,
            "currentMultiplier": 18,
            "canGambleFreeSpin": true,
            "canGambleMultiplier": true
          }
        }
      ]
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `awardBase` | number | Bet amount deducted for this spin |
| `winAmount` | number | Total win amount (before multiplier) |
| `balance` | number | Balance before this spin |
| `finalBalance` | number | Balance after this spin |
| `info` | SpinResult | Full spin result with grid, steps, etc. |
| `bonusGambling` | BonusGambleState \| null | Present when 4+ scatters trigger gambling |
| `bonusGameState` | BonusGameState \| null | Present during bonus free spins |

**Example:**
```javascript
// Normal spin
wsClient.setBet({ bet: 1.00 });

// Spin with debug options (fake server only)
wsClient.setBet({
  bet: 1.00,
  debugOptions: {
    forceScatterCount: 4  // Force 4 scatters to trigger gambling
  }
});
```

---

### 5. Gamble For Bonus

Gamble for higher free spins or multiplier during bonus gambling phase.

**Request:**
```json
{
  "type": "100000",
  "data": [
    {
      "subType": 100070,
      "subData": [
        {
          "opCode": "GambleForBonus",
          "action": "freeSpin"
        }
      ]
    }
  ]
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | `"freeSpin"`, `"multiplier"`, or `"enter"` |

**Action Values:**

| Value | Description |
|-------|-------------|
| `"freeSpin"` | Gamble to increase free spins (e.g., 8 → 10 → 12 → 14 → 16) |
| `"multiplier"` | Gamble to increase multiplier (e.g., 18x → 20x → 22x → 24x) |
| `"enter"` | Accept current values and enter bonus game |

**Response (Success - Gamble Won):**
```json
{
  "errCode": 0,
  "errMsg": "success",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 0,
          "opCode": "GambleForBonus",
          "gambleResult": {
            "success": true,
            "lost": false,
            "bonusState": "gambling",
            "freeSpins": 10,
            "multiplier": 18,
            "freeSpinIndex": 1,
            "multiplierIndex": 0,
            "canGambleFreeSpin": true,
            "canGambleMultiplier": true,
            "message": "Gamble won! Free spins increased to 10!"
          }
        }
      ]
    }
  }
}
```

**Response (Success - Enter Bonus):**
```json
{
  "gambleResult": {
    "success": true,
    "lost": false,
    "bonusState": "bonus",
    "freeSpins": 12,
    "multiplier": 22,
    "freeSpinIndex": 2,
    "multiplierIndex": 1,
    "canGambleFreeSpin": false,
    "canGambleMultiplier": false,
    "message": "Entered bonus! 12 free spins @ 22x"
  }
}
```

**Response (Error - Gamble Lost):**
```json
{
  "gambleResult": {
    "success": false,
    "lost": true,
    "bonusState": "lost",
    "freeSpins": 0,
    "multiplier": 0,
    "canGambleFreeSpin": false,
    "canGambleMultiplier": false,
    "message": "Gamble lost! Bonus forfeited."
  }
}
```

**Response (Error - No Active Gambling):**
```json
{
  "errCode": 1,
  "errMsg": "No active bonus gambling",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 1,
          "opCode": "GambleForBonus",
          "errMsg": "No active bonus gambling"
        }
      ]
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the gamble succeeded |
| `lost` | boolean | If true, bonus is forfeited |
| `bonusState` | string | `"gambling"`, `"bonus"`, `"normal"`, or `"lost"` |
| `freeSpins` | number | Current free spin count |
| `multiplier` | number | Current multiplier value |
| `freeSpinIndex` | number | Position in freeSpinValues array |
| `multiplierIndex` | number | Position in multiplierValues array |
| `canGambleFreeSpin` | boolean | Can still gamble for more spins |
| `canGambleMultiplier` | boolean | Can still gamble for higher multiplier |
| `message` | string | Human-readable result message |

**Example:**
```javascript
// Gamble for more free spins
wsClient.gambleFor('freeSpin');

// Gamble for higher multiplier
wsClient.gambleFor('multiplier');

// Enter bonus with current values
wsClient.gambleFor('enter');
```

---

### 6. Get Records

Retrieve recent game records (for debugging/history).

**Request:**
```json
{
  "type": "100000",
  "data": [
    {
      "subType": 100070,
      "subData": [
        {
          "opCode": "GetRecords"
        }
      ]
    }
  ]
}
```

**Parameters:** None

**Response:**
```json
{
  "errCode": 0,
  "errMsg": "success",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 0,
          "opCode": "GetRecords",
          "records": [
            {
              "id": "1234567890",
              "bet": 1.00,
              "spinType": "base",
              "gameResult": {
                "awardBase": 1.00,
                "winAmount": 25.50,
                "info": { /* spin result */ },
                "balance": 9999999999,
                "finalBalance": 10000000023.50
              }
            }
          ]
        }
      ]
    }
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `records` | GameRecord[] | Last 20 records (most recent first) |

**GameRecord Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Record ID (timestamp) |
| `bet` | number | Bet amount (0 for gamble actions) |
| `spinType` | string | `"base"`, `"bonus"`, or `"bonusGambling"` |
| `gameResult` | object | Summary of game result |

**Example:**
```javascript
wsClient.send(JSON.stringify({
  type: '100000',
  data: [{
    subType: 100070,
    subData: [{ opCode: 'GetRecords' }]
  }]
}));
```

---

## Data Types

### SymbolInstance

Represents a single symbol on the grid with unique ID.

```typescript
interface SymbolInstance {
  id: string;           // Unique symbol ID (e.g., "_1", "_42")
  symbol: string;       // Symbol type (e.g., "1"=WILD, "2"=SCATTER, "201"=CROWN)
  isNew?: boolean;      // True if symbol just dropped in
  removed?: boolean;    // True if symbol was removed in cascade
  removedAtStep?: number; // Which cascade step removed it
  frame?: 'silver' | 'golden'; // Frame progression state
}
```

### SymbolGrid

Grid with full SymbolInstance objects for rendering.

```typescript
interface SymbolGrid {
  mainGrid: Array<Array<SymbolInstance | null>>;  // 5 rows x 6 columns
  topRow: Array<SymbolInstance | null>;            // 4 symbols for columns 1-4
}
```

### CascadeStep

A single step in the cascade animation.

```typescript
interface CascadeStep {
  step: number;
  symbolGridBefore: SymbolGrid;        // Grid before wins
  symbolGridAfterRemoval: SymbolGrid;  // Grid after removing wins
  symbolGridAfterFill: SymbolGrid;     // Grid after new symbols dropped
  winningColumns: ColumnWin[];         // Winning combinations
  removedSymbols: SymbolRemoval[];     // Which symbols were removed
  transformedPositions: Array<{        // Frame transformations
    row: number;
    col: number;
    oldFrame: 'silver' | 'golden';
    newSymbol: string;
  }>;
  movements: SymbolMovement[];         // Backend-calculated animations
  totalWin: number;
  waysToWin?: number;
}
```

### ColumnWin

A winning combination across consecutive columns.

```typescript
interface ColumnWin {
  symbol: string;       // Winning symbol ID
  count: number;        // Number of matching symbols
  positions: Array<{ row: number; col: number }>;
  payout: number;      // Base payout multiplier
  winRoad: number;      // Total ways (product of counts per column)
  consecutiveCols: number; // How many consecutive columns (3-6)
}
```

### BonusGameState

State during bonus free spins.

```typescript
interface BonusGameState {
  freeSpinsRemaining: number;  // Spins left
  multiplier: number;            // Current win multiplier
  totalWin: number;             // Accumulated bonus win
  retriggerSpinsAwarded?: number; // Extra spins awarded this spin
}
```

### BonusGambleState

State during bonus gambling phase.

```typescript
interface BonusGambleState {
  freeSpinIndex: number;        // Current position in values array
  multiplierIndex: number;    // Current position in values array
  freeSpinValues: number[];     // [8, 10, 12, 14, 16]
  multiplierValues: number[];   // [18, 20, 22, 24]
  canGambleFreeSpin: boolean;   // Can still gamble for spins
  canGambleMultiplier: boolean; // Can still gamble for multiplier
  currentFreeSpins: number;     // Current value
  currentMultiplier: number;    // Current value
}
```

---

## State Machine

```
                    ┌─────────────┐
                    │    IDLE     │
                    │  (no game)  │
                    └──────┬──────┘
                           │ Join Room
                           ▼
                    ┌─────────────┐
         ┌─────────│    BASE     │◀────────┐
         │         │   (normal)   │         │
         │         └──────┬───────┘         │
         │                │ Spin            │
         │                │ (4+ scatters)   │
         │                ▼                 │
         │         ┌─────────────┐         │
         │         │   GAMBLING  │         │
         │         │  (4+ scat)   │         │
         │         └──────┬───────┘         │
         │                │ Gamble          │
         │                │ (lost)          │
         │         ┌─────┴─────┐           │
         │         ▼           ▼           │
         │    ┌────────┐   ┌────────┐     │
         │    │  LOST  │   │ ENTER  │     │
         │    │(forfeit)│   │ bonus  │     │
         │    └────┬───┘   └───┬────┘     │
         │         │           │           │
         │         │           ▼           │
         │         │    ┌─────────────┐   │
         │         │    │    BONUS    │   │
         │         │    │ (free spins)│   │
         │         │    └──────┬──────┘   │
         │         │           │ Spin      │
         │         │           │ (0 spins) │
         │         │           ▼           │
         │         │    ┌─────────────┐   │
         └─────────┴───▶│   BONUS     │───┘
                        │   ENDED     │
                        └─────────────┘
```

**State Transitions:**

| From | To | Trigger | Condition |
|------|-----|---------|-----------|
| BASE | GAMBLING | Spin | 4+ scatters |
| GAMBLING | LOST | Gamble | Gamble lost |
| GAMBLING | BONUS | Enter | Player clicks "Enter Bonus" |
| GAMBLING | GAMBLING | Gamble | Gamble won |
| BONUS | BONUS | Spin | freeSpinsRemaining > 0 |
| BONUS | BASE | Spin | freeSpinsRemaining <= 0 |

---

## Error Handling

### Error Response Format

```json
{
  "errCode": 1,
  "errMsg": "Error description",
  "vals": {
    "type": 100000,
    "id": 3,
    "data": {
      "subType": 100071,
      "subData": [
        {
          "errCode": 1,
          "opCode": "SetBet",
          "errMsg": "Error description"
        }
      ]
    }
  }
}
```

### Common Error Codes

| errCode | errMsg | When It Happens |
|---------|--------|-----------------|
| 1 | `"Please resolve your bonus gambling first"` | SetBet while in gambling state |
| 1 | `"No active bonus gambling"` | GambleForBonus without active gambling |
| 1 | `"Cannot spin now"` | Generic spin rejection |

### Frontend Error Handling

```javascript
// Check for error in response
const subData = data.vals?.data?.subData?.[0];
if (subData.errCode !== 0) {
  console.error('Server error:', subData.errMsg);
  // Handle specific errors
  if (subData.bonusGambling) {
    // Show gambling UI
    showBonusGamblingUI(subData.bonusGambling);
  }
  return;
}
```

---

## Examples

### Complete Game Flow Example

```javascript
// 1. Connect and login
const wsClient = new SlotGameWebSocketClient('casishenwin', config);
await wsClient.connect();

// 2. Handle login response
wsClient.on('login', (data) => {
  console.log('Logged in, balance:', data.vals.data.balance);
});

// 3. Join room (auto-sent by client after lobby)
wsClient.on('joinRoom', (data) => {
  console.log('Joined room:', data.roomId);
  // Store symbols, bet sizes, win table
});

// 4. Sync room (auto-sent periodically)
wsClient.on('syncRoom', (data) => {
  const resumeInfo = data.roomInfo?.lastResumeInfo;
  if (resumeInfo) {
    if (resumeInfo.spinType === 'bonusGambling') {
      showBonusGamblingUI(resumeInfo.bonusGambling);
    } else if (resumeInfo.spinType === 'bonus') {
      showBonusUI(resumeInfo.bonusGameState);
      renderSymbolGrid(resumeInfo.grid, ...);
    } else {
      renderSymbolGrid(resumeInfo.grid, ...);
    }
  }
});

// 5. Handle spin results
wsClient.on('setBet', (data) => {
  const gameResult = data.gameResult;
  
  // Check for errors
  if (data.errCode !== 0) {
    if (gameResult?.bonusGambling) {
      showBonusGamblingUI(gameResult.bonusGambling);
    }
    return;
  }
  
  // Render the grid
  renderSymbolGrid(gameResult.info.symbolGrid, ...);
  
  // Check for bonus gambling trigger
  if (gameResult.bonusGambling) {
    showBonusGamblingUI(gameResult.bonusGambling);
  }
  
  // Check for bonus state
  if (gameResult.bonusGameState) {
    showBonusUI(gameResult.bonusGameState);
  }
  
  // Update balance
  updateBalance(gameResult.finalBalance);
});

// 6. Handle gamble results
wsClient.on('gambleForBonus', (data) => {
  const result = data.gambleResult;
  
  if (result.bonusState === 'bonus' && result.success) {
    // Entered bonus
    hideBonusGamblingUI();
    showBonusUI({
      freeSpinsRemaining: result.freeSpins,
      multiplier: result.multiplier,
      totalWin: 0
    });
  } else if (result.lost) {
    // Lost gamble
    hideBonusGamblingUI();
    showMessage('Bonus forfeited!');
  } else if (result.success) {
    // Won gamble
    updateBonusGamblingUI(result);
  }
});

// 7. Send a spin
wsClient.setBet({ bet: 1.00 });

// 8. Gamble for more spins
wsClient.gambleFor('freeSpin');

// 9. Enter bonus
wsClient.gambleFor('enter');
```

### Debug Spin Example

```javascript
// Force 4 scatters to trigger gambling
wsClient.setBet({
  bet: 1.00,
  debugOptions: {
    forceScatterCount: 4
  }
});

// Force top row all WILDs
wsClient.setBet({
  bet: 1.00,
  debugOptions: {
    forceTopAllWild: true
  }
});

// Force silver frame
wsClient.setBet({
  bet: 1.00,
  debugOptions: {
    forceSilverFrame: true
  }
});

// Combine multiple debug options
wsClient.setBet({
  bet: 1.00,
  debugOptions: {
    forceTopAllWild: true,
    forceScatterCount: 5,
    forceBonusRetrigger: true
  }
});
```

### Bonus Retrigger Example

```javascript
// During bonus game, server may award extra spins
wsClient.on('setBet', (data) => {
  const bonus = data.gameResult.bonusGameState;
  if (bonus?.retriggerSpinsAwarded > 0) {
    console.log(`Retrigger! +${bonus.retriggerSpinsAwarded} free spins!`);
    showRetriggerAnimation(bonus.retriggerSpinsAwarded);
  }
});
```

---

## Symbol Reference

| ID | Emoji | Name | Type |
|----|-------|------|------|
| 1 | 💎 | WILD | Special |
| 2 | ⭐ | SCATTER | Special |
| 201 | 👑 | CROWN | High |
| 202 | 💍 | RING | High |
| 203 | 🏆 | TROPHY | High |
| 204 | 💵 | CASH | High |
| 205 | 🎴 | CARD | Medium |
| 206 | 🌟 | STAR | Medium |
| 101 | 🅰️ | ACE | Low |
| 102 | 🇰 | KING | Low |
| 103 | 🇶 | QUEEN | Low |
| 104 | 🇯 | JACK | Low |
| 105 | 🔟 | TEN | Low |

---

## Win Table Format

```javascript
// winTable[ID] = [3x payout, 4x payout, 5x payout, 6x payout]
{
  "201": [10, 25, 50, 100],   // CROWN: 3=10x, 4=25x, 5=50x, 6=100x
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

*Document generated: 2026-05-28*  
*For: Casishenwin Slot Game Frontend Integration*
