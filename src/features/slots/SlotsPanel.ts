// ── Playable slot machine minigame ───────────────────────────────────────────
// Three reels, configurable bet, payout table, win/loss feedback.
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_SLOT_BODY, COL_SLOT_TRIM,
} from '../../game/constants';

const SYMBOLS  = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
const WEIGHTS  = [30, 25, 20, 12, 7, 4, 2];  // weighted rarity (lower = rarer)

// Payout multipliers for matching symbols (3-of-a-kind)
const PAYOUTS: Record<string, number> = {
    '🍒': 2,
    '🍋': 3,
    '🍊': 4,
    '🍇': 6,
    '⭐': 10,
    '💎': 20,
    '7️⃣': 50,
};
// Two-of-a-kind cherry = small consolation (only when the pair IS cherries)
const CHERRY_PAIR_PAYOUT = 1;

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
    private scene: Phaser.Scene;
    private onClose: () => void;

    // Phaser objects
    private overlay!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private reelTexts: Phaser.GameObjects.Text[] = [];
    private resultText!: Phaser.GameObjects.Text;
    private chipsText!: Phaser.GameObjects.Text;
    private betText!: Phaser.GameObjects.Text;
    private statsText!: Phaser.GameObjects.Text;
    private spinBtn!: Phaser.GameObjects.Rectangle;
    private spinBtnLabel!: Phaser.GameObjects.Text;
    private betBtns: Phaser.GameObjects.Container[] = [];
    private payLine!: Phaser.GameObjects.Rectangle;

    // State
    private spinState: SpinState = 'idle';
    private currentBet: number = 25;
    private reelValues: string[] = ['🎰', '🎰', '🎰'];
    private spinTimers: Phaser.Time.TimerEvent[] = [];
    private spinDone: boolean[] = [false, false, false];

    // Session statistics
    private totalSpins: number = 0;
    private totalWon: number = 0;
    private totalWagered: number = 0;

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene = scene;
        this.onClose = onClose;
        this.build();
    }

    private build(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const pw = 520;
        const ph = 460;

        // Dimming overlay
        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();

        // Main container
        this.container = this.scene.add.container(cx, cy).setScrollFactor(0).setDepth(DEPTH_PANEL + 1);

        // Panel background
        const bg = this.scene.add.rectangle(0, 0, pw, ph, COL_SLOT_BODY, 1)
            .setStrokeStyle(3, COL_SLOT_TRIM, 1);
        this.container.add(bg);

        // Title
        const title = this.scene.add.text(0, -ph / 2 + 22, '🎰  SLOT MACHINE', {
            fontFamily: 'monospace', fontSize: '20px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        const divider = this.scene.add.rectangle(0, -ph / 2 + 40, pw - 40, 1, COL_SLOT_TRIM, 0.6);
        this.container.add(divider);

        // Chips display
        this.chipsText = this.scene.add.text(-pw / 2 + 20, -ph / 2 + 54, '', {
            fontFamily: 'monospace', fontSize: '13px', color: '#2ecc71',
        }).setOrigin(0, 0);
        this.container.add(this.chipsText);

        // Reel panel
        const reelPanelY = -30;
        const reelBg = this.scene.add.rectangle(0, reelPanelY, 340, 110, 0x080814, 1)
            .setStrokeStyle(2, COL_SLOT_TRIM, 0.8);
        this.container.add(reelBg);

        // Three reels
        const reelXs = [-110, 0, 110];
        for (let i = 0; i < 3; i++) {
            const reelFrame = this.scene.add.rectangle(reelXs[i], reelPanelY, 90, 90, 0x0d0d1e, 1)
                .setStrokeStyle(1.5, COL_SLOT_TRIM, 0.6);
            this.container.add(reelFrame);

            const reel = this.scene.add.text(reelXs[i], reelPanelY, '🎰', {
                fontFamily: 'monospace', fontSize: '42px',
            }).setOrigin(0.5);
            this.container.add(reel);
            this.reelTexts.push(reel);
        }

        // Pay line indicator
        this.payLine = this.scene.add.rectangle(0, reelPanelY, 340, 3, COL_SLOT_TRIM, 0.4);
        this.container.add(this.payLine);

        // Result text
        this.resultText = this.scene.add.text(0, reelPanelY + 72, '', {
            fontFamily: 'monospace', fontSize: '15px', color: '#c9a84c',
        }).setOrigin(0.5);
        this.container.add(this.resultText);

        // Session stats
        this.statsText = this.scene.add.text(0, reelPanelY + 91, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#888888',
        }).setOrigin(0.5);
        this.container.add(this.statsText);

        // Bet section label
        const betLabel = this.scene.add.text(-90, ph / 2 - 150, 'BET:', {
            fontFamily: 'monospace', fontSize: '11px', color: '#888888',
        }).setOrigin(0, 0.5);
        this.container.add(betLabel);

        // Max Bet shortcut button
        const maxBetRect = this.scene.add.rectangle(pw / 2 - 56, ph / 2 - 150, 72, 24, 0x1e1e3a, 1)
            .setStrokeStyle(1, 0x4444aa, 1)
            .setInteractive({ useHandCursor: true });
        const maxBetLabel = this.scene.add.text(pw / 2 - 56, ph / 2 - 150, 'MAX BET', {
            fontFamily: 'monospace', fontSize: '10px', color: '#8888cc',
        }).setOrigin(0.5);
        maxBetRect.on('pointerover', () => maxBetRect.setStrokeStyle(1, COL_SLOT_TRIM, 1));
        maxBetRect.on('pointerout',  () => maxBetRect.setStrokeStyle(1, 0x4444aa, 1));
        maxBetRect.on('pointerdown', () => {
            const chips = GameState.get().chips;
            let newBet = BET_OPTIONS[0];  // fallback to minimum option
            for (let i = BET_OPTIONS.length - 1; i >= 0; i--) {
                if (chips >= BET_OPTIONS[i]) {
                    newBet = BET_OPTIONS[i];
                    break;
                }
            }
            this.currentBet = newBet;
            this.updateBetDisplay();
        });
        this.container.add([maxBetRect, maxBetLabel]);

        // Bet amount buttons
        const betBtnXs = [-90, -30, 30, 90];
        BET_OPTIONS.forEach((amount, i) => {
            const isDefault = amount === this.currentBet;
            const rect = this.scene.add.rectangle(betBtnXs[i], ph / 2 - 130, 52, 28, isDefault ? 0x2a2a5e : 0x1a1a3e, 1)
                .setStrokeStyle(isDefault ? 2 : 1, isDefault ? COL_SLOT_TRIM : 0x444488, 1)
                .setInteractive({ useHandCursor: true });
            const label = this.scene.add.text(betBtnXs[i], ph / 2 - 130, `${amount}`, {
                fontFamily: 'monospace', fontSize: '13px', color: isDefault ? '#c9a84c' : '#8888bb',
            }).setOrigin(0.5);

            rect.on('pointerover', () => rect.setStrokeStyle(1, COL_SLOT_TRIM, 1));
            rect.on('pointerout',  () => rect.setStrokeStyle(1, this.currentBet === amount ? COL_SLOT_TRIM : 0x444488, 1));
            rect.on('pointerdown', () => {
                this.currentBet = amount;
                this.updateBetDisplay();
            });

            const btnContainer = this.scene.add.container(0, 0, [rect, label]);
            this.container.add(btnContainer);
            this.betBtns.push(btnContainer);
        });

        this.betText = this.scene.add.text(0, ph / 2 - 105, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#aaaacc',
        }).setOrigin(0.5);
        this.container.add(this.betText);

        // Spin button
        this.spinBtn = this.scene.add.rectangle(0, ph / 2 - 74, 200, 40, 0x3a2a6a, 1)
            .setStrokeStyle(2, COL_SLOT_TRIM, 1)
            .setInteractive({ useHandCursor: true });

        this.spinBtnLabel = this.scene.add.text(0, ph / 2 - 74, 'SPIN', {
            fontFamily: 'monospace', fontSize: '16px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.spinBtn.on('pointerover', () => { if (this.spinState === 'idle') this.spinBtn.setFillStyle(0x4a3a8a); });
        this.spinBtn.on('pointerout',  () => { if (this.spinState === 'idle') this.spinBtn.setFillStyle(0x3a2a6a); });
        this.spinBtn.on('pointerdown', () => {
            if (this.spinState === 'idle') this.spinBtn.setFillStyle(0x2a1a5a);
            this.spin();
        });
        this.spinBtn.on('pointerup', () => { if (this.spinState === 'idle') this.spinBtn.setFillStyle(0x4a3a8a); });

        this.container.add([this.spinBtn, this.spinBtnLabel]);

        // Payout table hint (two lines)
        const payHint1 = this.scene.add.text(0, ph / 2 - 46, '7️⃣×3=50x  💎×3=20x  ⭐×3=10x  🍇×3=6x', {
            fontFamily: 'monospace', fontSize: '10px', color: '#666688',
        }).setOrigin(0.5);
        const payHint2 = this.scene.add.text(0, ph / 2 - 32, '🍊×3=4x  🍋×3=3x  🍒×3=2x  🍒pair=1x', {
            fontFamily: 'monospace', fontSize: '10px', color: '#555566',
        }).setOrigin(0.5);
        this.container.add([payHint1, payHint2]);

        // Close button
        const closeRect = this.scene.add.rectangle(pw / 2 - 14, -ph / 2 + 14, 20, 20, 0x3a1e1e, 1)
            .setStrokeStyle(1, 0x8a3a3a, 1)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(pw / 2 - 14, -ph / 2 + 14, '✕', {
            fontFamily: 'monospace', fontSize: '12px', color: '#e05050',
        }).setOrigin(0.5);

        closeRect.on('pointerover', () => closeRect.setFillStyle(0x5a2a2a));
        closeRect.on('pointerout',  () => closeRect.setFillStyle(0x3a1e1e));
        closeRect.on('pointerdown', () => { closeRect.setFillStyle(0x2a0a0a); this.close(); });
        closeRect.on('pointerup',   () => closeRect.setFillStyle(0x5a2a2a));

        this.container.add([closeRect, closeLabel]);

        // ESC to close
        this.scene.input.keyboard!.once('keydown-ESC', () => this.close());

        this.updateChipsDisplay();
        this.updateBetDisplay();
        this.updateStatsDisplay();
    }

    private updateChipsDisplay(): void {
        this.chipsText.setText(`◈ ${GameState.get().chips.toLocaleString()} chips`);
    }

    private updateStatsDisplay(): void {
        if (this.totalSpins === 0) {
            this.statsText.setText('');
            return;
        }
        const net = this.totalWon - this.totalWagered;
        const netStr = net >= 0 ? `+${net}` : `${net}`;
        const netColor = net >= 0 ? '#2ecc71' : '#e74c3c';
        this.statsText.setText(`Spins: ${this.totalSpins}  ·  Net: ${netStr}◈`).setColor(netColor);
    }

    private updateBetDisplay(): void {
        const chips = GameState.get().chips;
        // Highlight selected bet; dim unaffordable bets
        BET_OPTIONS.forEach((amount, i) => {
            const btn = this.betBtns[i];
            const rect = btn.list[0] as Phaser.GameObjects.Rectangle;
            const label = btn.list[1] as Phaser.GameObjects.Text;
            const selected = this.currentBet === amount;
            const canAfford = chips >= amount;
            rect.setStrokeStyle(selected ? 2 : 1, selected ? COL_SLOT_TRIM : (canAfford ? 0x444488 : 0x332233), 1);
            rect.setFillStyle(selected ? 0x2a2a5e : (canAfford ? 0x1a1a3e : 0x110d1a));
            label.setColor(selected ? '#c9a84c' : (canAfford ? '#8888bb' : '#443344'));
        });
        this.betText.setText(`Bet: ${this.currentBet}◈`);
    }

    private spin(): void {
        if (this.spinState !== 'idle') return;

        const chips = GameState.get().chips;
        if (chips < this.currentBet) {
            this.showResult(`Need ${this.currentBet - chips} more chips!`, '#e74c3c');
            return;
        }

        GameState.addChips(-this.currentBet);
        this.totalSpins++;
        this.totalWagered += this.currentBet;
        this.updateChipsDisplay();

        this.spinState = 'spinning';
        // Grey out spin button during spin
        this.spinBtn.setFillStyle(0x1a1a3a);
        this.spinBtn.setStrokeStyle(2, 0x555577, 0.6);
        this.spinBtnLabel.setText('SPINNING...').setColor('#666688');
        this.resultText.setText('');
        this.spinDone = [false, false, false];

        // Stop each reel with increasing delay
        const stopDelays = [600, 1050, 1500];

        for (let i = 0; i < 3; i++) {
            // Fast roll animation
            const rollTimer = this.scene.time.addEvent({
                delay: 80,
                repeat: -1,
                callback: () => {
                    this.reelTexts[i].setText(SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
                },
            });

            // Stop reel after delay
            this.scene.time.delayedCall(stopDelays[i], () => {
                rollTimer.remove();
                const final = weightedRandom();
                this.reelValues[i] = final;
                this.reelTexts[i].setText(final);
                this.spinDone[i] = true;

                if (this.spinDone.every(d => d)) {
                    this.evalResult();
                }
            });

            this.spinTimers.push(rollTimer);
        }
    }

    private evalResult(): void {
        this.spinState = 'result';
        // Restore spin button to active style
        this.spinBtn.setFillStyle(0x3a2a6a);
        this.spinBtn.setStrokeStyle(2, COL_SLOT_TRIM, 1);
        this.spinBtnLabel.setText('SPIN').setColor('#c9a84c');
        this.spinTimers = [];

        const [a, b, c] = this.reelValues;

        let payout = 0;
        let msg = '';
        let msgColor = '#c9a84c';
        let isJackpot = false;

        if (a === b && b === c) {
            // Three of a kind
            const mult = PAYOUTS[a] ?? 2;
            payout = this.currentBet * mult;
            isJackpot = a === '7️⃣';
            msg = isJackpot
                ? `★ JACKPOT! 7️⃣×3  +${payout}◈ ★`
                : `3×${a}  +${payout}◈`;
            msgColor = '#2ecc71';
        } else if (a === b || b === c || a === c) {
            // Two of a kind — cherry pair consolation only when the pair IS cherries
            const cherryPair =
                (a === b && a === '🍒') ||
                (b === c && b === '🍒') ||
                (a === c && a === '🍒');
            if (cherryPair) {
                payout = this.currentBet * CHERRY_PAIR_PAYOUT;
                msg = `Cherry pair!  +${payout}◈`;
                msgColor = '#f0a040';
            } else {
                msg = 'No match — try again';
                msgColor = '#888888';
            }
        } else {
            msg = 'No match — try again';
            msgColor = '#888888';
        }

        if (payout > 0) {
            this.totalWon += payout;
            GameState.addChips(payout);
            this.updateChipsDisplay();

            if (isJackpot) {
                // Jackpot: bigger, repeated flash + payline glow
                this.scene.tweens.add({
                    targets: this.reelTexts,
                    scaleX: 1.35,
                    scaleY: 1.35,
                    yoyo: true,
                    duration: 120,
                    repeat: 5,
                });
                this.scene.tweens.add({
                    targets: this.payLine,
                    alpha: 0,
                    yoyo: true,
                    duration: 80,
                    repeat: 8,
                    onComplete: () => { this.payLine.setAlpha(0.4); },
                });
            } else {
                // Standard win flash
                this.scene.tweens.add({
                    targets: this.reelTexts,
                    scaleX: 1.15,
                    scaleY: 1.15,
                    yoyo: true,
                    duration: 150,
                    repeat: 2,
                });
                this.scene.tweens.add({
                    targets: this.payLine,
                    alpha: 1,
                    yoyo: true,
                    duration: 120,
                    repeat: 3,
                    onComplete: () => { this.payLine.setAlpha(0.4); },
                });
            }
        }

        this.showResult(msg, msgColor);
        this.updateStatsDisplay();

        this.scene.time.delayedCall(500, () => {
            this.spinState = 'idle';
            this.updateBetDisplay();
        });
    }

    private showResult(msg: string, color: string): void {
        this.resultText.setText(msg).setColor(color);
    }

    private close(): void {
        // Clean up any running timers
        this.spinTimers.forEach(t => t.remove());

        this.overlay.destroy();
        this.container.destroy();
        this.onClose();
    }
}
