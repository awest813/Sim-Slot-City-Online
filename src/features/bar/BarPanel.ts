// ── Bar & Lounge interaction panel ───────────────────────────────────────────
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL, COL_TRIM,
} from '../../game/constants';
import { ToastManager } from '../ui/ToastManager';

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
}

const ALL_DRINKS: DrinkOption[] = [
    {
        name: 'Lucky Lemonade',
        baseCost: 5,
        emoji: '🍋',
        flavor: 'Tangy and bright — just like your luck tonight.',
        statusMsg: '★ Lucky Lemonade  |  A classic choice.',
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
        statusMsg: '★ High Roller Bourbon  |  The good stuff.',
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

        // Panel BG — warm wood tones
        const bg = this.scene.add.graphics();
        // Shadow
        bg.fillStyle(0x000000, 0.5);
        bg.fillRoundedRect(-pw / 2 + 5, -ph / 2 + 7, pw, ph, 10);
        // Main body
        bg.fillStyle(0x1e0f05, 1);
        bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        // Warm amber radial glow at center-bottom (simulates bar under-lighting)
        const GLOW_LAYERS = [
            { alpha: 0.04, radius: 200 },
            { alpha: 0.06, radius: 150 },
            { alpha: 0.08, radius: 100 },
            { alpha: 0.06, radius: 60 },
        ];
        for (const layer of GLOW_LAYERS) {
            bg.fillStyle(0xff8800, layer.alpha);
            bg.fillEllipse(0, ph / 2 - 40, layer.radius * 2, layer.radius * 0.7);
        }
        // Gold border
        bg.lineStyle(2, COL_TRIM, 1);
        bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
        // Inner border
        bg.lineStyle(1, 0xe8c870, 0.2);
        bg.strokeRoundedRect(-pw / 2 + 3, -ph / 2 + 3, pw - 6, ph - 6, 7);
        // Left accent bar — 4px wide
        bg.fillStyle(COL_TRIM, 0.4);
        bg.fillRoundedRect(-pw / 2, -ph / 2, 4, ph, { tl: 8, bl: 8, tr: 0, br: 0 });
        this.container.add(bg);

        // Header panel — polished wood
        const header = this.scene.add.graphics();
        header.fillStyle(0x2a1208, 1);
        header.fillRoundedRect(-pw / 2, -ph / 2, pw, 44, { tl: 8, tr: 8, bl: 0, br: 0 });
        // Polished surface highlight at top
        header.fillStyle(0x6a3a14, 0.6);
        header.fillRoundedRect(-pw / 2 + 2, -ph / 2 + 1, pw - 4, 4, { tl: 7, tr: 7, bl: 0, br: 0 });
        // Neon amber glow behind header text area (simulates neon bar sign)
        header.fillStyle(0xff8800, 0.04);
        header.fillRoundedRect(-pw / 2 + 20, -ph / 2 + 4, pw - 40, 36, 4);
        header.lineStyle(1, 0xff9900, 0.18);
        header.strokeRoundedRect(-pw / 2 + 20, -ph / 2 + 4, pw - 40, 36, 4);
        // Header bottom gold line
        header.lineStyle(1.5, COL_TRIM, 0.6);
        header.lineBetween(-pw / 2 + 8, -ph / 2 + 44, pw / 2 - 8, -ph / 2 + 44);
        this.container.add(header);

        // Wood grain stripes (visual texture)
        for (let i = 0; i < 8; i++) {
            const stripe = this.scene.add.rectangle(0, -ph / 2 + 52 + i * 52, pw - 4, 1, 0x2a1a08, 0.5);
            this.container.add(stripe);
        }

        // Title — 20px
        const title = this.scene.add.text(0, -ph / 2 + 22, '🍹  BAR & LOUNGE', {
            fontFamily: 'monospace', fontSize: '20px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        const divider = this.scene.add.rectangle(0, -ph / 2 + 40, pw - 40, 1, COL_TRIM, 0.5);
        this.container.add([title, divider]);

        // Rotating bartender greeting
        const greeting = BARTENDER_GREETINGS[Math.floor(Math.random() * BARTENDER_GREETINGS.length)];
        const greet = this.scene.add.text(0, -ph / 2 + 56, greeting, {
            fontFamily: 'monospace', fontSize: '11px', color: '#a08050',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        this.container.add(greet);

        // Chips display
        this.chipsText = this.scene.add.text(-pw / 2 + 16, -ph / 2 + 74, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#2ecc71',
        }).setOrigin(0, 0);
        this.container.add(this.chipsText);

        // Drink counter (right side)
        this.drinkCountText = this.scene.add.text(pw / 2 - 16, -ph / 2 + 74, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#6a5030',
        }).setOrigin(1, 0);
        this.container.add(this.drinkCountText);

        // Today's Special banner
        const specName = this.drinks[this.specialIdx].name;
        const specBanner = this.scene.add.text(0, -ph / 2 + 90, `✨ Today's Special: ${specName} (half price!)`, {
            fontFamily: 'monospace', fontSize: '10px', color: '#c9a84c',
        }).setOrigin(0.5);
        this.container.add(specBanner);

        // Drink buttons
        const startY = -ph / 2 + 108;
        const bh = 36;
        const gap = 4;
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

            // Cocktail glass silhouette on the left side of each button
            const glassGfx = this.scene.add.graphics();
            const gx = haloX + 26;  // position relative to halo
            if (!alreadyDisabled) {
                const glassColor = isSpecial ? 0xe0c060 : 0x8a6a30;
                const glassAlpha = 0.45;
                // Triangular glass body (wide at top, narrow at bottom)
                glassGfx.fillStyle(glassColor, glassAlpha);
                glassGfx.fillTriangle(gx - 7, by - 11, gx + 7, by - 11, gx, by + 3);
                // Stem
                glassGfx.lineStyle(1, glassColor, glassAlpha);
                glassGfx.lineBetween(gx, by + 3, gx, by + 9);
                // Base
                glassGfx.lineBetween(gx - 5, by + 9, gx + 5, by + 9);
                // Top rim
                glassGfx.lineStyle(0.5, glassColor, glassAlpha * 0.6);
                glassGfx.lineBetween(gx - 7, by - 11, gx + 7, by - 11);
            }

            const nameLabel = this.scene.add.text(-pw / 2 + 46, by - 8, `${drink.emoji}  ${drink.name}`, {
                fontFamily: 'monospace', fontSize: '12px',
                color: alreadyDisabled ? '#444444' : (isSpecial ? '#e0c060' : '#d4b070'),
            }).setOrigin(0, 0.5);

            const costStr = drink.baseCost === 0 ? 'FREE' : `${drink.baseCost}◈`;
            const costColor = drink.baseCost === 0 ? '#2ecc71' : (isSpecial ? '#e0c060' : '#c9a84c');
            const costLabel = this.scene.add.text(pw / 2 - 62, by, costStr, {
                fontFamily: 'monospace', fontSize: '11px', color: costColor,
            }).setOrigin(0.5);

            let descStr = `"${drink.flavor}"`;
            if (drink.oncePerSession) descStr += '  [once/session]';
            const descLabel = this.scene.add.text(-pw / 2 + 46, by + 9, descStr, {
                fontFamily: 'monospace', fontSize: '9px', color: isSpecial ? '#907040' : '#705030',
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

        // Gambling Tip button
        const tipY = startY + ALL_DRINKS.length * (bh + gap) + bh / 2 + 6;
        const tipRect = this.scene.add.rectangle(0, tipY, pw - 60, 26, 0x0a1a0a, 1)
            .setStrokeStyle(1, 0x2a4a1a, 1)
            .setInteractive({ useHandCursor: true });
        const tipLabel = this.scene.add.text(0, tipY, '🎲  Ask for a gambling tip  (free)', {
            fontFamily: 'monospace', fontSize: '10px', color: '#3a7a3a',
        }).setOrigin(0.5);
        tipRect.on('pointerover', () => tipRect.setFillStyle(0x1a2a1a));
        tipRect.on('pointerout',  () => tipRect.setFillStyle(0x0a1a0a));
        tipRect.on('pointerdown', () => { tipRect.setFillStyle(0x081008); this.showGamblingTip(); });
        tipRect.on('pointerup',   () => tipRect.setFillStyle(0x1a2a1a));
        this.container.add([tipRect, tipLabel]);

        // Status message area
        const statusY = ph / 2 - 68;
        const statusBg = this.scene.add.rectangle(0, statusY, pw - 40, 30, 0x0d0804, 0.8)
            .setStrokeStyle(1, 0x3a2010, 0.6);
        this.statusText = this.scene.add.text(0, statusY, 'Select a drink...', {
            fontFamily: 'monospace', fontSize: '11px', color: '#666644',
        }).setOrigin(0.5);
        this.container.add([statusBg, this.statusText]);

        // Close button
        const closeRect = this.scene.add.rectangle(0, ph / 2 - 28, 130, 28, 0x3a1e1e, 1)
            .setStrokeStyle(1, 0x8a3a3a, 1)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(0, ph / 2 - 28, 'Leave Bar  [ESC]', {
            fontFamily: 'monospace', fontSize: '11px', color: '#e05050',
        }).setOrigin(0.5);

        closeRect.on('pointerover', () => closeRect.setFillStyle(0x5a2a2a));
        closeRect.on('pointerout',  () => closeRect.setFillStyle(0x3a1e1e));
        closeRect.on('pointerdown', () => { closeRect.setFillStyle(0x2a0a0a); this.close(); });
        closeRect.on('pointerup',   () => closeRect.setFillStyle(0x5a2a2a));

        this.container.add([closeRect, closeLabel]);

        // ESC key — use .on() with a stored reference for clean removal
        this.escHandler = () => this.close();
        this.scene.input.keyboard!.on('keydown-ESC', this.escHandler);

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

        // Apply bonus chips if any
        if (drink.bonusChips) {
            GameState.addChips(drink.bonusChips);
            ToastManager.show(this.scene, `${drink.name}: +${drink.bonusChips} ◈`, 'win');
        }

        if (drink.oncePerSession) {
            _sessionClaimedBonuses.add(drink.name);
            nameLabel.setColor('#444444');
            // Immediately dim the button so the claimed state is visible without mouse-out
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
        this.scene.input.keyboard!.off('keydown-ESC', this.escHandler);
        this.overlay.destroy();
        this.container.destroy();
        this.onClose();
    }
}
