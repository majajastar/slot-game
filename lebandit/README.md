# LeBandit Slot Game - Frontend

A 6x5 cluster-based slot game with cascading reels, rainbow feature, and three bonus games.

## Quick Start

```bash
cd slot-game
node server.js
# Open http://localhost:8080/lebandit/
```

## Architecture

```
lebandit/
├── app.js          # Main game logic, WebSocket client, animation
├── config.js       # Game configuration, symbol emojis, grid layout
├── styles.css      # Game styling, animations
├── test-cascade.html  # Cascade animation testing page
└── README.md       # This file
```

## Game Overview

- **Grid**: 6 columns x 5 rows (visible), 5 buffer rows above
- **Wins**: 5+ adjacent matching symbols (cluster-based, not paylines)
- **Cascade**: Winning symbols removed, gravity drops, new symbols fill from top
- **Rainbow Feature**: 🌈 transforms golden squares to coins/clovers/pots
- **Bonus Games**: Three free spin modes with unique mechanics

## Game Modes

### Normal Mode
- Regular spins with scatters enabled
- Random rainbow chance after cascade
- Can trigger bonus games via scatters

### Rainbow Mode (Buy Feature)
- **Cost**: 50x bet (configurable)
- **Effect**: Guaranteed rainbow after every cascade
- **No scatters**: Cannot trigger bonus games
- **Purpose**: High-volatility mode for big wins

### Bonus Boost Mode
- **Cost**: 3x bet
- **Effect**: Increased scatter chance for bonus entry
- Scatters more likely to trigger bonus games

### Bonus Games (Free Spins)

| Bonus | Trigger | Spins | Golden Squares | Can Transition |
|-------|---------|-------|----------------|----------------|
| **Luck of the Bandit** | 3 scatters | 8 | Accumulate until rainbow | Yes (to Glitters) |
| **All That Glitters** | 4 scatters | 12 | Persistent entire bonus | No |
| **Treasure at End** | 5 scatters | 10 | Persistent + guaranteed rainbow | No |

## WebSocket Communication

Connects to backend via WebSocket with auto-ping:

### Events
- `login`: Room info, player balance, game state
- `setBet`: Spin result with grid, wins, bonus state
- `syncRoomInfo`: Restore state after reconnect

### Configuration

```javascript
// config.js
const CONFIG = {
  gameTypeId: 'lebandit',    // Game identifier
  serverMode: 'fake',         // 'fake' or 'real'
  fakeServers: {
    lebandit: 'ws://localhost:3003',
    theluxe: 'ws://localhost:3002'
  },
  gridLayout: {
    ROWS_VISIBLE: 5,
    ROWS_BUFFER: 5,
    COLS: 6,
    CELL_HEIGHT: 70,
    CELL_GAP: 6,
    PADDING: 15
  }
}
```

## Symbol Display

| Symbol | Emoji | ID | Type |
|--------|-------|-----|------|
| WILD | 💎 | 1 | Special |
| SCATTER | ⭐ | 2 | Special |
| High | 👑💍🏆💵🎴 | 201-205 | Regular |
| Low | ♠️♥️♦️♣️🃏 | 101-105 | Regular |
| Bronze Coin | 🥉 | 301 | Rainbow |
| Silver Coin | 🥈 | 302 | Rainbow |
| Gold Coin | 🥇 | 303 | Rainbow |
| Clover | 🍀 | 304 | Rainbow |
| Pot | 🏺 | 305 | Rainbow |
| Rainbow | 🌈 | 777 | Special |

## Display Features

### Grid Rendering
- 6x5 visible grid + 5 buffer rows above
- CSS Grid layout with configurable cell size
- Symbols rendered as divs with emoji content

### Cascade Animation
- Winning symbols fade out
- Remaining symbols drop down with gravity
- New symbols fall from top
- Step-by-step animation with delays

### Rainbow Feature Display
- Golden squares highlighted before rainbow
- Rainbow symbol appears on grid
- Coins/clovers/pots animate onto golden squares
- Collection animation (step by step)
- Win amount displayed after each round

### Bonus Game UI
- Free spins counter displayed
- Golden square persistence indicator
- Bonus type label (Luck/Glitters/Treasure)
- Retrigger notification

## State Restoration

After disconnect/reconnect:
- `syncRoomInfo` restores current grid
- Bonus state restored (spins left, golden squares)
- Seamless continuation of bonus games

## Development

### Testing Cascade
Open `test-cascade.html` for cascade animation testing.

### Server Modes
- **Fake**: Uses local fake server (no AWS needed)
- **Real**: Connects to production backend

### Key Functions

```javascript
// app.js
handleSpinResult(result)    // Process spin result, trigger animations
renderGrid(grid)            // Render symbol grid
renderCascade(cascadeSteps) // Animate cascade steps
renderRainbow(rainbowResult) // Animate rainbow feature
renderBonusState(state)     // Update bonus game UI
```

## Backend Integration

See backend README for full API details.
