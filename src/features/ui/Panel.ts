// Reusable modal panel base — all feature panels extend or use this.
import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_UI_BG, COL_UI_BORDER,
} from '../../game/constants';

export interface ButtonConfig {
    label: string;
    color?: number;
    hoverColor?: number;
    disabled?: boolean;
    onClick: () => void;
}

export class Panel {
    protected scene: Phaser.Scene;
    protected container!: Phaser.GameObjects.Container;
    private overlay!: Phaser.GameObjects.Rectangle;
    private bg!: Phaser.GameObjects.Rectangle;
    protected contentY: number = 60;   // current Y cursor inside panel

    constructor(scene: Phaser.Scene, protected w: number = 440, protected h: number = 360) {
        this.scene = scene;
        this.buildBase();
    }

    private buildBase(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Dim overlay
        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
            .setScrollFactor(0)
            .setDepth(DEPTH_PANEL - 1)
            .setInteractive();   // block clicks behind panel

        // Panel background
        this.bg = this.scene.add.rectangle(cx, cy, this.w, this.h, COL_UI_BG, 1)
            .setScrollFactor(0)
            .setDepth(DEPTH_PANEL)
            .setStrokeStyle(2, COL_UI_BORDER, 1);

        this.container = this.scene.add.container(cx, cy)
            .setScrollFactor(0)
            .setDepth(DEPTH_PANEL + 1);
    }

    addTitle(text: string): void {
        const title = this.scene.add.text(0, -this.h / 2 + 22, text, {
            fontFamily: 'monospace', fontSize: '18px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);

        // Divider line
        const line = this.scene.add.rectangle(0, -this.h / 2 + 38, this.w - 40, 1, COL_UI_BORDER, 0.5);

        this.container.add([title, line]);
        this.contentY = -this.h / 2 + 58;
    }

    addText(text: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
        const t = this.scene.add.text(0, this.contentY, text, {
            fontFamily: 'monospace', fontSize: '13px', color: '#f0e6d3',
            wordWrap: { width: this.w - 60 },
            align: 'center',
            ...style,
        }).setOrigin(0.5, 0);
        this.container.add(t);
        this.contentY += t.height + 10;
        return t;
    }

    addButton(cfg: ButtonConfig, fullWidth = false): Phaser.GameObjects.Container {
        const bw = fullWidth ? this.w - 60 : 160;
        const bh = 34;
        const baseFill  = cfg.disabled ? 0x1a1a1a : (cfg.color ?? 0x2a5f2a);
        const hoverFill = cfg.disabled ? 0x1a1a1a : (cfg.hoverColor ?? 0x3a7f3a);
        const pressFill = cfg.disabled ? 0x1a1a1a : Math.max(0, (cfg.color ?? 0x2a5f2a) - 0x101010);

        const rect = this.scene.add.rectangle(0, this.contentY + bh / 2, bw, bh, baseFill, 1)
            .setStrokeStyle(1, cfg.disabled ? 0x444444 : COL_UI_BORDER, cfg.disabled ? 0.4 : 0.8)
            .setInteractive({ useHandCursor: !cfg.disabled });

        const label = this.scene.add.text(0, this.contentY + bh / 2, cfg.label, {
            fontFamily: 'monospace', fontSize: '13px',
            color: cfg.disabled ? '#555555' : '#f0e6d3',
        }).setOrigin(0.5);

        if (!cfg.disabled) {
            rect.on('pointerover', () => rect.setFillStyle(hoverFill));
            rect.on('pointerout',  () => rect.setFillStyle(baseFill));
            rect.on('pointerdown', () => {
                rect.setFillStyle(pressFill);
                cfg.onClick();
            });
            rect.on('pointerup', () => rect.setFillStyle(hoverFill));
        }

        const btn = this.scene.add.container(0, 0, [rect, label]);
        this.container.add(btn);
        this.contentY += bh + 10;
        return btn;
    }

    addSpacer(h = 10): void {
        this.contentY += h;
    }

    addCloseButton(onClose: () => void): void {
        const bw = 100;
        const bh = 30;
        const by = this.h / 2 - 24;

        const rect = this.scene.add.rectangle(0, by, bw, bh, 0x3a1e1e, 1)
            .setStrokeStyle(1, 0x8a3a3a, 1)
            .setInteractive({ useHandCursor: true });

        const label = this.scene.add.text(0, by, 'Close', {
            fontFamily: 'monospace', fontSize: '12px', color: '#e05050',
        }).setOrigin(0.5);

        rect.on('pointerover', () => rect.setFillStyle(0x5a2a2a));
        rect.on('pointerout',  () => rect.setFillStyle(0x3a1e1e));
        rect.on('pointerdown', () => { rect.setFillStyle(0x2a0a0a); onClose(); });
        rect.on('pointerup',   () => rect.setFillStyle(0x5a2a2a));

        // ESC key
        this.scene.input.keyboard!.once('keydown-ESC', onClose);

        this.container.add([rect, label]);
    }

    destroy(): void {
        this.overlay.destroy();
        this.bg.destroy();
        this.container.destroy();
    }
}
