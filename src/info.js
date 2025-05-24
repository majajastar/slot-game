import { SCALE, LAYOUT, COLORS } from './config.js';
import { STYLE } from './style.js'
import { winningPatterns } from './line.js'


export function createInfoButtons(scene) {

    const radius = 20 * SCALE;
    const icon_x = 40 * SCALE
    const icon_y = 40 * SCALE
    const info = createInfoIcon(scene, icon_x, icon_y, radius);

}

function createInfoIcon(scene, x, y, radius = 20 * SCALE) {
    const g = scene.add.graphics({ x, y });
    const outerRadius = radius;
    const innerRadius = radius - 3 * SCALE;

    // Ocean styling
    g.fillStyle(STYLE.OCEAN_STYLE.outer.color, STYLE.OCEAN_STYLE.outer.alpha);
    g.fillCircle(0, 0, outerRadius);
    g.fillStyle(STYLE.OCEAN_STYLE.inner.color, STYLE.OCEAN_STYLE.inner.alpha);
    g.fillCircle(0, 0, innerRadius);
    g.fillStyle(STYLE.OCEAN_STYLE.highlight.color, STYLE.OCEAN_STYLE.highlight.alpha);
    g.fillCircle(
        0,
        innerRadius * STYLE.OCEAN_STYLE.highlight.offsetYFactor,
        innerRadius * STYLE.OCEAN_STYLE.highlight.radiusFactor
    );

    // Info label
    const text = scene.add.text(x, y + 1, 'i', STYLE.iconText).setOrigin(0.5);
    text.setShadow(1, 1, '#000', 2, true, true);

    // Interactive zone
    const zone = scene.add.zone(x, y, radius * 2, radius * 2).setInteractive({ useHandCursor: true }).setOrigin(0.5);

    // Hover scale
    zone.on('pointerover', () => {
        scene.tweens.add({ targets: [g, text], scale: 1.1, duration: 150, ease: 'Quad.easeOut' });
    });
    zone.on('pointerout', () => {
        scene.tweens.add({ targets: [g, text], scale: 1.0, duration: 150, ease: 'Quad.easeOut' });
    });

    // Click = pop + show popup
    zone.on('pointerdown', () => {
        scene.tweens.add({
            targets: [g, text],
            scale: 0.9,
            duration: 80,
            ease: 'Quad.easeIn',
            yoyo: true,
            onComplete: () => {
                if (!scene._infoPopup) {
                    scene._infoPopup = createPopupWindow(scene, LAYOUT.POP_WIDTH, LAYOUT.POP_HEIGHT);
                }
            }
        });
    });

    return { bg: g, label: text, interactiveZone: zone };
}

function createOptionsIcon(scene, x, y, lineWidth = 14 * SCALE, lineHeight = 2 * SCALE, spacing = 6 * SCALE) {
    const g = scene.add.graphics({ x, y });

    const circleRadius = 20 * SCALE;

    // Ocean color gradient simulation (manual layer approach)
    const outerRadius = circleRadius;
    const innerRadius = circleRadius - 3 * SCALE;
    // Outer border (darker ocean)
    g.fillStyle(STYLE.OCEAN_STYLE.outer.color, STYLE.OCEAN_STYLE.outer.alpha);
    g.fillCircle(0, 0, outerRadius);

    // Inner fill (lighter ocean)
    g.fillStyle(STYLE.OCEAN_STYLE.inner.color, STYLE.OCEAN_STYLE.inner.alpha);
    g.fillCircle(0, 0, innerRadius);

    // Optional glossy top highlight
    g.fillStyle(STYLE.OCEAN_STYLE.highlight.color, STYLE.OCEAN_STYLE.highlight.alpha);
    g.fillCircle(
        0,
        innerRadius * STYLE.OCEAN_STYLE.highlight.offsetYFactor,
        innerRadius * STYLE.OCEAN_STYLE.highlight.radiusFactor
    );

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


function createTitleBar(scene, width, height, title = '-- PAY TABLE --') {
    const titleBarHeight = 50;
    const titleCornerRadius = 12;

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

function createCloseButton(scene, width, height, onClose) {
    const { radius, colors, text, shadow } = STYLE.BUTTON_CLOSE;
    const closeX = width / 2 - radius - 10;
    const closeY = -height / 2 + radius + 10;

    // Create container for grouping but container itself not interactive
    const container = scene.add.container(closeX, closeY);

    const closeBg = scene.add.graphics();

    function drawMetalCircle(color) {
        closeBg.clear();
        closeBg.fillStyle(0x666666, 1);
        closeBg.fillCircle(0, 0, radius);
        closeBg.fillStyle(color, 1);
        closeBg.fillCircle(0, 0, radius * 0.85);
        closeBg.fillStyle(0xdddddd, 0.4);
        closeBg.fillCircle(-radius / 3, -radius / 3, radius / 4);
    }

    drawMetalCircle(colors.base);

    const closeText = scene.add.text(0, 0, '✕', {
        fontSize: text.fontSize,
        color: text.color,
        fontFamily: text.fontFamily,
        fontWeight: text.fontWeight,
        stroke: '#222',
        strokeThickness: 2,
        shadow: {
            offsetX: shadow.offsetX,
            offsetY: shadow.offsetY,
            color: '#000',
            blur: shadow.blur,
            fill: true,
        }
    }).setOrigin(0.5);

    container.add([closeBg, closeText]);

    // Make closeBg interactive with circular hit area
    closeBg.setInteractive(
        new Phaser.Geom.Circle(0, 0, radius),
        Phaser.Geom.Circle.Contains,
        { useHandCursor: true }
    );

    // Now use closeBg as interactive target for events

    closeBg.on('pointerover', () => {
        drawMetalCircle(colors.hover);
        scene.tweens.add({
            targets: container,
            scale: 1.1,
            duration: 100,
            ease: 'Power1'
        });
    });

    closeBg.on('pointerout', () => {
        drawMetalCircle(colors.base);
        scene.tweens.add({
            targets: container,
            scale: 1,
            duration: 100,
            ease: 'Power1'
        });
    });

    closeBg.on('pointerdown', () => {
        drawMetalCircle(colors.click);
        scene.tweens.add({
            targets: container,
            scale: 0.9,
            yoyo: true,
            duration: 100,
            ease: 'Power1',
            onComplete: () => {
                drawMetalCircle(colors.base);
                onClose?.();
            }
        });
    });

    return container;
}

function createPopupWindow(scene, width = 800, height = 600) {
    if (!scene.popupLayer) {
        scene.popupLayer = scene.add.container(0, 0);
        scene.popupLayer.setDepth(1000); // Top layer
    }

    const popupContainer = scene.add.container(scene.cameras.main.centerX, scene.cameras.main.centerY);
    // Full-screen transparent input blocker to disable background interactions
    const inputBlocker = scene.add.rectangle(
        scene.cameras.main.centerX,
        scene.cameras.main.centerY,
        scene.cameras.main.width,
        scene.cameras.main.height,
        0x000000,
        0
    ).setInteractive();
    // Popup background
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 20);

    // Text fallback container (hidden if using custom container content)
    const contentText = scene.add.text(0, 0, '', {
        fontSize: '20px',
        color: '#ffffff',
        wordWrap: { width: width - 100 * SCALE },
        align: 'center'
    }).setOrigin(0.5);

    scene.popupLayer.add(inputBlocker);
    scene.popupLayer.add(popupContainer);

    const { titleBg, titleText } = createTitleBar(scene, width, height, '-- PAY TABLE --');
    const closeButton = createCloseButton(scene, width, height, () => {
        // Your close callback here
        popupContainer.destroy();
        inputBlocker.destroy();
        scene._infoPopup = null;
    });


    const nextButton = scene.add.text(0, height / 2 - 40 * SCALE, 'Next Page', STYLE.BUTTON_INFO).setOrigin(0.5).setInteractive();
    const prevButton = scene.add.text(0, height / 2 - 40 * SCALE, 'Prev Page', STYLE.BUTTON_INFO).setOrigin(0.5).setInteractive();

    [nextButton, prevButton].forEach(btn => {
        btn.on('pointerover', () => {
            btn.setScale(1.1); // Pop in slightly
        });

        btn.on('pointerout', () => {
            btn.setScale(1); // Reset scale
        });

        btn.on('pointerdown', () => {
            btn.setScale(0.95); // Pop in slightly
        });

        btn.on('pointerup', () => {
            btn.setScale(1); // Restore scale
        });
    });

    // Page content containers support
    let currentContentContainer = null;
    let currentPage = 0;

    // Page content functions
    const contentFunctions = [
        (scene, w, h) => getPage1Content(scene, w, h),
        (scene, w, h) => getPage2Content(scene, w, h),
        (scene, w, h) => getPage3Content(scene, w, h)
    ];

    nextButton.on('pointerdown', () => {
        if (currentPage < contentFunctions.length - 1) {
            currentPage++;
            updatePage();
        }
    });

    prevButton.on('pointerdown', () => {
        if (currentPage > 0) {
            currentPage--;
            updatePage();
        }
    });

    // Add popup base elements
    popupContainer.add([bg, titleBg, titleText, closeButton, contentText, nextButton, prevButton]);
    function updatePage() {
        // Clear previous content container if any
        if (currentContentContainer) {
            currentContentContainer.destroy();
            currentContentContainer = null;
        }

        // Get new content for current page
        const result = contentFunctions[currentPage](scene, width, height);

        if (typeof result === 'string') {
            contentText.setText(result);
            contentText.setVisible(true);
        } else {
            contentText.setVisible(false);
            currentContentContainer = result;
            popupContainer.add(currentContentContainer);
        }

        // Update buttons visibility and position
        if (currentPage === 0) {
            // Only Next button centered
            nextButton.setVisible(true);
            nextButton.setPosition(0, height / 2 - 40);

            prevButton.setVisible(false);
        } else if (currentPage === contentFunctions.length - 1) {
            // Only Prev button centered
            prevButton.setVisible(true);
            prevButton.setPosition(0, height / 2 - 40);

            nextButton.setVisible(false);
        } else {
            // Both buttons visible on left/right
            prevButton.setVisible(true);
            prevButton.setPosition(-100, height / 2 - 40);

            nextButton.setVisible(true);
            nextButton.setPosition(100, height / 2 - 40);
        }
    }
    // Show first page
    updatePage();

    return popupContainer;
}


function createCard(scene, x, y, label, highlightRows = [-1, -1, -1, -1, -1]) {
    const { width, height, cornerRadius, borderColor, borderWidth, grid } = STYLE.INFO_CARD_STYLE;
    const card = scene.add.graphics();
    const cardWidth = width * SCALE;
    const cardHeight = height * SCALE;
    const radius = cornerRadius * SCALE
    const bWidth = borderWidth * SCALE
    card.fillGradientStyle(COLORS.wooden.topLeft, COLORS.wooden.topRight, COLORS.wooden.bottomLeft, COLORS.wooden.bottomRight, 1);
    card.fillRoundedRect(0, 0, cardWidth, cardHeight, radius);
    card.lineStyle(bWidth, borderColor);
    card.strokeRoundedRect(0, 0, cardWidth, cardHeight, cornerRadius);
    card.setPosition(x, y);

    // Label text at top center (add some padding)
    const labelY = 5; // 18 px from top, adjust as needed
    const cardText = scene.add.text(x + cardWidth / 2, y + labelY, label, STYLE.infoText).setOrigin(0.5, 0); // origin 0.5 horizontally, 0 vertically (top align)

    const { cols, rows, paddingX, squareBorderColor, squareBorderWidth, squareHighlightColor, squareMarginFactor, squareScaleFactor } = grid;

    // Adjust grid height to leave space for label on top
    const gridWidth = cardWidth - 2 * paddingX;
    const gridHeight = cardHeight - labelY - 20; // subtract label height + some margin

    const squareSizeX = gridWidth / cols * squareScaleFactor;
    const squareSizeY = gridHeight / rows * squareScaleFactor;

    const offsetX = paddingX + (gridWidth - (squareSizeX * cols)) / 2;
    const offsetY = labelY + 20 + (gridHeight - (squareSizeY * rows)) / 2; // offset grid below label

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


function getPage1Content(scene, width, height) {
    const container = scene.add.container(0, 0);
    const yStart = 70 * SCALE;
    const subtitle = createSubtitle(scene, 'Winning Line Patterns', height, yStart);
    container.add(subtitle);

    const cardWidth = STYLE.INFO_CARD_STYLE.width;
    const cardHeight = STYLE.INFO_CARD_STYLE.height;
    const cols = 5;
    const rows = 4;
    const spacingX = (width - cols * cardWidth) / (cols + 1);
    const spacingY = (height - rows * cardHeight) / (rows + 1) - 30*SCALE;
    const marginY = 120 * SCALE;

    for (let i = 0; i < 20; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const x = spacingX - cardWidth/2 + col * (cardWidth + spacingX) - width / 2;
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
    const cardWidth = width ;
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

function getPage2Content(scene, width, height) {
    const container = scene.add.container(0, 0);
    const yStart = 70 * SCALE;
    const subtitle = createSubtitle(scene, 'Symbol Payouts', height, yStart);
    container.add(subtitle);

    const cardWidth = STYLE.SYMBOL_CARD_STYLE.width;
    const cardHeight = STYLE.SYMBOL_CARD_STYLE.height ;
    const rows = [3, 3, 4]; // Updated layout: 3 cards, 3 cards, 4 cards
    const marginY = 50 * SCALE;
    const spacingY = 30 * SCALE;

    let yOffset = -height / 2 + marginY + 80 * SCALE;

    let cardIndex = 0;
    for (let r = 0; r < rows.length; r++) {
        const cols = rows[r];
        const spacingX = (width - cols * cardWidth) / (cols + 1);

        for (let c = 0; c < cols; c++) {
            const x = spacingX -cardWidth/2 + c * (cardWidth + spacingX) - width / 2;
            const y = yOffset;

            const exampleLines = ["5: 100x", "4: 20x", "3: 3x"];
            const symbolCard = createSymbolCard(scene, x, y, 'reel1', exampleLines);
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

    const cardWidth = width * 0.85 ;
    const cardPadding = 20* SCALE;
    const sectionSpacing = 40* SCALE;
    const cardCornerRadius = 16* SCALE;
    const startY = -height/2 + yStart + sectionSpacing;

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