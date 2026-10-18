import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT,
    COL_TRIM, COL_TRIM_LIGHT
} from '../../game/constants';
import { SoundManager } from '../../core/systems/SoundManager';

export interface RadialEmote {
    emoji: string;
    label: string;
}

const EMOTES: RadialEmote[] = [
    { emoji: '😂', label: 'LAUGH' },
    { emoji: '😢', label: 'CRY' },
    { emoji: '❤️', label: 'HEART' },
    { emoji: '👍', label: 'THUMBS UP' },
    { emoji: '😠', label: 'ANGRY' },
    { emoji: '😮', label: 'SURPRISE' }
];

export class EmoteRadialMenu extends Phaser.GameObjects.Container {
    private overlay!: Phaser.GameObjects.Graphics;
    private menuGfx!: Phaser.GameObjects.Graphics;
    private emojiTexts: Phaser.GameObjects.Text[] = [];
    private labelText!: Phaser.GameObjects.Text;
    private onSelect: (emoji: string) => void;
    
    private selectedIdx: number = -1;
    private innerR = 40;
    private outerR = 120;

    constructor(scene: Phaser.Scene, x: number, y: number, onSelect: (emoji: string) => void) {
        super(scene, x, y);
        this.onSelect = onSelect;

        // Set to screen HUD layer
        this.setScrollFactor(0);
        this.setDepth(9000);

        // 1. Dark backdrop overlay
        this.overlay = scene.add.graphics();
        this.overlay.fillStyle(0x040814, 0.55);
        this.overlay.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
        this.add(this.overlay);

        // Make overlay interactive to block clicks to the world
        this.overlay.setInteractive(
            new Phaser.Geom.Rectangle(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT),
            Phaser.Geom.Rectangle.Contains
        );

        // 2. Menu graphics (ring, slices, glowing borders)
        this.menuGfx = scene.add.graphics();
        this.add(this.menuGfx);

        // 3. Central label
        this.labelText = scene.add.text(0, 0, 'PICK\nEMOTE', {
            fontFamily: 'Verdana, Trebuchet MS, sans-serif',
            fontSize: '11px',
            color: '#e7fff6',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        this.add(this.labelText);

        // 4. Populate emoji text objects
        const N = EMOTES.length;
        for (let i = 0; i < N; i++) {
            const angle = (i * Math.PI * 2) / N;
            const midR = (this.innerR + this.outerR) / 2 + 5;
            const ex = Math.cos(angle) * midR;
            const ey = Math.sin(angle) * midR;

            const txt = scene.add.text(ex, ey, EMOTES[i].emoji, {
                fontSize: '28px'
            }).setOrigin(0.5);

            this.emojiTexts.push(txt);
            this.add(txt);
        }

        // Draw initial state
        this.drawMenu();

        // Register in scene
        scene.add.existing(this);
    }

    updateMenu(pointer: Phaser.Input.Pointer): void {
        // Calculate distance and angle relative to radial center (this.x, this.y)
        const dx = pointer.x - this.x;
        const dy = pointer.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let newSelected = -1;

        if (dist >= this.innerR && dist <= this.outerR + 15) {
            // Angle between -PI and PI
            const angle = Math.atan2(dy, dx);
            // Shift angle so segment 0 is centered at 0 radians (spanning [-PI/6, PI/6])
            let shifted = angle + Math.PI / EMOTES.length;
            if (shifted < 0) {
                shifted += Math.PI * 2;
            }
            newSelected = Math.floor((shifted % (Math.PI * 2)) / (Math.PI / 3));
        }

        if (newSelected !== this.selectedIdx) {
            this.selectedIdx = newSelected;
            this.drawMenu();
        }
    }

    private drawMenu(): void {
        const g = this.menuGfx;
        g.clear();

        const N = EMOTES.length;
        const segmentAngle = (Math.PI * 2) / N;

        // Draw overall base ring shadow/backing
        g.fillStyle(0x14675c, 0.96);
        g.fillCircle(0, 0, this.outerR);

        g.fillStyle(0x0e3f38, 1);
        g.fillCircle(0, 0, this.innerR);

        // Draw segments
        for (let i = 0; i < N; i++) {
            const startAng = i * segmentAngle - Math.PI / N;
            const endAng = (i + 1) * segmentAngle - Math.PI / N;
            const isHovered = (i === this.selectedIdx);

            // Highlight hovered segment
            if (isHovered) {
                g.fillStyle(0x1faf98, 0.95);
                g.slice(0, 0, this.outerR + 5, startAng, endAng, false);
                g.fillPath();

                // Glowing outer rim slice
                g.lineStyle(3.5, COL_TRIM_LIGHT, 1);
                g.beginPath();
                g.arc(0, 0, this.outerR + 5, startAng, endAng, false);
                g.strokePath();

                // Update text label in center
                this.labelText.setText(EMOTES[i].label).setColor('#fff6e8');
                
                // Scale up hovered emoji slightly
                this.scene.tweens.add({
                    targets: this.emojiTexts[i],
                    scaleX: 1.35, scaleY: 1.35,
                    duration: 80,
                    overwrite: true
                });
            } else {
                // Return non-hovered emoji to normal scale
                this.scene.tweens.add({
                    targets: this.emojiTexts[i],
                    scaleX: 1, scaleY: 1,
                    duration: 80,
                    overwrite: true
                });
            }

            // Draw slice separator lines
            g.lineStyle(1.5, COL_TRIM, isHovered ? 0.4 : 0.15);
            const lineX = Math.cos(startAng) * this.outerR;
            const lineY = Math.sin(startAng) * this.outerR;
            g.lineBetween(0, 0, lineX, lineY);
        }

        // Draw inner and outer golden borders
        g.lineStyle(2, COL_TRIM, 0.85);
        g.strokeCircle(0, 0, this.innerR);
        g.lineStyle(1, COL_TRIM, 0.3);
        g.strokeCircle(0, 0, this.outerR);

        if (this.selectedIdx === -1) {
            this.labelText.setText('SELECT\nEMOTE').setColor('#c9a84c');
        }
    }

    confirmSelection(): void {
        if (this.selectedIdx >= 0 && this.selectedIdx < EMOTES.length) {
            const emoji = EMOTES[this.selectedIdx].emoji;
            this.onSelect(emoji);
            SoundManager.playClick();

            const selectedText = this.emojiTexts[this.selectedIdx];
            
            // Pop/scale and fade the selected emoji text
            this.scene.tweens.add({
                targets: selectedText,
                scaleX: 1.8,
                scaleY: 1.8,
                alpha: 0,
                duration: 180,
                ease: 'Quad.easeOut',
                onComplete: () => {
                    this.destroyMenu();
                }
            });

            // Fade out other menu UI elements simultaneously
            this.scene.tweens.add({
                targets: [this.overlay, this.menuGfx, this.labelText],
                alpha: 0,
                duration: 140
            });

            // Hide other emoji texts immediately
            this.emojiTexts.forEach((t, idx) => {
                if (idx !== this.selectedIdx) {
                    t.setVisible(false);
                }
            });
        } else {
            this.destroyMenu();
        }
    }

    destroyMenu(): void {
        this.overlay.destroy();
        this.menuGfx.destroy();
        this.emojiTexts.forEach(t => t.destroy());
        this.labelText.destroy();
        this.destroy();
    }
}
