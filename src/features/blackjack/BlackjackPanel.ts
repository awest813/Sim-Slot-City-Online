// ── Blackjack Panel — playable blackjack minigame ────────────────────────────
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_FELT, COL_TRIM, COL_TRIM_DIM,
    COL_BTN_PRIMARY, COL_BTN_BLUE,
    COL_BTN_DANGER,
    COL_UI_BG, COL_UI_BG2, COL_UI_BG3, COL_UI_BORDER_DIM,
    FONT, PANEL_RADIUS, ANIM_MED,
    TEXT_MD, TEXT_GOLD, TEXT_GOLD_LG,
} from '../../game/constants';
import {
    BlackjackState, BJResult,
    createGame, deal, hit, stand, doubleDown, nextHand,
    split, canSplit, takeInsurance, declineInsurance, isSoftHand,
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
    private panelGfx!:   Phaser.GameObjects.Graphics;
    private container!:  Phaser.GameObjects.Container;
    private escKey!:     Phaser.Input.Keyboard.Key;
    private spaceKey!:   Phaser.Input.Keyboard.Key;
    private hKey!:       Phaser.Input.Keyboard.Key;
    private sKey!:       Phaser.Input.Keyboard.Key;

    // Dynamic card display groups (rebuilt each hand)
    private dealerCardObjs: Phaser.GameObjects.GameObject[] = [];
    private playerCardObjs: Phaser.GameObjects.GameObject[] = [];
    private splitCardObjs:  Phaser.GameObjects.GameObject[] = [];

    // Persistent text nodes
    private dealerValueText!: Phaser.GameObjects.Text;
    private playerValueText!: Phaser.GameObjects.Text;
    private splitValueText!:  Phaser.GameObjects.Text;
    private chipsText!:       Phaser.GameObjects.Text;
    private betText!:         Phaser.GameObjects.Text;
    private resultText!:      Phaser.GameObjects.Text;
    private splitResultText!: Phaser.GameObjects.Text;
    private statsText!:       Phaser.GameObjects.Text;

    // Button groups (shown/hidden per phase)
    private betBtns:      Phaser.GameObjects.Container[] = [];
    private actionBtns:   Phaser.GameObjects.Container[] = [];
    private doubleBtn:    Phaser.GameObjects.Container | null = null;
    private splitBtn:     Phaser.GameObjects.Container | null = null;
    private newHandBtn:   Phaser.GameObjects.Container | null = null;
    private freeBtn:      Phaser.GameObjects.Container | null = null;
    private insuranceUI:  Phaser.GameObjects.Container | null = null;

    // State
    private bjState!:        BlackjackState;
    private currentBet:      number  = 25;
    private closed:          boolean = false;
    private betDeducted:     boolean = false;
    private splitDeducted:   boolean = false;  // tracks if split bet was taken

    // Dealer animation — controls step-by-step card reveal
    private dealerRevealCount: number = Infinity;  // Infinity = show all (normal)
    private dealerAnimTimers:  Phaser.Time.TimerEvent[] = [];

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
        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();
        this.scene.tweens.add({ targets: this.overlay, fillAlpha: 0.78, duration: ANIM_MED });

        // Panel background
        this.panelGfx = this.scene.add.graphics()
            .setScrollFactor(0).setDepth(DEPTH_PANEL);
        this.drawPanelBg();

        // Content container with entrance animation
        this.container = this.scene.add.container(cx, cy)
            .setScrollFactor(0).setDepth(DEPTH_PANEL + 1);
        this.container.setAlpha(0).setScale(0.93);
        this.scene.tweens.add({
            targets: this.container, alpha: 1, scaleX: 1, scaleY: 1,
            duration: ANIM_MED, ease: 'Back.Out',
        });

        // Title
        const title = this.scene.add.text(0, -PH / 2 + 26, '🃏  BLACKJACK', {
            fontFamily: FONT, fontSize: '20px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        // Close button
        this.buildCloseButton();

        // ── Felt table surface ─────────────────────────────────────────────
        const feltGfx = this.scene.add.graphics();
        feltGfx.fillStyle(COL_FELT, 1);
        feltGfx.fillRoundedRect(-PW / 2 + 16, -PH / 2 + 58, PW - 32, PH - 150, 6);
        feltGfx.lineStyle(1.5, 0x2a6a2a, 0.7);
        feltGfx.strokeRoundedRect(-PW / 2 + 16, -PH / 2 + 58, PW - 32, PH - 150, 6);
        feltGfx.lineStyle(1, 0x1a4a1a, 0.5);
        feltGfx.strokeRoundedRect(-PW / 2 + 22, -PH / 2 + 64, PW - 44, PH - 162, 4);
        this.container.add(feltGfx);

        // ── Dealer section ─────────────────────────────────────────────────
        const dealerLabel = this.scene.add.text(-PW / 2 + 24, -PH / 2 + 74, 'DEALER', {
            ...TEXT_GOLD, fontSize: '10px', fontStyle: 'bold', letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this.container.add(dealerLabel);

        this.dealerValueText = this.scene.add.text(PW / 2 - 24, -PH / 2 + 74, '', {
            ...TEXT_MD, fontSize: '13px',
        }).setOrigin(1, 0.5);
        this.container.add(this.dealerValueText);

        // ── Player section ─────────────────────────────────────────────────
        const playerLabel = this.scene.add.text(-PW / 2 + 24, 36, 'YOUR HAND', {
            ...TEXT_GOLD, fontSize: '10px', fontStyle: 'bold', letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this.container.add(playerLabel);

        this.playerValueText = this.scene.add.text(PW / 2 - 24, 36, '', {
            ...TEXT_MD, fontSize: '13px',
        }).setOrigin(1, 0.5);
        this.container.add(this.playerValueText);

        // Split hand value text (hidden until split occurs)
        this.splitValueText = this.scene.add.text(0, 36, '', {
            ...TEXT_MD, fontSize: '13px',
        }).setOrigin(0.5, 0.5).setAlpha(0);
        this.container.add(this.splitValueText);

        // ── Result text ────────────────────────────────────────────────────
        this.resultText = this.scene.add.text(0, -4, '', {
            fontFamily: FONT, fontSize: '22px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(this.resultText);

        // Split result text (appears right of center when split is active)
        this.splitResultText = this.scene.add.text(0, -4, '', {
            fontFamily: FONT, fontSize: '16px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(this.splitResultText);

        // ── Bottom bar ─────────────────────────────────────────────────────
        const barGfx = this.scene.add.graphics();
        barGfx.fillStyle(COL_UI_BG2, 1);
        barGfx.fillRoundedRect(-PW / 2 + 16, PH / 2 - 92, PW - 32, 76,
            { tl: 0, tr: 0, bl: PANEL_RADIUS - 2, br: PANEL_RADIUS - 2 });
        barGfx.lineStyle(1, COL_UI_BORDER_DIM, 0.4);
        barGfx.lineBetween(-PW / 2 + 16, PH / 2 - 92, PW / 2 - 16, PH / 2 - 92);
        this.container.add(barGfx);

        this.chipsText = this.scene.add.text(-PW / 2 + 26, PH / 2 - 68, '', {
            ...TEXT_GOLD_LG,
        }).setOrigin(0, 0.5);
        this.container.add(this.chipsText);

        this.betText = this.scene.add.text(PW / 2 - 26, PH / 2 - 68, '', {
            ...TEXT_MD,
        }).setOrigin(1, 0.5);
        this.container.add(this.betText);

        // ── Stats text ─────────────────────────────────────────────────────
        this.statsText = this.scene.add.text(0, PH / 2 - 28, '', {
            fontFamily: FONT, fontSize: '9px', color: '#3a5a4a',
        }).setOrigin(0.5);
        this.container.add(this.statsText);

        // ── Bet + action UI ────────────────────────────────────────────────
        this.buildBetUI();
        this.buildActionButtons();

        // ── Keyboard shortcuts ─────────────────────────────────────────────
        this.escKey   = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.spaceKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.hKey     = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
        this.sKey     = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);

        this.escKey.on('down',   () => this.close());
        this.spaceKey.on('down', () => { if (this.bjState.phase === 'betting') this.startHand(); });
        this.hKey.on('down',     () => { if (this.bjState.phase === 'playing') this.doHit(); });
        this.sKey.on('down',     () => { if (this.bjState.phase === 'playing') this.doStand(); });
        this.showPhaseUI();
        this.refreshDisplay();
    }

    // ── Panel background ──────────────────────────────────────────────────────

    private drawPanelBg(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const px = cx - PW / 2;
        const py = cy - PH / 2;
        const g  = this.panelGfx;
        g.clear();

        g.fillStyle(0x000000, 0.55);
        g.fillRoundedRect(px + 5, py + 6, PW, PH, PANEL_RADIUS + 2);
        g.fillStyle(COL_UI_BG, 1);
        g.fillRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        g.fillStyle(COL_UI_BG2, 1);
        g.fillRoundedRect(px, py, PW, 52, { tl: PANEL_RADIUS, tr: PANEL_RADIUS, bl: 0, br: 0 });
        g.lineStyle(2, COL_TRIM, 0.85);
        g.strokeRoundedRect(px, py, PW, PH, PANEL_RADIUS);
        g.lineStyle(1, COL_TRIM_DIM, 0.2);
        g.strokeRoundedRect(px + 3, py + 3, PW - 6, PH - 6, PANEL_RADIUS - 1);
        g.lineStyle(1.5, COL_TRIM, 0.5);
        g.lineBetween(px + 16, py + 52, px + PW - 16, py + 52);
    }

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

    // ── Bet selection UI ──────────────────────────────────────────────────────

    private buildBetUI(): void {
        const by = PH / 2 - 100;

        const label = this.scene.add.text(-PW / 2 + 26, by, 'PLACE BET:', {
            ...TEXT_GOLD, fontSize: '10px', fontStyle: 'bold', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        label.setData('betUI', true);
        this.container.add(label);

        let btnX = -PW / 2 + 132;
        for (const amt of BET_OPTIONS) {
            const btn = this.makeButton(btnX, by, 62, 28, `◈${amt}`,
                this.currentBet === amt ? COL_BTN_PRIMARY : COL_UI_BG3,
                () => this.selectBet(amt));
            btn.setData('betUIBtn', amt);
            this.betBtns.push(btn);
            this.container.add(btn);
            btnX += 70;
        }

        const dealBtnX = PW / 2 - 84;
        const dealBtn  = this.makeButton(dealBtnX, by, 108, 28, 'DEAL ▶', COL_BTN_PRIMARY, () => this.startHand());
        dealBtn.setData('betUIDeal', true);
        this.betBtns.push(dealBtn);
        this.container.add(dealBtn);
    }

    private selectBet(amt: number): void {
        if (this.bjState.phase !== 'betting') return;
        const chips = GameState.get().chips;
        if (amt > chips) return;
        this.currentBet = amt;
        // Redraw bet button highlights
        this.betBtns.forEach(b => {
            const isThis = b.getData('betUIBtn') === amt;
            const gfx = b.getAt(0) as Phaser.GameObjects.Graphics;
            if (!gfx || !gfx.clear) return;
            const w = 62; const h = 28; const r = 4;
            gfx.clear();
            gfx.fillStyle(isThis ? COL_BTN_PRIMARY : COL_UI_BG3, 1);
            gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
            gfx.lineStyle(1, COL_UI_BORDER_DIM, 0.65);
            gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
        });
        this.refreshDisplay();
    }

    // ── Action buttons (Hit / Stand / Double / Split) ─────────────────────────

    private buildActionButtons(): void {
        const ay = PH / 2 - 100;
        const hitBtn   = this.makeButton(-PW / 2 + 90,  ay, 90, 28, 'HIT  [H]',    COL_BTN_PRIMARY, () => this.doHit());
        const standBtn = this.makeButton(-PW / 2 + 194, ay, 90, 28, 'STAND [S]',   COL_BTN_BLUE,    () => this.doStand());
        this.doubleBtn = this.makeButton(-PW / 2 + 298, ay, 116, 28, 'DOUBLE DOWN', 0x3a3a14,        () => this.doDouble());
        this.splitBtn  = this.makeButton(-PW / 2 + 428, ay, 90,  28, 'SPLIT ✂',     0x2a1050,        () => this.doSplit());
        this.actionBtns.push(hitBtn, standBtn, this.doubleBtn, this.splitBtn);

        for (const b of this.actionBtns) {
            b.setVisible(false);
            this.container.add(b);
        }
    }

    // ── New-hand button ───────────────────────────────────────────────────────

    private buildNewHandButton(): void {
        if (this.newHandBtn) { this.newHandBtn.destroy(); this.newHandBtn = null; }
        const chips   = GameState.get().chips;
        const canPlay = chips > 0;
        const lbl     = canPlay ? 'NEXT HAND ▶' : 'CLOSE TABLE';
        const col     = canPlay ? COL_BTN_PRIMARY : COL_BTN_DANGER;
        this.newHandBtn = this.makeButton(-PW / 2 + 112, PH / 2 - 100, 156, 28, lbl, col,
            () => GameState.get().chips > 0 ? this.prepareNextHand() : this.close());
        this.container.add(this.newHandBtn);
    }

    // ── Hand lifecycle ────────────────────────────────────────────────────────

    private startHand(): void {
        if (this.bjState.phase !== 'betting') return;
        const chips = GameState.get().chips;
        if (this.currentBet > chips) {
            const max = BET_OPTIONS.slice().reverse().find(o => o <= chips);
            if (!max) { this.offerFreeChips(); return; }
            this.currentBet = max;
        }
        GameState.addChips(-this.currentBet);
        this.betDeducted = true;
        this.bjState = deal(this.bjState, this.currentBet);
        this.showPhaseUI();
        this.refreshDisplay();
        if (this.bjState.phase === 'result') this.resolveResult();
    }

    private doHit(): void {
        if (this.bjState.phase !== 'playing') return;
        this.bjState = hit(this.bjState);
        this.showPhaseUI();
        this.refreshDisplay();
        if (this.bjState.phase === 'result') {
            // If player busted with no split, dealer didn't play — resolve immediately.
            // If dealer played (e.g. split-hand bust triggered dealer), animate reveal.
            const purePlayerBust = this.bjState.result === 'bust' && this.bjState.splitHand === null;
            if (purePlayerBust) {
                this.resolveResult();
            } else {
                this.animateDealerReveal();
            }
        }
    }

    private doStand(): void {
        if (this.bjState.phase !== 'playing') return;
        this.bjState = stand(this.bjState);
        // After stand on main hand with split, still in 'playing' (switched to split)
        if (this.bjState.phase === 'playing') {
            this.showPhaseUI();
            this.refreshDisplay();
        } else {
            this.showPhaseUI();  // hide action buttons before animation
            this.animateDealerReveal();
        }
    }

    private doDouble(): void {
        if (this.bjState.phase !== 'playing') return;
        const chips = GameState.get().chips;
        if (this.bjState.bet > chips) {
            this.statsText.setText('Not enough chips to double down!').setColor('#e74c3c');
            this.scene.time.delayedCall(1200, () => this.updateStats());
            return;
        }
        GameState.addChips(-this.bjState.bet);
        this.bjState = doubleDown(this.bjState);
        // If player busted on double, no dealer animation needed
        if (this.bjState.result === 'bust') {
            this.refreshDisplay();
            this.resolveResult();
        } else {
            this.showPhaseUI();
            this.animateDealerReveal();
        }
    }

    private doSplit(): void {
        if (!canSplit(this.bjState)) return;
        const chips = GameState.get().chips;
        if (chips < this.bjState.bet) {
            this.statsText.setText('Not enough chips to split!').setColor('#e74c3c');
            this.scene.time.delayedCall(1200, () => this.updateStats());
            return;
        }
        GameState.addChips(-this.bjState.bet);   // deduct split bet
        this.splitDeducted = true;
        this.bjState = split(this.bjState);
        this.showPhaseUI();
        this.refreshDisplay();
    }

    private doTakeInsurance(): void {
        if (this.bjState.phase !== 'insurance') return;
        const insuranceBet = Math.floor(this.bjState.bet / 2);
        const chips = GameState.get().chips;
        if (insuranceBet > chips) {
            this.dismissInsuranceUI();
            this.bjState = declineInsurance(this.bjState);
            this.showPhaseUI();
            return;
        }
        GameState.addChips(-insuranceBet);
        this.bjState = takeInsurance(this.bjState, insuranceBet);
        this.dismissInsuranceUI();
        this.showPhaseUI();
        this.refreshDisplay();
        if (this.bjState.phase === 'result') this.resolveResult();
    }

    private doDeclineInsurance(): void {
        if (this.bjState.phase !== 'insurance') return;
        this.bjState = declineInsurance(this.bjState);
        this.dismissInsuranceUI();
        this.showPhaseUI();
        this.refreshDisplay();
    }

    private dismissInsuranceUI(): void {
        if (this.insuranceUI) {
            this.insuranceUI.destroy();
            this.insuranceUI = null;
        }
    }

    private resolveResult(): void {
        const delta = chipDelta(this.bjState);
        // Show floating net chip change
        const totalDeducted = this.bjState.bet
            + (this.bjState.splitHand !== null ? this.bjState.splitBet : 0)
            + this.bjState.insuranceBet;
        const net = delta - totalDeducted;
        if (net !== 0) {
            const dText = net > 0 ? `+${net}◈` : `${net}◈`;
            this.showChipDelta(dText, net > 0 ? '#2ecc71' : '#e74c3c');
        }
        if (delta > 0) GameState.addChips(delta);
        this.betDeducted  = false;
        this.splitDeducted = false;
        this.showResultUI();
        this.refreshDisplay();
    }

    /**
     * Reveal the dealer's cards one by one with a short delay between each,
     * then apply the chip result. Triggered after stand / double-down.
     */
    private animateDealerReveal(): void {
        if (this.closed) return;
        const dealerHand = this.bjState.dealerHand;

        // Start by showing only the first card (hole card hidden)
        this.dealerRevealCount = 1;
        this.renderDealerCards();
        this.updateHandValues();

        let step = 2;  // next reveal target: card index < step is shown

        const doStep = (): void => {
            if (this.closed) return;
            this.dealerRevealCount = step;
            this.renderDealerCards();
            this.updateHandValues();

            // Brief pop animation on newly revealed card
            const cardObj = this.dealerCardObjs[this.dealerCardObjs.length - 1];
            if (cardObj) {
                this.scene.tweens.add({
                    targets: cardObj, scaleX: [1.1, 1], scaleY: [1.1, 1],
                    duration: 140, ease: 'Back.Out',
                });
            }

            if (step < dealerHand.length) {
                // More cards to reveal
                step++;
                const t = this.scene.time.delayedCall(560, doStep);
                this.dealerAnimTimers.push(t);
            } else {
                // All revealed — show dealer status then resolve
                const dv = handValue(dealerHand);
                let msg = '';
                if (dv > 21)                                msg = `Dealer busts with ${dv}!`;
                else if (isBlackjack(dealerHand))           msg = 'Dealer Blackjack!';
                else                                        msg = `Dealer stands on ${dv}`;
                this.statsText.setText(msg).setColor('#c9a84c');

                const t = this.scene.time.delayedCall(420, () => {
                    if (this.closed) return;
                    this.dealerRevealCount = Infinity;
                    this.resolveResult();
                });
                this.dealerAnimTimers.push(t);
            }
        };

        // Pause briefly then start revealing the hole card
        const t = this.scene.time.delayedCall(380, doStep);
        this.dealerAnimTimers.push(t);
    }

    /** Floating chip gain / loss indicator near the result area. */
    private showChipDelta(text: string, color: string): void {
        const delta = this.scene.add.text(0, -4, text, {
            fontFamily: FONT, fontSize: '22px', color, fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_PANEL + 5);
        this.container.add(delta);
        this.scene.tweens.add({
            targets: delta, y: delta.y - 52, alpha: 0,
            duration: 1100, ease: 'Quad.easeOut',
            onComplete: () => delta.destroy(),
        });
    }

    private prepareNextHand(): void {
        if (this.newHandBtn) { this.newHandBtn.destroy(); this.newHandBtn = null; }
        if (this.freeBtn)    { this.freeBtn.destroy();    this.freeBtn    = null; }
        this.bjState     = nextHand(this.bjState);
        this.betDeducted  = false;
        this.splitDeducted = false;
        // Clear split card display
        for (const obj of this.splitCardObjs) obj.destroy();
        this.splitCardObjs = [];
        this.splitValueText.setAlpha(0);
        this.splitResultText.setAlpha(0);
        this.showPhaseUI();
        this.refreshDisplay();
    }

    private offerFreeChips(): void {
        if (this.freeBtn) return;
        const FREE_AMOUNT = 500;
        this.freeBtn = this.makeButton(
            PW / 2 - 110, PH / 2 - 100, 168, 28,
            `🎁 FREE ${FREE_AMOUNT} CHIPS`, 0x142008,
            () => {
                GameState.addChips(FREE_AMOUNT);
                if (this.freeBtn) { this.freeBtn.destroy(); this.freeBtn = null; }
                this.currentBet = BET_OPTIONS[0];
                this.refreshDisplay();
            },
        );
        this.container.add(this.freeBtn);
        this.refreshDisplay();
    }

    // ── Phase UI visibility ───────────────────────────────────────────────────

    private showPhaseUI(): void {
        const phase   = this.bjState.phase;
        const betting = phase === 'betting';
        const playing = phase === 'playing';

        this.betBtns.forEach(b => b.setVisible(betting));
        for (const b of this.actionBtns) b.setVisible(playing);

        if (this.doubleBtn) {
            const canDouble = playing
                && this.bjState.playerHand.length === 2
                && this.bjState.splitHand === null   // no double after split
                && GameState.get().chips >= this.bjState.bet;
            this.doubleBtn.setVisible(canDouble);
        }

        if (this.splitBtn) {
            this.splitBtn.setVisible(playing && canSplit(this.bjState));
        }

        // Show insurance prompt when dealer shows Ace
        if (phase === 'insurance') {
            this.betBtns.forEach(b => b.setVisible(false));
            for (const b of this.actionBtns) b.setVisible(false);
            this.buildInsuranceUI();
        } else {
            this.dismissInsuranceUI();
        }
    }

    private showResultUI(): void {
        this.betBtns.forEach(b => b.setVisible(false));
        for (const b of this.actionBtns) b.setVisible(false);
        this.buildNewHandButton();
    }

    // ── Insurance overlay ─────────────────────────────────────────────────────

    private buildInsuranceUI(): void {
        if (this.insuranceUI) return;

        const insuranceCost = Math.floor(this.bjState.bet / 2);
        const canAfford     = GameState.get().chips >= insuranceCost;

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x0a0a20, 0.92);
        bg.fillRoundedRect(-200, -30, 400, 90, 6);
        bg.lineStyle(1.5, 0xc9a84c, 0.7);
        bg.strokeRoundedRect(-200, -30, 400, 90, 6);

        const prompt = this.scene.add.text(0, -12, '🎴  Dealer shows Ace — Take Insurance?', {
            fontFamily: FONT, fontSize: '11px', color: '#c9a84c',
        }).setOrigin(0.5);

        const costStr = canAfford
            ? `Cost: ◈ ${insuranceCost}  (pays 2:1 if dealer has Blackjack)`
            : 'Not enough chips for insurance';
        const costLbl = this.scene.add.text(0, 6, costStr, {
            fontFamily: FONT, fontSize: '9px', color: canAfford ? '#8a9aaa' : '#aa4040',
        }).setOrigin(0.5);

        // YES button: only interactive when player can afford insurance
        const yesBtn = canAfford
            ? this.makeButton(-60, 36, 88, 26, 'YES  (Y)', COL_BTN_PRIMARY, () => this.doTakeInsurance())
            : this.makeButton(-60, 36, 88, 26, 'YES  (Y)', 0x1a1a1a, () => { /* cannot afford */ });
        if (!canAfford) {
            // Remove interactivity from the disabled YES button
            const hitRect = yesBtn.getAt(1) as Phaser.GameObjects.Rectangle;
            hitRect?.disableInteractive();
            yesBtn.setAlpha(0.4);
        }
        const noBtn = this.makeButton(60, 36, 88, 26, 'NO   (N)', COL_BTN_DANGER, () => this.doDeclineInsurance());

        this.insuranceUI = this.scene.add.container(0, PH / 2 - 145, [bg, prompt, costLbl, yesBtn, noBtn]);
        this.container.add(this.insuranceUI);
    }

    // ── Display refresh ───────────────────────────────────────────────────────

    private refreshDisplay(): void {
        this.updateChipBet();
        this.renderDealerCards();
        this.renderPlayerCards();
        this.renderSplitCards();
        this.updateHandValues();
        this.updateResultBanner();
        this.updateStats();
    }

    private updateChipBet(): void {
        const chips = GameState.get().chips;
        this.chipsText.setText(`◈ ${chips.toLocaleString()}`);
        this.betText.setText(
            this.bjState.phase === 'betting'
                ? `Bet: ◈ ${this.currentBet}`
                : `Bet: ◈ ${this.bjState.bet}`,
        );
    }

    private renderDealerCards(): void {
        for (const obj of this.dealerCardObjs) obj.destroy();
        this.dealerCardObjs = [];
        const hand = this.bjState.dealerHand;
        if (hand.length === 0) return;
        const startX = -((hand.length - 1) * 46) / 2;
        const baseY  = -PH / 2 + 110;
        for (let i = 0; i < hand.length; i++) {
            // During animation: hide cards at or beyond the reveal count.
            // Outside animation: use engine's dealerRevealed flag (hole card hidden).
            const hidden = this.dealerRevealCount < Infinity
                ? i >= this.dealerRevealCount
                : (i === 1 && !this.bjState.dealerRevealed);
            this.dealerCardObjs.push(...this.renderCard(startX + i * 46, baseY, hand[i], hidden));
        }
    }

    private renderPlayerCards(): void {
        for (const obj of this.playerCardObjs) obj.destroy();
        this.playerCardObjs = [];
        const hand = this.bjState.playerHand;
        if (hand.length === 0) return;

        // When split is active, offset main hand to the left
        const hasSplit = this.bjState.splitHand !== null;
        const centerX  = hasSplit ? -90 : 0;
        const startX   = centerX - ((hand.length - 1) * 46) / 2;
        const baseY    = 78;

        // Active-hand highlight ring
        if (hasSplit) {
            const isActive = this.bjState.activeHand === 'main' && this.bjState.phase === 'playing';
            const gfx = this.scene.add.graphics();
            gfx.lineStyle(2, isActive ? 0xffd700 : 0x445566, isActive ? 0.9 : 0.3);
            gfx.strokeRoundedRect(centerX - 56, baseY - 42, 112, 68, 4);
            this.container.add(gfx);
            this.playerCardObjs.push(gfx);
            if (isActive) {
                const lbl = this.scene.add.text(centerX, baseY - 52, '▸ MAIN', {
                    fontFamily: FONT, fontSize: '9px', color: '#ffd700',
                }).setOrigin(0.5);
                this.container.add(lbl);
                this.playerCardObjs.push(lbl);
            }
        }

        for (let i = 0; i < hand.length; i++) {
            this.playerCardObjs.push(...this.renderCard(startX + i * 46, baseY, hand[i], false));
        }
    }

    private renderSplitCards(): void {
        for (const obj of this.splitCardObjs) obj.destroy();
        this.splitCardObjs = [];
        const hand = this.bjState.splitHand;
        if (!hand || hand.length === 0) {
            this.splitValueText.setAlpha(0);
            this.splitResultText.setAlpha(0);
            return;
        }

        const centerX = 90;
        const startX  = centerX - ((hand.length - 1) * 46) / 2;
        const baseY   = 78;

        // Active-hand highlight ring
        const isActive = this.bjState.activeHand === 'split' && this.bjState.phase === 'playing';
        const gfx = this.scene.add.graphics();
        gfx.lineStyle(2, isActive ? 0xffd700 : 0x445566, isActive ? 0.9 : 0.3);
        gfx.strokeRoundedRect(centerX - 56, baseY - 42, 112, 68, 4);
        this.container.add(gfx);
        this.splitCardObjs.push(gfx);
        if (isActive) {
            const lbl = this.scene.add.text(centerX, baseY - 52, '▸ SPLIT', {
                fontFamily: FONT, fontSize: '9px', color: '#ffd700',
            }).setOrigin(0.5);
            this.container.add(lbl);
            this.splitCardObjs.push(lbl);
        }

        for (let i = 0; i < hand.length; i++) {
            this.splitCardObjs.push(...this.renderCard(startX + i * 46, baseY, hand[i], false));
        }
    }

    private renderCard(
        x: number, y: number, card: Card, hidden: boolean,
    ): Phaser.GameObjects.GameObject[] {
        const w = 40;
        const h = 58;

        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.4);
        shadow.fillRoundedRect(x - w / 2 + 2, y - h / 2 + 3, w, h, 3);
        this.container.add(shadow);

        const bg = this.scene.add.graphics();
        if (hidden) {
            bg.fillStyle(0x1a2050, 1);
            bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 3);
            bg.lineStyle(1.5, 0x4060c0, 0.8);
            bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 3);
            bg.lineStyle(1, 0x304080, 0.5);
            bg.strokeRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 2);
            const pat = this.scene.add.text(x, y, '?', {
                fontFamily: FONT, fontSize: '22px', color: '#3050c0',
            }).setOrigin(0.5);
            this.container.add(bg);
            this.container.add(pat);
            return [shadow, bg, pat];
        }

        const red = isRed(card);
        bg.fillStyle(red ? 0xfff0f0 : 0xf8f8f8, 1);
        bg.fillRoundedRect(x - w / 2, y - h / 2, w, h, 3);
        bg.lineStyle(1.5, red ? 0xc0a0a0 : 0xa0a0a8, 0.8);
        bg.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 3);

        const col = red ? '#c82020' : '#111118';
        const lbl = cardLabel(card);

        const topLeft = this.scene.add.text(x - w / 2 + 3, y - h / 2 + 2, lbl, {
            fontFamily: FONT, fontSize: '9px', color: col, fontStyle: 'bold',
        }).setOrigin(0, 0);
        const centerSuit = this.scene.add.text(x, y, lbl.slice(-1), {
            fontFamily: FONT, fontSize: '24px', color: col,
        }).setOrigin(0.5);
        const bottomRight = this.scene.add.text(x + w / 2 - 3, y + h / 2 - 2, lbl, {
            fontFamily: FONT, fontSize: '9px', color: col, fontStyle: 'bold',
        }).setOrigin(1, 1);

        this.container.add(bg);
        this.container.add(topLeft);
        this.container.add(centerSuit);
        this.container.add(bottomRight);

        return [shadow, bg, topLeft, centerSuit, bottomRight];
    }

    private updateHandValues(): void {
        const { bjState } = this;
        if (bjState.playerHand.length > 0) {
            const pv   = handValue(bjState.playerHand);
            const bj   = isBlackjack(bjState.playerHand);
            const soft = !bj && isSoftHand(bjState.playerHand);
            const label = bj ? 'BLACKJACK!' : soft ? `Soft ${pv}` : String(pv);
            this.playerValueText.setText(label);
            this.playerValueText.setColor(pv > 21 ? '#e74c3c' : bj ? '#ffd700' : soft ? '#80d8ff' : '#ede0cc');
            // Position: left side if split, default if no split
            this.playerValueText.setX(bjState.splitHand ? -24 : PW / 2 - 24);
            this.playerValueText.setOrigin(bjState.splitHand ? 1 : 1, 0.5);
        } else {
            this.playerValueText.setText('');
        }

        // Split hand value
        if (bjState.splitHand && bjState.splitHand.length > 0) {
            const sv   = handValue(bjState.splitHand);
            const soft = isSoftHand(bjState.splitHand);
            const label = soft ? `Soft ${sv}` : String(sv);
            this.splitValueText.setText(label);
            this.splitValueText.setX(PW / 2 - 24);
            this.splitValueText.setOrigin(1, 0.5);
            this.splitValueText.setColor(sv > 21 ? '#e74c3c' : soft ? '#80d8ff' : '#ede0cc');
            this.splitValueText.setAlpha(1);
        } else {
            this.splitValueText.setAlpha(0);
        }

        if (bjState.dealerHand.length > 0) {
            if (bjState.dealerRevealed || this.dealerRevealCount < Infinity) {
                // Show value of currently-revealed cards only
                const revealedCards = this.dealerRevealCount < Infinity
                    ? bjState.dealerHand.slice(0, this.dealerRevealCount)
                    : bjState.dealerHand;
                const dv = handValue(revealedCards);
                this.dealerValueText.setText(String(dv));
                this.dealerValueText.setColor(dv > 21 ? '#e74c3c' : '#ede0cc');
            } else {
                const visVal = bjState.dealerHand[0] ? handValue([bjState.dealerHand[0]]) : 0;
                this.dealerValueText.setText(`${visVal} + ?`);
                this.dealerValueText.setColor('#889090');
            }
        } else {
            this.dealerValueText.setText('');
        }
    }

    private updateResultBanner(): void {
        const result: BJResult = this.bjState.result;
        if (!result) {
            this.resultText.setAlpha(0);
            this.splitResultText.setAlpha(0);
            return;
        }

        const hasSplit = this.bjState.splitHand !== null;
        const bonus    = Math.floor(this.bjState.bet * 1.5);

        const messages: Record<NonNullable<BJResult>, [string, string]> = {
            blackjack: [`🎉 BLACKJACK! +${bonus}`, '#ffd700'],
            win:       ['✓  YOU WIN!',    '#2ecc71'],
            push:      ['➤  PUSH',        '#aaaaaa'],
            lose:      ['✗  DEALER WINS', '#e74c3c'],
            bust:      ['✗  BUST!',       '#e74c3c'],
        };

        const [msg, col] = messages[result];
        // When split, position main result left of center
        const rx = hasSplit ? -90 : 0;
        this.resultText.setX(rx).setOrigin(0.5).setText(msg).setColor(col).setAlpha(1);
        this.scene.tweens.add({
            targets: this.resultText, scaleX: [1.2, 1], scaleY: [1.2, 1], duration: 280, ease: 'Back.Out',
        });

        // Split hand result
        if (hasSplit && this.bjState.splitResult) {
            const [smsg, scol] = messages[this.bjState.splitResult];
            this.splitResultText.setX(90).setOrigin(0.5)
                .setText(smsg).setColor(scol).setAlpha(1);
            this.scene.tweens.add({
                targets: this.splitResultText, scaleX: [1.2, 1], scaleY: [1.2, 1], duration: 280, ease: 'Back.Out',
            });
        } else {
            this.splitResultText.setAlpha(0);
        }
    }

    private updateStats(): void {
        const s = this.bjState;
        if (s.handsPlayed === 0) {
            this.statsText.setText('ESC close  ·  Select bet and press DEAL or SPACE  ·  H=Hit  S=Stand  ·  Split pairs with ✂');
        } else if (s.phase === 'playing' && s.splitHand !== null) {
            const active = s.activeHand === 'main' ? 'MAIN' : 'SPLIT';
            this.statsText.setText(`Playing ${active} hand  ·  Hands: ${s.handsPlayed}  ·  W:${s.sessionWins}  L:${s.sessionLosses}`);
        } else {
            this.statsText.setText(
                `Hands: ${s.handsPlayed}  ·  Wins: ${s.sessionWins}  ·  Losses: ${s.sessionLosses}  ·  Pushes: ${s.sessionPushes}`,
            );
        }
    }

    // ── Button factory (rounded) ──────────────────────────────────────────────

    private makeButton(
        x: number, y: number, w: number, h: number,
        label: string, color: number,
        onClick: () => void,
    ): Phaser.GameObjects.Container {
        const r   = 4;
        const btn = this.scene.add.container(x, y);

        const gfx = this.scene.add.graphics();
        const draw = (hover: boolean): void => {
            gfx.clear();
            const fill = hover ? lighten(color) : color;
            gfx.fillStyle(0x000000, 0.3);
            gfx.fillRoundedRect(-w / 2 + 1, -h / 2 + 2, w, h, r);
            gfx.fillStyle(fill, 1);
            gfx.fillRoundedRect(-w / 2, -h / 2, w, h, r);
            gfx.fillStyle(0xffffff, 0.05);
            gfx.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 2 - 2, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
            gfx.lineStyle(1, COL_TRIM_DIM, hover ? 0.9 : 0.65);
            gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
        };
        draw(false);

        const hit = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const txt = this.scene.add.text(0, 0, label, {
            fontFamily: FONT, fontSize: '11px', color: '#ede0cc',
        }).setOrigin(0.5);

        hit.on('pointerover', () => draw(true));
        hit.on('pointerout',  () => draw(false));
        hit.on('pointerdown', onClick);

        btn.add([gfx, hit, txt]);
        return btn;
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    close(): void {
        if (this.closed) return;
        this.closed = true;

        // Cancel any pending dealer reveal timers
        this.dealerAnimTimers.forEach(t => t.remove());
        this.dealerAnimTimers = [];

        // If closed during dealer animation, the result is already computed —
        // apply chip delta now so the player doesn't lose chips they've won.
        if (this.dealerRevealCount < Infinity && this.bjState.phase === 'result') {
            const delta = chipDelta(this.bjState);
            if (delta > 0) GameState.addChips(delta);
        } else {
            // Refund if closed mid-hand before result
            if (this.betDeducted && this.bjState.result === null) {
                GameState.addChips(this.bjState.bet);
            }
            // Refund split bet if split is in progress (no final result yet)
            if (this.splitDeducted && this.bjState.phase === 'playing') {
                GameState.addChips(this.bjState.splitBet);
            }
        }

        this.escKey.destroy();
        this.spaceKey.destroy();
        this.hKey.destroy();
        this.sKey.destroy();
        this.overlay.destroy();
        this.panelGfx.destroy();
        this.container.destroy(true);
        this.onClose();
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lighten(hex: number, amount = 36): number {
    const r = Math.min(255, ((hex >> 16) & 0xff) + amount);
    const g = Math.min(255, ((hex >>  8) & 0xff) + amount);
    const b = Math.min(255, ( hex        & 0xff) + amount);
    return (r << 16) | (g << 8) | b;
}
