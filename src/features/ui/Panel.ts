// Reusable modal panel base — all feature panels extend or use this.
import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    FONT, ANIM_MED,
} from '../../game/constants';
import { paintLifeSimShell } from './shell';

export interface ButtonConfig {
    label:      string;
    color?:     number;
    hoverColor?: number;
    disabled?:  boolean;
    onClick:    () => void;
}

export class Panel {
    protected scene:     Phaser.Scene;
    protected container!: Phaser.GameObjects.Container;
    private   overlay!:   Phaser.GameObjects.Rectangle;
    private   panelGfx!:  Phaser.GameObjects.Graphics;
    protected contentY = 60;       // current Y cursor inside panel (relative to container center)
    private   escCloseHandler: (() => void) | null = null;

    constructor(
        scene: Phaser.Scene,
        protected w = 440,
        protected h = 360,
    ) {
        this.scene = scene;
        this.buildBase();
    }

    private buildBase(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // ── Dim overlay ────────────────────────────────────────────────────
        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
            .setScrollFactor(0)
            .setDepth(DEPTH_PANEL - 1)
            .setInteractive();   // block clicks behind panel
        this.overlay.setAlpha(0);
        this.scene.tweens.add({ targets: this.overlay, alpha: 1, duration: ANIM_MED, ease: 'Sine.easeOut' });

        // ── Panel graphics (bg + border via Graphics for rounded rect) ─────
        this.panelGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_PANEL);

        this.drawPanelBg();

        // ── Content container ──────────────────────────────────────────────
        this.container = this.scene.add.container(cx, cy)
            .setScrollFactor(0)
            .setDepth(DEPTH_PANEL + 1);

        // Entrance animation — scale up from slightly smaller + fade in
        this.container.setAlpha(0);
        this.container.setScale(0.93);
        this.scene.tweens.add({
            targets: this.container,
            alpha:   1,
            scaleX:  1,
            scaleY:  1,
            duration: ANIM_MED,
            ease: 'Back.Out',
        });
    }

    private drawPanelBg(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const g  = this.panelGfx;
        g.clear();

        paintLifeSimShell(g, cx - this.w / 2, cy - this.h / 2, this.w, this.h);
    }

    addTitle(text: string): void {
        const title = this.scene.add.text(0, -this.h / 2 + 26, text, {
            fontFamily: FONT, fontSize: '18px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.container.add(title);
        this.contentY = -this.h / 2 + 64;
    }

    addText(
        text: string,
        style: Phaser.Types.GameObjects.Text.TextStyle = {},
    ): Phaser.GameObjects.Text {
        const t = this.scene.add.text(0, this.contentY, text, {
            fontFamily: FONT, fontSize: '13px', color: '#e8dcc8',
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
        const baseFill  = cfg.disabled ? 0x8aa39c : (cfg.color ?? 0xe7fff4);
        const hoverFill = cfg.disabled ? 0x8aa39c : (cfg.hoverColor ?? lighten(baseFill));
        const pressFill = cfg.disabled ? 0x8aa39c : darken(baseFill);
        const r = 10;
        const ink = cfg.disabled ? '#5c6e6a' : (isLight(baseFill) ? '#0e3f38' : '#f4fff8');

        // Use Graphics for rounded button background
        const gfx = this.scene.add.graphics();
        const by = this.contentY + bh / 2;

        const drawBtn = (fill: number, hover = false): void => {
            gfx.clear();
            // Shadow
            gfx.fillStyle(0x000000, 0.3);
            gfx.fillRoundedRect(-bw / 2 + 1, by - bh / 2 + 2, bw, bh, r);
            // Fill
            gfx.fillStyle(fill, 1);
            gfx.fillRoundedRect(-bw / 2, by - bh / 2, bw, bh, r);
            // Top highlight
            if (!cfg.disabled) {
                gfx.fillStyle(0xffffff, 0.05);
                gfx.fillRoundedRect(-bw / 2 + 2, by - bh / 2 + 2, bw - 4, bh / 2 - 2, { tl: r - 1, tr: r - 1, bl: 0, br: 0 });
            }
            // Border
            const bCol = cfg.disabled ? 0x5c6e6a : 0x0e3f38;
            const bAlpha = cfg.disabled ? 0.3 : hover ? 0.9 : 0.65;
            gfx.lineStyle(1, bCol, bAlpha);
            gfx.strokeRoundedRect(-bw / 2, by - bh / 2, bw, bh, r);
        };

        drawBtn(baseFill);

        const hitRect = this.scene.add.rectangle(0, by, bw, bh, 0x000000, 0);
        if (cfg.disabled) {
            hitRect.disableInteractive();
        } else {
            hitRect.setInteractive({ useHandCursor: true });
        }

        const label = this.scene.add.text(0, by, cfg.label, {
            fontFamily: FONT, fontSize: '12px',
            color: ink,
        }).setOrigin(0.5);

        if (!cfg.disabled) {
            hitRect.on('pointerover',  () => drawBtn(hoverFill, true));
            hitRect.on('pointerout',   () => drawBtn(baseFill,  false));
            hitRect.on('pointerdown',  () => { drawBtn(pressFill, false); cfg.onClick(); });
            hitRect.on('pointerup',    () => drawBtn(hoverFill, true));
        }

        const btn = this.scene.add.container(0, 0, [gfx, hitRect, label]);
        this.container.add(btn);
        this.contentY += bh + 10;
        return btn;
    }

    addSpacer(h = 10): void {
        this.contentY += h;
    }

    /**
     * Adds a styled close button anchored to the bottom-center of the panel,
     * and wires the ESC key to the same callback.
     */
    addCloseButton(onClose: () => void): void {
        const bw  = 110;
        const bh  = 30;
        const by  = this.h / 2 - 22;
        const r   = 10;

        const gfx = this.scene.add.graphics();
        const drawClose = (hover: boolean): void => {
            gfx.clear();
            gfx.fillStyle(hover ? 0xffffff : 0xe7fff4, 1);
            gfx.fillRoundedRect(-bw / 2, by - bh / 2, bw, bh, r);
            gfx.lineStyle(1.5, 0x0e3f38, 0.85);
            gfx.strokeRoundedRect(-bw / 2, by - bh / 2, bw, bh, r);
        };
        drawClose(false);

        const hitRect = this.scene.add.rectangle(0, by, bw, bh, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const label = this.scene.add.text(0, by, 'Close', {
            fontFamily: FONT, fontSize: '12px', color: '#0e3f38', fontStyle: 'bold',
        }).setOrigin(0.5);

        hitRect.on('pointerover',  () => drawClose(true));
        hitRect.on('pointerout',   () => drawClose(false));
        hitRect.on('pointerdown',  () => onClose());

        this.escCloseHandler = onClose;
        this.scene.input.keyboard!.on('keydown-ESC', onClose);

        this.container.add([gfx, hitRect, label]);
    }

    destroy(): void {
        if (this.escCloseHandler) {
            this.scene.input.keyboard!.off('keydown-ESC', this.escCloseHandler);
            this.escCloseHandler = null;
        }
        this.overlay.destroy();
        this.panelGfx.destroy();
        this.container.destroy();
    }
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function isLight(hex: number): boolean {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    return r + g + b > 420;
}

function lighten(hex: number, amount = 32): number {
    const r = Math.min(255, ((hex >> 16) & 0xff) + amount);
    const g = Math.min(255, ((hex >>  8) & 0xff) + amount);
    const b = Math.min(255, ( hex        & 0xff) + amount);
    return (r << 16) | (g << 8) | b;
}

function darken(hex: number, amount = 20): number {
    const r = Math.max(0, ((hex >> 16) & 0xff) - amount);
    const g = Math.max(0, ((hex >>  8) & 0xff) - amount);
    const b = Math.max(0, ( hex        & 0xff) - amount);
    return (r << 16) | (g << 8) | b;
}
