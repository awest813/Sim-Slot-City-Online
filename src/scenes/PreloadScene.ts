import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COL_UI_BORDER, COL_UI_BG, TEXT_TITLE, TEXT_MD } from '../game/constants';
import { GameState } from '../core/state/GameState';

export class PreloadScene extends Phaser.Scene {
    private nameInput: string = '';
    private nameDisplay!: Phaser.GameObjects.Text;
    private startBtn!: Phaser.GameObjects.Rectangle;
    private inputActive = false;

    constructor() { super({ key: 'PreloadScene' }); }

    preload(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Background
        this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, COL_UI_BG);

        // Logo
        this.add.text(cx, cy - 100, '🎰 SLOT CITY', {
            ...TEXT_TITLE,
            fontSize: '36px',
        }).setOrigin(0.5);

        this.add.text(cx, cy - 62, 'Social Casino', {
            ...TEXT_MD,
            color: '#888888',
        }).setOrigin(0.5);

        // Progress bar (always fills instantly since no external assets)
        const barW = 320;
        const barH = 8;
        const barX = cx - barW / 2;
        const barY = cy - 28;

        const outline = this.add.graphics();
        outline.lineStyle(1, COL_UI_BORDER, 0.4);
        outline.strokeRect(barX, barY, barW, barH);

        const bar = this.add.graphics();
        this.load.on('progress', (v: number) => {
            bar.clear();
            bar.fillStyle(COL_UI_BORDER, 0.5);
            bar.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * v), barH - 2);
        });

        // No external assets — all procedural shapes
    }

    create(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Name entry prompt
        this.add.text(cx, cy + 8, 'Enter your name:', {
            fontFamily: 'monospace', fontSize: '13px', color: '#888888',
        }).setOrigin(0.5);

        // Name input display box
        const inputBg = this.add.rectangle(cx, cy + 38, 280, 36, 0x0d1117, 1)
            .setStrokeStyle(1, COL_UI_BORDER, 0.8)
            .setInteractive({ useHandCursor: true });

        this.nameDisplay = this.add.text(cx, cy + 38, 'Guest▌', {
            fontFamily: 'monospace', fontSize: '16px', color: '#c9a84c',
        }).setOrigin(0.5);

        // Clicking the input box activates it
        inputBg.on('pointerdown', () => { this.inputActive = true; this.refreshNameDisplay(); });

        // Keyboard input — cleaned up on scene shutdown or manual exit
        this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard!.removeAllListeners('keydown');
        });

        this.inputActive = true; // Start active

        // Start button
        this.startBtn = this.add.rectangle(cx, cy + 90, 200, 40, 0x2a5f2a, 1)
            .setStrokeStyle(1, COL_UI_BORDER, 1)
            .setInteractive({ useHandCursor: true });
        this.add.text(cx, cy + 90, 'Enter Casino →', {
            fontFamily: 'monospace', fontSize: '14px', color: '#f0e6d3', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.startBtn.on('pointerover', () => this.startBtn.setFillStyle(0x3a7f3a));
        this.startBtn.on('pointerout',  () => this.startBtn.setFillStyle(0x2a5f2a));
        this.startBtn.on('pointerdown', () => this.enterCasino());

        // Info line
        this.add.text(cx, cy + 130, 'WASD / Arrow keys to move  ·  E to interact  ·  ESC to close panels', {
            fontFamily: 'monospace', fontSize: '10px', color: '#445544',
        }).setOrigin(0.5);

        this.add.text(cx, cy + 148, '500 ◈ to join Poker  ·  10–100 ◈ to play Slots  ·  Keyboard shortcuts in games', {
            fontFamily: 'monospace', fontSize: '10px', color: '#334433',
        }).setOrigin(0.5);
    }

    private onKey(e: KeyboardEvent): void {
        if (!this.inputActive) return;

        if (e.key === 'Enter') {
            this.enterCasino();
            return;
        }

        if (e.key === 'Backspace') {
            this.nameInput = this.nameInput.slice(0, -1);
        } else if (/^[\w\s\-.'!?]$/.test(e.key) && this.nameInput.length < 16) {
            // Accept printable word characters, spaces, and common punctuation
            this.nameInput += e.key;
        }
        this.refreshNameDisplay();
    }

    private refreshNameDisplay(): void {
        const displayName = this.nameInput.length > 0 ? this.nameInput : '';
        const cursor = this.inputActive ? '▌' : '';
        this.nameDisplay.setText((displayName || 'Guest') + cursor);
    }

    private enterCasino(): void {
        const name = this.nameInput.trim() || 'Guest';
        GameState.update({ displayName: name });
        this.input.keyboard!.removeAllListeners('keydown');
        this.scene.start('CasinoLobbyScene');
    }
}
