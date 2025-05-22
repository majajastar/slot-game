// style.js
import { COLORS, SCALE } from './config.js';

export const FONT = 'Comic Sans MS'

export const STYLE = {
  iconText: {
    fontSize: `${26 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  titleText: {
    fontSize: `${30 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  infoText: {
    fontSize: `${12 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  button: {
    fontSize: `${26 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.buttonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
    padding: { x: 10 * SCALE, y: 0 * SCALE },
    align: 'center'
  },
  spinButton: {
    fontSize: `${32 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.spinButtonText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 2,
    padding: { x: 16 * SCALE, y: 8 * SCALE },
    align: 'center'
  },
  valueBox: {
    fontSize: `${20 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.valueBoxText,
    stroke: '#000000',
    strokeThickness: 2,
    padding: { x: 10 * SCALE, y: 4 * SCALE },
    align: 'center',
    fixedWidth: 50 * SCALE
  },
  BigVlaueBox: {
    fontSize: `${16 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.valueBoxText,
    stroke: '#000000',
    strokeThickness: 2,
    padding: { x: 10 * SCALE, y: 4 * SCALE },
    align: 'center',
    fixedWidth: 110 * SCALE
  },
  label: {
    fontSize: `${18 * SCALE}px`,
    fontFamily: FONT,
    fill: COLORS.labelText,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 1.5
  },
  REEL_STYLE: {
    backgroundColor: 0x222222,
    backgroundAlpha: 0.6,
    gridLineColor: 0x999999,
    gridLineAlpha: 0.3,
    gridLineWidth: 1
  }
};


export const textStyle = {
  fontFamily: FONT,
  fontSize: `${20 * SCALE}`,
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
};