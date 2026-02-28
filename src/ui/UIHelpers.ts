// ─────────────────────────────────────────────
//  UIHelpers – shared primitive drawing utilities
// ─────────────────────────────────────────────
import Phaser from 'phaser';
import { COL_UI_BG, COL_UI_BORDER } from '../game/constants';

/** Draw a filled, bordered panel rectangle onto the scene. */
export function drawPanel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha = 0.88,
): Phaser.GameObjects.Graphics {
    const gfx = scene.add.graphics();
    gfx.fillStyle(COL_UI_BG, alpha);
    gfx.fillRect(x, y, w, h);
    gfx.lineStyle(1, COL_UI_BORDER, 0.9);
    gfx.strokeRect(x, y, w, h);
    return gfx;
}

/** Draw a two-tone HP bar (green → yellow → red). */
export function drawHpBar(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    pct: number,
): void {
    const gfx = scene.add.graphics();
    gfx.fillStyle(0x222222);
    gfx.fillRect(x, y, w, h);
    const color = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xddaa00 : 0xcc2222;
    gfx.fillStyle(color);
    gfx.fillRect(x, y, Math.max(1, Math.round(w * pct)), h);
}
