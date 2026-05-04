# LeBandit Slot Game - Frontend

A 6x5 cluster-based slot game frontend with cascading reels, rainbow feature, and bonus games.

## Quick Start

```bash
# Start the server
cd slot-game
node server.js

# Open in browser
# http://localhost:8080/lebandit/
```

## Architecture

```
lebandit/
├── app.js          # Main game logic
├── config.js       # Game configuration
├── styles.css      # Styling
└── README.md       # This file
```

## Key Features

### Game Modes
- **Normal**: Regular spins with scatters
- **Rainbow**: Buy feature (50x cost, guaranteed rainbow)
- **Bonus Games**: Luck/Glitters/Treasure free spins

### WebSocket Communication
- Connects to backend via WebSocket
- Handles: login, setBet, syncRoomInfo
- Auto-ping to keep connection alive

### Display
- 6x5 visible grid + 5 buffer rows
- Cascade animation (symbols drop)
- Rainbow feature animation
- Bonus game UI

## Configuration

```javascript
// config.js
const CONFIG = {
  gameTypeId: 'lebandit',  // or 'thegang' for testing
  serverMode: 'fake',       // 'fake' or 'real'
  fakeServers: {
    lebandit: 'ws://localhost:3003',
    theluxe: 'ws://localhost:3002'
  }
}
```

## Symbol Display

| Symbol | Emoji | ID |
|--------|-------|-----|
| WILD | 💎 | 1 |
| SCATTER | ⭐ | 2 |
| High | 👑💍🏆💵🎴 | 201-205 |
| Low | ♠️♥️♦️♣️🃏 | 101-105 |
| Bronze Coin | 🥉 | 301 |
| Silver Coin | 🥈 | 302 |
| Gold Coin | 🥇 | 303 |
| Clover | 🍀 | 304 |
| Pot | 🏺 | 305 |
| Rainbow | 🌈 | 777 |

## Development

### Testing Cascade
Open `test-cascade.html` for cascade animation testing.

### Server Modes
- **Fake**: Uses local fake server (no AWS needed)
- **Real**: Connects to production backend

## Backend Integration

The frontend expects these WebSocket events:
- `login`: Room info, player balance
- `setBet`: Spin result with grid, wins, bonus state
- `syncRoomInfo`: Restore state after reconnect

See backend README for full API details.
