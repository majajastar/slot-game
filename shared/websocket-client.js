/**
 * Shared WebSocket Client for Slot Games
 * Handles connection, message routing, and common game operations
 */

const WS_CONFIG = {
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
    currency: 'USD'
}

class SlotGameWebSocketClient {
    constructor(gameType, config) {
        this.gameType = gameType; // 'lebandit' or 'theluxe'
        this.config = config;
        this.socket = null;
        this.pingInterval = null;
        this.sessionId = null;
        this.userId = null;
        this.currentBalance = 0;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.pendingRequests = new Map();
        this.requestId = 0;
    }

    // ==========================================
    // CONNECTION
    // ==========================================

    async connect() {
        return new Promise(async (resolve, reject) => {
            const wsUrl = await this.getWebSocketUrl();
            console.log(`[${this.gameType}] Connecting to ${wsUrl}`);

            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log(`[${this.gameType}] WebSocket connected`);
                this.isConnected = true;
                this.sendLogin();
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.socket.onclose = () => {
                console.log(`[${this.gameType}] WebSocket closed`);
                this.isConnected = false;
                this.stopPing();
            };

            this.socket.onerror = (error) => {
                console.error(`[${this.gameType}] WebSocket error:`, error);
                reject(error);
            };

            // Set up login response handler
            this.once('login', (data) => {
                this.sessionId = data.vals?.data?.sessionId;
                this.userId = data.vals?.data?.userId;
                this.currentBalance = data.vals?.data?.balance || 0;
                this.startPing();
                resolve(data);
            });
        });
    }

    async getWebSocketUrl() {
        console.log(`config.serverMode = ${JSON.stringify(this.config.serverMode)}`)
        if (this.config.serverMode === 'fake') {
            return this.config.fakeWsUrl;
        }
        // Real server - would need token from auth
        
        // Step 1: Get SID
        console.log(`Getting SID...`)
        const sidRes = await fetch(`${WS_CONFIG.sidUrl}?authToken=${WS_CONFIG.authToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: WS_CONFIG.testUuid, userId: WS_CONFIG.testUserId })
        });
        const { sid } = await sidRes.json();
        console.log(`Fetch sid = ${sid}`);

        // Step 2: Launch API
        console.log('Launching game...');
        const launchRes = await fetch(WS_CONFIG.launchUrl, {
            method: 'POST',
            // use 'text/plain'
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                operatorId: WS_CONFIG.operatorId,
                gameTypeId: this.gameType,
                player: {
                    userId: WS_CONFIG.testUserId,
                    currency: WS_CONFIG.currency,
                    language: 'en',
                    sid,
                    name: 'testUser'
                },
                apiSecret: WS_CONFIG.apiSecret
            })
        });
        const launchData = await launchRes.json();
        const redirectUrl = launchData.vals?.data?.redirectUrl;
        console.log(`launchData = ${JSON.stringify(launchData)}`)
        console.log(`redirectUrl = ${redirectUrl}`)
        const url = new URL(redirectUrl);
        const token = url.searchParams.get('token');
        const lang = url.searchParams.get('lang') || 'en';
        console.log(`Token received, token = ${token}, lang = ${lang}`);
        const wsUrl = `${WS_CONFIG.wsBaseUrl}?token=${token}&lang=${lang}`
        console.log(`wsUrl = ${wsUrl}`)
        return Promise.resolve(wsUrl);
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.stopPing();
        this.isConnected = false;
    }

    // ==========================================
    // MESSAGE HANDLING
    // ==========================================

    handleMessage(data) {
        const type = data.vals?.type || data.type;
        
        // Handle specific message types
        switch (type) {
            case 1: // Login response
                this.emit('login', data);
                break;
            case 100000:
                const subType = data.vals?.data?.subType;
                if (subType === 100005) {
                    this.emit('joinRoom', data.vals.data.subData[0]);
                } else if (subType === 100071) {
                    const opCode = data.vals?.data?.subData?.[0]?.opCode;
                    if (opCode === 'SyncRoomInfo') {
                        this.emit('syncRoom', data.vals.data.subData[0]);
                    } else if (opCode === 'SetBet') {
                        this.emit('setBet', data.vals.data.subData[0]);
                    }
                }
                break;
        }

        // Emit for general handlers
        this.emit('message', data);
    }

    // Event emitter pattern
    on(event, handler) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(handler);
    }

    once(event, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }

    off(event, handler) {
        if (this.messageHandlers.has(event)) {
            const handlers = this.messageHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (err) {
                    console.error(`[${this.gameType}] Error in handler:`, err);
                }
            });
        }
    }

    // ==========================================
    // CORE OPERATIONS
    // ==========================================

    sendLogin() {
        this.send({ type: '0' });
    }

    async joinRoom() {
        return new Promise((resolve) => {
            this.once('joinRoom', (data) => {
                resolve(data);
            });
            
            this.send({
                type: '100000',
                data: [{ subType: 100004 }]
            });
        });
    }

    async syncRoom() {
        return new Promise((resolve) => {
            this.once('syncRoom', (data) => {
                resolve(data);
            });
            
            this.send({
                type: '100000',
                data: [{
                    subType: 100070,
                    subData: [{ opCode: 'SyncRoomInfo' }]
                }]
            });
        });
    }

    async setBet(message) {
        return new Promise((resolve) => {
            this.once('setBet', (data) => {
                resolve(data);
            });
            
            this.send({
                type: '100000',
                data: [{
                    subType: 100070,
                    subData: [{
                        opCode: 'SetBet',
                        message: message
                    }]
                }]
            });
        });
    }

    // ==========================================
    // LOW LEVEL
    // ==========================================

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.error(`[${this.gameType}] WebSocket not connected`);
        }
    }

    startPing() {
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping' });
            }
        }, this.config.pingInterval || 20000);
    }

    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // ==========================================
    // GETTERS
    // ==========================================

    getBalance() {
        return this.currentBalance;
    }

    getSessionId() {
        return this.sessionId;
    }

    getUserId() {
        return this.userId;
    }

    isSocketConnected() {
        return this.isConnected;
    }
}

// Export for use in both games
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SlotGameWebSocketClient };
}
