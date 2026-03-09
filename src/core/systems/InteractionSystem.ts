import Phaser from 'phaser';
import { INTERACT_RADIUS, DEPTH_OVERLAY, COL_UI_BG, COL_UI_BORDER, TEXT_SM } from '../../game/constants';

export interface Hotspot {
    id: string;
    x: number;
    y: number;
    radius?: number;
    label: string;             // e.g. "Press E to play slots"
    onInteract: () => void;
}

export class InteractionSystem {
    private scene: Phaser.Scene;
    private hotspots: Hotspot[] = [];
    private promptBg!: Phaser.GameObjects.Rectangle;
    private promptText!: Phaser.GameObjects.Text;
    private activeHotspot: Hotspot | null = null;
    private eKey!: Phaser.Input.Keyboard.Key;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.buildPromptUI();
        this.eKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }

    private buildPromptUI(): void {
        const pw = 220;
        const ph = 28;
        const px = this.scene.scale.width / 2;
        const py = this.scene.scale.height - 52;

        this.promptBg = this.scene.add.rectangle(px, py, pw, ph, COL_UI_BG, 0.92)
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY)
            .setVisible(false);

        this.promptBg.setStrokeStyle(1, COL_UI_BORDER, 1);

        this.promptText = this.scene.add.text(px, py, '', {
            ...TEXT_SM,
            color: '#c9a84c',
        })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(DEPTH_OVERLAY + 1)
            .setVisible(false);
    }

    register(hotspot: Hotspot): void {
        this.hotspots.push(hotspot);
    }

    unregister(id: string): void {
        this.hotspots = this.hotspots.filter(h => h.id !== id);
    }

    update(playerX: number, playerY: number): void {
        let nearest: Hotspot | null = null;
        let nearestDist = Infinity;

        for (const h of this.hotspots) {
            const radius = h.radius ?? INTERACT_RADIUS;
            const dx = h.x - playerX;
            const dy = h.y - playerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius && dist < nearestDist) {
                nearestDist = dist;
                nearest = h;
            }
        }

        if (nearest !== this.activeHotspot) {
            this.activeHotspot = nearest;
            if (nearest) {
                this.promptText.setText(nearest.label);
                this.promptBg.setVisible(true);
                this.promptText.setVisible(true);
            } else {
                this.promptBg.setVisible(false);
                this.promptText.setVisible(false);
            }
        }

        if (this.activeHotspot && Phaser.Input.Keyboard.JustDown(this.eKey)) {
            this.activeHotspot.onInteract();
        }
    }

    destroy(): void {
        this.promptBg.destroy();
        this.promptText.destroy();
    }
}
