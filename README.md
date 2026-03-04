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

### Installation

```bash
npm install
```

### Run with Fake Server (Local Testing)

```bash
# Terminal 1: Start fake server
node fake-server.js

# Terminal 2: Start frontend
node server.js
```

Then open http://localhost:3000 in your browser.

### Run with Production Backend

Update `config.js` with your credentials:
```javascript
authToken: 'your-auth-token',
testUuid: 'your-uuid',
testUserId: 'your-user-id',
apiSecret: 'your-api-secret'
```

Then start the frontend:
```bash
node server.js
```

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
├── fake-server.js      # Local testing server
├── server.js           # Production HTTP server
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

### Testing Locally

Use the fake server for development without AWS:

```bash
node fake-server.js  # Runs on port 3001 (HTTP) and 3002 (WebSocket)
```

The fake server simulates:
- Login/authentication
- Room joining
- Spin results
- Bonus games
- Mega Boost mode
- Balance updates

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
node fake-server.js    # Start fake backend (ports 3001/3002)
node server.js         # Start production server
```

## License

ISC
