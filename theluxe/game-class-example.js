/**
 * TheLuxe Game using shared WebSocket client
 * Example of how to integrate the shared client
 */

class TheLuxeGame {
    constructor() {
        this.wsClient = null;
        this.symbols = {};
        this.paylines = [];
        this.betSizeList = [1, 2, 5, 10, 20, 50, 100];
        this.currentBetIndex = 0;
        this.isSpinning = false;
        this.bonusConfig = null;
        this.megaBoostEnabled = false;
    }

    async init() {
        // Initialize UI
        this.initGrid();
        
        // Create WebSocket client with game-specific config
        this.wsClient = new SlotGameWebSocketClient('theluxe', {
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
            console.error('[TheLuxe] Connection error:', err);
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
    }

    handleJoinRoom(data) {
        if (data.betInfo?.[0]) {
            const info = data.betInfo[0];
            
            // Store symbols
            if (info.symbols) {
                this.symbols = {};
                info.symbols.forEach(s => {
                    this.symbols[s.id] = CONFIG.symbols[s.id] || s.id;
                });
            }
            
            // Store paylines
            if (info.paylines) {
                this.paylines = info.paylines;
            }
            
            // Store bet sizes
            if (info.betSizeList) {
                this.betSizeList = info.betSizeList;
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
                megaBoost: this.megaBoostEnabled,
                ...(options.forceBonusType && { forceBonusType: options.forceBonusType })
            };

            const result = await this.wsClient.setBet(message);
            this.handleSetBetResponse(result);
        } catch (err) {
            console.error('[TheLuxe] Spin error:', err);
        } finally {
            this.isSpinning = false;
            this.setSpinningState(false);
        }
    }

    handleSetBetResponse(data) {
        if (data.errCode !== 0) {
            console.error('[TheLuxe] SetBet error:', data.errMsg);
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
            
            if (result.frames?.length > 0) {
                this.renderFrames(result.frames);
            }
            
            if (result.bonusGameState?.isActive) {
                this.showBonusProgress(result.bonusGameState);
            }
        }
    }

    toggleMegaBoost() {
        this.megaBoostEnabled = !this.megaBoostEnabled;
        console.log('[TheLuxe] Mega Boost:', this.megaBoostEnabled ? 'ON' : 'OFF');
    }

    // UI helper methods
    setSpinningState(isSpinning) {
        document.getElementById('spinButton').disabled = isSpinning;
    }

    updateBalance(balance) {
        this.wsClient.currentBalance = balance;
        document.getElementById('balance').textContent = '$' + balance.toFixed(2);
    }

    // ... other UI methods
}

// Usage:
// const game = new TheLuxeGame();
// game.init();
// game.toggleMegaBoost();
// game.spin(10);
