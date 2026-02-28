import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_TITLE, COL_UI_BORDER } from '../game/constants';
import { DialogueBox } from '../ui/DialogueBox';
import { drawPanel }   from '../ui/UIHelpers';
import supportDemo     from '../data/supports/support_demo.json';

/**
 * DialogueScene – full-screen support conversation overlay.
 * Z / Enter = advance line    ESC = skip back to camp
 */
export class DialogueScene extends Phaser.Scene {
    private box!:      DialogueBox;
    private keyZ!:     Phaser.Input.Keyboard.Key;
    private keyEnter!: Phaser.Input.Keyboard.Key;
    private keyEsc!:   Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'DialogueScene' });
    }

    create(): void {
        this.cameras.main.setBackgroundColor(0x0a0a1a);

        // Portrait panels
        const half = GAME_WIDTH / 2;
        drawPanel(this, 4,        4, half - 8, GAME_HEIGHT - 70);
        drawPanel(this, half + 4, 4, half - 8, GAME_HEIGHT - 70);

        // Speaker names
        this.add.text(half / 2,      14, supportDemo.unitA.toUpperCase(), FONT_TITLE).setOrigin(0.5);
        this.add.text(half + half / 2, 14, supportDemo.unitB.toUpperCase(), FONT_TITLE).setOrigin(0.5);

        // Placeholder portraits
        this.drawPortrait(half / 2  - 30, 26, 60, 72, 0x224488, 'A');
        this.drawPortrait(half + half / 2 - 30, 26, 60, 72, 0x882222, 'B');

        // Rank badge
        this.add.text(half, GAME_HEIGHT - 72,
            `Support Rank: ${supportDemo.rank}`,
            { fontFamily: 'monospace', fontSize: '8px', color: '#e0c55a' },
        ).setOrigin(0.5);

        // Controls hint
        this.add.text(half, GAME_HEIGHT - 62,
            'Z / Enter: next    ESC: skip',
            { fontFamily: 'monospace', fontSize: '7px', color: '#666688' },
        ).setOrigin(0.5);

        // Dialogue box
        this.box = new DialogueBox(this);
        this.box.show(supportDemo.lines, () => this.scene.start('CampScene'));

        if (this.input.keyboard) {
            this.keyZ     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
            this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
            this.keyEsc   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        }
    }

    update(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyZ) ||
            Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
            this.box.advance();
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this.scene.start('CampScene');
        }
    }

    private drawPortrait(
        x: number, y: number, w: number, h: number,
        color: number, label: string,
    ): void {
        const gfx = this.add.graphics();
        gfx.fillStyle(color, 0.45);
        gfx.fillRect(x, y, w, h);
        gfx.lineStyle(1, COL_UI_BORDER, 0.6);
        gfx.strokeRect(x, y, w, h);
        this.add.text(x + w / 2, y + h / 2, label, {
            fontFamily: 'monospace',
            fontSize:   '28px',
            color:      '#ffffff',
        }).setOrigin(0.5).setAlpha(0.25);
    }
}
