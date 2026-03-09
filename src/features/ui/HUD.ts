import Phaser from 'phaser';
import { GameState, PlayerState, Zone } from '../../core/state/GameState';
import {
    DEPTH_HUD, COL_UI_BG, COL_UI_BORDER,
} from '../../game/constants';

const ZONE_LABELS: Record<Zone, string> = {
    entrance: 'Entrance',
    slots:    'Slots Corner',
    poker:    'Poker Room',
    bar:      'Bar & Lounge',
    floor:    'Casino Floor',
};

export class HUD {
    private scene: Phaser.Scene;
    private bg!: Phaser.GameObjects.Rectangle;
    private nameText!: Phaser.GameObjects.Text;
    private chipsText!: Phaser.GameObjects.Text;
    private zoneText!: Phaser.GameObjects.Text;
    private unsub!: () => void;
    private prevChips: number = -1;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.build();
    }

    private build(): void {
        const padX = 12;
        const h    = 44;
        const w    = 340;
        const y    = h / 2;

        // Background bar
        this.bg = this.scene.add.rectangle(0, 0, w, h, COL_UI_BG, 0.88)
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD)
            .setOrigin(0, 0);
        this.bg.setStrokeStyle(1, COL_UI_BORDER, 0.7);

        // Player name
        this.nameText = this.scene.add.text(padX, y - 7, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#c9a84c',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // Chip balance
        this.chipsText = this.scene.add.text(padX, y + 8, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#2ecc71',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(0, 0.5);

        // Zone label (right side)
        this.zoneText = this.scene.add.text(w - padX, y, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#888888',
        })
            .setScrollFactor(0)
            .setDepth(DEPTH_HUD + 1)
            .setOrigin(1, 0.5);

        this.unsub = GameState.subscribe(s => this.refresh(s));
        const initial = GameState.get();
        this.prevChips = initial.chips;
        this.refresh(initial);
    }

    private refresh(s: PlayerState): void {
        this.nameText.setText(`★ ${s.displayName}`);
        this.chipsText.setText(`◈ ${s.chips.toLocaleString()} chips`);
        this.zoneText.setText(ZONE_LABELS[s.zone] ?? s.zone);

        // Flash chip counter green on gain, red on loss, then restore
        if (this.prevChips >= 0 && s.chips !== this.prevChips) {
            const flashColor = s.chips > this.prevChips ? '#2ecc71' : '#e74c3c';
            this.chipsText.setColor(flashColor);
            this.scene.time.delayedCall(600, () => {
                this.chipsText.setColor('#2ecc71');
            });
        }
        this.prevChips = s.chips;
    }

    destroy(): void {
        this.unsub();
        this.bg.destroy();
        this.nameText.destroy();
        this.chipsText.destroy();
        this.zoneText.destroy();
    }
}
