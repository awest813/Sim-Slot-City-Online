// ── Bar & Lounge interaction panel ───────────────────────────────────────────
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL, COL_TRIM,
} from '../../game/constants';

interface DrinkOption {
    name: string;
    cost: number;
    emoji: string;
    flavor: string;
    statusMsg: string;
}

const DRINKS: DrinkOption[] = [
    {
        name: 'Lucky Lemonade',
        cost: 5,
        emoji: '🍋',
        flavor: 'Tangy and bright — just like your luck tonight.',
        statusMsg: '★ Lucky Lemonade  |  A classic choice.',
    },
    {
        name: 'High Roller Bourbon',
        cost: 20,
        emoji: '🥃',
        flavor: 'Smooth. Expensive. Worth it.',
        statusMsg: '★ High Roller Bourbon  |  The good stuff.',
    },
    {
        name: 'House Sparkling',
        cost: 10,
        emoji: '🥂',
        flavor: "The casino's complimentary vintage. Respectable.",
        statusMsg: '★ House Sparkling  |  Celebrate early.',
    },
    {
        name: 'Jackpot Juice',
        cost: 0,
        emoji: '🧃',
        flavor: 'On the house. Every guest gets one.',
        statusMsg: '★ Jackpot Juice  |  Free! Enjoy.',
    },
];

export class BarPanel {
    private scene: Phaser.Scene;
    private onClose: () => void;

    private overlay!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private chipsText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene = scene;
        this.onClose = onClose;
        this.build();
    }

    private build(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const pw = 460;
        const ph = 380;

        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();

        this.container = this.scene.add.container(cx, cy).setScrollFactor(0).setDepth(DEPTH_PANEL + 1);

        // Panel BG — warm wood tones
        const bg = this.scene.add.rectangle(0, 0, pw, ph, 0x1e0f05, 1)
            .setStrokeStyle(2, COL_TRIM, 1);
        this.container.add(bg);

        // Wood grain stripes (visual texture)
        for (let i = 0; i < 6; i++) {
            const stripe = this.scene.add.rectangle(0, -ph / 2 + 50 + i * 56, pw - 4, 1, 0x2a1a08, 0.5);
            this.container.add(stripe);
        }

        // Title
        const title = this.scene.add.text(0, -ph / 2 + 22, '🍹  BAR & LOUNGE', {
            fontFamily: 'monospace', fontSize: '18px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        const divider = this.scene.add.rectangle(0, -ph / 2 + 40, pw - 40, 1, COL_TRIM, 0.5);
        this.container.add([title, divider]);

        // Bartender greeting
        const greet = this.scene.add.text(0, -ph / 2 + 56, '"What can I get for you tonight?"', {
            fontFamily: 'monospace', fontSize: '12px', color: '#a08050',
            fontStyle: 'italic',
        }).setOrigin(0.5);
        this.container.add(greet);

        // Chips display
        this.chipsText = this.scene.add.text(-pw / 2 + 16, -ph / 2 + 74, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#2ecc71',
        }).setOrigin(0, 0);
        this.container.add(this.chipsText);

        // Drink buttons
        const startY = -ph / 2 + 98;
        const bh = 42;
        const gap = 6;

        DRINKS.forEach((drink, i) => {
            const by = startY + i * (bh + gap) + bh / 2;

            const rect = this.scene.add.rectangle(0, by, pw - 60, bh, 0x2a1505, 1)
                .setStrokeStyle(1, 0x5a3010, 1)
                .setInteractive({ useHandCursor: true });

            const nameLabel = this.scene.add.text(-pw / 2 + 50, by - 9, `${drink.emoji}  ${drink.name}`, {
                fontFamily: 'monospace', fontSize: '13px', color: '#d4b070',
            }).setOrigin(0, 0.5);

            const costLabel = this.scene.add.text(pw / 2 - 70, by, drink.cost === 0 ? 'FREE' : `${drink.cost}◈`, {
                fontFamily: 'monospace', fontSize: '12px', color: drink.cost === 0 ? '#2ecc71' : '#c9a84c',
            }).setOrigin(0.5);

            const descLabel = this.scene.add.text(-pw / 2 + 50, by + 9, `"${drink.flavor}"`, {
                fontFamily: 'monospace', fontSize: '10px', color: '#705030',
                fontStyle: 'italic',
            }).setOrigin(0, 0.5);

            rect.on('pointerover', () => rect.setFillStyle(0x3a2010));
            rect.on('pointerout',  () => rect.setFillStyle(0x2a1505));
            rect.on('pointerdown', () => this.orderDrink(drink));

            this.container.add([rect, nameLabel, descLabel, costLabel]);
        });

        // Status message area
        const statusY = ph / 2 - 62;
        const statusBg = this.scene.add.rectangle(0, statusY, pw - 40, 30, 0x0d0804, 0.8)
            .setStrokeStyle(1, 0x3a2010, 0.6);
        this.statusText = this.scene.add.text(0, statusY, 'Select a drink...', {
            fontFamily: 'monospace', fontSize: '11px', color: '#666644',
        }).setOrigin(0.5);
        this.container.add([statusBg, this.statusText]);

        // Close button
        const closeRect = this.scene.add.rectangle(0, ph / 2 - 26, 120, 28, 0x3a1e1e, 1)
            .setStrokeStyle(1, 0x8a3a3a, 1)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(0, ph / 2 - 26, 'Leave Bar', {
            fontFamily: 'monospace', fontSize: '12px', color: '#e05050',
        }).setOrigin(0.5);

        closeRect.on('pointerover', () => closeRect.setFillStyle(0x5a2a2a));
        closeRect.on('pointerout',  () => closeRect.setFillStyle(0x3a1e1e));
        closeRect.on('pointerdown', () => this.close());

        this.container.add([closeRect, closeLabel]);

        this.scene.input.keyboard!.once('keydown-ESC', () => this.close());

        this.updateChips();
    }

    private updateChips(): void {
        this.chipsText.setText(`◈ ${GameState.get().chips.toLocaleString()} chips`);
    }

    private orderDrink(drink: DrinkOption): void {
        const chips = GameState.get().chips;
        if (drink.cost > chips) {
            this.statusText.setText('Not enough chips!').setColor('#e74c3c');
            return;
        }

        GameState.addChips(-drink.cost);
        this.updateChips();
        this.statusText.setText(drink.statusMsg).setColor('#c9a84c');

        // Flash
        this.scene.tweens.add({
            targets: this.statusText,
            alpha: 0,
            yoyo: true,
            duration: 120,
            repeat: 1,
            onComplete: () => this.statusText.setAlpha(1),
        });
    }

    private close(): void {
        this.overlay.destroy();
        this.container.destroy();
        this.onClose();
    }
}
