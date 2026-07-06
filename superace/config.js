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
    // 4 High payout: A, K, Q, J
    // 4 Low payout: Spade, Heart, Diamond, Club
    symbols: {
        '1': '🃏',      // WILD / JOKER
        '2': '⭐',      // SCATTER
        '3': '🤡',      // BIG JOKER
        '4': '🎭',      // LITTLE JOKER
        // High payout
        'A': '🅰️',      // ACE
        'K': '🇰',      // KING
        'Q': '🇶',      // QUEEN
        'J': '🇯',      // JACK
        // Low payout
        'S': '♠️',      // SPADE
        'H': '♥️',      // HEART
        'D': '♦️',      // DIAMOND
        'C': '♣️',      // CLUB
    },

    // Symbol names for paytable
    symbolNames: {
        '1': 'Joker (Wild)',
        '2': 'Scatter',
        '3': 'Big Joker',
        '4': 'Little Joker',
        'A': 'Ace',
        'K': 'King',
        'Q': 'Queen',
        'J': 'Jack',
        'S': 'Spade',
        'H': 'Heart',
        'D': 'Diamond',
        'C': 'Club'
    },

    // Grid dimensions
    rows: 4,
    cols: 5,

    // Combo multiplier levels
    comboLevels: [1, 2, 3, 5]
};

// Buy bonus config (populated from server)
let BUY_BONUS = { enabled: false, priceMultiplier: 50 };
