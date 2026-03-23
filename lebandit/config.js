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
    // Symbol IDs: WILD=1, SCATTER=2, High=201-205, Low=101-105 (10, J, Q, K, A)
    symbols: {
        '1': '💎',      // WILD (no payout, substitutes only)
        '2': '🎯',     // SCATTER
        // High payout symbols (201-205)
        '201': '👑',
        '202': '💍',
        '203': '🏆',
        '204': '💵',
        '205': '🎰',
        // Low payout symbols (101-105) - 10, J, Q, K, A
        '101': '10',
        '102': 'J',
        '103': 'Q',
        '104': 'K',
        '105': 'A',
        // Special symbols for rainbow feature (matching backend IDs 300-305)
        '300': '🌈',  // RAINBOW
        '301': '🪙',  // BRONZE_COIN
        '302': '🪙',  // SILVER_COIN
        '303': '🪙',  // GOLD_COIN
        '304': '🍀',  // FOUR_LEAF_CLOVER
        '305': '🏺',  // POT_OF_GOLD
    },
    
    // Symbol names for paytable (Wild excluded - no direct payout)
    symbolNames: {
        '201': 'Crown',
        '202': 'Ring',
        '203': 'Trophy',
        '204': 'Cash',
        '205': 'Slot',
        // Low payout symbols - 10, J, Q, K, A
        '101': 'Ten',
        '102': 'Jack',
        '103': 'Queen',
        '104': 'King',
        '105': 'Ace'
    },
    
    // Grid dimensions - LeBandit is 6x5
    rows: 5,
    cols: 6,
    
    // Grid layout constants - SINGLE SOURCE OF TRUTH for all grid sizing
    gridLayout: {
        ROWS_VISIBLE: 5,        // Number of visible rows
        ROWS_BUFFER: 5,         // Number of buffer rows (above visible)
        ROWS_TOTAL: 10,         // Total rows (visible + buffer)
        COLS: 6,                // Number of columns
        CELL_HEIGHT: 70,        // Height of each cell in pixels
        CELL_GAP: 6,            // Gap between cells in pixels
        PADDING: 15,            // Grid padding in pixels
        get CONTAINER_HEIGHT() { // Total container height
            return this.ROWS_VISIBLE * this.CELL_HEIGHT + 
                   (this.ROWS_VISIBLE - 1) * this.CELL_GAP + 
                   2 * this.PADDING;
        },
        get BUFFER_OFFSET() {   // Offset to hide buffer rows
            return -(this.ROWS_BUFFER * (this.CELL_HEIGHT + this.CELL_GAP));
        },
        BORDER_RADIUS: 8,       // Cell border radius
        BORDER_RADIUS_SMALL: 6, // Smaller border radius for responsive
        BORDER_RADIUS_MOBILE: 4 // Mobile border radius
    },
    
    // Ping interval (ms)
    pingInterval: 20000,
    
    // Rainbow Mode Settings
    rainbowMode: {
        enabled: true,
        costMultiplier: 10, // 10x normal bet cost
        description: 'Guaranteed rainbow feature after every cascade'
    },
    
    // Bonus Game Settings - "Luck of the Bandit"
    bonusGame: {
        enabled: true,           // Enable/disable bonus game
        buyCostMultiplier: 100,  // Cost to buy bonus (100x bet)
        freeSpins: 8,            // Number of free spins
        description: '8 free spins with accumulating golden squares until rainbow arrives'
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
