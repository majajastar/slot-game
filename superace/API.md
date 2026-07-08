# SuperAce Game API Documentation

## Overview

This document describes the WebSocket API for the SuperAce slot game. The game uses a bidirectional WebSocket connection for real-time communication between the frontend client and the backend server.

## Connection

### WebSocket URL

```
ws://localhost:3005  (fake server / development)
wss://<production-host>  (production)
```

### Authentication

The WebSocket connection requires authentication via JWT token or session ID. See the `SlotGameWebSocketClient` implementation for details.

---

## Message Format

All messages follow this structure:

```json
{
  "action": "string",
  "data": {
    "subData": [{
      "message": { ... }
    }]
  }
}
```

---

## 1. Join Room

### Request

**Action:** `joinRoom`

Sent when the player enters the game room.

```json
{
  "action": "joinRoom",
  "data": {
    "subData": [{
      "message": {}
    }]
  }
}
```

### Response

**Event:** `joinRoom`

```json
{
  "betInfo": [{
    "gameName": "SuperAce",
    "minBet": 0.20,
    "maxBet": 100.00,
    "defaultBet": 0.20,
    "betSizeList": [0.20, 0.50, 1.00, 2.00, 5.00, 10.00, 20.00, 50.00, 100.00],
    "symbols": [
      { "id": "1", "name": "WILD", "emoji": "🃏" },
      { "id": "2", "name": "SCATTER", "emoji": "⭐" },
      { "id": "3", "name": "ACE", "emoji": "🅰️" },
      { "id": "4", "name": "KING", "emoji": "👑" },
      { "id": "5", "name": "QUEEN", "emoji": "👸" },
      { "id": "6", "name": "JACK", "emoji": "🤴" },
      { "id": "7", "name": "SPADE", "emoji": "♠️" },
      { "id": "8", "name": "HEART", "emoji": "♥️" },
      { "id": "9", "name": "DIAMOND", "emoji": "♦️" },
      { "id": "10", "name": "CLUB", "emoji": "♣️" }
    ],
    "winTable": {
      "3": [0, 0, 0, 50, 30, 20, 10, 8, 5, 3],
      "4": [0, 0, 0, 200, 100, 50, 30, 20, 15, 10],
      "5": [0, 0, 0, 500, 300, 200, 100, 50, 30, 20]
    },
    "buyBonus": {
      "enabled": true,
      "priceMultiplier": 75
    }
  }]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `gameName` | string | Game name |
| `minBet` | number | Minimum bet amount |
| `maxBet` | number | Maximum bet amount |
| `defaultBet` | number | Default bet amount |
| `betSizeList` | number[] | Available bet sizes |
| `symbols` | object[] | Symbol definitions with id, name, emoji |
| `winTable` | object | Payout multipliers for 3, 4, 5 consecutive columns |
| `buyBonus` | object | Buy bonus configuration |
| `buyBonus.enabled` | boolean | Whether buy bonus is enabled |
| `buyBonus.priceMultiplier` | number | Cost multiplier for buy bonus (e.g., 75x bet) |

---

## 2. Sync Room Info

### Request

**Action:** `syncRoomInfo`

Sent to synchronize room state, typically on reconnection or page refresh.

```json
{
  "action": "syncRoomInfo",
  "data": {
    "subData": [{
      "message": {}
    }]
  }
}
```

### Response

**Event:** `syncRoom`

```json
{
  "balance": 1000.00,
  "roomInfo": {
    "lastResumeInfo": {
      "symbolGrid": {
        "mainGrid": [
          [{ "id": "_1", "symbol": "3", "isGolden": true }, ...],
          ...
        ]
      },
      "spinType": "bonus",
      "bonusGameState": {
        "freeSpinsRemaining": 8,
        "totalFreeSpins": 8,
        "multiplier": 2,
        "totalWin": 0,
        "steps": [],
        "bonusFixBet": 1.00,
        "processedFreeSpins": 0,
        "retriggerSpinsAwarded": 0
      }
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `balance` | number | Player's current balance |
| `roomInfo.lastResumeInfo` | object | Last game state for resuming |
| `lastResumeInfo.symbolGrid` | object | Last grid state |
| `lastResumeInfo.spinType` | string | `"base"` or `"bonus"` |
| `lastResumeInfo.bonusGameState` | object | Bonus state if in bonus mode |
| `bonusGameState.freeSpinsRemaining` | number | Remaining free spins |
| `bonusGameState.totalFreeSpins` | number | Total free spins awarded |
| `bonusGameState.multiplier` | number | Bonus win multiplier |
| `bonusGameState.totalWin` | number | Total win accumulated in bonus |
| `bonusGameState.bonusFixBet` | number | Fixed bet amount for bonus spins |
| `bonusGameState.processedFreeSpins` | number | Number of free spins already played |
| `bonusGameState.retriggerSpinsAwarded` | number | Extra spins from retrigger |

---

## 3. Set Bet (Spin)

### Request

**Action:** `setBet`

Sent when the player spins the reels.

#### Normal Spin

```json
{
  "action": "setBet",
  "data": {
    "subData": [{
      "message": {
        "bet": 1.00
      }
    }]
  }
}
```

#### Buy Bonus Spin

```json
{
  "action": "setBet",
  "data": {
    "subData": [{
      "message": {
        "bet": 1.00,
        "buyBonus": true
      }
    }]
  }
}
```

#### Debug Mode Parameters (Non-Production Only)

When `NODE_ENV !== 'prod'`, the following debug parameters are accepted:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `forceScatterCount` | number | Force specific scatter count (0-5) | `3` |
| `forceGoldenCard` | boolean | Force all eligible symbols to be golden | `true` |
| `forceGoldenChance` | number | Override golden card spawn chance (0-1) | `0.3` |
| `forceJokerType` | string | Force joker type: `"big"` or `"little"` | `"big"` |

#### Debug Mode Examples

**Force 3 Scatters:**
```json
{
  "action": "setBet",
  "data": {
    "subData": [{
      "message": {
        "bet": 1.00,
        "forceScatterCount": 3
      }
    }]
  }
}
```

**Force Golden Cards:**
```json
{
  "action": "setBet",
  "data": {
    "subData": [{
      "message": {
        "bet": 1.00,
        "forceGoldenCard": true
      }
    }]
  }
}
```

**Force Golden Chance 30%:**
```json
{
  "action": "setBet",
  "data": {
    "subData": [{
      "message": {
        "bet": 1.00,
        "forceGoldenChance": 0.3
      }
    }]
  }
}
```

**Force Big Joker:**
```json
{
  "action": "setBet",
  "data": {
    "subData": [{
      "message": {
        "bet": 1.00,
        "forceJokerType": "big"
      }
    }]
  }
}
```

**Combined Debug Options:**
```json
{
  "action": "setBet",
  "data": {
    "subData": [{
      "message": {
        "bet": 1.00,
        "forceScatterCount": 3,
        "forceGoldenCard": true,
        "forceJokerType": "big"
      }
    }]
  }
}
```

### Response

**Event:** `setBet`

```json
{
  "betInfo": [{
    "bet": 1.00,
    "gameResult": {
      "bet": 1.00,
      "awardBase": 1.00,
      "winAmount": 25.50,
      "info": {
        "grid": [
          ["3", "7", "3", "3", "8"],
          ["4", "3", "9", "3", "7"],
          ["5", "8", "3", "4", "3"],
          ["6", "3", "7", "5", "3"]
        ],
        "symbolGrid": {
          "mainGrid": [
            [{ "id": "_1", "symbol": "3", "isGolden": true }, ...],
            ...
          ]
        },
        "steps": [
          {
            "step": 1,
            "symbolGridBefore": { ... },
            "symbolGridAfterRemoval": { ... },
            "symbolGridAfterFill": { ... },
            "winningColumns": [
              {
                "symbol": "3",
                "positions": [{ "row": 0, "col": 0 }, ...],
                "payout": 50,
                "winRoad": 4,
                "consecutiveCols": 5,
                "totalWin": 200
              }
            ],
            "removedSymbols": [
              {
                "symbolId": "_1",
                "symbol": "3",
                "row": 0,
                "col": 0,
                "goldenToJoker": true,
                "jokerType": "big",
                "changedTo": "1"
              }
            ],
            "totalWin": 200.00,
            "waysToWin": 4,
            "comboMultiplier": 1,
            "goldenToJokerTransforms": [
              { "row": 0, "col": 0, "jokerType": "big" }
            ],
            "bigJokerReplacements": [
              { "row": 1, "col": 2, "oldSymbol": "9" }
            ]
          }
        ],
        "totalWin": 25.50,
        "scatterCount": 3,
        "awardBase": 1.00,
        "bonusGameState": {
          "freeSpinsRemaining": 8,
          "totalFreeSpins": 8,
          "multiplier": 2,
          "totalWin": 0,
          "steps": [],
          "bonusFixBet": 1.00,
          "processedFreeSpins": 0,
          "retriggerSpinsAwarded": 0
        },
        "gameState": "bonus",
        "canSpin": true,
        "waysToWin": 4,
        "comboLevels": [2, 4, 6, 10],
        "finalComboIndex": 0
      }
    },
    "roundId": "abc123",
    "balance": 999.00,
    "finalBalance": 1024.50
  }]
}
```

### Response Fields

#### Top Level

| Field | Type | Description |
|-------|------|-------------|
| `bet` | number | Bet amount for this spin |
| `gameResult` | object | Full game result |
| `roundId` | string | Unique round identifier |
| `balance` | number | Balance before settlement |
| `finalBalance` | number | Balance after settlement |

#### Game Result Info

| Field | Type | Description |
|-------|------|-------------|
| `grid` | string[][] | Symbol IDs grid (5x4) |
| `symbolGrid` | object | Detailed grid with symbol instances |
| `steps` | object[] | Cascade steps (one per winning cascade) |
| `totalWin` | number | Total win amount for this spin |
| `scatterCount` | number | Number of scatter symbols |
| `awardBase` | number | Base bet amount (0 during free spins) |
| `bonusGameState` | object | Bonus state if triggered or in bonus |
| `gameState` | string | `"normal"` or `"bonus"` |
| `canSpin` | boolean | Whether spin was successful |
| `waysToWin` | number | Maximum ways to win |
| `comboLevels` | number[] | Available combo multipliers |
| `finalComboIndex` | number | Final combo level reached |

#### Cascade Step

| Field | Type | Description |
|-------|------|-------------|
| `step` | number | Step number (1, 2, 3...) |
| `symbolGridBefore` | object | Grid before this cascade |
| `symbolGridAfterRemoval` | object | Grid after removing winning symbols |
| `symbolGridAfterFill` | object | Grid after filling new symbols |
| `winningColumns` | object[] | Winning column combinations |
| `removedSymbols` | object[] | Symbols that were removed/changed |
| `totalWin` | number | Win amount for this step |
| `waysToWin` | number | Ways to win this step |
| `comboMultiplier` | number | Combo multiplier applied |
| `goldenToJokerTransforms` | object[] | Golden cards that transformed to joker |
| `bigJokerReplacements` | object[] | Extra symbols replaced by Big Joker |

#### Removed Symbol

| Field | Type | Description |
|-------|------|-------------|
| `symbolId` | string | Unique symbol ID |
| `symbol` | string | Symbol type (e.g., "3" for ACE) |
| `row` | number | Row position (0-3) |
| `col` | number | Column position (0-4) |
| `goldenToJoker` | boolean | Whether golden transformed to joker |
| `jokerType` | string | `"big"` or `"little"` if transformed |
| `changedTo` | string | New symbol after transformation |

#### Golden to Joker Transform

| Field | Type | Description |
|-------|------|-------------|
| `row` | number | Row position |
| `col` | number | Column position |
| `jokerType` | string | `"big"` or `"little"` |

#### Big Joker Replacement

| Field | Type | Description |
|-------|------|-------------|
| `row` | number | Row position |
| `col` | number | Column position |
| `oldSymbol` | string | Original symbol before replacement |

#### Bonus Game State

| Field | Type | Description |
|-------|------|-------------|
| `freeSpinsRemaining` | number | Remaining free spins |
| `totalFreeSpins` | number | Total free spins (including retriggers) |
| `multiplier` | number | Win multiplier for bonus |
| `totalWin` | number | Accumulated bonus win |
| `steps` | object[] | Cascade steps (empty in response for efficiency) |
| `bonusFixBet` | number | Fixed bet amount from triggering spin |
| `processedFreeSpins` | number | Number of spins already played |
| `retriggerSpinsAwarded` | number | Extra spins from retrigger |

---

## 4. Get Records

### Request

**Action:** `getRecords`

Retrieves game history/record list.

```json
{
  "action": "getRecords",
  "data": {
    "subData": [{
      "message": {}
    }]
  }
}
```

### Response

**Event:** `getRecords`

```json
{
  "recordsInfo": [
    {
      "id": "1234567890",
      "gameResult": {
        "bet": 1.00,
        "awardBase": 1.00,
        "winAmount": 25.50,
        "info": {
          "totalWin": 25.50,
          "scatterCount": 3,
          "gameState": "bonus",
          "bonusGameState": {
            "freeSpinsRemaining": 8,
            "totalFreeSpins": 8,
            "multiplier": 2,
            "totalWin": 0,
            "bonusFixBet": 1.00,
            "processedFreeSpins": 0,
            "retriggerSpinsAwarded": 0
          }
        }
      }
    }
  ]
}
```

---

## Game Features

### Golden Card

- Appears only on reels 2, 3, 4 (columns 1, 2, 3 in 0-indexed)
- When a golden card wins, it transforms to WILD (Joker)
- Maximum 5 golden cards per spin (configurable)

### Joker Types

| Type | Description |
|------|-------------|
| Big Joker | WILD + replaces 0-3 extra symbols with WILD |
| Little Joker | WILD only (no extra replacements) |

### Combo Multiplier

**Base Game:** 1x → 2x → 3x → 5x

**Bonus Game:** 2x → 4x → 6x → 10x

### Bonus Free Spins

- Triggered by 3+ scatter symbols
- 8 free spins awarded initially
- Bet is fixed to the triggering spin's bet amount
- Retrigger: 3 scatters = +5 spins, 4 scatters = +8 spins, 5 scatters = +12 spins
- Win multiplier applied to all bonus wins

### Buy Bonus

- Cost: 75x current bet (configurable)
- Guaranteed 3+ scatters on next spin
- Cannot buy bonus while already in bonus mode

---

## Error Handling

### Common Errors

| Error | Description |
|-------|-------------|
| `Cannot buy bonus in bonus state` | Attempted to buy bonus while already in free spins |
| `Invalid bet amount` | Bet amount outside min/max range |
| `Insufficient balance` | Player balance too low for bet |

### Error Response Format

```json
{
  "error": true,
  "message": "Error description"
}
```

---

## Debug Mode

Debug options are only available in non-production environments (`NODE_ENV !== 'prod'`).

### Frontend Debug Controls

The frontend provides UI controls for debug options:

- **Force Scatter Count**: Dropdown (0-5)
- **Force Golden Card**: Checkbox
- **Force Golden Chance**: Checkbox (sets 30% chance)
- **Force Big Joker**: Checkbox
- **Force Little Joker**: Checkbox

### Debug Status Display

Active debug options are shown in the debug status panel:

```
Active: GoldenCard, Scatter:3, Joker:big
```

---

## Symbol IDs

| ID | Symbol | Emoji |
|----|--------|-------|
| 1 | WILD | 🃏 |
| 2 | SCATTER | ⭐ |
| 3 | ACE | 🅰️ |
| 4 | KING | 👑 |
| 5 | QUEEN | 👸 |
| 6 | JACK | 🤴 |
| 7 | SPADE | ♠️ |
| 8 | HEART | ♥️ |
| 9 | DIAMOND | ♦️ |
| 10 | CLUB | ♣️ |

---

## Win Table

Payout multipliers for consecutive columns (3+ required):

| Symbol | 3 Cols | 4 Cols | 5 Cols |
|--------|--------|--------|--------|
| ACE | 50x | 200x | 500x |
| KING | 30x | 100x | 300x |
| QUEEN | 20x | 50x | 200x |
| JACK | 10x | 30x | 100x |
| SPADE | 8x | 20x | 50x |
| HEART | 5x | 15x | 30x |
| DIAMOND | 3x | 10x | 20x |
| CLUB | 3x | 10x | 20x |

---

## Configurable Parameters

All game parameters are configurable via `weights.ts`:

### Golden Card
- `enabled`: true/false
- `allowedColumns`: [2, 3, 4] (1-indexed)
- `spawnChance`: 0.15 (15%)
- `maxCount`: 5

### Joker
- `bigJoker.enabled`: true/false
- `bigJoker.allowedColumns`: [1, 2, 3, 4] (0-indexed, reels 2-5)
- `bigJoker.triggerChance`: 0.30 (30%)
- `littleJoker.enabled`: true/false
- `littleJoker.triggerChance`: 0.50 (50%)

### Combo Multiplier
- `levels`: [1, 2, 3, 5] (base game)
- `bonusLevels`: [2, 4, 6, 10] (bonus game)
- `applyInBonus`: true

### Bonus
- `freeSpins`: 8
- `multiplier`: 2
- `minScatters`: 3

### Retrigger
- `awards`: {3: 5, 4: 8, 5: 12}

### Buy Bonus
- `enabled`: true
- `priceMultiplier`: 75
- `scatterCount`: 3

---

## Example Flow

### Normal Spin Flow

1. Client connects via WebSocket
2. Client sends `joinRoom` → receives game config
3. Client sends `setBet` with `{bet: 1.00}` → receives spin result
4. If bonus triggered, `gameState` is `"bonus"` and `bonusGameState` is populated
5. Client sends `setBet` with `{bet: 1.00}` → uses `bonusFixBet` automatically, `awardBase` is 0

### Buy Bonus Flow

1. Client sends `setBet` with `{bet: 1.00, buyBonus: true}`
2. Server deducts 75x bet (75.00) and guarantees bonus trigger
3. Subsequent spins use `bonusFixBet` (1.00) with `awardBase: 0`

### Retrigger Flow

1. During bonus, if 3+ scatters appear, `retriggerSpinsAwarded` is set
2. `freeSpinsRemaining` and `totalFreeSpins` are updated
3. Client shows retrigger animation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-08 | Initial API documentation |
