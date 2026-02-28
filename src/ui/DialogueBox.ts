// ─────────────────────────────────────────────
//  DialogueBox – bottom-screen dialogue widget.
//  Usage:
//    const box = new DialogueBox(this);
//    box.show(lines, onDone);
//    // call box.advance() on player input
// ─────────────────────────────────────────────
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COL_UI_BG, COL_UI_BORDER } from '../game/constants';

export interface DialogueLine {
    speaker: string;
    text:    string;
}

const BOX_H = 58;
const BOX_Y = GAME_HEIGHT - BOX_H - 4;
const BOX_X = 4;
const BOX_W = GAME_WIDTH - 8;

export class DialogueBox {
    private readonly bg:         Phaser.GameObjects.Graphics;
    private readonly nameText:   Phaser.GameObjects.Text;
    private readonly bodyText:   Phaser.GameObjects.Text;
    private readonly promptText: Phaser.GameObjects.Text;

    private lines:     DialogueLine[] = [];
    private lineIndex  = 0;
    private onDone?:   () => void;

    constructor(scene: Phaser.Scene) {
        this.bg = scene.add.graphics().setDepth(50);
        this.bg.fillStyle(COL_UI_BG, 0.93);
        this.bg.fillRect(BOX_X, BOX_Y, BOX_W, BOX_H);
        this.bg.lineStyle(1, COL_UI_BORDER, 1);
        this.bg.strokeRect(BOX_X, BOX_Y, BOX_W, BOX_H);
        // Inner accent line under the name area
        this.bg.lineStyle(1, COL_UI_BORDER, 0.4);
        this.bg.lineBetween(BOX_X + 1, BOX_Y + 16, BOX_X + BOX_W - 1, BOX_Y + 16);

        this.nameText = scene.add.text(BOX_X + 8, BOX_Y + 4, '', {
            fontFamily:      'monospace',
            fontSize:        '9px',
            color:           '#e0c55a',
            backgroundColor: '#1a1a2e',
            padding:         { x: 4, y: 1 },
        }).setDepth(51);

        this.bodyText = scene.add.text(BOX_X + 8, BOX_Y + 20, '', {
            fontFamily: 'monospace',
            fontSize:   '8px',
            color:      '#f0e6d3',
            wordWrap:   { width: BOX_W - 20 },
        }).setDepth(51);

        this.promptText = scene.add.text(
            BOX_X + BOX_W - 8, BOX_Y + BOX_H - 8, '▶',
            { fontFamily: 'monospace', fontSize: '8px', color: '#e0c55a' },
        ).setOrigin(1, 0.5).setDepth(51);

        this.setVisible(false);
    }

    show(lines: DialogueLine[], onDone?: () => void): void {
        this.lines     = lines;
        this.lineIndex = 0;
        this.onDone    = onDone;
        this.setVisible(true);
        this.showLine();
    }

    /** Advance to the next line; hides the box when all lines are done. */
    advance(): void {
        this.lineIndex++;
        if (this.lineIndex >= this.lines.length) {
            this.setVisible(false);
            this.onDone?.();
        } else {
            this.showLine();
        }
    }

    private showLine(): void {
        const line = this.lines[this.lineIndex];
        if (!line) return;
        this.nameText.setText(line.speaker);
        this.bodyText.setText(line.text);
    }

    private setVisible(v: boolean): void {
        this.bg.setVisible(v);
        this.nameText.setVisible(v);
        this.bodyText.setVisible(v);
        this.promptText.setVisible(v);
    }
}
