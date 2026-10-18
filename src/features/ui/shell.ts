// Shared life-sim panel shell: teal plastic, a dark well, and a header band.
import type Phaser from 'phaser';
import { PANEL_RADIUS } from '../../game/constants';

export function paintLifeSimShell(
    g: Phaser.GameObjects.Graphics,
    px: number,
    py: number,
    w: number,
    h: number,
): void {
    const r = PANEL_RADIUS;
    g.fillStyle(0x06362f, 0.35);
    g.fillRoundedRect(px + 5, py + 8, w, h, r);

    g.fillStyle(0x178f7c, 1);
    g.fillRoundedRect(px, py, w, h, r);
    g.fillStyle(0xb8ffe8, 0.55);
    g.fillRoundedRect(px + 3, py + 3, w - 6, 14, 8);
    g.fillStyle(0x0c6e60, 1);
    g.fillRoundedRect(px, py + h - 12, w, 12, { tl: 0, tr: 0, bl: r, br: r });

    g.fillStyle(0x102e2a, 1);
    g.fillRoundedRect(px + 10, py + 10, w - 20, h - 20, Math.max(4, r - 6));

    g.fillStyle(0x14685c, 1);
    g.fillRoundedRect(px + 10, py + 10, w - 20, 44, { tl: r - 6, tr: r - 6, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(px + 16, py + 13, w - 32, 8, 4);

    g.lineStyle(2, 0xd8ffe8, 0.85);
    g.strokeRoundedRect(px, py, w, h, r);
    g.lineStyle(1.5, 0xc9a84c, 0.65);
    g.lineBetween(px + 22, py + 54, px + w - 22, py + 54);
}
