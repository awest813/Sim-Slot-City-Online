// ── Plinko minigame panel ──────────────────────────────────────────────────────
// A ball drops from the top, bounces off pegs arranged in a triangle pattern,
// and lands in a multiplier slot at the bottom. Animated in Phaser.
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_TRIM_LIGHT, COL_TRIM_DIM,
    COL_PLINKO_ACCENT,
    FONT, PANEL_RADIUS, ANIM_MED,
} from '../../game/constants';
import { ToastManager } from '../ui/ToastManager';

// ── Plinko board configuration ────────────────────────────────────────────────
const BOARD_ROWS    = 8;    // number of peg rows
const BOARD_W       = 380;
const BOARD_H       = 240;
const PEG_RADIUS    = 4;
const BALL_RADIUS   = 7;

// ── Risk levels ───────────────────────────────────────────────────────────────
type RiskLevel = 'low' | 'medium' | 'high';

const RISK_MULTIPLIERS: Record<RiskLevel, number[]> = {
    low:    [0.4, 0.5, 0.7, 1.0, 1.5, 3.0, 1.5, 1.0, 0.7, 0.5, 0.4],
    medium: [0.2, 0.5, 1.0, 2.0, 5.0, 10,  5.0, 2.0, 1.0, 0.5, 0.2],
    high:   [0,   0,   0.2, 0.5, 2.0, 50,  2.0, 0.5, 0.2, 0,   0  ],
};

// SLOT_COUNT is constant regardless of risk level
const SLOT_COUNT = RISK_MULTIPLIERS.medium.length;

// Colors for slots based on multiplier value
function slotColor(mult: number): number {
    if (mult >= 10) return 0xffd700;
    if (mult >= 5)  return 0xf5a020;
    if (mult >= 2)  return 0x2ecc71;
    if (mult >= 1)  return 0x3a90e0;
    if (mult > 0)   return 0x445060;
    return 0x1a1a1a;  // 0× = near-black
}

const BET_OPTIONS = [10, 25, 50, 100];
type DropState = 'idle' | 'dropping' | 'result';

// Peg grid position
interface Peg { x: number; y: number; row: number; col: number; }

export class PlinkoPanel {
    private scene:   Phaser.Scene;
    private onClose: () => void;

    // Phaser objects
    private overlay!:      Phaser.GameObjects.Rectangle;
    private panelGfx!:     Phaser.GameObjects.Graphics;
    private container!:    Phaser.GameObjects.Container;
    private boardGfx!:     Phaser.GameObjects.Graphics;
    private ballGfx!:      Phaser.GameObjects.Graphics;
    private resultText!:   Phaser.GameObjects.Text;
    private chipsText!:    Phaser.GameObjects.Text;
    private betText!:      Phaser.GameObjects.Text;
    private statsText!:    Phaser.GameObjects.Text;
    private dropBtnGfx!:   Phaser.GameObjects.Graphics;
    private dropBtnLabel!: Phaser.GameObjects.Text;
    private dropBtnHit!:   Phaser.GameObjects.Rectangle;
    private betBtns: Array<{ gfx: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; amount: number }> = [];
    private slotHighlightGfx!: Phaser.GameObjects.Graphics;
    private escKey!:  Phaser.Input.Keyboard.Key;
    private spaceKey!: Phaser.Input.Keyboard.Key;

    // State
    private dropState:   DropState = 'idle';
    private currentBet:  number   = 25;
    private closed:       boolean  = false;
    private pegs:        Peg[]    = [];
    private boardOffsetX = 0;
    private boardOffsetY = 0;

    // Risk level
    private riskLevel:      RiskLevel = 'medium';
    private slotGfx!:       Phaser.GameObjects.Graphics;
    private slotLabelObjs:  Phaser.GameObjects.Text[] = [];
    private riskBtns: Array<{ gfx: Phaser.GameObjects.Graphics; lbl: Phaser.GameObjects.Text; level: RiskLevel }> = [];

    // Ball animation
    private ballX        = 0;
    private ballY        = 0;
    private ballPath:    Array<{ x: number; y: number }> = [];
    private pathIdx      = 0;
    private finalSlotIdx = 0;
    private dropTween: Phaser.Tweens.Tween | null = null;

    // Session stats
    private totalDrops   = 0;
    private totalWon     = 0;
    private totalWagered = 0;

    // Layout
    private readonly PW = 560;
    private readonly PH = 520;

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
        this.scene.tweens.add({ targets: this.overlay, fillAlpha: 0.78, duration: ANIM_MED });

        // Panel background
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

        // ── Title ─────────────────────────────────────────────────────────────
        const title = this.scene.add.text(0, -PH / 2 + 26, '🎯  PLINKO', {
            fontFamily: FONT, fontSize: '20px', color: '#20d4a0', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        this.buildCloseButton();

        // Chips balance
        this.chipsText = this.scene.add.text(-PW / 2 + 18, -PH / 2 + 62, '', {
            fontFamily: FONT, fontSize: '12px', color: '#2ecc71', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.container.add(this.chipsText);

        // ── Plinko board ──────────────────────────────────────────────────────
        this.boardOffsetX = 0;
        this.boardOffsetY = -PH / 2 + 90;
        this.buildBoard();

        // Slot highlight overlay (redrawn on each drop)
        this.slotHighlightGfx = this.scene.add.graphics();
        this.container.add(this.slotHighlightGfx);

        // Ball graphics (drawn on top)
        this.ballGfx = this.scene.add.graphics();
        this.container.add(this.ballGfx);

        // ── Result text ───────────────────────────────────────────────────────
        this.resultText = this.scene.add.text(0, this.boardOffsetY + BOARD_H + 20, '', {
            fontFamily: FONT, fontSize: '15px', color: '#20d4a0', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(this.resultText);

        // Session stats
        this.statsText = this.scene.add.text(0, this.boardOffsetY + BOARD_H + 40, '', {
            fontFamily: FONT, fontSize: '10px', color: '#446688',
        }).setOrigin(0.5);
        this.container.add(this.statsText);

        // ── Bet controls ──────────────────────────────────────────────────────
        this.buildBetControls();
        this.buildRiskSelector();
        this.buildDropButton();

        // ── Keyboard shortcuts ────────────────────────────────────────────────
        this.escKey   = this.scene.input.keyboard!.addKey('ESC');
        this.spaceKey = this.scene.input.keyboard!.addKey('SPACE');
        this.escKey.on('down',   () => this.close());
        this.spaceKey.on('down', () => { if (this.dropState === 'idle') this.dropBall(); });

        this.updateChipsDisplay();
        this.updateBetDisplay();
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
        // Body
        g.fillStyle(0x071a14, 1);
        g.fillRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Header band
        g.fillStyle(0x091c18, 1);
        g.fillRoundedRect(px, py, PW, 52, { tl: PANEL_RADIUS, tr: PANEL_RADIUS, bl: 0, br: 0 });
        // Teal border
        g.lineStyle(2, COL_PLINKO_ACCENT, 0.85);
        g.strokeRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Inner inset
        g.lineStyle(1, COL_PLINKO_ACCENT, 0.12);
        g.strokeRoundedRect(px + 3, py + 3, PW - 6, PH - 6, PANEL_RADIUS - 1);
        // Header divider
        g.lineStyle(1.5, COL_PLINKO_ACCENT, 0.45);
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
            gfx.fillStyle(hover ? 0x103a2a : 0x081e14, 1);
            gfx.fillCircle(bx, by, r);
            gfx.lineStyle(1, hover ? 0x30a870 : 0x187848, 0.9);
            gfx.strokeCircle(bx, by, r);
        };
        draw(false);

        const hitArea = this.scene.add.circle(bx, by, r, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const xLabel = this.scene.add.text(bx, by, '✕', {
            fontFamily: FONT, fontSize: '13px', color: '#20d4a0',
        }).setOrigin(0.5);

        hitArea.on('pointerover', () => { draw(true);  xLabel.setColor('#40ffcc'); });
        hitArea.on('pointerout',  () => { draw(false); xLabel.setColor('#20d4a0'); });
        hitArea.on('pointerdown', () => this.close());

        this.container.add([gfx, hitArea, xLabel]);
    }

    private buildBoard(): void {
        const ox = this.boardOffsetX;
        const oy = this.boardOffsetY;
        const slotH = 26;
        const pegAreaH = BOARD_H - slotH;

        // Board background
        const bgGfx = this.scene.add.graphics();
        bgGfx.fillStyle(0x000000, 0.5);
        bgGfx.fillRoundedRect(ox - BOARD_W / 2 + 3, oy + 3, BOARD_W, BOARD_H, 6);
        bgGfx.fillStyle(0x040e0a, 1);
        bgGfx.fillRoundedRect(ox - BOARD_W / 2, oy, BOARD_W, BOARD_H, 6);
        bgGfx.lineStyle(1.5, COL_PLINKO_ACCENT, 0.6);
        bgGfx.strokeRoundedRect(ox - BOARD_W / 2, oy, BOARD_W, BOARD_H, 6);
        this.container.add(bgGfx);

        // Board graphics for static elements (pegs only)
        this.boardGfx = this.scene.add.graphics();
        this.container.add(this.boardGfx);

        // ── Compute peg positions ──────────────────────────────────────────────
        this.pegs = [];
        for (let row = 0; row < BOARD_ROWS; row++) {
            const pegsInRow = row + 3;   // rows: 3, 4, 5, ..., 10 pegs
            const py        = oy + 18 + row * (pegAreaH / BOARD_ROWS);
            const spacing   = BOARD_W / SLOT_COUNT;
            const offset    = (SLOT_COUNT - pegsInRow) / 2;

            for (let col = 0; col < pegsInRow; col++) {
                const px = ox - BOARD_W / 2 + (offset + col + 0.5) * spacing;
                this.pegs.push({ x: px, y: py, row, col });
            }
        }

        // Draw pegs
        const g = this.boardGfx;
        for (const peg of this.pegs) {
            g.fillStyle(COL_PLINKO_ACCENT, 0.9);
            g.fillCircle(peg.x, peg.y, PEG_RADIUS);
            g.fillStyle(0xffffff, 0.15);
            g.fillCircle(peg.x - 1, peg.y - 1, 1.5);
        }

        // Drop zone indicator (top center arrow)
        g.fillStyle(COL_PLINKO_ACCENT, 0.7);
        g.fillTriangle(
            ox, oy + 6,
            ox - 8, oy - 4,
            ox + 8, oy - 4,
        );

        // ── Slot display (built separately so it can be rebuilt on risk change) ─
        this.buildSlotDisplay();
    }

    /** Returns the multiplier array for the current risk level. */
    private getMultipliers(): number[] {
        return RISK_MULTIPLIERS[this.riskLevel];
    }

    /** Build (or rebuild) the slot backgrounds + multiplier labels. */
    private buildSlotDisplay(): void {
        const ox    = this.boardOffsetX;
        const oy    = this.boardOffsetY;
        const slotH = 26;
        const slotW = BOARD_W / SLOT_COUNT;
        const slotY = oy + BOARD_H - slotH;
        const mults = this.getMultipliers();

        this.slotGfx = this.scene.add.graphics();
        this.container.add(this.slotGfx);

        for (let i = 0; i < SLOT_COUNT; i++) {
            const sx   = ox - BOARD_W / 2 + i * slotW;
            const mult = mults[i];
            const col  = slotColor(mult);

            this.slotGfx.fillStyle(col, mult === 0 ? 0.06 : 0.18);
            this.slotGfx.fillRect(sx + 1, slotY + 1, slotW - 2, slotH - 2);
            this.slotGfx.lineStyle(1, col, mult === 0 ? 0.25 : 0.55);
            this.slotGfx.strokeRect(sx + 1, slotY + 1, slotW - 2, slotH - 2);

            const labelStr = mult === 0 ? '0×' : `${mult}×`;
            const labelCol = Phaser.Display.Color.IntegerToColor(col).rgba;
            const lbl = this.scene.add.text(sx + slotW / 2, slotY + slotH / 2, labelStr, {
                fontFamily: FONT,
                fontSize: mult >= 5 ? '9px' : '8px',
                color: labelCol,
                fontStyle: mult >= 5 ? 'bold' : 'normal',
            }).setOrigin(0.5);
            this.container.add(lbl);
            this.slotLabelObjs.push(lbl);
        }
    }

    /** Destroy and recreate the slot display with the current risk multipliers. */
    private rebuildSlotDisplay(): void {
        this.slotGfx.destroy();
        for (const obj of this.slotLabelObjs) obj.destroy();
        this.slotLabelObjs = [];
        this.slotHighlightGfx.clear();
        this.buildSlotDisplay();
        // Ensure the ball / highlight graphics stay on top
        this.container.bringToTop(this.slotHighlightGfx);
        this.container.bringToTop(this.ballGfx);
    }

    /** Three-button risk selector (Low / Med / High) placed right of the bet buttons. */
    private buildRiskSelector(): void {
        const { PW, PH } = this;
        const btnY   = PH / 2 - 94;   // same row as bet buttons
        const startX = PW / 2 - 130;  // right-aligned

        const RISK_LABELS: Record<RiskLevel, string> = { low: 'LOW', medium: 'MED', high: 'HIGH' };
        const levels: RiskLevel[] = ['low', 'medium', 'high'];

        const riskHeader = this.scene.add.text(startX - 4, btnY - 18, 'RISK:', {
            fontFamily: FONT, fontSize: '9px', color: '#446688', fontStyle: 'bold', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this.container.add(riskHeader);

        const bw = 36;
        const bh = 22;
        const gap = 4;

        levels.forEach((level, i) => {
            const bx = startX + i * (bw + gap) + bw / 2;
            const gfx = this.scene.add.graphics();
            const lbl = this.scene.add.text(bx, btnY, RISK_LABELS[level], {
                fontFamily: FONT, fontSize: '9px', color: '#20d4a0',
            }).setOrigin(0.5);

            const drawBtn = (): void => {
                gfx.clear();
                const sel = this.riskLevel === level;
                gfx.fillStyle(sel ? 0x0e3028 : 0x041008, 1);
                gfx.fillRoundedRect(bx - bw / 2, btnY - bh / 2, bw, bh, 3);
                gfx.lineStyle(sel ? 1.5 : 1, sel ? COL_PLINKO_ACCENT : 0x1a4030, sel ? 1 : 0.5);
                gfx.strokeRoundedRect(bx - bw / 2, btnY - bh / 2, bw, bh, 3);
                lbl.setColor(sel ? '#20d4a0' : '#2a6050');
            };
            drawBtn();

            const hitRect = this.scene.add.rectangle(bx, btnY, bw, bh, 0x000000, 0)
                .setInteractive({ useHandCursor: true });
            hitRect.on('pointerdown', () => {
                if (this.dropState !== 'idle') return;
                this.riskLevel = level;
                this.riskBtns.forEach(({ gfx: g2, lbl: l2, level: lv }) => {
                    const sel = lv === this.riskLevel;
                    g2.clear();
                    const bx2 = l2.x;
                    g2.fillStyle(sel ? 0x0e3028 : 0x041008, 1);
                    g2.fillRoundedRect(bx2 - bw / 2, btnY - bh / 2, bw, bh, 3);
                    g2.lineStyle(sel ? 1.5 : 1, sel ? COL_PLINKO_ACCENT : 0x1a4030, sel ? 1 : 0.5);
                    g2.strokeRoundedRect(bx2 - bw / 2, btnY - bh / 2, bw, bh, 3);
                    l2.setColor(sel ? '#20d4a0' : '#2a6050');
                });
                this.rebuildSlotDisplay();
            });

            this.container.add([gfx, lbl, hitRect]);
            this.riskBtns.push({ gfx, lbl, level });
        });
    }

    private buildBetControls(): void {
        const { PW, PH } = this;
        const betAreaY = PH / 2 - 118;

        const betLbl = this.scene.add.text(-PW / 2 + 18, betAreaY, 'BET PER DROP:', {
            fontFamily: FONT, fontSize: '10px', color: '#446688', fontStyle: 'bold', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this.container.add(betLbl);

        const btnW = 62;
        const btnH = 30;
        const total = BET_OPTIONS.length * btnW + (BET_OPTIONS.length - 1) * 8;
        const startX = -total / 2 + btnW / 2;
        const btnY = betAreaY + 24;

        BET_OPTIONS.forEach((amount, i) => {
            const bx = startX + i * (btnW + 8);
            const gfx = this.scene.add.graphics();

            const drawBtn = (selected: boolean, canAfford: boolean): void => {
                gfx.clear();
                const fill = selected ? 0x0e3028 : canAfford ? 0x071a14 : 0x050e0a;
                const sc   = selected ? COL_PLINKO_ACCENT : canAfford ? 0x1a5040 : 0x0e2018;
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
                color: amount === this.currentBet ? '#20d4a0' : '#4a8878',
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
            fontFamily: FONT, fontSize: '11px', color: '#4a8878',
        }).setOrigin(0.5);
        this.container.add(this.betText);
    }

    private buildDropButton(): void {
        const { PH } = this;
        const btnW = 220;
        const btnH = 44;
        const btnY = PH / 2 - 54;

        this.dropBtnGfx = this.scene.add.graphics();
        this.drawDropButton('idle');

        this.dropBtnLabel = this.scene.add.text(0, btnY, 'DROP BALL', {
            fontFamily: FONT, fontSize: '17px', color: '#20d4a0', fontStyle: 'bold',
        }).setOrigin(0.5);

        const spaceHint = this.scene.add.text(btnW / 2 - 4, btnY, '[SPACE]', {
            fontFamily: FONT, fontSize: '8px', color: '#1a4a38',
        }).setOrigin(1, 0.5);

        this.dropBtnHit = this.scene.add.rectangle(0, btnY, btnW, btnH, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        this.dropBtnHit.on('pointerover',  () => { if (this.dropState === 'idle') this.drawDropButton('hover'); });
        this.dropBtnHit.on('pointerout',   () => { if (this.dropState === 'idle') this.drawDropButton('idle'); });
        this.dropBtnHit.on('pointerdown',  () => { if (this.dropState === 'idle') { this.drawDropButton('press'); this.dropBall(); } });
        this.dropBtnHit.on('pointerup',    () => { if (this.dropState === 'idle') this.drawDropButton('hover'); });

        this.container.add([this.dropBtnGfx, this.dropBtnLabel, spaceHint, this.dropBtnHit]);
    }

    private drawDropButton(state: 'idle' | 'hover' | 'press' | 'dropping'): void {
        const { PH } = this;
        const btnW = 220;
        const btnH = 44;
        const btnY = PH / 2 - 54;
        const r = 6;
        const g = this.dropBtnGfx;
        g.clear();

        const fills: Record<typeof state, number> = {
            idle: 0x082018, hover: 0x103828, press: 0x040e0a, dropping: 0x060e0a,
        };
        const strokeC: Record<typeof state, number> = {
            idle: COL_PLINKO_ACCENT, hover: COL_TRIM_LIGHT, press: COL_TRIM_DIM, dropping: 0x0a3028,
        };
        const strokeA: Record<typeof state, number> = {
            idle: 0.85, hover: 1, press: 0.7, dropping: 0.4,
        };

        // Shadow
        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(-btnW / 2 + 2, btnY - btnH / 2 + 3, btnW, btnH, r + 1);
        // Fill
        g.fillStyle(fills[state], 1);
        g.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, r);
        // Top gloss
        if (state !== 'dropping') {
            g.fillStyle(0xffffff, state === 'hover' ? 0.06 : 0.03);
            g.fillRoundedRect(-btnW / 2 + 3, btnY - btnH / 2 + 3, btnW - 6, btnH / 2 - 3, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
        }
        // Border
        g.lineStyle(1.5, strokeC[state], strokeA[state]);
        g.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, r);
        // Hover glow
        if (state === 'hover') {
            g.lineStyle(6, COL_PLINKO_ACCENT, 0.08);
            g.strokeRoundedRect(-btnW / 2 - 2, btnY - btnH / 2 - 2, btnW + 4, btnH + 4, r + 2);
        }
    }

    // ── Drop logic ────────────────────────────────────────────────────────────

    private dropBall(): void {
        if (this.dropState !== 'idle') return;

        const chips = GameState.get().chips;
        if (chips < this.currentBet) {
            this.showResult(`Need ${this.currentBet - chips} more chips!`, '#e74c3c');
            return;
        }

        GameState.addChips(-this.currentBet);
        this.totalDrops++;
        this.totalWagered += this.currentBet;
        this.updateChipsDisplay();

        this.dropState = 'dropping';
        this.drawDropButton('dropping');
        this.dropBtnLabel.setText('DROPPING...').setColor('#0e6050');
        this.resultText.setText('');
        this.slotHighlightGfx.clear();

        // ── Compute ball path through the peg grid ────────────────────────────
        const { points, finalSlot } = this.computeBallPath();
        this.ballPath    = points;
        this.finalSlotIdx = finalSlot;
        this.pathIdx     = 0;

        // Start ball at the top center
        this.ballX = this.boardOffsetX;
        this.ballY = this.boardOffsetY - 10;
        this.drawBall(this.ballX, this.ballY, 1);

        // Animate ball step by step through the path
        this.animateBallStep();
    }

    /**
     * Simulate the ball dropping through the peg grid.
     * At each peg row the ball randomly goes left or right.
     * Returns waypoints from top to a slot plus the landing slot index.
     */
    private computeBallPath(): { points: Array<{ x: number; y: number }>; finalSlot: number } {
        const points: Array<{ x: number; y: number }> = [];
        const ox = this.boardOffsetX;
        const oy = this.boardOffsetY;
        const slotH = 26;
        const pegAreaH = BOARD_H - slotH;
        const spacing = BOARD_W / SLOT_COUNT;

        // Start at top center
        points.push({ x: ox, y: oy - 10 });
        points.push({ x: ox, y: oy + 8 });   // just inside board top

        // Track which column the ball is in (float position in slot units)
        // Start at the center column
        let colPos = (SLOT_COUNT - 1) / 2;   // 5.0 for 11 slots (center)

        for (let row = 0; row < BOARD_ROWS; row++) {
            // Ball hits a peg and deflects left (-0.5) or right (+0.5)
            const deflect = Math.random() < 0.5 ? -0.5 : 0.5;
            colPos = Phaser.Math.Clamp(colPos + deflect, 0, SLOT_COUNT - 1);

            const py = oy + 18 + row * (pegAreaH / BOARD_ROWS);
            const px = ox - BOARD_W / 2 + (colPos + 0.5) * spacing;

            // Intermediate bounce point slightly above peg
            points.push({ x: px, y: py - BALL_RADIUS - 1 });
            // At peg level
            points.push({ x: px, y: py + BALL_RADIUS + 2 });
        }

        // Final slot landing
        const finalSlot = Math.round(colPos);
        const clampedSlot = Phaser.Math.Clamp(finalSlot, 0, SLOT_COUNT - 1);
        const finalX = ox - BOARD_W / 2 + (clampedSlot + 0.5) * spacing;
        const finalY = oy + BOARD_H - slotH / 2;

        points.push({ x: finalX, y: finalY - 8 });
        points.push({ x: finalX, y: finalY });

        return { points, finalSlot: clampedSlot };
    }

    private animateBallStep(): void {
        if (this.closed) return;
        if (this.pathIdx >= this.ballPath.length - 1) {
            // Ball has reached the end
            this.onBallLanded(this.finalSlotIdx);
            return;
        }

        const from = this.ballPath[this.pathIdx];
        const to   = this.ballPath[this.pathIdx + 1];
        const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
        const dur  = Math.max(60, dist * 4.5);

        this.dropTween = this.scene.tweens.add({
            targets: { t: 0 },
            t: 1,
            duration: dur,
            ease: this.pathIdx === 0 ? 'Sine.easeIn' : 'Bounce.easeOut',
            onUpdate: (tween: Phaser.Tweens.Tween) => {
                if (this.closed) return;
                const t = (tween.targets[0] as { t: number }).t;
                this.ballX = Phaser.Math.Linear(from.x, to.x, t);
                this.ballY = Phaser.Math.Linear(from.y, to.y, t);
                // Slight squish on downward movement
                const squish = this.ballY > from.y ? 1 + (1 - t) * 0.15 : 1;
                this.drawBall(this.ballX, this.ballY, squish);
            },
            onComplete: () => {
                if (this.closed) return;
                this.pathIdx++;
                this.animateBallStep();
            },
        });
    }

    private onBallLanded(slotIdx: number): void {
        if (this.closed) return;

        const mults  = this.getMultipliers();
        const mult   = mults[slotIdx];
        const payout = Math.round(this.currentBet * mult);
        const col    = slotColor(mults[slotIdx]);

        // Highlight the winning slot
        this.highlightSlot(slotIdx);

        // Bounce the ball in the slot
        this.scene.tweens.add({
            targets: { t: 0 }, t: 1, duration: 200, ease: 'Bounce.easeOut',
            onUpdate: (tw: Phaser.Tweens.Tween) => {
                const t = (tw.targets[0] as { t: number }).t;
                this.drawBall(this.ballX, this.ballY - Math.sin(t * Math.PI) * 8, 1 + (1 - t) * 0.2);
            },
        });

        // Apply payout; show net delta (profit/loss vs. stake), not gross return
        const net = payout - this.currentBet;
        this.totalWon += payout;   // gross return tracked for stats (net = totalWon - totalWagered)
        GameState.addChips(payout);
        this.updateChipsDisplay();
        if (net > 0) {
            this.showChipDelta(`+${net}◈`, '#2ecc71');
        } else if (net === 0) {
            this.showChipDelta(`±0◈`, '#c9a84c');
        } else {
            this.showChipDelta(`${net}◈`, '#e74c3c');
        }

        const colStr = Phaser.Display.Color.IntegerToColor(col).rgba;
        const msg = mult >= 10
            ? `★ JACKPOT!  ${mult}×  +${payout}◈ ★`
            : mult >= 2
                ? `${mult}× — +${payout}◈`
                : mult >= 1
                    ? `${mult}× — Push!  +${payout}◈`
                    : `${mult}× — House wins`;
        this.showResult(msg, colStr);
        this.updateStatsDisplay();

        // Toast notification
        if (mult >= 10) {
            ToastManager.show(this.scene, `PLINKO JACKPOT! ${mult}× = +${payout} ◈`, 'jackpot');
        } else if (net > 0) {
            ToastManager.show(this.scene, `${mult}×  +${net} ◈`, 'win');
        } else if (net < 0) {
            ToastManager.show(this.scene, `${net} ◈`, 'loss');
        }

        // Flash camera on jackpot
        if (mult >= 10) {
            this.scene.cameras.main.flash(500, 32, 212, 160, true);
        }

        // Re-enable button after short delay
        this.scene.time.delayedCall(700, () => {
            if (this.closed) return;
            this.dropState = 'idle';
            this.drawDropButton('idle');
            this.dropBtnLabel.setText('DROP BALL').setColor('#20d4a0');
            this.updateBetDisplay();
            this.checkLowChips();
        });
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────

    private drawBall(x: number, y: number, squish = 1): void {
        const g = this.ballGfx;
        g.clear();
        const r = BALL_RADIUS;
        const ry = r / squish;
        const rx = r * squish;

        // Shadow
        g.fillStyle(0x000000, 0.35);
        g.fillEllipse(x + 2, y + ry + 2, rx * 2, ry * 1.2);

        // Ball gradient effect (outer glow)
        g.fillStyle(COL_PLINKO_ACCENT, 0.25);
        g.fillEllipse(x, y, (rx + 3) * 2, (ry + 3) * 2);

        // Ball body
        g.fillStyle(0xffffff, 1);
        g.fillEllipse(x, y, rx * 2, ry * 2);

        // Ball shading
        g.fillStyle(COL_PLINKO_ACCENT, 0.7);
        g.fillEllipse(x + 1, y + 1, rx * 1.4, ry * 1.4);

        // Highlight
        g.fillStyle(0xffffff, 0.9);
        g.fillEllipse(x - rx * 0.3, y - ry * 0.35, rx * 0.6, ry * 0.5);
    }

    private highlightSlot(slotIdx: number): void {
        const g = this.slotHighlightGfx;
        g.clear();

        const ox    = this.boardOffsetX;
        const oy    = this.boardOffsetY;
        const slotW = BOARD_W / SLOT_COUNT;
        const slotH = 26;
        const slotY = oy + BOARD_H - slotH;
        const sx    = ox - BOARD_W / 2 + slotIdx * slotW;
        const col   = slotColor(this.getMultipliers()[slotIdx]);

        // Bright border flash
        g.lineStyle(2, col, 1);
        g.strokeRect(sx + 1, slotY + 1, slotW - 2, slotH - 2);
        g.fillStyle(col, 0.35);
        g.fillRect(sx + 1, slotY + 1, slotW - 2, slotH - 2);

        // Glow lines above winning slot
        g.lineStyle(1, col, 0.5);
        g.lineBetween(sx + slotW / 2, slotY - 20, sx + slotW / 2, slotY);
        g.lineStyle(1, col, 0.25);
        g.lineBetween(sx + slotW / 2 - 4, slotY - 14, sx + slotW / 2 - 4, slotY);
        g.lineBetween(sx + slotW / 2 + 4, slotY - 14, sx + slotW / 2 + 4, slotY);
    }

    private showChipDelta(text: string, color: string): void {
        const delta = this.scene.add.text(0, this.boardOffsetY - 20, text, {
            fontFamily: FONT, fontSize: '18px', color, fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_PANEL + 5);
        this.container.add(delta);
        this.scene.tweens.add({
            targets: delta, y: this.boardOffsetY - 55, alpha: 0, duration: 1100, ease: 'Cubic.easeOut',
            onComplete: () => delta.destroy(),
        });
    }

    private showResult(msg: string, color: string): void {
        this.resultText.setText(msg).setColor(color);
        this.scene.tweens.add({
            targets: this.resultText,
            scaleX: [1.12, 1], scaleY: [1.12, 1],
            duration: 200, ease: 'Back.Out',
        });
    }

    // ── Display updates ───────────────────────────────────────────────────────

    private updateChipsDisplay(): void {
        this.chipsText.setText(`◈ ${GameState.get().chips.toLocaleString()} chips`);
    }

    private updateBetDisplay(): void {
        const chips = GameState.get().chips;
        this.betBtns.forEach(({ gfx, label, amount }) => {
            const sel  = this.currentBet === amount;
            const can  = chips >= amount;
            const bx   = label.x;
            const by   = label.y;
            const bw   = 62;
            const bh   = 30;
            gfx.clear();
            gfx.fillStyle(sel ? 0x0e3028 : can ? 0x071a14 : 0x050e0a, 1);
            gfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
            gfx.lineStyle(sel ? 1.5 : 1, sel ? COL_PLINKO_ACCENT : can ? 0x1a5040 : 0x0e2018, sel ? 1 : can ? 0.6 : 0.3);
            gfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
            label.setColor(sel ? '#20d4a0' : can ? '#4a8878' : '#1a3030');
        });
        this.betText.setText(`Bet: ${this.currentBet} ◈`);
    }

    private updateStatsDisplay(): void {
        if (this.totalDrops === 0) { this.statsText.setText(''); return; }
        const net    = this.totalWon - this.totalWagered;
        const netStr = net >= 0 ? `+${net}` : `${net}`;
        const col    = net >= 0 ? '#2ecc71' : '#e74c3c';
        this.statsText.setText(`Drops: ${this.totalDrops}  ·  Net: ${netStr}◈`).setColor(col);
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
        if (chips < BET_OPTIONS[0]) {
            // Free chips fallback
            GameState.addChips(500);
            this.updateChipsDisplay();
            this.updateBetDisplay();
            this.showResult('🎁 500 free chips added!', '#6acc30');
        }
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    private close(): void {
        if (this.closed) return;
        this.closed = true;
        if (this.dropTween) { this.dropTween.stop(); this.dropTween = null; }
        this.escKey.destroy();
        this.spaceKey.destroy();
        this.overlay.destroy();
        this.panelGfx.destroy();
        this.container.destroy(true);
        this.onClose();
    }
}
