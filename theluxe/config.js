// Configuration for TheLuxe Frontend
// Uses GLOBAL_CONFIG for server settings

const CONFIG = {
    // Use global server mode (fake/real)
    get serverMode() { return GLOBAL_CONFIG.serverMode; },
    
    // Use global fake server URL
    get fakeWsUrl() { return GLOBAL_CONFIG.fakeServers.theluxe; },
    
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

    gameTypeId: 'theluxe',
    
    // Symbol emojis for display (frontend decides icons)
    // Symbol IDs: WILD=1, SCATTER=26, High=201-205, Low=101-104, COLLECT=777
    symbols: {
        '1': '💎',      // WILD
        '2': '⭐',     // SCATTER
        // High payout symbols (201-205)
        '201': '👑',
        '202': '💍',
        '203': '🏆',
        '204': '💵',
        '205': '🎴',
        // Low payout symbols (101-104)
        '101': '♠️',
        '102': '♥️',
        '103': '♦️',
        '104': '♣️',
        // Collect symbol
        '777': '🍀'
    },
    
    // Grid dimensions
    rows: 4,
    cols: 5
};

// Helper to build WebSocket URL
function getWebSocketUrl(token, lang) {
    return `${CONFIG.wsBaseUrl}?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}
