# Casishenwin Frontend

## Overview

Frontend implementation for the Casishenwin slot game featuring:
- Interactive 6x5 grid with top row
- Multi-row symbol display
- Silver/Golden frame animations
- Cascade animations
- WebSocket integration

## Files

- `index.html` - Main game interface
- `styles.css` - Game styling
- `app.js` - Game logic and animations
- `ws-client.js` - WebSocket client
- `config.js` - Configuration
- `server.js` - Development server with fake WebSocket

## Setup

```bash
npm install
npm start
```

## Features

### Grid Display
- Main grid: 5 rows × 6 columns
- Top row: 1 row × 4 columns (rolling animation)
- Multi-row symbols span multiple rows

### Frame Display
- Silver Frame: Gray border with glow
- Golden Frame: Gold border with pulse animation
- Wild Transformation: Morph animation

### Animations
- Rolling top row (right to left)
- Falling symbols (cascade)
- Winning symbol pulse
- Frame glow effects

### Controls
- Spin button
- Auto spin toggle
- Bet adjustment (+/-)
- Balance/Win display

## WebSocket Integration

Connects to backend server for:
- Grid generation
- Win calculation
- Frame state
- Balance updates

## Configuration

Edit `config.js` to switch between:
- `fake` - Local development server
- `real` - Production AWS server
