import Phaser from 'phaser';
import { GameState, PlayerState, Zone } from '../../core/state/GameState';
import {
    DEPTH_HUD, COL_UI_BG, COL_UI_BG2, COL_UI_BORDER_DIM,
    COL_TRIM_DIM,
    FONT,
} from '../../game/constants';

const ZONE_LABELS: Record<Zone, string> = {
    entrance:  '↑ Entrance',
    slots:     '🎰 Slots Corner',
    poker:     '♠ Poker Room',
    bar:       '🍹 Bar & Lounge',
    blackjack: '🃏 Blackjack',
    roulette:  '🎡 Roulette',
    plinko:    '🎯 Plinko',
    floor:     '🏛 Casino Floor',
};

const FREE_CHIPS_AMOUNT = 500;

export class HUD {
    private scene: Phaser.Scene;

    // Player info bar (top-left)
    private playerGfx!: Phaser.GameObjects.Graphics;
    private nameText!: Phaser.GameObjects.Text;
    private chipsText!: Phaser.GameObjects.Text;

    // Zone badge (top-right)
    private zoneGfx!: Phaser.GameObjects.Graphics;
    private zoneText!: Phaser.GameObjects.Text;

    // Free chips button
    private freeChipsGfx!: Phaser.GameObjects.Graphics;
    private freeChipsLabel!: Phaser.GameObjects.Text;
    private freeChipsHit!: Phaser.GameObjects.Rectangle;
    private freeChipsVisible = false;

    private unsub!: () => void;
    private prevChips = -1;
    private chipFlashTimer: Phaser.Time.TimerEvent | null = null;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.build();
    }

    private build(): void {
        // ── Player info bar (top-left) ─────────────────────────────────────
        const barW = 220;
        const barH = 48;
        const barX = 0;
        const barY = 0;

        this.playerGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        this.drawPlayerBar(false);

        // Player star icon + name
        this.nameText = this.scene.add.text(barX + 14, barY + 13, '', {
            fontFamily: FONT, fontSize: '10px', color: '#c9a84c', fontStyle: 'bold',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // Chip counter — slightly larger and distinct color
        this.chipsText = this.scene.add.text(barX + 14, barY + 33, '', {
            fontFamily: FONT, fontSize: '13px', color: '#2ecc71', fontStyle: 'bold',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // ── Zone badge (top-right) ─────────────────────────────────────────
        const zoneW = 168;
        const zoneH = 28;
        const zoneX = 960 - zoneW - 8;
        const zoneY = 8;

        this.zoneGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        // Zone badge bg (drawn once; text update triggers redraw only if zone changes)
        this.zoneGfx.fillStyle(COL_UI_BG, 0.88);
        this.zoneGfx.fillRoundedRect(zoneX, zoneY, zoneW, zoneH, 14);
        this.zoneGfx.lineStyle(1, COL_UI_BORDER_DIM, 0.5);
        this.zoneGfx.strokeRoundedRect(zoneX, zoneY, zoneW, zoneH, 14);

        this.zoneText = this.scene.add.text(zoneX + zoneW / 2, zoneY + zoneH / 2, '', {
            fontFamily: FONT, fontSize: '10px', color: '#7a8a9a',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0.5);

        // ── Free Chips button (shown below player bar when broke) ──────────
        const fbX = barX;
        const fbY = barY + barH + 4;
        const fbW = barW;
        const fbH = 26;

        this.freeChipsGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        this.freeChipsLabel = this.scene.add.text(fbX + fbW / 2, fbY + fbH / 2, '🎁 FREE 500 CHIPS', {
            fontFamily: FONT, fontSize: '10px', color: '#6acc30', fontStyle: 'bold',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 2)
            .setOrigin(0.5);

        this.freeChipsHit = this.scene.add.rectangle(fbX + fbW / 2, fbY + fbH / 2, fbW, fbH, 0x000000, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 3)
            .setInteractive({ useHandCursor: true });

        this.freeChipsHit.on('pointerover', () => { this.drawFreeChipsBtn(true); });
        this.freeChipsHit.on('pointerout',  () => { this.drawFreeChipsBtn(false); });
        this.freeChipsHit.on('pointerdown', () => {
            GameState.addChips(FREE_CHIPS_AMOUNT);
        });

        this.setFreeChipsVisible(false);

        // ── Subscribe to state changes ─────────────────────────────────────
        this.unsub = GameState.subscribe(s => this.refresh(s));
        const initial = GameState.get();
        this.prevChips = initial.chips;
        this.refresh(initial);
    }

    private drawPlayerBar(chipFlash: boolean, flashGain = false): void {
        const g = this.playerGfx;
        const barW = 220;
        const barH = 48;
        g.clear();

        // Drop shadow
        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(2, 2, barW, barH, { tl: 0, tr: 0, bl: 6, br: 6 });

        // Main bg
        g.fillStyle(COL_UI_BG, 0.92);
        g.fillRoundedRect(0, 0, barW, barH, { tl: 0, tr: 0, bl: 6, br: 6 });

        // Inner darker section for chips
        g.fillStyle(COL_UI_BG2, 0.7);
        g.fillRoundedRect(8, barH / 2 + 4, barW - 16, barH / 2 - 8, 3);

        // Border — bottom + right sides only (top-left corner, hugs edge)
        g.lineStyle(1, COL_UI_BORDER, chipFlash ? 0.9 : 0.55);
        g.strokeRoundedRect(0, 0, barW, barH, { tl: 0, tr: 0, bl: 6, br: 6 });

        // Gold accent line at bottom
        g.lineStyle(1.5, chipFlash ? (flashGain ? COL_TRIM_DIM : 0xe74c3c) : COL_TRIM_DIM, chipFlash ? 0.8 : 0.35);
        g.lineBetween(0, barH - 1, barW, barH - 1);
    }

    private drawFreeChipsBtn(hover: boolean): void {
        const barW = 220;
        const barH = 48;
        const fbX = 0;
        const fbY = barH + 4;
        const fbW = barW;
        const fbH = 26;
        const g = this.freeChipsGfx;
        g.clear();

        if (!this.freeChipsVisible) return;

        g.fillStyle(hover ? 0x1e3812 : 0x141e0c, 0.92);
        g.fillRoundedRect(fbX, fbY, fbW, fbH, { tl: 0, tr: 0, bl: 5, br: 5 });
        g.lineStyle(1, hover ? 0x4a9a1a : 0x304a10, 0.9);
        g.strokeRoundedRect(fbX, fbY, fbW, fbH, { tl: 0, tr: 0, bl: 5, br: 5 });
    }

    private setFreeChipsVisible(visible: boolean): void {
        this.freeChipsVisible = visible;
        this.freeChipsGfx.setVisible(visible);
        this.freeChipsLabel.setVisible(visible);
        this.freeChipsHit.setInteractive(visible ? { useHandCursor: true } : undefined as any);
        this.freeChipsHit.setVisible(visible);
        if (visible) this.drawFreeChipsBtn(false);
        else this.freeChipsGfx.clear();
    }

    private refresh(s: PlayerState): void {
        this.nameText.setText(`★ ${s.displayName}`);
        this.chipsText.setText(`◈ ${s.chips.toLocaleString()} chips`);
        this.zoneText.setText(ZONE_LABELS[s.zone] ?? s.zone);

        // Chip flash on change
        if (this.prevChips >= 0 && s.chips !== this.prevChips) {
            const gain = s.chips > this.prevChips;
            const flashColor = gain ? '#2ecc71' : '#e74c3c';
            this.chipsText.setColor(flashColor);
            this.drawPlayerBar(true, gain);

            if (this.chipFlashTimer) {
                this.chipFlashTimer.remove();
                this.chipFlashTimer = null;
            }
            this.chipFlashTimer = this.scene.time.delayedCall(550, () => {
                this.chipFlashTimer = null;
                this.chipsText.setColor('#2ecc71');
                this.drawPlayerBar(false);
            });
        }
        this.prevChips = s.chips;

        // Free chips button — show whenever broke, regardless of active zone/interaction
        const broke = s.chips === 0;
        if (broke !== this.freeChipsVisible) {
            this.setFreeChipsVisible(broke);
        }
    }

    destroy(): void {
        this.unsub();
        if (this.chipFlashTimer) {
            this.chipFlashTimer.remove();
            this.chipFlashTimer = null;
        }
        this.playerGfx.destroy();
        this.nameText.destroy();
        this.chipsText.destroy();
        this.zoneGfx.destroy();
        this.zoneText.destroy();
        this.freeChipsGfx.destroy();
        this.freeChipsLabel.destroy();
        this.freeChipsHit.destroy();
    }
}
