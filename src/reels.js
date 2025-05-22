import { REEL_COUNT, ROW_COUNT, symbols, LAYOUT, SCALE, GAME_WIDTH, COLORS} from './config.js';
import { STYLE } from './style.js';


function createMask() {
  const baseX = GAME_WIDTH/2 - LAYOUT.reelSpacingX * 2
  const maskShape = this.make.graphics();
  const maskX = baseX - LAYOUT.SYMBOL_SIZE / 2;
  const maskY = LAYOUT.baseY - LAYOUT.SYMBOL_SIZE / 2;
  const maskWidth = REEL_COUNT * LAYOUT.reelSpacingX + LAYOUT.SYMBOL_SIZE / 2;
  const maskHeight = ROW_COUNT * LAYOUT.reelSpacingY;

  maskShape.fillRect(maskX, maskY, maskWidth, maskHeight);
  return maskShape.createGeometryMask();
}

function createReels(mask) {
  const baseX = GAME_WIDTH/2 - LAYOUT.reelSpacingX * 2
  for (let col = 0; col < REEL_COUNT; col++) {
    const bgWidth   = LAYOUT.reelSpacingX - 10;
    const bgX       = baseX + col * LAYOUT.reelSpacingX - bgWidth / 2;
    const bgY       = LAYOUT.baseY - LAYOUT.SYMBOL_SIZE / 2;
    const bgHeight  = ROW_COUNT * LAYOUT.reelSpacingY;
    const cornerRad = 16 * SCALE;
    const borderTh  = 8 * SCALE;

    // 1) Outer “border” rounded‐rect with gradient
    const border = this.add.graphics();
    border.fillGradientStyle(
      COLORS.wooden.topLeft,
      COLORS.wooden.topRight,
      COLORS.wooden.bottomLeft,
      COLORS.wooden.bottomRight,
      1
    );
    border.fillRoundedRect(
      bgX - borderTh/2,
      bgY - borderTh/2,
      bgWidth  + borderTh,
      bgHeight + borderTh,
      cornerRad + borderTh/2
    );

    // 2) Inner reel background (solid or gradient)
    const reelBg = this.add.graphics();
    reelBg.fillGradientStyle(
      COLORS.glass.topLeft,
      COLORS.glass.topRight,
      COLORS.glass.bottomLeft,
      COLORS.glass.bottomRight,
      1
    );
    reelBg.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, cornerRad);

    // 3) Masked symbols on top
    const reel = [];
    for (let i = 0; i < ROW_COUNT + 1; i++) {
      const x   = baseX + col * LAYOUT.reelSpacingX;
      const y   = LAYOUT.baseY + (i - 1) * LAYOUT.reelSpacingY;
      const key = Phaser.Utils.Array.GetRandom(symbols);

      const symbol = this.add.image(x, y, key)
        .setDisplaySize(LAYOUT.SYMBOL_SIZE, LAYOUT.SYMBOL_SIZE)
        .setMask(mask);

      reel.push(symbol);
    }
    this.reels.push(reel);
  }
}

export function setupReelsWithMask(scene) {
  const mask = createMask.call(scene);
  createReels.call(scene, mask);
}

function spinReels(finalSymbolsPerReel, onCompleteAll) {
  const MAX_SPEED = 50;
  const MIN_SPEED = 8;

  let completedReels = 0;

  this.reels.forEach((reel, colIndex) => {
    const totalSteps = Phaser.Math.Between(15, 30) + 3;
    const finalSymbols = finalSymbolsPerReel[colIndex];
    let stepsDone = 0;
    const finalShift = Phaser.Utils.Array.GetRandom([0, 1]);
    const spinInterval = this.time.addEvent({
      delay: 16, // ~60fps
      callback: () => {
        const stepsLeft = totalSteps - stepsDone - 1;
        const t = Phaser.Math.Clamp(stepsLeft / totalSteps, 0, 1);
        const SPIN_SPEED = Phaser.Math.Linear(MIN_SPEED, MAX_SPEED, t);

        for (let i = 0; i < reel.length; i++) {
          reel[i].y += SPIN_SPEED;
          const boundary = LAYOUT.baseY + ROW_COUNT * LAYOUT.reelSpacingY;
          if (reel[i].y >= boundary + LAYOUT.reelSpacingY / 3) {
            const out_boundary = reel[i].y - boundary;
            reel[i].y = LAYOUT.baseY - LAYOUT.reelSpacingY + out_boundary;
            if (stepsLeft >= finalShift && stepsLeft < 3 + finalShift) {
              const newKey = finalSymbols[stepsLeft - finalShift];
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
              targetY = LAYOUT.baseY + (idx) * LAYOUT.reelSpacingY;
            } else {
              targetY = LAYOUT.baseY + (idx - 1) * LAYOUT.reelSpacingY;
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

export function createSpinButton(finalSymbolsPerReel) {
  const scene = this;
  const baseX = GAME_WIDTH/2 - LAYOUT.reelSpacingX * 2
  // 1) Create a container to hold bg + text
  const container = scene.add.container(0, 0);
  const reelsBottom = LAYOUT.baseY + ROW_COUNT * LAYOUT.reelSpacingY;
  // 2) Draw a rounded‐corner gradient background
  const w = 120 * SCALE;   // or pull from text width + padding
  const h = 60  * SCALE;
  const radius = 12 * SCALE;

  const bg = scene.add.graphics();
  bg.fillGradientStyle(
    COLORS.spinButtonBg.topLeft,
    COLORS.spinButtonBg.topRight,
    COLORS.spinButtonBg.bottomLeft,
    COLORS.spinButtonBg.bottomRight,
    1
  );
  bg.fillRoundedRect(-w/2, -h/2, w, h, radius);

  // 3) Create the text label
  const label = scene.add.text(0, 0, 'SPIN', STYLE.spinButton)
  .setOrigin(0.5);

  // 4) Put them together
  container.add([ bg, label ]);
  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true }); // automatic bounds
  container.setPosition(
    baseX + 2 * LAYOUT.reelSpacingX, 
    reelsBottom + 30 * SCALE
  );
  container.setDepth(1);

  // 5) Hover & click effects
  container
    .on('pointerover', () => {
      scene.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    })
    .on('pointerout', () => {
      scene.tweens.add({
        targets: container,
        scale: 1.0,
        duration: 150,
        ease: 'Quad.easeOut'
      });
    })
    .on('pointerdown', () => {
      if (scene.isSpinning) return;
      scene.isSpinning = true;

      // click pop
      scene.tweens.add({
        targets: container,
        scale: 0.9,
        duration: 80,
        ease: 'Quad.easeIn',
        yoyo: true,
        onComplete: () => {
          spinReels.call(scene, finalSymbolsPerReel, () => {
            scene.isSpinning = false;
          });
        }
      });
    });

  return container;
}