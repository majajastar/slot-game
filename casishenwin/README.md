# Casishenwin Slot Game - Frontend

A 6x5 grid slot game with multi-row occupancy, rolling top row, and Silver/Golden frame progression.

## Quick Start

```bash
cd slot-game
node server.js
# Open http://localhost:8080/casishenwin/
```

## Architecture

```
casishenwin/
├── app.js          # Main game logic, WebSocket client, rendering
├── config.js       # Game configuration, symbol emojis, grid layout
├── styles.css      # Game styling, animations
├── index.html      # Game page structure
└── README.md       # This file
```

## Game Overview

- **Grid**: 6 columns x 5 rows main grid + 4-column top row
- **Multi-Row**: Middle columns (2-5) can have symbols occupying 2-4 rows
- **Top Row**: 4 symbols above middle columns, rolls right-to-left after each cascade
- **WinRoad**: Total Win = Payout × WinRoad (product of symbol counts per column)
- **Frames**: Silver → Golden → Wild progression on wins
- **Cascade**: Winning symbols removed, gravity drops, new symbols fill

## WebSocket Communication

Connects to backend via WebSocket with auto-ping:

### Events
- `login`: Room info, player balance, game state
- `joinRoom`: Game configuration (symbols, paytable, bet sizes)
- `setBet`: Spin result with grid, wins, cascade steps
- `syncRoomInfo`: Restore state after reconnect

### Configuration

```javascript
// config.js
const CONFIG = {
  gameTypeId: 'casishenwin',    // Game identifier
  serverMode: 'fake',            // 'fake' or 'real'
  fakeServers: {
    casishenwin: 'ws://localhost:3004'
  },
  gridLayout: {
    ROWS_VISIBLE: 5,
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
| Crown | 👑 | 201 | High |
| Ring | 💍 | 202 | High |
| Trophy | 🏆 | 203 | High |
| Cash | 💵 | 204 | High |
| Card | 🎴 | 205 | High |
| Spade | ♠️ | 101 | Low |
| Heart | ♥️ | 102 | Low |
| Diamond | ♦️ | 103 | Low |
| Club | ♣️ | 104 | Low |
| Joker | 🃏 | 105 | Low |

## Display Features

### Grid Rendering
- 6x5 main grid with CSS Grid layout
- 4-column top row above middle columns
- Multi-row symbols span multiple rows in middle columns
- Frame overlays (Silver/Golden) on symbols

### Cascade Animation
- Winning symbols highlighted
- Removed symbols fade out
- Remaining symbols drop down with gravity
- New symbols fall from top
- Top row rolls right-to-left

### Frame Progression
- Silver frame appears randomly on symbols
- Silver frame in win → becomes Golden frame
- Golden frame in win → becomes Wild symbol
- Frames persist between spins until triggered

## State Restoration

After disconnect/reconnect:
- `syncRoomInfo` restores current grid
- Frame state restored
- Seamless continuation

## Development

### Server Modes
- **Fake**: Uses local fake server (no AWS needed)
- **Real**: Connects to production backend

### Key Functions

```javascript
// app.js
handleSpinResult(result)    // Process spin result, update UI
renderGrid(grid)            // Render main grid and top row
renderPaytable()            // Render win table
updateBalanceDisplay()      // Update balance
```

## Backend Integration

See backend README for full API details.
