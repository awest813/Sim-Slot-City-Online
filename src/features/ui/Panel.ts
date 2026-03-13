// Reusable modal panel base — all feature panels extend or use this.
import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_UI_BG, COL_UI_BG2, COL_UI_BORDER, COL_TRIM,
    FONT, ANIM_MED, PANEL_RADIUS,
} from '../../game/constants';

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

        const px = cx - this.w / 2;
        const py = cy - this.h / 2;

        // ── 3-layer blur-simulated drop shadow ────────────────────────────
        g.fillStyle(0x000000, 0.22);
        g.fillRoundedRect(px + 12, py + 16, this.w, this.h, PANEL_RADIUS + 4);
        g.fillStyle(0x000000, 0.38);
        g.fillRoundedRect(px + 7,  py + 10, this.w, this.h, PANEL_RADIUS + 3);
        g.fillStyle(0x000000, 0.55);
        g.fillRoundedRect(px + 4,  py + 6,  this.w, this.h, PANEL_RADIUS + 2);

        // ── 4-layer border glow (outermost first) ─────────────────────────
        g.lineStyle(12, COL_UI_BORDER, 0.04);
        g.strokeRoundedRect(px - 4, py - 4, this.w + 8, this.h + 8, PANEL_RADIUS + 5);
        g.lineStyle(8, COL_UI_BORDER, 0.06);
        g.strokeRoundedRect(px - 2, py - 2, this.w + 4, this.h + 4, PANEL_RADIUS + 3);

        // Main background
        g.fillStyle(COL_UI_BG, 1);
        g.fillRoundedRect(px, py, this.w, this.h, PANEL_RADIUS);

        // Center highlight simulation
        g.fillStyle(0x0d1830, 0.5);
        g.fillCircle(cx, cy - 30, this.w * 0.4);
        g.fillStyle(COL_UI_BG, 0.7);
        g.fillRoundedRect(px + 4, py + 4, this.w - 8, this.h - 8, PANEL_RADIUS - 2);

        // Top header band
        g.fillStyle(COL_UI_BG2, 1);
        g.fillRoundedRect(px, py, this.w, 54, { tl: PANEL_RADIUS, tr: PANEL_RADIUS, bl: 0, br: 0 });
        // Header inner highlight
        g.fillStyle(0x1a2840, 0.4);
        g.fillRoundedRect(px + 2, py + 2, this.w - 4, 24, { tl: PANEL_RADIUS - 1, tr: PANEL_RADIUS - 1, bl: 0, br: 0 });
        // Diagonal sheen stripe — thin triangle at top-right for a polished glint
        g.fillStyle(0xffffff, 0.05);
        g.fillTriangle(
            px + this.w - PANEL_RADIUS - 72, py + 1,
            px + this.w - PANEL_RADIUS - 2,  py + 1,
            px + this.w - PANEL_RADIUS - 2,  py + 46,
        );

        // Gold border — main
        g.lineStyle(2, COL_UI_BORDER, 0.9);
        g.strokeRoundedRect(px, py, this.w, this.h, PANEL_RADIUS);
        // Inner border for depth
        g.lineStyle(1, COL_UI_BORDER, 0.2);
        g.strokeRoundedRect(px + 3, py + 3, this.w - 6, this.h - 6, PANEL_RADIUS - 1);

        // ── Double-track divider (header/content) ─────────────────────────
        g.lineStyle(2, COL_TRIM, 0.7);
        g.lineBetween(px + PANEL_RADIUS, py + 54, px + this.w - PANEL_RADIUS, py + 54);
        // Inner track line 2 px below at half opacity
        g.lineStyle(1, COL_TRIM, 0.35);
        g.lineBetween(px + PANEL_RADIUS, py + 56, px + this.w - PANEL_RADIUS, py + 56);
        // Faint third line for extra depth
        g.lineStyle(0.5, COL_TRIM, 0.15);
        g.lineBetween(px + PANEL_RADIUS + 8, py + 59, px + this.w - PANEL_RADIUS - 8, py + 59);

        // ── Corner ornaments — primary + secondary L-shapes + diamond dots ─
        const orn     = 12;
        const ornPad  = PANEL_RADIUS + 4;
        const ornInset = 2;
        const op2      = ornPad + ornInset;
        const orn2     = orn - 3;

        // Primary L-shapes
        g.lineStyle(1, COL_TRIM, 0.35);
        g.lineBetween(px + ornPad,          py + ornPad,          px + ornPad + orn,      py + ornPad);
        g.lineBetween(px + ornPad,          py + ornPad,          px + ornPad,            py + ornPad + orn);
        g.lineBetween(px + this.w - ornPad, py + ornPad,          px + this.w - ornPad - orn, py + ornPad);
        g.lineBetween(px + this.w - ornPad, py + ornPad,          px + this.w - ornPad,   py + ornPad + orn);
        g.lineBetween(px + ornPad,          py + this.h - ornPad, px + ornPad + orn,      py + this.h - ornPad);
        g.lineBetween(px + ornPad,          py + this.h - ornPad, px + ornPad,            py + this.h - ornPad - orn);
        g.lineBetween(px + this.w - ornPad, py + this.h - ornPad, px + this.w - ornPad - orn, py + this.h - ornPad);
        g.lineBetween(px + this.w - ornPad, py + this.h - ornPad, px + this.w - ornPad,   py + this.h - ornPad - orn);

        // Secondary inset L-shapes (2 px inward, lower opacity)
        g.lineStyle(1, COL_TRIM, 0.16);
        g.lineBetween(px + op2,             py + op2,             px + op2 + orn2,        py + op2);
        g.lineBetween(px + op2,             py + op2,             px + op2,               py + op2 + orn2);
        g.lineBetween(px + this.w - op2,    py + op2,             px + this.w - op2 - orn2, py + op2);
        g.lineBetween(px + this.w - op2,    py + op2,             px + this.w - op2,      py + op2 + orn2);
        g.lineBetween(px + op2,             py + this.h - op2,    px + op2 + orn2,        py + this.h - op2);
        g.lineBetween(px + op2,             py + this.h - op2,    px + op2,               py + this.h - op2 - orn2);
        g.lineBetween(px + this.w - op2,    py + this.h - op2,    px + this.w - op2 - orn2, py + this.h - op2);
        g.lineBetween(px + this.w - op2,    py + this.h - op2,    px + this.w - op2,      py + this.h - op2 - orn2);

        // Diamond dots at each primary L-junction
        const dotR = 2;
        g.fillStyle(COL_TRIM, 0.5);
        g.fillRect(px + ornPad - dotR,          py + ornPad - dotR,          dotR * 2, dotR * 2);
        g.fillRect(px + this.w - ornPad - dotR, py + ornPad - dotR,          dotR * 2, dotR * 2);
        g.fillRect(px + ornPad - dotR,          py + this.h - ornPad - dotR, dotR * 2, dotR * 2);
        g.fillRect(px + this.w - ornPad - dotR, py + this.h - ornPad - dotR, dotR * 2, dotR * 2);
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
        const baseFill  = cfg.disabled ? 0x1a1a1a : (cfg.color ?? 0x1a5028);
        const hoverFill = cfg.disabled ? 0x1a1a1a : (cfg.hoverColor ?? lighten(baseFill));
        const pressFill = cfg.disabled ? 0x1a1a1a : darken(baseFill);
        const r = 4;

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
            const bCol = cfg.disabled ? 0x333333 : COL_UI_BORDER;
            const bAlpha = cfg.disabled ? 0.3 : hover ? 0.9 : 0.65;
            gfx.lineStyle(1, bCol, bAlpha);
            gfx.strokeRoundedRect(-bw / 2, by - bh / 2, bw, bh, r);
        };

        drawBtn(baseFill);

        const hitRect = this.scene.add.rectangle(0, by, bw, bh, 0x000000, 0)
            .setInteractive(cfg.disabled ? undefined as any : { useHandCursor: true });

        const label = this.scene.add.text(0, by, cfg.label, {
            fontFamily: FONT, fontSize: '12px',
            color: cfg.disabled ? '#555555' : '#f0e6d3',
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
        const r   = 4;

        const gfx = this.scene.add.graphics();
        const drawClose = (hover: boolean): void => {
            gfx.clear();
            gfx.fillStyle(hover ? 0x5c2020 : 0x3a1818, 1);
            gfx.fillRoundedRect(-bw / 2, by - bh / 2, bw, bh, r);
            gfx.lineStyle(1, hover ? 0xaa3a3a : 0x7a2a2a, 0.9);
            gfx.strokeRoundedRect(-bw / 2, by - bh / 2, bw, bh, r);
        };
        drawClose(false);

        const hitRect = this.scene.add.rectangle(0, by, bw, bh, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        const label = this.scene.add.text(0, by, '✕  Close', {
            fontFamily: FONT, fontSize: '12px', color: '#dd5050',
        }).setOrigin(0.5);

        hitRect.on('pointerover',  () => { drawClose(true);  label.setColor('#ff6060'); });
        hitRect.on('pointerout',   () => { drawClose(false); label.setColor('#dd5050'); });
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
