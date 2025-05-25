import { SCALE, COLORS } from './config.js';
import { STYLE, FONT } from './style.js'
import { CloseButton } from './components.js'

function createTitleBar(scene, width, height, title = '-- PAY TABLE --') {
    const titleBarHeight = 40 * SCALE;
    const titleCornerRadius = 10 * SCALE;

    // Title background bar with gradient and rounded top corners
    const titleBg = scene.add.graphics();
    titleBg.fillGradientStyle(
        COLORS.wooden.topLeft,
        COLORS.wooden.topRight,
        COLORS.wooden.bottomLeft,
        COLORS.wooden.bottomRight,
        1
    );
    titleBg.fillRoundedRect(
        -width / 2,
        -height / 2,
        width,
        titleBarHeight,
        { tl: titleCornerRadius, tr: titleCornerRadius, bl: 0, br: 0 }
    );

    // Title text centered vertically and horizontally inside the bar
    const titleText = scene.add.text(0, -height / 2 + titleBarHeight / 2, title, STYLE.titleText).setOrigin(0.5);

    return { titleBg, titleText };
}

export class PopupWindow {
    constructor(scene, width = 800, height = 600, winningPatterns, mul5x, mul4x, mul3x, symbols) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.currentPage = 0;
        this.contentContainer = null;

        this.initPopupLayer();
        this.createPopupElements(winningPatterns, mul5x, mul4x, mul3x, symbols)
        this.updatePage();
    }

    initPopupLayer() {
        if (!this.scene.popupLayer) {
            this.scene.popupLayer = this.scene.add.container(0, 0);
            this.scene.popupLayer.setDepth(1000); // Top layer
        }

        this.popupContainer = this.scene.add.container(this.scene.cameras.main.centerX, this.scene.cameras.main.centerY);

        this.inputBlocker = this.scene.add.rectangle(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000,
            0
        ).setInteractive();

        this.scene.popupLayer.add([this.inputBlocker, this.popupContainer]);
    }

    createPopupElements(winningPatterns, mul5x, mul4x, mul3x, symbols) {
        const { width, height, scene } = this;

        // Background
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.85);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 20 * SCALE);

        // Title
        const { titleBg, titleText } = createTitleBar(scene, width, height, '-- PAY TABLE --');

        // Close
        const closeButton = new CloseButton(scene, width, height, () => this.destroy());

        // Page text fallback
        this.contentText = scene.add.text(0, 0, '', {
            fontSize: '20px',
            color: '#ffffff',
            wordWrap: { width: width - 100 * SCALE },
            align: 'center'
        }).setOrigin(0.5);

        // Page content methods
        this.pageContentFns = [
            (s, w, h) => getPage1Content(s, w, h, winningPatterns),
            (s, w, h) => getPage2Content(s, w, h, mul5x, mul4x, mul3x, symbols),
            (s, w, h) => getPage3Content(s, w, h),
        ];

        // Buttons
        this.prevButton = this.createNavButton('Prev Page', () => this.prevPage());
        this.nextButton = this.createNavButton('Next Page', () => this.nextPage());

        this.popupContainer.add([bg, titleBg, titleText, closeButton.container, this.contentText, this.prevButton, this.nextButton]);
    }

    createNavButton(text, callback) {
        const button = this.scene.add.text(0, this.height / 2 - 40 * SCALE, text, STYLE.BUTTON_INFO)
            .setOrigin(0.5)
            .setInteractive();

        button.on('pointerover', () => button.setScale(1.1));
        button.on('pointerout', () => button.setScale(1));
        button.on('pointerdown', () => button.setScale(0.95));
        button.on('pointerup', () => {
            button.setScale(1);
            callback();
        });

        return button;
    }

    updatePage() {
        if (this.contentContainer) {
            this.contentContainer.destroy();
            this.contentContainer = null;
        }

        const result = this.pageContentFns[this.currentPage](this.scene, this.width, this.height);

        if (typeof result === 'string') {
            this.contentText.setText(result);
            this.contentText.setVisible(true);
        } else {
            this.contentText.setVisible(false);
            this.contentContainer = result;
            this.popupContainer.add(this.contentContainer);
        }

        this.updateNavButtons();
    }

    updateNavButtons() {
        const totalPages = this.pageContentFns.length;
        const y = this.height / 2 - 40;

        if (this.currentPage === 0) {
            this.prevButton.setVisible(false);
            this.nextButton.setVisible(true).setPosition(0, y);
        } else if (this.currentPage === totalPages - 1) {
            this.prevButton.setVisible(true).setPosition(0, y);
            this.nextButton.setVisible(false);
        } else {
            this.prevButton.setVisible(true).setPosition(-100, y);
            this.nextButton.setVisible(true).setPosition(100, y);
        }
    }

    nextPage() {
        if (this.currentPage < this.pageContentFns.length - 1) {
            this.currentPage++;
            this.updatePage();
        }
    }

    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.updatePage();
        }
    }

    destroy() {
        this.popupContainer.destroy();
        this.inputBlocker.destroy();
        this.scene._infoPopup = null;
    }
}


export function createCard(scene, x, y, label, highlightRows = [-1, -1, -1, -1, -1], scale = 1) {
    const { width, height, cornerRadius, borderColor, borderWidth, grid } = STYLE.INFO_CARD_STYLE;
    const card = scene.add.graphics();
    const cardWidth = width * scale;
    const cardHeight = height * scale;
    const radius = cornerRadius * scale;
    const bWidth = borderWidth * scale;
    card.fillGradientStyle(COLORS.wooden.topLeft, COLORS.wooden.topRight, COLORS.wooden.bottomLeft, COLORS.wooden.bottomRight, 1);
    card.fillRoundedRect(0, 0, cardWidth, cardHeight, radius);
    card.lineStyle(bWidth, borderColor);
    card.strokeRoundedRect(0, 0, cardWidth, cardHeight, cornerRadius);
    card.setPosition(x, y);

    // Label text at top center (add some padding)
    const labelY = 2 * SCALE * scale; // 18 px from top, adjust as needed
    const cardText = scene.add.text(x + cardWidth / 2, y + labelY, label, {
        fontSize: `${16 * SCALE * scale}px`,
        fontFamily: FONT,
        fill: COLORS.buttonText,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2 * SCALE * scale,
        padding: { x: 10 * SCALE * scale, y: 0 * SCALE * scale },
        align: 'center'
    }).setOrigin(0.5, 0); // origin 0.5 horizontally, 0 vertically (top align)

    const { cols, rows, paddingX, squareBorderColor, squareBorderWidth, squareHighlightColor, squareMarginFactor, squareScaleFactor } = grid;
    const spacingY = 20 * SCALE * scale
    // Adjust grid height to leave space for label on top
    const gridWidth = cardWidth - 2 * paddingX;
    const gridHeight = cardHeight - labelY - spacingY; // subtract label height + some margin

    const squareSizeX = gridWidth / cols * squareScaleFactor;
    const squareSizeY = gridHeight / rows * squareScaleFactor;

    const offsetX = paddingX + (gridWidth - (squareSizeX * cols)) / 2;
    const offsetY = labelY + spacingY + (gridHeight - (squareSizeY * rows)) / 2; // offset grid below label

    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const sqX = offsetX + col * squareSizeX;
            const sqY = offsetY + row * squareSizeY;

            const isHighlighted = (row === highlightRows[col]);
            card.fillStyle(isHighlighted ? squareHighlightColor : grid.squareBaseColor, 1);
            card.fillRect(sqX, sqY, squareSizeX * squareMarginFactor, squareSizeY * squareMarginFactor);

            card.lineStyle(squareBorderWidth, squareBorderColor);
            card.strokeRect(sqX, sqY, squareSizeX * squareMarginFactor, squareSizeY * squareMarginFactor);
        }
    }
    return { card, cardText };
}

function createSubtitle(scene, text, height, ystart) {
    return scene.add.text(0, -height / 2 + ystart, text, STYLE.subTitleText).setOrigin(0.5, 0);
}


function getPage1Content(scene, width, height, winningPatterns) {
    const container = scene.add.container(0, 0);
    const yStart = 70 * SCALE;
    const subtitle = createSubtitle(scene, 'Winning Line Patterns', height, yStart);
    container.add(subtitle);

    const cardWidth = STYLE.INFO_CARD_STYLE.width;
    const cardHeight = STYLE.INFO_CARD_STYLE.height;
    const cols = 5;
    const rows = 4;
    const spacingX = Math.floor((width - cols * cardWidth) / (cols + 1));
    const spacingY = Math.floor((height - rows * cardHeight) / (rows + 1)) - 30 * SCALE;
    const marginY = 120 * SCALE;

    for (let i = 0; i < 20; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const x = col * (cardWidth + spacingX) - width / 2 + spacingX;
        const y = marginY + row * (cardHeight + spacingY) - height / 2;
        const label = `LINE ${i + 1}`;

        const highlightPattern = winningPatterns[i + 1];
        const { card, cardText } = createCard(scene, x, y, label, highlightPattern);
        container.add([card, cardText]);
    }

    return container;
}


function createSymbolCard(scene, x, y, symbolUrl, lines) {
    const { width, height, borderColor, borderWidth, cornerRadius } = STYLE.SYMBOL_CARD_STYLE
    const padding = 15 * SCALE;
    const imageSize = height - padding * 2;
    const cardWidth = width;
    const cardHeight = height;
    // Card background
    const card = scene.add.graphics();
    card.fillGradientStyle(COLORS.wooden.topLeft, COLORS.wooden.topRight, COLORS.wooden.bottomLeft, COLORS.wooden.bottomRight, 1);
    card.fillRoundedRect(0, 0, cardWidth, cardHeight, cornerRadius);
    card.lineStyle(borderWidth, borderColor);
    card.strokeRoundedRect(0, 0, cardWidth, cardHeight, cornerRadius);
    card.setPosition(x, y);

    // Symbol image
    const image = scene.add.image(x + imageSize / 2, y + height / 2, symbolUrl);
    image.setDisplaySize(imageSize, imageSize);

    // Text lines (max 4)
    const textContainer = scene.add.container();
    const lineHeight = 18 * SCALE;
    const totalHeight = lines.length * lineHeight;
    const startY = y + height / 2 - totalHeight / 2;

    lines.forEach((line, index) => {
        const text = scene.add.text(
            x + imageSize + padding / 2,
            startY + index * lineHeight,
            line,
            STYLE.cardText
        ).setOrigin(0, 0.5);
        textContainer.add(text);
    });

    return {
        card,
        image,
        texts: textContainer.getAll(),
        container: scene.add.container(0, 0, [card, image, ...textContainer.getAll()])
    };
}

function getPage2Content(scene, width, height, mul5x, mul4x, mul3x, symbols) {
    const container = scene.add.container(0, 0);
    const yStart = 70 * SCALE;
    const subtitle = createSubtitle(scene, 'Symbol Payouts', height, yStart);
    container.add(subtitle);

    const cardWidth = STYLE.SYMBOL_CARD_STYLE.width;
    const cardHeight = STYLE.SYMBOL_CARD_STYLE.height;
    const rows = [3, 3, 4]; // Updated layout: 3 cards, 3 cards, 4 cards
    const marginY = 50 * SCALE;
    const spacingY = 30 * SCALE;

    let yOffset = -height / 2 + marginY + 80 * SCALE;

    let cardIndex = 0;
    for (let r = 0; r < rows.length; r++) {
        const cols = rows[r];
        const spacingX = (width - cols * cardWidth) / (cols + 1);

        for (let c = 0; c < cols; c++) {
            const x = spacingX + c * (cardWidth + spacingX) - width / 2;
            const y = yOffset;
            const texts = []
            texts.push(`5x: ${mul5x[cardIndex]}x`)
            texts.push(`4x: ${mul4x[cardIndex]}x`)
            texts.push(`3x: ${mul3x[cardIndex]}x`)
            const symbolCard = createSymbolCard(scene, x, y, symbols[cardIndex], texts);
            container.add(symbolCard.container);

            cardIndex++;
        }

        yOffset += cardHeight + spacingY;
    }

    return container;
}

function getPage3Content(scene, width, height) {
    const container = scene.add.container(0, 0);
    const yStart = 70 * SCALE;
    const subtitle = createSubtitle(scene, 'Rules', height, yStart);
    container.add(subtitle);

    const cardWidth = width * 0.85;
    const cardPadding = 20 * SCALE;
    const sectionSpacing = 40 * SCALE;
    const cardCornerRadius = 16 * SCALE;
    const startY = -height / 2 + yStart + sectionSpacing;

    function createTextCard(y, title, content) {
        const card = scene.add.graphics();
        const textWidth = cardWidth - cardPadding * 2;

        // Text positioned relative to card's top-left
        const text = scene.add.text(
            -cardWidth / 2 + cardPadding, // left padding inside container
            0,                           // y=0 inside container; container will be positioned at y
            `${title}\n\n${content}`,
            {
                ...STYLE.cardText,
                wordWrap: { width: textWidth },
                align: 'left'
            }
        ).setOrigin(0, 0);

        const cardHeight = text.height + cardPadding * 2;

        // Draw card background starting at top-left (relative to container)
        card.fillGradientStyle(COLORS.wooden.topLeft, COLORS.wooden.topRight, COLORS.wooden.bottomLeft, COLORS.wooden.bottomRight, 1);
        card.fillRoundedRect(-cardWidth / 2, 0, cardWidth, cardHeight, cardCornerRadius);
        card.lineStyle(2, 8);
        card.strokeRoundedRect(-cardWidth / 2, 0, cardWidth, cardHeight, cardCornerRadius);

        // Container positioned so card top-left aligns at y
        const cardContainer = scene.add.container(0, y, [card, text]);

        return { container: cardContainer, height: cardHeight + sectionSpacing };
    }

    const aboutText = `This slot game features multiple paylines, engaging symbols, and big win potential. It is designed for quick play sessions with intuitive controls.\n\nThe game features up to 20 paylines. You can bet on a maximum of 20 lines per spin, allowing flexible betting strategies to maximize your chances of winning.`;
    const about = createTextCard(startY, 'About the Game', aboutText);
    const howToPlay = createTextCard(startY + about.height, 'How to Play', '1. Choose your bet amount.\n2. Press the spin button to start.\n3. Match symbols on active paylines to win.\n4. Check the paytable for payout values.\n\nGood luck!');

    container.add([about.container, howToPlay.container]);

    return container;
}