// ── Minimap ───────────────────────────────────────────────────────────────────
// A compact HUD element (bottom-right) that shows the casino floor layout,
// all zone markers with accent colours, and the player's current position.

import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, WORLD_W, WORLD_H,
    DEPTH_HUD, FONT,
    ZONE_SLOTS, ZONE_POKER, ZONE_BAR, ZONE_BLACKJACK,
    ZONE_ROULETTE, ZONE_PLINKO, ZONE_BINGO, ZONE_ENTRANCE,
    COL_SLOTS_ACCENT, COL_POKER_ACCENT, COL_BAR_ACCENT, COL_BLACKJACK_ACCENT,
    COL_ROULETTE_ACCENT, COL_PLINKO_ACCENT, COL_BINGO_ACCENT,
    COL_UI_BG, COL_UI_BORDER, COL_TRIM,
} from '../../game/constants';

// Minimap size and anchor (bottom-right)
const MAP_W   = 144;
const MAP_H   = 108;
const MARGIN  = 8;
const MAP_X   = GAME_WIDTH  - MAP_W - MARGIN;   // left edge of minimap
const MAP_Y   = GAME_HEIGHT - MAP_H - MARGIN;   // top  edge of minimap

// Scale world coords → minimap coords
const SX = (wx: number): number => MAP_X + (wx / WORLD_W) * MAP_W;
const SY = (wy: number): number => MAP_Y + (wy / WORLD_H) * MAP_H;
const SW = (ww: number): number => (ww / WORLD_W) * MAP_W;
const SH = (wh: number): number => (wh / WORLD_H) * MAP_H;

// Zone definitions with label and colour
const ZONES: Array<{
    zone:   { x: number; y: number; w: number; h: number };
    color:  number;
    label:  string;
}> = [
    { zone: ZONE_SLOTS,      color: COL_SLOTS_ACCENT,      label: 'Slots' },
    { zone: ZONE_POKER,      color: COL_POKER_ACCENT,       label: 'Poker' },
    { zone: ZONE_BAR,        color: COL_BAR_ACCENT,         label: 'Bar' },
    { zone: ZONE_BLACKJACK,  color: COL_BLACKJACK_ACCENT,   label: 'BJ' },
    { zone: ZONE_ROULETTE,   color: COL_ROULETTE_ACCENT,    label: 'Rlt' },
    { zone: ZONE_PLINKO,     color: COL_PLINKO_ACCENT,      label: 'Plnk' },
    { zone: ZONE_BINGO,      color: COL_BINGO_ACCENT,       label: 'Bingo' },
    { zone: ZONE_ENTRANCE,   color: 0xc9a84c,               label: '↑' },
];

export class Minimap {
    private scene:       Phaser.Scene;
    private bgGfx!:      Phaser.GameObjects.Graphics;   // static frame + zone fills
    private dotGfx!:     Phaser.GameObjects.Graphics;   // player dot (updates each frame)
    private labelGfx!:   Phaser.GameObjects.Graphics;   // label background chips
    private isVisible    = true;
    private labelsBuilt  = false;   // guard: zone label text objects created only once

    /** The scene must provide getPlayerPos() or pass avatar coords via update(). */
    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.buildStaticLayer();
        this.buildDotLayer();
    }

    // ── Build static background + zone fills ──────────────────────────────────

    private buildStaticLayer(): void {
        this.bgGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 2);

        this.labelGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 3);

        this.redrawStatic();
    }

    private redrawStatic(): void {
        const g = this.bgGfx;
        g.clear();

        // ── Frame ────────────────────────────────────────────────────────────
        // Drop shadow
        g.fillStyle(0x000000, 0.45);
        g.fillRoundedRect(MAP_X + 3, MAP_Y + 4, MAP_W, MAP_H, 5);
        // Background fill
        g.fillStyle(COL_UI_BG, 0.90);
        g.fillRoundedRect(MAP_X, MAP_Y, MAP_W, MAP_H, 5);
        // Subtle floor grid tint
        g.fillStyle(0x0c1a0c, 0.35);
        g.fillRoundedRect(MAP_X + 1, MAP_Y + 1, MAP_W - 2, MAP_H - 2, 4);
        // Border
        g.lineStyle(1.5, COL_UI_BORDER, 0.75);
        g.strokeRoundedRect(MAP_X, MAP_Y, MAP_W, MAP_H, 5);
        // Inner border
        g.lineStyle(0.5, COL_UI_BORDER, 0.2);
        g.strokeRoundedRect(MAP_X + 2, MAP_Y + 2, MAP_W - 4, MAP_H - 4, 4);

        // ── Wall outline ─────────────────────────────────────────────────────
        g.lineStyle(1, COL_TRIM, 0.3);
        g.strokeRect(MAP_X + 2, MAP_Y + 2, MAP_W - 4, MAP_H - 4);

        // ── Zone fills ───────────────────────────────────────────────────────
        for (const zd of ZONES) {
            const zx = SX(zd.zone.x);
            const zy = SY(zd.zone.y);
            const zw = SW(zd.zone.w);
            const zh = SH(zd.zone.h);

            // Soft fill
            g.fillStyle(zd.color, 0.10);
            g.fillRoundedRect(zx, zy, zw, zh, 1);
            // Outline
            g.lineStyle(1, zd.color, 0.45);
            g.strokeRoundedRect(zx, zy, zw, zh, 1);
        }

        // ── Zone label text (using scene.add.text below the static gfx) ─────
        // (Labels are drawn once via separate text objects)
        if (this.labelsBuilt) return;
        this.labelsBuilt = true;

        for (const zd of ZONES) {
            const lx = SX(zd.zone.x + zd.zone.w / 2);
            const ly = SY(zd.zone.y + zd.zone.h / 2);

            // Convert numeric colour to CSS hex string for Phaser text style
            const hexStr = `#${zd.color.toString(16).padStart(6, '0')}`;

            this.scene.add.text(lx, ly, zd.label, {
                fontFamily: FONT,
                fontSize: '6px',
                color: hexStr,
            })
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(DEPTH_HUD + 4);
        }

        // ── Title chip ───────────────────────────────────────────────────────
        const lg = this.labelGfx;
        lg.clear();
        lg.fillStyle(0x000000, 0.6);
        lg.fillRoundedRect(MAP_X + 4, MAP_Y + 2, 42, 12, 2);
        lg.lineStyle(0.5, COL_UI_BORDER, 0.5);
        lg.strokeRoundedRect(MAP_X + 4, MAP_Y + 2, 42, 12, 2);

        this.scene.add.text(MAP_X + 25, MAP_Y + 8, 'MAP', {
            fontFamily: FONT, fontSize: '7px', color: '#c9a84c',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 5);
    }

    // ── Player dot (updated every frame) ─────────────────────────────────────

    private buildDotLayer(): void {
        this.dotGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 6);
    }

    /** Call every frame from CasinoLobbyScene.update() with the avatar's world position. */
    update(worldX: number, worldY: number): void {
        if (!this.isVisible) return;

        const px = SX(worldX);
        const py = SY(worldY);

        const g = this.dotGfx;
        g.clear();

        // Soft halo
        g.fillStyle(0xffffff, 0.12);
        g.fillCircle(px, py, 5);
        // Outer ring
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(px, py, 3.5);
        // Inner bright
        g.fillStyle(0xffffff, 1);
        g.fillCircle(px, py, 2);
    }

    /** Toggle minimap visibility. */
    setVisible(v: boolean): void {
        this.isVisible = v;
        this.bgGfx.setVisible(v);
        this.dotGfx.setVisible(v);
        this.labelGfx.setVisible(v);
    }

    destroy(): void {
        this.bgGfx.destroy();
        this.dotGfx.destroy();
        this.labelGfx.destroy();
    }
}
