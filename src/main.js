
const COLORS = {
  buttonBg: '#444',
  buttonHoverBg: '#666',
  buttonText: '#ffcc00',
  buttonHoverText: '#ffffff',
  spinButtonBg: '#444',
  spinButtonText: '#ffcc00',
  valueBoxBg: '#222',
  valueBoxText: '#ffffff',
  labelText: '#ffffff',
  background: '#1a1a1a',
};

const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight;

// Base design width and height (original design)
const BASE_WIDTH = 800;
const BASE_HEIGHT = 600;

// Calculate scale factors based on the base design
const scaleX = screenWidth / BASE_WIDTH;
const scaleY = screenHeight / BASE_HEIGHT;

// Choose the smaller scale to fit inside viewport without cropping
const scale = Math.min(scaleX, scaleY);

// Set game size to fit the window while preserving aspect ratio
const GAME_WIDTH = BASE_WIDTH * scale;
const GAME_HEIGHT = BASE_HEIGHT * scale;

// Scale layout constants
const SYMBOL_SIZE = 100 * scale;
const reelSpacingX = 130 * scale;
const reelSpacingY = 110 * scale;
const baseX = 120 * scale;
const baseY = 120 * scale;

// Phaser config with resize support
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  scene: { preload, create, update },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',  // Optional: if you have a div container in HTML
  }
};

const game = new Phaser.Game(config);

const REEL_COUNT = 5;
const ROW_COUNT = 3;
const symbols = ['reel1', 'reel2', 'reel3'];

// --------------------
// STYLE CONSTANTS
// --------------------
const STYLE = {
  button: {
    fontSize: '28px',
    fontFamily: 'Arial',
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    backgroundColor: COLORS.buttonBg,
    padding: { x: 12, y: 6 },
    align: 'center'
  },
  spinButton: {
    fontSize: '36px',
    fontFamily: 'Arial',
    fill: COLORS.spinButtonText,
    fontStyle: 'bold',
    backgroundColor: COLORS.spinButtonBg,
    padding: { x: 20, y: 10 },
    align: 'center'
  },
  valueBox: {
    fontSize: '28px',
    fontFamily: 'Arial',
    fill: COLORS.valueBoxText,
    backgroundColor: COLORS.valueBoxBg,
    padding: { x: 14, y: 6 },
    align: 'center',
    fixedWidth: 60
  },
  label: {
    fontSize: '20px',
    fontFamily: 'Arial',
    fill: COLORS.labelText,
    fontStyle: 'bold'
  }
};

function preload() {
  this.load.image('reel1', 'assets/symbol_1.png');
  this.load.image('reel2', 'assets/symbol_2.png');
  this.load.image('reel3', 'assets/symbol_3.png');
}

function create() {
  this.reels = [];
  this.isSpinning = false;

  const mask = createMask.call(this);
  createReels.call(this, mask);

  const finalSymbolsPerReel = getFinalSymbols();

  const reelsBottom = baseY + ROW_COUNT * reelSpacingY;

  const spinButton = createSpinButton.call(this, finalSymbolsPerReel);

  // Configurable values
  let currentBet = 1;
  let currentLines = 1;

  // Create BET controls
  const betControls = createControls.call(this, 'BET', currentBet, (val) => currentBet = val);

  // Create LINE controls
  const lineControls = createControls.call(this, 'LINES', currentLines, (val) => currentLines = val);

  positionControlsAndSpinButton.call(this, betControls, lineControls, spinButton, reelsBottom);
}

// Function to make interactive buttons with hover/click effect
function makeInteractiveButton(scene, label, onClick) {
  const btn = scene.add.text(0, 0, label, STYLE.button)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', function () {
      this.setStyle({ backgroundColor: COLORS.buttonHoverBg, fill: COLORS.buttonHoverText });
      this.setScale(1.05);
    })
    .on('pointerout', function () {
      this.setStyle({ backgroundColor: COLORS.buttonBg, fill: COLORS.buttonText });
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

// -------------- Helper Functions --------------------

function createMask() {
  const maskShape = this.make.graphics();
  const maskX = baseX - SYMBOL_SIZE / 2;
  const maskY = baseY - SYMBOL_SIZE / 2;
  const maskWidth = REEL_COUNT * reelSpacingX + SYMBOL_SIZE / 2;
  const maskHeight = ROW_COUNT * reelSpacingY;

  maskShape.fillRect(maskX, maskY, maskWidth, maskHeight);
  return maskShape.createGeometryMask();
}

function createReels(mask) {
  for (let col = 0; col < REEL_COUNT; col++) {
    const reel = [];
    for (let i = 0; i < ROW_COUNT + 1; i++) {
      const x = baseX + col * reelSpacingX;
      const y = baseY + (i - 1) * reelSpacingY;
      const key = Phaser.Utils.Array.GetRandom(symbols);

      const symbol = this.add.image(x, y, key).setDisplaySize(SYMBOL_SIZE, SYMBOL_SIZE);
      symbol.setMask(mask);
      reel.push(symbol);
    }
    this.reels.push(reel);
  }
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

function createSpinButton(finalSymbolsPerReel) {
  const spinButton = this.add.text(0, 0, 'SPIN', STYLE.spinButton)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', function () {
      if (this.scene.isSpinning) return;
      this.scene.isSpinning = true;

      this.scene.tweens.add({
        targets: this,
        scale: 0.9,
        duration: 80,
        ease: 'Quad.easeIn',
        yoyo: true,
        onComplete: () => {
          spinReels.call(this.scene, finalSymbolsPerReel, () => {
            this.scene.isSpinning = false;
          });
        }
      });
    });

  return spinButton;
}

function createButton(scene, label, onClick) {
  const btn = scene.add.text(0, 0, label, STYLE.button)
    .setInteractive({ useHandCursor: true })
    .on('pointerover', function () {
      this.setStyle({ backgroundColor: COLORS.buttonHoverBg, fill: COLORS.buttonHoverText });
      this.setScale(1.05);
    })
    .on('pointerout', function () {
      this.setStyle({ backgroundColor: COLORS.buttonBg, fill: COLORS.buttonText });
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
      onClick();
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

function positionControlsAndSpinButton(betControls, lineControls, spinButton, reelsBottom) {
  const spacing = 10;
  const groupSpacing = 30;

  const betGroupWidth = betControls.minusBtn.width + spacing + betControls.valueText.width + spacing + betControls.plusBtn.width;
  const lineGroupWidth = lineControls.minusBtn.width + spacing + lineControls.valueText.width + spacing + lineControls.plusBtn.width;
  const totalWidth = betGroupWidth + groupSpacing + lineGroupWidth + groupSpacing + spinButton.width;

  const startX = (this.cameras.main.width - totalWidth) / 2;
  const yPos = reelsBottom + 30;

  // Position BET group
  betControls.minusBtn.setPosition(startX, yPos);
  betControls.valueText.setPosition(betControls.minusBtn.x + betControls.minusBtn.width + spacing + STYLE.valueBox.fixedWidth / 2, yPos);
  betControls.plusBtn.setPosition(betControls.valueText.x + STYLE.valueBox.fixedWidth / 2 + spacing, yPos);
  betControls.label.setPosition(
    betControls.minusBtn.x + (betControls.plusBtn.x + betControls.plusBtn.width - betControls.minusBtn.x) / 2 - 20,
    yPos - 28
  );

  // Position LINE group
  lineControls.minusBtn.setPosition(betControls.plusBtn.x + betControls.plusBtn.width + groupSpacing, yPos);
  lineControls.valueText.setPosition(lineControls.minusBtn.x + lineControls.minusBtn.width + spacing + STYLE.valueBox.fixedWidth / 2, yPos);
  lineControls.plusBtn.setPosition(lineControls.valueText.x + STYLE.valueBox.fixedWidth / 2 + spacing, yPos);
  lineControls.label.setPosition(
    lineControls.minusBtn.x + (lineControls.plusBtn.x + lineControls.plusBtn.width - lineControls.minusBtn.x) / 2 - 30,
    yPos - 28
  );

  // Position SPIN button
  spinButton.setPosition(lineControls.plusBtn.x + lineControls.plusBtn.width + groupSpacing, yPos);
}


function update() {
  // Optional: could add spinning blur or glow
}

function spinReels(finalSymbolsPerReel, onCompleteAll) {
  const MAX_SPEED = 30;
  const MIN_SPEED = 8 ;

  let completedReels = 0;

  this.reels.forEach((reel, colIndex) => {
    // Random steps for this reel (how many symbol moves)
    const totalSteps = Phaser.Math.Between(15, 25) + 3;
    const finalSymbols = finalSymbolsPerReel[colIndex]
    let stepsDone = 0;
    const finalShift = Phaser.Utils.Array.GetRandom([0, 1])
    const spinInterval = this.time.addEvent({
      delay: 16, // ~60fps
      callback: () => {
        // Optional easing of speed near the end
        // Calculate fraction left based on steps
        const stepsLeft = totalSteps - stepsDone - 1 ;
        const t = Phaser.Math.Clamp(stepsLeft / totalSteps, 0, 1);
        const SPIN_SPEED = Phaser.Math.Linear(MIN_SPEED, MAX_SPEED, t);

        for (let i = 0; i < reel.length; i++) {
          reel[i].y += SPIN_SPEED;
          const boundary = baseY + ROW_COUNT * reelSpacingY
          if (reel[i].y >= boundary + reelSpacingY/3 ) {
            const out_boundary = reel[i].y - boundary
            reel[i].y = baseY - reelSpacingY + out_boundary
            if (stepsLeft >= finalShift && stepsLeft < 3 + finalShift){
              const newKey = finalSymbols[stepsLeft - finalShift]
              reel[i].setTexture(newKey);
            } else {
              const newKey = Phaser.Utils.Array.GetRandom(symbols);
              reel[i].setTexture(newKey);
            }
            stepsDone++;
          }
        }

        if (stepsDone >= totalSteps) {
          spinInterval.remove();

          // Snap symbols to grid and hide overflow
          // Sort visible symbols by y ascending
          reel.sort((a, b) => a.y - b.y);
          const duration = 600
          reel.forEach((symbol, idx) => {
            let targetY;
            if (finalShift == 0 ){
              targetY = baseY + (idx) * reelSpacingY;
            } else {
              targetY = baseY + (idx - 1) * reelSpacingY;
            }
            this.tweens.add({
              targets: symbol,
              y: targetY,
              ease: 'Quad.easeOut',
              duration: duration,
              onComplete: () => {
                // After snapping, do a scale "pop" animation
                /*
                this.tweens.add({
                  targets: symbol,
                  y: targetY - 10,
                  yoyo: true,
                  ease: 'Quad.easeOut',
                  duration: 150
                });
                */
              }
            });
          });
          completedReels++;
          if (completedReels === this.reels.length && onCompleteAll) {
            onCompleteAll();
          }
        }
      },
      loop: true
    });
  });
}