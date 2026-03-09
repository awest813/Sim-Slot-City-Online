import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COL_UI_BORDER, COL_UI_BG, TEXT_TITLE, TEXT_MD } from '../game/constants';

export class PreloadScene extends Phaser.Scene {
    constructor() { super({ key: 'PreloadScene' }); }

    preload(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Background
        this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, COL_UI_BG);

        // Logo
        this.add.text(cx, cy - 60, '🎰 SLOT CITY', {
            ...TEXT_TITLE,
            fontSize: '36px',
        }).setOrigin(0.5);

        this.add.text(cx, cy - 22, 'Social Casino', {
            ...TEXT_MD,
            color: '#888888',
        }).setOrigin(0.5);

        // Progress bar
        const barW = 320;
        const barH = 12;
        const barX = cx - barW / 2;
        const barY = cy + 20;

        const outline = this.add.graphics();
        outline.lineStyle(1, COL_UI_BORDER, 1);
        outline.strokeRect(barX, barY, barW, barH);

        const bar = this.add.graphics();
        this.load.on('progress', (v: number) => {
            bar.clear();
            bar.fillStyle(COL_UI_BORDER, 1);
            bar.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * v), barH - 2);
        });

        this.add.text(cx, barY + 26, 'Loading...', {
            fontFamily: 'monospace', fontSize: '11px', color: '#666666',
        }).setOrigin(0.5);

        // No external assets — all procedural shapes
    }

    create(): void {
        this.scene.start('CasinoLobbyScene');
    }
}
