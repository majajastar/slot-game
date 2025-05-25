// main.js
import { SlotGameScene } from './game.js';
import { config } from './config.js';

config.scene = SlotGameScene;
new Phaser.Game(config);