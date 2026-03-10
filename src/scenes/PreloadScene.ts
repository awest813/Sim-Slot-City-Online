import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT,
    COL_UI_BG, COL_UI_BG2, COL_UI_BG3, COL_UI_BORDER, COL_TRIM, COL_TRIM_DIM,
    COL_BTN_PRIMARY, COL_BTN_PRIMARY_H,
    COL_SLOTS_ACCENT, COL_POKER_ACCENT, COL_BLACKJACK_ACCENT, COL_BAR_ACCENT,
    FONT, ANIM_MED, ANIM_SLOW,
} from '../game/constants';
import { GameState } from '../core/state/GameState';

// ── PreloadScene ──────────────────────────────────────────────────────────────

export class PreloadScene extends Phaser.Scene {
    private nameInput:   string  = '';
    private nameDisplay!: Phaser.GameObjects.Text;
    private inputActive = true;
    private cursorVisible = true;
    private cursorTimer!: Phaser.Time.TimerEvent;
    private inputBorderGfx!: Phaser.GameObjects.Graphics;
    private startBtnGfx!: Phaser.GameObjects.Graphics;
    private startBtnLabel!: Phaser.GameObjects.Text;
    private startBtnHit!: Phaser.GameObjects.Rectangle;

    constructor() { super({ key: 'PreloadScene' }); }

    // ── preload ──────────────────────────────────────────────────────────────

    preload(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // ── Deep multi-layer background ──────────────────────────────────────
        const bgGfx = this.add.graphics();

        // Base fill
        bgGfx.fillStyle(COL_UI_BG, 1);
        bgGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Subtle radial gradient effect — layered dark circles from center
        bgGfx.fillStyle(0x0a1428, 0.6);
        bgGfx.fillCircle(cx, cy, 500);
        bgGfx.fillStyle(0x0c1830, 0.3);
        bgGfx.fillCircle(cx, cy, 350);

        // Diamond-grid carpet pattern (very subtle)
        bgGfx.lineStyle(0.5, COL_TRIM_DIM, 0.08);
        const gs = 60;
        for (let x = 0; x < GAME_WIDTH + gs; x += gs) {
            bgGfx.lineBetween(x - gs / 2, 0, x + gs / 2, GAME_HEIGHT);
            bgGfx.lineBetween(x + gs / 2, 0, x - gs / 2, GAME_HEIGHT);
        }

        // Outer frame
        bgGfx.lineStyle(1, COL_UI_BORDER, 0.20);
        bgGfx.strokeRect(10, 10, GAME_WIDTH - 20, GAME_HEIGHT - 20);
        bgGfx.lineStyle(1, COL_UI_BORDER, 0.10);
        bgGfx.strokeRect(16, 16, GAME_WIDTH - 32, GAME_HEIGHT - 32);

        // Corner ornaments (small L-shaped gold lines)
        const orn = 18;
        const ornOff = 10;
        bgGfx.lineStyle(1.5, COL_TRIM, 0.5);
        [[ornOff, ornOff], [GAME_WIDTH - ornOff, ornOff], [ornOff, GAME_HEIGHT - ornOff], [GAME_WIDTH - ornOff, GAME_HEIGHT - ornOff]].forEach(([ox, oy]) => {
            const sx = ox === ornOff ? 1 : -1;
            const sy = oy === ornOff ? 1 : -1;
            bgGfx.lineBetween(ox, oy, ox + sx * orn, oy);
            bgGfx.lineBetween(ox, oy, ox, oy + sy * orn);
        });

        // ── Slot emoji logo ──────────────────────────────────────────────────
        // Glow rings (outer → inner)
        const glowGfx = this.add.graphics();
        glowGfx.fillStyle(COL_TRIM, 0.04);
        glowGfx.fillCircle(cx, cy - 148, 72);
        glowGfx.fillStyle(COL_TRIM, 0.06);
        glowGfx.fillCircle(cx, cy - 148, 52);
        glowGfx.fillStyle(COL_TRIM, 0.10);
        glowGfx.fillCircle(cx, cy - 148, 36);

        this.add.text(cx, cy - 148, '🎰', {
            fontFamily: 'monospace', fontSize: '48px',
        }).setOrigin(0.5);

        // ── Title ─────────────────────────────────────────────────────────
        // Drop-shadow effect: draw title text slightly offset in dark color first
        this.add.text(cx + 2, cy - 96 + 2, 'SLOT  CITY', {
            fontFamily: FONT, fontSize: '46px', color: '#000000', fontStyle: 'bold',
            letterSpacing: 10,
        }).setOrigin(0.5).setAlpha(0.5);

        this.add.text(cx, cy - 96, 'SLOT  CITY', {
            fontFamily: FONT, fontSize: '46px', color: '#c9a84c', fontStyle: 'bold',
            letterSpacing: 10,
        }).setOrigin(0.5);

        this.add.text(cx, cy - 58, '— Online Social Casino —', {
            fontFamily: FONT, fontSize: '13px', color: '#7a6a3a',
        }).setOrigin(0.5);

        // Thin divider
        const divGfx = this.add.graphics();
        divGfx.lineStyle(1, COL_TRIM, 0.25);
        divGfx.lineBetween(cx - 160, cy - 40, cx + 160, cy - 40);

        // ── Feature pills ─────────────────────────────────────────────────
        const features: Array<{ icon: string; label: string; color: number }> = [
            { icon: '🎰', label: 'SLOTS',      color: COL_SLOTS_ACCENT },
            { icon: '♠',  label: "POKER",      color: COL_POKER_ACCENT },
            { icon: '🃏', label: 'BLACKJACK',  color: COL_BLACKJACK_ACCENT },
            { icon: '🍹', label: 'BAR',        color: COL_BAR_ACCENT },
        ];

        const pillW = 120;
        const pillH = 38;
        const pillGap = 16;
        const pillTotalW = features.length * pillW + (features.length - 1) * pillGap;
        const pillStartX = cx - pillTotalW / 2;
        const pillY = cy - 16;

        const pillGfx = this.add.graphics();
        features.forEach((f, i) => {
            const px = pillStartX + i * (pillW + pillGap);
            // Background
            pillGfx.fillStyle(COL_UI_BG3, 1);
            pillGfx.fillRoundedRect(px, pillY, pillW, pillH, 5);
            // Colored left accent bar
            pillGfx.fillStyle(f.color, 0.75);
            pillGfx.fillRoundedRect(px, pillY, 4, pillH, { tl: 5, bl: 5, tr: 0, br: 0 });
            // Border
            pillGfx.lineStyle(1, f.color, 0.35);
            pillGfx.strokeRoundedRect(px, pillY, pillW, pillH, 5);

            this.add.text(px + pillW / 2 + 2, pillY + 9, f.icon, {
                fontFamily: FONT, fontSize: '13px',
            }).setOrigin(0.5, 0);

            this.add.text(px + pillW / 2 + 2, pillY + 24, f.label, {
                fontFamily: FONT, fontSize: '9px', color: '#888888', fontStyle: 'bold',
            }).setOrigin(0.5, 0);
        });

        // Asset loading progress bar (no external assets so this barely shows)
        const barBg = this.add.graphics();
        this.load.on('progress', (v: number) => {
            barBg.clear();
            barBg.fillStyle(COL_TRIM, 0.2);
            barBg.fillRoundedRect(cx - 100, cy + 28, 200, 2, 1);
            barBg.fillStyle(COL_TRIM, 0.8);
            barBg.fillRoundedRect(cx - 100, cy + 28, Math.max(0, 200 * v), 2, 1);
        });
    }

    // ── create ───────────────────────────────────────────────────────────────

    create(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // ── Name entry section ────────────────────────────────────────────
        const inputSectionY = cy + 44;

        this.add.text(cx, inputSectionY, 'CHOOSE YOUR PLAYER NAME', {
            fontFamily: FONT, fontSize: '10px', color: '#506070', fontStyle: 'bold',
            letterSpacing: 2,
        }).setOrigin(0.5);

        // Input border (drawn via Graphics so we can animate it)
        this.inputBorderGfx = this.add.graphics();
        this.drawInputBorder(true);

        // Name text inside input
        this.nameDisplay = this.add.text(cx, inputSectionY + 28, 'Guest▌', {
            fontFamily: FONT, fontSize: '17px', color: '#c9a84c',
        }).setOrigin(0.5);

        // Invisible hit area for click to activate
        const inputHit = this.add.rectangle(cx, inputSectionY + 28, 320, 36, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        inputHit.on('pointerdown', () => {
            this.inputActive = true;
            this.drawInputBorder(true);
        });

        // Blinking cursor timer
        this.cursorTimer = this.time.addEvent({
            delay: 520,
            loop: true,
            callback: () => {
                this.cursorVisible = !this.cursorVisible;
                this.refreshNameDisplay();
            },
        });

        // ── Enter Casino button ───────────────────────────────────────────
        const btnY = inputSectionY + 74;
        const btnW = 240;
        const btnH = 44;

        this.startBtnGfx = this.add.graphics();
        this.drawStartButton(false);

        this.startBtnLabel = this.add.text(cx, btnY, 'ENTER CASINO  ▶', {
            fontFamily: FONT, fontSize: '14px', color: '#c8e8c8', fontStyle: 'bold',
        }).setOrigin(0.5);

        // Invisible hit area
        this.startBtnHit = this.add.rectangle(cx, btnY, btnW, btnH, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        this.startBtnHit.on('pointerover', () => {
            this.drawStartButton(true);
            this.startBtnLabel.setColor('#ffffff');
        });
        this.startBtnHit.on('pointerout', () => {
            this.drawStartButton(false);
            this.startBtnLabel.setColor('#c8e8c8');
        });
        this.startBtnHit.on('pointerdown', () => {
            this.drawStartButton(true);
            this.startBtnLabel.setStyle({ color: '#ffffff', fontStyle: 'bold' });
            this.time.delayedCall(100, () => this.enterCasino());
        });

        // ── Quick reference ───────────────────────────────────────────────
        const refY = inputSectionY + 128;

        const refGfx = this.add.graphics();
        refGfx.fillStyle(COL_UI_BG2, 0.7);
        refGfx.fillRoundedRect(cx - 350, refY - 4, 700, 54, 4);
        refGfx.lineStyle(1, COL_TRIM_DIM, 0.2);
        refGfx.strokeRoundedRect(cx - 350, refY - 4, 700, 54, 4);

        const controls: Array<[string, string]> = [
            ['WASD / ↑↓←→', 'Move avatar'],
            ['E',            'Interact with zone'],
            ['SPACE',        'Spin / Deal'],
            ['F C R',        'Poker: Fold / Call / Raise'],
            ['H S',          'Blackjack: Hit / Stand'],
            ['ESC',          'Close panel'],
        ];

        const colW = 700 / 3;
        controls.forEach(([key, desc], i) => {
            const col = Math.floor(i / 2);
            const row = i % 2;
            const kx  = cx - 350 + col * colW + 12;
            const ky  = refY + 4 + row * 20;

            this.add.text(kx, ky, key, {
                fontFamily: FONT, fontSize: '10px', color: '#c9a84c', fontStyle: 'bold',
            }).setOrigin(0, 0.5);

            this.add.text(kx + 70, ky, desc, {
                fontFamily: FONT, fontSize: '10px', color: '#445566',
            }).setOrigin(0, 0.5);
        });

        // Chips hint
        this.add.text(cx, refY + 60,
            'Start with 1,000 ◈ chips  ·  Poker buy-in 500 ◈  ·  Slots from 10 ◈  ·  Free reload when broke', {
            fontFamily: FONT, fontSize: '9px', color: '#334455',
        }).setOrigin(0.5);

        // ── Keyboard input ────────────────────────────────────────────────
        this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard!.removeAllListeners('keydown');
            if (this.cursorTimer) this.cursorTimer.remove();
        });

        this.inputActive = true;

        // Entrance animation — fade scene in
        this.cameras.main.fadeIn(ANIM_SLOW, 0, 0, 0);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private drawInputBorder(focused: boolean): void {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        const inputSectionY = cy + 44;
        const g = this.inputBorderGfx;
        g.clear();
        // Inner bg
        g.fillStyle(COL_UI_BG3, 1);
        g.fillRoundedRect(cx - 160, inputSectionY + 10, 320, 36, 5);
        // Border — gold when focused, dim when not
        const borderCol = focused ? COL_UI_BORDER : COL_TRIM_DIM;
        const borderAlpha = focused ? 0.9 : 0.4;
        const lineW = focused ? 1.5 : 1;
        g.lineStyle(lineW, borderCol, borderAlpha);
        g.strokeRoundedRect(cx - 160, inputSectionY + 10, 320, 36, 5);
        // Glow underneath when focused
        if (focused) {
            g.lineStyle(6, COL_TRIM, 0.08);
            g.strokeRoundedRect(cx - 162, inputSectionY + 8, 324, 40, 7);
        }
    }

    private drawStartButton(hover: boolean): void {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        const inputSectionY = cy + 44;
        const btnY = inputSectionY + 74;
        const btnW = 240;
        const btnH = 44;
        const g = this.startBtnGfx;
        g.clear();

        const fill = hover ? COL_BTN_PRIMARY_H : COL_BTN_PRIMARY;
        // Shadow
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(cx - btnW / 2 + 2, btnY - btnH / 2 + 3, btnW, btnH, 7);
        // Fill
        g.fillStyle(fill, 1);
        g.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
        // Top highlight
        g.fillStyle(0xffffff, hover ? 0.04 : 0.06);
        g.fillRoundedRect(cx - btnW / 2 + 2, btnY - btnH / 2 + 2, btnW - 4, btnH / 2 - 2, { tl: 5, tr: 5, bl: 0, br: 0 });
        // Border
        g.lineStyle(1.5, COL_UI_BORDER, hover ? 1 : 0.8);
        g.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
        // Glow on hover
        if (hover) {
            g.lineStyle(6, COL_TRIM, 0.10);
            g.strokeRoundedRect(cx - btnW / 2 - 2, btnY - btnH / 2 - 2, btnW + 4, btnH + 4, 8);
        }
    }

    // ── keyboard handling ─────────────────────────────────────────────────────

    private onKey(e: KeyboardEvent): void {
        if (e.key === 'Enter') { this.enterCasino(); return; }
        if (!this.inputActive) return;

        if (e.key === 'Backspace') {
            this.nameInput = this.nameInput.slice(0, -1);
        } else if (/^[\w\s\-.'!?]$/.test(e.key) && this.nameInput.length < 16) {
            this.nameInput += e.key;
        }
        this.refreshNameDisplay();
    }

    private refreshNameDisplay(): void {
        const displayName = this.nameInput.length > 0 ? this.nameInput : 'Guest';
        const cursor = this.inputActive && this.cursorVisible ? '▌' : '';
        this.nameDisplay.setText(displayName + cursor);
    }

    private enterCasino(): void {
        const name = this.nameInput.trim() || 'Guest';
        GameState.update({ displayName: name });

        // Fade out before transitioning
        this.cameras.main.fadeOut(ANIM_MED, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.input.keyboard!.removeAllListeners('keydown');
            if (this.cursorTimer) this.cursorTimer.remove();
            this.scene.start('CasinoLobbyScene');
        });
    }
}
