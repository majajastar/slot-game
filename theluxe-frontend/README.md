# TheLuxe Slot Game - Frontend

A modern HTML5 frontend for TheLuxe slot game with WebSocket connection to the game server.

## Features

- 🎰 **4x5 Slot Grid** - Beautiful animated slot machine interface
- 💰 **Real-time Balance** - Live balance updates from server
- 🎯 **Configurable Betting** - Adjustable bet amount (1-100) and lines (1-14)
- ✨ **Win Animations** - Visual highlights for winning combinations
- 📊 **Line Win Details** - Shows which paylines won and how much
- 📝 **Message Logs** - Real-time WebSocket message logging
- 🎨 **Modern UI** - Dark theme with gold accents

## Quick Start

### Option 1: Using Node.js server

```bash
cd theluxe-frontend
npm install
npm start
```

Then open http://localhost:3000 in your browser.

### Option 2: Using any static server

```bash
cd theluxe-frontend
npx http-server -p 3000
```

## How to Play

1. **Connect**: Click "Connect" button (auto-fetches token if empty)
2. **Wait**: The client will automatically:
   - Login to the server
   - Join the lobby
   - Enter the game room
   - Sync room info
3. **Set Bet**: Choose bet amount and number of lines
4. **Spin**: Click the "SPIN" button
5. **Win**: Watch for winning combinations and celebrate!

## File Structure

```
theluxe-frontend/
├── index.html      # Main HTML structure
├── styles.css      # Styling and animations
├── app.js          # Main application logic
├── ws-client.js    # WebSocket client wrapper
├── config.js       # Configuration and constants
├── server.js       # Simple HTTP server
└── package.json    # NPM configuration
```

## WebSocket Message Flow

```
1. Client -> Server: Login (type 0)
2. Server -> Client: Login Response (type 1)
3. Client -> Server: Lobby Request (type 2)
4. Server -> Client: Lobby Response (type 3)
5. Client -> Server: Join Room (type 100000, subType 100004)
6. Server -> Client: Join Room Response (type 100000, subType 100005)
7. Client -> Server: Sync Room Info (type 100000, subType 100070, opCode: SyncRoomInfo)
8. [Every 20s] Client -> Server: Ping/Sync Room Info
9. [On Spin] Client -> Server: SetBet (type 100000, subType 100070, opCode: SetBet)
10. Server -> Client: Spin Result (type 100000, subType 100071, opCode: SetBet)
```

## Data Format

### Spin Result (SetBet Response)

```json
{
  "opCode": "SetBet",
  "betInfo": [{
    "bet": 10,
    "line": 14,
    "gameResult": {
      "grid": [
        ["SYM_1", "WILD", "SYM_3", "SYM_2", "SYM_5"],
        ["SYM_4", "SYM_1", "WILD", "SYM_3", "SYM_6"],
        ["SYM_7", "SYM_2", "SYM_1", "WILD", "SYM_4"],
        ["SYM_5", "SYM_3", "SYM_2", "SYM_1", "SYM_8"]
      ],
      "totalWinAmount": 50,
      "lineWins": [
        {
          "positions": [[0,0], [0,1], [0,2]],
          "info": [0, "SYM_1", 3, 30]
        }
      ]
    },
    "roundId": "xxx",
    "balance": 1000,
    "finalBalance": 1050
  }]
}
```

## Symbols

| Symbol | Emoji | Name |
|--------|-------|------|
| WILD | 💎 | Wild |
| SYM_1 | 👑 | Crown |
| SYM_2 | 💍 | Ring |
| SYM_3 | 🏆 | Trophy |
| SYM_4 | 💵 | Cash |
| SYM_5 | 🎲 | Dice |
| SYM_6 | 🎯 | Dart |
| SYM_7 | 🎰 | Slot |
| SYM_8 | 🪙 | Coin |
| SYM_9 | 💠 | Gem |

## Paylines

The game has 14 paylines on a 4x5 grid:
- Lines 1-4: Horizontal lines
- Lines 5-6: Diagonal V-patterns
- Lines 7-14: Various zigzag patterns

## Development

### Adding New Features

1. **New UI Elements**: Add to `index.html`
2. **Styling**: Update `styles.css`
3. **Logic**: Modify `app.js`
4. **WebSocket Handling**: Update `ws-client.js`

### Testing

Open browser DevTools (F12) to see:
- Console logs
- Network WebSocket frames
- Message logs in the UI

## Backend Integration

This frontend connects to the minesweeper_login_lambda backend. Make sure:

1. Backend is running and accessible
2. WebSocket URL is correct in `config.js`
3. Game type "theluxe" is registered in the backend

## License

ISC
