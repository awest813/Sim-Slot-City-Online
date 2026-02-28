import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, FONT_BASE, FONT_TITLE } from '../game/constants';
import { drawPanel } from '../ui/UIHelpers';
import { MenuList }  from '../ui/MenuList';
import { roster }    from '../data/units';

/**
 * CampScene – inter-battle hub.
 * Shows roster, main menu, and ambient background.
 * Debug:  F1 = toggle debug overlay   F5 = restart scene
 */
export class CampScene extends Phaser.Scene {
    private menu!:         MenuList;
    private debugText!:    Phaser.GameObjects.Text;
    private debugVisible = false;
    private keyF1!:        Phaser.Input.Keyboard.Key;
    private keyF5!:        Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'CampScene' });
    }

    create(): void {
        this.cameras.main.setBackgroundColor(0x0d0d1a);
        this.drawStarfield();

        // ── Title banner ───────────────────────────────
        drawPanel(this, 4, 4, GAME_WIDTH - 8, 18);
        this.add.text(GAME_WIDTH / 2, 13, '— CAMP —', FONT_TITLE).setOrigin(0.5);

        // ── Roster panel (left) ────────────────────────
        const rosterW = 130;
        drawPanel(this, 4, 28, rosterW, GAME_HEIGHT - 54);
        this.add.text(12, 34, 'ROSTER', FONT_TITLE);
        roster.forEach((u, i) => {
            this.add.text(12, 48 + i * 13, `${u.name}  Lv${u.level}  ${u.job}`, FONT_BASE);
        });

        // ── Main menu (right) ──────────────────────────
        const menuX = GAME_WIDTH - 100;
        this.menu = new MenuList(this, menuX, 28, 92, [
            { label: 'Battle',   callback: () => this.scene.start('BattleScene')   },
            { label: 'Supports', callback: () => this.scene.start('DialogueScene') },
            { label: 'Restart',  callback: () => this.scene.restart()              },
        ]);

        // ── Status bar ─────────────────────────────────
        drawPanel(this, 4, GAME_HEIGHT - 22, GAME_WIDTH - 8, 18);
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 13,
            '↑↓: move  Z/Enter: select  |  F1: debug  F5: restart',
            FONT_BASE,
        ).setOrigin(0.5);

        // ── Debug overlay (hidden) ──────────────────────
        this.debugText = this.add.text(6, GAME_HEIGHT - 44, '', {
            fontFamily:      'monospace',
            fontSize:        '7px',
            color:           '#00ff88',
            backgroundColor: '#000000aa',
        }).setDepth(100).setVisible(false);

        // ── Keyboard shortcuts ──────────────────────────
        if (this.input.keyboard) {
            this.keyF1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
            this.keyF5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
            this.input.keyboard.on('keydown-UP',    () => this.menu.moveUp());
            this.input.keyboard.on('keydown-DOWN',  () => this.menu.moveDown());
            this.input.keyboard.on('keydown-ENTER', () => this.menu.confirm());
            this.input.keyboard.on('keydown-Z',     () => this.menu.confirm());
        }
    }

    update(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyF1)) {
            this.debugVisible = !this.debugVisible;
            this.debugText.setVisible(this.debugVisible);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyF5)) {
            this.scene.restart();
        }

        if (this.debugVisible) {
            const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
            this.debugText.setText([
                `scene : CampScene`,
                `fps   : ${Math.round(this.game.loop.actualFps)}`,
                `heap  : ${mem ? Math.round(mem.usedJSHeapSize / 1024) + ' kb' : 'n/a'}`,
            ]);
        }
    }

    private drawStarfield(): void {
        const gfx = this.add.graphics();
        const rng = new Phaser.Math.RandomDataGenerator(['camp-stars']);
        for (let i = 0; i < 100; i++) {
            const x = rng.integerInRange(0, GAME_WIDTH);
            const y = rng.integerInRange(0, GAME_HEIGHT);
            gfx.fillStyle(0xffffff, rng.realInRange(0.15, 0.7));
            gfx.fillRect(x, y, 1, 1);
        }
    }
}
