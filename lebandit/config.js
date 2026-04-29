// Configuration for LeBandit Frontend
// Uses GLOBAL_CONFIG for server settings

const CONFIG = {
    // Use global server mode (fake/real)
    get serverMode() { return GLOBAL_CONFIG.serverMode; },

    // Use global fake server URL
    get fakeWsUrl() { return GLOBAL_CONFIG.fakeServers.lebandit; },

    // Use global real server URLs
    get sidUrl() { return GLOBAL_CONFIG.realServers.sidUrl; },
    get launchUrl() { return GLOBAL_CONFIG.realServers.launchUrl; },
    get wsBaseUrl() { return GLOBAL_CONFIG.realServers.wsBaseUrl; },

    // Use global credentials
    get authToken() { return GLOBAL_CONFIG.credentials.authToken; },
    get testUuid() { return GLOBAL_CONFIG.credentials.testUuid; },
    get testUserId() { return GLOBAL_CONFIG.credentials.testUserId; },
    get apiSecret() { return GLOBAL_CONFIG.credentials.apiSecret; },
    get operatorId() { return GLOBAL_CONFIG.credentials.operatorId; },
    get currency() { return GLOBAL_CONFIG.credentials.currency; },

    // Use global ping interval
    get pingInterval() { return GLOBAL_CONFIG.gameSettings.pingInterval; },

    gameTypeId: 'lebandit',

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

    // Rainbow Mode Settings
    rainbowMode: {
        enabled: true,
        costMultiplier: 10, // 10x normal bet cost
        description: 'Guaranteed rainbow feature after every cascade'
    },

    // Bonus Boost Mode Settings - will be overridden by server config
    bonusBoostMode: {
        enabled: true,
        costMultiplier: 5, // Default, will be updated from server
        description: 'Bonus boost mode'
    },

    // Bonus Game Settings - "Luck of the Bandit"
    bonusGame: {
        enabled: true,           // Enable/disable bonus game
        buyCostMultiplier: 100,  // Cost to buy bonus (100x bet)
        freeSpins: 8,            // Number of free spins
        description: '8 free spins with accumulating golden squares until rainbow arrives'
    },

    // Treasure Bonus Settings - "Treasure at the End of the Rainbow"
    treasureBonus: {
        enabled: true,           // Enable/disable treasure bonus
        buyCostMultiplier: 100,  // Cost to buy bonus (100x bet)
        freeSpins: 10,           // Number of free spins
        description: '10 free spins with rainbow always appearing, no bronze coins'
    }
};

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
