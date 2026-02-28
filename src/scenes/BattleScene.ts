import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT,
    FONT_BASE, FONT_TITLE,
    TILE_W, TILE_H,
    GRID_COLS, GRID_ROWS,
} from '../game/constants';
import { GridSystem }  from '../systems/GridSystem';
import { TurnSystem }  from '../systems/TurnSystem';
import { Unit }        from '../entities/Unit';
import { drawPanel }   from '../ui/UIHelpers';
import { roster, enemies } from '../data/units';

// BattleScene-local layout constants
const SIDEBAR_W     = 90;
const GRID_ORIGIN_X = 4;
const GRID_ORIGIN_Y = 8;

/**
 * BattleScene – stub battle view.
 * Shows an orthographic grid, unit sprites (coloured rects),
 * and a turn-order sidebar.
 * ESC = back to camp   F1 = debug overlay   F5 = restart
 */
export class BattleScene extends Phaser.Scene {
    private grid!:  GridSystem;
    private turns!: TurnSystem;
    private units:  Unit[] = [];

    private debugText!:    Phaser.GameObjects.Text;
    private debugVisible = false;
    private keyF1!:        Phaser.Input.Keyboard.Key;
    private keyF5!:        Phaser.Input.Keyboard.Key;
    private keyEsc!:       Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'BattleScene' });
    }

    create(): void {
        this.cameras.main.setBackgroundColor(0x0d1a0d);

        // Build units and systems
        this.units = [...roster, ...enemies].map(d => new Unit(d));
        this.grid  = new GridSystem(GRID_COLS, GRID_ROWS, TILE_W, TILE_H);
        this.turns = new TurnSystem(this.units);

        this.drawGrid();
        this.placeUnitSprites();
        this.drawSidebar();

        // Status bar
        drawPanel(this, 0, GAME_HEIGHT - 20, GAME_WIDTH - SIDEBAR_W, 20);
        this.add.text(6, GAME_HEIGHT - 14,
            'ESC: camp  |  F1: debug  |  F5: restart',
            FONT_BASE,
        );

        // Debug overlay
        this.debugText = this.add.text(4, 4, '', {
            fontFamily:      'monospace',
            fontSize:        '7px',
            color:           '#00ff88',
            backgroundColor: '#000000aa',
        }).setDepth(100).setVisible(false);

        if (this.input.keyboard) {
            this.keyF1  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
            this.keyF5  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
            this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        }
    }

    update(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyF1)) {
            this.debugVisible = !this.debugVisible;
            this.debugText.setVisible(this.debugVisible);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyF5)) { this.scene.restart(); }
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) { this.scene.start('CampScene'); }

        if (this.debugVisible) {
            const cur = this.turns.current();
            this.debugText.setText([
                `scene : BattleScene   fps: ${Math.round(this.game.loop.actualFps)}`,
                `active: ${cur?.data.name ?? 'none'}  (${cur?.data.team ?? ''})`,
                `grid  : ${GRID_COLS}×${GRID_ROWS}   units: ${this.units.length}`,
            ]);
        }
    }

    // ── private helpers ───────────────────────────────

    private drawGrid(): void {
        const gfx = this.add.graphics();
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
                const { x, y } = this.grid.toScreen(c, r);
                const px = GRID_ORIGIN_X + x;
                const py = GRID_ORIGIN_Y + y;
                gfx.fillStyle((c + r) % 2 === 0 ? 0x1a3a1a : 0x143214);
                gfx.fillRect(px, py, TILE_W - 1, TILE_H - 1);
                gfx.lineStyle(1, 0x2a5a2a, 0.4);
                gfx.strokeRect(px, py, TILE_W - 1, TILE_H - 1);
            }
        }
    }

    private placeUnitSprites(): void {
        const players = this.units.filter(u => u.data.team === 'player');
        const foes    = this.units.filter(u => u.data.team === 'enemy');

        players.forEach((u, i) => { u.col = i; u.row = 0;            this.drawUnit(u); });
        foes   .forEach((u, i) => { u.col = i; u.row = GRID_ROWS - 1; this.drawUnit(u); });
    }

    private drawUnit(u: Unit): void {
        const { x, y } = this.grid.toScreen(u.col, u.row);
        const px = GRID_ORIGIN_X + x;
        const py = GRID_ORIGIN_Y + y;

        const gfx = this.add.graphics();
        gfx.fillStyle(u.data.team === 'player' ? 0x4488ff : 0xff4444);
        gfx.fillRect(px + 4, py + 3, TILE_W - 9, TILE_H - 7);

        // Initial label
        this.add.text(px + TILE_W / 2, py + TILE_H / 2, u.data.name[0] ?? '?', {
            fontFamily: 'monospace',
            fontSize:   '7px',
            color:      '#ffffff',
        }).setOrigin(0.5);
    }

    private drawSidebar(): void {
        const sx = GAME_WIDTH - SIDEBAR_W;
        drawPanel(this, sx, 0, SIDEBAR_W, GAME_HEIGHT);
        this.add.text(sx + 4, 6, 'TURN ORDER', FONT_TITLE);

        this.turns.getOrder().forEach((u, i) => {
            const col = u.data.team === 'player' ? '#88aaff' : '#ff8888';
            this.add.text(sx + 4, 22 + i * 10, `${i + 1}. ${u.data.name}`, {
                fontFamily: 'monospace',
                fontSize:   '8px',
                color:      col,
            });
        });
    }
}
