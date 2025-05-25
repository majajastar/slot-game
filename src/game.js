// game.js
import { REEL_CONFIG, LAYOUT, SCALE, COLORS } from './config.js';
import { STYLE } from './style.js';
import { LineButtonsManager } from './line-button-manager.js';
import { SlotMachine, getSymbolName } from './slot-machine.js';
import { Control, DisplayField, UserGameCard, GameTitle, InfoButton, LoadingCard, OptionsButon } from './components.js';
import { WebSocketClient } from './websocket/client.js';
import { createCard } from './info.js'
import * as messages from './websocket/messages.js';

export class SlotGameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SlotGameScene' });
  }

  preload() {
    // Background for the loading bar
    const barBg = this.add.graphics();
    barBg.fillStyle(0x222222, 1);
    barBg.fillRect(LAYOUT.GAME_WIDTH / 2 - 150, LAYOUT.GAME_HEIGHT / 2 - 15, 300, 30);

    // Foreground loading bar
    const bar = this.add.graphics();

    this.load.on('progress', (value) => {
      bar.clear();
      bar.fillStyle(0xffffff, 1);
      bar.fillRect(LAYOUT.GAME_WIDTH / 2 - 145, LAYOUT.GAME_HEIGHT / 2 - 10, 290 * value, 20);
    });

    this.load.on('complete', () => {
      bar.destroy();
      barBg.destroy();
    });

    this.load.image('bg', 'assets/bg_ocean.png');
    this.load.image(getSymbolName(0), 'assets/symbol_0.png');
    this.load.image(getSymbolName(1), 'assets/symbol_1.png');
    this.load.image(getSymbolName(2), 'assets/symbol_2.png');
    this.load.image(getSymbolName(3), 'assets/symbol_3.png');
    this.load.image(getSymbolName(4), 'assets/symbol_4.png');
    this.load.image(getSymbolName(5), 'assets/symbol_5.png');
    this.load.image(getSymbolName(6), 'assets/symbol_6.png');
    this.load.image(getSymbolName(7), 'assets/symbol_7.png');
    this.load.image(getSymbolName(8), 'assets/symbol_8.png');
    this.load.image(getSymbolName(9), 'assets/symbol_9.png');
    this.load.audio('bgm', 'assets/audio/sea-and-beach.mp3');
    this.load.audio('click', 'assets/audio/click.mp3');
    this.load.audio('coin', 'assets/audio/retro-coin.mp3');
    this.load.audio('win', 'assets/audio/collect-points.mp3');
  }

  create() {
    this.prepareBackground();

    // Setup loading state
    this.isSpinning = false;
    this.symbols = [
      getSymbolName(0), getSymbolName(1), getSymbolName(2), getSymbolName(3), getSymbolName(4),
      getSymbolName(5), getSymbolName(6), getSymbolName(7), getSymbolName(8), getSymbolName(9),]
    this.playerId = "Unknown";
    this.gameId = "Unknown";
    this.currencySymbol = "$";
    this.balance = 0;
    this.matchDetails = [];
    // Show placeholder or loading message if needed
    this.loadingCard = new LoadingCard(this, 'WAITING FOR GAME START...');

    // WebSocket setup
    this.setupWebSocket((type, message) => {
      this.handleMessage(type, message);
    });
  }


  handleMessage(type, message) {
    if (type === 'login') {
      this.playerId = message.playerId;
      this.loadingCard.setText('RECEIVING PLAYER INFORMATION...')
      this.ws.socket.send(messages.lobby());
    } else if (type === 'lobby') {
      this.gameId = message.gameId;
      this.loadingCard.setText('RECEIVING ROOM INFORMATION...')
      this.ws.socket.send(messages.joinRoom());
      this.ws.socket.send(messages.syncRoomInfo());
      // Send ping message every 20 seconds
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.isConnected()) {
          this.ws.socket.send(messages.syncRoomInfo());
        }
      }, 20000);
    } else if (type === 'joinRoom') {
      this.balance = message.balance.toFixed(2);
      this.gameName = message.betInfo[0].gameName;
      this.minBet = message.betInfo[0].minBet;
      this.maxBet = message.betInfo[0].maxBet;
      this.defaultBet = message.betInfo[0].defaultBet;
      this.decimalCount = message.betInfo[0].defaultBet;
      this.currencySymbol = message.currencyInfo[0].currency;
      this.loadingCard.setText('GAME START')
      this.startGame(); // Start game after receiving lobby data
    } else if (type === 'SyncRoom') {
      const roomInfo = data.roomInfo;

      const winningPatterns = roomInfo.winningPatterns;  // Object of patternId -> array of positions
      const multipliers = roomInfo.multipliers;          // Array of arrays with multiplier values
      this.infoButton.updateInfoContent(winningPatterns, multipliers);

    } else if (type === 'SetBet') {
      const info = message.betInfo[0];
      const result = info.gameResult;
      this.balance = info.balance.toFixed(2);
      this.winAmount = result.winAmount;
      const finalSymbols = result.finalSymbols.map(row =>
        row.map(num => `symbol${num}`)
      );
      this.winDisplay.setValue(`${this.currencySymbol}${this.winAmount}`);
      this.userGameCard.updateBalance(this.balance);
      this.slotMachine.spin(finalSymbols, result.matchDetails, () => {
        this.matchDetails = result.matchDetails
        this.balance = info.finalBalance.toFixed(2);
        this.userGameCard.updateBalance(this.balance);
        this.showWinPopup(result.matchDetails);
      });
    }
  }

  showWinPopup(matchDetails) {
    const popup = this.add.container(0, 0).setDepth(Number.MAX_SAFE_INTEGER);

    const maxRow = 4;
    const maxCol = Math.ceil(matchDetails.length / maxRow); // 5 columns for 20 items with 4 rows

    // Popup size - adjust if needed (max 80% screen size)
    const width = LAYOUT.GAME_WIDTH * 0.8;
    const height = LAYOUT.GAME_HEIGHT * 0.8;
    const margin_x = (LAYOUT.GAME_WIDTH - width) / 2;
    const margin_y = (LAYOUT.GAME_HEIGHT - height) / 2;
    const radius = 20;  // Rounded corner radius
    const titleY = margin_y + 30 * SCALE;

    // Calculate card size scaled to fit within popup with some spacing
    let cardWidth = STYLE.INFO_CARD_STYLE.width * 0.7;
    let cardHeight = STYLE.INFO_CARD_STYLE.height * 0.7;

    // Calculate horizontal and vertical spacing to fit all cards in grid inside popup
    const spacingX = (width - cardWidth * maxCol) / (maxCol + 1);
    const spacingY = (height - cardHeight * maxRow) / (maxRow + 1);

    // Adjust card size if spacingX or spacingY is too small (negative)
    if (spacingX < 8) {
      const totalSpacingX = 8 * (maxCol + 1);
      cardWidth = (width - totalSpacingX) / maxCol;
    }
    if (spacingY < 8) {
      const totalSpacingY = 8 * (maxRow + 1);
      cardHeight = (height - totalSpacingY) / maxRow;
    }

    // Background with rounded corners and semi-transparent black fill
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(margin_x, margin_y, width, height, radius);
    popup.add(bg);

    // Title text
    const titleText = this.add.text(
      LAYOUT.GAME_WIDTH / 2,
      titleY,
      'Last Winning Table',
      STYLE.titleText
    ).setOrigin(0.5, 0.5);
    popup.add(titleText);

    // Make background interactive to close popup on click anywhere
    bg.setInteractive(new Phaser.Geom.Rectangle(margin_x, margin_y, width, height), Phaser.Geom.Rectangle.Contains);

    // Local helper to create symbol images row (keep inside or outside)
    const createSymbolImagesRow = (scene, x, y, symbolKey, count, symbolSize = 22, spacing = 1) => {
      const container = scene.add.container(x, y);
      for (let i = 0; i < count; i++) {
        const img = scene.add.image(i * (symbolSize * SCALE + spacing * SCALE), 0, symbolKey);
        img.setOrigin(0, 0);
        img.setDisplaySize(symbolSize * SCALE, symbolSize * SCALE);
        container.add(img);
      }
      return container;
    };

    // Loop over all 20 matchDetails and layout cards + info containers
    for (let i = 0; i < matchDetails.length; i++) {
      const row = i % maxRow;
      const col = Math.floor(i / maxRow);

      const x = margin_x + spacingX + (cardWidth + spacingX) * col;
      const y = titleY + spacingY + (cardHeight + spacingY) * row;

      const label = `LINE ${matchDetails[i].line}`;
      const { card, cardText } = createCard(this, 0, 0, label, matchDetails[i].pattern, cardWidth / STYLE.INFO_CARD_STYLE.width);

      // Container for card + info on left
      const cardContainer = this.add.container(x - cardWidth / 2, y);

      // Set card and text positions inside container
      card.setPosition(0, 0);
      cardText.setPosition(cardWidth / 2, 5 * SCALE);

      cardContainer.add([card, cardText]);

      // Info block on left side
      const infoX = cardWidth + 3 * SCALE;
      const infoY = cardHeight / 5;

      const symbolsRow = createSymbolImagesRow(this, infoX, 0, getSymbolName(matchDetails[i].symbol), matchDetails[i].count);

      const multiplierLine = `Multiplier: ${matchDetails[i].multiplier}x`;
      const winAmountLine = `Win Amount: ${matchDetails[i].multiplier * this.betControls.getValue()}`;

      const multiplierText = this.add.text(infoX, infoY * 2, multiplierLine, STYLE.smallCardText).setOrigin(0, 0);
      const winAmountText = this.add.text(infoX, infoY * 4, winAmountLine, STYLE.smallCardText).setOrigin(0, 0);

      cardContainer.add([symbolsRow, multiplierText, winAmountText]);

      popup.add(cardContainer);
    }

    // Close popup on pointerdown anywhere
    const closeHandler = () => {
      popup.destroy();
      this.input.off('pointerdown', closeHandler);
    };
    this.input.once('pointerdown', closeHandler);

    // Bring popup to top
    this.children.bringToTop(popup);
  }

  startGame() {
    if (this.loadingCard) {
      this.loadingCard.destroy();
    }
    // Game title
    if (this.gameTitle) {
      this.gameTitle.destroy();
    }
    this.gameTitle = new GameTitle(this, LAYOUT.GAME_WIDTH / 2, 30 * SCALE);

    // Slot Machine
    if (this.slotMachine) {
      this.slotMachine.destroy();
    }
    this.slotMachine = new SlotMachine(this, this.symbols);

    // Configurable values
    this.currentBet = 1;
    this.currentLines = 1;
    this.settings = { sfxEnabled: true, musicEnabled: true };

    this.totalBetDisplay = new DisplayField(this, 'TOTAL BET', `$${this.currentBet * this.currentLines}`, STYLE.valueBox);
    this.winDisplay = new DisplayField(this, 'WIN', '$0', STYLE.valueBox);

    this.betControls = new Control(this, 'BET', this.currentBet, true, (val) => {
      this.currentBet = val;
      this.totalBetDisplay.valueText.setText(`${this.currencySymbol}${this.currentBet * this.currentLines}`);
    }, 1, 50);

    this.lineControls = new Control(this, 'LINES', this.currentLines, false,  (val) => {
      this.currentLines = val;
      this.totalBetDisplay.valueText.setText(`${this.currencySymbol}${this.currentBet * this.currentLines}`);
    });
    this.userGameCard = new UserGameCard(this, LAYOUT.GAME_WIDTH - 20 * SCALE, 20 * SCALE, this.playerId, this.gameId, this.balance);
    this.lineButtonsManager = new LineButtonsManager(this, this.lineControls);
    this.lineButtonsManager.lineButtonGroup[1].clickEffect(true);
    this.infoButton = new InfoButton(this, 40 * SCALE, 40 * SCALE);
    this.optionButotn = new OptionsButon(this, 40 * SCALE, 90 * SCALE);

    this.positionControlsAndSpinButton();
  }

  updateWinDisplay() {
    if (!this.winDisplay) {
      return;
    }
    this.winDisplay.updateUI()
  }

  updateTotalBetValue() {
    if (!this.totalBetDisplay) {
      return;
    }
    this.totalBetDisplay.valueText.setText(this.currentBet * this.currentLines);
  }

  sendSpinRequest() {
    this.ws.socket.send(messages.setBet(this.betControls.getValue(), this.lineControls.getValue()))
  }

  // WebSocket setup function that accepts a callback to forward messages
  setupWebSocket(onMessageCallback) {
    this.ws = new WebSocketClient(onMessageCallback);
    this.ws.connect();
  }

  prepareBackground() {
    const bg = this.add.image(0, 0, 'bg');
    bg.setOrigin(0); // Top-left corner
    bg.setDisplaySize(this.sys.game.config.width, this.sys.game.config.height); // Stretch to fit

    this.bgm = this.sound.add('bgm', {
      loop: true,
      volume: 0.5, // Adjust volume from 0.0 to 1.0
    });
    this.bgm.play();
  }

  positionControlsAndSpinButton() {
    const screenWidth = this.cameras.main.width;
    const reelsBottom = LAYOUT.BASE_Y + REEL_CONFIG.ROW_COUNT * LAYOUT.REEL_SPACING_Y;
    const yPos = reelsBottom + 30 * SCALE;

    const groupCount = 5;
    const slotWidth = screenWidth / groupCount;
    const spinCenter = slotWidth * 2.5;
    const distance = 150 * SCALE;

    const lineCenter = spinCenter - distance * 2;
    const betCenter = spinCenter - distance * 1;
    const totalBetCenter = spinCenter + distance * 1;
    const winCenter = spinCenter + distance * 2;

    this.makeControlContainer(this.betControls, betCenter, yPos);
    this.makeControlContainer(this.lineControls, lineCenter, yPos);
    this.makeDisplayContainer(this.totalBetDisplay, totalBetCenter, yPos);
    this.makeDisplayContainer(this.winDisplay, winCenter, yPos, () => {
      this.showWinPopup(this.matchDetails);
    });

    this.slotMachine.spinButton.setPosition(spinCenter, yPos);
  }

  makeControlContainer(controls, center, yPos) {
    const padding = 8 * SCALE;
    const radius = 6 * SCALE;
    const labelH = parseInt(STYLE.label.fontSize);
    const controlH = parseInt(STYLE.valueBox.fontSize) + padding;
    const groupW = 130 * SCALE;
    const cardW = groupW + padding;
    const cardH = labelH + controlH + padding * 2;
    const cardY = yPos - labelH - padding;

    const container = this.add.container(center, 0);
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      COLORS.controlCardGradient.topLeft,
      COLORS.controlCardGradient.topRight,
      COLORS.controlCardGradient.bottomLeft,
      COLORS.controlCardGradient.bottomRight,
      1
    );
    bg.fillRoundedRect(-cardW / 2, cardY, cardW, cardH, radius);
    container.add(bg);

    controls.label.setPosition(0, cardY).setOrigin(0.5, 0).setShadow(2, 2, '#000', 3, false, true);
    controls.minusBtn.setPosition(-groupW / 2, yPos);
    controls.valueText.setPosition(0, yPos);
    controls.plusBtn.setPosition(groupW / 2 - controls.plusBtn.width, yPos);

    container.add([controls.label, controls.minusBtn, controls.valueText, controls.plusBtn]);
  }

  makeDisplayContainer(display, center, yPos, onClickCallback = null) {
    const padding = 8 * SCALE;
    const radius = 6 * SCALE;

    const labelH = parseInt(STYLE.label.fontSize);
    const controlH = parseInt(STYLE.valueBox.fontSize) + padding;

    const groupW = 130 * SCALE;
    const cardW = groupW + padding;
    const cardH = labelH + controlH + padding * 2;
    const cardY = yPos - labelH - padding;

    const container = this.add.container(center, 0);

    // Background card
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      COLORS.controlCardGradient.topLeft,
      COLORS.controlCardGradient.topRight,
      COLORS.controlCardGradient.bottomLeft,
      COLORS.controlCardGradient.bottomRight,
      1
    );
    bg.fillRoundedRect(-cardW / 2, cardY, cardW, cardH, radius);

    display.label
      .setPosition(0, cardY)
      .setOrigin(0.5, 0)
      .setShadow(2, 2, '#000', 3, false, true);

    display.valueText.setPosition(0, yPos);
    container.add([bg, display.label, display.valueText]);
    if (onClickCallback) {
      // Create info button (circle with "i") at top right corner of card
      const infoRadius = 10 * SCALE;
      const infoX = cardW / 2 - infoRadius - 4 * SCALE;  // padding from right edge
      const infoY = cardY + infoRadius + 4 * SCALE;      // padding from top edge

      const infoButton = this.add.graphics();
      const normalColor = 0x00b4d8;
      const hoverColor = 0x9999ff;

      // Draw initial circle
      infoButton.fillStyle(normalColor, 1);
      infoButton.fillCircle(infoX, infoY, infoRadius);

      // Draw letter "i" inside the circle (simple vertical line)
      const infoText = this.add.text(infoX, infoY, 'i', STYLE.infoText).setOrigin(0.5);

      // Make info button interactive only
      infoButton.setInteractive(new Phaser.Geom.Circle(infoX, infoY, infoRadius), Phaser.Geom.Circle.Contains);

      // Pointer events for hover effect
      infoButton.on('pointerover', () => {
        infoButton.clear();
        infoButton.fillStyle(hoverColor, 1);
        infoButton.fillCircle(infoX, infoY, infoRadius);
      });

      infoButton.on('pointerout', () => {
        infoButton.clear();
        infoButton.fillStyle(normalColor, 1);
        infoButton.fillCircle(infoX, infoY, infoRadius);
      });

      infoButton.on('pointerup', () => {
        if (this.isSpinning) {
          return;
        }
        if (this.scene.settings.sfxEnabled) {
          this.scene.sound.play('click');
        }
        onClickCallback();
      });

      container.add([infoButton, infoText]);
    }
    

    return container;
  }
}
