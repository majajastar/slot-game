// Configuration for LeBandit Frontend
// This references backend config - CLUSTER_PAYOUT_TABLE is the single source of truth

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
    // Symbol IDs: WILD=1, SCATTER=2, High=201-205, Low=101-105
    symbols: {
        '1': '💎',      // WILD (no payout, substitutes only)
        '2': '🎯',     // SCATTER
        // High payout symbols (201-205)
        '201': '👑',
        '202': '💍',
        '203': '🏆',
        '204': '💵',
        '205': '🎰',
        // Low payout symbols (101-105)
        '101': '♠️',
        '102': '♥️',
        '103': '♦️',
        '104': '♣️',
        '105': '🌟',
        // Special symbols for rainbow feature
        'RAINBOW': '🌈',
        'BRONZE': '🥉',
        'SILVER': '🥈',
        'GOLD': '🥇',
        'CLOVER': '🍀',
        'POT': '🏺'
    },
    
    // Symbol names for paytable (Wild excluded - no direct payout)
    symbolNames: {
        '201': 'Crown',
        '202': 'Ring',
        '203': 'Trophy',
        '204': 'Cash',
        '205': 'Slot',
        '101': 'Spades',
        '102': 'Hearts',
        '103': 'Diamonds',
        '104': 'Clubs',
        '105': 'Star'
    },
    
    // CLUSTER PAYOUT TABLE - Single source of truth (matches backend)
    // Index = cluster size (0-17), value = payout multiplier
    // Paytable columns: 5, 6, 7, 8, 9-10, 11-12, 13+
    // Array indices:    5, 6, 7, 8, 9,    11,    13
    // Wild has NO payout (substitutes only)
    // 9-10 same value, 11-12 same value
    // Maximum payout at index 13 (13+ cluster size)
    clusterPayouts: {
        '201': { name: 'Crown',    payouts: [0, 0, 0, 0, 0, 20, 40, 80, 150, 250, 250, 400, 400, 800, 800, 800, 800, 800] },
        '202': { name: 'Ring',     payouts: [0, 0, 0, 0, 0, 15, 30, 60, 120, 200, 200, 320, 320, 640, 640, 640, 640, 640] },
        '203': { name: 'Trophy',   payouts: [0, 0, 0, 0, 0, 12, 25, 50, 100, 160, 160, 260, 260, 520, 520, 520, 520, 520] },
        '204': { name: 'Cash',     payouts: [0, 0, 0, 0, 0, 10, 20, 40, 80, 140, 140, 220, 220, 440, 440, 440, 440, 440] },
        '205': { name: 'Slot',     payouts: [0, 0, 0, 0, 0, 8, 16, 32, 64, 120, 120, 200, 200, 400, 400, 400, 400, 400] },
        '101': { name: 'Spades',   payouts: [0, 0, 0, 0, 0, 6, 12, 24, 48, 100, 100, 180, 180, 360, 360, 360, 360, 360] },
        '102': { name: 'Hearts',   payouts: [0, 0, 0, 0, 0, 6, 12, 24, 48, 100, 100, 180, 180, 360, 360, 360, 360, 360] },
        '103': { name: 'Diamonds', payouts: [0, 0, 0, 0, 0, 6, 12, 24, 48, 100, 100, 180, 180, 360, 360, 360, 360, 360] },
        '104': { name: 'Clubs',    payouts: [0, 0, 0, 0, 0, 5, 10, 20, 40, 80, 80, 160, 160, 320, 320, 320, 320, 320] },
        '105': { name: 'Star',     payouts: [0, 0, 0, 0, 0, 5, 10, 20, 40, 80, 80, 160, 160, 320, 320, 320, 320, 320] }
    },
    
    // Cluster size labels for paytable columns
    // Maps to array indices: 5, 6, 7, 8, 10, 12, 13+
    clusterSizeLabels: ['5', '6', '7', '8', '9-10', '11-12', '13+'],
    
    // Grid dimensions - LeBandit is 6x5
    rows: 5,
    cols: 6,
    
    // Ping interval (ms)
    pingInterval: 20000,
    
    // Rainbow Mode Settings
    rainbowMode: {
        enabled: true,
        costMultiplier: 10, // 10x normal bet cost
        description: 'Guaranteed rainbow feature after every cascade'
    }
};

// Helper to build WebSocket URL
function getWebSocketUrl(token, lang) {
    if (CONFIG.serverMode === 'fake') {
        return CONFIG.fakeWsUrl;
    }
    return `${CONFIG.wsBaseUrl}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}

// Helper to format large numbers (K, M)
function formatPayout(value) {
    if (value >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
        return (value / 1000).toFixed(0) + 'K';
    }
    return value.toString();
}
