// ── Bingo minigame panel ───────────────────────────────────────────────────────
// 75-ball bingo: 5×5 card, B/I/N/G/O columns, FREE center.
// Player gets BALL_LIMIT balls per game to complete at least one line.
// Win: line = 3×, blackout = 20×.  Bust = lose bet.
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_BINGO_ACCENT,
    FONT, PANEL_RADIUS, ANIM_MED,
} from '../../game/constants';
import {
    BingoState, WinType,
    BET_OPTIONS, BALL_LIMIT, PAYOUTS,
    ballLetter, COLUMN_HEADERS,
    createGame, callBall,
} from './BingoEngine';

// ── Layout constants ──────────────────────────────────────────────────────────
const PW = 620;
const PH = 510;

const CELL_W    = 44;   // width of each bingo card cell
const CELL_H    = 40;   // height of each bingo card cell
const HEADER_H  = 26;   // height of B/I/N/G/O header row

// Card section — left side
const CARD_LEFT = -PW / 2 + 28;                      // left edge of card
const CARD_TOP  = -PH / 2 + 68;                      // top of header row
const CARD_CX   = CARD_LEFT + (5 * CELL_W) / 2;      // center x of card

// Right section — controls
const CTRL_CX   = CARD_LEFT + 5 * CELL_W + 30 + (PW / 2 - (CARD_LEFT + 5 * CELL_W + 30)) / 2;

// ── Colors ────────────────────────────────────────────────────────────────────
const COL_CELL_EMPTY  = 0x050e1a;
const COL_CELL_MARKED = 0x003a5a;
const COL_CELL_FREE   = 0x003a20;
const COL_CELL_WIN    = 0x005a00;
const COL_HEADER_BG   = 0x002a3a;

export class BingoPanel {
    private scene:   Phaser.Scene;
    private onClose: () => void;

    // Phaser objects
    private overlay!:       Phaser.GameObjects.Rectangle;
    private panelGfx!:      Phaser.GameObjects.Graphics;
    private container!:     Phaser.GameObjects.Container;
    private chipsText!:     Phaser.GameObjects.Text;
    private statusText!:    Phaser.GameObjects.Text;
    private ballsLeftText!: Phaser.GameObjects.Text;
    private lastBallGfx!:   Phaser.GameObjects.Graphics;
    private lastBallText!:  Phaser.GameObjects.Text;
    private lastBallLetter!: Phaser.GameObjects.Text;
    private historyObjs:    Phaser.GameObjects.GameObject[] = [];
    private historyGfxArea!: Phaser.GameObjects.Graphics;
    private cardCellGfxs:   Phaser.GameObjects.Graphics[][] = [];
    private cardCellLabels: (Phaser.GameObjects.Text | null)[][] = [];
    private callBtnGfx!:    Phaser.GameObjects.Graphics;
    private callBtnLabel!:  Phaser.GameObjects.Text;
    private callBtnHit!:    Phaser.GameObjects.Rectangle;
    private autoBtnGfx!:    Phaser.GameObjects.Graphics;
    private autoBtnLabel!:  Phaser.GameObjects.Text;
    private autoBtnHit!:    Phaser.GameObjects.Rectangle;
    private newBtnGfx!:     Phaser.GameObjects.Graphics;
    private newBtnLabel!:   Phaser.GameObjects.Text;
    private newBtnHit!:     Phaser.GameObjects.Rectangle;
    private betBtns: Array<{
        gfx: Phaser.GameObjects.Graphics;
        lbl: Phaser.GameObjects.Text;
        amount: number;
    }> = [];
    private escKey!:   Phaser.Input.Keyboard.Key;
    private spaceKey!: Phaser.Input.Keyboard.Key;

    // State
    private gameState!:   BingoState;
    private currentBet:   number  = 25;
    private autoPlay:     boolean = false;
    private autoTimer:    Phaser.Time.TimerEvent | null = null;
    private closed:       boolean = false;

    // Session stats
    private totalGames  = 0;
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

        // Build UI sections
        this.buildHeader();
        this.buildCloseButton();
        this.buildBetSelector();
        this.buildCard();
        this.buildRightSection();
        this.buildCallButton();
        this.buildAutoButton();
        this.buildNewGameButton();
        this.buildStatusRow();

        // Start first game
        this.startNewGame();

        // Keyboard — registered after startNewGame so gameState is always defined
        this.escKey   = this.scene.input.keyboard!.addKey('ESC');
        this.spaceKey = this.scene.input.keyboard!.addKey('SPACE');
        this.escKey.on('down',   () => this.close());
        this.spaceKey.on('down', () => { if (this.gameState.phase === 'playing') this.doCallBall(); });

        this.refreshChipsDisplay();
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
        g.fillStyle(0x05101a, 1);
        g.fillRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Header band
        g.fillStyle(0x040c16, 1);
        g.fillRoundedRect(px, py, PW, 52, { tl: PANEL_RADIUS, tr: PANEL_RADIUS, bl: 0, br: 0 });
        // Cyan border
        g.lineStyle(2, COL_BINGO_ACCENT, 0.85);
        g.strokeRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        // Inner inset
        g.lineStyle(1, COL_BINGO_ACCENT, 0.12);
        g.strokeRoundedRect(px + 3, py + 3, PW - 6, PH - 6, PANEL_RADIUS - 1);
        // Header divider
        g.lineStyle(1.5, COL_BINGO_ACCENT, 0.45);
        g.lineBetween(px + 16, py + 52, px + PW - 16, py + 52);
    }

    // ── Header ────────────────────────────────────────────────────────────────

    private buildHeader(): void {
        const title = this.scene.add.text(0, -PH / 2 + 26, '🎱  BINGO', {
            fontFamily: FONT, fontSize: '20px', color: '#00c8ff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        this.chipsText = this.scene.add.text(-PW / 2 + 18, -PH / 2 + 26, '', {
            fontFamily: FONT, fontSize: '12px', color: '#2ecc71', fontStyle: 'bold',
        }).setOrigin(0, 0.5);
        this.container.add(this.chipsText);

        this.ballsLeftText = this.scene.add.text(PW / 2 - 18, -PH / 2 + 26, '', {
            fontFamily: FONT, fontSize: '11px', color: '#6090a0',
        }).setOrigin(1, 0.5);
        this.container.add(this.ballsLeftText);
    }

    // ── Close button ──────────────────────────────────────────────────────────

    private buildCloseButton(): void {
        const r  = 12;
        const bx = PW / 2 - 18;
        const by = -PH / 2 + 18;

        const gfx  = this.scene.add.graphics();
        const draw = (hover: boolean): void => {
            gfx.clear();
            gfx.fillStyle(hover ? 0x103040 : 0x081828, 1);
            gfx.fillCircle(bx, by, r);
            gfx.lineStyle(1, hover ? 0x20b0e0 : 0x107890, 0.9);
            gfx.strokeCircle(bx, by, r);
        };
        draw(false);

        const hitArea = this.scene.add.circle(bx, by, r, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const xLabel  = this.scene.add.text(bx, by, '✕', {
            fontFamily: FONT, fontSize: '13px', color: '#00c8ff',
        }).setOrigin(0.5);

        hitArea.on('pointerover', () => { draw(true);  xLabel.setColor('#40e8ff'); });
        hitArea.on('pointerout',  () => { draw(false); xLabel.setColor('#00c8ff'); });
        hitArea.on('pointerdown', () => this.close());

        this.container.add([gfx, hitArea, xLabel]);
    }

    // ── Bet selector ──────────────────────────────────────────────────────────

    private buildBetSelector(): void {
        const y   = CARD_TOP - 2;
        const lbl = this.scene.add.text(CARD_LEFT, y, 'BET:', {
            fontFamily: FONT, fontSize: '10px', color: '#507080', fontStyle: 'bold', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this.container.add(lbl);

        BET_OPTIONS.forEach((amt, i) => {
            const bx = CARD_LEFT + 36 + i * 46;

            const gfx  = this.scene.add.graphics();
            const drawBtn = (sel: boolean, hover: boolean): void => {
                gfx.clear();
                const fill = sel ? 0x0a2a3a : hover ? 0x071828 : 0x040e14;
                const sc   = sel ? COL_BINGO_ACCENT : hover ? 0x107890 : 0x0a3040;
                gfx.fillStyle(fill, 1);
                gfx.fillRoundedRect(bx - 20, y - 11, 40, 22, 4);
                gfx.lineStyle(sel ? 1.5 : 1, sc, sel ? 1 : 0.6);
                gfx.strokeRoundedRect(bx - 20, y - 11, 40, 22, 4);
            };
            drawBtn(amt === this.currentBet, false);

            const hit   = this.scene.add.rectangle(bx, y, 40, 22, 0x000000, 0)
                .setInteractive({ useHandCursor: true });
            const label = this.scene.add.text(bx, y, `${amt}`, {
                fontFamily: FONT, fontSize: '12px',
                color: amt === this.currentBet ? '#00c8ff' : '#407080',
            }).setOrigin(0.5);

            hit.on('pointerover',  () => drawBtn(amt === this.currentBet, true));
            hit.on('pointerout',   () => drawBtn(amt === this.currentBet, false));
            hit.on('pointerdown',  () => {
                if (this.gameState.phase !== 'playing') {
                    this.currentBet = amt;
                    this.refreshBetButtons();
                }
            });

            this.container.add([gfx, hit, label]);
            this.betBtns.push({ gfx, lbl: label, amount: amt });
        });
    }

    // ── Bingo card (5×5 grid) ─────────────────────────────────────────────────

    private buildCard(): void {
        // Column header row
        for (let col = 0; col < 5; col++) {
            const hx = CARD_LEFT + col * CELL_W + CELL_W / 2;
            const hy = CARD_TOP + HEADER_H / 2;

            const hgfx = this.scene.add.graphics();
            hgfx.fillStyle(COL_HEADER_BG, 1);
            hgfx.fillRect(CARD_LEFT + col * CELL_W, CARD_TOP, CELL_W - 1, HEADER_H - 1);
            hgfx.lineStyle(1, COL_BINGO_ACCENT, 0.4);
            hgfx.strokeRect(CARD_LEFT + col * CELL_W, CARD_TOP, CELL_W - 1, HEADER_H - 1);
            this.container.add(hgfx);

            const htxt = this.scene.add.text(hx, hy, COLUMN_HEADERS[col], {
                fontFamily: FONT, fontSize: '14px', color: '#00c8ff', fontStyle: 'bold',
            }).setOrigin(0.5);
            this.container.add(htxt);
        }

        // Cell grid
        this.cardCellGfxs   = [];
        this.cardCellLabels = [];
        for (let row = 0; row < 5; row++) {
            this.cardCellGfxs.push([]);
            this.cardCellLabels.push([]);
            for (let col = 0; col < 5; col++) {
                const cx2 = CARD_LEFT + col * CELL_W + CELL_W / 2;
                const cy2 = CARD_TOP + HEADER_H + row * CELL_H + CELL_H / 2;

                const cellGfx = this.scene.add.graphics();
                this.container.add(cellGfx);
                this.cardCellGfxs[row].push(cellGfx);

                if (row === 2 && col === 2) {
                    // FREE cell — no number label, draw star
                    const freeTxt = this.scene.add.text(cx2, cy2, 'FREE', {
                        fontFamily: FONT, fontSize: '9px', color: '#40ff80', fontStyle: 'bold',
                    }).setOrigin(0.5);
                    this.container.add(freeTxt);
                    this.cardCellLabels[row].push(null);
                } else {
                    const numTxt = this.scene.add.text(cx2, cy2, '', {
                        fontFamily: FONT, fontSize: '13px', color: '#a0c0d0',
                    }).setOrigin(0.5);
                    this.container.add(numTxt);
                    this.cardCellLabels[row].push(numTxt);
                }
            }
        }
    }

    // ── Right section: last ball + recent history ─────────────────────────────

    private buildRightSection(): void {
        const rx = CARD_LEFT + 5 * CELL_W + 16;   // right section left edge
        const ry = CARD_TOP;                        // align with card top

        // Divider
        const divGfx = this.scene.add.graphics();
        divGfx.lineStyle(1, COL_BINGO_ACCENT, 0.2);
        divGfx.lineBetween(rx - 6, ry - 4, rx - 6, ry + HEADER_H + 5 * CELL_H + 4);
        this.container.add(divGfx);

        // "LAST BALL" label
        const lastLbl = this.scene.add.text(CTRL_CX, ry + 8, 'LAST BALL', {
            fontFamily: FONT, fontSize: '9px', color: '#406070', fontStyle: 'bold', letterSpacing: 2,
        }).setOrigin(0.5);
        this.container.add(lastLbl);

        // Last ball display circle (large)
        this.lastBallGfx = this.scene.add.graphics();
        this.container.add(this.lastBallGfx);

        this.lastBallLetter = this.scene.add.text(CTRL_CX, ry + 52, '', {
            fontFamily: FONT, fontSize: '11px', color: '#407090', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(this.lastBallLetter);

        this.lastBallText = this.scene.add.text(CTRL_CX, ry + 68, '', {
            fontFamily: FONT, fontSize: '24px', color: '#00c8ff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(this.lastBallText);

        // History row label
        const histLbl = this.scene.add.text(CTRL_CX, ry + 114, 'CALLED BALLS', {
            fontFamily: FONT, fontSize: '9px', color: '#406070', fontStyle: 'bold', letterSpacing: 2,
        }).setOrigin(0.5);
        this.container.add(histLbl);

        // Graphics area for history chips (drawn dynamically)
        this.historyGfxArea = this.scene.add.graphics();
        this.container.add(this.historyGfxArea);

        // "Balls left" paytable hint
        const payHint = this.scene.add.text(CTRL_CX, ry + 177, `LINE: ${PAYOUTS.line}×  |  BLACKOUT: ${PAYOUTS.blackout}×`, {
            fontFamily: FONT, fontSize: '9px', color: '#204a5a',
        }).setOrigin(0.5);
        this.container.add(payHint);
    }

    // ── Call Ball button ──────────────────────────────────────────────────────

    private buildCallButton(): void {
        const bx = CTRL_CX - 46;
        const by = CARD_TOP + HEADER_H + 5 * CELL_H + 24;
        const bw = 84;
        const bh = 32;

        this.callBtnGfx = this.scene.add.graphics();
        this.callBtnLabel = this.scene.add.text(bx, by, 'CALL', {
            fontFamily: FONT, fontSize: '13px', color: '#00c8ff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.callBtnHit = this.scene.add.rectangle(bx, by, bw, bh, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const draw = (hover: boolean, disabled: boolean): void => {
            this.callBtnGfx.clear();
            const fill = disabled ? 0x040c10 : hover ? 0x0a2838 : 0x050f18;
            const sc   = disabled ? 0x102030 : hover ? COL_BINGO_ACCENT : 0x10607a;
            this.callBtnGfx.fillStyle(fill, 1);
            this.callBtnGfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
            this.callBtnGfx.lineStyle(1.5, sc, disabled ? 0.25 : 1);
            this.callBtnGfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
        };
        draw(false, false);

        this.callBtnHit.on('pointerover',  () => draw(true,  this.gameState?.phase !== 'playing'));
        this.callBtnHit.on('pointerout',   () => draw(false, this.gameState?.phase !== 'playing'));
        this.callBtnHit.on('pointerdown',  () => { if (this.gameState?.phase === 'playing') this.doCallBall(); });

        this.container.add([this.callBtnGfx, this.callBtnHit, this.callBtnLabel]);
    }

    // ── Auto-Call toggle ──────────────────────────────────────────────────────

    private buildAutoButton(): void {
        const bx = CTRL_CX + 46;
        const by = CARD_TOP + HEADER_H + 5 * CELL_H + 24;
        const bw = 70;
        const bh = 32;

        this.autoBtnGfx   = this.scene.add.graphics();
        this.autoBtnLabel = this.scene.add.text(bx, by, 'AUTO', {
            fontFamily: FONT, fontSize: '11px', color: '#407080',
        }).setOrigin(0.5);
        this.autoBtnHit = this.scene.add.rectangle(bx, by, bw, bh, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const draw = (hover: boolean): void => {
            this.autoBtnGfx.clear();
            const active = this.autoPlay;
            const fill   = active ? 0x0a2838 : hover ? 0x071620 : 0x040c14;
            const sc     = active ? COL_BINGO_ACCENT : hover ? 0x10607a : 0x0a2a38;
            this.autoBtnGfx.fillStyle(fill, 1);
            this.autoBtnGfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
            this.autoBtnGfx.lineStyle(1, sc, 0.9);
            this.autoBtnGfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
            this.autoBtnLabel.setColor(active ? '#00c8ff' : '#407080');
            this.autoBtnLabel.setText(active ? '■ AUTO' : '▶ AUTO');
        };
        draw(false);

        this.autoBtnHit.on('pointerover',  () => draw(true));
        this.autoBtnHit.on('pointerout',   () => draw(false));
        this.autoBtnHit.on('pointerdown',  () => {
            this.toggleAutoPlay();
            draw(false);
        });

        this.container.add([this.autoBtnGfx, this.autoBtnHit, this.autoBtnLabel]);
    }

    // ── New Game button ───────────────────────────────────────────────────────

    private buildNewGameButton(): void {
        const bx = CARD_CX;
        const by = CARD_TOP + HEADER_H + 5 * CELL_H + 24;
        const bw = 110;
        const bh = 32;

        this.newBtnGfx   = this.scene.add.graphics();
        this.newBtnLabel = this.scene.add.text(bx, by, 'NEW CARD', {
            fontFamily: FONT, fontSize: '12px', color: '#204a30',
        }).setOrigin(0.5);
        this.newBtnHit = this.scene.add.rectangle(bx, by, bw, bh, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const draw = (hover: boolean, active: boolean): void => {
            this.newBtnGfx.clear();
            const fill = active ? (hover ? 0x0a2838 : 0x071c28) : hover ? 0x091c0c : 0x050e06;
            const sc   = active ? COL_BINGO_ACCENT : hover ? 0x1a6a2a : 0x0c2a14;
            this.newBtnGfx.fillStyle(fill, 1);
            this.newBtnGfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
            this.newBtnGfx.lineStyle(1.5, sc, 0.9);
            this.newBtnGfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
        };

        const isActive = (): boolean => this.gameState?.phase !== 'playing';
        draw(false, isActive());

        this.newBtnHit.on('pointerover',  () => draw(true,  isActive()));
        this.newBtnHit.on('pointerout',   () => draw(false, isActive()));
        this.newBtnHit.on('pointerdown',  () => {
            this.stopAutoPlay();
            this.startNewGame();
            draw(false, false);
        });

        this.container.add([this.newBtnGfx, this.newBtnHit, this.newBtnLabel]);
    }

    // ── Status row ────────────────────────────────────────────────────────────

    private buildStatusRow(): void {
        const sy = CARD_TOP + HEADER_H + 5 * CELL_H + 62;
        this.statusText = this.scene.add.text(0, sy, '', {
            fontFamily: FONT, fontSize: '14px', color: '#00c8ff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(this.statusText);
    }

    // ── Game logic ────────────────────────────────────────────────────────────

    private startNewGame(): void {
        this.stopAutoPlay();

        // Find an affordable bet
        if (GameState.get().chips < this.currentBet) {
            const affordable = [...BET_OPTIONS].reverse().find(b => b <= GameState.get().chips);
            if (!affordable) {
                this.statusText.setText('Not enough chips!').setColor('#e74c3c');
                // Create a placeholder state so gameState is always defined
                this.gameState = createGame(BET_OPTIONS[0]);
                this.gameState = { ...this.gameState, phase: 'bust' };
                return;
            }
            this.currentBet = affordable;
            this.refreshBetButtons();
        }

        // Deduct the bet upfront (same pattern as SlotsPanel / BlackjackPanel)
        GameState.addChips(-this.currentBet);

        this.gameState = createGame(this.currentBet);
        this.refreshCard();
        this.refreshLastBall(null);
        this.refreshHistory();
        this.refreshBallsLeft();
        this.refreshStatus('SPACE / CALL to draw a ball');
        this.refreshCallButton(false);
        this.newBtnLabel.setColor('#204a30');
        this.refreshChipsDisplay();
    }

    private doCallBall(): void {
        if (this.closed || this.gameState.phase !== 'playing') return;

        const result = callBall(this.gameState);
        if (!result) return;

        const { newState, ball } = result;
        this.gameState = newState;

        this.refreshCard();
        this.refreshLastBall(ball);
        this.refreshHistory();
        this.refreshBallsLeft();

        if (newState.phase === 'playing') {
            this.refreshStatus(`Ball ${newState.calledBalls.length} of ${BALL_LIMIT} — keep going!`);
        } else {
            this.stopAutoPlay();
            this.handleGameEnd();
        }
    }

    private handleGameEnd(): void {
        this.totalGames++;
        this.totalWagered += this.gameState.bet;

        if (this.gameState.phase === 'won') {
            // Bet was already deducted at game start; pay out full multiplied amount
            const winnings = this.gameState.bet * PAYOUTS[this.gameState.winType as WinType];
            GameState.addChips(winnings);
            this.totalWon += winnings;

            if (this.gameState.winType === 'blackout') {
                this.refreshStatus(`🎉 BLACKOUT! Won ${winnings} chips (${PAYOUTS.blackout}×)!`);
                this.statusText.setColor('#ffd040');
                this.highlightWinCells();
            } else {
                this.refreshStatus(`✅ BINGO! Won ${winnings} chips (${PAYOUTS.line}×)!`);
                this.statusText.setColor('#2ecc71');
                this.highlightWinCells();
            }
        } else {
            // Bust — bet already deducted, nothing to add back
            this.refreshStatus(`😞 Bust! No line in ${BALL_LIMIT} balls. Lost ${this.gameState.bet} chips.`);
            this.statusText.setColor('#e74c3c');
        }

        this.refreshChipsDisplay();
        this.refreshCallButton(true);
        this.newBtnLabel.setColor('#40c860');
    }

    private toggleAutoPlay(): void {
        if (this.gameState.phase !== 'playing') return;

        this.autoPlay = !this.autoPlay;
        if (this.autoPlay) {
            this.scheduleAutoCall();
        } else {
            this.stopAutoPlay();
        }
    }

    private scheduleAutoCall(): void {
        this.stopAutoPlay();
        if (!this.autoPlay || this.gameState.phase !== 'playing') return;

        this.autoTimer = this.scene.time.addEvent({
            delay: 900,
            callback: () => {
                if (!this.closed && this.autoPlay && this.gameState.phase === 'playing') {
                    this.doCallBall();
                    if (this.gameState.phase === 'playing') {
                        this.scheduleAutoCall();
                    } else {
                        this.autoPlay = false;
                        this.refreshAutoButton();
                    }
                }
            },
        });
    }

    private stopAutoPlay(): void {
        this.autoPlay = false;
        if (this.autoTimer) {
            this.autoTimer.remove(false);
            this.autoTimer = null;
        }
        this.refreshAutoButton();
    }

    // ── Refresh helpers ───────────────────────────────────────────────────────

    private refreshChipsDisplay(): void {
        this.chipsText.setText(`🪙 ${GameState.get().chips}`);
    }

    private refreshBallsLeft(): void {
        const called = this.gameState ? this.gameState.calledBalls.length : 0;
        this.ballsLeftText.setText(`${called} / ${BALL_LIMIT} balls`);
    }

    private refreshStatus(msg: string): void {
        this.statusText.setText(msg).setColor('#00c8ff');
    }

    private refreshCard(): void {
        if (!this.gameState) return;
        const { card, marked } = this.gameState;

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                const gfx   = this.cardCellGfxs[row][col];
                const label = this.cardCellLabels[row][col];
                const isFree = row === 2 && col === 2;
                const isMarked = marked[row][col];
                const cx2 = CARD_LEFT + col * CELL_W;
                const cy2 = CARD_TOP + HEADER_H + row * CELL_H;

                gfx.clear();

                let fillColor: number;
                if (isFree) {
                    fillColor = COL_CELL_FREE;
                } else if (isMarked) {
                    fillColor = COL_CELL_MARKED;
                } else {
                    fillColor = COL_CELL_EMPTY;
                }

                gfx.fillStyle(fillColor, 1);
                gfx.fillRect(cx2, cy2, CELL_W - 1, CELL_H - 1);

                const borderColor = isFree
                    ? 0x20a060
                    : isMarked ? COL_BINGO_ACCENT : 0x0a2030;
                gfx.lineStyle(1, borderColor, isMarked ? 0.8 : 0.35);
                gfx.strokeRect(cx2, cy2, CELL_W - 1, CELL_H - 1);

                // Daub circle for marked cells
                if (isMarked && !isFree) {
                    gfx.fillStyle(COL_BINGO_ACCENT, 0.25);
                    gfx.fillCircle(cx2 + CELL_W / 2, cy2 + CELL_H / 2, 14);
                    gfx.lineStyle(1.5, COL_BINGO_ACCENT, 0.7);
                    gfx.strokeCircle(cx2 + CELL_W / 2, cy2 + CELL_H / 2, 14);
                }

                if (label) {
                    const n = card.grid[row][col] as number;
                    label.setText(`${n}`);
                    label.setColor(isMarked ? '#00c8ff' : '#708090');
                }
            }
        }
    }

    private highlightWinCells(): void {
        if (!this.gameState) return;
        const { marked } = this.gameState;

        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                if (marked[row][col]) {
                    const gfx = this.cardCellGfxs[row][col];
                    const cx2 = CARD_LEFT + col * CELL_W;
                    const cy2 = CARD_TOP + HEADER_H + row * CELL_H;

                    gfx.clear();
                    gfx.fillStyle(COL_CELL_WIN, 1);
                    gfx.fillRect(cx2, cy2, CELL_W - 1, CELL_H - 1);
                    gfx.lineStyle(1.5, 0x40ff80, 0.9);
                    gfx.strokeRect(cx2, cy2, CELL_W - 1, CELL_H - 1);
                }
            }
        }
    }

    private refreshLastBall(ball: number | null): void {
        this.lastBallGfx.clear();

        const bx = CTRL_CX;
        const by = CARD_TOP + 60;
        const r  = 26;

        if (ball !== null) {
            const letter = ballLetter(ball);
            const color  = this.letterColor(letter);

            // Outer glow
            this.lastBallGfx.fillStyle(color, 0.15);
            this.lastBallGfx.fillCircle(bx, by, r + 6);
            // Ball body
            this.lastBallGfx.fillStyle(color, 0.25);
            this.lastBallGfx.fillCircle(bx, by, r);
            this.lastBallGfx.lineStyle(2, color, 0.9);
            this.lastBallGfx.strokeCircle(bx, by, r);
            // Highlight
            this.lastBallGfx.fillStyle(0xffffff, 0.15);
            this.lastBallGfx.fillCircle(bx - 8, by - 8, 10);

            this.lastBallLetter.setText(letter)
                .setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
            this.lastBallText.setText(`${ball}`)
                .setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
        } else {
            this.lastBallGfx.fillStyle(0x050f18, 1);
            this.lastBallGfx.fillCircle(bx, by, r);
            this.lastBallGfx.lineStyle(1.5, 0x103040, 0.8);
            this.lastBallGfx.strokeCircle(bx, by, r);
            this.lastBallLetter.setText('');
            this.lastBallText.setText('?').setColor('#204060');
        }
    }

    private letterColor(letter: string): number {
        switch (letter) {
            case 'B': return 0x4080ff;
            case 'I': return 0xff4080;
            case 'N': return 0x40c040;
            case 'G': return 0xffa020;
            case 'O': return 0xc040ff;
            default:  return COL_BINGO_ACCENT;
        }
    }

    private refreshHistory(): void {
        if (!this.gameState) return;
        this.historyGfxArea.clear();

        const balls  = this.gameState.calledBalls;
        const show   = balls.slice(-12);                     // last 12 calls
        const startX = CTRL_CX - (Math.min(show.length, 12) * 18) / 2 + 9;
        const hy     = CARD_TOP + 130;

        show.forEach((b, i) => {
            const bx    = startX + i * 18;
            const color = this.letterColor(ballLetter(b));

            this.historyGfxArea.fillStyle(color, 0.35);
            this.historyGfxArea.fillCircle(bx, hy, 7);
            this.historyGfxArea.lineStyle(1, color, 0.7);
            this.historyGfxArea.strokeCircle(bx, hy, 7);
        });

        // Small number labels drawn as text objects — clear old, add new
        for (const obj of this.historyObjs) obj.destroy();
        this.historyObjs = [];

        show.forEach((b, i) => {
            const bx    = startX + i * 18;
            const color = this.letterColor(ballLetter(b));
            const txt   = this.scene.add.text(bx, hy, `${b}`, {
                fontFamily: FONT, fontSize: '6px',
                color: Phaser.Display.Color.IntegerToColor(color).rgba,
                fontStyle: 'bold',
            }).setOrigin(0.5);
            this.container.add(txt);
            this.historyObjs.push(txt);
        });
    }

    private refreshBetButtons(): void {
        this.betBtns.forEach(({ gfx, lbl, amount }) => {
            const sel   = amount === this.currentBet;
            const fill  = sel ? 0x0a2a3a : 0x040e14;
            const sc    = sel ? COL_BINGO_ACCENT : 0x0a3040;
            gfx.clear();
            gfx.fillStyle(fill, 1);
            // recalculate same bx
            const bx = CARD_LEFT + 36 + (BET_OPTIONS as readonly number[]).indexOf(amount) * 46;
            const y  = CARD_TOP - 2;
            gfx.fillRoundedRect(bx - 20, y - 11, 40, 22, 4);
            gfx.lineStyle(sel ? 1.5 : 1, sc, sel ? 1 : 0.6);
            gfx.strokeRoundedRect(bx - 20, y - 11, 40, 22, 4);
            lbl.setColor(sel ? '#00c8ff' : '#407080');
        });
    }

    private refreshCallButton(gameOver: boolean): void {
        this.callBtnGfx.clear();
        const bx = CTRL_CX - 46;
        const by = CARD_TOP + HEADER_H + 5 * CELL_H + 24;
        const bw = 84;
        const bh = 32;
        const fill = gameOver ? 0x040c10 : 0x050f18;
        const sc   = gameOver ? 0x102030 : 0x10607a;
        this.callBtnGfx.fillStyle(fill, 1);
        this.callBtnGfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
        this.callBtnGfx.lineStyle(1.5, sc, gameOver ? 0.25 : 1);
        this.callBtnGfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
        this.callBtnLabel.setColor(gameOver ? '#204050' : '#00c8ff');
    }

    private refreshAutoButton(): void {
        this.autoBtnGfx.clear();
        const bx = CTRL_CX + 46;
        const by = CARD_TOP + HEADER_H + 5 * CELL_H + 24;
        const bw = 70;
        const bh = 32;
        const active = this.autoPlay;
        const fill   = active ? 0x0a2838 : 0x040c14;
        const sc     = active ? COL_BINGO_ACCENT : 0x0a2a38;
        this.autoBtnGfx.fillStyle(fill, 1);
        this.autoBtnGfx.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
        this.autoBtnGfx.lineStyle(1, sc, 0.9);
        this.autoBtnGfx.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 5);
        this.autoBtnLabel.setColor(active ? '#00c8ff' : '#407080');
        this.autoBtnLabel.setText(active ? '■ AUTO' : '▶ AUTO');
    }

    // ── Close / cleanup ───────────────────────────────────────────────────────

    close(): void {
        if (this.closed) return;
        this.closed = true;

        this.stopAutoPlay();
        this.escKey.destroy();
        this.spaceKey.destroy();

        this.scene.tweens.add({
            targets:  [this.overlay, this.panelGfx, this.container],
            alpha:    0,
            duration: ANIM_MED,
            onComplete: () => {
                this.overlay.destroy();
                this.panelGfx.destroy();
                this.container.destroy();
                this.onClose();
            },
        });
    }
}
