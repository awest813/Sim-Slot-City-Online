// ── Playable roulette minigame panel ─────────────────────────────────────────
// European single-zero roulette.
// Bet types: straight (35:1), red/black (1:1), odd/even (1:1),
//            low/high (1:1), dozens (2:1).
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_TRIM, COL_TRIM_LIGHT, COL_TRIM_DIM,
    FONT, PANEL_RADIUS, ANIM_MED,
} from '../../game/constants';
import {
    BetType, RouletteBet,
    WHEEL_ORDER, RED_NUMBERS,
    spinResult, evalAllBets, getTotalBetAmount,
    getNumberColor, getWheelIndex, betWins,
} from './RouletteEngine';
import { ToastManager } from '../ui/ToastManager';

// ── Colours ───────────────────────────────────────────────────────────────────
const COL_RED    = 0xcc2222;
const COL_BLACK  = 0x111111;
const COL_GREEN  = 0x1a7a30;
const COL_NUM_BG_RED   = 0x6a0a0a;
const COL_NUM_BG_BLK   = 0x0a0a0a;
const COL_NUM_BG_SEL   = 0x5a4a00;  // selected/highlighted
const COL_NUM_BG_WIN   = 0x1a5a10;  // winning number

const CHIP_OPTIONS = [5, 10, 25, 50, 100];
type SpinState = 'betting' | 'spinning';

// ── Panel dimensions ──────────────────────────────────────────────────────────
const PW = 720;
const PH = 510;

// ── Number grid layout ────────────────────────────────────────────────────────
// Grid right-section: x starts at GRID_X (panel-relative), 0 cell + 12 columns
const GRID_X     = -68;    // left edge of 0 cell
const GRID_Y     = -130;   // top of number rows
const CELL_W     = 28;     // width of each number cell
const CELL_H     = 22;     // height of each number cell
const ZERO_W     = 26;     // width of 0 cell (spans 3 rows)
const NUM_COLS   = 12;     // columns of the number grid

// ── Wheel layout ──────────────────────────────────────────────────────────────
const WHEEL_CX   = -210;   // panel-relative x of wheel center
const WHEEL_CY   = -30;    // panel-relative y of wheel center
const WHEEL_OR   = 100;    // outer radius of colored segments
const WHEEL_IR   = 36;     // inner radius (center disc)
const WHEEL_FR   = 110;    // frame / wooden rim outer radius

export class RoulettePanel {
    private scene:   Phaser.Scene;
    private onClose: () => void;

    // Phaser objects
    private overlay!:       Phaser.GameObjects.Rectangle;
    private panelGfx!:      Phaser.GameObjects.Graphics;
    private container!:     Phaser.GameObjects.Container;
    private wheelContainer!: Phaser.GameObjects.Container;
    private wheelGfx!:      Phaser.GameObjects.Graphics;
    private ballGfx!:       Phaser.GameObjects.Graphics;
    private resultCircle!:  Phaser.GameObjects.Graphics;
    private resultNumText!: Phaser.GameObjects.Text;
    private chipsText!:     Phaser.GameObjects.Text;
    private betTotalText!:  Phaser.GameObjects.Text;
    private msgText!:       Phaser.GameObjects.Text;
    private statsText!:     Phaser.GameObjects.Text;
    private spinBtnGfx!:    Phaser.GameObjects.Graphics;
    private spinBtnLabel!:  Phaser.GameObjects.Text;
    private clearBtnGfx!:   Phaser.GameObjects.Graphics;

    // Number cell refs for highlighting
    private numCells: Map<number, {
        gfx: Phaser.GameObjects.Graphics;
        lbl: Phaser.GameObjects.Text;
    }> = new Map();

    // Outside bet cell refs
    private outsideCells: Map<string, {
        gfx: Phaser.GameObjects.Graphics;
        lbl: Phaser.GameObjects.Text;
    }> = new Map();

    // Chip button refs
    private chipBtns: Array<{ gfx: Phaser.GameObjects.Graphics; lbl: Phaser.GameObjects.Text; val: number }> = [];

    // Keys
    private escKey!:   Phaser.Input.Keyboard.Key;
    private spaceKey!: Phaser.Input.Keyboard.Key;

    // State
    private spinState: SpinState = 'betting';
    private chipValue: number = 10;
    private bets: Map<string, RouletteBet> = new Map();
    private closed = false;
    private spinTween: Phaser.Tweens.Tween | null = null;

    // Session stats
    private totalSpins   = 0;
    private totalWon     = 0;
    private totalWagered = 0;

    // Spin history — last 8 results shown as coloured badges
    private spinHistory: number[] = [];
    private historyObjs: Phaser.GameObjects.GameObject[] = [];

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene   = scene;
        this.onClose = onClose;
        this.build();
    }

    // ── Build ─────────────────────────────────────────────────────────────────

    private build(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Dimming overlay
        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();
        this.scene.tweens.add({ targets: this.overlay, fillAlpha: 0.78, duration: ANIM_MED });

        // Panel background
        this.panelGfx = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH_PANEL);
        this.drawPanelBg();

        // Container for all content (fade-in)
        this.container = this.scene.add.container(cx, cy)
            .setScrollFactor(0).setDepth(DEPTH_PANEL + 1);
        this.container.setAlpha(0).setScale(0.94);
        this.scene.tweens.add({
            targets: this.container, alpha: 1, scaleX: 1, scaleY: 1,
            duration: ANIM_MED, ease: 'Back.Out',
        });

        // Build all sections
        this.buildHeader();
        this.buildCloseButton();
        this.buildChipSelector();
        this.buildWheel();
        this.buildNumberGrid();
        this.buildOutsideBets();
        this.buildSpinButton();
        this.buildClearButton();
        this.buildStatusRow();
        this.buildHistoryRow();

        // Keyboard
        this.escKey   = this.scene.input.keyboard!.addKey('ESC');
        this.spaceKey = this.scene.input.keyboard!.addKey('SPACE');
        this.escKey.on('down',   () => this.close());
        this.spaceKey.on('down', () => { if (this.spinState === 'betting') this.spin(); });

        this.refreshChipsDisplay();
        this.refreshBetDisplay();
    }

    // ── Panel background ──────────────────────────────────────────────────────

    private drawPanelBg(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const px = cx - PW / 2;
        const py = cy - PH / 2;
        const g  = this.panelGfx;
        g.clear();

        // Shadow
        g.fillStyle(0x000000, 0.5);
        g.fillRoundedRect(px + 5, py + 6, PW, PH, PANEL_RADIUS + 2);
        // Body
        g.fillStyle(0x061010, 1);
        g.fillRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Header band
        g.fillStyle(0x021a10, 1);
        g.fillRoundedRect(px, py, PW, 52, { tl: PANEL_RADIUS, tr: PANEL_RADIUS, bl: 0, br: 0 });
        // Gold border
        g.lineStyle(2, COL_GREEN + 0x004400, 0.9);
        g.strokeRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Inner inset
        g.lineStyle(1, 0x0a3a14, 0.25);
        g.strokeRoundedRect(px + 3, py + 3, PW - 6, PH - 6, PANEL_RADIUS - 1);
        // Header divider
        g.lineStyle(1.5, 0x1a7a30, 0.5);
        g.lineBetween(px + 16, py + 52, px + PW - 16, py + 52);
    }

    // ── Header ────────────────────────────────────────────────────────────────

    private buildHeader(): void {
        const title = this.scene.add.text(0, -PH / 2 + 26, '🎡  ROULETTE', {
            fontFamily: FONT, fontSize: '20px', color: '#28cc50', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        this.chipsText = this.scene.add.text(-PW / 2 + 18, -PH / 2 + 62, '', {
            fontFamily: FONT, fontSize: '12px', color: '#2ecc71', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.container.add(this.chipsText);
    }

    // ── Close button ──────────────────────────────────────────────────────────

    private buildCloseButton(): void {
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

        const hit    = this.scene.add.circle(bx, by, r, 0x000000, 0).setInteractive({ useHandCursor: true });
        const xLabel = this.scene.add.text(bx, by, '✕', {
            fontFamily: FONT, fontSize: '13px', color: '#cc4040',
        }).setOrigin(0.5);

        hit.on('pointerover', () => { draw(true);  xLabel.setColor('#ff5050'); });
        hit.on('pointerout',  () => { draw(false); xLabel.setColor('#cc4040'); });
        hit.on('pointerdown', () => this.close());

        this.container.add([gfx, hit, xLabel]);
    }

    // ── Chip selector ─────────────────────────────────────────────────────────

    private buildChipSelector(): void {
        const y  = -PH / 2 + 72;
        const lbl = this.scene.add.text(-PW / 2 + 18, y, 'CHIP:', {
            fontFamily: FONT, fontSize: '10px', color: '#667788', fontStyle: 'bold', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this.container.add(lbl);

        const startX = -PW / 2 + 78;
        const spacing = 52;

        CHIP_OPTIONS.forEach((val, i) => {
            const bx   = startX + i * spacing;
            const gfx  = this.scene.add.graphics();
            const draw = (sel: boolean, hover: boolean): void => {
                gfx.clear();
                const fill = sel ? 0x163c20 : hover ? 0x0d2016 : 0x080e0a;
                const sc   = sel ? 0x28cc50 : hover ? 0x1a7a30 : 0x224422;
                gfx.fillStyle(fill, 1);
                gfx.fillRoundedRect(bx - 22, y - 12, 44, 24, 4);
                gfx.lineStyle(sel ? 1.5 : 1, sc, sel ? 1 : 0.6);
                gfx.strokeRoundedRect(bx - 22, y - 12, 44, 24, 4);
            };
            draw(val === this.chipValue, false);

            const hit = this.scene.add.rectangle(bx, y, 44, 24, 0x000000, 0)
                .setInteractive({ useHandCursor: true });
            const labelT = this.scene.add.text(bx, y, `${val}`, {
                fontFamily: FONT, fontSize: '12px',
                color: val === this.chipValue ? '#28cc50' : '#668866',
            }).setOrigin(0.5);

            hit.on('pointerover',  () => draw(val === this.chipValue, true));
            hit.on('pointerout',   () => draw(val === this.chipValue, false));
            hit.on('pointerdown',  () => {
                this.chipValue = val;
                this.refreshChipButtons();
            });

            this.container.add([gfx, hit, labelT]);
            this.chipBtns.push({ gfx, lbl: labelT, val });
        });

        // Paytable hint
        const hint = this.scene.add.text(PW / 2 - 12, y, 'Straight 35:1  |  Dozens/Cols 2:1  |  Even-money 1:1', {
            fontFamily: FONT, fontSize: '8px', color: '#284a28',
        }).setOrigin(1, 0.5);
        this.container.add(hint);
    }

    // ── Roulette wheel ────────────────────────────────────────────────────────

    private buildWheel(): void {
        // Wheel container (this rotates during spin)
        this.wheelContainer = this.scene.add.container(WHEEL_CX, WHEEL_CY);

        this.wheelGfx = this.scene.add.graphics();
        this.drawWheelSegments(this.wheelGfx);
        this.wheelContainer.add(this.wheelGfx);

        // Static frame (doesn't rotate) — drawn separately in container
        const frameGfx = this.scene.add.graphics();
        this.drawWheelFrame(frameGfx);

        // Static pointer (upward triangle at top of frame)
        const pointerGfx = this.scene.add.graphics();
        pointerGfx.fillStyle(COL_TRIM, 1);
        pointerGfx.fillTriangle(0, -WHEEL_FR + 2, -7, -WHEEL_FR + 16, 7, -WHEEL_FR + 16);

        // Ball (static, shown on outer ring)
        this.ballGfx = this.scene.add.graphics();
        this.drawBall(this.ballGfx, 0, -WHEEL_OR - 6);

        // Center result circle (non-rotating)
        this.resultCircle = this.scene.add.graphics();
        this.drawResultCircle(null);

        this.resultNumText = this.scene.add.text(0, 0, '?', {
            fontFamily: FONT, fontSize: '24px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.container.add([this.wheelContainer, frameGfx, pointerGfx, this.ballGfx, this.resultCircle, this.resultNumText]);
        // Offset each static element by WHEEL_CX, WHEEL_CY
        [frameGfx, pointerGfx, this.ballGfx, this.resultCircle, this.resultNumText].forEach(o => {
            (o as Phaser.GameObjects.Graphics | Phaser.GameObjects.Text).setPosition(
                (o.x || 0) + WHEEL_CX,
                (o.y || 0) + WHEEL_CY,
            );
        });
    }

    private drawWheelSegments(g: Phaser.GameObjects.Graphics): void {
        const segCount = WHEEL_ORDER.length;  // 37
        const segAngle = (Math.PI * 2) / segCount;

        for (let i = 0; i < segCount; i++) {
            const num        = WHEEL_ORDER[i];
            const startAngle = i * segAngle - Math.PI / 2;
            const endAngle   = (i + 1) * segAngle - Math.PI / 2;

            const fillColor = num === 0
                ? COL_GREEN
                : RED_NUMBERS.has(num) ? COL_RED : COL_BLACK;

            this.drawAnnularSegment(g, WHEEL_IR + 4, WHEEL_OR, startAngle, endAngle, fillColor);

            // Thin separator line
            g.lineStyle(0.5, 0x2a2a2a, 0.8);
            g.lineBetween(
                Math.cos(startAngle) * (WHEEL_IR + 4), Math.sin(startAngle) * (WHEEL_IR + 4),
                Math.cos(startAngle) * WHEEL_OR,       Math.sin(startAngle) * WHEEL_OR,
            );
        }

        // Inner disc (hub)
        g.fillStyle(0x0a1a0a, 1);
        g.fillCircle(0, 0, WHEEL_IR + 3);
        g.lineStyle(1, 0x28cc50, 0.5);
        g.strokeCircle(0, 0, WHEEL_IR + 3);
    }

    private drawWheelFrame(g: Phaser.GameObjects.Graphics): void {
        // Wooden rim
        g.fillStyle(0x3a1c08, 1);
        g.fillCircle(0, 0, WHEEL_FR);
        g.lineStyle(2, COL_TRIM, 0.7);
        g.strokeCircle(0, 0, WHEEL_FR);
        // Inner edge of rim
        g.fillStyle(0x1a0e04, 1);
        g.fillCircle(0, 0, WHEEL_OR + 2);
        g.lineStyle(1, COL_TRIM_DIM, 0.4);
        g.strokeCircle(0, 0, WHEEL_OR + 2);
    }

    private drawResultCircle(result: number | null): void {
        const g = this.resultCircle;
        g.clear();
        const col = result === null ? 0x061010
            : result === 0 ? 0x0a3a14
            : RED_NUMBERS.has(result) ? 0x3a0a0a
            : 0x0a0a0a;
        g.fillStyle(col, 1);
        g.fillCircle(0, 0, WHEEL_IR - 1);
        g.lineStyle(1.5, result === null ? 0x28cc50 : COL_TRIM, 0.8);
        g.strokeCircle(0, 0, WHEEL_IR - 1);
    }

    private drawBall(g: Phaser.GameObjects.Graphics, bx: number, by: number): void {
        g.clear();
        g.fillStyle(0xf8f0e0, 1);
        g.fillCircle(bx, by, 5);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(bx - 1, by - 1, 2);
    }

    private drawAnnularSegment(
        g: Phaser.GameObjects.Graphics,
        innerR: number, outerR: number,
        startAngle: number, endAngle: number,
        fillColor: number,
    ): void {
        const steps  = 5;
        const pts: { x: number; y: number }[] = [];

        for (let i = 0; i <= steps; i++) {
            const a = startAngle + (endAngle - startAngle) * i / steps;
            pts.push({ x: Math.cos(a) * outerR, y: Math.sin(a) * outerR });
        }
        for (let i = steps; i >= 0; i--) {
            const a = startAngle + (endAngle - startAngle) * i / steps;
            pts.push({ x: Math.cos(a) * innerR, y: Math.sin(a) * innerR });
        }

        g.fillStyle(fillColor, 1);
        g.fillPoints(pts, true);
    }

    // ── Number grid ───────────────────────────────────────────────────────────

    private buildNumberGrid(): void {
        // 0 cell (green, spans 3 rows)
        this.buildNumberCell(0, GRID_X, GRID_Y, ZERO_W, CELL_H * 3);

        // Numbers 1-36: laid out as 12 columns × 3 rows
        // col c (0..11), row r (0..2): number = 3*(c+1) - r
        for (let c = 0; c < NUM_COLS; c++) {
            for (let r = 0; r < 3; r++) {
                const num = 3 * (c + 1) - r;
                const bx  = GRID_X + ZERO_W + c * CELL_W;
                const by  = GRID_Y + r * CELL_H;
                this.buildNumberCell(num, bx, by, CELL_W, CELL_H);
            }
        }
    }

    private buildNumberCell(
        num: number,
        bx: number, by: number,
        cw: number, ch: number,
    ): void {
        const col    = getNumberColor(num);
        const bgBase = col === 'green' ? 0x0a2a10
            : col === 'red'   ? COL_NUM_BG_RED
            : COL_NUM_BG_BLK;

        const gfx  = this.scene.add.graphics();
        const draw = (selected: boolean, hover: boolean, winning: boolean): void => {
            gfx.clear();
            const fill = winning ? COL_NUM_BG_WIN
                : selected ? COL_NUM_BG_SEL
                : hover    ? bgBase + 0x222222
                : bgBase;
            gfx.fillStyle(fill, 1);
            gfx.fillRect(bx, by, cw, ch);
            const bc = selected ? COL_TRIM : hover ? 0x448844 : 0x224422;
            gfx.lineStyle(0.5, bc, selected ? 0.9 : 0.4);
            gfx.strokeRect(bx, by, cw, ch);
        };
        draw(false, false, false);

        const labelColor = col === 'green' ? '#50ee80'
            : col === 'red'   ? '#ff8888'
            : '#bbbbbb';
        const lbl = this.scene.add.text(bx + cw / 2, by + ch / 2, `${num}`, {
            fontFamily: FONT, fontSize: num === 0 ? '12px' : '10px',
            color: labelColor, fontStyle: 'bold',
        }).setOrigin(0.5);

        const hit = this.scene.add.rectangle(bx + cw / 2, by + ch / 2, cw, ch, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        hit.on('pointerover',  () => draw(this.bets.has(this.getBetKey('straight', num)), true, false));
        hit.on('pointerout',   () => draw(this.bets.has(this.getBetKey('straight', num)), false, false));
        hit.on('pointerdown',  () => this.addToBet('straight', num));

        this.container.add([gfx, lbl, hit]);
        this.numCells.set(num, { gfx, lbl });
    }

    // ── Outside bets ─────────────────────────────────────────────────────────

    private buildOutsideBets(): void {
        // Dozen row: y = GRID_Y + 3*CELL_H + 4
        const dozenY = GRID_Y + 3 * CELL_H + 4;
        const dozenW = NUM_COLS * CELL_W / 3;  // 4 columns each

        this.buildOutsideCell('dozen1', '1st 12',  GRID_X + ZERO_W,              dozenY, dozenW, 22, 0x141428);
        this.buildOutsideCell('dozen2', '2nd 12',  GRID_X + ZERO_W + dozenW,     dozenY, dozenW, 22, 0x141428);
        this.buildOutsideCell('dozen3', '3rd 12',  GRID_X + ZERO_W + dozenW * 2, dozenY, dozenW, 22, 0x141428);

        // Even-money row: y = dozenY + 22 + 4
        const emY  = dozenY + 22 + 4;
        const emW  = NUM_COLS * CELL_W / 6;  // 2 columns each

        this.buildOutsideCell('low',   '1-18',    GRID_X + ZERO_W + emW * 0, emY, emW, 22, 0x101418);
        this.buildOutsideCell('even',  'Even',    GRID_X + ZERO_W + emW * 1, emY, emW, 22, 0x101418);
        this.buildOutsideCell('red',   'Red',     GRID_X + ZERO_W + emW * 2, emY, emW, 22, 0x1e0808, COL_RED);
        this.buildOutsideCell('black', 'Black',   GRID_X + ZERO_W + emW * 3, emY, emW, 22, 0x080808, COL_BLACK + 0x222222);
        this.buildOutsideCell('odd',   'Odd',     GRID_X + ZERO_W + emW * 4, emY, emW, 22, 0x101418);
        this.buildOutsideCell('high',  '19-36',   GRID_X + ZERO_W + emW * 5, emY, emW, 22, 0x101418);
    }

    private buildOutsideCell(
        type: BetType, label: string,
        bx: number, by: number, cw: number, ch: number,
        bgColor: number, textColor?: number,
    ): void {
        const gfx  = this.scene.add.graphics();
        const draw = (selected: boolean, hover: boolean, winning: boolean): void => {
            gfx.clear();
            const fill = winning  ? 0x1a3a10
                : selected ? 0x1c3a1c
                : hover    ? bgColor + 0x101010
                : bgColor;
            gfx.fillStyle(fill, 1);
            gfx.fillRect(bx, by, cw, ch);
            const bc = selected ? COL_TRIM : hover ? 0x448844 : 0x224422;
            gfx.lineStyle(0.5, bc, selected ? 0.9 : 0.4);
            gfx.strokeRect(bx, by, cw, ch);
        };
        draw(false, false, false);

        const lblColor = textColor
            ? `#${textColor.toString(16).padStart(6, '0')}`
            : '#aaccaa';
        const lbl = this.scene.add.text(bx + cw / 2, by + ch / 2, label, {
            fontFamily: FONT, fontSize: '9px', color: lblColor, fontStyle: 'bold',
        }).setOrigin(0.5);

        const hit = this.scene.add.rectangle(bx + cw / 2, by + ch / 2, cw, ch, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const key = this.getBetKey(type);
        hit.on('pointerover',  () => draw(this.bets.has(key), true, false));
        hit.on('pointerout',   () => draw(this.bets.has(key), false, false));
        hit.on('pointerdown',  () => this.addToBet(type));

        this.container.add([gfx, lbl, hit]);
        this.outsideCells.set(key, { gfx, lbl });
    }

    // ── Spin button ───────────────────────────────────────────────────────────

    private buildSpinButton(): void {
        const btnW = 180;
        const btnH = 42;
        const btnY = PH / 2 - 72;

        this.spinBtnGfx = this.scene.add.graphics();
        this.drawSpinBtn('idle');

        this.spinBtnLabel = this.scene.add.text(0, btnY, 'SPIN  [SPACE]', {
            fontFamily: FONT, fontSize: '15px', color: '#28cc50', fontStyle: 'bold',
        }).setOrigin(0.5);

        const hit = this.scene.add.rectangle(0, btnY, btnW, btnH, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        hit.on('pointerover',  () => { if (this.spinState === 'betting') this.drawSpinBtn('hover'); });
        hit.on('pointerout',   () => { if (this.spinState === 'betting') this.drawSpinBtn('idle'); });
        hit.on('pointerdown',  () => { if (this.spinState === 'betting') this.spin(); });

        this.container.add([this.spinBtnGfx, this.spinBtnLabel, hit]);
    }

    private drawSpinBtn(state: 'idle' | 'hover' | 'spinning'): void {
        const btnW = 180;
        const btnH = 42;
        const btnY = PH / 2 - 72;
        const g    = this.spinBtnGfx;
        g.clear();

        const fills = { idle: 0x0a2a10, hover: 0x163c20, spinning: 0x060e06 };
        const bords = { idle: 0x28cc50, hover: COL_TRIM_LIGHT, spinning: 0x0a2a0a };

        g.fillStyle(0x000000, 0.4);
        g.fillRoundedRect(-btnW / 2 + 2, btnY - btnH / 2 + 3, btnW, btnH, 6);
        g.fillStyle(fills[state], 1);
        g.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
        g.lineStyle(1.5, bords[state], state === 'spinning' ? 0.3 : 0.9);
        g.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
    }

    // ── Clear button ──────────────────────────────────────────────────────────

    private buildClearButton(): void {
        const btnW = 100;
        const btnH = 30;
        const btnY = PH / 2 - 72;
        const btnX = 110;

        this.clearBtnGfx = this.scene.add.graphics();
        const draw = (hover: boolean): void => {
            this.clearBtnGfx.clear();
            this.clearBtnGfx.fillStyle(hover ? 0x2a0808 : 0x160404, 1);
            this.clearBtnGfx.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
            this.clearBtnGfx.lineStyle(1, hover ? 0xcc4444 : 0x442222, 0.8);
            this.clearBtnGfx.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 4);
        };
        draw(false);

        const lbl = this.scene.add.text(btnX, btnY, 'CLEAR BETS', {
            fontFamily: FONT, fontSize: '9px', color: '#884444',
        }).setOrigin(0.5);

        const hit = this.scene.add.rectangle(btnX, btnY, btnW, btnH, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        hit.on('pointerover',  () => { draw(true);  lbl.setColor('#cc4444'); });
        hit.on('pointerout',   () => { draw(false); lbl.setColor('#884444'); });
        hit.on('pointerdown',  () => this.clearBets());

        this.container.add([this.clearBtnGfx, lbl, hit]);
    }

    // ── Status row ────────────────────────────────────────────────────────────

    private buildStatusRow(): void {
        this.betTotalText = this.scene.add.text(-110, PH / 2 - 72, '', {
            fontFamily: FONT, fontSize: '11px', color: '#aaccaa',
        }).setOrigin(0.5);

        this.msgText = this.scene.add.text(0, PH / 2 - 42, '', {
            fontFamily: FONT, fontSize: '13px', color: '#28cc50', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.statsText = this.scene.add.text(0, PH / 2 - 22, '', {
            fontFamily: FONT, fontSize: '10px', color: '#3a6a3a',
        }).setOrigin(0.5);

        this.container.add([this.betTotalText, this.msgText, this.statsText]);
    }

    // ── Spin history row ──────────────────────────────────────────────────────

    private buildHistoryRow(): void {
        // Header label (persists)
        const lbl = this.scene.add.text(-PW / 2 + 18, PH / 2 - 8, 'LAST SPINS:', {
            fontFamily: FONT, fontSize: '9px', color: '#3a6a3a', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this.container.add(lbl);
    }

    private updateHistory(result: number): void {
        // Destroy old badge objects
        for (const obj of this.historyObjs) obj.destroy();
        this.historyObjs = [];

        // Update history array (max 8 entries, newest first)
        this.spinHistory.unshift(result);
        if (this.spinHistory.length > 8) this.spinHistory.length = 8;

        const startX = -PW / 2 + 90;
        const y      = PH / 2 - 8;
        const radius = 9;
        const gap    = 22;

        this.spinHistory.forEach((num, i) => {
            const cx  = startX + i * gap;
            const col = getNumberColor(num);
            const fillCol = col === 'green' ? COL_GREEN
                : col === 'red'   ? COL_RED
                : COL_BLACK;
            const borderCol = col === 'green' ? 0x50ee80
                : col === 'red'   ? 0xff5555
                : 0x888888;
            const alpha = 1 - i * 0.09;  // fade out older results subtly

            const g = this.scene.add.graphics();
            g.fillStyle(0x000000, 0.5);
            g.fillCircle(cx + 1, y + 1, radius);
            g.fillStyle(fillCol, alpha);
            g.fillCircle(cx, y, radius);
            g.lineStyle(1, borderCol, alpha * 0.9);
            g.strokeCircle(cx, y, radius);
            this.container.add(g);
            this.historyObjs.push(g);

            const t = this.scene.add.text(cx, y, `${num}`, {
                fontFamily: FONT, fontSize: num < 10 ? '9px' : '8px',
                color: col === 'black' ? '#cccccc' : '#ffffff', fontStyle: 'bold',
            }).setOrigin(0.5).setAlpha(alpha);
            this.container.add(t);
            this.historyObjs.push(t);
        });
    }



    private getBetKey(type: BetType, number?: number): string {
        return type === 'straight' ? `straight:${number}` : type;
    }

    private addToBet(type: BetType, number?: number): void {
        if (this.spinState !== 'betting') return;

        const chips = GameState.get().chips;
        if (chips < this.chipValue) {
            this.showMsg(`Need ${this.chipValue} chips to bet!`, '#e74c3c');
            return;
        }

        const key      = this.getBetKey(type, number);
        const existing = this.bets.get(key);

        if (existing) {
            existing.amount += this.chipValue;
        } else {
            this.bets.set(key, { type, number, amount: this.chipValue });
        }

        GameState.addChips(-this.chipValue);
        this.refreshChipsDisplay();
        this.refreshBetDisplay();
        this.refreshBoardHighlights(false, null);
    }

    private clearBets(): void {
        if (this.spinState !== 'betting') return;
        const refund = getTotalBetAmount([...this.bets.values()]);
        this.bets.clear();
        if (refund > 0) {
            GameState.addChips(refund);
            this.refreshChipsDisplay();
        }
        this.refreshBetDisplay();
        this.refreshBoardHighlights(false, null);
    }

    // ── Spin logic ────────────────────────────────────────────────────────────

    private spin(): void {
        if (this.spinState !== 'betting') return;
        if (this.bets.size === 0) {
            this.showMsg('Place a bet first!', '#e74c3c');
            return;
        }

        const result = spinResult();
        this.spinState = 'spinning';
        this.drawSpinBtn('spinning');
        this.spinBtnLabel.setText('SPINNING...').setColor('#3a6a3a');
        this.msgText.setText('');

        // Animate wheel rotation then show result
        const winIndex    = getWheelIndex(result);
        const segAngle    = 360 / WHEEL_ORDER.length;
        const targetAngle = -(winIndex * segAngle);  // wheel position to align to pointer
        const fullSpins   = 5;
        const finalAngle  = fullSpins * 360 + targetAngle;

        this.spinTween = this.scene.tweens.add({
            targets:     this.wheelContainer,
            angle:       finalAngle,
            duration:    3200,
            ease:        'Cubic.easeOut',
            onComplete:  () => this.onSpinComplete(result),
        });

        // Animate ball bouncing around outer ring
        this.scene.time.delayedCall(400, () => this.animateBall(result));
    }

    private animateBall(_result: number): void {
        if (this.closed) return;
        // Spin ball in opposite direction, decelerating over the spin duration
        let angle = 0;
        let speed = 28;   // degrees/tick — starts fast
        let tick  = 0;
        const TOTAL_TICKS = 45;
        const timer = this.scene.time.addEvent({
            delay:    60,
            repeat:   TOTAL_TICKS,
            callback: () => {
                if (this.closed) { timer.remove(); return; }
                // Ease-out: speed falls from 28 to 6 over the animation
                speed = 28 * (1 - tick / TOTAL_TICKS) + 6;
                angle += speed;
                tick++;
                const r   = WHEEL_OR + 6;
                const rad = (angle * Math.PI) / 180;
                this.ballGfx.setPosition(
                    WHEEL_CX + Math.cos(rad) * r,
                    WHEEL_CY + Math.sin(rad) * r,
                );
                this.drawBall(this.ballGfx, 0, 0);
            },
        });
    }

    private onSpinComplete(result: number): void {
        if (this.closed) return;
        this.totalSpins++;

        // Position ball on winning number segment
        const winIndex = getWheelIndex(result);
        const segAngle = (2 * Math.PI) / WHEEL_ORDER.length;
        const currentWheelAngle = (this.wheelContainer.angle * Math.PI) / 180;
        // The winning segment's center angle (in world space after rotation):
        const segCenter = -(winIndex * segAngle) + currentWheelAngle + Math.PI / WHEEL_ORDER.length;
        const ballR = WHEEL_OR + 6;
        this.ballGfx.setPosition(
            WHEEL_CX + Math.cos(segCenter) * ballR,
            WHEEL_CY + Math.sin(segCenter) * ballR,
        );
        this.drawBall(this.ballGfx, 0, 0);

        // Update center display
        this.drawResultCircle(result);
        this.resultNumText.setPosition(WHEEL_CX, WHEEL_CY);
        const col = result === 0 ? '#50ee80'
            : RED_NUMBERS.has(result) ? '#ff6666'
            : '#cccccc';
        this.resultNumText.setText(`${result}`).setColor(col);

        // Evaluate bets
        const betList = [...this.bets.values()];
        const net     = evalAllBets(betList, result);
        const wagered = getTotalBetAmount(betList);

        this.totalWagered += wagered;
        this.bets.clear();

        // totalReturn = stake returned + net profit (always >= 0)
        const totalReturn = wagered + net;
        if (totalReturn > 0) {
            GameState.addChips(totalReturn);
        }

        if (net > 0) {
            this.totalWon += totalReturn;
            this.showMsg(`${result} — WIN! +${net}◈`, '#2ecc71');
            this.showChipDelta(`+${net}◈`, '#2ecc71');
            ToastManager.show(this.scene, `${result}! +${net} ◈`, 'win');
        } else if (net === 0) {
            // push (e.g., bets on both red and black cancel out)
            this.showMsg(`${result} — Push`, '#c9a84c');
        } else if (totalReturn > 0) {
            // Partial return: some bets won, overall net loss
            this.showMsg(`${result} — Net loss  (${totalReturn}◈ returned)`, '#e74c3c');
            this.showChipDelta(`-${wagered - totalReturn}◈`, '#e74c3c');
            ToastManager.show(this.scene, `-${wagered - totalReturn} ◈`, 'loss');
        } else {
            this.showMsg(`${result} — No win  -${wagered}◈`, '#e74c3c');
            this.showChipDelta(`-${wagered}◈`, '#e74c3c');
            ToastManager.show(this.scene, `-${wagered} ◈`, 'loss');
        }

        this.refreshChipsDisplay();
        this.refreshBetDisplay();
        this.refreshBoardHighlights(true, result);
        this.updateStats();
        this.updateHistory(result);

        // Restore betting state after a short delay
        this.scene.time.delayedCall(2000, () => {
            if (this.closed) return;
            this.spinState = 'betting';
            this.drawSpinBtn('idle');
            this.spinBtnLabel.setText('SPIN  [SPACE]').setColor('#28cc50');
            this.refreshBoardHighlights(false, null);
        });
    }

    // ── Display helpers ───────────────────────────────────────────────────────

    private refreshChipsDisplay(): void {
        this.chipsText.setText(`◈ ${GameState.get().chips.toLocaleString()} chips`);
    }

    private refreshBetDisplay(): void {
        const total = getTotalBetAmount([...this.bets.values()]);
        if (total === 0) {
            this.betTotalText.setText('No bets placed');
        } else {
            this.betTotalText.setText(`Bets: ${total}◈  (${this.bets.size} position${this.bets.size > 1 ? 's' : ''})`);
        }
    }

    private refreshChipButtons(): void {
        this.chipBtns.forEach(({ gfx, lbl, val }) => {
            const sel = val === this.chipValue;
            gfx.clear();
            const y = -PH / 2 + 72;
            const startX = -PW / 2 + 78;
            const bx = startX + CHIP_OPTIONS.indexOf(val) * 52;
            gfx.fillStyle(sel ? 0x163c20 : 0x080e0a, 1);
            gfx.fillRoundedRect(bx - 22, y - 12, 44, 24, 4);
            gfx.lineStyle(sel ? 1.5 : 1, sel ? 0x28cc50 : 0x224422, sel ? 1 : 0.6);
            gfx.strokeRoundedRect(bx - 22, y - 12, 44, 24, 4);
            lbl.setColor(sel ? '#28cc50' : '#668866');
        });
    }

    private refreshBoardHighlights(showResult: boolean, result: number | null): void {
        // Number cells
        for (const [num, { gfx }] of this.numCells) {
            const selected = this.bets.has(this.getBetKey('straight', num));
            const winning  = showResult && result === num;
            const col      = getNumberColor(num);
            const bgBase   = col === 'green' ? 0x0a2a10
                : col === 'red' ? COL_NUM_BG_RED : COL_NUM_BG_BLK;

            const isZero = num === 0;
            const cw = isZero ? ZERO_W : CELL_W;
            const ch = isZero ? CELL_H * 3 : CELL_H;
            const bx = isZero ? GRID_X : GRID_X + ZERO_W + (Math.ceil(num / 3) - 1) * CELL_W;
            const by = isZero ? GRID_Y : GRID_Y + (2 - ((num - 1) % 3)) * CELL_H;

            gfx.clear();
            const fill = winning  ? COL_NUM_BG_WIN
                : selected ? COL_NUM_BG_SEL
                : bgBase;
            gfx.fillStyle(fill, 1);
            gfx.fillRect(bx, by, cw, ch);
            const bc = selected ? COL_TRIM : winning ? 0x28cc50 : 0x224422;
            gfx.lineStyle(winning ? 1.5 : 0.5, bc, selected || winning ? 0.9 : 0.4);
            gfx.strokeRect(bx, by, cw, ch);
        }

        // Outside cells
        for (const [key, { gfx }] of this.outsideCells) {
            const parts = key.split(':');
            const type  = parts[0] as BetType;
            const selected = this.bets.has(key);
            const winning  = showResult && result !== null && betWins(type, undefined, result);

            // Re-draw the cell background (we need to know its position — store it)
            // Simple approach: just change opacity/alpha of the existing graphics
            gfx.setAlpha(winning ? 1 : selected ? 0.9 : 1);
            if (winning) {
                gfx.setAlpha(1);
                // Flash effect
                this.scene.tweens.add({
                    targets: gfx, alpha: 0.4,
                    yoyo: true, repeat: 3, duration: 150,
                    onComplete: () => { if (!this.closed) gfx.setAlpha(1); },
                });
            }
        }

        // Pulse winning number cell
        if (showResult && result !== null) {
            const cell = this.numCells.get(result);
            if (cell) {
                this.scene.tweens.add({
                    targets: [cell.gfx, cell.lbl],
                    alpha: 0.3, yoyo: true, repeat: 4, duration: 130,
                    onComplete: () => { if (!this.closed) { cell.gfx.setAlpha(1); cell.lbl.setAlpha(1); } },
                });
            }
        }
    }

    private showMsg(msg: string, color: string): void {
        this.msgText.setText(msg).setColor(color);
        if (msg) {
            this.scene.tweens.add({
                targets: this.msgText, scaleX: [1.12, 1], scaleY: [1.12, 1],
                duration: 180, ease: 'Back.Out',
            });
        }
    }

    private showChipDelta(text: string, color: string): void {
        const delta = this.scene.add.text(
            WHEEL_CX, WHEEL_CY - WHEEL_FR - 10, text, {
                fontFamily: FONT, fontSize: '18px', color, fontStyle: 'bold',
            },
        ).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_PANEL + 5);
        this.container.add(delta);
        this.scene.tweens.add({
            targets: delta, y: delta.y - 40, alpha: 0, duration: 1200, ease: 'Cubic.easeOut',
            onComplete: () => delta.destroy(),
        });
    }

    private updateStats(): void {
        if (this.totalSpins === 0) return;
        const net    = this.totalWon - this.totalWagered;
        const sign   = net >= 0 ? '+' : '';
        const col    = net >= 0 ? '#3a6a3a' : '#6a3a3a';
        this.statsText.setText(`Spins: ${this.totalSpins}  ·  Net: ${sign}${net}◈`).setColor(col);
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    private close(): void {
        if (this.closed) return;
        this.closed = true;

        // Refund any outstanding bets
        const refund = getTotalBetAmount([...this.bets.values()]);
        if (refund > 0) GameState.addChips(refund);

        this.spinTween?.stop();
        this.escKey.destroy();
        this.spaceKey.destroy();
        this.overlay.destroy();
        this.panelGfx.destroy();
        this.container.destroy(true);
        this.onClose();
    }
}
