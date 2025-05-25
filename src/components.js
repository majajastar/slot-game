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
    constructor(scene, labelText, initialValue, useSymbol, onChange, minVal = 1, maxVal = 20) {
        this.scene = scene;
        this.useSymbol = useSymbol
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
        if (this.useSymbol){
            this.valueText.setText(`${this.scene.currencySymbol}${this.value}`);
        } else {
            this.valueText.setText(this.value);
        }
        
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
        const btn = this.scene.add.text(0, 0, label, STYLE.ADD_MINUS_BUTTON)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', function () {
                this.setScale(1.05);
            })
            .on('pointerout', function () {
                this.setScale(1.0);
            })
            .on('pointerdown', function () {
                if (this.scene.isSpinning) {
                    return;
                }
                if (this.scene.settings.sfxEnabled) {
                    this.scene.sound.play('coin');
                }
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

export class OptionsPopup {
    constructor(scene) {
        this.scene = scene;

        this.container = scene.add.container(LAYOUT.GAME_WIDTH / 2, LAYOUT.GAME_HEIGHT / 2.5);
        this.createPopup();

    }

    createPopup() {
        const width = LAYOUT.GAME_WIDTH * 0.3;
        const height = LAYOUT.GAME_HEIGHT * 0.3;
        const radius = 12 * SCALE;
        const closeButton = new CloseButton(this.scene, width, height, () => this.destroy());
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.75);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        this.container.add(bg);

        const title = this.scene.add.text(0, -height / 2 + 20 * SCALE, "Settings", STYLE.titleText).setOrigin(0.5);
        this.container.add(title);

        // Sound Effects Toggle
        this.sfxToggle = this.createToggle(0, -10 * SCALE, "Sound Effects", "sfxEnabled");

        // Music Toggle
        this.musicToggle = this.createToggle(0, 40 * SCALE, "Background Music", "musicEnabled");
        this.container.add(closeButton.container);
    }

    createToggle(x, y, labelText, settingKey) {
        const label = this.scene.add.text(x - 100 * SCALE, y, labelText, STYLE.label).setOrigin(0, 0.5);

        const toggle = this.scene.add.text(
            x + 100 * SCALE,
            y,
            this.scene.settings[settingKey] ? "ON" : "OFF",
            { ...STYLE.value }  // Clone to avoid mutation
        )
            .setOrigin(1, 0.5)
            .setInteractive({ useHandCursor: true });

        toggle.setColor(this.scene.settings[settingKey] ? COLORS.lightGreen : COLORS.lightRed);
        // Hover effect
        toggle.on('pointerover', () => {
            this.scene.tweens.add({
                targets: toggle,
                scale: 1.1,
                duration: 100,
                ease: 'Power1'
            });
        });

        toggle.on('pointerout', () => {
            this.scene.tweens.add({
                targets: toggle,
                scale: 1.0,
                duration: 100,
                ease: 'Power1'
            });
        });

        toggle.on('pointerdown', () => {
            this.scene.settings[settingKey] = !this.scene.settings[settingKey];
            const isEnabled = this.scene.settings[settingKey];

            toggle.setText(isEnabled ? "ON" : "OFF");
            toggle.setColor(isEnabled ? COLORS.lightGreen : COLORS.lightRed);

            // Control volume
            if (settingKey === "musicEnabled") {
                this.scene.sound.get('bgm')?.setMute(!this.scene.settings.musicEnabled);
            } else if (settingKey === "sfxEnabled") {
                this.scene.sound.get('click')?.setMute(!this.scene.settings.sfxEnabled);
                this.scene.sound.get('win')?.setMute(!this.scene.settings.sfxEnabled);
                this.scene.sound.get('coin')?.setMute(!this.scene.settings.sfxEnabled);
            }
        });

        this.container.add([label, toggle]);
        return toggle;
    }


    destroy() {
        this.container.destroy();
    }
}

export class CloseButton {
    constructor(scene, width, height, onClose) {
        this.scene = scene;
        this.radius = STYLE.BUTTON_CLOSE.radius;
        this.colors = STYLE.BUTTON_CLOSE.colors;
        this.textStyle = STYLE.BUTTON_CLOSE.text;
        this.shadow = STYLE.BUTTON_CLOSE.shadow;
        this.onClose = onClose;

        const closeX = width / 2 - this.radius;
        const closeY = -height / 2 + this.radius;

        this.container = scene.add.container(closeX, closeY);
        this.createButtonGraphics();
        this.setupInteractivity();
    }

    createButtonGraphics() {
        this.bg = this.scene.add.graphics();
        this.drawMetalCircle(this.colors.base);

        this.text = this.scene.add.text(0, 0, '✕', {
            fontSize: this.textStyle.fontSize,
            color: this.textStyle.color,
            fontFamily: this.textStyle.fontFamily,
            fontWeight: this.textStyle.fontWeight,
            stroke: '#222',
            strokeThickness: 2,
            shadow: {
                offsetX: this.shadow.offsetX,
                offsetY: this.shadow.offsetY,
                color: '#000',
                blur: this.shadow.blur,
                fill: true,
            }
        }).setOrigin(0.5);

        this.container.add([this.bg, this.text]);
    }

    drawMetalCircle(color) {
        this.bg.clear();
        this.bg.fillStyle(0x666666, 1);
        this.bg.fillCircle(0, 0, this.radius);
        this.bg.fillStyle(color, 1);
        this.bg.fillCircle(0, 0, this.radius * 0.85);
        this.bg.fillStyle(0xdddddd, 0.4);
        this.bg.fillCircle(-this.radius / 3, -this.radius / 3, this.radius / 4);
    }

    setupInteractivity() {
        this.bg.setInteractive(
            new Phaser.Geom.Circle(0, 0, this.radius),
            Phaser.Geom.Circle.Contains,
            { useHandCursor: true }
        );

        this.bg.on('pointerover', () => {
            this.drawMetalCircle(this.colors.hover);
            this.scene.tweens.add({
                targets: this.container,
                scale: 1.1,
                duration: 100,
                ease: 'Power1'
            });
        });

        this.bg.on('pointerout', () => {
            this.drawMetalCircle(this.colors.base);
            this.scene.tweens.add({
                targets: this.container,
                scale: 1,
                duration: 100,
                ease: 'Power1'
            });
        });

        this.bg.on('pointerdown', () => {
            if (this.scene.settings?.sfxEnabled) {
                this.scene.sound.play('click');
            }

            this.drawMetalCircle(this.colors.click);
            this.scene.tweens.add({
                targets: this.container,
                scale: 0.9,
                yoyo: true,
                duration: 100,
                ease: 'Power1',
                onComplete: () => {
                    this.drawMetalCircle(this.colors.base);
                    this.onClose?.();
                }
            });
        });
    }

    setPosition(x, y) {
        this.container.setPosition(x, y);
    }

    destroy() {
        this.container.destroy();
    }

    get displayObject() {
        return this.container;
    }
}

export class OptionsButon {
    constructor(scene, x, y, lineWidth = 14 * SCALE, lineHeight = 2 * SCALE, spacing = 6 * SCALE) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.lineWidth = lineWidth;
        this.lineHeight = lineHeight;
        this.spacing = spacing;
        this.circleRadius = 20 * SCALE;

        this.createIcon();
        this.addInteractivity();
    }

    createIcon() {
        const { scene, x, y, circleRadius } = this;

        // Draw icon graphics
        this.icon = scene.add.graphics({ x, y });

        const outerRadius = circleRadius;
        const innerRadius = circleRadius - 3 * SCALE;

        // Outer border (darker ocean)
        this.icon.fillStyle(STYLE.OCEAN_STYLE.outer.color, STYLE.OCEAN_STYLE.outer.alpha);
        this.icon.fillCircle(0, 0, outerRadius);

        // Inner fill (lighter ocean)
        this.icon.fillStyle(STYLE.OCEAN_STYLE.inner.color, STYLE.OCEAN_STYLE.inner.alpha);
        this.icon.fillCircle(0, 0, innerRadius);

        // Glossy highlight
        this.icon.fillStyle(STYLE.OCEAN_STYLE.highlight.color, STYLE.OCEAN_STYLE.highlight.alpha);
        this.icon.fillCircle(
            0,
            innerRadius * STYLE.OCEAN_STYLE.highlight.offsetYFactor,
            innerRadius * STYLE.OCEAN_STYLE.highlight.radiusFactor
        );

        // Draw menu lines
        this.icon.fillStyle(0xffffff, 1);
        for (let i = -1; i <= 1; i++) {
            this.icon.fillRect(
                -this.lineWidth / 2,
                i * this.spacing - this.lineHeight / 2,
                this.lineWidth,
                this.lineHeight
            );
        }

        // Add interactive zone
        this.interactiveZone = scene.add.zone(x, y, circleRadius * 2, circleRadius * 2).setInteractive();
        this.interactiveZone.setOrigin(0.5);
    }

    addInteractivity() {
        this.interactiveZone.on('pointerover', () => {
            this.scene.tweens.add({
                targets: [this.icon],
                scale: 1.1,
                duration: 150,
                ease: 'Quad.easeOut'
            });
        });

        this.interactiveZone.on('pointerout', () => {
            this.scene.tweens.add({
                targets: [this.icon],
                scale: 1.0,
                duration: 150,
                ease: 'Quad.easeOut'
            });
        });

        this.interactiveZone.on('pointerdown', () => {
            if (this.scene.isSpinning) return;

            if (!this.scene.settings) this.scene.settings = { sfxEnabled: true, musicEnabled: true };

            if (this.scene.settings.sfxEnabled) {
                this.scene.sound.play('click');
            }

            this.scene.tweens.add({
                targets: [this.icon],
                scale: 0.9,
                duration: 80,
                ease: 'Quad.easeIn',
                yoyo: true,
                onComplete: () => {
                    if (this.popupInstance) this.popupInstance.destroy();
                    this.popupInstance = new OptionsPopup(this.scene);
                }
            });
        });
    }


    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.icon.setPosition(x, y);
        this.interactiveZone.setPosition(x, y);
    }

    on(event, callback) {
        this.interactiveZone.on(event, callback);
    }

    destroy() {
        this.icon.destroy();
        this.interactiveZone.destroy();
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
            getSymbolName(5), getSymbolName(6), getSymbolName(7), getSymbolName(8), getSymbolName(9),]
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
            if (this.scene.isSpinning) {
                return;
            }
            if (this.scene.settings.sfxEnabled) {
                this.scene.sound.play('click');
            }            this.scene.tweens.add({
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