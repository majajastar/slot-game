# LeBandit WebSocket API Documentation

## Overview

This document describes the WebSocket API for integrating with the LeBandit slot game backend. The game uses a 6x5 grid with cluster wins, cascading reels, and a rainbow feature.

## Connection

### WebSocket URL

```javascript
// Fake/Local Server
ws://localhost:3003

// Real AWS Server
wss://br9131tad1.execute-api.ap-southeast-1.amazonaws.com/uat?token={token}&lang={lang}
```

### Connection Flow

1. **Connect to WebSocket endpoint**
2. **Send Login (type: 0)**
3. **Receive Login Response (type: 1)**
4. **Send Join Room (type: 100000, subType: 100004)**
5. **Receive Join Room Response (type: 100000, subType: 100005)** with game config
6. **Send Sync Room Info (type: 100000, subType: 100070, opCode: 'SyncRoomInfo')**
7. **Start playing with SetBet (type: 100000, subType: 100070, opCode: 'SetBet')**

## Message Format

All messages use JSON format with the following structure:

```typescript
{
  type: string,      // Message type
  data?: any,        // Message data (optional)
  vals?: any         // Response values (optional)
}
```

## API Endpoints

### 1. Login (Type 0)

Initial connection authentication.

**Request:**
```json
{
  "type": "0"
}
```

**Response (Type 1):**
```json
{
  "errCode": 0,
  "vals": {
    "type": 1,
    "data": {
      "sessionId": "fake-session-1234567890",
      "userId": "demo_user",
      "balance": 10000000000,
      "serverTime": 1234567890123
    }
  }
}
```

### 2. Join Room (Type 100000, SubType 100004)

Join the game room and receive initial configuration.

**Request:**
```json
{
  "type": "100000",
  "data": [{
    "subType": 100004
  }]
}
```

**Response (SubType 100005):**
```json
{
  "errCode": 0,
  "vals": {
    "type": 100000,
    "data": {
      "subType": 100005,
      "subData": [{
        "balance": 10000000000,
        "roomId": "lebandit-room-001",
        "gameTypeId": "lebandit",
        "betInfo": [{
          "symbols": [{"id": "201"}, {"id": "202"}, ...],
          "betSizeList": [5, 10, 20, 50, 100],
          "defaultBet": 5,
          "clusterPayoutsKeys": ["201", "202", ...],
          "clusterPayouts": {
            "201": {"payouts": [0, 0, 0, 0, 10, 20, 40, ...]},
            ...
          },
          "clusterSizeLabels": ["5", "6", "7", "8", "9-10", "11-12", "13+"],
          "bonusConfig": {
            "buyBonusEnabled": true,
            "rainbowModeEnabled": true,
            "rainbowModeCostMultiplier": 10,
            "bonusGames": [
              {
                "typeId": 1,
                "name": "Luck of the Bandit",
                "buyCostMultiplier": 100,
                "freeSpins": 8,
                "description": "8 spins with accumulating golden squares"
              },
              ...
            ]
          }
        }]
      }]
    }
  }
}
```

### 3. Sync Room Info (Type 100000, SubType 100070, OpCode 'SyncRoomInfo')

Synchronize room state and get last resume info if returning to an active game.

**Request:**
```json
{
  "type": "100000",
  "data": [{
    "subType": 100070,
    "subData": [{
      "opCode": "SyncRoomInfo"
    }]
  }]
}
```

**Response (SubType 100071):**
```json
{
  "errCode": 0,
  "vals": {
    "type": 100000,
    "data": {
      "subType": 100071,
      "subData": [{
        "errCode": 0,
        "opCode": "SyncRoomInfo",
        "roomInfo": {
          "minBet": 5,
          "maxBet": 100,
          "defaultBet": 10,
          "lastResumeInfo": {
            "grid": [["201", "202", ...], ...],
            "bonusGameState": {
              "type": "LUCK_OF_THE_BANDIT",
              "spinsLeft": 5,
              "totalSpins": 8,
              "totalWin": 1250.50
            }
          }
        }
      }]
    }
  }
}
```

### 4. SetBet / Spin (Type 100000, SubType 100070, OpCode 'SetBet')

Main game action - place a bet and spin the reels.

**Normal Spin Request:**
```json
{
  "type": "100000",
  "data": [{
    "subType": 100070,
    "subData": [{
      "opCode": "SetBet",
      "message": {
        "bet": 20,
        "rainbowMode": false
      }
    }]
  }]
}
```

**Rainbow Mode Spin Request:**
```json
{
  "type": "100000",
  "data": [{
    "subType": 100070,
    "subData": [{
      "opCode": "SetBet",
      "message": {
        "bet": 20,
        "rainbowMode": true
      }
    }]
  }]
}
```

**Buy Bonus Request:**
```json
{
  "type": "100000",
  "data": [{
    "subType": 100070,
    "subData": [{
      "opCode": "SetBet",
      "message": {
        "bet": 20,
        "forceBonusType": "LUCK_OF_THE_BANDIT"
      }
    }]
  }]
}
```

**Debug Options Request:**
```json
{
  "type": "100000",
  "data": [{
    "subType": 100070,
    "subData": [{
      "opCode": "SetBet",
      "message": {
        "bet": 20,
        "rainbowMode": false,
        "debugScatterCount": 3,
        "debugForceRainbow": true
      }
    }]
  }]
}
```

**Response (SubType 100071):**
```json
{
  "errCode": 0,
  "vals": {
    "type": 100000,
    "data": {
      "subType": 100071,
      "subData": [{
        "errCode": 0,
        "opCode": "SetBet",
        "betInfo": [{
          "bet": 20,
          "awardBase": 20,
          "winAmount": 125.50,
          "finalBalance": 9999999875.50,
          "gameResult": {
            "grid": [["201", "202", ...], ...],
            "symbolMap": {...},
            "totalWinAmount": 125.50,
            "clusterWins": [...],
            "cascadeSteps": [...],
            "rainbowResult": {
              "hasRainbow": true,
              "totalCoinWin": 75.50,
              "rounds": [...]
            },
            "goldenSquares": [...],
            "bonusGameState": {
              "type": "LUCK_OF_THE_BANDIT",
              "spinsLeft": 8,
              "totalSpins": 8,
              "isActive": true
            },
            "bet": 20,
            "cost": 20
          }
        }]
      }]
    }
  }
}
```

## Message Parameters

### SetBet Message Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `bet` | number | Yes | Bet amount (must be from betSizeList) |
| `rainbowMode` | boolean | No | Enable rainbow mode (10x cost) |
| `forceBonusType` | string | No | Force bonus game entry: `"LUCK_OF_THE_BANDIT"`, `"ALL_THAT_GLITTERS_IS_GOLD"`, `"TREASURE_AT_END_OF_RAINBOW"` |
| `debugScatterCount` | number | No | Debug: Force specific scatter count (0-5) |
| `debugForceRainbow` | boolean | No | Debug: Force rainbow to always trigger |

### Game Result Fields

| Field | Type | Description |
|-------|------|-------------|
| `grid` | string[][] | Final symbol grid (6x5) |
| `symbolMap` | Map | Symbol instances with IDs |
| `totalWinAmount` | number | Total win amount for this spin |
| `clusterWins` | array | Winning clusters information |
| `cascadeSteps` | array | Cascade/tumbling steps |
| `rainbowResult` | object | Rainbow feature result |
| `goldenSquares` | array | Golden square positions (persists until rainbow in bonus) |
| `bonusGameState` | object | Active bonus game state |
| `bet` | number | Bet amount |
| `cost` | number | Actual cost (includes rainbow multiplier) |

## Error Handling

### Common Error Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Invalid bet size |
| 2 | Insufficient balance |
| 3 | Invalid bonus type |
| 4 | Game not available |
| 500 | System error |

### Error Response Format

```json
{
  "errCode": 1,
  "errMsg": "Invalid bet size",
  "vals": {
    "type": 100000,
    "data": {
      "subType": 100071,
      "subData": [{
        "errCode": 1,
        "errMsg": "Invalid bet size"
      }]
    }
  }
}
```

## Frontend Integration Example

### Connection Setup

```javascript
const socket = new WebSocket('ws://localhost:3003');

socket.onopen = () => {
  // Send login
  socket.send(JSON.stringify({ type: '0' }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  handleMessage(data);
};
```

### Message Handler

```javascript
function handleMessage(data) {
  const type = data.vals?.type || data.type;

  switch (type) {
    case 1:
      // Login response
      sendJoinRoom();
      break;
    case 100000:
      const subType = data.vals?.data?.subType;
      if (subType === 100005) {
        handleJoinRoom(data.vals.data.subData[0]);
      } else if (subType === 100071) {
        handleSetBetResponse(data.vals.data.subData[0]);
      }
      break;
  }
}
```

### Send Spin Request

```javascript
function sendSpin(bet, rainbowMode = false) {
  const message = {
    type: '100000',
    data: [{
      subType: 100070,
      subData: [{
        opCode: 'SetBet',
        message: {
          bet: bet,
          rainbowMode: rainbowMode
        }
      }]
    }]
  };
  socket.send(JSON.stringify(message));
}
```

## Best Practices

1. **Always check `errCode`** in responses before processing data
2. **Store `bonusConfig`** from JoinRoom for dynamic UI rendering
3. **Handle reconnection** by checking `lastResumeInfo` in SyncRoomInfo
4. **Disable UI** during spin processing to prevent double-clicks
5. **Use `symbolMap`** for tracking symbol lifecycle during animations
6. **Golden squares persist** in bonus mode until rainbow triggers (Luck of the Bandit)
7. **Rainbow symbol** should not be replaced by scatters - it persists on the grid

## Debug Mode

For testing, you can use these debug parameters in SetBet:

- `debugScatterCount: 3` - Forces exactly 3 scatters
- `debugForceRainbow: true` - Forces rainbow to always trigger

These are only available in development/fake server mode.
