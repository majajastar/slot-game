import { REEL_CONFIG, LAYOUT, SCALE, COLORS } from './config.js';
import { STYLE } from './style.js';

export function getSymbolName(idx) {
  return `symbol${idx}`
}

export class SlotMachine {
  constructor(scene, symbols) {
    this.scene = scene;
    this.reels = [];
    this.isSpinning = false;
    this.symbols = symbols
    this.mask = this.createMask();
    this.createReels();
    this.spinButton = this.createSpinButton();

  }

  createMask() {
    const BASE_X = LAYOUT.GAME_WIDTH / 2 - LAYOUT.REEL_SPACING_X * 2;
    const maskShape = this.scene.make.graphics();
    const maskX = BASE_X - LAYOUT.SYMBOL_SIZE / 2;
    const maskY = LAYOUT.BASE_Y - LAYOUT.SYMBOL_SIZE / 2;
    const maskWidth = REEL_CONFIG.REEL_COUNT * LAYOUT.REEL_SPACING_X + LAYOUT.SYMBOL_SIZE / 2;
    const maskHeight = REEL_CONFIG.ROW_COUNT * LAYOUT.REEL_SPACING_Y;

    maskShape.fillRect(maskX, maskY, maskWidth, maskHeight);
    return maskShape.createGeometryMask();
  }

  createReels() {
    const BASE_X = LAYOUT.GAME_WIDTH / 2 - LAYOUT.REEL_SPACING_X * 2;

    for (let col = 0; col < REEL_CONFIG.REEL_COUNT; col++) {
      const bgWidth = LAYOUT.REEL_SPACING_X - 10;
      const bgX = BASE_X + col * LAYOUT.REEL_SPACING_X - bgWidth / 2;
      const bgY = LAYOUT.BASE_Y - LAYOUT.SYMBOL_SIZE / 2;
      const bgHeight = REEL_CONFIG.ROW_COUNT * LAYOUT.REEL_SPACING_Y;
      const cornerRad = 16 * SCALE;
      const borderTh = 8 * SCALE;

      // Border
      const border = this.scene.add.graphics();
      border.fillGradientStyle(
        COLORS.wooden.topLeft, COLORS.wooden.topRight,
        COLORS.wooden.bottomLeft, COLORS.wooden.bottomRight, 1
      );
      border.fillRoundedRect(
        bgX - borderTh / 2, bgY - borderTh / 2,
        bgWidth + borderTh, bgHeight + borderTh,
        cornerRad + borderTh / 2
      );

      // Background
      const reelBg = this.scene.add.graphics();
      reelBg.fillGradientStyle(
        COLORS.glass.topLeft, COLORS.glass.topRight,
        COLORS.glass.bottomLeft, COLORS.glass.bottomRight, 1
      );
      reelBg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, cornerRad);

      // Symbols
      const reel = [];
      for (let i = 0; i < REEL_CONFIG.ROW_COUNT + 1; i++) {
        const x = BASE_X + col * LAYOUT.REEL_SPACING_X;
        const y = LAYOUT.BASE_Y + (i - 1) * LAYOUT.REEL_SPACING_Y;
        const key = Phaser.Utils.Array.GetRandom(this.symbols);

        const symbol = this.scene.add.image(x, y, key)
          .setDisplaySize(LAYOUT.SYMBOL_SIZE, LAYOUT.SYMBOL_SIZE)
          .setMask(this.mask);

        reel.push(symbol);
      }

      this.reels.push(reel);
    }
  }

  spin(finalSymbols, matchDetails, onComplete) {
    const MAX_SPEED = 50;
    const MIN_SPEED = 8;
    // reel by reel
    const winSymbols = [
      [false, false, false],
      [false, false, false],
      [false, false, false],
      [false, false, false],
      [false, false, false]
    ];
    const winLines = []
    for (const detail of matchDetails) {
      detail.pattern.forEach((row, col) => {
        if (finalSymbols[row][col] == getSymbolName(detail.symbol)) {
          winSymbols[col][row] = true;
        }
      });
      winLines.push(detail.line);
    }

    const finalShiftArray = Array.from({ length: 5 }, () => Phaser.Utils.Array.GetRandom([0, 1]));
    let completedReels = 0;
    const finalSymbolsInReels = []
    for (let col = 0; col < 5; col++) {
      const column = finalSymbols.map(row => row[col]);
      finalSymbolsInReels.push(column);
    }
    this.reels.forEach((reel, colIndex) => {
      const totalSteps = Phaser.Math.Between(REEL_CONFIG.MIN_STEP, REEL_CONFIG.MAX_STEP) + 3;
      const finalShift = finalShiftArray[colIndex];
      const finalSymbolsInReel = finalSymbolsInReels[colIndex];
      let stepsDone = 0;

      const spinInterval = this.scene.time.addEvent({
        delay: REEL_CONFIG.SYMOBL_UPDATE_DELAY,
        callback: () => {
          const stepsLeft = totalSteps - stepsDone - 1;
          const t = Phaser.Math.Clamp(stepsLeft / totalSteps, 0, 1);
          const SPIN_SPEED = Phaser.Math.Linear(MIN_SPEED, MAX_SPEED, t);

          for (let i = 0; i < reel.length; i++) {
            reel[i].y += SPIN_SPEED;
            const boundary = LAYOUT.BASE_Y + REEL_CONFIG.ROW_COUNT * LAYOUT.REEL_SPACING_Y;
            if (reel[i].y >= boundary + LAYOUT.REEL_SPACING_Y / 3) {
              const out_boundary = reel[i].y - boundary;
              reel[i].y = LAYOUT.BASE_Y - LAYOUT.REEL_SPACING_Y + out_boundary;
              const latestSymbolIdx = stepsLeft - finalShift;
              if (latestSymbolIdx >= 0 && latestSymbolIdx < 3) {
                const newKey = finalSymbolsInReel[latestSymbolIdx];
                reel[i].setTexture(newKey);
              } else {
                const newKey = Phaser.Utils.Array.GetRandom(this.symbols);
                reel[i].setTexture(newKey);
              }
              stepsDone++;
            }
          }

          if (stepsDone >= totalSteps) {
            spinInterval.remove();
            reel.sort((a, b) => a.y - b.y);

            const duration = 600;
            let completedSymbols = 0;

            reel.forEach((symbol, idx) => {
              const targetY = finalShift === 0
                ? LAYOUT.BASE_Y + idx * LAYOUT.REEL_SPACING_Y
                : LAYOUT.BASE_Y + (idx - 1) * LAYOUT.REEL_SPACING_Y;

              this.scene.tweens.add({
                targets: symbol,
                y: targetY,
                ease: 'Quad.easeOut',
                duration,
                onComplete: () => {
                  completedSymbols++;
                  if (completedSymbols === reel.length) {
                    completedReels++;
                    if (completedReels === this.reels.length) {
                      setTimeout(() => {
                        this.isSpinning = false;
                        this.scene.isSpinning = false;
                      }, 350);
                      this.scene.updateWinDisplay()
                      this.highlightWins(finalShiftArray, winSymbols, winLines, onComplete);
                      //if (onComplete) onComplete();
                    }
                  }
                }
              });
            });
          }
        },
        loop: true
      });
    });
  }

  highlightWins(finalShiftArray, winSymbols, winLines, onCompleteCallcack) {
    let callbackTriggered = false;
    for (const line of winLines) {
      this.scene.lineButtonsManager.lineButtonGroup[line].singleLineEffect();
    }

    this.scene.time.delayedCall(REEL_CONFIG.HIGH_LIGHT_TIME * 2, () => {
      for (const line of winLines) {
        this.scene.lineButtonsManager.lineButtonGroup[line].cancelLineEffect();
      }
    });
    for (let col = 0; col < this.reels.length; col++) {
      const shift = finalShiftArray[col];
      for (let row = 0; row < 3; row++) {
        if (!winSymbols[col][row]) continue;
        const symbol = this.reels[col][row + shift];
        // Apply a tint to highlight the symbol
        symbol.setTint(0xffff66);
        this.scene.tweens.add({
          targets: symbol,
          scaleX: symbol.scaleX * 1.3,
          scaleY: symbol.scaleY * 1.3,
          duration: REEL_CONFIG.HIGH_LIGHT_TIME,
          yoyo: true,
          repeat: 2,
          ease: 'Quad.easeInOut',
          onComplete: () => {
            symbol.clearTint();
            if (!callbackTriggered) {
            if (this.scene.settings.sfxEnabled) {
                this.scene.sound.play('win');
            }
              callbackTriggered = true;
              setTimeout(() => {
                onCompleteCallcack();
              }, REEL_CONFIG.CALLBACK_DELAY);
            }
          }
        });
      }
    }
  }

  createSpinButton() {
    const BASE_X = LAYOUT.GAME_WIDTH / 2 - LAYOUT.REEL_SPACING_X * 2;
    const container = this.scene.add.container(0, 0);
    const reelsBottom = LAYOUT.BASE_Y + REEL_CONFIG.ROW_COUNT * LAYOUT.REEL_SPACING_Y;
    const w = 120 * SCALE;
    const h = 60 * SCALE;
    const radius = 12 * SCALE;

    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(
      COLORS.spinButtonBg.topLeft, COLORS.spinButtonBg.topRight,
      COLORS.spinButtonBg.bottomLeft, COLORS.spinButtonBg.bottomRight, 1
    );
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);

    const label = this.scene.add.text(0, 0, 'SPIN', STYLE.spinButton).setOrigin(0.5);
    container.add([bg, label]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.setPosition(BASE_X + 2 * LAYOUT.REEL_SPACING_X, reelsBottom + 30 * SCALE);
    container.setDepth(1);

    container
      .on('pointerover', () => {
        this.scene.tweens.add({ targets: container, scale: 1.05, duration: 150, ease: 'Quad.easeOut' });
      })
      .on('pointerout', () => {
        this.scene.tweens.add({ targets: container, scale: 1.0, duration: 150, ease: 'Quad.easeOut' });
      })
      .on('pointerdown', () => {
        if (this.isSpinning) return;
        if (this.scene.settings.sfxEnabled) {
          this.scene.sound.play('click');
        }
        this.isSpinning = true;
        this.scene.isSpinning = true;
        this.scene.sendSpinRequest()
        this.scene.tweens.add({
          targets: container,
          scale: 0.9,
          duration: 80,
          ease: 'Quad.easeIn',
          yoyo: true,
          onComplete: () => {
          }
        });
      });

    return container;
  }


  getWinSymbols(patterns) {
    const winSymbols = Array.from({ length: 5 }, () => [false, false, false]);
    for (const line in patterns) {
      patterns[line].forEach((rowIndex, colIndex) => {
        winSymbols[colIndex][rowIndex] = true;
      });
    }
    return winSymbols;
  }

  destroy() {
    // Destroy spin button and its children
    if (this.spinButton) {
      this.spinButton.list.forEach(child => child.destroy());
      this.spinButton.destroy();
    }

    // Destroy each symbol and reel graphics
    this.reels.forEach(reel => {
      reel.forEach(symbol => symbol.destroy());
    });

    // Clear reel array
    this.reels = [];

    // Destroy the mask graphics (Phaser mask has no destroy, but base graphics does)
    if (this.mask && this.mask.geometryMask) {
      this.mask.geometryMask.destroy();
    }

    // Remove reference to the scene
    this.scene = null;
  }
}