/**
 * Global Frontend Configuration
 * Shared settings for all slot games (LeBandit, TheLuxe, etc.)
 */

const GLOBAL_CONFIG = {
    // ==========================================
    // SERVER MODE
    // ==========================================
    // Set to 'fake' for local testing, 'real' for production
    serverMode: 'real', // 'fake' | 'real'

    // ==========================================
    // FAKE SERVER (Local Testing)
    // ==========================================
    fakeServers: {
        lebandit: 'ws://35.78.80.187:3003',
        theluxe: 'ws://35.78.80.187:3002'  // Update with actual fake server URL
    },

    // ==========================================
    // REAL SERVER (AWS Production)
    // ==========================================
    realServers: {
        sidUrl: 'https://lbucmxb2ke.execute-api.ap-southeast-1.amazonaws.com/mock-wallet/sid',
        launchUrl: 'https://1zka52hsdc.execute-api.ap-southeast-1.amazonaws.com/rest/game/launch',
        wsBaseUrl: 'wss://br9131tad1.execute-api.ap-southeast-1.amazonaws.com/uat'
    },

    // ==========================================
    // API CREDENTIALS (for real server)
    // ==========================================
    credentials: {
        authToken: 's3cr3tV4lu3',
        testUuid: 'test_uuid',
        testUserId: 'demo_has_balance',
        apiSecret: '53XbWSzKwEtAQBAjSB3wSKznHeDHMWqqcMLKNK1U',
        operatorId: 'op001',
        currency: 'USD'
    },

    // ==========================================
    // GAME SETTINGS
    // ==========================================
    gameSettings: {
        pingInterval: 20000,  // WebSocket ping interval (ms)
        defaultLanguage: 'en'
    },

    // ==========================================
    // HELPERS
    // ==========================================
    /**
     * Get WebSocket URL for a game
     */
    getWebSocketUrl(gameType) {
        if (this.serverMode === 'fake') {
            return this.fakeServers[gameType] || this.fakeServers.theluxe;
        }
        return null; // Real server needs SID + Launch API flow
    },

    /**
     * Check if using fake server
     */
    isFakeServer() {
        return this.serverMode === 'fake';
    },

    /**
     * Check if using real server
     */
    isRealServer() {
        return this.serverMode === 'real';
    },

    /**
     * Toggle server mode (for debugging)
     */
    toggleServerMode() {
        this.serverMode = this.serverMode === 'fake' ? 'real' : 'fake';
        console.log(`[GLOBAL_CONFIG] Server mode switched to: ${this.serverMode}`);
        return this.serverMode;
    }
};

// Export for use in games
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GLOBAL_CONFIG };
}
