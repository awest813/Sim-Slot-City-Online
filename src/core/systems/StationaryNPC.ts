import Phaser from 'phaser';
import { DEPTH_SHADOW, FONT, COL_TRIM } from '../../game/constants';
import { SoundManager } from './SoundManager';
import { SIM_NAME_STYLE, syncSimSprite } from '../../art/actor';
import { toScreen, worldDepth } from '../../art/iso';

export class StationaryNPC {
    private scene: Phaser.Scene;
    public x: number;
    public y: number;
    public name: string;
    private textureKey: string;

    private shadow!: Phaser.GameObjects.Ellipse;
    private sprite!: Phaser.GameObjects.Image;
    private nameTag!: Phaser.GameObjects.Text;

    private quotes: string[];
    private activeBubble: Phaser.GameObjects.Container | null = null;
    private bubbleTimer: Phaser.Time.TimerEvent | null = null;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        name: string,
        textureKey: string,
        _auraColor: number,
        quotes: string[]
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.name = name;
        this.textureKey = textureKey;
        this.quotes = quotes;

        this.build();
    }

    private build(): void {
        const here = toScreen(this.x, this.y);
        this.shadow = this.scene.add
            .ellipse(here.x, here.y, 24, 10, 0x1a2410, 0.32)
            .setDepth(DEPTH_SHADOW);

        this.sprite = this.scene.add.image(here.x, here.y, this.textureKey);
        this.nameTag = this.scene.add
            .text(here.x, here.y, this.name, SIM_NAME_STYLE)
            .setOrigin(0.5, 1);
        this.place();
    }

    private place(): void {
        syncSimSprite({
            sprite: this.sprite,
            shadow: this.shadow,
            nameTag: this.nameTag,
            x: this.x,
            y: this.y,
            bob: 0,
            outfit: this.textureKey,
            facing: 'down',
            frame: 0,
        });
    }

    public interact(customQuote?: string): void {
        // Clear old bubble
        if (this.activeBubble) {
            this.activeBubble.destroy();
            this.activeBubble = null;
        }
        if (this.bubbleTimer) {
            this.bubbleTimer.remove();
            this.bubbleTimer = null;
        }

        const quote = customQuote || this.quotes[Math.floor(Math.random() * this.quotes.length)];
        
        // Play click chime sound
        SoundManager.playClick();

        // Create text object first to get measurements
        const text = this.scene.add.text(0, 0, quote, {
            fontFamily: FONT,
            fontSize: '10px',
            color: '#0a0d14',
            align: 'center',
            wordWrap: { width: 140 }
        }).setOrigin(0.5);

        const bw = Math.max(70, text.width + 16);
        const bh = text.height + 12;
        const br = 6;

        const bubbleGfx = this.scene.add.graphics();
        // shadow
        bubbleGfx.fillStyle(0x000000, 0.22);
        bubbleGfx.fillRoundedRect(-bw / 2 + 1, -bh / 2 + 2, bw, bh, br);
        // bubble container
        bubbleGfx.fillStyle(0xf0e6d3, 0.98);
        bubbleGfx.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
        bubbleGfx.fillTriangle(0, bh / 2 + 5, -5, bh / 2 - 2, 5, bh / 2 - 2);
        // gold trim
        bubbleGfx.lineStyle(1.5, COL_TRIM, 0.9);
        bubbleGfx.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, br);

        text.setPosition(0, -1);

        const here = toScreen(this.x, this.y);
        const bx = here.x;
        const by = here.y - 112 - bh / 2;

        const depth = worldDepth(this.x, this.y);

        this.activeBubble = this.scene.add.container(bx, by, [bubbleGfx, text])
            .setDepth(depth + 10)
            .setScale(0);

        // Scale pop pop-in
        this.scene.tweens.add({
            targets: this.activeBubble,
            scaleX: 1,
            scaleY: 1,
            duration: 180,
            ease: 'Back.easeOut'
        });

        // Auto destroy after 4.5 seconds
        this.bubbleTimer = this.scene.time.delayedCall(4500, () => {
            this.fadeBubble();
        });
    }

    private fadeBubble(): void {
        if (!this.activeBubble) return;
        this.scene.tweens.add({
            targets: this.activeBubble,
            alpha: 0,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 220,
            onComplete: () => {
                if (this.activeBubble) {
                    this.activeBubble.destroy();
                    this.activeBubble = null;
                }
            }
        });
    }

    public setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.place();
    }

    public destroy(): void {
        if (this.activeBubble) {
            this.activeBubble.destroy();
        }
        if (this.bubbleTimer) {
            this.bubbleTimer.remove();
        }
        this.shadow.destroy();
        this.sprite.destroy();
        this.nameTag.destroy();
    }
}
