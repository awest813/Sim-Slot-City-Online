// ── Playable slot machine minigame ────────────────────────────────────────────
// Three reels, configurable bet, payout table, win/loss feedback.
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_UI_BG2, COL_UI_BORDER_DIM,
    COL_TRIM, COL_TRIM_LIGHT, COL_TRIM_DIM,
    COL_SLOT_TRIM,
    FONT, ANIM_MED,
} from '../../game/constants';
import { SoundManager } from '../../core/systems/SoundManager';
import { paintLifeSimShell } from '../ui/shell';
import { ToastManager } from '../ui/ToastManager';

import { SYMBOLS, PAYOUTS, weightedRandom, evaluateSpin, SpinResult } from './SlotsEngine';

const SYMBOL_KEYS: Record<string, string> = {
    '🍒': 'slots_cherry',
    '🍋': 'slots_lemon',
    '🍊': 'slots_orange',
    '🍇': 'slots_grape',
    '⭐': 'slots_star',
    '💎': 'slots_diamond',
    '7️⃣': 'slots_seven',
    '🎰': 'slots_wild'
};

type SpinState = 'idle' | 'spinning' | 'result';

export class SlotsPanel {
    private scene:   Phaser.Scene;
    private onClose: () => void;
    private isHighStakes: boolean = false;
    private betOptions: number[] = [10, 25, 50, 100];

    // Phaser objects
    private overlay!:      Phaser.GameObjects.Rectangle;
    private panelGfx!:     Phaser.GameObjects.Graphics;
    private container!:    Phaser.GameObjects.Container;

    // ── Vertical-scroll reel strips ────────────────────────────────────────────
    // Each reel is a scrolling container (strip) masked to the 96×96 slot window.
    // STRIP_LENGTH symbols are stacked at y = 0, -SYMBOL_H, -2*SYMBOL_H, ...
    // Spinning tweens strip.y from 0 to (STRIP_LENGTH-1)*SYMBOL_H so the final
    // symbol (always at the last slot) descends into the visible window.
    private readonly STRIP_LENGTH = 14;
    private readonly SYMBOL_H = 96;
    /** Outer fixed container for each reel (used as coordinate anchor). */
    private reelOuters:  Phaser.GameObjects.Container[] = [];
    /** Inner scrolling strip — its .y is animated during a spin. */
    private reelStrips:  Phaser.GameObjects.Container[] = [];
    /** Image objects inside each strip, STRIP_LENGTH per reel. */
    private reelStripSymbols: Phaser.GameObjects.Image[][] = [];
    /** Geometry-mask graphics pinned to the slot window (scrollFactor=0). */
    private reelMaskGfxs: Phaser.GameObjects.Graphics[] = [];
    /** Active spin tweens for early-cancel if panel closes. */
    private reelSpinTweens: (Phaser.Tweens.Tween | null)[] = [null, null, null];

    private payLineGfx!:   Phaser.GameObjects.Graphics;
    private winGlowGfx!:   Phaser.GameObjects.Graphics;
    private resultText!:   Phaser.GameObjects.Text;
    private chipsText!:    Phaser.GameObjects.Text;
    private betText!:      Phaser.GameObjects.Text;
    private statsText!:    Phaser.GameObjects.Text;
    private spinBtnGfx!:   Phaser.GameObjects.Graphics;
    private spinBtnLabel!: Phaser.GameObjects.Text;
    private spinBtnHit!:   Phaser.GameObjects.Rectangle;
    private betBtns:       Array<{ gfx: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; amount: number }> = [];
    private freeChipsContainer: Phaser.GameObjects.Container | null = null;
    private escKey!:       Phaser.Input.Keyboard.Key;
    private spaceKey!:     Phaser.Input.Keyboard.Key;

    // State
    private spinState:    SpinState = 'idle';
    private spinLocked:   boolean   = false;   // extra lockout during 500ms post-result cooldown
    private currentBet:   number    = 25;
    private reelValues:   string[]  = ['🎰', '🎰', '🎰'];
    private spinTimers:   Phaser.Time.TimerEvent[] = [];
    private spinDone:     boolean[] = [false, false, false];
    private closed:       boolean   = false;
    private freeSpins:    number    = 0;
    private wasFreeSpin:  boolean   = false;

    // Session stats
    private totalSpins   = 0;
    private totalWon     = 0;
    private totalWagered = 0;
    private winStreak    = 0;
    private maxWinStreak = 0;

    // Layout
    private readonly PW = 520;
    private readonly PH = 460;

    constructor(scene: Phaser.Scene, onClose: () => void, isHighStakes = false) {
        this.scene   = scene;
        this.onClose = onClose;
        this.isHighStakes = isHighStakes;
        if (this.isHighStakes) {
            this.betOptions = [100, 250, 500, 1000];
            this.currentBet = 250;
        } else {
            this.betOptions = [10, 25, 50, 100];
            this.currentBet = 25;
        }
        this.build();
    }

    // ── Build ─────────────────────────────────────────────────────────────────

    private build(): void {
        const { PW, PH } = this;
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Dimming overlay
        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();
        this.scene.tweens.add({ targets: this.overlay, fillAlpha: 0.76, duration: ANIM_MED });

        // Panel background (rounded rect)
        this.panelGfx = this.scene.add.graphics()
            .setScrollFactor(0).setDepth(DEPTH_PANEL);
        this.drawPanelBg();

        // Content container (entrance animation)
        this.container = this.scene.add.container(cx, cy)
            .setScrollFactor(0).setDepth(DEPTH_PANEL + 1);
        this.container.setAlpha(0).setScale(0.93);
        this.scene.tweens.add({
            targets: this.container, alpha: 1, scaleX: 1, scaleY: 1,
            duration: ANIM_MED, ease: 'Back.Out',
        });

        // ── Title ─────────────────────────────────────────────────────────
        const titleStr = this.isHighStakes ? '🏆  HIGH-STAKES SLOTS' : '🎰  SLOT MACHINE';
        const title = this.scene.add.text(0, -PH / 2 + 26, titleStr, {
            fontFamily: FONT, fontSize: '20px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        // Close button (circle X, top-right corner of panel)
        this.buildCloseButton();

        // Chips balance
        this.chipsText = this.scene.add.text(-PW / 2 + 18, -PH / 2 + 62, '', {
            fontFamily: FONT, fontSize: '12px', color: '#2ecc71', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.container.add(this.chipsText);

        // ── Reel window ────────────────────────────────────────────────────
        const reelPanelY = -26;
        this.buildReelWindow(reelPanelY);

        // ── Result text with neon glow backing ────────────────────────────
        const resultY = reelPanelY + 76;
        this.winGlowGfx = this.scene.add.graphics();
        this.winGlowGfx.setVisible(false);
        this.container.add(this.winGlowGfx);
        this.resultText = this.scene.add.text(0, resultY, '', {
            fontFamily: FONT, fontSize: '15px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(this.resultText);

        // Session stats
        this.statsText = this.scene.add.text(0, reelPanelY + 96, '', {
            fontFamily: FONT, fontSize: '10px', color: '#666688',
        }).setOrigin(0.5);
        this.container.add(this.statsText);

        // ── Bet controls + SPIN button ─────────────────────────────────────
        this.buildBetControls();
        this.buildSpinButton();

        // ── Payout hint row ────────────────────────────────────────────────
        this.buildPayoutHint();

        // ── Keyboard shortcuts ─────────────────────────────────────────────
        this.escKey   = this.scene.input.keyboard!.addKey('ESC');
        this.spaceKey = this.scene.input.keyboard!.addKey('SPACE');
        this.escKey.on('down',   () => this.close());
        this.spaceKey.on('down', () => { if (this.spinState === 'idle' && !this.spinLocked) this.spin(); });

        this.updateChipsDisplay();
        this.updateBetDisplay();
        this.updateStatsDisplay();
    }

    // ── Sub-builders ──────────────────────────────────────────────────────────

    private drawPanelBg(): void {
        const { PW, PH } = this;
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        this.panelGfx.clear();
        paintLifeSimShell(this.panelGfx, cx - PW / 2, cy - PH / 2, PW, PH);
    }

    private buildCloseButton(): void {
        const { PW, PH } = this;
        const r  = 12;
        const bx = PW / 2 - 18;
        const by = -PH / 2 + 18;

        const gfx  = this.scene.add.graphics();
        const draw = (hover: boolean): void => {
            gfx.clear();
            gfx.fillStyle(hover ? 0x622020 : 0x3a1818, 1);
            gfx.fillCircle(bx, by, r);
            gfx.lineStyle(1, hover ? 0xaa3030 : 0x773030, 0.9);
            gfx.strokeCircle(bx, by, r);
        };
        draw(false);

        const hitArea = this.scene.add.circle(bx, by, r, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const xLabel = this.scene.add.text(bx, by, '✕', {
            fontFamily: FONT, fontSize: '13px', color: '#cc4040',
        }).setOrigin(0.5);

        hitArea.on('pointerover', () => { draw(true);  xLabel.setColor('#ff5050'); });
        hitArea.on('pointerout',  () => { draw(false); xLabel.setColor('#cc4040'); });
        hitArea.on('pointerdown', () => this.close());

        this.container.add([gfx, hitArea, xLabel]);
    }

    private buildReelWindow(reelPanelY: number): void {
        const reelW = 350;
        const reelH = 118;
        const { SYMBOL_H, STRIP_LENGTH } = this;

        const reelBgGfx = this.scene.add.graphics();
        // Outer shadow
        reelBgGfx.fillStyle(0x000000, 0.5);
        reelBgGfx.fillRoundedRect(-reelW / 2 + 3, reelPanelY - reelH / 2 + 3, reelW, reelH, 8);
        // Main bg
        reelBgGfx.fillStyle(0x050510, 1);
        reelBgGfx.fillRoundedRect(-reelW / 2, reelPanelY - reelH / 2, reelW, reelH, 8);
        // Outer glow ring
        reelBgGfx.lineStyle(6, COL_SLOT_TRIM, 0.1);
        reelBgGfx.strokeRoundedRect(-reelW / 2 - 2, reelPanelY - reelH / 2 - 2, reelW + 4, reelH + 4, 10);
        // Gold border
        reelBgGfx.lineStyle(2, COL_SLOT_TRIM, 0.9);
        reelBgGfx.strokeRoundedRect(-reelW / 2, reelPanelY - reelH / 2, reelW, reelH, 8);
        // Inner glow ring — stronger
        reelBgGfx.lineStyle(2, COL_TRIM_DIM, 0.4);
        reelBgGfx.strokeRoundedRect(-reelW / 2 + 4, reelPanelY - reelH / 2 + 4, reelW - 8, reelH - 8, 6);
        // Inner center glow
        reelBgGfx.fillStyle(0x0808cc, 0.04);
        reelBgGfx.fillCircle(0, reelPanelY, reelW * 0.35);
        // Bright inner chrome ring just inside the main border
        reelBgGfx.lineStyle(2, 0x8888ff, 0.35);
        reelBgGfx.strokeRoundedRect(-reelW / 2 + 6, reelPanelY - reelH / 2 + 6, reelW - 12, reelH - 12, 5);
        // Specular highlight dots at the four corners of the reel window
        const dotAlphas = [0.55, 0.40, 0.40, 0.55];
        const dotPositions: [number, number][] = [
            [-reelW / 2 + 12, reelPanelY - reelH / 2 + 12],
            [ reelW / 2 - 12, reelPanelY - reelH / 2 + 12],
            [-reelW / 2 + 12, reelPanelY + reelH / 2 - 12],
            [ reelW / 2 - 12, reelPanelY + reelH / 2 - 12],
        ];
        dotPositions.forEach(([dx, dy], di) => {
            reelBgGfx.fillStyle(0xffffff, dotAlphas[di]);
            reelBgGfx.fillCircle(dx, dy, 3);
        });
        this.container.add(reelBgGfx);

        // Individual reel slots
        const reelXs = [-110, 0, 110];
        const rSlotW = 96;
        const rSlotH = 96;

        // The main container is at (GAME_WIDTH/2, GAME_HEIGHT/2) in screen space.
        // Reel i screen centre = (GAME_WIDTH/2 + reelXs[i], GAME_HEIGHT/2 + reelPanelY).
        const containerScreenX = GAME_WIDTH  / 2;
        const containerScreenY = GAME_HEIGHT / 2;

        for (let i = 0; i < 3; i++) {
            // ── Slot background graphics (stays fixed, drawn on main container) ──
            const rgfx = this.scene.add.graphics();
            
            // Curved metallic slot reel cylinder shading
            const startY = reelPanelY - rSlotH / 2;
            rgfx.fillStyle(0x04040a, 1);
            rgfx.fillRoundedRect(reelXs[i] - rSlotW / 2, startY, rSlotW, rSlotH, 5);
            
            // Draw horizontal shading lines to simulate physical cylinder curvature
            for (let sy = 0; sy < rSlotH; sy++) {
                const normalizedY = sy / rSlotH; // 0 to 1
                const distFromCenter = Math.abs(normalizedY - 0.5) * 2; // 0 at center, 1 at edges
                
                // Top/bottom edge shadows (simulates depth shading on a curved surface)
                const shadeAlpha = Math.pow(distFromCenter, 2.2) * 0.58;
                rgfx.fillStyle(0x000000, shadeAlpha);
                rgfx.fillRect(reelXs[i] - rSlotW / 2, startY + sy, rSlotW, 1);
                
                // Specular light glare highlight in the middle
                if (sy >= rSlotH * 0.42 && sy <= rSlotH * 0.49) {
                    const glareAlpha = (1 - Math.abs(normalizedY - 0.455) * 22) * 0.12;
                    if (glareAlpha > 0) {
                        rgfx.fillStyle(0xffffff, glareAlpha);
                        rgfx.fillRect(reelXs[i] - rSlotW / 2, startY + sy, rSlotW, 1);
                    }
                }
            }
            
            // Slot border
            rgfx.lineStyle(1, COL_SLOT_TRIM, 0.4);
            rgfx.strokeRoundedRect(reelXs[i] - rSlotW / 2, reelPanelY - rSlotH / 2, rSlotW, rSlotH, 5);
            // Inner glow center
            rgfx.fillStyle(0x3030ff, 0.04);
            rgfx.fillCircle(reelXs[i], reelPanelY, 36);
            this.container.add(rgfx);

            // ── Outer fixed container (anchor for the reel) ────────────────────
            const reelOuter = this.scene.add.container(reelXs[i], reelPanelY);
            this.container.add(reelOuter);
            this.reelOuters.push(reelOuter);

            // ── Scrolling strip container (its .y is animated during spin) ─────
            // Symbol[0..N-2] = random pre-spin filler; Symbol[N-1] = final result.
            // Positions: y = 0, -SYMBOL_H, -2*SYMBOL_H, …
            // Tween strip.y from 0 → (STRIP_LENGTH-1)*SYMBOL_H so symbol[N-1]
            // descends into the centre of the window.
            const reelStrip = this.scene.add.container(0, 0);
            reelOuter.add(reelStrip);
            this.reelStrips.push(reelStrip);

            const stripSymbols: Phaser.GameObjects.Image[] = [];
            for (let j = 0; j < STRIP_LENGTH; j++) {
                const symString = j === STRIP_LENGTH - 1 ? '🎰' : SYMBOLS[j % SYMBOLS.length];
                const key = SYMBOL_KEYS[symString] || 'slots_wild';
                const sym = this.scene.add.image(0, -j * SYMBOL_H, key)
                    .setOrigin(0.5);
                sym.setDisplaySize(76, 76);
                reelStrip.add(sym);
                stripSymbols.push(sym);
            }
            this.reelStripSymbols.push(stripSymbols);

            // ── Geometry mask — clips the strip to the 96×96 slot window ────────
            // scrollFactor=0 keeps it anchored to the fixed screen position of the
            // slot window even when the lobby camera has scrolled.
            // NOTE: mask coordinates are derived from containerScreenX/Y which equal
            // (GAME_WIDTH/2, GAME_HEIGHT/2) — the fixed screen position of this.container.
            // If the container position is ever changed, these must be updated to match.
            const maskGfx = this.scene.add.graphics();
            maskGfx.setScrollFactor(0);
            const msx = containerScreenX + reelXs[i] - rSlotW / 2;
            const msy = containerScreenY + reelPanelY - rSlotH / 2;
            maskGfx.fillStyle(0xffffff, 1);
            maskGfx.fillRect(msx, msy, rSlotW, rSlotH);
            const mask = maskGfx.createGeometryMask();
            reelStrip.setMask(mask);
            this.reelMaskGfxs.push(maskGfx);

            // ── Shadow bands drawn OVER the strip to hide overflow symbols ──────
            // These render on top of the strip, reinforcing the clip at edges.
            const bandGfx = this.scene.add.graphics();
            bandGfx.fillStyle(0x07071a, 1);
            // Top band
            bandGfx.fillRect(reelXs[i] - rSlotW / 2, reelPanelY - rSlotH / 2,
                rSlotW, rSlotH / 2 - 24);
            // Bottom band
            bandGfx.fillRect(reelXs[i] - rSlotW / 2, reelPanelY + 24,
                rSlotW, rSlotH / 2 - 24);
            this.container.add(bandGfx);
        }

        // Premium Cabinet Bezel Frame overlay
        const bezelImg = this.scene.add.image(0, reelPanelY, 'slots_bezel');
        bezelImg.setDisplaySize(reelW + 16, reelH + 16);
        this.container.add(bezelImg);

        // Pay-line
        this.payLineGfx = this.scene.add.graphics();
        this.drawPayLine(false);
        this.container.add(this.payLineGfx);
    }

    private buildBetControls(): void {
        const { PW, PH } = this;
        const betAreaY = PH / 2 - 142;

        const betLbl = this.scene.add.text(-PW / 2 + 18, betAreaY, 'BET PER SPIN:', {
            fontFamily: FONT, fontSize: '10px', color: '#667788', fontStyle: 'bold', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this.container.add(betLbl);

        // MAX BET shortcut
        const maxGfx = this.scene.add.graphics();
        const drawMax = (hover: boolean): void => {
            maxGfx.clear();
            const fill = hover
                ? (this.isHighStakes ? 0x3a0c40 : 0x222248)
                : (this.isHighStakes ? 0x200424 : 0x18183c);
            const sc = hover
                ? (this.isHighStakes ? 0xf6c855 : COL_TRIM)
                : (this.isHighStakes ? 0x8a2090 : 0x4444aa);
            maxGfx.fillStyle(fill, 1);
            maxGfx.fillRoundedRect(PW / 2 - 82, betAreaY - 13, 72, 26, 4);
            maxGfx.lineStyle(1, sc, 0.8);
            maxGfx.strokeRoundedRect(PW / 2 - 82, betAreaY - 13, 72, 26, 4);
        };
        drawMax(false);
        const maxHit = this.scene.add.rectangle(PW / 2 - 46, betAreaY, 72, 26, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const maxLbl = this.scene.add.text(PW / 2 - 46, betAreaY, 'MAX BET', {
            fontFamily: FONT, fontSize: '9px', color: '#8888cc', fontStyle: 'bold',
        }).setOrigin(0.5);
        maxHit.on('pointerover', () => { drawMax(true);  maxLbl.setColor('#c9a84c'); });
        maxHit.on('pointerout',  () => { drawMax(false); maxLbl.setColor('#8888cc'); });
        maxHit.on('pointerdown', () => {
            const chips = GameState.get().chips;
            let newBet = this.betOptions[0];
            for (let i = this.betOptions.length - 1; i >= 0; i--) {
                if (chips >= this.betOptions[i]) { newBet = this.betOptions[i]; break; }
            }
            this.currentBet = newBet;
            this.updateBetDisplay();
        });
        this.container.add([maxGfx, maxHit, maxLbl]);

        // Bet amount buttons
        const btnW = 56;
        const btnH = 30;
        const total = this.betOptions.length * btnW + (this.betOptions.length - 1) * 8;
        const startX = -total / 2 + btnW / 2;
        const btnY = betAreaY + 24;

        this.betOptions.forEach((amount, i) => {
            const bx = startX + i * (btnW + 8);
            const gfx = this.scene.add.graphics();

            const drawBtn = (selected: boolean, canAfford: boolean): void => {
                gfx.clear();
                const fill = selected
                    ? (this.isHighStakes ? 0x4a0e4f : 0x2a2a60)
                    : canAfford
                        ? (this.isHighStakes ? 0x240828 : 0x18183c)
                        : (this.isHighStakes ? 0x100412 : 0x10101e);
                const sc = selected
                    ? (this.isHighStakes ? 0xf6c855 : COL_SLOT_TRIM)
                    : canAfford
                        ? (this.isHighStakes ? 0x8a2090 : 0x444488)
                        : (this.isHighStakes ? 0x300c35 : 0x282820);
                const sa   = selected ? 1 : canAfford ? 0.6 : 0.3;
                gfx.fillStyle(fill, 1);
                gfx.fillRoundedRect(bx - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
                gfx.lineStyle(selected ? 1.5 : 1, sc, sa);
                gfx.strokeRoundedRect(bx - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
            };

            const chips = GameState.get().chips;
            drawBtn(amount === this.currentBet, chips >= amount);

            const hitRect = this.scene.add.rectangle(bx, btnY, btnW, btnH, 0x000000, 0)
                .setInteractive({ useHandCursor: true });
            const lbl = this.scene.add.text(bx, btnY, `${amount}`, {
                fontFamily: FONT, fontSize: '13px',
                color: amount === this.currentBet ? '#c9a84c' : '#8888bb',
            }).setOrigin(0.5);

            hitRect.on('pointerdown', () => {
                if (GameState.get().chips < amount) return;
                this.currentBet = amount;
                this.updateBetDisplay();
            });

            this.container.add([gfx, hitRect, lbl]);
            this.betBtns.push({ gfx, label: lbl, amount });
        });

        this.betText = this.scene.add.text(0, btnY + 26, '', {
            fontFamily: FONT, fontSize: '11px', color: '#9090cc',
        }).setOrigin(0.5);
        this.container.add(this.betText);
    }

    private buildSpinButton(): void {
        const { PH } = this;
        const btnW = 210;
        const btnH = 44;
        const btnY = PH / 2 - 74;

        this.spinBtnGfx = this.scene.add.graphics();
        this.drawSpinButton('idle');

        this.spinBtnLabel = this.scene.add.text(0, btnY, 'SPIN', {
            fontFamily: FONT, fontSize: '17px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);

        const spaceHint = this.scene.add.text(btnW / 2 - 4, btnY, '[SPACE]', {
            fontFamily: FONT, fontSize: '8px', color: '#3a2a5a',
        }).setOrigin(1, 0.5);

        this.spinBtnHit = this.scene.add.rectangle(0, btnY, btnW, btnH, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        this.spinBtnHit.on('pointerover', () => { if (this.spinState === 'idle') this.drawSpinButton('hover'); });
        this.spinBtnHit.on('pointerout',  () => { if (this.spinState === 'idle') this.drawSpinButton('idle'); });
        this.spinBtnHit.on('pointerdown', () => {
            if (this.spinState === 'idle') { this.drawSpinButton('press'); this.spin(); }
        });
        this.spinBtnHit.on('pointerup',   () => { if (this.spinState === 'idle') this.drawSpinButton('hover'); });

        this.container.add([this.spinBtnGfx, this.spinBtnLabel, spaceHint, this.spinBtnHit]);
    }

    private drawSpinButton(state: 'idle' | 'hover' | 'press' | 'spinning'): void {
        const { PH } = this;
        const btnW = 210;
        const btnH = 44;
        const btnY = PH / 2 - 74;
        const r = 6;
        const g = this.spinBtnGfx;
        g.clear();

        const fills: Record<typeof state, number> = {
            idle: this.isHighStakes ? 0x4a0e4f : 0x2e1a58,
            hover: this.isHighStakes ? 0x6e1b75 : 0x4a2a88,
            press: this.isHighStakes ? 0x2d0532 : 0x1e0e3a,
            spinning: this.isHighStakes ? 0x240828 : 0x1a1238,
        };
        const strokeC: Record<typeof state, number> = {
            idle: this.isHighStakes ? 0xf6c855 : COL_SLOT_TRIM,
            hover: this.isHighStakes ? 0xffe885 : COL_TRIM_LIGHT,
            press: this.isHighStakes ? 0xcba84a : COL_TRIM_DIM,
            spinning: this.isHighStakes ? 0x5a1860 : 0x443366,
        };
        const strokeA: Record<typeof state, number> = {
            idle: 0.85, hover: 1, press: 0.7, spinning: 0.4,
        };

        const glowColor = this.isHighStakes ? 0xf6c855 : COL_TRIM;

        // Outer glow on hover
        if (state === 'hover') {
            g.lineStyle(8, glowColor, 0.08);
            g.strokeRoundedRect(-btnW / 2 - 3, btnY - btnH / 2 - 3, btnW + 6, btnH + 6, r + 3);
        }
        // Shadow
        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(-btnW / 2 + 2, btnY - btnH / 2 + 3, btnW, btnH, r + 1);
        // Fill
        g.fillStyle(fills[state], 1);
        g.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, r);
        // Chrome metallic left strip
        g.fillStyle(0xffffff, 0.06);
        g.fillRoundedRect(-btnW / 2 + 1, btnY - btnH / 2 + 2, 3, btnH - 4, { tl: r - 1, bl: r - 1, tr: 0, br: 0 });
        // Top gloss
        if (state !== 'spinning') {
            g.fillStyle(0xffffff, state === 'hover' ? 0.08 : 0.05);
            g.fillRoundedRect(-btnW / 2 + 3, btnY - btnH / 2 + 3, btnW - 6, btnH / 2 - 3, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
        }
        // Bottom shadow band
        g.fillStyle(0x000000, 0.2);
        g.fillRoundedRect(-btnW / 2 + 3, btnY + btnH / 2 - 6, btnW - 6, 4, { tl: 0, tr: 0, bl: r - 1, br: r - 1 });
        // Border
        g.lineStyle(1.5, strokeC[state], strokeA[state]);
        g.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, r);
        // Inner subtle border
        if (state !== 'spinning') {
            g.lineStyle(0.5, strokeC[state], strokeA[state] * 0.4);
            g.strokeRoundedRect(-btnW / 2 + 3, btnY - btnH / 2 + 3, btnW - 6, btnH - 6, r - 2);
        }
        // Mid glow on hover
        if (state === 'hover') {
            g.lineStyle(3, glowColor, 0.15);
            g.strokeRoundedRect(-btnW / 2 - 1, btnY - btnH / 2 - 1, btnW + 2, btnH + 2, r + 1);
        }
    }

    private buildPayoutHint(): void {
        const { PH, PW } = this;
        const tableY = PH / 2 - 34;

        const tgfx = this.scene.add.graphics();
        tgfx.fillStyle(COL_UI_BG2, 0.7);
        tgfx.fillRoundedRect(-PW / 2 + 14, tableY - 26, PW - 28, 36, 4);
        tgfx.lineStyle(1, COL_UI_BORDER_DIM, 0.2);
        tgfx.strokeRoundedRect(-PW / 2 + 14, tableY - 26, PW - 28, 36, 4);
        this.container.add(tgfx);

        const allPayouts = [
            { s: '7️⃣×3', m: '50×', c: '#ffd700' },
            { s: '💎×3', m: '20×', c: '#80c8ff' },
            { s: '⭐×3',  m: '10×', c: '#e0e050' },
            { s: '🍇×3', m: '6×',  c: '#c070e0' },
            { s: '🍊×3', m: '4×',  c: '#f0a040' },
            { s: '🍋×3', m: '3×',  c: '#e0e040' },
            { s: '🍒×3', m: '2×',  c: '#e06060' },
            { s: '🍒×2', m: '1×',  c: '#c04040' },
        ];
        const colW = (PW - 40) / 4;
        // Row 1: first 4 (highest payouts)
        allPayouts.slice(0, 4).forEach((p, i) => {
            const px = -PW / 2 + 20 + i * colW + colW / 2;
            this.container.add(this.scene.add.text(px, tableY - 15, `${p.s}=${p.m}`, {
                fontFamily: FONT, fontSize: '8px', color: p.c,
            }).setOrigin(0.5));
        });
        // Row 2: last 4 (lower payouts)
        allPayouts.slice(4).forEach((p, i) => {
            const px = -PW / 2 + 20 + i * colW + colW / 2;
            this.container.add(this.scene.add.text(px, tableY - 4, `${p.s}=${p.m}`, {
                fontFamily: FONT, fontSize: '8px', color: p.c,
            }).setOrigin(0.5));
        });
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────

    private drawPayLine(active: boolean, customColor?: number): void {
        const g = this.payLineGfx;
        g.clear();
        if (active) {
            const glowCol = customColor ?? COL_TRIM_LIGHT;
            const coreCol = customColor !== undefined ? customColor : 0xffffff;
            // Win celebration — bright visible payline with outer glow
            g.lineStyle(8, glowCol, 0.15);
            g.lineBetween(-175, -26, 175, -26);
            g.lineStyle(4, glowCol, 0.35);
            g.lineBetween(-175, -26, 175, -26);
            g.lineStyle(2, coreCol, 0.9);
            g.lineBetween(-175, -26, 175, -26);
        } else {
            g.lineStyle(1.5, COL_SLOT_TRIM, 0.3);
            g.lineBetween(-175, -26, 175, -26);
        }
    }

    // ── Display updates ───────────────────────────────────────────────────────

    private updateChipsDisplay(): void {
        this.chipsText.setText(`◈ ${GameState.get().chips.toLocaleString()} chips`);
    }

    private updateStatsDisplay(): void {
        if (this.totalSpins === 0) { this.statsText.setText(''); return; }
        const net    = this.totalWon - this.totalWagered;
        const netStr = net >= 0 ? `+${net}` : `${net}`;
        const col    = net >= 0 ? '#2ecc71' : '#e74c3c';
        let streak   = '';
        if (this.winStreak >= 3)        streak = `  🔥×${this.winStreak}`;
        else if (this.maxWinStreak >= 3) streak = `  best:${this.maxWinStreak}`;
        this.statsText.setText(`Spins: ${this.totalSpins}  ·  Net: ${netStr}◈${streak}`).setColor(col);
    }

    private updateBetDisplay(): void {
        const chips = GameState.get().chips;
        this.betBtns.forEach(({ gfx, label, amount }) => {
            const sel  = this.currentBet === amount;
            const can  = chips >= amount || this.freeSpins > 0;
            const bx   = label.x;
            const by   = label.y;
            const bw   = 56;
            const bh   = 30;
            gfx.clear();
            const fill = sel
                ? (this.isHighStakes ? 0x4a0e4f : 0x2a2a60)
                : can
                    ? (this.isHighStakes ? 0x240828 : 0x18183c)
                    : (this.isHighStakes ? 0x100412 : 0x10101e);
            const sc = sel
                ? (this.isHighStakes ? 0xf6c855 : COL_SLOT_TRIM)
                : can
                    ? (this.isHighStakes ? 0x8a2090 : 0x444488)
                    : (this.isHighStakes ? 0x300c35 : 0x282820);
            const sa = sel ? 1 : can ? 0.6 : 0.3;
            gfx.fillStyle(fill, 1);
            gfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
            gfx.lineStyle(sel ? 1.5 : 1, sc, sa);
            gfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
            label.setColor(sel ? '#c9a84c' : can ? '#8888bb' : '#443344');
        });
        if (this.freeSpins > 0) {
            this.betText.setText(`FREE SPINS: ${this.freeSpins} left! (2x)`).setColor('#e0c060');
        } else {
            this.betText.setText(`Bet: ${this.currentBet} ◈`).setColor('#9090cc');
        }
        if (this.spinState === 'idle') {
            this.spinBtnLabel.setText(this.freeSpins > 0 ? 'FREE SPIN' : 'SPIN');
        }
    }

    // ── Spin logic ────────────────────────────────────────────────────────────

    private spin(): void {
        if (this.spinState !== 'idle') return;

        const isFreeSpin = this.freeSpins > 0;
        this.wasFreeSpin = isFreeSpin;
        const chips = GameState.get().chips;
        if (!isFreeSpin && chips < this.currentBet) {
            this.showResult(`Need ${this.currentBet - chips} more chips!`, '#e74c3c');
            return;
        }

        let finalSymbols: string[];
        if (GameState.hasBuff('guaranteedSlotsWin')) {
            const winSym = weightedRandom();
            finalSymbols = [winSym, winSym, winSym];
            GameState.consumeBuff('guaranteedSlotsWin');
        } else {
            finalSymbols = [weightedRandom(), weightedRandom(), weightedRandom()];
        }

        // Clear stale timer refs
        this.spinTimers = [];
        // Cancel any previous spin tweens
        this.reelSpinTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
        this.reelSpinTweens = [null, null, null];

        if (isFreeSpin) {
            this.freeSpins--;
            this.updateBetDisplay();
        } else {
            GameState.addChips(-this.currentBet);
            GameState.consumeBuff('slotsLuck');
        }

        SoundManager.playClick();   // coin-drop feedback on wager
        this.totalSpins++;
        this.totalWagered += isFreeSpin ? 0 : this.currentBet;
        GameState.recordStat('slotsSpins', 1);
        GameState.recordStat('slotsWagered', isFreeSpin ? 0 : this.currentBet);
        this.updateChipsDisplay();

        this.spinState = 'spinning';
        this.drawSpinButton('spinning');
        this.spinBtnLabel.setText('SPINNING...').setColor('#554466');
        this.resultText.setText('');
        this.drawPayLine(false);
        this.spinDone = [false, false, false];

        SoundManager.playSlotSpin();

        const { STRIP_LENGTH, SYMBOL_H } = this;
        // Reel 0 stops first (720 ms), reel 1 second (1280 ms), reel 2 last (1840 ms)
        // Stretched slightly to allow anticipation and high-speed spin appreciation
        const stopDelays = [720, 1280, 1840];
        
        // Near-miss tension! If first two symbols match and are premium, spin 3rd reel longer
        if (finalSymbols[0] === finalSymbols[1] && (PAYOUTS[finalSymbols[0]] ?? 0) >= 6) {
            stopDelays[2] = 2800; // Extra tension delay for the 3rd reel!
        }
        // Total scroll distance = (STRIP_LENGTH-1) * SYMBOL_H
        const totalTravel = (STRIP_LENGTH - 1) * SYMBOL_H;

        for (let i = 0; i < 3; i++) {
            // Populate strip: random symbols for 0..N-2, final symbol at N-1
            const symbols = this.reelStripSymbols[i];
            for (let j = 0; j < STRIP_LENGTH - 1; j++) {
                const randSym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
                symbols[j].setTexture(SYMBOL_KEYS[randSym]);
                symbols[j].setDisplaySize(76, 76);
            }
            symbols[STRIP_LENGTH - 1].setTexture(SYMBOL_KEYS[finalSymbols[i]]);
            symbols[STRIP_LENGTH - 1].setDisplaySize(76, 76);

            // Reset strip to top (symbol[0] visible at centre of window)
            this.reelStrips[i].setY(0);

            // 1. Anticipation nudge: pull the reel up slightly first
            const reelIdx = i;
            this.scene.tweens.add({
                targets: this.reelStrips[i],
                y: -20,
                duration: 160 + i * 40, // Staggered start nudge
                ease: 'Quad.easeIn',
                onComplete: () => {
                    if (this.closed) return;
                    
                    // 2. High-speed spin down with overshoot and settle (Back.easeOut)
                    const spinTween = this.scene.tweens.add({
                        targets: this.reelStrips[reelIdx],
                        y: totalTravel,
                        duration: stopDelays[reelIdx],
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            if (this.closed) return;
                            this.reelValues[reelIdx] = finalSymbols[reelIdx];

                            // Bounce scale on landing symbol
                            this.scene.tweens.add({
                                targets: symbols[STRIP_LENGTH - 1],
                                scaleX: 1.16, scaleY: 1.16,
                                yoyo: true, duration: 100, ease: 'Quad.easeOut',
                            });

                            SoundManager.playReelStop(reelIdx);

                            this.spinDone[reelIdx] = true;
                            if (this.spinDone.every(d => d)) this.evalResult();
                        },
                    });
                    this.reelSpinTweens[reelIdx] = spinTween;
                }
            });
        }
    }

    private evalResult(): void {
        if (this.closed) return;
        this.spinState = 'result';
        this.drawSpinButton('spinning');
        this.spinBtnLabel.setText('SPIN').setColor('#554466');
        this.spinTimers = [];

        const [a, b, c] = this.reelValues;
        const res: SpinResult = evaluateSpin(this.reelValues, this.currentBet, this.wasFreeSpin);
        
        let payout = res.payout;
        let jackpot = res.isJackpot;
        let msg    = '';
        let msgCol = '#c9a84c';

        if (res.addedSpins > 0) {
            this.freeSpins += res.addedSpins;
            msg = `★ SCATTER! +${res.addedSpins} Free Spins! ★\n`;
            msgCol = '#e0c060';
            this.updateBetDisplay();
        }

        // ── Three of a kind ───────────────────────────────────────────────────
        if (res.isJackpot || (res.isWin && a === b && b === c && a !== '🎰')) {
            msg     += jackpot ? `★ JACKPOT!  7️⃣×3  +${payout}◈ ★` : `3×${a}  +${payout}◈`;
            msgCol  = '#2ecc71';
        } else if (res.isCherryPair) {
            msg    += `Cherry pair!  +${payout}◈`;
            msgCol = msg === '' ? '#f0a040' : msgCol;
        } else if (res.nearMissSymbol) {
            const matchPair = res.nearMissSymbol;
            msg    = `So close!  ${matchPair}${matchPair} and a ${matchPair === a ? c : a} — almost! 😤`;
            msgCol = '#f0a040';
            // Near-miss payline flash — amber pulse
            this.drawPayLine(true, 0xff8800);
            this.scene.time.delayedCall(400, () => {
                if (!this.closed) this.drawPayLine(false);
            });
        } else if (res.scatters < 2) {
            msg    = 'No match — try again';
            msgCol = '#666688';
        }

        if (payout > 0) {
            this.totalWon += payout;
            this.winStreak++;
            if (this.winStreak > this.maxWinStreak) this.maxWinStreak = this.winStreak;
            GameState.addChips(payout);
            GameState.recordStat('slotsWon', payout);
            GameState.recordMaxStat('slotsMaxWin', payout);
            GameState.recordStat('slotsWinStreak', 1);
            GameState.recordMaxStat('slotsMaxWinStreak', GameState.get().stats.slotsWinStreak);
            this.updateChipsDisplay();
            this.showChipDelta(`+${payout}◈`, '#2ecc71');
            this.drawPayLine(true);

            // Animate the final (landing) symbol in each strip
            const finalSymTexts = this.reelStripSymbols.map(s => s[this.STRIP_LENGTH - 1]);

            if (jackpot) {
                this.scene.tweens.add({
                    targets: finalSymTexts, scaleX: 1.4, scaleY: 1.4,
                    yoyo: true, duration: 100, repeat: 6,
                });
                this.scene.tweens.add({
                    targets: this.payLineGfx, alpha: 0,
                    yoyo: true, duration: 70, repeat: 10,
                    onComplete: () => { this.drawPayLine(false); this.payLineGfx.setAlpha(1); },
                });
                SoundManager.playJackpot();
                ToastManager.show(this.scene, `JACKPOT!  +${payout} ◈`, 'jackpot');
            } else {
                this.scene.tweens.add({
                    targets: finalSymTexts, scaleX: 1.14, scaleY: 1.14,
                    yoyo: true, duration: 130, repeat: 2,
                });
                this.scene.time.delayedCall(600, () => this.drawPayLine(false));
                SoundManager.playWin(payout);
                ToastManager.show(this.scene, `+${payout} ◈`, 'win');
            }
        } else {
            this.winStreak = 0;
            this.showChipDelta(`-${this.currentBet}◈`, '#e74c3c');
            GameState.update({
                stats: {
                    ...GameState.get().stats,
                    slotsWinStreak: 0
                }
            });
        }

        this.showResult(msg, msgCol);
        this.updateStatsDisplay();

        const idleTimer = this.scene.time.delayedCall(500, () => {
            if (this.closed) return;
            this.spinLocked = false;
            this.spinState = 'idle';
            this.drawSpinButton('idle');
            this.spinBtnLabel.setColor('#c9a84c');
            this.updateBetDisplay();
            this.checkLowChips();
        });
        this.spinTimers.push(idleTimer);
        // Set spinLocked immediately so the SPACE key can't fire during the 500ms
        this.spinLocked = true;
    }

    // ── UI helpers ────────────────────────────────────────────────────────────

    /** Show a brief floating chip gain/loss indicator near the reels. */
    private showChipDelta(text: string, color: string): void {
        const delta = this.scene.add.text(0, -116, text, {
            fontFamily: FONT, fontSize: '18px', color, fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_PANEL + 5);
        this.container.add(delta);
        this.scene.tweens.add({
            targets: delta, y: -148, alpha: 0, duration: 1000, ease: 'Cubic.easeOut',
            onComplete: () => delta.destroy(),
        });
    }

    private showResult(msg: string, color: string): void {
        this.resultText.setText(msg).setColor(color);

        // Neon glow halo behind result text (visible for wins)
        const isWin = msg.includes('+') || msg.toUpperCase().includes('JACKPOT') || msg.includes('🎉') || msg.includes('✨');
        const g = this.winGlowGfx;
        g.clear();
        if (isWin && msg.trim().length > 0) {
            const ry = this.resultText.y;
            const glowColor = 0xc9a84c;
            g.fillStyle(glowColor, 0.06);
            g.fillEllipse(0, ry, 280, 44);
            g.fillStyle(glowColor, 0.10);
            g.fillEllipse(0, ry, 200, 32);
            g.lineStyle(1, glowColor, 0.25);
            g.strokeEllipse(0, ry, 210, 34);
            
            g.setVisible(true);
            g.setAlpha(1.0);

            // Breathe the win glow halo
            this.scene.tweens.add({
                targets: g,
                alpha: 0.35,
                yoyo: true,
                repeat: 3,
                duration: 250
            });

            // Trigger sparkle particle burst
            this.spawnWinParticles();
        } else {
            g.setVisible(false);
        }

        this.scene.tweens.add({
            targets: this.resultText,
            scaleX: [1.15, 1], scaleY: [1.15, 1],
            duration: 200, ease: 'Back.Out',
        });
    }

    private spawnWinParticles(count: number = 26): void {
        if (this.closed) return;
        const colors = [0xffd700, 0xffe0a0, 0xffffff, 0xc9a84c];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 80;
            const startX = (Math.random() - 0.5) * 160;
            const startY = this.resultText.y + (Math.random() - 0.5) * 10;

            const p = this.scene.add.graphics();
            const col = Phaser.Utils.Array.GetRandom(colors);
            p.fillStyle(col, 0.95);
            p.fillCircle(0, 0, 1.5 + Math.random() * 2);
            p.setPosition(startX, startY);
            this.container.add(p);

            this.scene.tweens.add({
                targets: p,
                x: startX + Math.cos(angle) * dist,
                y: startY + Math.sin(angle) * dist - (10 + Math.random() * 20),
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 600 + Math.random() * 450,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    if (!this.closed && p && p.destroy) {
                        p.destroy();
                    }
                }
            });
        }
    }

    private checkLowChips(): void {
        const chips = GameState.get().chips;
        if (chips > 0 && chips < this.currentBet) {
            const affordable = this.betOptions.filter(b => b <= chips);
            this.currentBet = affordable.length > 0
                ? affordable[affordable.length - 1]
                : this.betOptions[0];
            this.updateBetDisplay();
        }
        if (chips < this.betOptions[0]) this.showFreeChipsOffer();
    }

    private showFreeChipsOffer(): void {
        if (this.freeChipsContainer) return;

        const gfx = this.scene.add.graphics();
        const draw = (hover: boolean): void => {
            gfx.clear();
            gfx.fillStyle(hover ? 0x203010 : 0x142008, 1);
            gfx.fillRoundedRect(-120, 215, 240, 28, 5);
            gfx.lineStyle(1, hover ? 0x6acc30 : 0x4a8a1a, 0.9);
            gfx.strokeRoundedRect(-120, 215, 240, 28, 5);
        };
        draw(false);

        const label = this.scene.add.text(0, 229, '🎁 FREE 500 CHIPS — RELOAD', {
            fontFamily: FONT, fontSize: '10px', color: '#6acc30', fontStyle: 'bold',
        }).setOrigin(0.5);

        const hit = this.scene.add.rectangle(0, 229, 240, 28, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => draw(true));
        hit.on('pointerout',  () => draw(false));
        hit.on('pointerdown', () => {
            GameState.addChips(500);
            this.currentBet = this.betOptions[1];
            this.updateChipsDisplay();
            this.updateBetDisplay();
            this.updateStatsDisplay();
            this.showResult('🎁 500 free chips added!', '#6acc30');
            ToastManager.show(this.scene, '🎁 Free reload: +500 ◈', 'info');
            this.freeChipsContainer?.destroy();
            this.freeChipsContainer = null;
        });

        this.freeChipsContainer = this.scene.add.container(0, 0, [gfx, label, hit]);
        this.container.add(this.freeChipsContainer);
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    private close(): void {
        if (this.closed) return;
        this.closed = true;
        // Cancel any active spin tweens
        this.reelSpinTweens.forEach(t => { if (t && t.isPlaying()) t.stop(); });
        this.reelStrips.forEach(strip => { this.scene.tweens.killTweensOf(strip); });
        this.spinTimers.forEach(t => t.remove());
        // Destroy mask graphics — they live outside the container and must be
        // cleaned up explicitly.  Guard with active check as a safety net.
        this.reelMaskGfxs.forEach(g => { if (g.active) g.destroy(); });
        this.escKey.destroy();
        this.spaceKey.destroy();
        this.overlay.destroy();
        this.panelGfx.destroy();
        this.container.destroy(true);
        this.onClose();
    }
}
