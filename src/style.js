// style.js
import { COLORS, LAYOUT, SCALE } from './config.js';

export const FONT = 'Comic Sans MS'

export const STYLE = {
  titleText: {
    fontSize: `${40 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  infoText: {
    fontSize: `${30 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  userInfoText: {
    fontSize: `${16 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'left'
  },
  ADD_MINUS_BUTTON: {
    fontSize: `${100 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 0  * SCALE, y: -15 * SCALE },
    align: 'center'
  },
  spinButton: {
    fontSize: `${60 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.spinButtonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 16 * SCALE, y: 8 * SCALE },
    align: 'center'
  },
  valueBox: {
    fontSize: `${28 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.valueBoxText,
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 10 * SCALE, y: 4 * SCALE },
    align: 'center',
    fixedWidth: LAYOUT.CONTROL_WIDTH
  },
  label: {
    fontSize: `${34 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.labelText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 1.5 * SCALE
  },
  REEL_STYLE: {
    backgroundColor: 0x222222,
    backgroundAlpha: 0.6,
    gridLineColor: 0x999999,
    gridLineAlpha: 0.3,
    gridLineWidth: 1 * SCALE
  },
  LINE_COLOR_HOVER_LIST: Array.from({ length: 20 }, (_, i) => ({
    lineWidth: 3 * SCALE,
    strokeColor: [
      0xff0000, 0xff7f00, 0xffff00, 0x7fff00, 0x00ff00,
      0x00ff7f, 0x00ffff, 0x007fff, 0x0000ff, 0x7f00ff,
      0xff00ff, 0xff007f, 0xff4d4d, 0xff914d, 0xffcd4d,
      0x4dff4d, 0x4dcdff, 0x914dff, 0xff4db8, 0xffffff
    ][i],
    alpha: 1
  })),
  LINE_COLOR_CLICK: {
    lineWidth: 3 * SCALE,
    strokeColor: 0x88FFFF,
    alpha: 1
  },
  OCEAN_STYLE: {
    outer: { color: 0x005f73, alpha: 1 },
    inner: { color: 0x00b4d8, alpha: 1 },
    highlight: {
      color: 0xffffff,
      alpha: 0.15,
      offsetYFactor: -0.5,
      radiusFactor: 0.6
    }
  },
  OCEAN_STYLE_CLICKED: {
    outer: { color: 0x370617, alpha: 1 },
    inner: { color: 0xff6f61, alpha: 1 },
    highlight: {
      color: 0xffffff,
      alpha: 0.4,
      offsetYFactor: -0.35,
      radiusFactor: 0.7
    }
  },
  textStyle: {
    fontFamily: FONT,
    fontSize: `${20 * SCALE}px`,
    fontStyle: 'bold',
    color: '#ffffff',
    align: 'left',
    lineSpacing: 6 * SCALE,
    shadow: {
      offsetX: 1.5 * SCALE,
      offsetY: 1.5 * SCALE,
      color: '#000000',
      blur: 2 * SCALE,
      stroke: false,
      fill: true
    }
  },
  subTitleText: {
    fontSize: `${26 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  iconText: {
    fontSize: `${16 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2 * SCALE,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  INFO_CARD_STYLE: {
    width: 140 * SCALE,
    height: 90 * SCALE,
    cornerRadius: 8 * SCALE,
    borderColor: 0x333333,
    borderWidth: 2 * SCALE,
    labelFontSize: 14 * SCALE,
    labelColor: '#000000',
    grid: {
      cols: 5,
      rows: 3,
      paddingX: 8 * SCALE,
      paddingY: 8 * SCALE,
      squareBorderColor: 0x999999,
      squareBorderWidth: 1 * SCALE,
      squareHighlightColor: 0xadd8e6,
      squareBaseColor: 0xffffff,
      squareMarginFactor: 0.9,
      squareScaleFactor: 0.8,
    },
  },
  SYMBOL_CARD_STYLE: {
    width: 150 * SCALE,
    height: 80 * SCALE,
    cornerRadius: 8 * SCALE,
    borderColor: 0x333333,
    borderWidth: 2 * SCALE,
    labelFontSize: 14 * SCALE,
    labelColor: '#000000',
    grid: {
      cols: 5,
      rows: 3,
      paddingX: 8 * SCALE,
      paddingY: 8 * SCALE,
      squareBorderColor: 0x999999,
      squareBorderWidth: 1 * SCALE,
      squareHighlightColor: 0xadd8e6,
      squareBaseColor: 0xffffff,
      squareMarginFactor: 0.9,
      squareScaleFactor: 0.8,
    },
  },
  BUTTON_INFO: {
    fontSize: `${36 * SCALE}px`,
    color: '#00aaff',
    fontFamily: FONT,
    fontWeight: 'bold',
  },
  BUTTON_CLOSE: {
    radius: 20 * SCALE,
    colors: {
      base: 0x888888,
      hover: 0xbbbbbb,
      click: 0x555555
    },
    text: {
      fontSize: `${20 * SCALE}px`,
      color: '#f0f0f0',
      fontFamily: FONT,
      fontWeight: 'bold',
    },
    shadow: {
      color: 0x333333,
      offsetX: 2 * SCALE,
      offsetY: 2 * SCALE,
      blur: 3 * SCALE
    }
  },
  cardText: {
    fontSize: 14 * SCALE,
    color: '#ffffff',
    fontFamily: FONT
  },
  smallCardText: {
    fontSize: 22 * SCALE,
    color: '#ffffff',
    fontFamily: FONT,
    symbolSize: 22 * SCALE
  }
};
