// config.js

export const COLORS = {
  buttonBg: '#123456',
  buttonHoverBg: '#666',
  buttonText: '#ffcc00',
  buttonHoverText: '#ffffff',
  spinButtonBg: '#0xFFFFFF',
  spinButtonText: '#ffcc00',
  valueBoxBg: '#842255',
  valueBoxText: '#ffffff',
  labelText: '#ffffff',
  background: '#565656',
  buttonText: '#ffffff',
  spinButtonText: '#ffffff',
  spinButtonBg: '#0077b6', // example
  valueBoxText: '#ffffff',
  labelText: '#ffffff',

  bgGradient: {
    topLeft: 0x70C1B3,     // lighter teal-ish blue
    topRight: 0x92D8D8,    // pale cyan
    bottomLeft: 0xA2E1E1,  // very light aqua
    bottomRight: 0xD0F0F0, // pale icy blue
  },

  controlCardGradient: {
    topLeft: 0xFFD2B48C,     // light tan (like light wood grain)
    topRight: 0xFFE4CDAF,    // pale peach (soft wood highlights)
    bottomLeft: 0xFFC9A66B,  // warm beige (natural wood shade)
    bottomRight: 0xFFDEBC91, // creamy light brown (smooth wood finish)
  },

  userCardBg: 0x005f73, // dark ocean
  userCardHighlight: 0xffffff,

  gameTitleGradient: {
    topLeft: 0x0077b6,
    topRight: 0x0096c7,
    bottomLeft: 0x48cae4,
    bottomRight: 0x90e0ef,
  },

  infoIconOuter: 0x005f73,
  infoIconInner: 0x00b4d8,
  infoIconHighlight: 0xffffff,

  optionsIconOuter: 0x005f73,
  optionsIconInner: 0x00b4d8,
  optionsIconHighlight: 0xffffff,

  userCardGradientTop: 0x0096c7,    // lighter blue for gradient top
  userCardGradientBottom: 0x005f73, // darker blue for gradient bottom
  userCardHighlight: 0xffffff,       // for the glossy overlay

  userCard: {
    topLeft: 0x01497c,    // deep ocean blue
    topRight: 0x0288d1,   // bright ocean blue
    bottomLeft: 0x26c6da, // turquoise sea
    bottomRight: 0x80deea, // light aqua
  },

  spinButtonBg: {
    topLeft: 0xFF5AC8,     // bright bubblegum pink
    topRight: 0xFFE1F0,    // light cotton candy
    bottomLeft: 0xFF71D4,  // vivid candy pink
    bottomRight: 0xFFC2E9  // soft raspberry glow
  },

  wooden: {
    topLeft: 0x8B2B1A,    // dark red-brown
    topRight: 0x9C3B23,   // slightly lighter red-brown
    bottomLeft: 0x7A2615, // deep reddish brown
    bottomRight: 0x843029, // muted dark red
  },

  glass: {
    topLeft: 0xE0F7FA,
    topRight: 0xB3E5FC,
    bottomLeft: 0x81D4FA,
    bottomRight: 0x4FC3F7,
  }
};

export const screenWidth = window.innerWidth;
export const screenHeight = window.innerHeight;

// Base design width and height (original design)
export const BASE_WIDTH = 1280;
export const BASE_HEIGHT = 720;


// Calculate scale factors based on the base design
export const scaleX = screenWidth / BASE_WIDTH;
export const scaleY = screenHeight / BASE_HEIGHT;

// Choose the smaller scale to fit inside viewport without cropping
export const SCALE = Math.min(scaleX, scaleY);

// Set game size to fit the window while preserving aspect ratio
export const GAME_WIDTH = BASE_WIDTH * SCALE;
export const GAME_HEIGHT = BASE_HEIGHT * SCALE;
export const POP_WIDTH = GAME_WIDTH * 0.8;
export const POP_HEIGHT = GAME_HEIGHT * 0.8;

// Scale layout constants
const spacingX = 140

export const LAYOUT = {
  SYMBOL_SIZE: 130 * SCALE,
  REEL_SPACING_X: spacingX * SCALE,
  REEL_SPACING_Y: 140 * SCALE,
  BASE_X: (BASE_WIDTH / 2 - spacingX * 2) * SCALE,
  BASE_Y: 180 * SCALE,
  GAME_WIDTH: GAME_WIDTH,
  GAME_HEIGHT: GAME_HEIGHT,
  POP_WIDTH: POP_WIDTH,
  POP_HEIGHT: POP_HEIGHT
};

export const REEL_CONFIG = {
  REEL_COUNT: 5,
  ROW_COUNT: 3
}

export const config = {
  type: Phaser.AUTO,
  width: LAYOUT.GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: 0x886644,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',  // Optional: if you have a div container in HTML
  }
};
