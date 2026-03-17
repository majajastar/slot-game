// Configuration for LeBandit Frontend
const CONFIG = {
    // Server Mode: 'real' for AWS backend, 'fake' for local testing
    serverMode: 'fake', // Change to 'real' for production
    
    // Fake Server (local testing)
    fakeWsUrl: 'ws://54.238.168.141:3003',
    
    // Real API Endpoints (AWS)
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
    gameTypeId: 'lebandit',
    currency: 'USD',
    
    // Symbol emojis for display
    // Symbol IDs: WILD=1, SCATTER=2, High=201-205, Low=101-103
    symbols: {
        '1': '💎',      // WILD
        '2': '🎯',     // SCATTER
        // High payout symbols (201-205)
        '201': '👑',
        '202': '💍',
        '203': '🏆',
        '204': '💵',
        '205': '🎰',
        // Low payout symbols (101-103)
        '101': '♠️',
        '102': '♥️',
        '103': '♦️',
        // Special symbols for rainbow feature
        'RAINBOW': '🌈',
        'BRONZE': '🥉',
        'SILVER': '🥈',
        'GOLD': '🥇',
        'CLOVER': '🍀',
        'POT': '🏺'
    },
    
    // Grid dimensions - LeBandit is 6x5
    rows: 5,
    cols: 6,
    
    // Ping interval (ms)
    pingInterval: 20000
};

// Helper to build WebSocket URL
function getWebSocketUrl(token, lang) {
    if (CONFIG.serverMode === 'fake') {
        return CONFIG.fakeWsUrl;
    }
    return `${CONFIG.wsBaseUrl}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}
