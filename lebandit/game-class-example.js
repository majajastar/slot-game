/**
 * LeBandit Game using shared WebSocket client
 * Example of how to integrate the shared client
 */

// Import the shared client (in real implementation, use proper module system)
// import { SlotGameWebSocketClient } from '../shared/websocket-client.js';

class LeBanditGame {
    constructor() {
        this.wsClient = null;
        this.symbols = {};
        this.betSizeList = [5, 10, 20, 50, 100];
        this.currentBetIndex = 2;
        this.isSpinning = false;
        this.bonusConfig = null;
        this.rainbowModeCostMultiplier = 10;
    }

    async init() {
        // Initialize UI
        this.initGrid();
        this.renderPaytable();
        
        // Create WebSocket client with game-specific config
        this.wsClient = new SlotGameWebSocketClient('lebandit', {
            serverMode: CONFIG.serverMode,
            fakeWsUrl: CONFIG.fakeWsUrl,
            wsBaseUrl: CONFIG.wsBaseUrl,
            pingInterval: CONFIG.pingInterval
        });

        // Set up event handlers
        this.setupEventHandlers();

        // Connect and join room
        try {
            await this.wsClient.connect();
            const joinData = await this.wsClient.joinRoom();
            this.handleJoinRoom(joinData);
            
            const syncData = await this.wsClient.syncRoom();
            this.handleSyncRoom(syncData);
        } catch (err) {
            console.error('[LeBandit] Connection error:', err);
        }
    }

    setupEventHandlers() {
        // Handle join room data
        this.wsClient.on('joinRoom', (data) => {
            this.handleJoinRoom(data);
        });

        // Handle set bet response
        this.wsClient.on('setBet', (data) => {
            this.handleSetBetResponse(data);
        });

        // Handle general messages
        this.wsClient.on('message', (data) => {
            // Handle other message types
        });
    }

    handleJoinRoom(data) {
        if (data.betInfo?.[0]) {
            const info = data.betInfo[0];
            
            // Store symbols (server sends IDs only)
            if (info.symbols) {
                this.symbols = {};
                info.symbols.forEach(s => {
                    this.symbols[s.id] = CONFIG.symbols[s.id] || s.id;
                });
            }
            
            // Store bet sizes
            if (info.betSizeList) {
                this.betSizeList = info.betSizeList;
            }
            
            // Store bonus config
            if (info.bonusConfig) {
                this.bonusConfig = info.bonusConfig;
                if (info.bonusConfig.rainbowModeCostMultiplier) {
                    this.rainbowModeCostMultiplier = info.bonusConfig.rainbowModeCostMultiplier;
                }
                this.updateBonusButtons();
            }
            
            this.renderPaytable();
            this.updateBetDisplay();
        }
    }

    handleSyncRoom(data) {
        if (data.roomInfo?.lastResumeInfo) {
            // Restore game state
            this.renderGrid(data.roomInfo.lastResumeInfo.grid);
            if (data.roomInfo.lastResumeInfo.bonusGameState) {
                this.showBonusProgress(data.roomInfo.lastResumeInfo.bonusGameState);
            }
        }
    }

    async spin(bet, options = {}) {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        this.setSpinningState(true);

        try {
            const message = {
                bet: bet,
                rainbowMode: options.rainbowMode || false,
                ...(options.forceBonusType && { forceBonusType: options.forceBonusType }),
                ...(options.debugScatterCount !== null && { debugScatterCount: options.debugScatterCount }),
                ...(options.debugForceRainbow && { debugForceRainbow: true })
            };

            const result = await this.wsClient.setBet(message);
            this.handleSetBetResponse(result);
        } catch (err) {
            console.error('[LeBandit] Spin error:', err);
        } finally {
            this.isSpinning = false;
            this.setSpinningState(false);
        }
    }

    handleSetBetResponse(data) {
        if (data.errCode !== 0) {
            console.error('[LeBandit] SetBet error:', data.errMsg);
            return;
        }

        const betInfo = data.betInfo?.[0];
        if (!betInfo) return;

        // Update balance
        this.updateBalance(betInfo.finalBalance);

        // Process game result
        const result = betInfo.gameResult;
        if (result) {
            this.renderGrid(result.grid);
            this.showWin(result.totalWinAmount);
            
            if (result.cascadeSteps?.length > 0) {
                this.renderCascade(result.cascadeSteps);
            }
            
            if (result.rainbowResult?.hasRainbow) {
                this.renderRainbow(result.rainbowResult);
            }
            
            if (result.bonusGameState?.isActive) {
                this.showBonusProgress(result.bonusGameState);
            }
        }
    }

    // UI helper methods
    setSpinningState(isSpinning) {
        document.getElementById('spinButton').disabled = isSpinning;
    }

    updateBalance(balance) {
        this.wsClient.currentBalance = balance;
        document.getElementById('balance').textContent = '$' + balance.toFixed(2);
    }

    // ... other UI methods (initGrid, renderPaytable, etc.)
}

// Usage:
// const game = new LeBanditGame();
// game.init();
// game.spin(20, { rainbowMode: true });
