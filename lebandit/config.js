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
    
    // Symbol names for paytable
    symbolNames: {
        '1': 'Wild',
        '2': 'Scatter',
        '201': 'Crown',
        '202': 'Ring',
        '203': 'Trophy',
        '204': 'Cash',
        '205': 'Slot',
        '101': 'Spades',
        '102': 'Hearts',
        '103': 'Diamonds'
    },
    
    // Cluster payouts: index = cluster size (0-17), value = payout multiplier
    // Cluster wins require 5+ symbols. Indices 0-4 are unused (0)
    clusterPayouts: {
        '1':   { payouts: [0, 0, 0, 0, 0, 500, 1000, 2000, 4000, 8000, 15000, 30000, 50000, 75000, 100000, 150000, 200000, 300000] },
        '201': { payouts: [0, 0, 0, 0, 0, 400, 800, 1600, 3200, 6000, 12000, 25000, 40000, 60000, 80000, 120000, 160000, 240000] },
        '202': { payouts: [0, 0, 0, 0, 0, 300, 600, 1200, 2500, 5000, 10000, 20000, 35000, 50000, 70000, 100000, 140000, 200000] },
        '203': { payouts: [0, 0, 0, 0, 0, 250, 500, 1000, 2000, 4000, 8000, 16000, 30000, 45000, 60000, 90000, 120000, 180000] },
        '204': { payouts: [0, 0, 0, 0, 0, 200, 400, 800, 1600, 3200, 6400, 12000, 25000, 37500, 50000, 75000, 100000, 150000] },
        '205': { payouts: [0, 0, 0, 0, 0, 150, 300, 600, 1200, 2400, 4800, 10000, 20000, 30000, 40000, 60000, 80000, 120000] },
        '101': { payouts: [0, 0, 0, 0, 0, 100, 200, 400, 800, 1600, 3200, 6400, 15000, 22500, 30000, 45000, 60000, 90000] },
        '102': { payouts: [0, 0, 0, 0, 0, 100, 200, 400, 800, 1600, 3200, 6400, 15000, 22500, 30000, 45000, 60000, 90000] },
        '103': { payouts: [0, 0, 0, 0, 0, 100, 200, 400, 800, 1600, 3200, 6400, 15000, 22500, 30000, 45000, 60000, 90000] }
    },
    
    // Cluster size labels for display
    clusterSizeLabels: ['5', '6', '7', '8', '9-10', '11-12', '13+'],
    
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

// Helper to format large numbers
function formatPayout(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'K';
    }
    return value.toString();
}
