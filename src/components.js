import { STYLE } from './style.js';
import { SCALE, COLORS, LAYOUT } from './config.js';
import { PopupWindow } from './info.js'
import { WINNING_PATTERNS } from './line-button-manager.js'
import { getSymbolName } from './slot-machine.js'

const MUL5X = [1000, 777, 666, 555, 400, 300, 250, 200, 150, 100]
const MUL4X = [300, 200, 100, 80, 50, 30, 25, 20, 15, 10]
const MUL3X = [50, 30, 20, 10, 8, 6, 5, 4, 3, 2]

export class LoadingCard {
    constructor(scene, text = 'Loading...') {
        this.scene = scene;

        const cardWidth = 600 * SCALE;
        const cardHeight = 200 * SCALE;

        // Background card
        this.cardBg = scene.add.graphics();
        this.cardBg.fillStyle(0x000000, 0.6);
        this.cardBg.fillRoundedRect(
            scene.scale.width / 2 - cardWidth / 2,
            scene.scale.height / 2 - cardHeight / 2,
            cardWidth,
            cardHeight,
            20
        );

        // Text
        this.text = scene.add.text(
            scene.scale.width / 2,
            scene.scale.height / 2,
            text, STYLE.infoText
        ).setOrigin(0.5);
    }

    setText(newText) {
        this.text.setText(newText);
    }

    destroy() {
        this.cardBg.destroy();
        this.text.destroy();
    }
}

export class GameTitle {
    constructor(scene, x, y, title = "Spin Deluxe") {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.title = title;

        this.paddingX = 16 * SCALE;
        this.paddingY = 8 * SCALE;

        this.createTitle();
    }

    createTitle() {
        this.label = this.scene.add.text(0, 0, this.title, STYLE.titleText).setOrigin(0.5, 0.5);

        const bgWidth = this.label.width + this.paddingX * 2;
        const bgHeight = this.label.height + this.paddingY * 2;

        this.background = this.scene.add.graphics();
        this.background.fillGradientStyle(
            COLORS.gameTitleGradient.topLeft,
            COLORS.gameTitleGradient.topRight,
            COLORS.gameTitleGradient.bottomLeft,
            COLORS.gameTitleGradient.bottomRight,
            1
        );
        this.background.fillRoundedRect(
            this.x - bgWidth / 2,
            this.y - bgHeight / 2,
            bgWidth,
            bgHeight,
            12 * SCALE
        );

        this.label.setPosition(this.x, this.y);
        this.label.setDepth(10);
        this.background.setDepth(9);
    }

    setTitle(newTitle) {
        this.title = newTitle;
        this.label.setText(newTitle);

        // Recalculate background size
        const bgWidth = this.label.width + this.paddingX * 2;
        const bgHeight = this.label.height + this.paddingY * 2;

        this.background.clear();
        this.background.fillGradientStyle(
            COLORS.gameTitleGradient.topLeft,
            COLORS.gameTitleGradient.topRight,
            COLORS.gameTitleGradient.bottomLeft,
            COLORS.gameTitleGradient.bottomRight,
            1
        );
        this.background.fillRoundedRect(
            this.x - bgWidth / 2,
            this.y - bgHeight / 2,
            bgWidth,
            bgHeight,
            12 * SCALE
        );
    }

    destroy() {
        this.label.destroy();
        this.background.destroy();
    }
}

export class UserGameCard {
    constructor(scene, x, y, userId, gameId, balance) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.userId = userId;
        this.gameId = gameId;
        this.balance = balance;

        this.padding = 22 * SCALE;
        this.radius = 12 * SCALE;

        this.createCard();
    }

    createCard() {
        // Destroy previous label and background if they exist
        if (this.label) {
            this.label.destroy();
            this.label = null;
        }
        if (this.background) {
            this.background.destroy();
            this.background = null;
        }
        const textContent = `👤 ${this.userId}\n🎮 ${this.gameId}\n💰 ${this.scene.currencySymbol}${this.balance}`;
        this.label = this.scene.add.text(0, 0, textContent, STYLE.userInfoText);

        const bounds = this.label.getBounds();
        const cardWidth = bounds.width;
        const cardHeight = bounds.height + this.padding * 2;

        this.background = this.scene.add.graphics();
        this.background.fillGradientStyle(
            COLORS.userCard.topLeft,
            COLORS.userCard.topRight,
            COLORS.userCard.bottomLeft,
            COLORS.userCard.bottomRight,
            1
        );
        this.background.fillRoundedRect(
            this.x - cardWidth,
            this.y,
            cardWidth,
            cardHeight,
            this.radius
        );

        this.label.setPosition(this.x - cardWidth, this.y + this.padding);
        this.label.setDepth(10);
        this.background.setDepth(9);
    }

    updateBalance(newBalance) {
        this.balance = newBalance;
        this.createCard()
    }

    updateUserId(userId) {
        this.userId = userId;
        this.createCard()
    }

    updateGameId(gameId) {
        this.gameId = gameId;
        this.createCard()
    }

    destroy() {
        this.label.destroy();
        this.background.destroy();
    }
}

export class DisplayField {
    constructor(scene, labelText, initialValue, valueStyle, labelStyle = STYLE.label) {
        this.scene = scene;

        this.label = scene.add.text(0, 0, labelText, labelStyle);
        this.value = initialValue;
        this.valueText = scene.add.text(0, 0, initialValue, valueStyle).setOrigin(0.5, 0);
    }

    setValue(value) {
        this.value = value;
    }

    updateUI() {
        this.valueText.setText(this.value);
    }

    getValue() {
        return this.valueText.text;
    }

    setLabel(newLabel) {
        this.label.setText(newLabel);
    }

    getLabel() {
        return this.label.text;
    }

    setPosition(x, y, spacing = 20) {
        this.label.setPosition(x, y);
        this.valueText.setPosition(x, y + spacing);
    }

    getElements() {
        return [this.label, this.valueText];
    }
}

export class Control {
    constructor(scene, labelText, initialValue, onChange, minVal = 1, maxVal = 20) {
        this.scene = scene;
        this.labelText = labelText;
        this.value = initialValue;
        this.onChange = onChange;
        this.minVal = minVal;
        this.maxVal = maxVal;
        this.lineButtonGroup = null;
        this.lineEffectTimer = null;

        this.label = scene.add.text(0, 0, labelText, STYLE.label);
        this.valueText = scene.add.text(0, 0, initialValue, STYLE.valueBox).setOrigin(0.5, 0);

        this.minusBtn = this.#createButton('-', this.decrease.bind(this));
        this.plusBtn = this.#createButton('+', this.increase.bind(this));
    }

    getValue() {
        return Number(this.value)
    }

    decrease() {
        if (this.scene.isSpinning) {
            return;
        }
        this.value = Math.max(this.minVal, this.value - 1);
        this.updateUI();
    }

    increase() {
        if (this.scene.isSpinning) {
            return;
        }
        this.value = Math.min(this.maxVal, this.value + 1);
        this.updateUI();
    }

    updateUI() {
        this.valueText.setText(this.value);
        this.onChange(this.value);
        this.updateLineButton();
    }

    updateText(val) {
        this.value = Number(val);
        this.valueText.setText(this.value);
        this.updateUI();
    }

    setLineButtonGroup(group) {
        this.lineButtonGroup = group;
    }

    updateLineButton() {
        if (!this.lineButtonGroup) return;

        for (let i = 1; i <= 20; i++) {
            const button = this.lineButtonGroup[i];
            button.clickEffect(i <= this.value);

            // Clear any previous timer on each button
            if (button._lineEffectTimer) {
                button.cancelLineEffect();
                button._lineEffectTimer.remove();
                button._lineEffectTimer = null;
            }

            if (i === this.value) {
                button.lineEffect();

                // Store timer on the button itself
                button._lineEffectTimer = this.scene.time.delayedCall(1000, () => {
                    button.cancelLineEffect();
                    button._lineEffectTimer = null;
                });
            }
        }
    }

    // 🔒 Private helper method to create a button
    #createButton(label, onClick) {
        const btn = this.scene.add.text(0, 0, label, STYLE.button)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', function () {
                this.setScale(1.05);
            })
            .on('pointerout', function () {
                this.setScale(1.0);
            })
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
        return btn;
    }
}

export class InfoButton {
    constructor(scene, x, y, radius = 20 * SCALE, winningPatterns = WINNING_PATTERNS) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.radius = radius;

        this.graphics = scene.add.graphics({ x, y });
        this.label = scene.add.text(x, y + 1, 'i', STYLE.iconText).setOrigin(0.5);
        this.label.setShadow(1, 1, '#000', 2, true, true);

        this.drawButton();

        this.interactiveZone = scene.add.zone(x, y, radius * 2, radius * 2)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        this.addInteractivity();
        this.winningPatterns = winningPatterns;
        this.mul5x = MUL5X;
        this.mul4x = MUL4X;
        this.mul3x = MUL3X;
        this.symbols = [
            getSymbolName(0), getSymbolName(1), getSymbolName(2), getSymbolName(3), getSymbolName(4), 
            getSymbolName(5),getSymbolName(6), getSymbolName(7), getSymbolName(8), getSymbolName(9), ]
    }

    updateInfoContent(winningPatterns, multipliers) {
        this.winningPatterns = winningPatterns;
        this.mul5x = multipliers[0];
        this.mul4x = multipliers[1];
        this.mul3x = multipliers[2];
    }

    drawButton() {
        const outerRadius = this.radius;
        const innerRadius = this.radius - 3 * SCALE;
        const style = STYLE.OCEAN_STYLE;

        this.graphics.clear();
        this.graphics.fillStyle(style.outer.color, style.outer.alpha);
        this.graphics.fillCircle(0, 0, outerRadius);

        this.graphics.fillStyle(style.inner.color, style.inner.alpha);
        this.graphics.fillCircle(0, 0, innerRadius);

        this.graphics.fillStyle(style.highlight.color, style.highlight.alpha);
        this.graphics.fillCircle(
            0,
            innerRadius * style.highlight.offsetYFactor,
            innerRadius * style.highlight.radiusFactor
        );
    }

    addInteractivity() {
        this.interactiveZone.on('pointerover', () => {
            this.scene.tweens.add({
                targets: [this.graphics, this.label],
                scale: 1.1,
                duration: 150,
                ease: 'Quad.easeOut'
            });
        });

        this.interactiveZone.on('pointerout', () => {
            this.scene.tweens.add({
                targets: [this.graphics, this.label],
                scale: 1.0,
                duration: 150,
                ease: 'Quad.easeOut'
            });
        });

        this.interactiveZone.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: [this.graphics, this.label],
                scale: 0.9,
                duration: 80,
                ease: 'Quad.easeIn',
                yoyo: true,
                onComplete: () => {
                    this.showPopup();
                }
            });
        });
    }

    showPopup() {
        if (!this.scene._infoPopup) {
            this.scene._infoPopup = new PopupWindow(this.scene, LAYOUT.POP_WIDTH, LAYOUT.POP_HEIGHT, this.winningPatterns, this.mul5x, this.mul4x, this.mul3x, this.symbols);
        }
    }
}