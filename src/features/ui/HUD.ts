import Phaser from 'phaser';
import { GameState, PlayerState, Zone } from '../../core/state/GameState';
import {
    GAME_WIDTH,
    DOCK_H, DOCK_Y,
    DEPTH_HUD, COL_UI_BG2, COL_UI_BORDER,
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
    horses:    { fill: 0x1a1000, border: 0x8a6010, text: '#e8b020' },
    vip:       { fill: 0x1a0530, border: 0xf6c855, text: '#f6c855' },
    floor:     { fill: 0x101018, border: 0x445577, text: '#8090aa' },
};
import { SoundManager } from '../../core/systems/SoundManager';

const getPlayerTitle = (chips: number): string => {
    if (chips >= 1000000) return 'Casino Legend';
    if (chips >= 100000) return 'Whale';
    if (chips >= 25000) return 'High Roller';
    if (chips >= 5000) return 'Regular';
    return 'Tourist';
};

const ZONE_LABELS: Record<Zone, string> = {
    entrance:  '↑ Entrance',
    slots:     '🎰 Slots Corner',
    poker:     '♠ Poker Room',
    bar:       '🍹 Bar & Lounge',
    blackjack: '🃏 Blackjack',
    roulette:  '🎡 Roulette',
    plinko:    '🎯 Plinko',
    bingo:     '🎱 Bingo Hall',
    horses:    '🏇 Horse Racing',
    vip:       '👑 VIP Lounge',
    floor:     '🏛 Casino Floor',
};

const FREE_CHIPS_AMOUNT = 500;
const PLAYER_BAR_W = 276;
const ZONE_W = 168;
const ZONE_H = 28;
const ZONE_X = GAME_WIDTH - 200 - ZONE_W;
const ZONE_Y = DOCK_Y + 18;

function portraitTexture(avatarKey: string | undefined): string {
    return `portrait_${avatarKey || 'avatar_player'}`;
}

export class HUD {
    private scene: Phaser.Scene;

    // Player info bar (top-left)
    private playerGfx!: Phaser.GameObjects.Graphics;
    private nameText!: Phaser.GameObjects.Text;
    private chipsText!: Phaser.GameObjects.Text;
    private portrait!: Phaser.GameObjects.Image;
    private portraitKey = '';

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

    // Stats button
    private statsBtnGfx!: Phaser.GameObjects.Graphics;
    private statsBtnLabel!: Phaser.GameObjects.Text;
    private statsBtnHit!: Phaser.GameObjects.Rectangle;

    private dailyBonusGfx!: Phaser.GameObjects.Graphics;
    private dailyBonusLabel!: Phaser.GameObjects.Text;
    private dailyBonusHit!: Phaser.GameObjects.Rectangle;
    private dailyBonusVisible = false;
    private dailyCheckTimer!: Phaser.Time.TimerEvent;

    private onStatsClick?: () => void;

    // Session P&L tracker
    private sessionStartChips = -1;
    private plText!: Phaser.GameObjects.Text;

    private unsub!: () => void;
    private prevChips = -1;
    private chipFlashTimer: Phaser.Time.TimerEvent | null = null;
    private panelOpen = false;

    constructor(scene: Phaser.Scene, onStatsClick?: () => void) {
        this.scene = scene;
        this.onStatsClick = onStatsClick;
        this.build();
    }

    private build(): void {
        // ── Player info bar (top-left) ─────────────────────────────────────
        const barW = GAME_WIDTH;
        const barH = DOCK_H;
        const barX = 0;
        const barY = DOCK_Y;

        this.playerGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        // Block clicks through HUD
        this.scene.add.rectangle(barX + barW / 2, barY + barH / 2, barW, barH, 0, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD)
            .setInteractive();

        this.drawPlayerBar(false);

        // Player star icon + name
        const portraitKey = portraitTexture(GameState.get().avatarTextureKey);
        this.portrait = this.scene.add.image(16, DOCK_Y + 9, portraitKey)
            .setOrigin(0, 0)
            .setDisplaySize(40, 46)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 2);
        this.portraitKey = portraitKey;

        this.nameText = this.scene.add.text(barX + 70, barY + 20, '', {
            fontFamily: FONT, fontSize: '10px', color: '#c9a84c', fontStyle: 'bold',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // Chip counter — larger text with drop shadow
        this.chipsText = this.scene.add.text(barX + 96, barY + 44, '', {
            fontFamily: FONT, fontSize: '14px', color: '#2ecc71', fontStyle: 'bold',
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 3, fill: true },
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // Session P&L — small text to the right of the chip counter
        this.plText = this.scene.add.text(barX + 230, barY + 44, '', {
            fontFamily: FONT, fontSize: '10px', color: '#556677',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // ── Zone badge, sitting in the control dock ────────────────────────
        const zoneW = ZONE_W;
        const zoneH = ZONE_H;
        const zoneX = ZONE_X;
        const zoneY = ZONE_Y;

        this.zoneGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        // Block clicks through zone badge
        this.scene.add.rectangle(zoneX + zoneW / 2, zoneY + zoneH / 2, zoneW, zoneH, 0, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD)
            .setInteractive();

        // Zone badge bg — redrawn per zone in drawZoneBadge()
        this.drawZoneBadge('floor');

        this.zoneText = this.scene.add.text(zoneX + zoneW / 2 + 8, zoneY + zoneH / 2, '', {
            fontFamily: FONT, fontSize: '10px', color: '#e7fff6',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0.5);

        // ── Free Chips button (shown below player bar when broke) ──────────
        const fbX = 8;
        const fbY = DOCK_Y - 30;
        const fbW = PLAYER_BAR_W;
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

        // ── Daily Bonus button ──────────
        const dbX = 8;
        const dbY = DOCK_Y - 60;
        const dbW = PLAYER_BAR_W;
        const dbH = 26;

        this.dailyBonusGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        this.dailyBonusLabel = this.scene.add.text(dbX + dbW / 2, dbY + dbH / 2, '⏰ CLAIM DAILY BONUS (2500◈)', {
            fontFamily: FONT, fontSize: '10px', color: '#f1c40f', fontStyle: 'bold',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 2)
            .setOrigin(0.5);

        this.dailyBonusHit = this.scene.add.rectangle(dbX + dbW / 2, dbY + dbH / 2, dbW, dbH, 0x000000, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 3)
            .setInteractive({ useHandCursor: true });

        this.dailyBonusHit.on('pointerover', () => { this.drawDailyBonusBtn(true); });
        this.dailyBonusHit.on('pointerout',  () => { this.drawDailyBonusBtn(false); });
        this.dailyBonusHit.on('pointerdown', () => {
            SoundManager.playClick();
            GameState.update({ lastDailyClaim: Date.now() });
            GameState.addChips(2500);
            this.setDailyBonusVisible(false);
        });

        this.setDailyBonusVisible(false);

        // ── Sound mute toggle (top-left, to the right of player bar) ──────
        const muteSize = 28;
        const muteX = GAME_WIDTH - 188;
        const muteY = DOCK_Y + 18;

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
            this.muteGfx.fillStyle(hover ? 0x1faf98 : 0x14786c, 0.95);
            this.muteGfx.fillRoundedRect(muteX, muteY, muteSize, muteSize, 8);
            this.muteGfx.lineStyle(1.5, 0xd8ffe8, 0.8);
            this.muteGfx.strokeRoundedRect(muteX, muteY, muteSize, muteSize, 8);
        };
        drawMuteBtn(false);
        this.muteLabel.setText(SoundManager.isMuted() ? '🔇' : '🔊');

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

        // ── Stats/Menu button (top-left, next to mute button) ──────────────
        const statsSize = 28;
        const statsX = GAME_WIDTH - 152;
        const statsY = DOCK_Y + 18;

        this.statsBtnGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD);

        this.statsBtnLabel = this.scene.add.text(statsX + statsSize / 2, statsY + statsSize / 2, '📊', {
            fontFamily: FONT, fontSize: '13px',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 2)
            .setOrigin(0.5);

        this.statsBtnHit = this.scene.add.rectangle(statsX + statsSize / 2, statsY + statsSize / 2,
            statsSize, statsSize, 0x000000, 0)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 3)
            .setInteractive({ useHandCursor: true });

        const drawStatsBtn = (hover: boolean): void => {
            this.statsBtnGfx.clear();
            this.statsBtnGfx.fillStyle(hover ? 0x1faf98 : 0x14786c, 0.95);
            this.statsBtnGfx.fillRoundedRect(statsX, statsY, statsSize, statsSize, 8);
            this.statsBtnGfx.lineStyle(1.5, 0xd8ffe8, 0.8);
            this.statsBtnGfx.strokeRoundedRect(statsX, statsY, statsSize, statsSize, 8);
        };
        drawStatsBtn(false);

        this.statsBtnHit.on('pointerover',  () => drawStatsBtn(true));
        this.statsBtnHit.on('pointerout',   () => drawStatsBtn(false));
        this.statsBtnHit.on('pointerdown', () => {
            SoundManager.playClick();
            if (this.onStatsClick) this.onStatsClick();
        });

        // ── Subscribe to state changes ─────────────────────────────────────
        this.unsub = GameState.subscribe(s => this.refresh(s));
        const initial = GameState.get();
        this.prevChips = initial.chips;
        this.sessionStartChips = initial.chips;
        this.refresh(initial);

        // Daily bonus polling
        this.dailyCheckTimer = this.scene.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                const s = GameState.get();
                const canClaimDaily = (Date.now() - s.lastDailyClaim) > 60000;
                const showDaily = canClaimDaily && !this.panelOpen;
                if (showDaily !== this.dailyBonusVisible) {
                    this.setDailyBonusVisible(showDaily);
                }
            }
        });
    }

    private drawPlayerBar(chipFlash: boolean, flashGain = false): void {
        const g = this.playerGfx;
        const y = DOCK_Y;
        const h = DOCK_H;
        const w = GAME_WIDTH;
        g.clear();

        g.fillStyle(0x06362f, 0.4);
        g.fillRect(0, y - 3, w, 3);
        g.fillStyle(0x178f7c, 1);
        g.fillRect(0, y, w, h);
        g.fillStyle(0xd8ffe8, 0.7);
        g.fillRect(0, y, w, 3);
        g.fillStyle(0x0c5c50, 1);
        g.fillRect(0, y + h - 4, w, 4);

        g.fillStyle(0x0e3f38, 0.55);
        g.fillRoundedRect(8, y + 6, 300, h - 12, 14);

        g.fillStyle(0xfff6e8, 1);
        g.fillRoundedRect(14, y + 8, 44, 48, 10);
        g.lineStyle(1.5, 0x08332e, 0.55);
        g.strokeRoundedRect(14, y + 8, 44, 48, 10);

        g.fillStyle(COL_UI_BG2, chipFlash ? 0.95 : 0.7);
        g.fillRoundedRect(68, y + 30, 220, 24, 8);
        g.lineStyle(1.5, chipFlash ? (flashGain ? 0x2ecc71 : 0xe74c3c) : COL_TRIM_DIM, chipFlash ? 0.9 : 0.45);
        g.strokeRoundedRect(68, y + 30, 220, 24, 8);

        const iconX = 82;
        const iconY = y + 42;
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
        const zoneW = ZONE_W;
        const zoneH = ZONE_H;
        const zoneX = ZONE_X;
        const zoneY = ZONE_Y;
        const acc = ZONE_ACCENT[zone] ?? ZONE_ACCENT['floor'];
        const g = this.zoneGfx;
        g.clear();
        g.fillStyle(0x06362f, 0.35);
        g.fillRoundedRect(zoneX + 2, zoneY + 2, zoneW, zoneH, 14);
        g.fillStyle(0x14675c, 0.96);
        g.fillRoundedRect(zoneX, zoneY, zoneW, zoneH, 14);
        g.lineStyle(1.5, COL_UI_BORDER, 0.9);
        g.strokeRoundedRect(zoneX, zoneY, zoneW, zoneH, 14);
        g.fillStyle(acc.border, 1);
        g.fillCircle(zoneX + 14, zoneY + zoneH / 2, 5);
        g.lineStyle(1, 0xffffff, 0.55);
        g.strokeCircle(zoneX + 14, zoneY + zoneH / 2, 5);
        if (this.zoneText) {
            this.zoneText.setColor('#e7fff6');
            this.zoneText.setX(zoneX + zoneW / 2 + 8);
        }
    }

    private drawActionBtn(
        g: Phaser.GameObjects.Graphics,
        x: number, y: number, w: number, h: number,
        hover: boolean,
    ): void {
        g.fillStyle(0x06362f, 0.35);
        g.fillRoundedRect(x + 2, y + 2, w, h, 8);
        g.fillStyle(hover ? 0x1faf98 : 0x14786c, 0.96);
        g.fillRoundedRect(x, y, w, h, 8);
        g.lineStyle(1.5, 0xd8ffe8, 0.9);
        g.strokeRoundedRect(x, y, w, h, 8);
    }

    private drawFreeChipsBtn(hover: boolean): void {
        const fbX = 8;
        const fbY = DOCK_Y - 30;
        const fbW = PLAYER_BAR_W;
        const fbH = 26;
        const g = this.freeChipsGfx;
        g.clear();

        if (!this.freeChipsVisible) return;
        this.drawActionBtn(g, fbX, fbY, fbW, fbH, hover);
    }

    private setFreeChipsVisible(visible: boolean): void {
        this.freeChipsVisible = visible;
        this.freeChipsGfx.setVisible(visible);
        this.freeChipsLabel.setVisible(visible);
        if (visible) {
            this.freeChipsHit.setInteractive({ useHandCursor: true });
        } else {
            this.freeChipsHit.disableInteractive();
        }
        this.freeChipsHit.setVisible(visible);
        if (visible) this.drawFreeChipsBtn(false);
        else this.freeChipsGfx.clear();
    }

    private drawDailyBonusBtn(hover: boolean): void {
        const dbX = 8;
        const dbY = DOCK_Y - 60;
        const dbW = PLAYER_BAR_W;
        const dbH = 26;
        const g = this.dailyBonusGfx;
        g.clear();

        if (!this.dailyBonusVisible) return;
        this.drawActionBtn(g, dbX, dbY, dbW, dbH, hover);
    }

    private setDailyBonusVisible(visible: boolean): void {
        this.dailyBonusVisible = visible;
        this.dailyBonusGfx.setVisible(visible);
        this.dailyBonusLabel.setVisible(visible);
        if (visible) {
            this.dailyBonusHit.setInteractive({ useHandCursor: true });
        } else {
            this.dailyBonusHit.disableInteractive();
        }
        this.dailyBonusHit.setVisible(visible);
        if (visible) this.drawDailyBonusBtn(false);
        else this.dailyBonusGfx.clear();
    }

    private prevZone: Zone = 'floor';

    private refresh(s: PlayerState): void {
        this.nameText.setText(`★ ${s.displayName}  [${getPlayerTitle(s.chips)}]`);
        this.chipsText.setText(s.chips.toLocaleString());
        const nextPortrait = portraitTexture(s.avatarTextureKey);
        if (nextPortrait !== this.portraitKey && this.scene.textures.exists(nextPortrait)) {
            this.portrait.setTexture(nextPortrait);
            this.portraitKey = nextPortrait;
        }
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

            // Pop animation
            this.chipsText.setScale(1.25);
            this.scene.tweens.add({
                targets: this.chipsText,
                scaleX: 1,
                scaleY: 1,
                duration: 350,
                ease: 'Back.Out'
            });

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

        // Free chips button — show whenever broke, but only when no panel is open
        const broke = s.chips === 0 && !this.panelOpen;
        if (broke !== this.freeChipsVisible) {
            this.setFreeChipsVisible(broke);
        }
    }

    /** Call with true when any panel is open so the free-chips button is suppressed (prevents overlay overlap). */
    setPanelOpen(open: boolean): void {
        this.panelOpen = open;
        // If a panel just opened and free chips was showing, hide it
        if (open && this.freeChipsVisible) {
            this.setFreeChipsVisible(false);
        } else if (!open && GameState.get().chips === 0) {
            // Re-show if player is still broke after panel closes
            this.setFreeChipsVisible(true);
        }

        if (open && this.dailyBonusVisible) {
            this.setDailyBonusVisible(false);
        } else if (!open && (Date.now() - GameState.get().lastDailyClaim) > 60000) {
            this.setDailyBonusVisible(true);
        }
    }

    destroy(): void {
        this.unsub();
        if (this.chipFlashTimer) {
            this.chipFlashTimer.remove();
            this.chipFlashTimer = null;
        }
        this.playerGfx.destroy();
        this.portrait.destroy();
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
        this.statsBtnGfx.destroy();
        this.statsBtnLabel.destroy();
        this.statsBtnHit.destroy();
        if (this.dailyCheckTimer) {
            this.dailyCheckTimer.remove();
        }
        this.dailyBonusGfx.destroy();
        this.dailyBonusLabel.destroy();
        this.dailyBonusHit.destroy();
    }
}
