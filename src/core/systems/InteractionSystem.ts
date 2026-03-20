import Phaser from 'phaser';
import { INTERACT_RADIUS, DEPTH_OVERLAY, COL_UI_BG, COL_UI_BORDER, COL_TRIM, FONT } from '../../game/constants';

export interface Hotspot {
    id:          string;
    x:           number;
    y:           number;
    radius?:     number;
    label:       string;       // e.g. "Play Slots"
    onInteract:  () => void;
}

export class InteractionSystem {
    private scene:         Phaser.Scene;
    private hotspots:      Hotspot[] = [];
    private promptGfx!:    Phaser.GameObjects.Graphics;
    private promptText!:   Phaser.GameObjects.Text;
    private keyBadgeBg!:   Phaser.GameObjects.Graphics;
    private keyBadgeText!: Phaser.GameObjects.Text;
    private pulseRingGfx!: Phaser.GameObjects.Graphics;
    private pulseTween:    Phaser.Tweens.Tween | null = null;
    private activeHotspot: Hotspot | null = null;
    private eKey!:         Phaser.Input.Keyboard.Key;

    // Current prompt dimensions (rebuilt when label changes)
    private readonly PROMPT_H = 34;
    private readonly KEY_BADGE_W = 26;
    private readonly PAD_X = 14;
    private readonly PROMPT_Y: number;

    constructor(scene: Phaser.Scene) {
        this.scene    = scene;
        this.PROMPT_Y = scene.scale.height - 54;
        this.buildPromptUI();
        this.eKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }

    private buildPromptUI(): void {
        const cx = this.scene.scale.width / 2;
        const py = this.PROMPT_Y;

        // Pulse ring — expands outward behind the prompt pill
        this.pulseRingGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY - 1)
            .setVisible(false);

        // Background Graphics (drawn dynamically to fit label width)
        this.promptGfx = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY)
            .setVisible(false)
            .setAlpha(0);

        // [E] key badge background
        this.keyBadgeBg = this.scene.add.graphics()
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY + 1)
            .setVisible(false)
            .setAlpha(0);

        // [E] key label
        this.keyBadgeText = this.scene.add.text(cx, py, 'E', {
            fontFamily: FONT, fontSize: '11px', color: '#c9a84c', fontStyle: 'bold',
        })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY + 2)
            .setVisible(false)
            .setAlpha(0);

        // Prompt text
        this.promptText = this.scene.add.text(cx, py, '', {
            fontFamily: FONT, fontSize: '12px', color: '#e0d0a0',
        })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY + 2)
            .setVisible(false)
            .setAlpha(0);
    }

    register(hotspot: Hotspot): void {
        this.hotspots.push(hotspot);
    }

    unregister(id: string): void {
        this.hotspots = this.hotspots.filter(h => h.id !== id);
    }

    update(playerX: number, playerY: number): void {
        let nearest:     Hotspot | null = null;
        let nearestDist: number         = Infinity;

        for (const h of this.hotspots) {
            const radius = h.radius ?? INTERACT_RADIUS;
            const dx     = h.x - playerX;
            const dy     = h.y - playerY;
            const dist   = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius && dist < nearestDist) {
                nearestDist = dist;
                nearest     = h;
            }
        }

        if (nearest !== this.activeHotspot) {
            this.activeHotspot = nearest;
            if (nearest) {
                this.showPrompt(nearest.label);
            } else {
                this.hidePrompt();
            }
        }

        if (this.activeHotspot && Phaser.Input.Keyboard.JustDown(this.eKey)) {
            this.activeHotspot.onInteract();
        }
    }

    private showPrompt(label: string): void {
        const cx  = this.scene.scale.width / 2;
        const py  = this.PROMPT_Y;
        const h   = this.PROMPT_H;
        const pad = this.PAD_X;
        const kbW = this.KEY_BADGE_W;

        // Update label text first to get its width
        this.promptText.setText(label);
        const labelW = this.promptText.width;

        // Total pill width: [E badge] + gap + text + padding both sides
        const pillW  = kbW + 8 + labelW + pad * 2;
        const pillX  = cx - pillW / 2;
        const pillY  = py - h / 2;

        // Redraw background pill
        const g = this.promptGfx;
        g.clear();
        // Shadow
        g.fillStyle(0x000000, 0.5);
        g.fillRoundedRect(pillX + 2, pillY + 3, pillW, h, h / 2);
        // Pill fill
        g.fillStyle(COL_UI_BG, 0.92);
        g.fillRoundedRect(pillX, pillY, pillW, h, h / 2);
        // Gold border
        g.lineStyle(1.5, COL_UI_BORDER, 0.7);
        g.strokeRoundedRect(pillX, pillY, pillW, h, h / 2);

        // [E] badge background (left side of pill)
        const kb = this.keyBadgeBg;
        const kbX = pillX + 4;
        const kbR = (h - 8) / 2;
        kb.clear();
        kb.fillStyle(0x1a1a0a, 1);
        kb.fillRoundedRect(kbX, pillY + 4, kbW, h - 8, kbR);
        kb.lineStyle(1, COL_TRIM, 0.65);
        kb.strokeRoundedRect(kbX, pillY + 4, kbW, h - 8, kbR);

        // Position [E] text center of badge
        this.keyBadgeText.setPosition(kbX + kbW / 2, py);

        // Position label text: right of badge with gap
        this.promptText.setOrigin(0, 0.5);
        this.promptText.setPosition(kbX + kbW + 8, py);

        // Make all visible
        this.promptGfx.setVisible(true);
        this.keyBadgeBg.setVisible(true);
        this.keyBadgeText.setVisible(true);
        this.promptText.setVisible(true);

        // Cancel any hide tween and fade in
        this.scene.tweens.killTweensOf([this.promptGfx, this.keyBadgeBg, this.keyBadgeText, this.promptText]);
        this.scene.tweens.add({
            targets:  [this.promptGfx, this.keyBadgeBg, this.keyBadgeText, this.promptText],
            alpha:    1,
            y:        '+=0',   // no Y change; just alpha
            duration: 180,
            ease: 'Sine.easeOut',
        });

        // Subtle bounce scale on show
        this.promptGfx.setScale(0.92, 0.9);
        this.keyBadgeText.setScale(0.9);
        this.promptText.setScale(0.92);
        this.scene.tweens.add({
            targets:  [this.promptGfx, this.keyBadgeText, this.promptText],
            scaleX:   1,
            scaleY:   1,
            duration: 220,
            ease: 'Back.Out',
        });

        // Pulsing ring — expands and fades behind the pill
        this.startPulseRing(pillX, pillY, pillW, h);
    }

    private startPulseRing(pillX: number, pillY: number, pillW: number, h: number): void {
        const g = this.pulseRingGfx;
        g.clear();
        g.lineStyle(2, COL_TRIM, 0.75);
        g.strokeRoundedRect(pillX - 3, pillY - 3, pillW + 6, h + 6, h / 2 + 3);
        g.setVisible(true);
        g.setAlpha(0.75);
        g.setScale(1);

        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
        this.pulseTween = this.scene.tweens.add({
            targets:  g,
            alpha:    { from: 0.65, to: 0 },
            scaleX:   { from: 1.0,  to: 1.10 },
            scaleY:   { from: 1.0,  to: 1.25 },
            duration: 850,
            ease:     'Sine.easeOut',
            repeat:   -1,
            repeatDelay: 100,
        });
    }

    private hidePrompt(): void {
        // Stop pulse ring
        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
        this.pulseRingGfx.setVisible(false);

        this.scene.tweens.killTweensOf([this.promptGfx, this.keyBadgeBg, this.keyBadgeText, this.promptText]);
        this.scene.tweens.add({
            targets:  [this.promptGfx, this.keyBadgeBg, this.keyBadgeText, this.promptText],
            alpha:    0,
            duration: 150,
            ease: 'Sine.easeIn',
            onComplete: () => {
                this.promptGfx.setVisible(false);
                this.keyBadgeBg.setVisible(false);
                this.keyBadgeText.setVisible(false);
                this.promptText.setVisible(false);
            },
        });
    }

    destroy(): void {
        if (this.pulseTween) {
            this.pulseTween.stop();
            this.pulseTween = null;
        }
        this.eKey.destroy();
        this.pulseRingGfx.destroy();
        this.promptGfx.destroy();
        this.keyBadgeBg.destroy();
        this.keyBadgeText.destroy();
        this.promptText.destroy();
    }
}
