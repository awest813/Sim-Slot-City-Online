// ─────────────────────────────────────────────
//  MenuList – vertical keyboard-navigable menu.
//  Draws itself onto the scene; the caller wires
//  keyboard events and calls moveUp/moveDown/confirm.
// ─────────────────────────────────────────────
import Phaser from 'phaser';
import { FONT_BASE, COL_UI_BORDER } from '../game/constants';
import { drawPanel } from './UIHelpers';

export interface MenuItem {
    label:    string;
    callback: () => void;
}

const ITEM_H = 14;

export class MenuList {
    private cursor = 0;
    private readonly items:     MenuItem[];
    private readonly cursorGfx: Phaser.GameObjects.Graphics;
    private readonly x:         number;
    private readonly y:         number;
    private readonly width:     number;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        items: MenuItem[],
    ) {
        this.x     = x;
        this.y     = y;
        this.width = width;
        this.items = items;

        drawPanel(scene, x, y, width, items.length * ITEM_H + 6);

        items.forEach((item, i) => {
            scene.add.text(x + 10, y + 4 + i * ITEM_H, item.label, FONT_BASE);
        });

        this.cursorGfx = scene.add.graphics();
        this.drawCursor();
    }

    moveUp():   void { this.move(-1); }
    moveDown(): void { this.move(1);  }

    confirm(): void {
        this.items[this.cursor]?.callback();
    }

    private move(dir: -1 | 1): void {
        this.cursor = (this.cursor + dir + this.items.length) % this.items.length;
        this.drawCursor();
    }

    private drawCursor(): void {
        this.cursorGfx.clear();
        this.cursorGfx.fillStyle(COL_UI_BORDER, 0.22);
        this.cursorGfx.fillRect(
            this.x, this.y + 2 + this.cursor * ITEM_H,
            this.width, ITEM_H,
        );
        this.cursorGfx.lineStyle(1, COL_UI_BORDER, 0.6);
        this.cursorGfx.strokeRect(
            this.x, this.y + 2 + this.cursor * ITEM_H,
            this.width, ITEM_H,
        );
    }
}
