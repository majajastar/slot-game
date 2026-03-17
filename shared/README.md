# TheLuxe Slot Game - Frontend

A modern HTML5 frontend for TheLuxe slot game with WebSocket connection to AWS Lambda backend.

## Features

- 🎰 **4x5 Slot Grid** - Beautiful animated slot machine interface
- 💰 **Real-time Balance** - Live balance updates from server
- 🎯 **Multiple Bet Sizes** - Configurable betting (5, 10, 20, 40, 50)
- 🎁 **Buy Bonus** - Purchase Black & Gold (80x) or Golden Hit (200x) bonuses
- ⚡ **Mega Boost** - 10x cost mode with 10x bonus entry chance
- ✨ **Win Animations** - Visual highlights for winning combinations
- 🖼️ **Sticky Frames** - Bonus game frame overlays with multipliers
- 📊 **Win Details** - Shows paylines, symbol contributions, frame multipliers
- 📝 **API Documentation** - Complete API reference in API.md

## Quick Start

### Prerequisites

- Node.js 14+
- Modern browser (Chrome, Firefox, Safari, Edge)
- AWS backend credentials

### Installation

```bash
npm install
```

### Configuration

Update `config.js` with your backend credentials:

```javascript
const CONFIG = {
    sidUrl: 'https://your-api.execute-api.region.amazonaws.com/mock-wallet/sid',
    wsBaseUrl: 'wss://your-websocket.execute-api.region.amazonaws.com/uat',
    authToken: 'your-auth-token',
    testUuid: 'your-uuid',
    testUserId: 'your-user-id',
    apiSecret: 'your-api-secret',
    operatorId: 'op001',
    gameTypeId: 'theluxe',
    currency: 'USD'
};
```

### Run

```bash
npm start
```

Then open http://localhost:3000 in your browser.

## Symbol IDs

| ID | Emoji | Name | Type |
|----|-------|------|------|
| 1 | 💎 | Wild | Special |
| 2 | ⭐ | Scatter | Special |
| 201 | 👑 | Crown | High |
| 202 | 💍 | Ring | High |
| 203 | 🏆 | Trophy | High |
| 204 | 💵 | Cash | High |
| 205 | 🎴 | Card | High |
| 101 | ♠️ | Spades | Low |
| 102 | ♥️ | Hearts | Low |
| 103 | ♦️ | Diamonds | Low |
| 104 | ♣️ | Clubs | Low |
| 777 | 🍀 | Collect | Special |

## File Structure

```
slot-game/
├── index.html          # Main HTML structure
├── styles.css          # Styling and animations
├── app.js              # Main application logic
├── ws-client.js        # WebSocket client wrapper
├── config.js           # Configuration and constants
├── API.md              # Complete API documentation
├── server.js           # HTTP server
└── package.json        # NPM configuration
```

## How to Play

1. **Connect**: The client auto-connects on page load
2. **Wait**: Automatically logs in, joins room, and syncs
3. **Set Bet**: Click +/- buttons to adjust bet amount
4. **Spin**: Click "SPIN" button
5. **Buy Bonus**: Click "Buy Bonus" for 80x or 200x bonus games
6. **Mega Boost**: Toggle switch for 10x cost mode

## API Quick Reference

See [API.md](API.md) for complete documentation.

### LineWin Format

Each winning line includes detailed win breakdown:

```javascript
{
    positions: [[row, col], ...],  // Winning symbol positions
    info: [
        lineIndex,    // [0] Payline index (0-13, -1 for collect)
        symbolId,     // [1] Symbol ID (e.g., '201')
        matchCount,   // [2] 3, 4, or 5 matches
        finalWin,     // [3] Total win after multipliers
        baseWin,      // [4] Win before multipliers (payout × bet)
        multiplier    // [5] Frame multiplier applied
    ],
    frameContribution: {
        multipliers: [2, 5],           // Individual frame multiplier values
        jackpotWins: [25, 100],        // Jackpot values hit
        totalFrameMultiplier: 10,      // Product of all frame multipliers
        totalJackpotWin: 125           // Sum of jackpot wins
    }
}
```

**Win Calculation:**
```
finalWin = (baseWin × multiplier) + jackpotWin
```

### Quick Examples

```javascript
// Normal spin
{ bet: 10 }

// Spin with Mega Boost
{ bet: 10, megaBoost: true }

// Buy Black & Gold Bonus
{ bet: 10, forceBonusType: 'BLACK_AND_GOLD' }

// Buy Golden Hit Bonus
{ bet: 10, forceBonusType: 'GOLDEN_HIT' }
```

## Development

### Adding New Features

1. **UI Elements**: Edit `index.html`
2. **Styling**: Update `styles.css`
3. **Game Logic**: Modify `app.js`
4. **API Changes**: Update `API.md`

### Debug Mode

Open browser DevTools (F12):
- Console: View WebSocket messages and game events
- Network → WS: Inspect WebSocket frames
- Elements: DOM inspection

## Game Modes

### Normal Mode
- Standard spins at 1x bet cost
- Can randomly trigger bonus games

### Mega Boost Mode
- Spins cost 10x bet
- 10x increased chance for bonus entry
- Toggle on/off with the switch

### Buy Bonus
- **Black & Gold**: 80x bet, 10 spins with sticky frames
- **Golden Hit**: 200x bet, 10 spins with doubled multipliers

## Backend Integration

This frontend connects to `minesweeper_login_lambda` backend.

Required endpoints:
- `POST /mock-wallet/sid` - Get WebSocket token
- `POST /rest/game/launch` - Launch game
- `wss://...` - WebSocket for game actions

## Scripts

```bash
npm start              # Start frontend server (port 3000)
node server.js         # Start production server
```

## License

ISC
