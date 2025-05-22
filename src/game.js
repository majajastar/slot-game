// game.js
import { config, ROW_COUNT, LAYOUT, SCALE, GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { STYLE } from './style.js';
import { createSpinButton, setupReelsWithMask } from './reels.js'

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

  const finalSymbolsPerReel = getFinalSymbols();

  const spinButton = createSpinButton.call(this, finalSymbolsPerReel);

  // Configurable values
  let currentBet = 1;
  let currentLines = 1;

  // Create BET controls
  const betControls = createControls.call(this, 'BET', currentBet, (val) => currentBet = val);

  // Create LINE controls
  const lineControls = createControls.call(this, 'LINES', currentLines, (val) => currentLines = val);

  const reelsBottom = LAYOUT.baseY + ROW_COUNT * LAYOUT.reelSpacingY;

  const balanceDisplay = createDisplayField.call(this, 'BALANCE', 1000, STYLE.BigVlaueBox);

  const winDisplay = createDisplayField.call(this, 'WIN', 0, STYLE.valueBox);

  positionControlsAndSpinButton.call(this, betControls, lineControls, spinButton, reelsBottom, balanceDisplay, winDisplay);

  const radius = 20 * SCALE;
  const padding = 5 * SCALE
  const icon_x = 40 * SCALE
  const icon_y = 40 * SCALE
  const info = createInfoIcon(this, icon_x, icon_y, radius);
  const options = createOptionsIcon(this,icon_x, icon_y * 2 + padding);

  createUserGameCard(this, GAME_WIDTH - 20 * SCALE, 20 * SCALE, "User1234", "Game5678");

  // Top center: Game Name
  createGameTitle(this, GAME_WIDTH / 2, 30 * SCALE);
}

function createUserGameCard(scene, x, y, userId, gameId) {
  const padding = 10 * SCALE;
  const radius = 12 * SCALE;

  const text = scene.add.text(0, 0, `👤 ${userId}\n🎮 ${gameId}`, STYLE.infoText);

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

function createInfoIcon(scene, x, y, radius = 20 * SCALE) {
  const g = scene.add.graphics({ x, y });

  // Ocean color gradient simulation (manual layer approach)
  const outerRadius = radius;
  const innerRadius = radius - 3 * SCALE;

  // Outer border (darker ocean)
  g.fillStyle(0x005f73, 1);
  g.fillCircle(0, 0, outerRadius);

  // Inner fill (lighter ocean)
  g.fillStyle(0x00b4d8, 1);
  g.fillCircle(0, 0, innerRadius);

  // Optional glossy top highlight
  g.fillStyle(0xffffff, 0.15);
  g.fillCircle(0, -innerRadius * 0.5, innerRadius * 0.6);

  // Add "i" text
  const text = scene.add.text(x, y + 1, 'i', STYLE.iconText).setOrigin(0.5);

  // Optional drop shadow
  text.setShadow(1, 1, '#000', 2, true, true);

  // Interactive zone (optional)
  const zone = scene.add.zone(x, y, radius * 2, radius * 2).setInteractive();
  zone.setOrigin(0.5);

  return { bg: g, label: text, interactiveZone: zone };
}

function createOptionsIcon(scene, x, y, lineWidth = 14 * SCALE, lineHeight = 2 * SCALE, spacing = 6 * SCALE) {
  const g = scene.add.graphics({ x, y });

  const circleRadius = 20 * SCALE;

  // Outer border (darker ocean)
  g.fillStyle(0x005f73, 1);
  g.fillCircle(0, 0, circleRadius);

  // Inner fill (lighter ocean)
  g.fillStyle(0x00b4d8, 1);
  g.fillCircle(0, 0, circleRadius - 3 * SCALE);

  // Optional glossy top highlight
  g.fillStyle(0xffffff, 0.15);
  g.fillCircle(0, -circleRadius * 0.4, circleRadius * 0.6);

  // Draw three horizontal lines (menu-style)
  g.fillStyle(0xffffff, 1);
  for (let i = -1; i <= 1; i++) {
    g.fillRect(-lineWidth / 2, i * spacing - lineHeight / 2, lineWidth, lineHeight);
  }

  // Create interactive zone
  const zone = scene.add.zone(x, y, circleRadius * 2, circleRadius * 2).setInteractive();
  zone.setOrigin(0.5);

  return { icon: g, interactiveZone: zone };
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

function createControls(labelText, initialValue, onChange) {
  let value = initialValue;

  const minusBtn = createButton(this, '−', () => {
    value = Math.max(1, value - 1);
    valueText.setText(value);
    onChange(value);
  });

  const plusBtn = createButton(this, '+', () => {
    value += 1;
    valueText.setText(value);
    onChange(value);
  });

  const valueText = this.add.text(0, 0, value, STYLE.valueBox).setOrigin(0.5, 0);
  const label = this.add.text(0, 0, labelText, STYLE.label);

  return { minusBtn, plusBtn, valueText, label };
}

function createDisplayField(labelText, initialValue, style) {
  const valueText = this.add.text(0, 0, initialValue, style).setOrigin(0.5, 0);
  const label = this.add.text(0, 0, labelText, STYLE.label);
  return { valueText, label };
}


function getFinalSymbols() {
  return [
    ['reel1', 'reel3', 'reel2'],
    ['reel3', 'reel1', 'reel1'],
    ['reel2', 'reel2', 'reel3'],
    ['reel1', 'reel3', 'reel2'],
    ['reel3', 'reel1', 'reel3']
  ];
}

function positionControlsAndSpinButton(betControls, lineControls, spinButton, reelsBottom, balanceDisplay, winDisplay) {
  const yPos = reelsBottom + 30 * SCALE;
  const screenWidth = this.cameras.main.width;


  // Total layout: [LINE] [BET] [SPIN] [BALANCE] [WIN]
  const groupCount = 5;
  const slotWidth = screenWidth / groupCount;

  function makeControlContainer(scene, controls, center) {
    // 1) Compute basics
    const padding = 8 * SCALE;
    const radius = 6 * SCALE;
    const x = center
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
    const x = center
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

  // Line group
  const lineCenter = slotWidth * 0.5;
  makeControlContainer(this, lineControls, lineCenter)

  // BET group
  const betCenter = slotWidth * 1.5;
  makeControlContainer(this, betControls, betCenter)

  // SPIN button center
  const spinCenter = slotWidth * 2.5;
  spinButton.setPosition(spinCenter, yPos);


  // BALANCE display
  const balanceCenter = slotWidth * 3.5;
  makeDisplayContainer(this, balanceDisplay, balanceCenter)

  // WIN display
  const winCenter = slotWidth * 4.5;
  makeDisplayContainer(this, winDisplay, winCenter)
}


config.scene = { preload, create, };
const game = new Phaser.Game(config);
