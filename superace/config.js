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

    // Grid dimensions
    rows: 4,
    cols: 5,

    // Combo multiplier levels
    comboLevels: [1, 2, 3, 5]
};

// Symbol data populated from server (joinRoom response)
let SERVER_SYMBOLS = {};
let SERVER_SYMBOL_NAMES = {};

// Joker type emojis (shown alongside WILD)
const JOKER_TYPE_EMOJIS = {
    'big': '🤡',
    'little': '🎭'
};

// Fallback symbols (used before joinRoom response arrives)
const FALLBACK_SYMBOLS = {
    '1': '🃏',
    '2': '⭐',
    '201': '🅰️',
    '202': '🇰',
    '203': '🇶',
    '204': '🇯',
    '101': '♠️',
    '102': '♥️',
    '103': '♦️',
    '104': '♣️',
};

const FALLBACK_SYMBOL_NAMES = {
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
};

// Helper: get symbol emoji (server-provided or fallback)
function getSymbolEmoji(id) {
    return SERVER_SYMBOLS[id] || FALLBACK_SYMBOLS[id] || '❓';
}

// Helper: get symbol name (server-provided or fallback)
function getSymbolName(id) {
    return SERVER_SYMBOL_NAMES[id] || FALLBACK_SYMBOL_NAMES[id] || 'Unknown';
}

// Helper: get joker type emoji
function getJokerTypeEmoji(type) {
    return JOKER_TYPE_EMOJIS[type] || '🃏';
}

// Buy bonus config (populated from server)
let BUY_BONUS = { enabled: false, priceMultiplier: 50 };
