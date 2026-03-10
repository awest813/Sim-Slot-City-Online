import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COL_UI_BORDER, TEXT_TITLE } from '../game/constants';
import { GameState } from '../core/state/GameState';

export class PreloadScene extends Phaser.Scene {
    private nameInput: string = '';
    private nameDisplay!: Phaser.GameObjects.Text;
    private startBtn!: Phaser.GameObjects.Rectangle;
    private startBtnLabel!: Phaser.GameObjects.Text;
    private inputActive = false;

    constructor() { super({ key: 'PreloadScene' }); }

    preload(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Background gradient effect (two overlapping rects)
        this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x050a05);
        this.add.rectangle(cx, cy - GAME_HEIGHT / 4, GAME_WIDTH, GAME_HEIGHT / 2, 0x071207, 0.7);

        // Decorative corner accents
        const g = this.add.graphics();
        g.lineStyle(1, COL_UI_BORDER, 0.25);
        g.strokeRect(12, 12, GAME_WIDTH - 24, GAME_HEIGHT - 24);
        g.lineStyle(1, COL_UI_BORDER, 0.12);
        g.strokeRect(20, 20, GAME_WIDTH - 40, GAME_HEIGHT - 40);

        // Logo
        this.add.text(cx, cy - 160, '🎰', {
            fontFamily: 'monospace', fontSize: '40px',
        }).setOrigin(0.5);

        this.add.text(cx, cy - 112, 'SLOT  CITY', {
            ...TEXT_TITLE,
            fontSize: '42px',
            letterSpacing: 8,
        }).setOrigin(0.5);

        this.add.text(cx, cy - 72, '— Online Social Casino —', {
            fontFamily: 'monospace', fontSize: '13px', color: '#7a6a3a',
        }).setOrigin(0.5);

        // Feature pills (what to do in the game)
        const features: Array<{ icon: string; text: string }> = [
            { icon: '🎰', text: 'Slot Machines' },
            { icon: '♠', text: "Texas Hold'em Poker" },
            { icon: '🍹', text: 'Bar & Lounge' },
        ];
        const pillY = cy - 28;
        const pillSpacing = 210;
        const pillStart = cx - pillSpacing;
        features.forEach((f, i) => {
            const px = pillStart + i * pillSpacing;
            this.add.rectangle(px, pillY, 190, 34, 0x0a1a0a, 1)
                .setStrokeStyle(1, COL_UI_BORDER, 0.45);
            this.add.text(px, pillY, `${f.icon}  ${f.text}`, {
                fontFamily: 'monospace', fontSize: '11px', color: '#8a7a4a',
            }).setOrigin(0.5);
        });

        // No external assets — all procedural shapes
        const bar = this.add.graphics();
        this.load.on('progress', (v: number) => {
            bar.clear();
            bar.fillStyle(COL_UI_BORDER, 0.3);
            bar.fillRect(cx - 100, cy + 8, Math.max(0, 200 * v), 2);
        });
    }

    create(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Name entry section
        const labelY = cy + 36;
        this.add.text(cx, labelY, 'Choose your player name', {
            fontFamily: 'monospace', fontSize: '12px', color: '#6a7a5a',
        }).setOrigin(0.5);

        // Name input display box
        const inputBg = this.add.rectangle(cx, labelY + 30, 300, 40, 0x060e06, 1)
            .setStrokeStyle(1, COL_UI_BORDER, 0.9)
            .setInteractive({ useHandCursor: true });

        this.nameDisplay = this.add.text(cx, labelY + 30, 'Guest▌', {
            fontFamily: 'monospace', fontSize: '17px', color: '#c9a84c',
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
        this.startBtn = this.add.rectangle(cx, labelY + 86, 220, 44, 0x1a4a1a, 1)
            .setStrokeStyle(2, COL_UI_BORDER, 1)
            .setInteractive({ useHandCursor: true });
        this.startBtnLabel = this.add.text(cx, labelY + 86, 'Enter Casino  →', {
            fontFamily: 'monospace', fontSize: '15px', color: '#d0e8d0', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.startBtn.on('pointerover', () => {
            this.startBtn.setFillStyle(0x2a6a2a);
            this.startBtnLabel.setColor('#ffffff');
        });
        this.startBtn.on('pointerout', () => {
            this.startBtn.setFillStyle(0x1a4a1a);
            this.startBtnLabel.setColor('#d0e8d0');
        });
        this.startBtn.on('pointerdown', () => this.enterCasino());

        // Controls quick-reference grid
        const refY = labelY + 148;
        this.add.text(cx, refY, '— Quick Reference —', {
            fontFamily: 'monospace', fontSize: '10px', color: '#3a5a3a',
        }).setOrigin(0.5);

        const controls: string[] = [
            'Move avatar     WASD / Arrow keys',
            'Interact        E  (approach a zone)',
            'Spin slots      SPACE',
            'Poker actions   F = Fold   C = Call   R = Raise',
            'Close panel     ESC',
        ];
        controls.forEach((line, i) => {
            this.add.text(cx, refY + 16 + i * 14, line, {
                fontFamily: 'monospace', fontSize: '10px', color: '#2a4a2a',
            }).setOrigin(0.5);
        });

        // Starting chips hint
        this.add.text(cx, refY + 16 + controls.length * 14 + 6,
            'You start with 1,000 ◈ chips  ·  Poker buy-in 500 ◈  ·  Slots from 10 ◈', {
            fontFamily: 'monospace', fontSize: '9px', color: '#2a3a2a',
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
