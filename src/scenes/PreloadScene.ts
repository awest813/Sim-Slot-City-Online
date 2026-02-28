import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COL_UI_BORDER } from '../game/constants';

/**
 * PreloadScene – loads assets and shows a progress bar.
 * Uses only Phaser Graphics (no image assets required to run).
 */
export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Title
        this.add.text(cx, cy - 32, 'DUNGEON DICE & ROLL', {
            fontFamily: 'monospace',
            fontSize:   '12px',
            color:      '#e0c55a',
        }).setOrigin(0.5);

        this.add.text(cx, cy - 16, 'A Tactics RPG', {
            fontFamily: 'monospace',
            fontSize:   '8px',
            color:      '#666688',
        }).setOrigin(0.5);

        // Progress bar (Graphics only – no image assets)
        const barW = 200;
        const barH = 10;
        const barX = cx - barW / 2;
        const barY = cy + 8;

        const outline = this.add.graphics();
        outline.lineStyle(1, COL_UI_BORDER, 1);
        outline.strokeRect(barX, barY, barW, barH);

        const bar = this.add.graphics();
        this.load.on('progress', (v: number) => {
            bar.clear();
            bar.fillStyle(COL_UI_BORDER, 1);
            bar.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * v), barH - 2);
        });

        // ── Add real asset loads below when you have them ──────────────
        // this.load.setPath('assets');
        // this.load.image('tileset', 'tileset.png');
    }

    create(): void {
        this.scene.start('CampScene');
    }
}
