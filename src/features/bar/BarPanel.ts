// ── Bar & Lounge interaction panel ───────────────────────────────────────────
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL, FONT,
} from '../../game/constants';
import { ToastManager } from '../ui/ToastManager';
import { paintLifeSimShell } from '../ui/shell';
import { SoundManager } from '../../core/systems/SoundManager';

// ── Session-level tracking for once-per-session items ─────────────────────────
// Persists across bar visits within a single gameplay session so that
// once-per-session bonuses (e.g. Lucky Shot) cannot be farmed by reopening
// the bar panel. Call resetBarSession() when a new casino session starts.
const _sessionClaimedBonuses = new Set<string>();

export function resetBarSession(): void {
    _sessionClaimedBonuses.clear();
}

interface DrinkOption {
    name: string;
    baseCost: number;
    emoji: string;
    flavor: string;
    statusMsg: string;
    bonusChips?: number;   // optional one-time chip award
    oncePerSession?: boolean;
    buff?: { type: string; duration: number };
}

const ALL_DRINKS: DrinkOption[] = [
    {
        name: 'Lucky Lemonade',
        baseCost: 5,
        emoji: '🍋',
        flavor: 'Tangy and bright — just like your luck tonight.',
        statusMsg: '★ Lucky Lemonade  |  +10 spins of Slots Luck!',
        buff: { type: 'slotsLuck', duration: 10 },
    },
    {
        name: 'Slot City Lager',
        baseCost: 8,
        emoji: '🍺',
        flavor: 'Cold, crisp, and casino-brewed. A local favourite.',
        statusMsg: '★ Slot City Lager  |  Down the hatch.',
    },
    {
        name: 'House Sparkling',
        baseCost: 10,
        emoji: '🥂',
        flavor: "The casino's complimentary vintage. Respectable.",
        statusMsg: '★ House Sparkling  |  Celebrate early.',
    },
    {
        name: 'High Roller Bourbon',
        baseCost: 20,
        emoji: '🥃',
        flavor: 'Smooth. Expensive. Worth it.',
        statusMsg: '★ High Roller Bourbon  |  +5 hands of Poker Tells!',
        buff: { type: 'pokerTell', duration: 5 },
    },
    {
        name: 'Lucky Shot',
        baseCost: 25,
        emoji: '🎯',
        flavor: 'House special. One shot, one chance — +75 bonus chips!',
        statusMsg: '★ Lucky Shot  |  Feeling lucky? +75◈ bonus!',
        bonusChips: 75,
        oncePerSession: true,
    },
    {
        name: 'Jackpot Juice',
        baseCost: 0,
        emoji: '🧃',
        flavor: 'On the house. Every guest gets one.',
        statusMsg: '★ Jackpot Juice  |  Free! Enjoy.',
    },
    {
        name: 'Bowl of Mixed Nuts',
        baseCost: 0,
        emoji: '🥜',
        flavor: 'A classic bar snack. Salty and satisfying.',
        statusMsg: '★ Bowl of Mixed Nuts  |  Crunch crunch.',
    },
    {
        name: 'Lucky Caviar',
        baseCost: 50,
        emoji: '🐟',
        flavor: 'A delicacy that practically guarantees a jackpot.',
        statusMsg: '★ Lucky Caviar  |  Guaranteed Win on next Slots or Scratchers!',
        buff: { type: 'guaranteedSlotsWin', duration: 1 },
        oncePerSession: true,
    },
];

const BARTENDER_GREETINGS = [
    '"What can I get for you tonight?"',
    '"Welcome back — the usual?"',
    '"Feeling lucky? Let me pour you something."',
    '"The house always wins... but you can still enjoy a drink."',
    '"Rough session? I\'ve got just the thing."',
    '"Every winner started at the bar. Drink up!"',
];

const GAMBLING_TIPS = [
    '💡 Tip: In slots, 7️⃣×3 pays 50× your bet. Chase the jackpot!',
    '💡 Tip: In poker, F=Fold  C=Check/Call  R=Raise.',
    '💡 Tip: Low on chips? Look for Free Chips buttons in-game.',
    '💡 Tip: Cherry pairs pay 1× in slots — small wins add up!',
    '💡 Tip: In poker, pocket Aces is the best starting hand.',
    '💡 Tip: The slot machine pays back over time — stay patient!',
    '💡 Tip: Min-raise early in poker — don\'t give your hand away.',
    '💡 Tip: In poker, the dealer button rotates — position matters.',
    '💡 Tip: Blackjack basic strategy — always split Aces and 8s.',
    '💡 Tip: Blackjack — double down on 11 when dealer shows 2-10.',
    '💡 Tip: Blackjack — never take insurance; the house edge is high.',
    '💡 Tip: Blackjack — stand on 17+ regardless of dealer\'s card.',
    '💡 Tip: Blackjack — "Soft" means you have an Ace counting as 11.',
    '💡 Tip: In blackjack, dealer must hit on 16 and stand on 17+.',
    '💡 Tip: Two matching cards in blackjack? Split them for two hands!',
];

export class BarPanel {
    private scene: Phaser.Scene;
    private onClose: () => void;

    private overlay!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private chipsText!: Phaser.GameObjects.Text;
    private drinkCountText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private escHandler!: () => void;
    private closed = false;
    private stateUnsub!: () => void;

    // Session state
    private drinksOrdered: number = 0;
    private specialIdx: number;

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene = scene;
        this.onClose = onClose;
        // Pick a random drink to be "today's special" (discounted by 50%, min cost 0)
        this.specialIdx = Math.floor(Math.random() * ALL_DRINKS.length);
        this.build();
    }

    private get drinks(): DrinkOption[] {
        return ALL_DRINKS.map((d, i) => ({
            ...d,
            baseCost: i === this.specialIdx && d.baseCost > 0
                ? Math.floor(d.baseCost / 2)
                : d.baseCost,
        }));
    }

    private build(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const pw = 480;
        const ph = 480;

        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();

        this.container = this.scene.add.container(cx, cy).setScrollFactor(0).setDepth(DEPTH_PANEL + 1);

        const bg = this.scene.add.graphics();
        paintLifeSimShell(bg, -pw / 2, -ph / 2, pw, ph);
        this.container.add(bg);

        // Champagne Bubbles Particles
        for (let i = 0; i < 20; i++) {
            const bx = Phaser.Math.Between(-pw / 2 + 10, pw / 2 - 10);
            const by = Phaser.Math.Between(-ph / 2 + 100, ph / 2);
            const bubble = this.scene.add.circle(bx, by, Phaser.Math.Between(1, 3), 0xffd700, Phaser.Math.FloatBetween(0.1, 0.5));
            this.container.add(bubble);
            
            this.scene.tweens.add({
                targets: bubble,
                y: `-=${Phaser.Math.Between(100, 250)}`,
                x: `+=${Phaser.Math.Between(-15, 15)}`,
                alpha: 0,
                duration: Phaser.Math.Between(3000, 6000),
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 3000)
            });
        }

        const title = this.scene.add.text(0, -ph / 2 + 30, '🍹  BAR & LOUNGE', {
            fontFamily: FONT, fontSize: '20px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.container.add(title);

        // Rotating bartender greeting
        const greeting = BARTENDER_GREETINGS[Math.floor(Math.random() * BARTENDER_GREETINGS.length)];
        const greet = this.scene.add.text(0, -ph / 2 + 68, greeting, {
            fontFamily: FONT, fontSize: '11px', color: '#d7c49a',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        this.container.add(greet);

        // Chips display
        this.chipsText = this.scene.add.text(-pw / 2 + 16, -ph / 2 + 86, '', {
            fontFamily: FONT, fontSize: '11px', color: '#2ecc71',
        }).setOrigin(0, 0);
        this.container.add(this.chipsText);

        // Drink counter (right side)
        this.drinkCountText = this.scene.add.text(pw / 2 - 16, -ph / 2 + 86, '', {
            fontFamily: FONT, fontSize: '10px', color: '#d7f3ea',
        }).setOrigin(1, 0);
        this.container.add(this.drinkCountText);

        // Today's Special banner
        const specName = this.drinks[this.specialIdx].name;
        const specBanner = this.scene.add.text(0, -ph / 2 + 104, `✨ Today's Special: ${specName} (half price!)`, {
            fontFamily: FONT, fontSize: '10px', color: '#c9a84c',
        }).setOrigin(0.5);
        this.container.add(specBanner);

        // Drink buttons
        const startY = -ph / 2 + 120;
        const bh = 32;
        const gap = 2;
        const DISABLED_COLOR = 0x0d0804;
        const PRESSED_COLOR  = 0x1a0c02;

        this.drinks.forEach((drink, i) => {
            const by = startY + i * (bh + gap) + bh / 2;
            const isSpecial = i === this.specialIdx;
            const alreadyDisabled = this.isDisabled(drink);

            const baseColor  = isSpecial ? 0x2a2005 : 0x2a1505;
            const hoverColor = isSpecial ? 0x4a3510 : 0x3a2010;
            const borderCol  = isSpecial ? 0x9a7a10 : 0x5a3010;

            // Start with disabled appearance if already claimed this session
            const rect = this.scene.add.rectangle(0, by, pw - 60, bh, alreadyDisabled ? DISABLED_COLOR : baseColor, 1)
                .setStrokeStyle(isSpecial ? 2 : 1, borderCol, 1)
                .setInteractive({ useHandCursor: true });

            // Colored halo/reflection around the bottle emoji — glow circle
            const haloGfx = this.scene.add.graphics();
            const haloX = -pw / 2 + 36;
            if (!alreadyDisabled) {
                const haloColor = isSpecial ? 0xffd040 : 0xc9a84c;
                // Multi-layer glow
                haloGfx.fillStyle(haloColor, 0.06);
                haloGfx.fillCircle(haloX, by, 18);
                haloGfx.fillStyle(haloColor, 0.10);
                haloGfx.fillCircle(haloX, by, 13);
                haloGfx.lineStyle(0.5, haloColor, 0.35);
                haloGfx.strokeCircle(haloX, by, 13);
            }

            // Custom glass silhouette on the left side of each button
            const glassGfx = this.scene.add.graphics();
            const gx = haloX + 26;  // position relative to halo
            this.drawGlassSilhouette(glassGfx, gx, by, i, alreadyDisabled, 1.0);

            const nameLabel = this.scene.add.text(-pw / 2 + 46, by - 8, `${drink.emoji}  ${drink.name}`, {
                fontFamily: FONT, fontSize: '12px',
                color: alreadyDisabled ? '#444444' : (isSpecial ? '#e0c060' : '#d4b070'),
            }).setOrigin(0, 0.5);

            const costStr = drink.baseCost === 0 ? 'FREE' : `${drink.baseCost}◈`;
            const costColor = drink.baseCost === 0 ? '#2ecc71' : (isSpecial ? '#e0c060' : '#c9a84c');
            const costLabel = this.scene.add.text(pw / 2 - 62, by, costStr, {
                fontFamily: FONT, fontSize: '11px', color: costColor,
            }).setOrigin(0.5);

            let descStr = `"${drink.flavor}"`;
            if (drink.oncePerSession) descStr += '  [once/session]';
            const descLabel = this.scene.add.text(-pw / 2 + 46, by + 9, descStr, {
                fontFamily: FONT, fontSize: '9px', color: isSpecial ? '#907040' : '#705030',
                fontStyle: 'italic',
            }).setOrigin(0, 0.5);

            rect.on('pointerover', () => {
                if (!this.isDisabled(drink)) rect.setFillStyle(hoverColor);
            });
            rect.on('pointerout', () => {
                rect.setFillStyle(this.isDisabled(drink) ? DISABLED_COLOR : baseColor);
            });
            rect.on('pointerdown', () => {
                if (!this.isDisabled(drink)) {
                    rect.setFillStyle(PRESSED_COLOR);
                    this.orderDrink(drink, nameLabel, costLabel, rect, DISABLED_COLOR);
                }
            });
            rect.on('pointerup', () => {
                if (!this.isDisabled(drink)) rect.setFillStyle(hoverColor);
            });

            this.container.add([rect, haloGfx, glassGfx, nameLabel, descLabel, costLabel]);
        });

        // Side-by-side: Gambling Tip, Tip Bartender, Coin Flip
        const tipY = startY + ALL_DRINKS.length * (bh + gap) + bh / 2 + 6;
        const btnW = (pw - 60 - 16) / 3; // split width with 8px gaps

        // Left: Ask for Tip
        const tipRect = this.scene.add.rectangle(-btnW - 8, tipY, btnW, 26, 0x0a1a0a, 1)
            .setStrokeStyle(1, 0x2a4a1a, 1)
            .setInteractive({ useHandCursor: true });
        const tipLabel = this.scene.add.text(-btnW - 8, tipY, '🎲  Get a Tip  (free)', {
            fontFamily: FONT, fontSize: '9px', color: '#8fd9a8',
        }).setOrigin(0.5);

        tipRect.on('pointerover', () => {
            tipRect.setFillStyle(0x153515);
            tipRect.setStrokeStyle(1.5, 0xc9a84c, 1.0);
            this.scene.tweens.add({ targets: [tipRect, tipLabel], scaleX: 1.02, scaleY: 1.02, duration: 100 });
        });
        tipRect.on('pointerout',  () => {
            tipRect.setFillStyle(0x0a1a0a);
            tipRect.setStrokeStyle(1, 0x2a4a1a, 1.0);
            this.scene.tweens.add({ targets: [tipRect, tipLabel], scaleX: 1.0, scaleY: 1.0, duration: 100 });
        });
        tipRect.on('pointerdown', () => { tipRect.setFillStyle(0x081008); this.showGamblingTip(); });
        tipRect.on('pointerup',   () => tipRect.setFillStyle(0x153515));

        // Middle: Tip Bartender
        const payTipRect = this.scene.add.rectangle(0, tipY, btnW, 26, 0x1a150a, 1)
            .setStrokeStyle(1, 0x5a4a1a, 1)
            .setInteractive({ useHandCursor: true });
        const payTipLabel = this.scene.add.text(0, tipY, '💵  Tip Bartender  (10◈)', {
            fontFamily: FONT, fontSize: '9px', color: '#c9a84c',
        }).setOrigin(0.5);

        payTipRect.on('pointerover', () => {
            payTipRect.setFillStyle(0x2d2514);
            payTipRect.setStrokeStyle(1.5, 0xffd700, 1.0);
            this.scene.tweens.add({ targets: [payTipRect, payTipLabel], scaleX: 1.02, scaleY: 1.02, duration: 100 });
        });
        payTipRect.on('pointerout',  () => {
            payTipRect.setFillStyle(0x1a150a);
            payTipRect.setStrokeStyle(1, 0x5a4a1a, 1.0);
            this.scene.tweens.add({ targets: [payTipRect, payTipLabel], scaleX: 1.0, scaleY: 1.0, duration: 100 });
        });
        payTipRect.on('pointerdown', () => {
            payTipRect.setFillStyle(0x100a05);
            const chips = GameState.get().chips;
            if (chips < 10) {
                this.statusText.setText('Need at least 10◈ to tip!').setColor('#e74c3c');
                return;
            }
            GameState.addChips(-10);
            this.updateChips();
            GameState.recordStat('barChipsTipped', 10);
            SoundManager.playClick();
            ToastManager.show(this.scene, `Tipped 10 ◈!`, 'win');

            const bartenderQuotes = [
                '"Thanks for the tip, partner! Best of luck!"',
                '"Appreciate it! Let me know if you need another round."',
                '"Cheers! You\'re a class act."',
                '"Thanks! Here\'s to a lucky night!"',
            ];
            const quote = bartenderQuotes[Math.floor(Math.random() * bartenderQuotes.length)];
            this.statusText.setText(quote).setColor('#c9a84c');
        });
        payTipRect.on('pointerup', () => payTipRect.setFillStyle(0x2d2514));

        // Right: Coin Flip Game
        const flipRect = this.scene.add.rectangle(btnW + 8, tipY, btnW, 26, 0x1a0a0a, 1)
            .setStrokeStyle(1, 0x5a1a1a, 1)
            .setInteractive({ useHandCursor: true });
        const flipLabel = this.scene.add.text(btnW + 8, tipY, '🪙  Coin Flip  (Bet 10◈)', {
            fontFamily: FONT, fontSize: '9px', color: '#ff6666',
        }).setOrigin(0.5);

        flipRect.on('pointerover', () => {
            flipRect.setFillStyle(0x351515);
            flipRect.setStrokeStyle(1.5, 0xff4040, 1.0);
            this.scene.tweens.add({ targets: [flipRect, flipLabel], scaleX: 1.02, scaleY: 1.02, duration: 100 });
        });
        flipRect.on('pointerout',  () => {
            flipRect.setFillStyle(0x1a0a0a);
            flipRect.setStrokeStyle(1, 0x5a1a1a, 1.0);
            this.scene.tweens.add({ targets: [flipRect, flipLabel], scaleX: 1.0, scaleY: 1.0, duration: 100 });
        });
        flipRect.on('pointerdown', () => {
            flipRect.setFillStyle(0x100505);
            const chips = GameState.get().chips;
            if (chips < 10) {
                this.statusText.setText('Need 10◈ to flip a coin!').setColor('#e74c3c');
                return;
            }
            GameState.addChips(-10);
            const won = Math.random() < 0.5;
            if (won) {
                GameState.addChips(20);
                SoundManager.playClick();
                this.statusText.setText('"Heads! You win 20◈."').setColor('#2ecc71');
                ToastManager.show(this.scene, `Coin Flip: +20 ◈!`, 'win');
            } else {
                SoundManager.playClick();
                this.statusText.setText('"Tails. Better luck next flip."').setColor('#e74c3c');
            }
            this.updateChips();
        });
        flipRect.on('pointerup', () => flipRect.setFillStyle(0x351515));

        this.container.add([tipRect, tipLabel, payTipRect, payTipLabel, flipRect, flipLabel]);

        // Status message area
        const statusY = ph / 2 - 68;
        const statusBg = this.scene.add.rectangle(0, statusY, pw - 40, 30, 0x0d0804, 0.8)
            .setStrokeStyle(1, 0x3a2010, 0.6);
        this.statusText = this.scene.add.text(0, statusY, 'Select a drink...', {
            fontFamily: FONT, fontSize: '11px', color: '#666644',
        }).setOrigin(0.5);
        this.container.add([statusBg, this.statusText]);

        // Close button
        const closeRect = this.scene.add.rectangle(0, ph / 2 - 28, 130, 28, 0x3a1e1e, 1)
            .setStrokeStyle(1, 0x8a3a3a, 1)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(0, ph / 2 - 28, 'Leave Bar  [ESC]', {
            fontFamily: FONT, fontSize: '11px', color: '#e05050',
        }).setOrigin(0.5);

        closeRect.on('pointerover', () => closeRect.setFillStyle(0x5a2a2a));
        closeRect.on('pointerout',  () => closeRect.setFillStyle(0x3a1e1e));
        closeRect.on('pointerdown', () => { closeRect.setFillStyle(0x2a0a0a); this.close(); });
        closeRect.on('pointerup',   () => closeRect.setFillStyle(0x5a2a2a));

        this.container.add([closeRect, closeLabel]);

        // ESC key — use .on() with a stored reference for clean removal
        this.escHandler = () => this.close();
        this.scene.input.keyboard!.on('keydown-ESC', this.escHandler);

        // Live chip refresh — redraws balance whenever chips change outside the panel
        this.stateUnsub = GameState.subscribe(() => {
            if (!this.closed) this.updateChips();
        });

        this.updateChips();
        this.updateDrinkCount();
    }

    private isDisabled(drink: DrinkOption): boolean {
        // Check both session-level (cross-visit) and instance-level tracking
        return !!(drink.oncePerSession && _sessionClaimedBonuses.has(drink.name));
    }

    private updateChips(): void {
        this.chipsText.setText(`◈ ${GameState.get().chips.toLocaleString()} chips`);
    }

    private updateDrinkCount(): void {
        this.drinkCountText.setText(
            this.drinksOrdered > 0
                ? `🍹 ×${this.drinksOrdered} tonight`
                : '',
        );
    }

    private orderDrink(
        drink: DrinkOption,
        nameLabel: Phaser.GameObjects.Text,
        _costLabel: Phaser.GameObjects.Text,
        rect: Phaser.GameObjects.Rectangle,
        disabledColor: number,
    ): void {
        if (this.isDisabled(drink)) return;

        const chips = GameState.get().chips;
        if (drink.baseCost > chips) {
            this.statusText.setText(`Need ${drink.baseCost - chips} more chips!`).setColor('#e74c3c');
            return;
        }

        GameState.addChips(-drink.baseCost);
        GameState.recordStat('barDrinksOrdered', 1);

        // Apply bonus chips if any
        if (drink.bonusChips) {
            GameState.addChips(drink.bonusChips);
            GameState.recordStat('barLuckyShotsClaimed', 1);
            ToastManager.show(this.scene, `${drink.name}: +${drink.bonusChips} ◈`, 'win');
        }

        if (drink.buff) {
            GameState.addBuff(drink.buff.type, drink.buff.duration);
            ToastManager.show(this.scene, `${drink.name} Buff Applied!`, 'win');
        }

        const drinkIdx = ALL_DRINKS.findIndex(d => d.name === drink.name);
        
        // Find specific graphics and containers for pouring animation
        // Left side glass index relative to container
        const pw = 480;
        const startY = -480 / 2 + 108;
        const bh = 36;
        const gap = 4;
        const by = startY + drinkIdx * (bh + gap) + bh / 2;
        const haloX = -pw / 2 + 36;
        const gx = haloX + 26;

        // Create specific graphic refs for animation
        const glassGfx = this.scene.add.graphics().setDepth(DEPTH_PANEL + 2);
        const haloGfx = this.scene.add.graphics().setDepth(DEPTH_PANEL + 2);
        this.container.add([glassGfx, haloGfx]);

        // Disable button row temporarily during pouring
        rect.disableInteractive();

        // Animate pouring liquid
        let fillProgress = { val: 0.0 };
        this.scene.tweens.add({
            targets: fillProgress,
            val: 1.0,
            duration: 850,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                if (this.closed) return;
                const v = fillProgress.val;
                
                // Redraw glass with increasing fill level
                this.drawGlassSilhouette(glassGfx, gx, by, drinkIdx, false, v);
                
                // Draw pouring stream
                haloGfx.clear();
                if (v < 0.95) {
                    const pourCol = drinkIdx === 4 ? 0xff40a0 : drinkIdx === 5 ? 0x40ff80 : drinkIdx === 1 ? 0xd07010 : 0xffcc40;
                    haloGfx.lineStyle(2.0, pourCol, 0.85);
                    haloGfx.lineBetween(gx, by - 16, gx, by + 11 - 22 * v);
                    
                    // Splash effect
                    haloGfx.fillStyle(pourCol, 0.7);
                    haloGfx.fillCircle(gx + (Math.random() - 0.5) * 4, by + 11 - 22 * v + (Math.random() - 0.5) * 3, 2);
                } else {
                    // Regular glow halo when filled
                    const haloColor = drinkIdx === 4 ? 0xff40a0 : drinkIdx === 5 ? 0x40ff80 : 0xc9a84c;
                    haloGfx.fillStyle(haloColor, 0.06);
                    haloGfx.fillCircle(haloX, by, 18);
                    haloGfx.fillStyle(haloColor, 0.10);
                    haloGfx.fillCircle(haloX, by, 13);
                    haloGfx.lineStyle(0.5, haloColor, 0.35);
                    haloGfx.strokeCircle(haloX, by, 13);
                }
            },
            onComplete: () => {
                if (this.closed) return;
                if (!drink.oncePerSession) rect.setInteractive();
            }
        });

        if (drink.oncePerSession) {
            _sessionClaimedBonuses.add(drink.name);
            nameLabel.setColor('#444444');
            rect.setFillStyle(disabledColor);
        }

        this.drinksOrdered++;
        this.updateChips();
        this.updateDrinkCount();

        const fullMsg = drink.bonusChips
            ? `${drink.statusMsg}  +${drink.bonusChips}◈ bonus!`
            : drink.statusMsg;
        this.statusText.setText(fullMsg).setColor('#c9a84c');

        // Brief scale pop on status text
        this.scene.tweens.add({
            targets: this.statusText,
            scaleX: 1.05,
            scaleY: 1.05,
            yoyo: true,
            duration: 110,
            ease: 'Sine.easeOut',
            onComplete: () => { this.statusText.setScale(1); },
        });
    }

    private drawGlassSilhouette(
        g: Phaser.GameObjects.Graphics,
        gx: number, gy: number,
        type: number,
        disabled: boolean,
        fillLevel: number = 1.0
    ): void {
        g.clear();
        if (disabled) return;

        const isSpecial = type === this.specialIdx;
        const col = isSpecial ? 0xffd700 : 0xc9a84c;
        const alpha = 0.5;

        g.lineStyle(1.2, col, alpha);
        
        switch (type) {
            case 0: // Pint Glass (Lemonade)
                g.lineBetween(gx - 7, gy - 11, gx + 7, gy - 11);
                g.lineBetween(gx - 7, gy - 11, gx - 5, gy + 11);
                g.lineBetween(gx + 7, gy - 11, gx + 5, gy + 11);
                g.lineBetween(gx - 5, gy + 11, gx + 5, gy + 11);
                
                if (fillLevel > 0) {
                    const fillH = 22 * fillLevel;
                    const fillY = gy + 11 - fillH;
                    const wLeft = gx - 5 - (1 - fillLevel) * 2;
                    const wRight = gx + 5 + (1 - fillLevel) * 2;
                    g.fillStyle(0xffe040, 0.45);
                    g.fillRoundedRect(wLeft, fillY, wRight - wLeft, fillH, { tl: 0, tr: 0, bl: 2, br: 2 });
                }
                break;
            case 1: // Beer Mug (Lager)
                g.strokeRoundedRect(gx - 7, gy - 10, 14, 20, 2);
                g.lineStyle(1.2, col, alpha);
                g.strokeRoundedRect(gx + 7, gy - 6, 4, 12, 1);
                
                if (fillLevel > 0) {
                    const fillH = 18 * fillLevel;
                    const fillY = gy + 10 - fillH;
                    g.fillStyle(0xd07010, 0.5);
                    g.fillRoundedRect(gx - 6, fillY, 12, fillH, { tl: 0, tr: 0, bl: 1, br: 1 });
                    
                    if (fillLevel >= 0.9) {
                        g.fillStyle(0xffffff, 0.7);
                        g.fillEllipse(gx, gy - 9, 13, 3);
                    }
                }
                break;
            case 2: // Champagne Flute (Sparkling)
                g.lineBetween(gx - 4, gy - 11, gx + 4, gy - 11);
                g.lineBetween(gx - 4, gy - 11, gx - 3, gy + 1);
                g.lineBetween(gx + 4, gy - 11, gx + 3, gy + 1);
                g.lineBetween(gx - 3, gy + 1, gx + 3, gy + 1);
                g.lineBetween(gx, gy + 1, gx, gy + 9);
                g.lineBetween(gx - 5, gy + 9, gx + 5, gy + 9);

                if (fillLevel > 0) {
                    const fillH = 12 * fillLevel;
                    const fillY = gy + 1 - fillH;
                    g.fillStyle(0xffd060, 0.4);
                    g.fillRoundedRect(gx - 3, fillY, 6, fillH, { tl: 0, tr: 0, bl: 1, br: 1 });
                }
                break;
            case 3: // Snifter Snob Glass (Bourbon)
                g.lineBetween(gx - 5, gy - 10, gx + 5, gy - 10);
                g.lineBetween(gx - 5, gy - 10, gx - 8, gy);
                g.lineBetween(gx + 5, gy - 10, gx + 8, gy);
                g.lineBetween(gx - 8, gy, gx - 5, gy + 4);
                g.lineBetween(gx + 8, gy, gx + 5, gy + 4);
                g.lineBetween(gx - 5, gy + 4, gx + 5, gy + 4);
                g.lineBetween(gx, gy + 4, gx, gy + 8);
                g.lineBetween(gx - 6, gy + 8, gx + 6, gy + 8);

                if (fillLevel > 0) {
                    const fillH = 10 * fillLevel;
                    const fillY = gy + 4 - fillH;
                    g.fillStyle(0x8a4513, 0.6);
                    g.fillRoundedRect(gx - 7, fillY, 14, fillH, { tl: 0, tr: 0, bl: 2, br: 2 });
                }
                break;
            case 4: // Shot Glass (Lucky Shot)
                g.lineBetween(gx - 5, gy - 5, gx + 5, gy - 5);
                g.lineBetween(gx - 5, gy - 5, gx - 3.5, gy + 9);
                g.lineBetween(gx + 5, gy - 5, gx + 3.5, gy + 9);
                g.lineBetween(gx - 3.5, gy + 9, gx + 3.5, gy + 9);

                if (fillLevel > 0) {
                    const fillH = 14 * fillLevel;
                    const fillY = gy + 9 - fillH;
                    g.fillStyle(0xff40a0, 0.55);
                    g.fillRoundedRect(gx - 3.5, fillY, 7, fillH, { tl: 0, tr: 0, bl: 1, br: 1 });
                }
                break;
            case 5: // Juice Box / Straw highball (Jackpot Juice)
                g.strokeRoundedRect(gx - 5, gy - 11, 10, 22, 2);
                g.lineStyle(1.0, 0x40ff80, alpha);
                g.lineBetween(gx + 2, gy - 14, gx - 2, gy - 5);
                g.lineStyle(1.2, col, alpha);

                if (fillLevel > 0) {
                    const fillH = 20 * fillLevel;
                    const fillY = gy + 11 - fillH;
                    g.fillStyle(0x40ff80, 0.45);
                    g.fillRoundedRect(gx - 4, fillY, 8, fillH, { tl: 0, tr: 0, bl: 1, br: 1 });
                }
                break;
        }
    }

    private showGamblingTip(): void {
        const tip = GAMBLING_TIPS[Math.floor(Math.random() * GAMBLING_TIPS.length)];
        this.statusText.setText(tip).setColor('#3a9a3a');
        this.scene.tweens.add({
            targets: this.statusText,
            scaleX: 1.03,
            scaleY: 1.03,
            yoyo: true,
            duration: 120,
            ease: 'Sine.easeOut',
            onComplete: () => { this.statusText.setScale(1); },
        });
    }

    private close(): void {
        if (this.closed) return;
        this.closed = true;
        this.stateUnsub();
        this.scene.input.keyboard!.off('keydown-ESC', this.escHandler);
        this.overlay.destroy();
        this.container.destroy();
        this.onClose();
    }
}
