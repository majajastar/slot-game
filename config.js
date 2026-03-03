// Configuration for TheLuxe Frontend
const CONFIG = {
    // API Endpoints
    sidUrl: 'https://lbucmxb2ke.execute-api.ap-southeast-1.amazonaws.com/mock-wallet/sid',
    launchUrl: 'https://1zka52hsdc.execute-api.ap-southeast-1.amazonaws.com/rest/game/launch',
    wsBaseUrl: 'wss://br9131tad1.execute-api.ap-southeast-1.amazonaws.com/uat',
    
    // Test credentials
    authToken: 's3cr3tV4lu3',
    testUuid: 'test_uuid',
    testUserId: 'demo_has_balance',
    apiSecret: '53XbWSzKwEtAQBAjSB3wSKznHeDHMWqqcMLKNK1U',
    operatorId: 'op001',
    
    // Game settings
    gameTypeId: 'theluxe',
    currency: 'USD',
    
    // Symbol emojis for display (frontend decides icons)
    // Symbol IDs: WILD=1, SCATTER=26, High=201-205, Low=101-104, COLLECT=777
    symbols: {
        '1': '💎',      // WILD
        '26': '⭐',     // SCATTER
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
