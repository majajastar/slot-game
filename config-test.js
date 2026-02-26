// Configuration for TheLuxe Frontend - FAKE SERVER TEST
const CONFIG = {
    // API Endpoints (pointing to fake server)
    sidUrl: 'http://localhost:3001/sid',
    launchUrl: 'http://localhost:3001/launch',
    wsBaseUrl: 'ws://localhost:3002',

    // Test credentials (fake server accepts anything)
    authToken: 'fake-token',
    testUuid: 'test-uuid',
    testUserId: 'test-user',
    apiSecret: 'fake-secret',
    operatorId: 'op001',

    // Game settings
    gameTypeId: 'theluxe',
    currency: 'USD',

    // Symbol emojis for display
    symbols: {
        'WILD': '💎', 'SCATTER': '⭐',
        'SYM_1': '👑', 'SYM_2': '💍', 'SYM_3': '🏆', 'SYM_4': '💵',
        'SYM_5': '🎲', 'SYM_6': '🎯', 'SYM_7': '🎰', 'SYM_8': '🪙', 'SYM_9': '💠'
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
