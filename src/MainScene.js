export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene'); // Scene key
  }

  preload() {
    // Load any assets here
  }

  create() {
    // Add a light blue background manually (optional fallback)
    this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      0x886644
    ).setDepth(-100);
    
    // Example: Add some text
    this.add.text(100, 100, 'Welcome to the Game!', {
      fontSize: '32px',
      fill: '#000'
    });
  }

  update() {
    // Game loop logic here
  }
}