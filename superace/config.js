/**
 * Super Ace Slot Game - Frontend Configuration
 * Uses GLOBAL_CONFIG for server settings
 */

const CONFIG = {
    // Use global server mode (fake/real)
    get serverMode() { return GLOBAL_CONFIG.serverMode; },

    // Use global fake server URL
    get fakeWsUrl() { return GLOBAL_CONFIG.fakeServers.superace; },

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

    gameTypeId: 'superace',

    // Symbol emojis for display
    // Every WILD is either Big Joker or Little Joker - no plain WILD
    symbols: {
        '1': '🃏',      // WILD (Big Joker or Little Joker - shown with jokerType indicator)
        '2': '⭐',      // SCATTER
        // High payout
        '201': '🅰️',    // ACE
        '202': '🇰',    // KING
        '203': '🇶',    // QUEEN
        '204': '🇯',    // JACK
        // Low payout
        '101': '♠️',    // SPADE
        '102': '♥️',    // HEART
        '103': '♦️',    // DIAMOND
        '104': '♣️',    // CLUB
    },

    // Joker type emojis (shown alongside WILD)
    jokerTypeEmojis: {
        'big': '🤡',
        'little': '🎭'
    },

    // Symbol names for paytable
    symbolNames: {
        '1': 'Joker (Wild)',
        '2': 'Scatter',
        '201': 'Ace',
        '202': 'King',
        '203': 'Queen',
        '204': 'Jack',
        '101': 'Spade',
        '102': 'Heart',
        '103': 'Diamond',
        '104': 'Club'
    },

    // Grid dimensions
    rows: 4,
    cols: 5,

    // Combo multiplier levels
    comboLevels: [1, 2, 3, 5]
};

// Buy bonus config (populated from server)
let BUY_BONUS = { enabled: false, priceMultiplier: 50 };
