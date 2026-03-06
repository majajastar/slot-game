# TheLuxe Frontend API Documentation

Complete API reference for frontend integration with TheLuxe slot game.

## Symbol IDs

| Symbol | ID | Emoji | Type |
|--------|-----|-------|------|
| WILD | `1` | 💎 | Special |
| SCATTER | `2` | ⭐ | Special |
| High 1 | `201` | 👑 | High Payout |
| High 2 | `202` | 💍 | High Payout |
| High 3 | `203` | 🏆 | High Payout |
| High 4 | `204` | 💵 | High Payout |
| High 5 | `205` | 🎴 | High Payout |
| Low 1 | `101` | ♠️ | Low Payout |
| Low 2 | `102` | ♥️ | Low Payout |
| Low 3 | `103` | ♦️ | Low Payout |
| Low 4 | `104` | ♣️ | Low Payout |
| COLLECT | `777` | 🍀 | Special |

---

## API Endpoints

### Base Message Structure

All game actions use WebSocket messages with this structure:

```javascript
{
    type: '100000',
    data: [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: { /* action-specific data */ }
        }]
    }]
}
```

---

## Connection & Session APIs

### 1. Login

Authenticate and start a session. Usually called automatically on connect.

```javascript
send('0', [{ subType: 0 }]);
```

**Response:**
```javascript
{
    vals: {
        type: 1,
        data: {
            sessionId: 'abc123',
            userId: 'user123',
            balance: 1000.00
        }
    }
}
```

---

### 2. Join Room

Join the game room to start playing.

```javascript
send('100000', [{ subType: 100004 }]);
```

Or with room ID:
```javascript
send('100000', [{ 
    subType: 100004,
    subData: [{ roomId: 'room123' }]
}]);
```

**Response:**
```javascript
{
    vals: {
        type: 100000,
        data: {
            subType: 100005,
            subData: [{
                roomId: 'theluxe-room-123',
                gameTypeId: 'theluxe',
                betInfo: [{
                    bet: 10,
                    symbols: { /* symbol configuration */ },
                    paylines: [ /* 14 paylines */ ],
                    jackpots: { /* jackpot values */ },
                    bonuses: {
                        blackAndGold: { buyPriceMultiplier: 80 },
                        goldenHit: { buyPriceMultiplier: 200 },
                        megaBoost: { costMultiplier: 10, bonusEntryMultiplier: 10 }
                    },
                    frameConfig: { /* frame chances */ }
                }]
            }]
        }
    }
}
```

**Key Response Fields:**

| Field | Description |
|-------|-------------|
| `roomId` | Unique room identifier |
| `betInfo[0].symbols` | Symbol definitions and payouts |
| `betInfo[0].paylines` | All 14 payline patterns |
| `betInfo[0].jackpots` | Jackpot values (25x, 100x, 500x, 1000x) |
| `betInfo[0].bonuses` | Bonus buy prices and Mega Boost config |
| `betInfo[0].frameConfig` | Frame appearance chances |

---

### 3. Sync Room Info

Get current room state including balance and game state. Called periodically (heartbeat).

```javascript
send('100000', [{
    subType: 100070,
    subData: [{ opCode: 'SyncRoomInfo' }]
}]);
```

**Response:**
```javascript
{
    vals: {
        type: 100000,
        data: {
            subType: 100071,
            subData: [{
                opCode: 'SyncRoomInfo',
                roomInfo: {
                    roomId: 'theluxe-room-123',
                    balance: 950.50,
                    currency: 'USD',
                    isInPlay: false,
                    symbols: { /* symbol data */ },
                    lastRecord: {
                        gameResult: {
                            info: {
                                grid: [['1', '201', ...], ...],
                                stickyFrames: [...],
                                bonusGameState: {
                                    type: 'BLACK_AND_GOLD',
                                    spinsLeft: 5
                                }
                            }
                        }
                    }
                }
            }]
        }
    }
}
```

**Key Response Fields:**

| Field | Description |
|-------|-------------|
| `roomInfo.balance` | Current player balance |
| `roomInfo.isInPlay` | Whether a game is in progress |
| `roomInfo.lastRecord` | Last game result (for state restoration) |
| `roomInfo.lastRecord.gameResult.info.stickyFrames` | Current sticky frames (for bonus restore) |
| `roomInfo.lastRecord.gameResult.info.bonusGameState` | Active bonus state if in bonus |

---

### 4. Get Records

Fetch game history/records.

```javascript
send('100000', [{
    subType: 100070,
    subData: [{ opCode: 'GetRecords', message: { limit: 20 } }]
}]);
```

**Response:**
```javascript
{
    vals: {
        type: 100000,
        data: {
            subType: 100071,
            subData: [{
                opCode: 'GetRecords',
                records: [
                    {
                        id: 'record-123',
                        timestamp: '2024-03-01T12:00:00Z',
                        bet: 10,
                        winAmount: 50,
                        gameResult: { /* full result */ }
                    }
                ]
            }]
        }
    }
}
```

---

## Gameplay APIs

## 1. Normal Spin

Spin the reels with a standard bet.

```javascript
send({
    type: '100000',
    data: [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: {
                bet: 10  // Bet amount (from BET_SIZE_LIST)
            }
        }]
    }]
});
```

**Cost:** 1x bet

---

## 2. Buy Bonus

Purchase and trigger a bonus game directly.

### Buy Black & Gold Bonus

```javascript
send({
    type: '100000',
    data: [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: {
                bet: 10,
                forceBonusType: 'BLACK_AND_GOLD'  // Triggers Black & Gold bonus
            }
        }]
    }]
});
```

**Cost:** 80x bet  
**Spins:** 10 free spins  
**Feature:** Sticky golden frames

### Buy Golden Hit Bonus

```javascript
send({
    type: '100000',
    data: [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: {
                bet: 10,
                forceBonusType: 'GOLDEN_HIT'  // Triggers Golden Hit bonus
            }
        }]
    }]
});
```

**Cost:** 200x bet  
**Spins:** 10 free spins  
**Feature:** Doubled multipliers

### Response Fields

| Field | Description |
|-------|-------------|
| `awardBase` | Bonus cost deducted (e.g., 800 for Black & Gold with bet=10) |
| `info.bonusGameState` | Current bonus game state |
| `info.stickyFrames` | Initial sticky frames (4x5 grid of frame values) |
| `info.bonusSpinsLeft` | Remaining bonus spins |

---

## 3. Mega Boost Mode

Enable Mega Boost for increased bonus entry chance (10x cost).

```javascript
send({
    type: '100000',
    data: [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: {
                bet: 10,
                megaBoost: true  // Enable Mega Boost
            }
        }]
    }]
});
```

**Cost:** 10x bet  
**Bonus Entry:** 10x normal chance  
**Effect:** Can randomly trigger Black & Gold or Golden Hit

---

## 4. Combined: Buy Bonus + Mega Boost

Buy a bonus with Mega Boost active (for subsequent spins).

```javascript
send({
    type: '100000',
    data: [{
        subType: 100070,
        subData: [{
            opCode: 'SetBet',
            message: {
                bet: 10,
                forceBonusType: 'BLACK_AND_GOLD',
                megaBoost: true  // Active for post-bonus normal spins
            }
        }]
    }]
});
```

**Note:** Mega Boost only affects normal spins after the bonus ends.

---

## Summary Table

### Connection & Session

| Action | Type | subType | Description |
|--------|------|---------|-------------|
| Login | `0` | `0` | Authenticate session |
| Join Room | `100000` | `100004` | Enter game room |
| Sync Room | `100000` | `100070` | Get room state |
| Get Records | `100000` | `100070` | Fetch history |

### Gameplay

| Feature | Field | Values | Cost |
|---------|-------|--------|------|
| Normal Spin | `bet` only | Any from bet list | 1x bet |
| Mega Boost | `megaBoost: true` | `true` / `false` | 10x bet |
| Buy Black & Gold | `forceBonusType` | `'BLACK_AND_GOLD'` | 80x bet |
| Buy Golden Hit | `forceBonusType` | `'GOLDEN_HIT'` | 200x bet |

---

## WebSocket Connection Setup

### Complete Connection Flow

Full example of connecting to the production server:

```javascript
// ==========================================
// 1. CONFIGURATION
// ==========================================

const CONFIG = {
    // Production server endpoints
    sidUrl: 'https://lbucmxb2ke.execute-api.ap-southeast-1.amazonaws.com/mock-wallet/sid',
    wsBaseUrl: 'wss://br9131tad1.execute-api.ap-southeast-1.amazonaws.com/uat',
    
    // Authentication credentials
    authToken: 'your-auth-token-here',
    testUuid: 'your-uuid-here',
    testUserId: 'your-user-id',
    apiSecret: 'your-api-secret',
    operatorId: 'op001',
    
    // Game settings
    gameTypeId: 'theluxe',
    currency: 'USD'
};

// ==========================================
// 2. WEBSOCKET URL BUILDER
// ==========================================

function getWebSocketUrl(token, lang = 'en') {
    return `${CONFIG.wsBaseUrl}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}

// ==========================================
// 3. AUTHENTICATION (Get SID)
// ==========================================

async function authenticate() {
    const response = await fetch(CONFIG.sidUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Secret': CONFIG.apiSecret
        },
        body: JSON.stringify({
            authToken: CONFIG.authToken,
            uuid: CONFIG.testUuid,
            userId: CONFIG.testUserId,
            operatorId: CONFIG.operatorId,
            gameTypeId: CONFIG.gameTypeId,
            currency: CONFIG.currency
        })
    });
    
    if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.token; // Returns WebSocket token
}

// ==========================================
// 4. WEBSOCKET CLIENT CLASS
// ==========================================

class TheLuxeWebSocket {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.messageQueue = [];
        this.pingInterval = null;
        
        // Event callbacks
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onError: null,
            onLogin: null,
            onJoinRoom: null,
            onSyncRoom: null,
            onSetBet: null
        };
    }
    
    // Set event handlers
    on(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event)) {
            this.callbacks['on' + event] = callback;
        }
    }
    
    // Connect to WebSocket
    async connect(token, lang = 'en') {
        const wsUrl = getWebSocketUrl(token, lang);
        
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('[WS] Connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startPingInterval();
                
                if (this.callbacks.onConnect) {
                    this.callbacks.onConnect();
                }
                
                // Auto-initiate login flow
                this.initiateLoginFlow();
                resolve();
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.socket.onerror = (error) => {
                console.error('[WS] Error:', error);
                if (this.callbacks.onError) {
                    this.callbacks.onError(error);
                }
                reject(error);
            };
            
            this.socket.onclose = () => {
                console.log('[WS] Disconnected');
                this.isConnected = false;
                this.stopPingInterval();
                
                if (this.callbacks.onDisconnect) {
                    this.callbacks.onDisconnect();
                }
                
                // Attempt reconnection
                this.attemptReconnect();
            };
        });
    }
    
    // Initiate login flow after connection
    initiateLoginFlow() {
        // Step 1: Login
        this.sendLogin();
        
        // Step 2: Join room (after login response)
        this.on('Login', () => {
            this.sendJoinRoom();
        });
        
        // Step 3: Sync room info (after join room response)
        this.on('JoinRoom', () => {
            this.sendSyncRoomInfo();
            // Start periodic sync
            this.startPeriodicSync();
        });
    }
    
    // Send message
    send(type, data) {
        const message = JSON.stringify({ type, data });
        
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(message);
            return true;
        } else {
            console.warn('[WS] Not connected, queuing message');
            this.messageQueue.push({ type, data });
            return false;
        }
    }
    
    // Process queued messages after connection
    flushMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const { type, data } = this.messageQueue.shift();
            this.send(type, data);
        }
    }
    
    // Handle incoming messages
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.errCode !== 0) {
                console.error('[WS] Server error:', message.errCode, message);
                if (this.callbacks.onError) {
                    this.callbacks.onError(message);
                }
                return;
            }
            
            const { type, data: msgData } = message.vals || {};
            
            switch (type) {
                case 1: // Login response
                    this.handleLogin(msgData);
                    break;
                case 100000: // Game messages
                    this.handleGameMessage(msgData);
                    break;
                default:
                    console.warn('[WS] Unknown message type:', type);
            }
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
        }
    }
    
    // Message handlers
    handleLogin(data) {
        console.log('[WS] Login success:', data.sessionId);
        if (this.callbacks.onLogin) {
            this.callbacks.onLogin(data);
        }
    }
    
    handleGameMessage(data) {
        const subType = data.subType;
        const subData = data.subData?.[0];
        
        switch (subType) {
            case 100005: // Join room response
                if (this.callbacks.onJoinRoom) {
                    this.callbacks.onJoinRoom(subData);
                }
                break;
            case 100071: // Sync room / Set bet response
                if (subData?.opCode === 'SyncRoomInfo') {
                    if (this.callbacks.onSyncRoom) {
                        this.callbacks.onSyncRoom(subData);
                    }
                } else if (subData?.opCode === 'SetBet') {
                    if (this.callbacks.onSetBet) {
                        this.callbacks.onSetBet(subData);
                    }
                }
                break;
        }
    }
    
    // API Methods
    sendLogin() {
        return this.send('0', [{ subType: 0 }]);
    }
    
    sendJoinRoom() {
        return this.send('100000', [{ subType: 100004 }]);
    }
    
    sendSyncRoomInfo() {
        return this.send('100000', [{
            subType: 100070,
            subData: [{ opCode: 'SyncRoomInfo' }]
        }]);
    }
    
    sendSetBet(bet, options = {}) {
        const message = { bet, ...options };
        return this.send('100000', [{
            subType: 100070,
            subData: [{ opCode: 'SetBet', message }]
        }]);
    }
    
    // Keep-alive ping
    startPingInterval() {
        this.stopPingInterval();
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendSyncRoomInfo();
            }
        }, 20000); // Every 20 seconds
    }
    
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    // Periodic sync for state updates
    startPeriodicSync() {
        // Sync every 30 seconds to keep balance/state updated
        this.syncInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendSyncRoomInfo();
            }
        }, 30000);
    }
    
    // Reconnection logic
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WS] Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(async () => {
            try {
                const token = await authenticate();
                await this.connect(token);
            } catch (error) {
                console.error('[WS] Reconnection failed:', error);
            }
        }, delay);
    }
    
    // Disconnect
    disconnect() {
        this.stopPingInterval();
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        if (this.socket) {
            this.socket.close();
        }
    }
}

// ==========================================
// 5. USAGE EXAMPLE
// ==========================================

async function initializeGame() {
    const client = new TheLuxeWebSocket();
    
    // Set up event handlers
    client.on('Connect', () => {
        console.log('Connected to server');
    });
    
    client.on('Login', (data) => {
        console.log('Logged in:', data.sessionId);
    });
    
    client.on('JoinRoom', (data) => {
        console.log('Joined room:', data.roomId);
        // Store game configuration
        const config = data.betInfo?.[0];
        window.gameConfig = config;
    });
    
    client.on('SyncRoom', (data) => {
        console.log('Balance:', data.roomInfo?.balance);
        // Update UI with balance
        updateBalanceDisplay(data.roomInfo?.balance);
    });
    
    client.on('SetBet', (data) => {
        const result = data.betInfo?.[0]?.gameResult;
        if (result) {
            handleSpinResult(result);
        }
    });
    
    client.on('Error', (error) => {
        console.error('Connection error:', error);
        showErrorMessage('Connection lost. Retrying...');
    });
    
    client.on('Disconnect', () => {
        console.log('Disconnected from server');
    });
    
    try {
        // Step 1: Authenticate to get token
        console.log('Authenticating...');
        const token = await authenticate();
        
        // Step 2: Connect WebSocket
        console.log('Connecting WebSocket...');
        await client.connect(token);
        
        // Connection established and login flow initiated automatically
        console.log('Game ready!');
        
        return client;
    } catch (error) {
        console.error('Failed to initialize:', error);
        throw error;
    }
}

// Initialize
initializeGame().then(client => {
    // Now you can play
    // Spin: client.sendSetBet(10)
    // Buy Bonus: client.sendSetBet(10, { forceBonusType: 'BLACK_AND_GOLD' })
});
```

---

## WebSocket Client Methods

Using the `TheLuxeWSClient` class from `ws-client.js`:

### Initialize Client

```javascript
const client = new TheLuxeWSClient();

// Set up callbacks
client.on('Login', (data) => {
    console.log('Logged in:', data.sessionId);
});

client.on('JoinRoom', (data) => {
    console.log('Joined room:', data.roomId);
    // Store initial game config
    const betInfo = data.betInfo?.[0];
    if (betInfo) {
        console.log('Symbols:', betInfo.symbols);
        console.log('Paylines:', betInfo.paylines);
        console.log('Bonuses:', betInfo.bonuses);
    }
});

client.on('SyncRoom', (data) => {
    console.log('Balance:', data.roomInfo?.balance);
    // Restore bonus state if in bonus
    const lastRecord = data.roomInfo?.lastRecord;
    if (lastRecord?.gameResult?.info?.bonusGameState) {
        console.log('Resuming bonus:', lastRecord.gameResult.info.bonusGameState);
    }
});

client.on('SetBet', (data) => {
    const result = data.betInfo?.[0]?.gameResult;
    if (result) {
        console.log('Win:', result.winAmount);
        console.log('Bonus:', result.info?.bonusGameState);
    }
});

// Connect
await client.connect('your-token', 'en');

// Auto-join flow (called after connection)
client.sendLogin();
client.sendJoinRoom();
client.sendSyncRoomInfo();
```

### Session Management Methods

```javascript
// Login
client.sendLogin();

// Join Room
client.sendJoinRoom();

// Sync Room Info (heartbeat)
client.sendSyncRoomInfo();

// Get Records
client.send('100000', [{
    subType: 100070,
    subData: [{ opCode: 'GetRecords', message: { limit: 20 } }]
}]);
```

### Gameplay Methods

```javascript
// Normal spin
client.sendSetBet(10, 14);

// Spin with Mega Boost
function sendMegaBoostSpin(bet) {
    return client.send('100000', [{
        subType: 100070,
        subData: [{ 
            opCode: 'SetBet', 
            message: { bet, megaBoost: true } 
        }]
    }]);
}

// Buy Bonus
function buyBonus(bet, bonusType) {
    return client.send('100000', [{
        subType: 100070,
        subData: [{ 
            opCode: 'SetBet', 
            message: { bet, forceBonusType: bonusType } 
        }]
    }]);
}

// Usage
buyBonus(10, 'BLACK_AND_GOLD');  // Buy Black & Gold
buyBonus(10, 'GOLDEN_HIT');      // Buy Golden Hit
```

---

## Response Handling

### Successful Spin Response

```javascript
{
    betInfo: [{
        gameResult: {
            awardBase: 10,           // Amount deducted
            winAmount: 50,           // Total win
            info: {
                grid: [['1', '201', '101', ...], ...],  // 4x5 symbol grid
                lineWins: [...],       // Winning paylines
                totalWinAmount: 50,
                bonusGameState: null,  // or bonus state if in bonus
                stickyFrames: [...],   // Frame overlay data
                isInBonus: false,
                bonusSpinsLeft: 0
            }
        }
    }]
}
```

### Buy Bonus Response

```javascript
{
    betInfo: [{
        gameResult: {
            awardBase: 800,          // Bonus cost (80x bet)
            winAmount: 0,            // No immediate win
            info: {
                bonusGameState: {
                    type: 'BLACK_AND_GOLD',
                    spinsLeft: 10,       // Remaining spins
                    totalSpins: 0        // Spins already played (0 at start)
                },
                stickyFrames: [...],  // Initial frames
                isInBonus: true
            }
        }
    }]
}
```

### Bonus Game State Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | Bonus type: `'BLACK_AND_GOLD'` or `'GOLDEN_HIT'` |
| `spinsLeft` | `number` | Number of remaining spins in the bonus |
| `totalSpins` | `number` | Number of spins already played in this bonus (increments after each spin) |
| `stickyFrames` | `array` | Current sticky frame overlay on the grid |
| `initialFrames` | `boolean` | Whether this is the initial frame setup (Golden Hit only) |
| `totalWin` | `number` | Cumulative win amount from all bonus spins so far |

**Example Progression:**
- Buy bonus: `spinsLeft: 10, totalSpins: 0`
- After 1st spin: `spinsLeft: 9, totalSpins: 1`
- After 5th spin: `spinsLeft: 5, totalSpins: 5`
- After last spin: `spinsLeft: 0, totalSpins: 10`

---

## LineWin Data Structure

Each object in the `lineWins` array represents a winning payline with detailed win information.

### LineWin Format

```javascript
{
    positions: [[row, col], [row, col], ...],  // Grid positions of winning symbols (0-indexed)
    info: [
        lineIndex,    // [0] Payline index (0-13 for regular lines, -1 for collect symbol)
        symbolId,     // [1] Symbol ID that formed the win (e.g., '201' for Crown)
        matchCount,   // [2] Number of consecutive matches (3, 4, or 5)
        finalWin,     // [3] Total win amount after all multipliers applied
        baseWin,      // [4] Win before frame multipliers (payout × bet)
        multiplier    // [5] Total frame multiplier applied (product of all frame multipliers)
    ],
    frameContribution: {
        multipliers: [2, 5],           // Array of individual frame multiplier values on winning positions
        jackpotWins: [25],             // Array of jackpot values hit (if any)
        totalFrameMultiplier: 10,      // Product of all frame multipliers (2 × 5 = 10)
        totalJackpotWin: 25            // Sum of all jackpot wins
    }
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `positions` | `number[][]` | Array of [row, col] pairs showing winning symbol positions |
| `info[0]` | `number` | Payline index (0-13 for regular lines, -1 for collect symbol wins) |
| `info[1]` | `string` | Symbol ID (e.g., '1' for WILD, '201' for Crown, '777' for COLLECT) |
| `info[2]` | `number` | Number of consecutive matching symbols (3, 4, or 5) |
| `info[3]` | `number` | **finalWin** - Total win after all frame multipliers and jackpots |
| `info[4]` | `number` | **baseWin** - Win before frame multipliers (symbol payout × bet) |
| `info[5]` | `number` | **multiplier** - Total frame multiplier applied (product of all frame multipliers) |
| `frameContribution.multipliers` | `number[]` | Individual multiplier frame values on winning positions |
| `frameContribution.jackpotWins` | `number[]` | Jackpot values hit on winning positions |
| `frameContribution.totalFrameMultiplier` | `number` | Product of all frame multipliers |
| `frameContribution.totalJackpotWin` | `number` | Sum of all jackpot wins |

### Win Calculation

```
lineWin = baseWin × multiplier
finalWin = lineWin + jackpotWin
         = (baseWin × multiplier) + totalJackpotWin
```

Where:
- `baseWin = payoutTable[symbol][matchCount] × bet`
- `multiplier = product of all frame multipliers on winning positions`
- `jackpotWin = sum of all jackpot frame values × bet`

### Example LineWin

```javascript
{
    positions: [[1, 0], [1, 1], [1, 2], [1, 3]],
    info: [0, "201", 4, 100, 50, 2],
    frameContribution: {
        multipliers: [2],
        jackpotWins: [],
        totalFrameMultiplier: 2,
        totalJackpotWin: 0
    }
}
```

**Interpretation:**
- Line 1 (index 0, middle row) won
- Crown symbol (ID: 201) matched 4 times
- Base win: 50 × bet (Crown 4-match payout × bet)
- Frame multiplier: 2x (from a 2x frame on one of the winning positions)
- Final win: 100 × bet (50 base × 2 multiplier)

### Collect Symbol Example

```javascript
{
    positions: [[2, 3]],
    info: [-1, "777", 1, 75, 0, 1],
    frameContribution: {
        multipliers: [],
        jackpotWins: [],
        totalFrameMultiplier: 0,
        totalJackpotWin: 75
    }
}
```

**Interpretation:**
- Collect symbol (🍀) appeared at position [2, 3]
- baseWin is 0 (collect doesn't have line payouts)
- Final win: 75 × bet (sum of all frame values on the grid)

---

## Error Handling

Common error codes from server:

| Code | Meaning | Action |
|------|---------|--------|
| `0` | Success | Process result |
| `1001` | Insufficient balance | Show error message |
| `1002` | Invalid bet | Check BET_SIZE_LIST |
| `1003` | Already in bonus | Disable buy bonus button |
| `1004` | Invalid bonus type | Check forceBonusType value |

```javascript
if (message.errCode !== 0) {
    console.error('Server error:', message.errCode);
    // Handle specific error
    switch(message.errCode) {
        case 1001: showError('Insufficient balance'); break;
        case 1002: showError('Invalid bet amount'); break;
        // ... etc
    }
}
```
