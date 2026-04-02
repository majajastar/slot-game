// Configuration for TheLuxe Frontend
const CONFIG = {
    // Game settings
    serverMode: 'real', // Change to 'real' for production

    // Fake Server (local testing)
    fakeWsUrl: 'ws://35.78.181.205:3002',

    gameTypeId: 'theluxe',
    
    // Symbol emojis for display (frontend decides icons)
    // Symbol IDs: WILD=1, SCATTER=26, High=201-205, Low=101-104, COLLECT=777
    symbols: {
        '1': '💎',      // WILD
        '2': '⭐',     // SCATTER
        // High payout symbols (201-205)
        '201': '👑',
        '202': '💍',
        '203': '🏆',
        '204': '💵',
        '205': '🎴',
        // Low payout symbols (101-104)
        '101': '♠️',
        '102': '♥️',
        '103': '♦️',
        '104': '♣️',
        // Collect symbol
        '777': '🍀'
    },
    
    // Grid dimensions
    rows: 4,
    cols: 5,
    
    // Ping interval (ms)
    pingInterval: 20000
};

// Helper to build WebSocket URL
function getWebSocketUrl(token, lang) {
    return `${CONFIG.wsBaseUrl}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}
