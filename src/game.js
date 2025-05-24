// GameScene.js
import { config, REEL_CONFIG, LAYOUT, SCALE, COLORS } from './config.js';
import { STYLE } from './style.js';
import { createLineButtonGroup } from './line.js';
import { createSpinButton, setupReelsWithMask } from './reels.js';
import { createInfoButtons } from './info.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.reels = [];
    this.isSpinning = false;
    this.currentBet = 1;
    this.currentLines = 1;
  }

  preload() {
    this.load.image('reel1', 'assets/symbol_1.png');
    this.load.image('reel2', 'assets/symbol_2.png');
    this.load.image('reel3', 'assets/symbol_3.png');
  }

  create() {
    this.drawBackground();
    setupReelsWithMask(this);
    const spinButton = createSpinButton(this);

    const betControls = this.createControls('BET', this.currentBet, (val) => {
      this.currentBet = val;
      this.updateTotalBet();
    }, 1, 50);

    const lineControls = this.createControls('LINES', this.currentLines, (val) => {
      this.currentLines = val;
      this.updateTotalBet();
    });

    const reelsBottom = LAYOUT.BASE_Y + REEL_CONFIG.ROW_COUNT * LAYOUT.REEL_SPACING_Y;
    this.totalBetDisplay = this.createDisplayField('TOTAL BET', this.currentBet * this.currentLines, STYLE.BigVlaueBox);
    this.winDisplay = this.createDisplayField('WIN', 0, STYLE.valueBox);

    this.positionControlsAndSpinButton(betControls, lineControls, spinButton, reelsBottom, this.totalBetDisplay, this.winDisplay);

    this.createUserGameCard(LAYOUT.GAME_WIDTH - 20 * SCALE, 20 * SCALE, "User1234", "Game5678", 9999999);
    this.createGameTitle(LAYOUT.GAME_WIDTH / 2, 30 * SCALE);

    const lineButtonGroup = createLineButtonGroup(this, lineControls);
    lineButtonGroup[1].clickEffect(true);
    lineControls.setLineButtonGroup(lineButtonGroup);

    createInfoButtons(this);
  }

  drawBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(
      COLORS.bgGradient.topLeft,
      COLORS.bgGradient.topRight,
      COLORS.bgGradient.bottomLeft,
      COLORS.bgGradient.bottomRight,
      1
    );
    bg.fillRect(0, 0, LAYOUT.GAME_WIDTH, LAYOUT.GAME_HEIGHT);
  }

  updateTotalBet() {
    this.totalBetDisplay.valueText.setText(this.currentBet * this.currentLines);
  }

  createUserGameCard(x, y, userId, gameId, balance) {
    const padding = 22 * SCALE;
    const radius = 12 * SCALE;
    const textContent = `👤 ${userId}\n🎮 ${gameId}\n💰 ${balance}`;
    const text = this.add.text(0, 0, textContent, STYLE.userInfoText);
    const textBounds = text.getBounds();
    const cardWidth = textBounds.width + padding * 2;
    const cardHeight = textBounds.height + padding * 2;

    const bg = this.add.graphics();
    bg.fillGradientStyle(
      COLORS.userCard.topLeft,
      COLORS.userCard.topRight,
      COLORS.userCard.bottomLeft,
      COLORS.userCard.bottomRight,
      1
    );
    bg.fillRoundedRect(x - cardWidth, y, cardWidth, cardHeight, radius);
    text.setPosition(x - cardWidth + padding, y + padding).setDepth(10);
    bg.setDepth(9);
  }

  createGameTitle(x, y, title = "Spin Deluxe") {
    const paddingX = 16 * SCALE;
    const paddingY = 8 * SCALE;
    const titleText = this.add.text(0, 0, title, STYLE.titleText).setOrigin(0.5, 0.5);
    const bgWidth = titleText.width + paddingX * 2;
    const bgHeight = titleText.height + paddingY * 2;

    const bg = this.add.graphics();
    bg.fillGradientStyle(
      COLORS.gameTitleGradient.topLeft,
      COLORS.gameTitleGradient.topRight,
      COLORS.gameTitleGradient.bottomLeft,
      COLORS.gameTitleGradient.bottomRight,
      1
    );
    bg.fillRoundedRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight, 12 * SCALE);
    titleText.setPosition(x, y).setDepth(10);
    bg.setDepth(9);
  }

  createControls(labelText, initialValue, onChange, minVal = 1, maxVal = 20) {
    let value = initialValue;
    let lineButtonGroup = null;
    const minusBtn = this.createButton('-', () => {
      value = Math.max(minVal, value - 1);
      valueText.setText(value);
      onChange(value);
      updateLineButton();
    });

    const plusBtn = this.createButton('+', () => {
      value = Math.min(maxVal, value + 1);
      valueText.setText(value);
      onChange(value);
      updateLineButton();
    });

    const updateText = (val) => {
      valueText.setText(val);
      value = Number(val);
    };

    const setLineButtonGroup = (group) => {
      lineButtonGroup = group;
    };

    const updateLineButton = () => {
      if (!lineButtonGroup) return;
      lineButtonGroup.forEach((btn, idx) => {
        if (idx > 0) btn.clickEffect(idx <= value);
      });
      const button = lineButtonGroup[value];
      if (!button) return;
      button.lineEffect();
      this.time.delayedCall(1000, () => button.cancelLineEffect());
    };

    const valueText = this.add.text(0, 0, value, STYLE.valueBox).setOrigin(0.5, 0);
    const label = this.add.text(0, 0, labelText, STYLE.label);

    return { minusBtn, plusBtn, valueText, label, updateText, setLineButtonGroup };
  }

  createButton(label, onClick) {
    return this.add.text(0, 0, label, STYLE.button)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', function () { this.setScale(1.05); })
      .on('pointerout', function () { this.setScale(1.0); })
      .on('pointerdown', function () {
        this.scene.tweens.add({
          targets: this,
          scale: 0.92,
          duration: 80,
          ease: 'Quad.easeIn',
          yoyo: true
        });
        if (onClick) onClick();
      });
  }

  createDisplayField(labelText, initialValue, style) {
    const valueText = this.add.text(0, 0, initialValue, style).setOrigin(0.5, 0);
    const label = this.add.text(0, 0, labelText, STYLE.label);
    return { valueText, label };
  }

  positionControlsAndSpinButton(betControls, lineControls, spinButton, reelsBottom, totalBetDisplay, winDisplay) {
    const yPos = reelsBottom + 30 * SCALE;
    const screenWidth = this.cameras.main.width;
    const slotWidth = screenWidth / 5;
    const distance = 150 * SCALE;
    const spinCenter = slotWidth * 2.5;

    const layout = [
      { type: 'control', controls: lineControls, center: spinCenter - 2 * distance },
      { type: 'control', controls: betControls, center: spinCenter - distance },
      { type: 'button', button: spinButton, center: spinCenter },
      { type: 'display', display: totalBetDisplay, center: spinCenter + distance },
      { type: 'display', display: winDisplay, center: spinCenter + 2 * distance }
    ];

    layout.forEach(item => {
      if (item.type === 'button') {
        item.button.setPosition(item.center, yPos);
      } else if (item.type === 'control') {
        this.makeControlContainer(item.controls, item.center, yPos);
      } else if (item.type === 'display') {
        this.makeDisplayContainer(item.display, item.center, yPos);
      }
    });
  }

  makeControlContainer(controls, center, yPos) {
    const scene = this;
    const padding = 8 * SCALE;
    const radius = 6 * SCALE;
    const labelH = parseInt(STYLE.label.fontSize);
    const controlH = parseInt(STYLE.valueBox.fontSize) + padding;
    const groupW = 130 * SCALE;
    const cardW = groupW + padding;
    const cardH = labelH + controlH + padding * 2;
    const cardY = yPos - labelH - padding;
    const container = scene.add.container(center, 0);

    const bg = scene.add.graphics();
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
    container.add(controls.label);

    controls.minusBtn.setPosition(-groupW / 2, yPos);
    controls.valueText.setPosition(0, yPos);
    controls.plusBtn.setPosition(groupW / 2 - controls.plusBtn.width, yPos);
    container.add([controls.minusBtn, controls.valueText, controls.plusBtn]);
  }

  makeDisplayContainer(display, center, yPos) {
    const scene = this;
    const padding = 8 * SCALE;
    const radius = 6 * SCALE;
    const labelH = parseInt(STYLE.label.fontSize);
    const controlH = parseInt(STYLE.valueBox.fontSize) + padding;
    const groupW = 130 * SCALE;
    const cardW = groupW + padding;
    const cardH = labelH + controlH + padding * 2;
    const cardY = yPos - labelH - padding;
    const container = scene.add.container(center, 0);

    const bg = scene.add.graphics();
    bg.fillGradientStyle(
      COLORS.controlCardGradient.topLeft,
      COLORS.controlCardGradient.topRight,
      COLORS.controlCardGradient.bottomLeft,
      COLORS.controlCardGradient.bottomRight,
      1
    );
    bg.fillRoundedRect(-cardW / 2, cardY, cardW, cardH, radius);
    container.add(bg);

    display.label.setPosition(0, cardY).setOrigin(0.5, 0).setShadow(2, 2, '#000', 3, false, true);
    container.add(display.label);
    display.valueText.setPosition(0, yPos);
    container.add(display.valueText);
  }
}

config.scene = [GameScene];
const game = new Phaser.Game(config);