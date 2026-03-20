import Phaser from 'phaser';
import { GameState, PlayerState, Zone } from '../../core/state/GameState';
import {
    DEPTH_HUD, COL_UI_BG, COL_UI_BG2, COL_UI_BORDER,
    COL_TRIM_DIM,
    FONT,
} from '../../game/constants';

// Accent color (fill + border) for each zone badge background
const ZONE_ACCENT: Record<Zone, { fill: number; border: number; text: string }> = {
    entrance:  { fill: 0x0d1820, border: 0x445566, text: '#7a8a9a' },
    slots:     { fill: 0x1a0d2a, border: 0x6a3a8a, text: '#c080ff' },
    poker:     { fill: 0x0a1a0a, border: 0x3a7a3a, text: '#70cc70' },
    bar:       { fill: 0x1e0f05, border: 0x7a4a10, text: '#c9a84c' },
    blackjack: { fill: 0x0a1520, border: 0x3a6a8a, text: '#60b0d0' },
    roulette:  { fill: 0x1a0808, border: 0x8a2a2a, text: '#e06060' },
    plinko:    { fill: 0x081a10, border: 0x2a7a4a, text: '#50cc80' },
    bingo:     { fill: 0x041014, border: 0x107090, text: '#00c8ff' },
    floor:     { fill: 0x101018, border: 0x445577, text: '#8090aa' },
};
import { SoundManager } from '../../core/systems/SoundManager';

const ZONE_LABELS: Record<Zone, string> = {
    entrance:  '↑ Entrance',
    slots:     '🎰 Slots Corner',
    poker:     '♠ Poker Room',
    bar:       '🍹 Bar & Lounge',
    blackjack: '🃏 Blackjack',
    roulette:  '🎡 Roulette',
    plinko:    '🎯 Plinko',
    bingo:     '🎱 Bingo Hall',
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

    // Sound mute toggle
    private muteGfx!: Phaser.GameObjects.Graphics;
    private muteLabel!: Phaser.GameObjects.Text;
    private muteHit!: Phaser.GameObjects.Rectangle;

    // Session P&L tracker
    private sessionStartChips = -1;
    private plText!: Phaser.GameObjects.Text;

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

        // Chip counter — larger text with drop shadow
        this.chipsText = this.scene.add.text(barX + 42, barY + 33, '', {
            fontFamily: FONT, fontSize: '14px', color: '#2ecc71', fontStyle: 'bold',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // Session P&L — small text to the right of the chip counter
        this.plText = this.scene.add.text(barX + barW - 8, barY + 33, '', {
            fontFamily: FONT, fontSize: '10px', color: '#556677',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(1, 0.5);

        // ── Zone badge (top-right) ─────────────────────────────────────────
        const zoneW = 168;
        const zoneH = 28;
        const zoneX = 960 - zoneW - 8;
        const zoneY = 8;

        this.zoneGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        // Zone badge bg — redrawn per zone in drawZoneBadge()
        this.drawZoneBadge('floor');

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

        // ── Sound mute toggle (top-left, to the right of player bar) ──────
        const muteSize = 28;
        const muteX = 228;
        const muteY = 8;

        this.muteGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        this.muteLabel = this.scene.add.text(muteX + muteSize / 2, muteY + muteSize / 2, '🔊', {
            fontFamily: FONT, fontSize: '13px',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 2)
            .setOrigin(0.5);

        this.muteHit = this.scene.add.rectangle(muteX + muteSize / 2, muteY + muteSize / 2,
            muteSize, muteSize, 0x000000, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 3)
            .setInteractive({ useHandCursor: true });

        const drawMuteBtn = (hover: boolean): void => {
            this.muteGfx.clear();
            this.muteGfx.fillStyle(hover ? 0x2a2a3a : 0x141420, 0.88);
            this.muteGfx.fillRoundedRect(muteX, muteY, muteSize, muteSize, 5);
            this.muteGfx.lineStyle(1, 0x445566, 0.55);
            this.muteGfx.strokeRoundedRect(muteX, muteY, muteSize, muteSize, 5);
        };
        drawMuteBtn(false);

        this.muteHit.on('pointerover',  () => drawMuteBtn(true));
        this.muteHit.on('pointerout',   () => drawMuteBtn(false));
        this.muteHit.on('pointerdown', () => {
            // First click initialises the AudioContext (browser autoplay policy)
            SoundManager.init();
            const nowMuted = !SoundManager.isMuted();
            SoundManager.setMuted(nowMuted);
            this.muteLabel.setText(nowMuted ? '🔇' : '🔊');
            if (!nowMuted) SoundManager.playClick();
        });

        // ── Subscribe to state changes ─────────────────────────────────────
        this.unsub = GameState.subscribe(s => this.refresh(s));
        const initial = GameState.get();
        this.prevChips = initial.chips;
        this.sessionStartChips = initial.chips;
        this.refresh(initial);
    }

    private drawPlayerBar(chipFlash: boolean, flashGain = false): void {
        const g = this.playerGfx;
        const barW = 220;
        const barH = 48;
        g.clear();

        // Outer glow halo at low opacity
        g.lineStyle(6, COL_UI_BORDER, 0.08);
        g.strokeRoundedRect(-2, -2, barW + 4, barH + 4, { tl: 0, tr: 0, bl: 8, br: 8 });

        // Drop shadow
        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(2, 2, barW, barH, { tl: 0, tr: 0, bl: 6, br: 6 });

        // Main bg
        g.fillStyle(COL_UI_BG, 0.92);
        g.fillRoundedRect(0, 0, barW, barH, { tl: 0, tr: 0, bl: 6, br: 6 });

        // Inner darker section for chips
        g.fillStyle(COL_UI_BG2, 0.7);
        g.fillRoundedRect(8, barH / 2 + 4, barW - 16, barH / 2 - 8, 3);

        // Border
        g.lineStyle(1, COL_UI_BORDER, chipFlash ? 0.9 : 0.55);
        g.strokeRoundedRect(0, 0, barW, barH, { tl: 0, tr: 0, bl: 6, br: 6 });

        // Gold accent line at bottom
        g.lineStyle(1.5, chipFlash ? (flashGain ? COL_TRIM_DIM : 0xe74c3c) : COL_TRIM_DIM, chipFlash ? 0.8 : 0.35);
        g.lineBetween(0, barH - 1, barW, barH - 1);

        // ── Detailed chip icon (gold circle + cross-hatch lines) ──────────
        const iconX = 26;
        const iconY = barH / 2 + 6;
        const iconR = 8;
        // Outer ring
        g.fillStyle(0xc9a84c, 0.9);
        g.fillCircle(iconX, iconY, iconR);
        // Inner rim
        g.lineStyle(1.5, 0x8a6020, 0.9);
        g.strokeCircle(iconX, iconY, iconR);
        // Inner fill slightly darker
        g.fillStyle(0xa07830, 0.6);
        g.fillCircle(iconX, iconY, iconR - 3);
        // 4 radiating cross-hatch lines
        g.lineStyle(1, 0x604c10, 0.7);
        g.lineBetween(iconX - iconR + 2, iconY, iconX + iconR - 2, iconY);
        g.lineBetween(iconX, iconY - iconR + 2, iconX, iconY + iconR - 2);
        g.lineBetween(iconX - 5, iconY - 5, iconX + 5, iconY + 5);
        g.lineBetween(iconX + 5, iconY - 5, iconX - 5, iconY + 5);
    }

    private drawZoneBadge(zone: Zone): void {
        const zoneW = 168;
        const zoneH = 28;
        const zoneX = 960 - zoneW - 8;
        const zoneY = 8;
        const acc = ZONE_ACCENT[zone] ?? ZONE_ACCENT['floor'];
        const g = this.zoneGfx;
        g.clear();
        // Outer halo glow
        g.lineStyle(6, acc.border, 0.12);
        g.strokeRoundedRect(zoneX - 2, zoneY - 2, zoneW + 4, zoneH + 4, 16);
        // Background fill with zone accent
        g.fillStyle(acc.fill, 0.92);
        g.fillRoundedRect(zoneX, zoneY, zoneW, zoneH, 14);
        // Border
        g.lineStyle(1, acc.border, 0.7);
        g.strokeRoundedRect(zoneX, zoneY, zoneW, zoneH, 14);
        // Inner border tint
        g.lineStyle(0.5, acc.border, 0.3);
        g.strokeRoundedRect(zoneX + 2, zoneY + 2, zoneW - 4, zoneH - 4, 12);
        // Update text color to match accent
        if (this.zoneText) this.zoneText.setColor(acc.text);
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

    private prevZone: Zone = 'floor';

    private refresh(s: PlayerState): void {
        this.nameText.setText(`★ ${s.displayName}`);
        this.chipsText.setText(`◈ ${s.chips.toLocaleString()} chips`);
        this.zoneText.setText(ZONE_LABELS[s.zone] ?? s.zone);

        // Session P&L display
        if (this.sessionStartChips >= 0) {
            const pl = s.chips - this.sessionStartChips;
            if (pl === 0) {
                this.plText.setText('');
            } else if (pl > 0) {
                this.plText.setText(`+${pl.toLocaleString()}`).setColor('#2ecc71');
            } else {
                this.plText.setText(`${pl.toLocaleString()}`).setColor('#e74c3c');
            }
        }

        // Redraw zone badge when zone changes (accent color update)
        if (s.zone !== this.prevZone) {
            this.drawZoneBadge(s.zone);
            this.prevZone = s.zone;
            // Scale-pop the zone text to signal the zone change
            this.zoneText.setScale(0.78);
            this.scene.tweens.add({
                targets:  this.zoneText,
                scaleX:   1,
                scaleY:   1,
                duration: 320,
                ease:     'Back.Out',
            });
        }

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
        this.plText.destroy();
        this.zoneGfx.destroy();
        this.zoneText.destroy();
        this.freeChipsGfx.destroy();
        this.freeChipsLabel.destroy();
        this.freeChipsHit.destroy();
        this.muteGfx.destroy();
        this.muteLabel.destroy();
        this.muteHit.destroy();
    }
}
