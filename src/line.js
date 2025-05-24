import { ROW_COUNT, REEL_COUNT, LAYOUT, SCALE, GAME_WIDTH } from './config.js';
import { STYLE } from './style.js'

let _cachedSymbolCoordinates = null;
let _cachedLayoutSignature = null;

const lineButtonLeft = [4, 2, 8, 10, 6, 1, 7, 9, 3, 5]
const lineButtonRight = [14, 20, 12, 18, 16, 11, 17, 13, 15, 19]
export const winningPatterns = {
    1: [1, 1, 1, 1, 1],
    2: [0, 0, 0, 0, 0],
    3: [2, 2, 2, 2, 2],
    4: [0, 1, 2, 1, 0],
    5: [2, 1, 0, 1, 2],
    6: [1, 0, 1, 0, 1],
    7: [1, 2, 1, 2, 1],
    8: [0, 0, 1, 2, 2],
    9: [2, 2, 1, 0, 0],
    10: [1, 2, 1, 0, 1],
    11: [1, 0, 1, 2, 1],
    12: [0, 1, 1, 1, 0],
    13: [2, 1, 1, 1, 2],
    14: [0, 1, 0, 1, 0],
    15: [2, 1, 2, 1, 2],
    16: [1, 1, 0, 1, 1],
    17: [1, 1, 2, 1, 1],
    18: [0, 0, 2, 0, 0],
    19: [2, 2, 0, 2, 2],
    20: [0, 2, 2, 2, 0],
}

function calculateSymbolCoordinates() {
    // Create a simple "signature" of the current layout
    const layoutSignature = JSON.stringify({
        baseY: LAYOUT.baseY,
        spacingX: LAYOUT.reelSpacingX,
        spacingY: LAYOUT.reelSpacingY,
        symbolSize: LAYOUT.SYMBOL_SIZE
    });

    // Use cache if layout hasn't changed
    if (_cachedSymbolCoordinates && _cachedLayoutSignature === layoutSignature) {
        return _cachedSymbolCoordinates;
    }

    // Layout changed → recalculate
    const coordinates = [];
    const baseX = GAME_WIDTH / 2 - LAYOUT.reelSpacingX * 2;

    for (let col = 0; col < REEL_COUNT; col++) {
        const column = [];
        for (let row = 0; row < ROW_COUNT; row++) {
            const x = baseX + col * LAYOUT.reelSpacingX;
            const y = LAYOUT.baseY + row * LAYOUT.reelSpacingY;
            column.push({ x, y });
        }
        coordinates.push(column);
    }

    // Cache the result and signature
    _cachedSymbolCoordinates = coordinates;
    _cachedLayoutSignature = layoutSignature;

    return coordinates;
}

export function drawLineThroughPoints(scene, points, style) {
    if (!scene || !points || points.length !== 5) {
        console.error(`Scene and exactly 5 points are required, points = ${JSON.stringify(points)}, points.length = ${points.length}`);
        return;
    }

    const graphics = scene.add.graphics();

    // Apply style if provided
    if (style) {
        const { lineWidth = 2, strokeColor = 0xffffff, alpha = 1 } = style;
        graphics.lineStyle(lineWidth, strokeColor, alpha);
    } else {
        graphics.lineStyle(2, 0xffffff, 1); // default style
    }

    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
    }

    graphics.strokePath();

    return graphics;
}


export function drawWinningLine(scene, indexPairs, style) {
    // Validate input
    if (!Array.isArray(indexPairs) || indexPairs.length !== 5) {
        console.error("You must provide exactly 5 (i, j) index pairs.");
        return;
    }

    const coordinatesGrid = calculateSymbolCoordinates(); // 5x3 grid

    // Map (i, j) indices to coordinates
    const points = indexPairs.map(([i, j]) => {
        if (
            i < 0 || i >= coordinatesGrid.length ||
            j < 0 || j >= coordinatesGrid[i].length
        ) {
            console.error(`Invalid index pair: (${i}, ${j})`);
            return { x: 0, y: 0 }; // fallback coordinate
        }
        return coordinatesGrid[i][j];
    });

    // Draw line through the selected points
    return drawLineThroughPoints(scene, points, style);
}

export function createLineButton(scene, x, y, num = 0, radius = 20 * SCALE) {
    const g = scene.add.graphics({ x, y });

    const outerRadius = radius;
    const innerRadius = radius - 3 * SCALE;

    const drawButton = (style) => {
        g.clear();
        g.fillStyle(style.outer.color, style.outer.alpha);
        g.fillCircle(0, 0, outerRadius);

        g.fillStyle(style.inner.color, style.inner.alpha);
        g.fillCircle(0, 0, innerRadius);

        g.fillStyle(style.highlight.color, style.highlight.alpha);
        g.fillCircle(
            0,
            innerRadius * style.highlight.offsetYFactor,
            innerRadius * style.highlight.radiusFactor
        );
    };

    const hoverEffect = () => {
        g.setScale(1.25);
        text.setScale(1.25);
    };

    const noEffect = () => {
        g.setScale(1);
        text.setScale(1);
    };

    let isClicked = false;
    const clickEffect = (clicked) => {
        if (clicked) {
            isClicked = true;
            drawButton(STYLE.OCEAN_STYLE_CLICKED); // clicked style
            g.setScale(1.1);
            text.setScale(1.1);
        } else {
            isClicked = false;
            drawButton(STYLE.OCEAN_STYLE); // clicked style
            g.setScale(1);
            text.setScale(1);
        }
    };

    const winningLineGroup = []
    const lineEffect = () => {
        for (let i = 1; i <= num; i++) {
            const winningIndexes = []
            for (let j = 0; j < 5; j++) {
                winningIndexes.push([j, winningPatterns[i][j]])
            }
            const winningLine = drawWinningLine(scene, winningIndexes, STYLE.LINE_COLOR_HOVER_LIST[i-1]); // `this` is the Phaser scene
            winningLineGroup.push(winningLine);
        }
    }
    const cancelLineEffect = () => {
        for (const line of winningLineGroup) {
            line.destroy();
        }
        winningLineGroup.length = 0; // Clear the array
    }

    // Initial draw with unclicked style

    drawButton(STYLE.OCEAN_STYLE); // default unclicked

    // Add label
    const text = scene.add.text(x, y + 1, num.toString(), STYLE.iconText).setOrigin(0.5);
    text.setShadow(1, 1, '#000', 2, true, true);

    // Interactive zone
    const zone = scene.add.zone(x, y, radius * 2, radius * 2).setOrigin(0.5).setInteractive();


    return {
        bg: g,
        label: text,
        interactiveZone: zone,
        winningLineGroup: winningLineGroup,
        isClicked: () => isClicked,
        drawButton: drawButton,
        hoverEffect: hoverEffect,
        noEffect: noEffect,
        clickEffect: clickEffect,
        lineEffect: lineEffect,
        cancelLineEffect: cancelLineEffect

    };
}

export function createLineButtonGroup(scene, lineControls) {
    const screenWidth = scene.cameras.main.width;
    const radius = 16 * SCALE
    const icon_xL = screenWidth / 2 - LAYOUT.reelSpacingX * (2.5) - radius - 5
    const icon_xR = screenWidth / 2 + LAYOUT.reelSpacingX * (2.5) + radius + 5
    const lineButtonGroup = {}
    for (let i = 0; i < 10; i++) {
        const numL = lineButtonLeft[i]
        const numR = lineButtonRight[i]
        const height = LAYOUT.reelSpacingY * 3
        const spacing = (height - radius * 2 * 10) / 9
        const icon_y = LAYOUT.baseY - LAYOUT.SYMBOL_SIZE / 2 + radius + (radius * 2 + spacing) * i;
        const lineButtonL = createLineButton(scene, icon_xL, icon_y, numL, radius)
        const lineButtonR = createLineButton(scene, icon_xR, icon_y, numR, radius)
        lineButtonGroup[numL] = lineButtonL
        lineButtonGroup[numR] = lineButtonR
    }

    for (const key in lineButtonGroup) {
        if (lineButtonGroup.hasOwnProperty(key)) {
            const button = lineButtonGroup[key];
            const zone = button.interactiveZone;
            zone.on('pointerover', () => {
                for (let i = 1; i <= 20; i++) {
                    const button2 = lineButtonGroup[i];
                    button2.cancelLineEffect()
                }
                for (let i = 1; i <= key; i++) {
                    const button2 = lineButtonGroup[i];
                    button2.hoverEffect()
                }
                button.lineEffect()
            });

            // Reset scale on pointer out
            zone.on('pointerout', () => {
                for (let i = 1; i <= key; i++) {
                    const button2 = lineButtonGroup[i];
                    button2.noEffect()
                }
                button.cancelLineEffect()
            });

            // Click to toggle state and update style
            zone.on('pointerdown', () => {
                for (let i = 1; i <= 20; i++) {
                    const button = lineButtonGroup[i]
                    if (i <= key) {
                        button.clickEffect(true);
                    } else {
                        button.clickEffect(false);
                    }
                }
                lineControls.updateText(key);
            });

        }
    }

    return lineButtonGroup

}
