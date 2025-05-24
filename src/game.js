// game.js
import { config, ROW_COUNT, LAYOUT, SCALE, GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { STYLE } from './style.js';
import { createLineButtonGroup } from './line.js'
import { createSpinButton, setupReelsWithMask } from './reels.js'
import { createInfoButtons } from './info.js'

function preload() {
  this.load.image('reel1', 'assets/symbol_1.png');
  this.load.image('reel2', 'assets/symbol_2.png');
  this.load.image('reel3', 'assets/symbol_3.png');
}

function create() {
  const bg = this.add.graphics();

  bg.fillGradientStyle(
    COLORS.bgGradient.topLeft,
    COLORS.bgGradient.topRight,
    COLORS.bgGradient.bottomLeft,
    COLORS.bgGradient.bottomRight,
    1
  );

  bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  this.reels = [];
  this.isSpinning = false;

  setupReelsWithMask(this);

  const spinButton = createSpinButton(this);

  // Configurable values
  let currentBet = 1;
  let currentLines = 1;

  // Create BET controls
  const betControls = createControls(this, 'BET', currentBet, (val) => {
    currentBet = val;
    updateTotalBet();
  }, 1, 50);

  // Create LINE controls
  const lineControls = createControls(this, 'LINES', currentLines, (val) => {
    currentLines = val;
    updateTotalBet();
  });

  const reelsBottom = LAYOUT.baseY + ROW_COUNT * LAYOUT.reelSpacingY;

  const totalBetDisplay = createDisplayField.call(this, 'TOTAL BET', currentBet * currentLines, STYLE.BigVlaueBox);

  const winDisplay = createDisplayField.call(this, 'WIN', 0, STYLE.valueBox);

  positionControlsAndSpinButton.call(this, betControls, lineControls, spinButton, reelsBottom, totalBetDisplay, winDisplay);

  createUserGameCard(this, GAME_WIDTH - 20 * SCALE, 20 * SCALE, "User1234", "Game5678", 9999999);

  // Top center: Game Name
  createGameTitle(this, GAME_WIDTH / 2, 30 * SCALE);

  const lineButtonGroup = createLineButtonGroup(this, lineControls);
  lineButtonGroup[1].clickEffect(true);
  lineControls.setLineButtonGroup(lineButtonGroup);
  createInfoButtons(this);

  // Update total bet display
  function updateTotalBet() {
    totalBetDisplay.valueText.setText(currentBet * currentLines);
  }
}

function createUserGameCard(scene, x, y, userId, gameId, balance) {
  const padding = 22 * SCALE;
  const radius = 12 * SCALE;

  const textContent = `👤 ${userId}\n🎮 ${gameId}\n💰 ${balance}`;
  const text = scene.add.text(0, 0, textContent, STYLE.userInfoText);

  const textBounds = text.getBounds();
  const cardWidth = textBounds.width + padding * 2;
  const cardHeight = textBounds.height + padding * 2;

  const bg = scene.add.graphics();
  bg.fillGradientStyle(
    COLORS.userCard.topLeft,
    COLORS.userCard.topRight,
    COLORS.userCard.bottomLeft,
    COLORS.userCard.bottomRight,
    1
  );

  bg.fillRoundedRect(x - cardWidth, y, cardWidth, cardHeight, radius);

  text.setPosition(x - cardWidth + padding, y + padding);
  text.setDepth(10);
  bg.setDepth(9);

  return { background: bg, label: text };
}

function createGameTitle(scene, x, y, title = "Spin Deluxe") {
  const paddingX = 16 * SCALE;
  const paddingY = 8 * SCALE;

  // Create text object
  const titleText = scene.add.text(0, 0, title, STYLE.titleText).setOrigin(0.5, 0.5);

  // Measure text and create background
  const bgWidth = titleText.width + paddingX * 2;
  const bgHeight = titleText.height + paddingY * 2;

  const bg = scene.add.graphics();
  bg.fillGradientStyle(
    COLORS.gameTitleGradient.topLeft,
    COLORS.gameTitleGradient.topRight,
    COLORS.gameTitleGradient.bottomLeft,
    COLORS.gameTitleGradient.bottomRight,
    1
  );
  bg.fillRoundedRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight, 12 * SCALE);

  // Bring text above graphics
  titleText.setPosition(x, y);
  titleText.setDepth(10);
  bg.setDepth(9);  // slightly below the text

  return { background: bg, label: titleText };
}

// Interactive button with hover and click effects
function createButton(scene, label, onClick) {
  const btn = scene.add.text(0, 0, label, STYLE.button)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', function () {
      this.setScale(1.05);
    })
    .on('pointerout', function () {
      this.setScale(1.0);
    })
    .on('pointerdown', function () {
      scene.tweens.add({
        targets: this,
        scale: 0.92,
        duration: 80,
        ease: 'Quad.easeIn',
        yoyo: true
      });
      if (onClick) onClick();
    });
  return btn;
}

function createControls(scene, labelText, initialValue, onChange, minVal = 1, maxVal = 20) {
  let value = initialValue;
  let lineButtonGroup = null
  const minusBtn = createButton(scene, '-', () => {
    value = Math.max(minVal, value - 1);
    valueText.setText(value);
    onChange(value);
    updateLineButton();
  });

  const plusBtn = createButton(scene, '+', () => {
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
    let lineEffectTimer = null; // Store timer reference outside the function

    // Cancel any existing delayed call
    if (lineEffectTimer) {
      lineEffectTimer.remove(); // Cancel the timer
      lineEffectTimer = null;
    }
    for (let i = 1; i <= 20; i++) {
      const button = lineButtonGroup[i]
      if (i <= value) {
        button.clickEffect(true);
      } else {
        button.clickEffect(false);
      }
    }
    const button = lineButtonGroup[value];
    button.lineEffect();
    // Schedule cancelLineEffect after 1 second
    lineEffectTimer = scene.time.delayedCall(1000, () => {
      button.cancelLineEffect();
      lineEffectTimer = null; // Clear the reference after it's done
    });
  }

  const valueText = scene.add.text(0, 0, value, STYLE.valueBox).setOrigin(0.5, 0);
  const label = scene.add.text(0, 0, labelText, STYLE.label);

  return { minusBtn, plusBtn, valueText, label, updateText, setLineButtonGroup };
}

function createDisplayField(labelText, initialValue, style) {
  const valueText = this.add.text(0, 0, initialValue, style).setOrigin(0.5, 0);
  const label = this.add.text(0, 0, labelText, STYLE.label);
  return { valueText, label };
}

function positionControlsAndSpinButton(betControls, lineControls, spinButton, reelsBottom, totalBetDisplay, winDisplay) {
  const yPos = reelsBottom + 30 * SCALE;
  const screenWidth = this.cameras.main.width;


  // Total layout: [LINE] [BET] [SPIN] [BALANCE] [WIN]
  const groupCount = 5;
  const slotWidth = screenWidth / groupCount;

  function makeControlContainer(scene, controls, center) {
    // 1) Compute basics
    const padding = 8 * SCALE;
    const radius = 6 * SCALE;
    const labelH = parseInt(STYLE.label.fontSize);
    const controlH = parseInt(STYLE.valueBox.fontSize) + padding;
    const groupW = 130 * SCALE
    const cardW = groupW + padding;
    const cardH = labelH + controlH + padding * 2;
    const cardY = yPos - labelH - padding;
    // 2) Make a container positioned at the group center
    const cardContainer = scene.add.container(center, 0);
    // 3) Add a rounded‐rect background
    const bg = scene.add.graphics();
    bg.fillGradientStyle(
      COLORS.controlCardGradient.topLeft,
      COLORS.controlCardGradient.topRight,
      COLORS.controlCardGradient.bottomLeft,
      COLORS.controlCardGradient.bottomRight,
      1
    );
    bg.fillRoundedRect(
      -cardW / 2,        // x relative to container
      cardY,          // y relative to container
      cardW,
      cardH,
      radius
    );
    cardContainer.add(bg);
    // 4) Position and add the label & controls into the same container
    controls.label
      .setPosition(0, cardY)
      .setOrigin(0.5, 0)
      .setShadow(2, 2, '#000', 3, false, true);
    cardContainer.add(controls.label);

    controls.minusBtn
      .setPosition(-groupW / 2, yPos)
    controls.valueText
      .setPosition(0, yPos)
    controls.plusBtn
      .setPosition(groupW / 2 - controls.plusBtn.width, yPos)

    cardContainer.add([controls.minusBtn, controls.valueText, controls.plusBtn]);
  }

  function makeDisplayContainer(scene, display, center) {
    // 1) Compute basics
    const padding = 8 * SCALE;
    const radius = 6 * SCALE;
    const labelH = parseInt(STYLE.label.fontSize);
    const controlH = parseInt(STYLE.valueBox.fontSize) + padding;
    const groupW = 130 * SCALE
    const cardW = groupW + padding;
    const cardH = labelH + controlH + padding * 2;
    const cardY = yPos - labelH - padding;
    // 2) Make a container positioned at the group center
    const cardContainer = scene.add.container(center, 0);
    // 3) Add a rounded‐rect background
    const bg = scene.add.graphics();
    bg.fillGradientStyle(
      COLORS.controlCardGradient.topLeft,
      COLORS.controlCardGradient.topRight,
      COLORS.controlCardGradient.bottomLeft,
      COLORS.controlCardGradient.bottomRight,
      1
    );
    bg.fillRoundedRect(
      -cardW / 2,        // x relative to container
      cardY,          // y relative to container
      cardW,
      cardH,
      radius
    );
    cardContainer.add(bg);
    // 4) Position and add the label & controls into the same container
    display.label
      .setPosition(0, cardY)
      .setOrigin(0.5, 0)
      .setShadow(2, 2, '#000', 3, false, true);
    cardContainer.add(display.label);

    display.valueText.setPosition(0, yPos);

    cardContainer.add(display.valueText);
  }

  const spinCenter = slotWidth * 2.5;
  const distance = (150) * SCALE

  // Line group
  const lineCenter = spinCenter - distance * 2;
  makeControlContainer(this, lineControls, lineCenter)

  // BET group
  const betCenter = spinCenter - distance * 1;
  makeControlContainer(this, betControls, betCenter)

  // SPIN button center
  spinButton.setPosition(spinCenter, yPos);


  // BALANCE display
  const totalBet = spinCenter + distance * 1;
  makeDisplayContainer(this, totalBetDisplay, totalBet)

  // WIN display
  const winCenter = spinCenter + distance * 2;
  makeDisplayContainer(this, winDisplay, winCenter)
}


config.scene = { preload, create, };
const game = new Phaser.Game(config);
