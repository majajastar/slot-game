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

| Feature | Field | Values | Cost |
|---------|-------|--------|------|
| Normal Spin | `bet` only | Any from bet list | 1x bet |
| Mega Boost | `megaBoost: true` | `true` / `false` | 10x bet |
| Buy Black & Gold | `forceBonusType` | `'BLACK_AND_GOLD'` | 80x bet |
| Buy Golden Hit | `forceBonusType` | `'GOLDEN_HIT'` | 200x bet |

---

## WebSocket Client Methods

Using the `TheLuxeWSClient` class from `ws-client.js`:

### Initialize Client

```javascript
const client = new TheLuxeWSClient();

// Set up callbacks
client.on('SetBet', (data) => {
    const result = data.betInfo?.[0]?.gameResult;
    if (result) {
        console.log('Win:', result.winAmount);
        console.log('Bonus:', result.info?.bonusGameState);
    }
});

// Connect
await client.connect('your-token', 'en');
```

### Helper Methods

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
                    spinsLeft: 10,
                    totalSpins: 10
                },
                stickyFrames: [...],  // Initial frames
                isInBonus: true
            }
        }
    }]
}
```

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
