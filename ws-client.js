/**
 * WebSocket Client for TheLuxe Game
 * Handles connection, message sending/receiving, and game state management
 */
class TheLuxeWSClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.messageQueue = [];
        this.pingInterval = null;
        this.callbacks = {
            onConnect: null,
            onDisconnect: null,
            onMessage: null,
            onError: null,
            onLogin: null,
            onLobby: null,
            onJoinRoom: null,
            onSyncRoom: null,
            onSetBet: null
        };
    }

    // Set callback functions
    on(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event)) {
            this.callbacks['on' + event] = callback;
        }
    }

    // Connect to WebSocket
    async connect(token, lang = 'en') {
        const wsUrl = getWebSocketUrl(token, lang);
        
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('[WS] Connected');
                this.isConnected = true;
                this.startPingInterval();
                if (this.callbacks.onConnect) this.callbacks.onConnect();
                resolve();
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.socket.onerror = (error) => {
                console.error('[WS] Error:', error);
                if (this.callbacks.onError) this.callbacks.onError(error);
                reject(error);
            };
            
            this.socket.onclose = () => {
                console.log('[WS] Disconnected');
                this.isConnected = false;
                this.stopPingInterval();
                if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
            };
        });
    }

    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }

    // Send message
    send(type, data) {
        const message = JSON.stringify({ type, data });
        
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(message);
            if (this.callbacks.onMessage) {
                this.callbacks.onMessage('send', { type, data });
            }
            return true;
        } else {
            console.warn('[WS] Not connected, message queued');
            this.messageQueue.push({ type, data });
            return false;
        }
    }

    // Handle incoming message
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.errCode !== 0) {
                console.error('[WS] Server error:', message.errCode);
                if (this.callbacks.onError) this.callbacks.onError(message);
                return;
            }

            if (this.callbacks.onMessage) {
                this.callbacks.onMessage('receive', message);
            }

            const { type, data: msgData } = message.vals || {};
            
            switch (type) {
                case 1: // Login
                    this.handleLogin(msgData);
                    break;
                case 3: // Lobby
                    this.handleLobby(msgData);
                    break;
                case 100000: // Game messages
                    this.handleGameMessage(msgData);
                    break;
                case 200018: // Room status
                    this.handleRoomStatus(msgData);
                    break;
                default:
                    console.warn('[WS] Unknown message type:', type);
            }
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
        }
    }

    // Handle login response
    handleLogin(data) {
        console.log('[WS] Login success:', data.sessionId);
        if (this.callbacks.onLogin) this.callbacks.onLogin(data);
        
        // Auto-send lobby request
        this.sendLobbyRequest();
    }

    // Handle lobby response
    handleLobby(data) {
        console.log('[WS] Lobby:', data.gameId, 'Balance:', data.balance);
        if (this.callbacks.onLobby) this.callbacks.onLobby(data);
        
        // Auto-join room and sync
        this.sendJoinRoom();
        this.sendSyncRoomInfo();
    }

    // Handle game messages
    handleGameMessage(data) {
        const subType = data.subType;
        const subData = data.subData?.[0];

        switch (subType) {
            case 100005: // Join room
                this.handleJoinRoom(subData);
                break;
            case 100071: // Sub data (SyncRoomInfo, SetBet, etc.)
                this.handleSubData(subData);
                break;
            default:
                console.warn('[WS] Unknown subType:', subType);
        }
    }

    // Handle join room response
    handleJoinRoom(data) {
        console.log('[WS] Joined room:', data.roomId);
        if (this.callbacks.onJoinRoom) this.callbacks.onJoinRoom(data);
    }

    // Handle sub data
    handleSubData(subData) {
        if (!subData || !subData.opCode) {
            console.warn('[WS] Missing opCode in subData');
            return;
        }

        switch (subData.opCode) {
            case 'SyncRoomInfo':
                if (this.callbacks.onSyncRoom) this.callbacks.onSyncRoom(subData);
                break;
            case 'SetBet':
                if (this.callbacks.onSetBet) this.callbacks.onSetBet(subData);
                break;
            case 'GetRecords':
                console.log('[WS] Records:', subData);
                break;
            default:
                console.warn('[WS] Unknown opCode:', subData.opCode);
        }
    }

    // Handle room status
    handleRoomStatus(data) {
        console.log('[WS] Room status:', data);
    }

    // Start ping interval
    startPingInterval() {
        this.stopPingInterval();
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendSyncRoomInfo();
            }
        }, CONFIG.pingInterval);
    }

    // Stop ping interval
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // Message builders
    sendLogin() {
        return this.send('0', [{ subType: 0 }]);
    }

    sendLobbyRequest() {
        return this.send('2', [{ subType: 0 }]);
    }

    sendJoinRoom() {
        return this.send('100000', [{ subType: 100004 }]);
    }

    sendSyncRoomInfo() {
        return this.send('100000', [
            { subType: 100070, subData: [{ opCode: 'SyncRoomInfo' }] }
        ]);
    }

    sendSetBet(bet, line) {
        return this.send('100000', [
            {
                subType: 100070,
                subData: [{ opCode: 'SetBet', message: { bet, line } }]
            }
        ]);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TheLuxeWSClient };
}
