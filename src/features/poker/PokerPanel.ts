// ── Poker Table — full Texas Hold'em gameplay vs AI opponents ─────────────────
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_FELT, COL_TRIM, COL_TABLE,
} from '../../game/constants';
import {
    PokerGameState, PokerPlayer, PlayerAction,
    createGame, dealHand, processAction,
    activeSeatId, callAmount,
    cardLabel, isRed,
    Card, evalBestHand,
} from './PokerEngine';
import { getAIDecision } from './PokerAI';

// ── Seat configuration ────────────────────────────────────────────────────────

interface SeatConfig {
    id: number;
    label: string;
    aiName?: string;
    aiChips?: number;
}

const SEAT_CONFIGS: SeatConfig[] = [
    { id: 0, label: 'Seat 1', aiName: 'RoyalFlush88', aiChips: 450 },
    { id: 1, label: 'Seat 2' },
    { id: 2, label: 'Seat 3', aiName: 'BluffMaster',  aiChips: 1200 },
    { id: 3, label: 'Seat 4' },
    { id: 4, label: 'Seat 5', aiName: 'AllInAlice',   aiChips: 780 },
    { id: 5, label: 'Seat 6' },
];

// Oval table seat positions (relative to container center)
const SEAT_POSITIONS: [number, number][] = [
    [-140, -105],
    [0,    -118],
    [140,  -105],
    [140,    55],
    [0,      68],
    [-140,   55],
];

const PANEL_W  = 600;
const PANEL_H  = 500;
const BUY_IN   = 500;
const COMM_Y   = -28;
const COMM_XS  = [-72, -36, 0, 36, 72];

// ── Card drawing helper ───────────────────────────────────────────────────────

function makeCardObj(
    scene: Phaser.Scene,
    card: Card | null,
    faceDown: boolean,
    cx: number,
    cy: number,
): Phaser.GameObjects.Container {
    const W = 32, H = 44;
    const bg = scene.add.rectangle(cx, cy, W, H,
        faceDown ? 0x1a3a5a : (card && isRed(card) ? 0xfff0f0 : 0xfafafa), 1)
        .setStrokeStyle(1, faceDown ? 0x3a6a9a : 0x888888, 1);

    if (faceDown || !card) {
        const back = scene.add.text(cx, cy, '?', {
            fontFamily: 'monospace', fontSize: '16px', color: '#3a6a9a',
        }).setOrigin(0.5);
        return scene.add.container(0, 0, [bg, back]);
    }

    const color = isRed(card) ? '#cc2222' : '#111111';
    const lbl = scene.add.text(cx, cy, cardLabel(card), {
        fontFamily: 'monospace', fontSize: '12px', color, fontStyle: 'bold',
    }).setOrigin(0.5);
    return scene.add.container(0, 0, [bg, lbl]);
}

// ── Panel class ───────────────────────────────────────────────────────────────

export class PokerPanel {
    private scene: Phaser.Scene;
    private onClose: () => void;

    private overlay!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private statusText!: Phaser.GameObjects.Text;
    private chipsText!: Phaser.GameObjects.Text;
    private potText!: Phaser.GameObjects.Text;
    private handNumText!: Phaser.GameObjects.Text;
    private phaseText!: Phaser.GameObjects.Text;
    private aiThinkingText!: Phaser.GameObjects.Text;

    private seatBtns: Map<number, Phaser.GameObjects.Container> = new Map();
    private communityCardObjs: Phaser.GameObjects.Container[] = [];
    private playerHandArea!: Phaser.GameObjects.Container;
    private playerHandCards: Phaser.GameObjects.Container[] = [];
    private handStrengthText!: Phaser.GameObjects.Text;
    private actionArea!: Phaser.GameObjects.Container;

    private game!: PokerGameState;
    private playerSeatId: number | null = null;
    private aiTimers: Phaser.Time.TimerEvent[] = [];
    private waitingForAI = false;
    private escKey!: Phaser.Input.Keyboard.Key;

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene = scene;
        this.onClose = onClose;
        this.build();
    }

    // ── Build UI ──────────────────────────────────────────────────────────────

    private build(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const pw = PANEL_W, ph = PANEL_H;

        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();

        this.container = this.scene.add.container(cx, cy).setScrollFactor(0).setDepth(DEPTH_PANEL + 1);

        // Panel BG
        const bg = this.scene.add.rectangle(0, 0, pw, ph, 0x071207, 1)
            .setStrokeStyle(2, COL_TRIM, 1);
        this.container.add(bg);

        // Title
        const title = this.scene.add.text(0, -ph / 2 + 22, '♠  POKER TABLE  ♠', {
            fontFamily: 'monospace', fontSize: '18px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        const divider = this.scene.add.rectangle(0, -ph / 2 + 38, pw - 40, 1, COL_TRIM, 0.5);
        this.container.add([title, divider]);

        // Info row
        const infoText = this.scene.add.text(0, -ph / 2 + 52,
            "Texas Hold'em  ·  Blinds 10/20  ·  Buy-in 500◈", {
                fontFamily: 'monospace', fontSize: '11px', color: '#6a8a6a',
            }).setOrigin(0.5);
        this.container.add(infoText);

        this.handNumText = this.scene.add.text(-pw / 2 + 16, -ph / 2 + 52, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#4a6a4a',
        }).setOrigin(0, 0.5);
        this.chipsText = this.scene.add.text(pw / 2 - 16, -ph / 2 + 52, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#2ecc71',
        }).setOrigin(1, 0.5);
        this.container.add([this.handNumText, this.chipsText]);

        // Oval felt table
        const tableEllipse = this.scene.add.ellipse(0, -20, 360, 160, COL_FELT, 1);
        tableEllipse.setStrokeStyle(5, COL_TABLE, 1);
        const tableRing = this.scene.add.ellipse(0, -20, 318, 132, 0x000000, 0);
        tableRing.setStrokeStyle(1, 0x2a6a2a, 0.5);
        this.container.add([tableEllipse, tableRing]);

        // Pot display
        this.potText = this.scene.add.text(0, -66, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#c9a84c',
        }).setOrigin(0.5);
        this.container.add(this.potText);

        // Phase label (PREFLOP / FLOP / TURN / RIVER / SHOWDOWN)
        this.phaseText = this.scene.add.text(0, -80, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#6a9a6a',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(this.phaseText);

        // AI thinking indicator
        this.aiThinkingText = this.scene.add.text(0, 135, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#888866',
        }).setOrigin(0.5).setScrollFactor(0);
        this.container.add(this.aiThinkingText);

        // Community card placeholder slots
        for (let i = 0; i < 5; i++) {
            const placeholder = this.scene.add.rectangle(COMM_XS[i], COMM_Y, 32, 44, 0x0d2a0d, 1)
                .setStrokeStyle(1, 0x2a5a2a, 0.6);
            this.container.add(placeholder);
        }

        // Seat buttons
        SEAT_CONFIGS.forEach((sc, i) => {
            const [sx, sy] = SEAT_POSITIONS[i];
            const btn = this.buildSeatBtn(sc, null, sx, sy);
            this.seatBtns.set(sc.id, btn);
            this.container.add(btn);
        });

        // Player hand area
        this.playerHandArea = this.scene.add.container(0, 100);
        const handLabel = this.scene.add.text(0, -20, 'YOUR HAND', {
            fontFamily: 'monospace', fontSize: '9px', color: '#4a7a4a',
        }).setOrigin(0.5);
        this.handStrengthText = this.scene.add.text(0, 30, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#c9a84c',
        }).setOrigin(0.5);
        this.playerHandArea.add([handLabel, this.handStrengthText]);
        this.container.add(this.playerHandArea);
        this.playerHandArea.setVisible(false);

        // Action area
        this.actionArea = this.scene.add.container(0, 155);
        this.container.add(this.actionArea);

        // Status bar
        const statusBg = this.scene.add.rectangle(0, ph / 2 - 52, pw - 40, 26, 0x020a02, 0.92)
            .setStrokeStyle(1, 0x2a4a2a, 0.6);
        this.statusText = this.scene.add.text(0, ph / 2 - 52, 'Select an empty seat to join the table.', {
            fontFamily: 'monospace', fontSize: '11px', color: '#6a8a6a',
        }).setOrigin(0.5);
        this.container.add([statusBg, this.statusText]);

        // Close button
        const closeRect = this.scene.add.rectangle(0, ph / 2 - 22, 120, 26, 0x3a1e1e, 1)
            .setStrokeStyle(1, 0x8a3a3a, 1).setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(0, ph / 2 - 22, 'Leave Table', {
            fontFamily: 'monospace', fontSize: '12px', color: '#e05050',
        }).setOrigin(0.5);
        closeRect.on('pointerover', () => closeRect.setFillStyle(0x5a2a2a));
        closeRect.on('pointerout',  () => closeRect.setFillStyle(0x3a1e1e));
        closeRect.on('pointerdown', () => { closeRect.setFillStyle(0x2a0a0a); this.close(); });
        closeRect.on('pointerup',   () => closeRect.setFillStyle(0x5a2a2a));
        this.container.add([closeRect, closeLabel]);

        this.escKey = this.scene.input.keyboard!.addKey('ESC');
        this.escKey.once('down', () => this.close());

        this.updateChipsDisplay();
        this.showDealButton(false);
    }

    // ── Seat Buttons ──────────────────────────────────────────────────────────

    /** Returns 'D', 'SB', or 'BB' if this seat holds that role this hand, else ''. */
    private getPositionBadge(seatId: number): string {
        if (!this.game || this.game.phase === 'waiting') return '';
        const players = this.game.players;
        const n = players.length;
        if (n < 2) return '';
        const di = this.game.dealerIdx;
        const si = n === 2 ? di : (di + 1) % n;
        const bi = (si + 1) % n;
        if (players[di]?.seatId === seatId) return 'D';
        if (players[si]?.seatId === seatId) return 'SB';
        if (players[bi]?.seatId === seatId) return 'BB';
        return '';
    }

    private buildSeatBtn(
        sc: SeatConfig,
        gamePlayer: PokerPlayer | null,
        x: number,
        y: number,
    ): Phaser.GameObjects.Container {
        const W = 104, H = 52;
        const isYou    = this.playerSeatId === sc.id;
        const isAIConf = !!sc.aiName && !isYou;
        const folded   = gamePlayer?.folded ?? false;
        const isActive = !!this.game &&
            activeSeatId(this.game) === sc.id &&
            this.game.phase !== 'showdown' &&
            this.game.phase !== 'waiting';

        let fillCol  = 0x0a1a0a;
        let borderCol = 0x2a4a2a;
        let nameColor = '#55aa55';

        if (isYou)    { fillCol = 0x0a0a2a; borderCol = 0x3a3a8a; nameColor = '#7777ee'; }
        if (isAIConf) { fillCol = 0x1a0a0a; borderCol = 0x5a2a2a; nameColor = '#aa5555'; }
        if (folded)   { fillCol = 0x0d0d0d; borderCol = 0x333333; nameColor = '#444444'; }
        if (isActive) { borderCol = 0xc9a84c; }

        const rect = this.scene.add.rectangle(0, 0, W, H, fillCol, 1)
            .setStrokeStyle(isActive ? 2 : 1, borderCol, 1);

        const displayName = gamePlayer?.name
            ?? (isYou ? GameState.get().displayName : (sc.aiName ?? sc.label));
        const topLabel = this.scene.add.text(0, -15, displayName, {
            fontFamily: 'monospace', fontSize: '10px', color: folded ? '#444444' : nameColor,
        }).setOrigin(0.5);

        let midStr = '', midColor = '#888888';
        if (folded) {
            midStr = 'FOLDED'; midColor = '#553333';
        } else if (gamePlayer) {
            midStr = `${gamePlayer.chips}◈`; midColor = '#c9a84c';
        } else if (isAIConf) {
            midStr = `${sc.aiChips}◈`; midColor = '#885533';
        } else if (isYou) {
            midStr = `${BUY_IN}◈`; midColor = '#5555aa';
        } else {
            midStr = 'OPEN'; midColor = '#338855';
        }
        const midLabel = this.scene.add.text(0, 0, midStr, {
            fontFamily: 'monospace', fontSize: '10px', color: midColor,
        }).setOrigin(0.5);

        let botStr = '', botColor = '#666666';
        if (gamePlayer && gamePlayer.roundBet > 0 && !folded) {
            botStr = `bet ${gamePlayer.roundBet}◈`; botColor = '#888844';
        } else if (isActive && !folded) {
            botStr = '▶ acting'; botColor = '#c9a84c';
        }
        const botLabel = this.scene.add.text(0, 14, botStr, {
            fontFamily: 'monospace', fontSize: '9px', color: botColor,
        }).setOrigin(0.5);

        const btn = this.scene.add.container(x, y, [rect, topLabel, midLabel, botLabel]);

        // Dealer / blind position badge
        const badge = this.getPositionBadge(sc.id);
        if (badge) {
            const badgeColors: Record<string, { fill: number; text: string }> = {
                D:  { fill: 0xc9a84c, text: '#0a0a0a' },
                SB: { fill: 0x3a5a8a, text: '#c0d8ff' },
                BB: { fill: 0x3a8a3a, text: '#c0ffc0' },
            };
            const bc = badgeColors[badge];
            const badgeRect = this.scene.add.rectangle(46, -22, 22, 14, bc.fill, 1).setStrokeStyle(0);
            const badgeText = this.scene.add.text(46, -22, badge, {
                fontFamily: 'monospace', fontSize: '9px', color: bc.text, fontStyle: 'bold',
            }).setOrigin(0.5);
            btn.add([badgeRect, badgeText]);
        }

        // Clickable only for empty non-AI seats while not in a game
        if (!sc.aiName && !isYou && !this.game) {
            rect.setInteractive({ useHandCursor: true });
            rect.on('pointerover', () => rect.setFillStyle(0x1a3a1a));
            rect.on('pointerout',  () => rect.setFillStyle(fillCol));
            rect.on('pointerdown', () => this.joinSeat(sc.id));
        }

        // Show AI hole cards during showdown
        if (
            this.game?.phase === 'showdown' &&
            gamePlayer && !gamePlayer.folded &&
            gamePlayer.isAI &&  // only for AI opponents
            gamePlayer.holeCards.length === 2
        ) {
            const [c1, c2] = gamePlayer.holeCards;
            botLabel.setText('');
            const h1 = this.scene.add.text(-18, 14, cardLabel(c1), {
                fontFamily: 'monospace', fontSize: '10px',
                color: isRed(c1) ? '#e05050' : '#e0e0e0',
            }).setOrigin(0.5);
            const h2 = this.scene.add.text(18, 14, cardLabel(c2), {
                fontFamily: 'monospace', fontSize: '10px',
                color: isRed(c2) ? '#e05050' : '#e0e0e0',
            }).setOrigin(0.5);
            btn.add([h1, h2]);
        }

        return btn;
    }

    private refreshAllSeats(): void {
        SEAT_CONFIGS.forEach((sc, i) => {
            const old = this.seatBtns.get(sc.id);
            if (old) old.destroy();
            const gp = this.game?.players.find(p => p.seatId === sc.id) ?? null;
            const [sx, sy] = SEAT_POSITIONS[i];
            const btn = this.buildSeatBtn(sc, gp, sx, sy);
            this.seatBtns.set(sc.id, btn);
            this.container.add(btn);
        });
    }

    // ── Join Seat ─────────────────────────────────────────────────────────────

    private joinSeat(seatId: number): void {
        if (GameState.get().chips < BUY_IN) {
            this.setStatus(`Need at least ${BUY_IN}◈ to join.`, '#e74c3c');
            return;
        }
        this.playerSeatId = seatId;
        GameState.addChips(-BUY_IN);
        this.updateChipsDisplay();
        this.setStatus(`You joined Seat ${seatId + 1}. Press Deal to start!`, '#c9a84c');
        this.refreshAllSeats();
        this.showDealButton(true);
    }

    // ── Game Flow ─────────────────────────────────────────────────────────────

    private startHand(): void {
        if (this.playerSeatId === null) return;

        const prevPlayers = this.game?.players ?? [];

        const activePlayers: Array<{ seatId: number; name: string; chips: number; isAI: boolean }> = [];

        SEAT_CONFIGS.forEach(sc => {
            if (sc.aiName) {
                const prev = prevPlayers.find(p => p.seatId === sc.id);
                const chips = prev ? prev.chips : (sc.aiChips ?? 500);
                if (chips > 0) activePlayers.push({ seatId: sc.id, name: sc.aiName, chips, isAI: true });
            } else if (sc.id === this.playerSeatId) {
                const prev = prevPlayers.find(p => p.seatId === sc.id);
                const chips = prev ? prev.chips : BUY_IN;
                if (chips > 0) activePlayers.push({
                    seatId: sc.id,
                    name: GameState.get().displayName,
                    chips,
                    isAI: false,
                });
            }
        });

        if (activePlayers.length < 2) {
            this.setStatus('Not enough players to deal.', '#e74c3c');
            return;
        }

        const prevHandNum   = this.game?.handNumber ?? 0;
        const prevDealerIdx = this.game?.dealerIdx ?? 0;

        const base  = createGame(activePlayers);
        base.handNumber  = prevHandNum;
        base.dealerIdx   = prevDealerIdx;
        this.game = dealHand(base);

        // Guard: dealHand may fail if still not enough eligible players
        if (this.game.phase === 'waiting') {
            this.setStatus(this.game.statusMessage, '#e74c3c');
            this.scene.time.delayedCall(2200, () => this.close());
            return;
        }

        this.showDealButton(false);
        this.playerHandArea.setVisible(true);
        this.refreshAllSeats();
        this.updateCommunityCards();
        this.updatePot();
        this.updatePhaseLabel();
        this.updateChipsDisplay();
        this.setStatus(this.game.statusMessage, '#c9a84c');
        this.handNumText.setText(`Hand #${this.game.handNumber}`);

        this.scheduleNextAction();
    }

    // ── Action Scheduling ─────────────────────────────────────────────────────

    private scheduleNextAction(): void {
        if (!this.game) return;
        const { phase, activePlayerIdx } = this.game;

        if (phase === 'showdown') { this.handleShowdown(); return; }
        if (activePlayerIdx < 0) return;

        const activePlayer = this.game.players[activePlayerIdx];
        if (!activePlayer) return;

        if (!activePlayer.isAI && activePlayer.seatId === this.playerSeatId) {
            this.aiThinkingText.setText('');
            this.showPlayerActions();
        } else {
            this.waitingForAI = true;
            this.hidePlayerActions();
            this.refreshAllSeats();
            const delay = 900 + Math.random() * 700;
            // Show thinking indicator after a short pause
            const thinkTimer = this.scene.time.delayedCall(300, () => {
                if (this.waitingForAI) {
                    this.aiThinkingText.setText(`${activePlayer.name} is thinking...`);
                }
            });
            this.aiTimers.push(thinkTimer);
            const t = this.scene.time.delayedCall(delay, () => {
                this.waitingForAI = false;
                this.aiThinkingText.setText('');
                this.doAIAction(activePlayerIdx);
            });
            this.aiTimers.push(t);
        }
    }

    private doAIAction(idx: number): void {
        if (!this.game) return;
        const decision = getAIDecision(this.game, idx);
        this.game = processAction(this.game, decision.action, decision.raiseTotal);
        this.afterAction();
    }

    private afterAction(): void {
        this.refreshAllSeats();
        this.updateCommunityCards();
        this.updatePot();
        this.updatePhaseLabel();
        this.updateChipsDisplay();
        this.updateHandStrength();
        this.setStatus(this.game.statusMessage, '#c9a84c');
        this.scheduleNextAction();
    }

    // ── Player Action UI ──────────────────────────────────────────────────────

    private showPlayerActions(): void {
        this.actionArea.removeAll(true);

        const idx = this.game.players.findIndex(p => p.seatId === this.playerSeatId);
        if (idx < 0) return;

        const toCall        = callAmount(this.game, idx);
        const canCheck      = toCall === 0;
        const player        = this.game.players[idx];
        const availableChips = player.chips; // chips the player still has in stack
        const allInTotal    = availableChips + player.roundBet; // total bet amount if going all-in

        type BtnDef = { label: string; fill: number; stroke: number; text: string; cb: () => void };

        // ── Fold + check/call (call is labeled ALL IN when player can't fully cover) ──
        const row1: BtnDef[] = [
            {
                label: 'FOLD', fill: 0x3a0a0a, stroke: 0x8a2a2a, text: '#e05050',
                cb: () => this.playerAction('fold'),
            },
            {
                label: canCheck
                    ? 'CHECK'
                    : (toCall >= availableChips ? `ALL IN ${availableChips}◈` : `CALL ${toCall}◈`),
                fill: 0x0a2a0a, stroke: 0x2a8a2a, text: '#50e050',
                cb: () => this.playerAction(canCheck ? 'check' : 'call'),
            },
        ];

        // ── Raise presets: min, 2×, all-in ──
        const raiseMin = this.game.currentBet + this.game.minRaise;
        const raise2x  = this.game.currentBet + this.game.minRaise * 2;
        const canRaise = availableChips > toCall && raiseMin > this.game.currentBet;

        if (canRaise) {
            // Min raise — only when the player has more chips than needed for min raise
            if (raiseMin < allInTotal) {
                row1.push({
                    label: `MIN ${raiseMin}◈`,
                    fill: 0x2a1a0a, stroke: 0x8a6a2a, text: '#e0c050',
                    cb: () => this.playerAction('raise', raiseMin),
                });
            }
            // 2× raise — only when raise2x is affordable without going all-in and distinct from min
            if (raise2x > raiseMin && raise2x < allInTotal) {
                row1.push({
                    label: `2× ${raise2x}◈`,
                    fill: 0x2a1a0a, stroke: 0x7a5a1a, text: '#d0b040',
                    cb: () => this.playerAction('raise', raise2x),
                });
            }
            // All-in — always offer when going all-in would be at least a partial raise
            if (allInTotal > this.game.currentBet) {
                row1.push({
                    label: `ALL IN ${availableChips}◈`,
                    fill: 0x3a0a2a, stroke: 0x9a2a7a, text: '#e050c0',
                    cb: () => this.playerAction('raise', allInTotal),
                });
            }
        }

        const ACTION_AREA_WIDTH  = 520;
        const MAX_BTN_SPACING    = 130;
        const spacing = Math.min(MAX_BTN_SPACING, ACTION_AREA_WIDTH / Math.max(row1.length, 1));
        const startX  = -((row1.length - 1) * spacing) / 2;

        const turnBanner = this.scene.add.text(0, -22, '— YOUR TURN —', {
            fontFamily: 'monospace', fontSize: '10px', color: '#c9a84c',
        }).setOrigin(0.5);
        this.actionArea.add(turnBanner);

        row1.forEach((def, i) => {
            const bx = startX + i * spacing;
            const w  = Math.min(118, spacing - 12);
            const r  = this.scene.add.rectangle(bx, 0, w, 30, def.fill, 1)
                .setStrokeStyle(1, def.stroke, 1).setInteractive({ useHandCursor: true });
            const t  = this.scene.add.text(bx, 0, def.label, {
                fontFamily: 'monospace', fontSize: '10px', color: def.text,
            }).setOrigin(0.5);
            r.on('pointerover', () => r.setFillStyle(def.fill + 0x101010));
            r.on('pointerout',  () => r.setFillStyle(def.fill));
            r.on('pointerdown', () => { r.setFillStyle(Math.max(0, def.fill - 0x080808)); def.cb(); });
            r.on('pointerup',   () => r.setFillStyle(def.fill + 0x101010));
            this.actionArea.add([r, t]);
        });
    }

    private hidePlayerActions(): void {
        this.actionArea.removeAll(true);
    }

    private playerAction(action: PlayerAction, raiseTotal?: number): void {
        if (!this.game || this.waitingForAI) return;
        this.hidePlayerActions();
        this.game = processAction(this.game, action, raiseTotal);
        this.afterAction();
    }

    // ── Showdown ──────────────────────────────────────────────────────────────

    private handleShowdown(): void {
        this.hidePlayerActions();
        this.refreshAllSeats();
        this.updatePot();
        this.updateChipsDisplay();
        this.setStatus(this.game.statusMessage, '#c9a84c');

        this.scene.tweens.add({
            targets: this.statusText,
            scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 200, repeat: 2,
        });

        const t = this.scene.time.delayedCall(3000, () => {
            const gp = this.game.players.find(p => p.seatId === this.playerSeatId);
            if (!gp || gp.chips === 0) {
                this.setStatus("You're out of chips! Leaving table.", '#e74c3c');
                this.scene.time.delayedCall(1500, () => this.close());
                return;
            }
            this.setStatus('Press Deal for next hand.', '#6a8a6a');
            this.showDealButton(true);
            this.playerHandArea.setVisible(false);
            this.clearCommunityCards();
            this.handNumText.setText('');
            this.potText.setText('');
            this.phaseText.setText('');
            this.handStrengthText.setText('');
        });
        this.aiTimers.push(t);
    }

    // ── Community Cards ───────────────────────────────────────────────────────

    private updateCommunityCards(): void {
        this.communityCardObjs.forEach(o => o.destroy());
        this.communityCardObjs = [];
        if (!this.game) return;

        for (let i = 0; i < 5; i++) {
            const card = this.game.community[i] ?? null;
            const obj  = card
                ? makeCardObj(this.scene, card, false, COMM_XS[i], COMM_Y)
                : this.scene.add.container(0, 0, [
                    this.scene.add.rectangle(COMM_XS[i], COMM_Y, 32, 44, 0x0a1e0a, 1)
                        .setStrokeStyle(1, 0x1a3a1a, 0.5),
                  ]);
            this.communityCardObjs.push(obj);
            this.container.add(obj);
        }

        this.updatePlayerHandCards();
    }

    private clearCommunityCards(): void {
        this.communityCardObjs.forEach(o => o.destroy());
        this.communityCardObjs = [];
        for (let i = 0; i < 5; i++) {
            const ph = this.scene.add.rectangle(COMM_XS[i], COMM_Y, 32, 44, 0x0d2a0d, 1)
                .setStrokeStyle(1, 0x2a5a2a, 0.6);
            const obj = this.scene.add.container(0, 0, [ph]);
            this.communityCardObjs.push(obj);
            this.container.add(obj);
        }
        this.playerHandCards.forEach(c => c.destroy());
        this.playerHandCards = [];
        this.playerHandArea.setVisible(false);
    }

    private updatePlayerHandCards(): void {
        this.playerHandCards.forEach(c => c.destroy());
        this.playerHandCards = [];
        if (!this.game || this.playerSeatId === null) return;
        const player = this.game.players.find(p => p.seatId === this.playerSeatId);
        if (!player || player.holeCards.length === 0) return;

        const xs = [-20, 20];
        player.holeCards.forEach((card, i) => {
            const obj = makeCardObj(this.scene, card, false, xs[i], 8);
            this.playerHandArea.add(obj);
            this.playerHandCards.push(obj);
        });
    }

    // ── Deal button ───────────────────────────────────────────────────────────

    private showDealButton(show: boolean): void {
        this.actionArea.removeAll(true);
        if (!show) return;

        const r = this.scene.add.rectangle(0, 0, 150, 32, 0x0a2a0a, 1)
            .setStrokeStyle(2, COL_TRIM, 1).setInteractive({ useHandCursor: true });
        const lbl = this.scene.add.text(0, 0, '▶  DEAL HAND', {
            fontFamily: 'monospace', fontSize: '13px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        r.on('pointerover', () => r.setFillStyle(0x1a4a1a));
        r.on('pointerout',  () => r.setFillStyle(0x0a2a0a));
        r.on('pointerdown', () => this.startHand());
        this.actionArea.add([r, lbl]);
    }

    // ── Display helpers ───────────────────────────────────────────────────────

    private updateHandStrength(): void {
        if (!this.game || this.playerSeatId === null) {
            this.handStrengthText.setText(''); return;
        }
        const player = this.game.players.find(p => p.seatId === this.playerSeatId);
        if (!player || player.folded || player.holeCards.length < 2 || this.game.community.length === 0) {
            this.handStrengthText.setText(''); return;
        }
        const { name } = evalBestHand([...player.holeCards, ...this.game.community]);
        this.handStrengthText.setText(name);
    }

    private updatePot(): void {
        if (!this.game || this.game.pot === 0) { this.potText.setText(''); return; }
        this.potText.setText(`Pot: ${this.game.pot}◈`);
    }

    private updatePhaseLabel(): void {
        if (!this.game) { this.phaseText.setText(''); return; }
        const labels: Record<string, string> = {
            preflop: '— PRE-FLOP —',
            flop:    '— FLOP —',
            turn:    '— TURN —',
            river:   '— RIVER —',
            showdown:'— SHOWDOWN —',
            waiting: '',
        };
        const label = labels[this.game.phase] ?? '';
        this.phaseText.setText(label);
    }

    private updateChipsDisplay(): void {
        if (this.game && this.playerSeatId !== null) {
            const p = this.game.players.find(pl => pl.seatId === this.playerSeatId);
            if (p) { this.chipsText.setText(`◈ ${p.chips}`); return; }
        }
        this.chipsText.setText(`◈ ${GameState.get().chips}`);
    }

    private setStatus(msg: string, color: string): void {
        this.statusText.setText(msg).setColor(color);
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    private close(): void {
        this.aiTimers.forEach(t => t.remove());

        // Return remaining chips to GameState
        if (this.game && this.playerSeatId !== null) {
            const p = this.game.players.find(pl => pl.seatId === this.playerSeatId);
            if (p) GameState.addChips(p.chips);
        } else if (this.playerSeatId !== null && !this.game) {
            // Joined but never dealt — refund buy-in
            GameState.addChips(BUY_IN);
        }

        this.escKey.destroy();
        this.overlay.destroy();
        this.container.destroy();
        this.onClose();
    }
}
