const CONFIG = require('./config.js');

class CasishenwinWebSocket {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.listeners = new Map();
        this.isConnected = false;
    }

    connect() {
        const url = CONFIG.serverMode === 'fake' ? CONFIG.fakeServerUrl : CONFIG.realServerUrl;
        
        console.log(`Connecting to ${CONFIG.serverMode} server: ${url}`);
        
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.emit('disconnected');
            
            if (CONFIG.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
                setTimeout(() => this.connect(), CONFIG.reconnectInterval);
            }
        };
    }

    handleMessage(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'init':
                this.emit('init', data);
                break;
            case 'spinResult':
                this.emit('spinResult', data);
                break;
            case 'betSet':
                this.emit('betSet', data);
                break;
            case 'error':
                this.emit('error', data);
                break;
            default:
                console.log('Unknown message type:', type);
        }
    }

    send(type, data) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify({ type, data }));
        } else {
            console.error('WebSocket not connected');
        }
    }

    spin(bet) {
        this.send('spin', { bet });
    }

    setBet(bet) {
        this.send('setBet', { bet });
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CasishenwinWebSocket;
} else {
    window.CasishenwinWebSocket = CasishenwinWebSocket;
}
