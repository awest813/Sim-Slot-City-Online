// ── ToastManager ─────────────────────────────────────────────────────────────
// Singleton that displays short floating notifications (wins, losses, bonuses).
// Usage:
//   ToastManager.show(scene, '+500 ◈', 'win');
//   ToastManager.show(scene, '-100 ◈', 'loss');
//   ToastManager.show(scene, 'BLACKJACK! 💥', 'jackpot');
//   ToastManager.show(scene, 'Free chips collected!', 'info');

import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_OVERLAY,
    FONT,
} from '../../game/constants';

export type ToastType = 'win' | 'loss' | 'jackpot' | 'info';

interface Toast {
    container: Phaser.GameObjects.Container;
    bg:        Phaser.GameObjects.Graphics;
    label:     Phaser.GameObjects.Text;
    slotY:     number;  // target Y slot index (0 = top-most)
}

const TOAST_W    = 260;
const TOAST_H    = 36;
const TOAST_X    = GAME_WIDTH / 2;       // horizontal centre
const TOAST_BASE_Y = GAME_HEIGHT - 90;   // start above hint bar
const TOAST_GAP  = TOAST_H + 6;
const MAX_TOASTS = 4;

// Per-type visual config
const TYPE_CONFIG: Record<ToastType, { fill: number; border: number; text: string; icon: string }> = {
    win:     { fill: 0x0d2e10, border: 0x2ecc71, text: '#2ecc71', icon: '▲' },
    loss:    { fill: 0x2e0d0d, border: 0xe74c3c, text: '#e74c3c', icon: '▼' },
    jackpot: { fill: 0x2e240a, border: 0xffd040, text: '#ffd040', icon: '★' },
    info:    { fill: 0x0d1828, border: 0x5090c0, text: '#80b8e0', icon: '●' },
};

const activeToasts: Toast[] = [];

export const ToastManager = {
    /** Show a floating toast notification in the given scene. */
    show(scene: Phaser.Scene, message: string, type: ToastType = 'info'): void {
        // Evict oldest if at capacity
        if (activeToasts.length >= MAX_TOASTS) {
            _dismiss(scene, activeToasts[0]);
        }

        const cfg = TYPE_CONFIG[type];
        const slotY = TOAST_BASE_Y - activeToasts.length * TOAST_GAP;

        const bg = scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY + 5);

        // Shadow
        bg.fillStyle(0x000000, 0.4);
        bg.fillRoundedRect(-TOAST_W / 2 + 2, -TOAST_H / 2 + 3, TOAST_W, TOAST_H, 6);
        // Fill
        bg.fillStyle(cfg.fill, 0.95);
        bg.fillRoundedRect(-TOAST_W / 2, -TOAST_H / 2, TOAST_W, TOAST_H, 6);
        // Top highlight
        bg.fillStyle(0xffffff, 0.04);
        bg.fillRoundedRect(-TOAST_W / 2 + 2, -TOAST_H / 2 + 2, TOAST_W - 4, TOAST_H / 2, { tl: 5, tr: 5, bl: 0, br: 0 });
        // Border
        bg.lineStyle(1.5, cfg.border, 0.85);
        bg.strokeRoundedRect(-TOAST_W / 2, -TOAST_H / 2, TOAST_W, TOAST_H, 6);
        // Left accent bar
        bg.fillStyle(cfg.border, 0.9);
        bg.fillRoundedRect(-TOAST_W / 2, -TOAST_H / 2, 4, TOAST_H, { tl: 6, bl: 6, tr: 0, br: 0 });

        const label = scene.add.text(
            0, 0,
            `${cfg.icon}  ${message}`,
            {
                fontFamily: FONT,
                fontSize: '13px',
                color: cfg.text,
                fontStyle: 'bold',
                shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 4, fill: true },
            },
        ).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_OVERLAY + 6);

        const container = scene.add.container(TOAST_X, slotY + TOAST_H, [bg, label])
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY + 5)
            .setAlpha(0);

        const toast: Toast = { container, bg, label, slotY };
        activeToasts.push(toast);

        // Slide up + fade in
        scene.tweens.add({
            targets:  container,
            y:        slotY,
            alpha:    1,
            duration: 240,
            ease: 'Back.Out',
        });

        // Auto-dismiss after 2.4 s
        scene.time.delayedCall(2400, () => {
            _dismiss(scene, toast);
        });
    },
};

function _dismiss(scene: Phaser.Scene, toast: Toast): void {
    const idx = activeToasts.indexOf(toast);
    if (idx === -1) return;
    activeToasts.splice(idx, 1);

    scene.tweens.killTweensOf(toast.container);
    scene.tweens.add({
        targets:  toast.container,
        y:        toast.slotY + TOAST_H,
        alpha:    0,
        duration: 200,
        ease: 'Sine.easeIn',
        onComplete: () => {
            toast.container.destroy();
        },
    });

    // Shift remaining toasts down to fill the gap
    for (let i = idx; i < activeToasts.length; i++) {
        const t = activeToasts[i];
        t.slotY += TOAST_GAP;
        scene.tweens.killTweensOf(t.container);
        scene.tweens.add({
            targets:  t.container,
            y:        t.slotY,
            duration: 160,
            ease: 'Sine.easeOut',
        });
    }
}
