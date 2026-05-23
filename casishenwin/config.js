// Configuration for Casishenwin Frontend
// Uses GLOBAL_CONFIG for server settings

const CONFIG = {
    // Use global server mode (fake/real)
    get serverMode() { return GLOBAL_CONFIG.serverMode; },

    // Use global fake server URL
    get fakeWsUrl() { return GLOBAL_CONFIG.fakeServers.casishenwin; },

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

    gameTypeId: 'casishenwin',

    // Symbol emojis for display
    symbols: {
        '1': '💎',      // WILD
        '2': '⭐',      // SCATTER
        '201': '👑',    // CROWN
        '202': '💍',    // RING
        '203': '🏆',    // TROPHY
        '204': '💵',    // CASH
        '205': '🎴',    // CARD
        '206': '🌟',    // STAR
        '101': '🅰️',    // ACE
        '102': '🇰',    // KING
        '103': '🇶',    // QUEEN
        '104': '🇯',    // JACK
        '105': '🔟',    // TEN
    },

    // Symbol names for paytable
    symbolNames: {
        '201': 'Crown',
        '202': 'Ring',
        '203': 'Trophy',
        '204': 'Cash',
        '205': 'Card',
        '206': 'Star',
        '101': 'Ace',
        '102': 'King',
        '103': 'Queen',
        '104': 'Jack',
        '105': 'Ten'
    },

    // Grid dimensions
    rows: 5,
    cols: 6,
    topRowCols: 4,
    topRowStartCol: 1,

    // Grid layout constants
    gridLayout: {
        ROWS_VISIBLE: 5,
        COLS: 6,
        CELL_HEIGHT: 70,
        CELL_GAP: 6,
        PADDING: 15,
        TOP_ROW_HEIGHT: 60,
        TOP_ROW_GAP: 6
    }
};
