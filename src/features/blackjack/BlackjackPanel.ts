// ── Blackjack Panel — playable blackjack minigame ────────────────────────────
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_FELT, COL_TRIM, COL_TRIM_DIM,
    COL_BTN_PRIMARY, COL_BTN_DANGER,
    COL_UI_BG, COL_UI_BG2, COL_UI_BORDER,
    FONT, TEXT_MD, TEXT_GOLD, TEXT_GOLD_LG,
} from '../../game/constants';
import {
    BlackjackState, BJResult,
    createGame, deal, hit, stand, doubleDown, nextHand,
    handValue, isBlackjack, cardLabel, isRed, chipDelta,
    Card,
} from './BlackjackEngine';

// ── Layout constants ──────────────────────────────────────────────────────────

const PW = 620;
const PH = 520;

const BET_OPTIONS = [10, 25, 50, 100];

// ── BlackjackPanel ────────────────────────────────────────────────────────────

export class BlackjackPanel {
    private scene:   Phaser.Scene;
    private onClose: () => void;

    // Phaser objects
    private overlay!:    Phaser.GameObjects.Rectangle;
    private container!:  Phaser.GameObjects.Container;
    private escKey!:     Phaser.Input.Keyboard.Key;

    // Dynamic display groups (rebuilt on each hand redraw)
    private dealerCardObjs: Phaser.GameObjects.GameObject[] = [];
    private playerCardObjs: Phaser.GameObjects.GameObject[] = [];

    // Persistent text nodes
    private dealerValueText!: Phaser.GameObjects.Text;
    private playerValueText!: Phaser.GameObjects.Text;
    private chipsText!:       Phaser.GameObjects.Text;
    private betText!:         Phaser.GameObjects.Text;
    private resultText!:      Phaser.GameObjects.Text;
    private statsText!:       Phaser.GameObjects.Text;

    // Button containers (shown/hidden per phase)
    private betBtns:    Phaser.GameObjects.Container[] = [];
    private actionBtns: Phaser.GameObjects.Container[] = [];
    private doubleBtn:  Phaser.GameObjects.Container | null = null;
    private newHandBtn: Phaser.GameObjects.Container | null = null;

    // State
    private bjState!:      BlackjackState;
    private currentBet:    number = 25;
    private closed:        boolean = false;
    private betDeducted:   boolean = false;  // tracks whether bet was already taken

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene   = scene;
        this.onClose = onClose;
        this.bjState = createGame();
        this.build();
    }

    // ── Build ─────────────────────────────────────────────────────────────────

    private build(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Dimming overlay
        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();

        // Panel container
        this.container = this.scene.add.container(cx, cy)
            .setScrollFactor(0).setDepth(DEPTH_PANEL + 1);

        // ── Panel background ──────────────────────────────────────────────────
        const bg = this.scene.add.rectangle(0, 0, PW, PH, COL_UI_BG, 1)
            .setStrokeStyle(3, COL_TRIM, 1);
        this.container.add(bg);

        // Inner felt surface
        const felt = this.scene.add.rectangle(0, -20, PW - 30, PH - 120, COL_FELT, 1)
            .setStrokeStyle(1.5, 0x2a6a2a, 1);
        this.container.add(felt);

        // ── Title ─────────────────────────────────────────────────────────────
        const title = this.scene.add.text(0, -PH / 2 + 22, '🃏  BLACKJACK', {
            fontFamily: FONT, fontSize: '20px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        // ── Dealer / Player labels ────────────────────────────────────────────
        const dealerLabel = this.scene.add.text(-PW / 2 + 18, -PH / 2 + 52, 'DEALER', {
            ...TEXT_GOLD, fontSize: '11px',
        }).setOrigin(0, 0.5);
        this.container.add(dealerLabel);

        this.dealerValueText = this.scene.add.text(PW / 2 - 18, -PH / 2 + 52, '', {
            ...TEXT_MD, fontSize: '13px',
        }).setOrigin(1, 0.5);
        this.container.add(this.dealerValueText);

        const playerLabel = this.scene.add.text(-PW / 2 + 18, 40, 'YOUR HAND', {
            ...TEXT_GOLD, fontSize: '11px',
        }).setOrigin(0, 0.5);
        this.container.add(playerLabel);

        this.playerValueText = this.scene.add.text(PW / 2 - 18, 40, '', {
            ...TEXT_MD, fontSize: '13px',
        }).setOrigin(1, 0.5);
        this.container.add(this.playerValueText);

        // ── Result text (center) ──────────────────────────────────────────────
        this.resultText = this.scene.add.text(0, 0, '', {
            fontFamily: FONT, fontSize: '22px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(this.resultText);

        // ── Bottom bar ────────────────────────────────────────────────────────
        const barBg = this.scene.add.rectangle(0, PH / 2 - 48, PW - 30, 64, COL_UI_BG2, 1)
            .setStrokeStyle(1, COL_UI_BORDER, 0.5);
        this.container.add(barBg);

        this.chipsText = this.scene.add.text(-PW / 2 + 20, PH / 2 - 48, '', {
            ...TEXT_GOLD_LG,
        }).setOrigin(0, 0.5);
        this.container.add(this.chipsText);

        this.betText = this.scene.add.text(PW / 2 - 20, PH / 2 - 48, '', {
            ...TEXT_MD,
        }).setOrigin(1, 0.5);
        this.container.add(this.betText);

        // ── Stats text ────────────────────────────────────────────────────────
        this.statsText = this.scene.add.text(0, PH / 2 - 20, '', {
            fontFamily: FONT, fontSize: '9px', color: '#446644',
        }).setOrigin(0.5);
        this.container.add(this.statsText);

        // ── Close button ──────────────────────────────────────────────────────
        const closeBtn = this.makeButton(PW / 2 - 36, -PH / 2 + 22, 50, 22, '✕ ESC', 0x3a1c1c, () => this.close());
        this.container.add(closeBtn);

        // ── ESC key ───────────────────────────────────────────────────────────
        this.escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.escKey.on('down', () => this.close());

        // Build bet-selection UI
        this.buildBetUI();

        // Build action buttons (hidden until dealing)
        this.buildActionButtons();

        // Initial display
        this.refreshDisplay();
    }

    // ── Bet selection UI ──────────────────────────────────────────────────────

    private buildBetUI(): void {
        const by = PH / 2 - 88;

        const label = this.scene.add.text(-PW / 2 + 20, by, 'PLACE BET:', {
            ...TEXT_GOLD, fontSize: '11px',
        }).setOrigin(0, 0.5);
        label.setData('betUI', true);
        this.container.add(label);

        let btnX = -PW / 2 + 110;
        for (const amt of BET_OPTIONS) {
            const btn = this.makeButton(btnX, by, 56, 26, `◈${amt}`,
                this.currentBet === amt ? COL_BTN_PRIMARY : 0x2a3a2a,
                () => this.selectBet(amt, btn));
            btn.setData('betUIBtn', amt);
            this.betBtns.push(btn);
            this.container.add(btn);
            btnX += 64;
        }

        const dealBtnX = PW / 2 - 80;
        const dealBtn  = this.makeButton(dealBtnX, by, 90, 26, 'DEAL ▶', COL_BTN_PRIMARY, () => this.startHand());
        dealBtn.setData('betUIDeal', true);
        this.betBtns.push(dealBtn);
        this.container.add(dealBtn);
    }

    private selectBet(amt: number, btn: Phaser.GameObjects.Container): void {
        if (this.bjState.phase !== 'betting') return;
        const chips = GameState.get().chips;
        if (amt > chips) return;

        this.currentBet = amt;
        // Update button highlight
        this.betBtns.forEach(b => {
            const isThis = b.getData('betUIBtn') === amt;
            const bg = b.getAt(0) as Phaser.GameObjects.Rectangle;
            bg.setFillStyle(isThis ? COL_BTN_PRIMARY : 0x2a3a2a);
        });
        void btn; // suppress TS unused warning
        this.refreshDisplay();
    }

    // ── Action buttons (Hit / Stand / Double) ─────────────────────────────────

    private buildActionButtons(): void {
        const ay = PH / 2 - 88;
        const hitBtn   = this.makeButton(-PW / 2 + 90,  ay, 80, 26, 'HIT',   COL_BTN_PRIMARY, () => this.doHit());
        const standBtn = this.makeButton(-PW / 2 + 180, ay, 80, 26, 'STAND', 0x1a3a5a,        () => this.doStand());
        this.doubleBtn = this.makeButton(-PW / 2 + 270, ay, 100, 26, 'DOUBLE', 0x3a3a1a,      () => this.doDouble());
        this.actionBtns.push(hitBtn, standBtn, this.doubleBtn);

        for (const b of this.actionBtns) {
            b.setVisible(false);
            this.container.add(b);
        }
    }

    // ── New-hand button (shown in result phase) ───────────────────────────────

    private buildNewHandButton(): void {
        if (this.newHandBtn) { this.newHandBtn.destroy(); this.newHandBtn = null; }

        const chips = GameState.get().chips;
        const label  = chips > 0 ? 'NEXT HAND ▶' : 'OUT OF CHIPS';
        const colour = chips > 0 ? COL_BTN_PRIMARY : COL_BTN_DANGER;

        this.newHandBtn = this.makeButton(-PW / 2 + 100, PH / 2 - 88, 130, 26, label, colour,
            () => chips > 0 ? this.prepareNextHand() : this.close());
        this.container.add(this.newHandBtn);
    }

    // ── Hand lifecycle ────────────────────────────────────────────────────────

    private startHand(): void {
        if (this.bjState.phase !== 'betting') return;
        const chips = GameState.get().chips;
        if (this.currentBet > chips) {
            // Find the largest affordable bet
            const max = BET_OPTIONS.slice().reverse().find(o => o <= chips);
            if (!max) { this.close(); return; }
            this.currentBet = max;
        }

        // Deduct the initial bet immediately
        GameState.addChips(-this.currentBet);
        this.betDeducted = true;

        this.bjState = deal(this.bjState, this.currentBet);
        this.showPhaseUI();
        this.refreshDisplay();

        // Check player blackjack
        if (this.bjState.result === 'blackjack') {
            this.resolveResult();
        }
    }

    private doHit(): void {
        if (this.bjState.phase !== 'playing') return;
        this.bjState = hit(this.bjState);
        this.refreshDisplay();
        if (this.bjState.phase === 'result') this.resolveResult();
    }

    private doStand(): void {
        if (this.bjState.phase !== 'playing') return;
        this.bjState = stand(this.bjState);
        this.refreshDisplay();
        this.resolveResult();
    }

    private doDouble(): void {
        if (this.bjState.phase !== 'playing') return;
        const chips = GameState.get().chips;
        if (this.bjState.bet > chips) return;          // not enough chips for second half
        GameState.addChips(-this.bjState.bet);          // deduct second half of bet
        this.bjState = doubleDown(this.bjState);
        this.refreshDisplay();
        this.resolveResult();
    }

    private resolveResult(): void {
        // chipDelta accounts for the full payout (bet return + winnings)
        const delta = chipDelta(this.bjState);
        if (delta > 0) GameState.addChips(delta);

        this.betDeducted = false;
        this.showResultUI();
        this.refreshDisplay();
    }

    private prepareNextHand(): void {
        if (this.newHandBtn) { this.newHandBtn.destroy(); this.newHandBtn = null; }
        this.bjState    = nextHand(this.bjState);
        this.betDeducted = false;
        this.showPhaseUI();
        this.refreshDisplay();
    }

    // ── Phase UI visibility ───────────────────────────────────────────────────

    private showPhaseUI(): void {
        const phase = this.bjState.phase;

        const betting  = phase === 'betting';
        const playing  = phase === 'playing';

        // Bet buttons
        this.betBtns.forEach(b => b.setVisible(betting));

        // Action buttons
        for (const b of this.actionBtns) b.setVisible(playing);

        // Double only visible when player has exactly 2 cards and enough chips
        if (this.doubleBtn) {
            const canDouble = playing
                && this.bjState.playerHand.length === 2
                && GameState.get().chips >= this.bjState.bet;
            this.doubleBtn.setVisible(canDouble);
        }
    }

    private showResultUI(): void {
        this.betBtns.forEach(b => b.setVisible(false));
        for (const b of this.actionBtns) b.setVisible(false);
        this.buildNewHandButton();
    }

    // ── Display refresh ───────────────────────────────────────────────────────

    private refreshDisplay(): void {
        this.updateChipBet();
        this.renderDealerCards();
        this.renderPlayerCards();
        this.updateHandValues();
        this.updateResultBanner();
        this.updateStats();
    }

    private updateChipBet(): void {
        const chips = GameState.get().chips;
        this.chipsText.setText(`◈ ${chips.toLocaleString()}`);

        if (this.bjState.phase === 'betting') {
            this.betText.setText(`Bet: ◈ ${this.currentBet}`);
        } else {
            this.betText.setText(`Bet: ◈ ${this.bjState.bet}`);
        }
    }

    private renderDealerCards(): void {
        // Destroy previous card objects
        for (const obj of this.dealerCardObjs) obj.destroy();
        this.dealerCardObjs = [];

        const hand = this.bjState.dealerHand;
        if (hand.length === 0) return;

        const startX = -((hand.length - 1) * 44) / 2;
        const baseY  = -PH / 2 + 100;

        for (let i = 0; i < hand.length; i++) {
            const hidden = i === 1 && !this.bjState.dealerRevealed;
            const objs   = this.renderCard(startX + i * 44, baseY, hand[i], hidden);
            this.dealerCardObjs.push(...objs);
        }
    }

    private renderPlayerCards(): void {
        for (const obj of this.playerCardObjs) obj.destroy();
        this.playerCardObjs = [];

        const hand = this.bjState.playerHand;
        if (hand.length === 0) return;

        const startX = -((hand.length - 1) * 44) / 2;
        const baseY  = 80;

        for (let i = 0; i < hand.length; i++) {
            const objs = this.renderCard(startX + i * 44, baseY, hand[i], false);
            this.playerCardObjs.push(...objs);
        }
    }

    private renderCard(x: number, y: number, card: Card, hidden: boolean): Phaser.GameObjects.GameObject[] {
        const w = 38;
        const h = 54;

        const shadow = this.scene.add.rectangle(x + 2, y + 2, w, h, 0x000000, 0.4);
        this.container.add(shadow);

        const bg = this.scene.add.rectangle(x, y, w, h, hidden ? 0x1a1a3e : 0xf5f0e8, 1)
            .setStrokeStyle(1.5, hidden ? 0x4444aa : 0xaaa090, 1);
        this.container.add(bg);

        if (hidden) {
            // Card back pattern
            const pat = this.scene.add.text(x, y, '🂠', {
                fontFamily: FONT, fontSize: '28px', color: '#4444aa',
            }).setOrigin(0.5);
            this.container.add(pat);
            return [shadow, bg, pat];
        }

        // Card face — rank + suit in corner
        const red = isRed(card);
        const col = red ? '#c0301a' : '#111111';
        const lbl = cardLabel(card);

        const topLeft = this.scene.add.text(x - w / 2 + 3, y - h / 2 + 2, lbl, {
            fontFamily: FONT, fontSize: '9px', color: col, fontStyle: 'bold',
        }).setOrigin(0, 0);
        this.container.add(topLeft);

        const centerSuit = this.scene.add.text(x, y, lbl.slice(-1), {
            fontFamily: FONT, fontSize: '22px', color: col,
        }).setOrigin(0.5);
        this.container.add(centerSuit);

        const bottomRight = this.scene.add.text(x + w / 2 - 3, y + h / 2 - 2, lbl, {
            fontFamily: FONT, fontSize: '9px', color: col, fontStyle: 'bold',
        }).setOrigin(1, 1);
        this.container.add(bottomRight);

        return [shadow, bg, topLeft, centerSuit, bottomRight];
    }

    private updateHandValues(): void {
        const { bjState } = this;

        if (bjState.playerHand.length > 0) {
            const pv = handValue(bjState.playerHand);
            const bj = isBlackjack(bjState.playerHand);
            this.playerValueText.setText(bj ? 'BLACKJACK!' : String(pv));
            this.playerValueText.setColor(pv > 21 ? '#e74c3c' : bj ? '#c9a84c' : '#f0e6d3');
        } else {
            this.playerValueText.setText('');
        }

        if (bjState.dealerHand.length > 0) {
            if (bjState.dealerRevealed) {
                const dv = handValue(bjState.dealerHand);
                this.dealerValueText.setText(String(dv));
                this.dealerValueText.setColor(dv > 21 ? '#e74c3c' : '#f0e6d3');
            } else {
                // Show only visible card's value
                const visVal = bjState.dealerHand[0] ? handValue([bjState.dealerHand[0]]) : 0;
                this.dealerValueText.setText(`${visVal} + ?`);
                this.dealerValueText.setColor('#888888');
            }
        } else {
            this.dealerValueText.setText('');
        }
    }

    private updateResultBanner(): void {
        const result: BJResult = this.bjState.result;
        if (!result) { this.resultText.setAlpha(0); return; }

        const messages: Record<NonNullable<BJResult>, [string, string]> = {
            blackjack: ['🎉 BLACKJACK! +' + Math.floor(this.bjState.bet * 1.5) + ' bonus', '#ffd700'],
            win:       ['✓ YOU WIN!',   '#2ecc71'],
            push:      ['➤ PUSH',       '#aaaaaa'],
            lose:      ['✗ DEALER WINS', '#e74c3c'],
            bust:      ['✗ BUST!',       '#e74c3c'],
        };

        const [msg, col] = messages[result];
        this.resultText.setText(msg).setColor(col).setAlpha(1);

        this.scene.tweens.add({
            targets: this.resultText,
            scaleX: [1.2, 1],
            scaleY: [1.2, 1],
            duration: 300,
            ease: 'Back.Out',
        });
    }

    private updateStats(): void {
        const s = this.bjState;
        if (s.handsPlayed === 0) {
            this.statsText.setText('ESC to close  ·  Select bet and press DEAL');
        } else {
            this.statsText.setText(
                `Hands: ${s.handsPlayed}  ·  Wins: ${s.sessionWins}  ·  Losses: ${s.sessionLosses}  ·  Pushes: ${s.sessionPushes}`
            );
        }
    }

    // ── Button factory ────────────────────────────────────────────────────────

    private makeButton(
        x: number, y: number, w: number, h: number,
        label: string, color: number,
        onClick: () => void,
    ): Phaser.GameObjects.Container {
        const btn = this.scene.add.container(x, y);

        const bg = this.scene.add.rectangle(0, 0, w, h, color, 1)
            .setStrokeStyle(1, COL_TRIM_DIM, 0.8)
            .setInteractive({ useHandCursor: true });

        const txt = this.scene.add.text(0, 0, label, {
            fontFamily: FONT, fontSize: '11px', color: '#f0e6d3',
        }).setOrigin(0.5);

        bg.on('pointerover',  () => bg.setFillStyle(lighten(color)));
        bg.on('pointerout',   () => bg.setFillStyle(color));
        bg.on('pointerdown',  onClick);

        btn.add([bg, txt]);
        return btn;
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    close(): void {
        if (this.closed) return;
        this.closed = true;

        // If bet was deducted but result not resolved, refund it
        if (this.betDeducted && this.bjState.result === null) {
            GameState.addChips(this.bjState.bet);
        }

        this.scene.input.keyboard!.removeKey(this.escKey);
        this.overlay.destroy();
        this.container.destroy(true);
        this.onClose();
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lighten(hex: number): number {
    const r = Math.min(255, ((hex >> 16) & 0xff) + 40);
    const g = Math.min(255, ((hex >>  8) & 0xff) + 40);
    const b = Math.min(255, ( hex        & 0xff) + 40);
    return (r << 16) | (g << 8) | b;
}
