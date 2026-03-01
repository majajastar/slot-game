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
    symbols: {
        'WILD': '💎',
        'SCATTER': '⭐',
        // High payout symbols
        'SYM_1': '👑',
        'SYM_2': '💍',
        'SYM_3': '🏆',
        'SYM_4': '💵',
        // Low payout symbols - Poker
        'SYM_5': '🎴',
        'SYM_6': '♠️',
        'SYM_7': '♥️',
        'SYM_8': '♦️',
        'SYM_9': '♣️',
        // Collect symbol
        'COLLECT': '🍀'
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
