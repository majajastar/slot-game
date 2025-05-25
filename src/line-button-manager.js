import { REEL_CONFIG, LAYOUT, SCALE } from './config.js';
import { STYLE } from './style.js'

const lineButtonLeft = [4, 2, 8, 10, 6, 1, 7, 9, 3, 5]
const lineButtonRight = [14, 20, 12, 18, 16, 11, 17, 13, 15, 19]
export const WINNING_PATTERNS = {
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

export class LineButtonsManager {
    constructor(scene, lineControls) {
        this.scene = scene;
        this.lineControls = lineControls;

        this.radius = 16 * SCALE;

        // Cache for symbol coordinates and layout signature
        this._cachedSymbolCoordinates = null;
        this._cachedLayoutSignature = null;

        // Store buttons by their line number
        this.lineButtonGroup = {};

        // To track all active winning lines drawn on hover
        this.activeWinningLines = [];

        // Create all buttons on init
        this.createLineButtons();
        lineControls.setLineButtonGroup(this.lineButtonGroup)
        this.winningPatterns = WINNING_PATTERNS
    }

    updateWinningPatterns(winningPatterns) {
        this.winningPatterns = winningPatterns
    }

    // Calculate and cache symbol coordinates based on layout
    calculateSymbolCoordinates() {
        const layoutSignature = JSON.stringify({
            BASE_Y: LAYOUT.BASE_Y,
            spacingX: LAYOUT.REEL_SPACING_X,
            spacingY: LAYOUT.REEL_SPACING_Y,
            symbolSize: LAYOUT.SYMBOL_SIZE,
        });

        if (this._cachedSymbolCoordinates && this._cachedLayoutSignature === layoutSignature) {
            return this._cachedSymbolCoordinates;
        }

        const coordinates = [];
        const BASE_X = LAYOUT.GAME_WIDTH / 2 - LAYOUT.REEL_SPACING_X * 2;

        for (let col = 0; col < REEL_CONFIG.REEL_COUNT; col++) {
            const column = [];
            for (let row = 0; row < REEL_CONFIG.ROW_COUNT; row++) {
                const x = BASE_X + col * LAYOUT.REEL_SPACING_X;
                const y = LAYOUT.BASE_Y + row * LAYOUT.REEL_SPACING_Y;
                column.push({ x, y });
            }
            coordinates.push(column);
        }

        this._cachedSymbolCoordinates = coordinates;
        this._cachedLayoutSignature = layoutSignature;

        return coordinates;
    }

    // Draw a line connecting an array of points on the scene with optional style
    drawLineThroughPoints(points, style = {}) {
        if (!points || points.length !== 5) {
            console.error("drawLineThroughPoints requires exactly 5 points");
            return null;
        }

        const graphics = this.scene.add.graphics();

        const {
            lineWidth = 2,
            strokeColor = 0xffffff,
            alpha = 1,
        } = style;

        graphics.lineStyle(lineWidth, strokeColor, alpha);

        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graphics.lineTo(points[i].x, points[i].y);
        }
        graphics.strokePath();

        return graphics;
    }

    // Draw the winning line given 5 index pairs [col, row]
    drawWinningLine(indexPairs, style) {
        if (!Array.isArray(indexPairs) || indexPairs.length !== 5) {
            console.error("You must provide exactly 5 index pairs.");
            return null;
        }

        const coordinatesGrid = this.calculateSymbolCoordinates();

        const points = indexPairs.map(([col, row]) => {
            if (
                col < 0 ||
                col >= coordinatesGrid.length ||
                row < 0 ||
                row >= coordinatesGrid[col].length
            ) {
                console.error(`Invalid index pair: (${col}, ${row})`);
                return { x: 0, y: 0 };
            }
            return coordinatesGrid[col][row];
        });

        return this.drawLineThroughPoints(points, style);
    }

    // Create a single line button with interactivity and effects
    createLineButton(x, y, num) {
        const g = this.scene.add.graphics({ x, y });

        const outerRadius = this.radius;
        const innerRadius = outerRadius - 3 * SCALE;

        // Styles constants (replace with your actual styles)
        const OCEAN_STYLE = STYLE.OCEAN_STYLE;
        const OCEAN_STYLE_CLICKED = STYLE.OCEAN_STYLE_CLICKED;

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

        let isClicked = false;

        const hoverEffect = () => {
            g.setScale(1.25);
            text.setScale(1.25);
        };

        const noEffect = () => {
            g.setScale(1);
            text.setScale(1);
        };

        const clickEffect = (clicked) => {
            isClicked = clicked;
            if (clicked) {
                drawButton(OCEAN_STYLE_CLICKED);
                g.setScale(1.1);
                text.setScale(1.1);
            } else {
                drawButton(OCEAN_STYLE);
                g.setScale(1);
                text.setScale(1);
            }
        };

        // Track drawn winning lines on hover for this button
        const winningLineGroup = [];

        const lineEffect = () => {
            for (let i = 1; i <= num; i++) {
                const winningIndexes = [];
                for (let col = 0; col < 5; col++) {
                    winningIndexes.push([col, this.winningPatterns[i][col]]);
                }
                const line = this.drawWinningLine(winningIndexes, STYLE.LINE_COLOR_HOVER_LIST[i - 1]);
                if (line) winningLineGroup.push(line);
            }
        };

        const singleLineEffect = () => {
            const winningIndexes = [];
            for (let col = 0; col < 5; col++) {
                winningIndexes.push([col, this.winningPatterns[num][col]]);
            }
            const line = this.drawWinningLine(winningIndexes, STYLE.LINE_COLOR_HOVER_LIST[num - 1]);
            if (line) winningLineGroup.push(line);
        };

        const cancelLineEffect = () => {
            winningLineGroup.forEach(line => line.destroy());
            winningLineGroup.length = 0;
        };

        drawButton(OCEAN_STYLE);

        const text = this.scene.add.text(x, y + 1, num.toString(), STYLE.iconText).setOrigin(0.5);
        text.setShadow(1, 1, '#000', 2, true, true);

        const zone = this.scene.add.zone(x, y, outerRadius * 2, outerRadius * 2).setOrigin(0.5).setInteractive();

        return {
            bg: g,
            label: text,
            interactiveZone: zone,
            isClicked: () => isClicked,
            drawButton,
            hoverEffect,
            noEffect,
            clickEffect,
            lineEffect,
            singleLineEffect,
            cancelLineEffect,
            num,
        };
    }

    // Create all buttons and assign interaction handlers
    createLineButtons() {
        const screenWidth = this.scene.cameras.main.width;

        const icon_xL = screenWidth / 2 - LAYOUT.REEL_SPACING_X * 2.5 - this.radius - 5;
        const icon_xR = screenWidth / 2 + LAYOUT.REEL_SPACING_X * 2.5 + this.radius + 5;

        const height = LAYOUT.REEL_SPACING_Y * 3;
        const spacing = (height - this.radius * 2 * 10) / 9;
        const iconBaseY = LAYOUT.BASE_Y - LAYOUT.SYMBOL_SIZE / 2 + this.radius;

        for (let i = 0; i < 10; i++) {
            const numL = lineButtonLeft[i];
            const numR = lineButtonRight[i];
            const icon_y = iconBaseY + (this.radius * 2 + spacing) * i;

            const lineButtonL = this.createLineButton(icon_xL, icon_y, numL);
            const lineButtonR = this.createLineButton(icon_xR, icon_y, numR);

            this.lineButtonGroup[numL] = lineButtonL;
            this.lineButtonGroup[numR] = lineButtonR;
        }

        this.setupInteractions();
    }

    // Setup pointer event handlers for buttons
    setupInteractions() {
        for (const key in this.lineButtonGroup) {
            if (!this.lineButtonGroup.hasOwnProperty(key)) continue;

            const button = this.lineButtonGroup[key];
            const zone = button.interactiveZone;
            const keyNum = parseInt(key);

            zone.on('pointerover', () => {
                if (this.scene.isSpinning) {
                    return;
                }
                this.clearAllLineEffects();
                this.applyHoverEffects(keyNum);
                button.lineEffect();
            });

            zone.on('pointerout', () => {
                if (this.scene.isSpinning) {
                    return;
                }
                this.removeHoverEffects(keyNum);
                button.cancelLineEffect();
            });

            zone.on('pointerdown', () => {
                if (this.scene.isSpinning) {
                    return;
                }
                if (this.scene.settings.sfxEnabled) {
                    this.scene.sound.play('click');
                }
                this.setClickedButtons(keyNum);
                this.lineControls.updateText(keyNum);
                this.scene.updateTotalBetValue();
            });
        }
    }

    // Clear all line effects on all buttons
    clearAllLineEffects() {
        for (let i = 1; i <= 20; i++) {
            const btn = this.lineButtonGroup[i];
            if (btn) btn.cancelLineEffect();
        }
    }

    // Apply hover effect to buttons from 1 to key
    applyHoverEffects(key) {
        for (let i = 1; i <= key; i++) {
            const btn = this.lineButtonGroup[i];
            if (btn) btn.hoverEffect();
        }
    }

    // Remove hover effect from buttons 1 to key
    removeHoverEffects(key) {
        for (let i = 1; i <= key; i++) {
            const btn = this.lineButtonGroup[i];
            if (btn) btn.noEffect();
        }
    }

    // Set clicked state on buttons: clicked if i <= key, else unclicked
    setClickedButtons(key) {
        for (let i = 1; i <= 20; i++) {
            const btn = this.lineButtonGroup[i];
            if (!btn) continue;
            btn.clickEffect(i <= key);
        }
    }
}