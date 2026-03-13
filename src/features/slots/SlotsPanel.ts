// ── Playable slot machine minigame ────────────────────────────────────────────
// Three reels, configurable bet, payout table, win/loss feedback.
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_UI_BG2, COL_UI_BORDER_DIM,
    COL_TRIM, COL_TRIM_LIGHT, COL_TRIM_DIM,
    COL_SLOT_BODY, COL_SLOT_TRIM,
    FONT, PANEL_RADIUS, ANIM_MED,
} from '../../game/constants';

const SYMBOLS  = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
const WEIGHTS  = [30, 25, 20, 12, 7, 4, 2];  // weighted rarity (lower = rarer)

// Payout multipliers for matching symbols (3-of-a-kind)
const PAYOUTS: Record<string, number> = {
    '🍒': 2, '🍋': 3, '🍊': 4, '🍇': 6, '⭐': 10, '💎': 20, '7️⃣': 50,
};
const CHERRY_PAIR_PAYOUT = 1;   // Two cherries = small consolation

function weightedRandom(): string {
    const total = WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < SYMBOLS.length; i++) {
        r -= WEIGHTS[i];
        if (r <= 0) return SYMBOLS[i];
    }
    return SYMBOLS[0];
}

type SpinState = 'idle' | 'spinning' | 'result';
const BET_OPTIONS = [10, 25, 50, 100];

export class SlotsPanel {
    private scene:   Phaser.Scene;
    private onClose: () => void;

    // Phaser objects
    private overlay!:      Phaser.GameObjects.Rectangle;
    private panelGfx!:     Phaser.GameObjects.Graphics;
    private container!:    Phaser.GameObjects.Container;
    private reelTexts:     Phaser.GameObjects.Text[] = [];
    private payLineGfx!:   Phaser.GameObjects.Graphics;
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
    private currentBet:   number    = 25;
    private reelValues:   string[]  = ['🎰', '🎰', '🎰'];
    private spinTimers:   Phaser.Time.TimerEvent[] = [];
    private spinDone:     boolean[] = [false, false, false];
    private closed:       boolean   = false;

    // Session stats
    private totalSpins   = 0;
    private totalWon     = 0;
    private totalWagered = 0;
    private winStreak    = 0;
    private maxWinStreak = 0;

    // Layout
    private readonly PW = 520;
    private readonly PH = 460;

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene   = scene;
        this.onClose = onClose;
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
        const title = this.scene.add.text(0, -PH / 2 + 26, '🎰  SLOT MACHINE', {
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

        // ── Result text ────────────────────────────────────────────────────
        this.resultText = this.scene.add.text(0, reelPanelY + 76, '', {
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
        this.spaceKey.on('down', () => { if (this.spinState === 'idle') this.spin(); });

        this.updateChipsDisplay();
        this.updateBetDisplay();
        this.updateStatsDisplay();
    }

    // ── Sub-builders ──────────────────────────────────────────────────────────

    private drawPanelBg(): void {
        const { PW, PH } = this;
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const px = cx - PW / 2;
        const py = cy - PH / 2;
        const g  = this.panelGfx;
        g.clear();

        // Outer shadow
        g.fillStyle(0x000000, 0.55);
        g.fillRoundedRect(px + 5, py + 6, PW, PH, PANEL_RADIUS + 2);
        // Body — deep blue-black
        g.fillStyle(COL_SLOT_BODY, 1);
        g.fillRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Metallic left edge highlight
        g.fillStyle(0x1c1c5a, 0.35);
        g.fillRoundedRect(px, py, 6, PH, { tl: PANEL_RADIUS, bl: PANEL_RADIUS, tr: 0, br: 0 });
        // Metallic right edge shadow
        g.fillStyle(0x000000, 0.2);
        g.fillRoundedRect(px + PW - 6, py, 6, PH, { tl: 0, bl: 0, tr: PANEL_RADIUS, br: PANEL_RADIUS });
        // Header band
        g.fillStyle(0x0d0d28, 1);
        g.fillRoundedRect(px, py, PW, 52, { tl: PANEL_RADIUS, tr: PANEL_RADIUS, bl: 0, br: 0 });
        // Header inner highlight
        g.fillStyle(0x1a1a4a, 0.4);
        g.fillRoundedRect(px + 2, py + 2, PW - 4, 20, { tl: PANEL_RADIUS - 1, tr: PANEL_RADIUS - 1, bl: 0, br: 0 });
        // Gold border
        g.lineStyle(2, COL_SLOT_TRIM, 0.9);
        g.strokeRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Inner inset
        g.lineStyle(1, COL_TRIM_DIM, 0.20);
        g.strokeRoundedRect(px + 3, py + 3, PW - 6, PH - 6, PANEL_RADIUS - 1);
        // Header divider
        g.lineStyle(1.5, COL_TRIM, 0.5);
        g.lineBetween(px + 16, py + 52, px + PW - 16, py + 52);
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
        this.container.add(reelBgGfx);

        // Individual reel slots
        const reelXs = [-110, 0, 110];
        const rSlotW = 96;
        const rSlotH = 96;

        for (let i = 0; i < 3; i++) {
            const rgfx = this.scene.add.graphics();
            // Slot bg
            rgfx.fillStyle(0x07071a, 1);
            rgfx.fillRoundedRect(reelXs[i] - rSlotW / 2, reelPanelY - rSlotH / 2, rSlotW, rSlotH, 5);
            // Slot border
            rgfx.lineStyle(1, COL_SLOT_TRIM, 0.4);
            rgfx.strokeRoundedRect(reelXs[i] - rSlotW / 2, reelPanelY - rSlotH / 2, rSlotW, rSlotH, 5);
            // Inner shadow at top/bottom
            rgfx.fillStyle(0x000000, 0.45);
            rgfx.fillRoundedRect(reelXs[i] - rSlotW / 2, reelPanelY - rSlotH / 2, rSlotW, 14, { tl: 5, tr: 5, bl: 0, br: 0 });
            rgfx.fillRoundedRect(reelXs[i] - rSlotW / 2, reelPanelY + rSlotH / 2 - 14, rSlotW, 14, { tl: 0, tr: 0, bl: 5, br: 5 });
            // Inner glow center
            rgfx.fillStyle(0x3030ff, 0.04);
            rgfx.fillCircle(reelXs[i], reelPanelY, 36);
            this.container.add(rgfx);

            const reel = this.scene.add.text(reelXs[i], reelPanelY, '🎰', {
                fontFamily: FONT, fontSize: '44px',
            }).setOrigin(0.5);
            this.container.add(reel);
            this.reelTexts.push(reel);
        }

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
            maxGfx.fillStyle(hover ? 0x222248 : 0x18183c, 1);
            maxGfx.fillRoundedRect(PW / 2 - 82, betAreaY - 13, 72, 26, 4);
            maxGfx.lineStyle(1, hover ? COL_TRIM : 0x4444aa, 0.8);
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
            let newBet = BET_OPTIONS[0];
            for (let i = BET_OPTIONS.length - 1; i >= 0; i--) {
                if (chips >= BET_OPTIONS[i]) { newBet = BET_OPTIONS[i]; break; }
            }
            this.currentBet = newBet;
            this.updateBetDisplay();
        });
        this.container.add([maxGfx, maxHit, maxLbl]);

        // Bet amount buttons
        const btnW = 56;
        const btnH = 30;
        const total = BET_OPTIONS.length * btnW + (BET_OPTIONS.length - 1) * 8;
        const startX = -total / 2 + btnW / 2;
        const btnY = betAreaY + 24;

        BET_OPTIONS.forEach((amount, i) => {
            const bx = startX + i * (btnW + 8);
            const gfx = this.scene.add.graphics();

            const drawBtn = (selected: boolean, canAfford: boolean): void => {
                gfx.clear();
                const fill = selected ? 0x2a2a60 : canAfford ? 0x18183c : 0x10101e;
                const sc   = selected ? COL_SLOT_TRIM : canAfford ? 0x444488 : 0x282820;
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
            idle: 0x2e1a58, hover: 0x4a2a88, press: 0x1e0e3a, spinning: 0x1a1238,
        };
        const strokeC: Record<typeof state, number> = {
            idle: COL_SLOT_TRIM, hover: COL_TRIM_LIGHT, press: COL_TRIM_DIM, spinning: 0x443366,
        };
        const strokeA: Record<typeof state, number> = {
            idle: 0.85, hover: 1, press: 0.7, spinning: 0.4,
        };

        // Outer glow on hover
        if (state === 'hover') {
            g.lineStyle(8, COL_TRIM, 0.08);
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
            g.lineStyle(3, COL_TRIM, 0.15);
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

    private drawPayLine(active: boolean): void {
        const g = this.payLineGfx;
        g.clear();
        if (active) {
            // Win celebration — bright visible payline with outer glow
            g.lineStyle(8, COL_TRIM_LIGHT, 0.15);
            g.lineBetween(-175, -26, 175, -26);
            g.lineStyle(4, COL_TRIM_LIGHT, 0.35);
            g.lineBetween(-175, -26, 175, -26);
            g.lineStyle(2, 0xffffff, 0.9);
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
            const can  = chips >= amount;
            const bx   = label.x;
            const by   = label.y;
            const bw   = 56;
            const bh   = 30;
            gfx.clear();
            gfx.fillStyle(sel ? 0x2a2a60 : can ? 0x18183c : 0x10101e, 1);
            gfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
            gfx.lineStyle(sel ? 1.5 : 1, sel ? COL_SLOT_TRIM : can ? 0x444488 : 0x282820, sel ? 1 : can ? 0.6 : 0.3);
            gfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
            label.setColor(sel ? '#c9a84c' : can ? '#8888bb' : '#443344');
        });
        this.betText.setText(`Bet: ${this.currentBet} ◈`);
    }

    // ── Spin logic ────────────────────────────────────────────────────────────

    private spin(): void {
        if (this.spinState !== 'idle') return;

        const chips = GameState.get().chips;
        if (chips < this.currentBet) {
            this.showResult(`Need ${this.currentBet - chips} more chips!`, '#e74c3c');
            return;
        }

        // Clear any stale timer references before new spin
        this.spinTimers = [];

        GameState.addChips(-this.currentBet);
        this.totalSpins++;
        this.totalWagered += this.currentBet;
        this.updateChipsDisplay();

        this.spinState = 'spinning';
        this.drawSpinButton('spinning');
        this.spinBtnLabel.setText('SPINNING...').setColor('#554466');
        this.resultText.setText('');
        this.drawPayLine(false);
        this.spinDone = [false, false, false];

        const stopDelays = [620, 1080, 1540];

        for (let i = 0; i < 3; i++) {
            const rollTimer = this.scene.time.addEvent({
                delay: 75,
                repeat: -1,
                callback: () => {
                    this.reelTexts[i].setText(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
                },
            });

            const stopTimer = this.scene.time.delayedCall(stopDelays[i], () => {
                rollTimer.remove();
                if (this.closed) return;
                const final = weightedRandom();
                this.reelValues[i] = final;
                this.reelTexts[i].setText(final);
                // Bounce on stop
                this.scene.tweens.add({
                    targets: this.reelTexts[i],
                    scaleX: 1.12, scaleY: 1.12,
                    yoyo: true, duration: 80, ease: 'Quad.easeOut',
                });
                this.spinDone[i] = true;
                if (this.spinDone.every(d => d)) this.evalResult();
            });

            this.spinTimers.push(rollTimer, stopTimer);
        }
    }

    private evalResult(): void {
        if (this.closed) return;
        this.spinState = 'result';
        this.drawSpinButton('spinning');
        this.spinBtnLabel.setText('SPIN').setColor('#554466');
        this.spinTimers = [];

        const [a, b, c] = this.reelValues;
        let payout = 0;
        let msg    = '';
        let msgCol = '#c9a84c';
        let jackpot = false;

        // ── Three of a kind ───────────────────────────────────────────────────
        if (a === b && b === c) {
            const mult = PAYOUTS[a] ?? 2;
            payout  = this.currentBet * mult;
            jackpot = a === '7️⃣';
            msg     = jackpot ? `★ JACKPOT!  7️⃣×3  +${payout}◈ ★` : `3×${a}  +${payout}◈`;
            msgCol  = '#2ecc71';
        } else if (a === b || b === c || a === c) {
            // ── Two of a kind ─────────────────────────────────────────────────
            const cherryPair =
                (a === b && a === '🍒') || (b === c && b === '🍒') || (a === c && a === '🍒');
            if (cherryPair) {
                payout = this.currentBet * CHERRY_PAIR_PAYOUT;
                msg    = `Cherry pair!  +${payout}◈`;
                msgCol = '#f0a040';
            } else {
                // Near-miss: two premium symbols
                const premiumMatch =
                    (a === b && (PAYOUTS[a] ?? 0) >= 6) ||
                    (b === c && (PAYOUTS[b] ?? 0) >= 6) ||
                    (a === c && (PAYOUTS[a] ?? 0) >= 6);
                if (premiumMatch) {
                    msg    = `So close!  ${a}${b}${c} — almost! 😤`;
                    msgCol = '#f0a040';
                } else {
                    msg    = 'No match — try again';
                    msgCol = '#666688';
                }
            }
        } else {
            msg    = 'No match — try again';
            msgCol = '#666688';
        }

        if (payout > 0) {
            this.totalWon += payout;
            this.winStreak++;
            if (this.winStreak > this.maxWinStreak) this.maxWinStreak = this.winStreak;
            GameState.addChips(payout);
            this.updateChipsDisplay();
            this.showChipDelta(`+${payout}◈`, '#2ecc71');
            this.drawPayLine(true);

            if (jackpot) {
                this.scene.tweens.add({
                    targets: this.reelTexts, scaleX: 1.4, scaleY: 1.4,
                    yoyo: true, duration: 100, repeat: 6,
                });
                this.scene.tweens.add({
                    targets: this.payLineGfx, alpha: 0,
                    yoyo: true, duration: 70, repeat: 10,
                    onComplete: () => { this.drawPayLine(false); this.payLineGfx.setAlpha(1); },
                });
            } else {
                this.scene.tweens.add({
                    targets: this.reelTexts, scaleX: 1.14, scaleY: 1.14,
                    yoyo: true, duration: 130, repeat: 2,
                });
                this.scene.time.delayedCall(600, () => this.drawPayLine(false));
            }
        } else {
            this.winStreak = 0;
            this.showChipDelta(`-${this.currentBet}◈`, '#e74c3c');
        }

        this.showResult(msg, msgCol);
        this.updateStatsDisplay();

        const idleTimer = this.scene.time.delayedCall(500, () => {
            if (this.closed) return;
            this.spinState = 'idle';
            this.drawSpinButton('idle');
            this.spinBtnLabel.setColor('#c9a84c');
            this.updateBetDisplay();
            this.checkLowChips();
        });
        this.spinTimers.push(idleTimer);
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
        this.scene.tweens.add({
            targets: this.resultText,
            scaleX: [1.15, 1], scaleY: [1.15, 1],
            duration: 200, ease: 'Back.Out',
        });
    }

    private checkLowChips(): void {
        const chips = GameState.get().chips;
        if (chips > 0 && chips < this.currentBet) {
            const affordable = BET_OPTIONS.filter(b => b <= chips);
            this.currentBet = affordable.length > 0
                ? affordable[affordable.length - 1]
                : BET_OPTIONS[0];
            this.updateBetDisplay();
        }
        if (chips < BET_OPTIONS[0]) this.showFreeChipsOffer();
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
            this.currentBet = 25;
            this.updateChipsDisplay();
            this.updateBetDisplay();
            this.updateStatsDisplay();
            this.showResult('🎁 500 free chips added!', '#6acc30');
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
        this.spinTimers.forEach(t => t.remove());
        this.escKey.destroy();
        this.spaceKey.destroy();
        this.overlay.destroy();
        this.panelGfx.destroy();
        this.container.destroy(true);
        this.onClose();
    }
}
