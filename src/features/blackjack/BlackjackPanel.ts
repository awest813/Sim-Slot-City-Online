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

    // Persistent text nodes
    private dealerValueText!: Phaser.GameObjects.Text;
    private playerValueText!: Phaser.GameObjects.Text;
    private chipsText!:       Phaser.GameObjects.Text;
    private betText!:         Phaser.GameObjects.Text;
    private resultText!:      Phaser.GameObjects.Text;
    private statsText!:       Phaser.GameObjects.Text;

    // Button groups (shown/hidden per phase)
    private betBtns:    Phaser.GameObjects.Container[] = [];
    private actionBtns: Phaser.GameObjects.Container[] = [];
    private doubleBtn:  Phaser.GameObjects.Container | null = null;
    private newHandBtn: Phaser.GameObjects.Container | null = null;
    private freeBtn:    Phaser.GameObjects.Container | null = null;

    // State
    private bjState!:     BlackjackState;
    private currentBet:   number  = 25;
    private closed:       boolean = false;
    private betDeducted:  boolean = false;

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

        // ── Result text ────────────────────────────────────────────────────
        this.resultText = this.scene.add.text(0, -4, '', {
            fontFamily: FONT, fontSize: '22px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(this.resultText);

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

    // ── Action buttons (Hit / Stand / Double) ─────────────────────────────────

    private buildActionButtons(): void {
        const ay = PH / 2 - 100;
        const hitBtn   = this.makeButton(-PW / 2 + 90,  ay, 90, 28, 'HIT  [H]',    COL_BTN_PRIMARY, () => this.doHit());
        const standBtn = this.makeButton(-PW / 2 + 194, ay, 90, 28, 'STAND [S]',   COL_BTN_BLUE,    () => this.doStand());
        this.doubleBtn = this.makeButton(-PW / 2 + 298, ay, 116, 28, 'DOUBLE DOWN', 0x3a3a14,        () => this.doDouble());
        this.actionBtns.push(hitBtn, standBtn, this.doubleBtn);

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
        if (this.bjState.bet > chips) {
            this.statsText.setText('Not enough chips to double down!').setColor('#e74c3c');
            this.scene.time.delayedCall(1200, () => this.updateStats());
            return;
        }
        GameState.addChips(-this.bjState.bet);
        this.bjState = doubleDown(this.bjState);
        this.refreshDisplay();
        this.resolveResult();
    }

    private resolveResult(): void {
        const delta = chipDelta(this.bjState);
        if (delta > 0) GameState.addChips(delta);
        this.betDeducted = false;
        this.showResultUI();
        this.refreshDisplay();
    }

    private prepareNextHand(): void {
        if (this.newHandBtn) { this.newHandBtn.destroy(); this.newHandBtn = null; }
        if (this.freeBtn)    { this.freeBtn.destroy();    this.freeBtn    = null; }
        this.bjState    = nextHand(this.bjState);
        this.betDeducted = false;
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
            const hidden = i === 1 && !this.bjState.dealerRevealed;
            this.dealerCardObjs.push(...this.renderCard(startX + i * 46, baseY, hand[i], hidden));
        }
    }

    private renderPlayerCards(): void {
        for (const obj of this.playerCardObjs) obj.destroy();
        this.playerCardObjs = [];
        const hand = this.bjState.playerHand;
        if (hand.length === 0) return;
        const startX = -((hand.length - 1) * 46) / 2;
        const baseY  = 78;
        for (let i = 0; i < hand.length; i++) {
            this.playerCardObjs.push(...this.renderCard(startX + i * 46, baseY, hand[i], false));
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
            const pv = handValue(bjState.playerHand);
            const bj = isBlackjack(bjState.playerHand);
            this.playerValueText.setText(bj ? 'BLACKJACK!' : String(pv));
            this.playerValueText.setColor(pv > 21 ? '#e74c3c' : bj ? '#ffd700' : '#ede0cc');
        } else {
            this.playerValueText.setText('');
        }
        if (bjState.dealerHand.length > 0) {
            if (bjState.dealerRevealed) {
                const dv = handValue(bjState.dealerHand);
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
        if (!result) { this.resultText.setAlpha(0); return; }

        const bonus = Math.floor(this.bjState.bet * 1.5);
        const messages: Record<NonNullable<BJResult>, [string, string]> = {
            blackjack: [`🎉 BLACKJACK! +${bonus} bonus`, '#ffd700'],
            win:       ['✓  YOU WIN!',    '#2ecc71'],
            push:      ['➤  PUSH',        '#aaaaaa'],
            lose:      ['✗  DEALER WINS', '#e74c3c'],
            bust:      ['✗  BUST!',       '#e74c3c'],
        };
        const [msg, col] = messages[result];
        this.resultText.setText(msg).setColor(col).setAlpha(1);
        this.scene.tweens.add({
            targets: this.resultText, scaleX: [1.2, 1], scaleY: [1.2, 1], duration: 280, ease: 'Back.Out',
        });
    }

    private updateStats(): void {
        const s = this.bjState;
        if (s.handsPlayed === 0) {
            this.statsText.setText('ESC close  ·  Select bet and press DEAL or SPACE  ·  H=Hit  S=Stand');
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
        // Refund if closed mid-hand before result
        if (this.betDeducted && this.bjState.result === null) {
            GameState.addChips(this.bjState.bet);
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
