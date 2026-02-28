import Phaser from 'phaser';

/**
 * BootScene – first scene that runs.
 * No assets loaded here; just transitions to PreloadScene.
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    create(): void {
        this.scene.start('PreloadScene');
    }
}
