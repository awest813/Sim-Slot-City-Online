// ── Horse Race Betting panel ───────────────────────────────────────────────────
// Player picks a horse, chooses a bet amount, then watches the race animation.
// Payouts depend on horse odds (2× – 20×).  Bet is deducted on race start.
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_HORSES_ACCENT,
    FONT, ANIM_MED,
    COL_UI_BG2, COL_UI_BG3, COL_UI_BORDER,
    COL_TRIM,
    TEXT_MD,
} from '../../game/constants';
import {
    HORSES, BET_OPTIONS,
    RaceState,
    createRace, resolveRace, chipDelta,
} from './HorseRaceEngine';
import { ToastManager } from '../ui/ToastManager';
import { paintLifeSimShell } from '../ui/shell';

// ── Layout constants ──────────────────────────────────────────────────────────
const PW = 640;
const PH = 500;

// Track area dimensions (right side of panel)
const TRACK_LEFT   = 50;        // left edge of track relative to container origin
const TRACK_RIGHT  = PW / 2 - 24;
const TRACK_W      = TRACK_RIGHT - TRACK_LEFT;
const TRACK_TOP    = -PH / 2 + 68;
const LANE_H       = 48;        // height per horse lane

// Controls area (left side)
const CTRL_LEFT = -PW / 2 + 24;

// ── Horse row colours ─────────────────────────────────────────────────────────
const LANE_BG_ODD  = 0x070e1c;
const LANE_BG_EVEN = 0x060c18;

export class HorseRacePanel {
    private scene:   Phaser.Scene;
    private onClose: () => void;

    // Phaser objects
    private overlay!:    Phaser.GameObjects.Rectangle;
    private panelGfx!:   Phaser.GameObjects.Graphics;
    private container!:  Phaser.GameObjects.Container;
    private chipsText!:  Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private raceBtnGfx!: Phaser.GameObjects.Graphics;
    private raceBtnLbl!: Phaser.GameObjects.Text;
    private raceBtnHit!: Phaser.GameObjects.Rectangle;

    // Per-horse track bar graphics and position labels
    private laneGfxs:    Phaser.GameObjects.Graphics[] = [];
    private horseSprites: Phaser.GameObjects.Text[] = [];
    // Selection highlight graphic per horse (left-side rows)
    private horseRowGfxs: Phaser.GameObjects.Graphics[] = [];
    private horseLabelTxts: Phaser.GameObjects.Text[] = [];
    private horseOddsTxts:  Phaser.GameObjects.Text[] = [];

    // Bet buttons
    private betBtns: Array<{
        gfx: Phaser.GameObjects.Graphics;
        lbl: Phaser.GameObjects.Text;
        amount: number;
    }> = [];

    // Session stats text
    private statsText!: Phaser.GameObjects.Text;

    // Input keys
    private escKey!: Phaser.Input.Keyboard.Key;

    // State
    private raceState: RaceState | null = null;
    private currentBet:     number  = 50;
    private selectedHorse:  number  = 0;
    private closed:         boolean = false;
    private raceTimers:     Phaser.Time.TimerEvent[] = [];
    private particleGfx!: Phaser.GameObjects.Graphics;
    private particles: Array<{ x: number; y: number; alpha: number; size: number; col: number }> = [];

    // Session stats
    private totalRaces  = 0;
    private totalWon    = 0;
    private totalWagered = 0;

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

        this.buildHeader();
        this.buildHorseList();
        this.buildBetSelector();
        this.buildTrack();
        this.buildRaceButton();
        this.buildStatsRow();

        // Keyboard
        this.escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.escKey.once('down', () => this.close());
    }

    // ── Panel Background ──────────────────────────────────────────────────────

    private drawPanelBg(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        this.panelGfx.clear();
        paintLifeSimShell(this.panelGfx, cx - PW / 2, cy - PH / 2, PW, PH);
    }

    // ── Header ────────────────────────────────────────────────────────────────

    private buildHeader(): void {
        const hY = -PH / 2 + 25;

        this.container.add(
            this.scene.add.text(0, hY, '🏇  HORSE RACE BETTING', {
                fontFamily: FONT, fontSize: '16px',
                color: Phaser.Display.Color.IntegerToColor(COL_HORSES_ACCENT).rgba,
                fontStyle: 'bold',
            }).setOrigin(0.5),
        );

        this.chipsText = this.scene.add.text(PW / 2 - 16, hY, '', {
            ...TEXT_MD, color: '#2ecc71',
        }).setOrigin(1, 0.5);
        this.container.add(this.chipsText);
        this.refreshChips();

        // Close button
        const closeGfx = this.scene.add.graphics();
        const closeCx  = PW / 2 - 14;
        const closeCy  = -PH / 2 + 14;
        closeGfx.fillStyle(0x3a1010, 1);
        closeGfx.fillRoundedRect(closeCx - 10, closeCy - 10, 20, 20, 3);
        closeGfx.lineStyle(1, 0xff4040, 0.7);
        closeGfx.strokeRoundedRect(closeCx - 10, closeCy - 10, 20, 20, 3);
        this.container.add(closeGfx);

        const closeBtn = this.scene.add.text(closeCx, closeCy, '✕', {
            fontFamily: FONT, fontSize: '12px', color: '#ff6060',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.close());
        closeBtn.on('pointerover',  () => closeGfx.clear()
            .fillStyle(0x6a1010, 1).fillRoundedRect(closeCx - 10, closeCy - 10, 20, 20, 3)
            .lineStyle(1, 0xff6060, 1).strokeRoundedRect(closeCx - 10, closeCy - 10, 20, 20, 3));
        closeBtn.on('pointerout', () => {
            closeGfx.clear();
            closeGfx.fillStyle(0x3a1010, 1);
            closeGfx.fillRoundedRect(closeCx - 10, closeCy - 10, 20, 20, 3);
            closeGfx.lineStyle(1, 0xff4040, 0.7);
            closeGfx.strokeRoundedRect(closeCx - 10, closeCy - 10, 20, 20, 3);
        });
        this.container.add(closeBtn);

        // Divider
        const divGfx = this.scene.add.graphics();
        divGfx.lineStyle(1, COL_TRIM, 0.25);
        divGfx.lineBetween(-PW / 2 + 16, -PH / 2 + 50, PW / 2 - 16, -PH / 2 + 50);
        this.container.add(divGfx);

        // Status
        this.statusText = this.scene.add.text(0, PH / 2 - 24, 'Pick a horse, set your bet, then press RACE!', {
            fontFamily: FONT, fontSize: '11px', color: '#6a8880',
        }).setOrigin(0.5);
        this.container.add(this.statusText);
    }

    // ── Horse List (left panel) ───────────────────────────────────────────────

    private buildHorseList(): void {
        const listTop  = -PH / 2 + 60;
        const listLeft = CTRL_LEFT;
        const rowW     = 200;

        // Header
        const hdrGfx = this.scene.add.graphics();
        hdrGfx.fillStyle(COL_UI_BG3, 1);
        hdrGfx.fillRoundedRect(listLeft, listTop, rowW, 22, 3);
        this.container.add(hdrGfx);
        const hdrTxt = this.scene.add.text(listLeft + rowW / 2, listTop + 11, 'HORSE', {
            fontFamily: FONT, fontSize: '9px', color: '#c9a84c',
        }).setOrigin(0.5);
        const hdrOdds = this.scene.add.text(listLeft + rowW - 6, listTop + 11, 'PAYS', {
            fontFamily: FONT, fontSize: '9px', color: '#c9a84c',
        }).setOrigin(1, 0.5);
        this.container.add([hdrTxt, hdrOdds]);

        HORSES.forEach((horse, i) => {
            const ry     = listTop + 22 + i * 38;
            const isEven = i % 2 === 0;

            // Row background
            const rowGfx = this.scene.add.graphics();
            rowGfx.fillStyle(isEven ? LANE_BG_ODD : LANE_BG_EVEN, 1);
            rowGfx.fillRoundedRect(listLeft, ry, rowW, 36, 3);
            this.container.add(rowGfx);
            this.horseRowGfxs.push(rowGfx);

            // Horse name
            const colorHex = '#' + horse.color.toString(16).padStart(6, '0');
            const nameTxt = this.scene.add.text(listLeft + 8, ry + 18, `${horse.emoji} ${horse.name}`, {
                fontFamily: FONT, fontSize: '11px', color: colorHex,
            }).setOrigin(0, 0.5);
            this.container.add(nameTxt);
            this.horseLabelTxts.push(nameTxt);

            // Odds
            const oddsTxt = this.scene.add.text(listLeft + rowW - 6, ry + 18, `${horse.odds}×`, {
                fontFamily: FONT, fontSize: '12px', color: '#c9a84c', fontStyle: 'bold',
            }).setOrigin(1, 0.5);
            this.container.add(oddsTxt);
            this.horseOddsTxts.push(oddsTxt);

            // Invisible hit area
            const hit = this.scene.add.rectangle(
                listLeft + rowW / 2, ry + 18, rowW, 36, 0x000000, 0,
            ).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => this.selectHorse(i));
            hit.on('pointerover',  () => { if (this.raceState === null) this.highlightHorseRow(i, true); });
            hit.on('pointerout',   () => { this.highlightHorseRow(i, this.selectedHorse === i); });
            this.container.add(hit);
        });

        this.highlightHorseRow(this.selectedHorse, true);
    }

    private selectHorse(i: number): void {
        if (this.raceState !== null) return;
        const prev = this.selectedHorse;
        this.selectedHorse = i;
        this.highlightHorseRow(prev, false);
        this.highlightHorseRow(i, true);
        this.refreshRaceButton();
    }

    private highlightHorseRow(i: number, selected: boolean): void {
        const gfx   = this.horseRowGfxs[i];
        const horse = HORSES[i];
        const listLeft = CTRL_LEFT;
        const ry = -PH / 2 + 60 + 22 + i * 38;
        const rowW = 200;
        gfx.clear();
        if (selected) {
            gfx.fillStyle(horse.color, 0.18);
            gfx.fillRoundedRect(listLeft, ry, rowW, 36, 3);
            gfx.lineStyle(1, horse.color, 0.65);
            gfx.strokeRoundedRect(listLeft, ry, rowW, 36, 3);
        } else {
            const isEven = i % 2 === 0;
            gfx.fillStyle(isEven ? LANE_BG_ODD : LANE_BG_EVEN, 1);
            gfx.fillRoundedRect(listLeft, ry, rowW, 36, 3);
        }
    }

    // ── Bet Selector ──────────────────────────────────────────────────────────

    private buildBetSelector(): void {
        const bsLeft = CTRL_LEFT;
        const bsTop  = -PH / 2 + 60 + 22 + HORSES.length * 38 + 12;

        const label = this.scene.add.text(bsLeft, bsTop, 'BET AMOUNT', {
            fontFamily: FONT, fontSize: '9px', color: '#c9a84c',
        }).setOrigin(0, 0.5);
        this.container.add(label);

        const btnW   = 44;
        const btnH   = 26;
        const btnGap = 6;

        BET_OPTIONS.forEach((amount, idx) => {
            const bx  = bsLeft + idx * (btnW + btnGap);
            const by  = bsTop + 14;

            const gfx = this.scene.add.graphics();
            const lbl = this.scene.add.text(bx + btnW / 2, by + btnH / 2, `${amount}`, {
                fontFamily: FONT, fontSize: '11px', color: '#c8c0b0',
            }).setOrigin(0.5);
            const hit = this.scene.add.rectangle(bx + btnW / 2, by + btnH / 2, btnW, btnH, 0, 0)
                .setInteractive({ useHandCursor: true });

            hit.on('pointerdown', () => this.selectBet(amount));
            hit.on('pointerover',  () => { if (this.raceState === null) this.drawBetBtn(gfx, bx, by, btnW, btnH, amount, true); });
            hit.on('pointerout',   () => this.drawBetBtn(gfx, bx, by, btnW, btnH, amount, false));

            this.container.add([gfx, lbl, hit]);
            this.betBtns.push({ gfx, lbl, amount });
            this.drawBetBtn(gfx, bx, by, btnW, btnH, amount, false);
        });
    }

    private selectBet(amount: number): void {
        if (this.raceState !== null) return;
        this.currentBet = amount;
        this.refreshBetButtons();
        this.refreshRaceButton();
    }

    private drawBetBtn(
        gfx: Phaser.GameObjects.Graphics,
        bx: number, by: number, bw: number, bh: number,
        amount: number, hover: boolean,
    ): void {
        const isSelected = this.currentBet === amount;
        gfx.clear();
        if (isSelected) {
            gfx.fillStyle(COL_HORSES_ACCENT, 0.25);
            gfx.fillRoundedRect(bx, by, bw, bh, 3);
            gfx.lineStyle(1.5, COL_HORSES_ACCENT, 0.9);
            gfx.strokeRoundedRect(bx, by, bw, bh, 3);
        } else if (hover) {
            gfx.fillStyle(COL_UI_BG2, 1);
            gfx.fillRoundedRect(bx, by, bw, bh, 3);
            gfx.lineStyle(1, COL_TRIM, 0.4);
            gfx.strokeRoundedRect(bx, by, bw, bh, 3);
        } else {
            gfx.fillStyle(COL_UI_BG3, 1);
            gfx.fillRoundedRect(bx, by, bw, bh, 3);
            gfx.lineStyle(1, COL_UI_BORDER, 0.25);
            gfx.strokeRoundedRect(bx, by, bw, bh, 3);
        }
    }

    private refreshBetButtons(): void {
        const bsLeft = CTRL_LEFT;
        const bsTop  = -PH / 2 + 60 + 22 + HORSES.length * 38 + 12 + 14;
        const btnW   = 44;
        const btnH   = 26;
        const btnGap = 6;
        this.betBtns.forEach(({ gfx, amount }, idx) => {
            const bx = bsLeft + idx * (btnW + btnGap);
            this.drawBetBtn(gfx, bx, bsTop, btnW, btnH, amount, false);
        });
    }

    // ── Track (right side) ────────────────────────────────────────────────────

    private buildTrack(): void {
        const trackGfx = this.scene.add.graphics();
        const tLeft    = TRACK_LEFT;

        // Track background + rail marks
        HORSES.forEach((horse, i) => {
            const ly = TRACK_TOP + i * LANE_H;

            // Lane row
            trackGfx.fillStyle(i % 2 === 0 ? LANE_BG_ODD : LANE_BG_EVEN, 0.9);
            trackGfx.fillRect(tLeft, ly, TRACK_W, LANE_H);

            // Grass stripe
            trackGfx.fillStyle(0x0a2010, 0.4);
            trackGfx.fillRect(tLeft, ly + LANE_H / 2 - 1, TRACK_W, 2);

            // Multi-layered golden/cyan lane delimiters
            trackGfx.lineStyle(0.5, i % 2 === 0 ? 0xffd700 : 0xe7fff4, 0.22);
            trackGfx.lineBetween(tLeft, ly + LANE_H - 0.5, tLeft + TRACK_W, ly + LANE_H - 0.5);
            trackGfx.lineStyle(1.0, i % 2 === 0 ? 0xc9a84c : 0x9ef0dc, 0.1);
            trackGfx.lineBetween(tLeft, ly + LANE_H - 1.5, tLeft + TRACK_W, ly + LANE_H - 1.5);

            // Lane number
            trackGfx.fillStyle(horse.color, 0.12);
            trackGfx.fillRect(tLeft, ly, 18, LANE_H);
        });

        // Outer border
        trackGfx.lineStyle(1.5, COL_HORSES_ACCENT, 0.5);
        trackGfx.strokeRect(tLeft, TRACK_TOP, TRACK_W, HORSES.length * LANE_H);

        trackGfx.lineStyle(3, 0xc9a84c, 0.35);
        trackGfx.lineBetween(tLeft + TRACK_W - 4, TRACK_TOP, tLeft + TRACK_W - 4, TRACK_TOP + HORSES.length * LANE_H);
        trackGfx.lineStyle(1.5, 0xffffff, 0.95);
        trackGfx.lineBetween(tLeft + TRACK_W - 4, TRACK_TOP, tLeft + TRACK_W - 4, TRACK_TOP + HORSES.length * LANE_H);
        
        // Checkered columns
        const checkerSz = 4;
        for (let cy2 = TRACK_TOP; cy2 < TRACK_TOP + HORSES.length * LANE_H; cy2 += checkerSz * 2) {
            trackGfx.fillStyle(0xffffff, 0.85);
            trackGfx.fillRect(tLeft + TRACK_W - 8, cy2, checkerSz, checkerSz);
            trackGfx.fillRect(tLeft + TRACK_W - 4, cy2 + checkerSz, checkerSz, checkerSz);
            trackGfx.fillStyle(0x111111, 0.85);
            trackGfx.fillRect(tLeft + TRACK_W - 4, cy2, checkerSz, checkerSz);
            trackGfx.fillRect(tLeft + TRACK_W - 8, cy2 + checkerSz, checkerSz, checkerSz);
        }

        this.container.add(trackGfx);

        // Particle graphics (placed behind horse sprites)
        this.particleGfx = this.scene.add.graphics();
        this.container.add(this.particleGfx);

        // Per-horse progress bars (initially empty)
        this.horseSprites = [];
        HORSES.forEach((horse, i) => {
            const ly    = TRACK_TOP + i * LANE_H + 8;
            const barH  = LANE_H - 16;
            const laneGfx = this.scene.add.graphics();
            this.container.add(laneGfx);
            this.laneGfxs.push(laneGfx);

            // Create running horse text overlay at starting line
            const horseText = this.scene.add.text(
                TRACK_LEFT + 20, ly + barH / 2,
                horse.emoji, { fontFamily: FONT, fontSize: '15px' }
            ).setOrigin(0.5, 0.5);
            this.container.add(horseText);
            this.horseSprites.push(horseText);

            // Draw at 0 progress
            this.drawHorseBar(laneGfx, horse, ly, barH, 0, false);
        });

        // Lane number labels
        HORSES.forEach((_horse, i) => {
            const ly   = TRACK_TOP + i * LANE_H;
            const lbl  = this.scene.add.text(
                TRACK_LEFT + 9, ly + LANE_H / 2,
                `${i + 1}`, { fontFamily: FONT, fontSize: '9px', color: '#ffffff' },
            ).setOrigin(0.5);
            this.container.add(lbl);
        });
    }

    private drawHorseBar(
        gfx: Phaser.GameObjects.Graphics,
        horse: typeof HORSES[0],
        ly: number, barH: number,
        progress: number,
        isWinner: boolean,
    ): void {
        gfx.clear();
        if (progress <= 0) return;

        const tLeft  = TRACK_LEFT + 20;   // start after lane number
        const maxW   = TRACK_W - 22;
        const barW   = maxW * Math.min(progress, 1);

        // Bar fill
        gfx.fillStyle(horse.color, isWinner ? 1.0 : 0.7);
        gfx.fillRoundedRect(tLeft, ly, barW, barH, 3);

        // Highlight
        gfx.fillStyle(0xffffff, 0.15);
        gfx.fillRoundedRect(tLeft, ly, barW, barH * 0.3, { tl: 3, tr: 3, bl: 0, br: 0 });

        // Horse emoji at front of bar
        // (text objects aren't created here — they'd need container refs)
    }

    // ── Race Button ───────────────────────────────────────────────────────────

    private buildRaceButton(): void {
        const btnW = 160;
        const btnH = 36;
        const bx   = CTRL_LEFT;
        const by   = PH / 2 - 56;

        this.raceBtnGfx = this.scene.add.graphics();
        this.raceBtnLbl = this.scene.add.text(bx + btnW / 2, by + btnH / 2, '🏁  RACE!', {
            fontFamily: FONT, fontSize: '14px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.raceBtnHit = this.scene.add.rectangle(bx + btnW / 2, by + btnH / 2, btnW, btnH, 0, 0)
            .setInteractive({ useHandCursor: true });

        this.raceBtnHit.on('pointerdown', () => this.startRace());
        this.raceBtnHit.on('pointerover',  () => this.drawRaceBtn(true));
        this.raceBtnHit.on('pointerout',   () => this.drawRaceBtn(false));

        this.container.add([this.raceBtnGfx, this.raceBtnLbl, this.raceBtnHit]);
        this.refreshRaceButton();
    }

    private drawRaceBtn(hover: boolean): void {
        const btnW = 160;
        const btnH = 36;
        const bx   = CTRL_LEFT;
        const by   = PH / 2 - 56;
        this.raceBtnGfx.clear();
        const canRace = this.raceState === null && GameState.get().chips >= this.currentBet;
        if (!canRace) {
            this.raceBtnGfx.fillStyle(0x2a2a2a, 1);
            this.raceBtnGfx.fillRoundedRect(bx, by, btnW, btnH, 4);
            this.raceBtnGfx.lineStyle(1, 0x444444, 0.5);
            this.raceBtnGfx.strokeRoundedRect(bx, by, btnW, btnH, 4);
        } else {
            const bg = hover ? 0x504010 : 0x302808;
            this.raceBtnGfx.fillStyle(bg, 1);
            this.raceBtnGfx.fillRoundedRect(bx, by, btnW, btnH, 4);
            this.raceBtnGfx.lineStyle(2, COL_HORSES_ACCENT, hover ? 1 : 0.7);
            this.raceBtnGfx.strokeRoundedRect(bx, by, btnW, btnH, 4);
        }
    }

    private refreshRaceButton(): void {
        this.drawRaceBtn(false);
        const canRace = this.raceState === null && GameState.get().chips >= this.currentBet;
        this.raceBtnLbl.setColor(canRace ? '#c9a84c' : '#555555');
        this.raceBtnHit.setInteractive(canRace);
    }

    // ── Stats Row ─────────────────────────────────────────────────────────────

    private buildStatsRow(): void {
        this.statsText = this.scene.add.text(
            TRACK_LEFT + TRACK_W / 2, PH / 2 - 20,
            '', { fontFamily: FONT, fontSize: '9px', color: '#445a50' },
        ).setOrigin(0.5);
        this.container.add(this.statsText);
        this.refreshStats();
    }

    private refreshStats(): void {
        const net = this.totalWon - this.totalWagered;
        const netStr = net >= 0 ? `+${net}` : `${net}`;
        this.statsText.setText(
            `Races: ${this.totalRaces}  ·  Net: ${netStr} ◈`,
        );
    }

    // ── Race Logic ────────────────────────────────────────────────────────────

    private startRace(): void {
        if (this.raceState !== null) return;
        const chips = GameState.get().chips;
        if (chips < this.currentBet) return;

        // Deduct bet
        GameState.addChips(-this.currentBet);
        this.totalWagered += this.currentBet;
        GameState.recordStat('horseRacesBet', 1);
        GameState.recordStat('horseWagered', this.currentBet);
        this.refreshChips();

        this.particles = [];
        this.particleGfx.clear();

        this.raceState = createRace(this.currentBet, this.selectedHorse);
        this.raceBtnHit.disableInteractive();
        this.statusText.setText('🏇  Racing…');
        this.statusText.setColor('#c9a84c');

        // Reset track bars and horse positions
        this.laneGfxs.forEach((gfx, i) => {
            this.drawHorseBar(gfx, HORSES[i], TRACK_TOP + i * LANE_H + 8, LANE_H - 16, 0, false);
            this.horseSprites[i].setX(TRACK_LEFT + 20);
        });

        // Resolve result immediately but animate over 2 seconds
        const resolved = resolveRace(this.raceState);
        this.animateRace(resolved);
    }

    private animateRace(resolved: RaceState): void {
        const STEPS = 40;
        const STEP_MS = 50;

        let step = 0;
        // Each horse's progress increments at a different speed derived from final progress
        const stepIncrements = resolved.progress.map(p => p / STEPS);

        const tick = this.scene.time.addEvent({
            delay:    STEP_MS,
            repeat:   STEPS - 1,
            callback: () => {
                if (this.closed) return;
                step++;

                // Camera shake near the end (final stretch tension)
                if (step >= STEPS - 8 && step < STEPS) {
                    const intensity = 2.0;
                    this.container.setX(GAME_WIDTH / 2 + (Math.random() - 0.5) * intensity);
                    this.container.setY(GAME_HEIGHT / 2 + (Math.random() - 0.5) * intensity);
                }

                this.laneGfxs.forEach((gfx, i) => {
                    const prog = Math.min(stepIncrements[i] * step, resolved.progress[i]);
                    this.drawHorseBar(gfx, HORSES[i], TRACK_TOP + i * LANE_H + 8, LANE_H - 16, prog, false);
                    
                    // Update horse text x position to match progress bar front edge
                    const tLeft = TRACK_LEFT + 20;
                    const maxW  = TRACK_W - 22;
                    const barW  = maxW * Math.min(prog, 1);
                    const horseX = tLeft + barW;
                    const horseY = TRACK_TOP + i * LANE_H + LANE_H / 2;
                    this.horseSprites[i].setX(horseX);

                    // Gallop bobbing and rotation tilt
                    const timeSeed = this.scene.time.now * 0.03 + i * 2.5;
                    const bobY = Math.sin(timeSeed) * 2;
                    const tilt = Math.cos(timeSeed) * 0.08;
                    this.horseSprites[i].setY(horseY + bobY);
                    this.horseSprites[i].setRotation(tilt);

                    // Spawn dust/kick-up particles behind horse
                    if (step < STEPS && Math.random() < 0.45) {
                        this.particles.push({
                            x: horseX - 10,
                            y: horseY + 4 + (Math.random() - 0.5) * 6,
                            alpha: 1.0,
                            size: Phaser.Math.FloatBetween(1.2, 2.8),
                            col: HORSES[i].color
                        });
                    }
                });

                this.updateAndDrawParticles();

                // Spawn cheering text above leading horse
                if (step > 4 && step < STEPS - 2 && Math.random() < 0.15) {
                    let leadIdx = 0;
                    let maxProg = -1;
                    HORSES.forEach((_, i) => {
                        const p = Math.min(stepIncrements[i] * step, resolved.progress[i]);
                        if (p > maxProg) {
                            maxProg = p;
                            leadIdx = i;
                        }
                    });

                    const p = Math.min(stepIncrements[leadIdx] * step, resolved.progress[leadIdx]);
                    const lx = TRACK_LEFT + 20 + (TRACK_W - 22) * Math.min(p, 1);
                    const ly = TRACK_TOP + leadIdx * LANE_H + 4;
                    
                    const cheerPhrases = ["GO! 📣", "CLAP! 👏", "⚡ FAST!", "🏇 RUN!", "🌟 LEAD!"];
                    const phrase = cheerPhrases[Math.floor(Math.random() * cheerPhrases.length)];
                    this.spawnCheerText(lx, ly, phrase);
                }

                if (step >= STEPS) {
                    this.finishRace(resolved);
                }
            },
        });
        this.raceTimers.push(tick);
    }

    private finishRace(resolved: RaceState): void {
        if (this.closed) return;
        this.container.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        this.raceState = resolved;

        const delta  = chipDelta(resolved);
        const winner = HORSES[resolved.winnerId!];

        // Final bar draw: winner full, others at final position
        this.laneGfxs.forEach((gfx, i) => {
            this.drawHorseBar(gfx, HORSES[i], TRACK_TOP + i * LANE_H + 8, LANE_H - 16,
                resolved.progress[i], i === resolved.winnerId);
            
            // Set final horse text position and reset Y / rotation
            const tLeft = TRACK_LEFT + 20;
            const maxW  = TRACK_W - 22;
            const barW  = maxW * Math.min(resolved.progress[i], 1);
            this.horseSprites[i].setX(tLeft + barW);
            this.horseSprites[i].setY(TRACK_TOP + i * LANE_H + LANE_H / 2);
            this.horseSprites[i].setRotation(0);
        });

        // Highlight winner row
        this.highlightWinnerLane(resolved.winnerId!);

        // Celebratory winner bounce tween
        const winHorse = this.horseSprites[resolved.winnerId!];
        this.scene.tweens.add({
            targets: winHorse,
            scaleX: 1.45,
            scaleY: 1.45,
            yoyo: true,
            repeat: 3,
            duration: 180,
            ease: 'Quad.easeInOut',
            onComplete: () => {
                if (!this.closed && winHorse) {
                    winHorse.setScale(1.0);
                }
            }
        });

        const won = delta > 0;
        GameState.addChips(won ? delta : 0);
        if (won) {
            this.totalWon += delta;
            GameState.recordStat('horseRacesWon', 1);
            GameState.recordStat('horseWon', delta);
            GameState.recordMaxStat('horseMaxPayout', delta);
        }
        this.totalRaces++;
        this.refreshChips();
        this.refreshStats();

        if (won) {
            this.statusText.setText(`🏆  ${winner.name} wins!  +${delta} ◈  (${winner.odds}×)`);
            this.statusText.setColor('#2ecc71');
            ToastManager.show(this.scene, `+${delta} ◈`, 'win');
        } else {
            this.statusText.setText(`❌  ${winner.name} wins!  You lost ${this.currentBet} ◈`);
            this.statusText.setColor('#e74c3c');
            ToastManager.show(this.scene, `-${this.currentBet} ◈`, 'loss');
        }

        // Re-enable race button after short delay
        const cooldown = this.scene.time.addEvent({
            delay: 1200,
            callback: () => {
                if (this.closed) return;
                this.raceState = null;
                this.refreshRaceButton();
                this.statusText.setText('Pick a horse, set your bet, then press RACE!');
                this.statusText.setColor('#6a8880');
            },
        });
        this.raceTimers.push(cooldown);
    }

    private highlightWinnerLane(winnerId: number): void {
        const horse  = HORSES[winnerId];
        const ly     = TRACK_TOP + winnerId * LANE_H;
        const hlGfx  = this.scene.add.graphics();
        hlGfx.lineStyle(2, horse.color, 1);
        hlGfx.strokeRect(TRACK_LEFT + 1, ly + 1, TRACK_W - 2, LANE_H - 2);
        hlGfx.fillStyle(horse.color, 0.08);
        hlGfx.fillRect(TRACK_LEFT + 1, ly + 1, TRACK_W - 2, LANE_H - 2);
        this.container.add(hlGfx);
        // Fade out after 3 s
        this.scene.tweens.add({ targets: hlGfx, alpha: 0, duration: 2000, delay: 1000,
            onComplete: () => hlGfx.destroy() });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private refreshChips(): void {
        this.chipsText.setText(`◈ ${GameState.get().chips.toLocaleString()}`);
    }

    private updateAndDrawParticles(): void {
        const pg = this.particleGfx;
        pg.clear();
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.alpha -= 0.055; // fade out fast
            p.x -= Phaser.Math.FloatBetween(0.5, 2.0); // drift back
            p.y += Phaser.Math.FloatBetween(-0.4, 0.4); // dust drift
            
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            pg.fillStyle(p.col, p.alpha);
            pg.fillCircle(p.x, p.y, p.size);
        }
    }

    private spawnCheerText(x: number, y: number, text: string): void {
        const txt = this.scene.add.text(x, y, text, {
            fontFamily: FONT, fontSize: '9px', color: '#ffd700', fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_PANEL + 5);
        this.container.add(txt);
        this.scene.tweens.add({
            targets: txt,
            y: y - 26,
            alpha: 0,
            duration: 800,
            ease: 'Quad.easeOut',
            onComplete: () => txt.destroy()
        });
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    close(): void {
        if (this.closed) return;
        this.closed = true;

        this.raceTimers.forEach(t => t.destroy());
        this.raceTimers = [];

        if (this.escKey) this.escKey.destroy();

        this.scene.tweens.add({
            targets:  [this.overlay, this.container, this.panelGfx],
            alpha:    0,
            duration: ANIM_MED,
            ease:     'Sine.easeIn',
            onComplete: () => {
                this.overlay.destroy();
                this.container.destroy(true);
                this.panelGfx.destroy();
                this.onClose();
            },
        });
    }
}
