import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT,
    COL_UI_BG2, COL_UI_BG3, COL_UI_BORDER, COL_TRIM, COL_TRIM_DIM,
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
        bgGfx.fillStyle(0x050b16, 1);
        bgGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Radial gradient simulation — concentric circles from center outward
        bgGfx.fillStyle(0x0a1830, 0.55);
        bgGfx.fillCircle(cx, cy, 500);
        bgGfx.fillStyle(0x0c1e38, 0.35);
        bgGfx.fillCircle(cx, cy, 360);
        bgGfx.fillStyle(0x0e2040, 0.20);
        bgGfx.fillCircle(cx, cy, 240);
        bgGfx.fillStyle(0x102248, 0.12);
        bgGfx.fillCircle(cx, cy, 140);
        bgGfx.fillStyle(0x122448, 0.08);
        bgGfx.fillCircle(cx, cy, 70);
        // 3 additional inner layers for smoother centre transition
        bgGfx.fillStyle(0x162040, 0.06);
        bgGfx.fillCircle(cx, cy, 50);
        bgGfx.fillStyle(0x1a2a4a, 0.04);
        bgGfx.fillCircle(cx, cy, 32);
        bgGfx.fillStyle(0xc9a84c, 0.02);  // warm gold tint at very centre
        bgGfx.fillCircle(cx, cy, 18);

        // Diagonal diamond-grid carpet pattern
        bgGfx.lineStyle(0.5, COL_TRIM_DIM, 0.07);
        const gs = 60;
        for (let x = 0; x < GAME_WIDTH + gs; x += gs) {
            bgGfx.lineBetween(x - gs / 2, 0, x + gs / 2, GAME_HEIGHT);
            bgGfx.lineBetween(x + gs / 2, 0, x - gs / 2, GAME_HEIGHT);
        }

        // Outer frames — nested gold rectangles
        bgGfx.lineStyle(1, COL_UI_BORDER, 0.25);
        bgGfx.strokeRect(10, 10, GAME_WIDTH - 20, GAME_HEIGHT - 20);
        bgGfx.lineStyle(1, COL_UI_BORDER, 0.15);
        bgGfx.strokeRect(16, 16, GAME_WIDTH - 32, GAME_HEIGHT - 32);
        bgGfx.lineStyle(0.5, COL_UI_BORDER, 0.08);
        bgGfx.strokeRect(22, 22, GAME_WIDTH - 44, GAME_HEIGHT - 44);

        // Decorative dot row between frames
        bgGfx.lineStyle(1, COL_TRIM, 0.12);
        for (let dx = 30; dx < GAME_WIDTH - 30; dx += 10) {
            bgGfx.fillStyle(COL_TRIM, 0.08);
            bgGfx.fillRect(dx, 13, 2, 2);
            bgGfx.fillRect(dx, GAME_HEIGHT - 15, 2, 2);
        }

        // Corner ornaments — elaborate L-shapes with diamond + 3 diagonals
        const orn = 40;   // longer arms
        const orn2 = 14;
        const ornOff = 10;
        const corners: Array<[number, number]> = [
            [ornOff, ornOff],
            [GAME_WIDTH - ornOff, ornOff],
            [ornOff, GAME_HEIGHT - ornOff],
            [GAME_WIDTH - ornOff, GAME_HEIGHT - ornOff],
        ];
        corners.forEach(([ox, oy]) => {
            const sx = ox < GAME_WIDTH / 2 ? 1 : -1;
            const sy = oy < GAME_HEIGHT / 2 ? 1 : -1;
            // Main L-shape arms (longer)
            bgGfx.lineStyle(1.5, COL_TRIM, 0.7);
            bgGfx.lineBetween(ox, oy, ox + sx * orn, oy);
            bgGfx.lineBetween(ox, oy, ox, oy + sy * orn);
            // Secondary inner L-shape
            bgGfx.lineStyle(1, COL_TRIM, 0.4);
            bgGfx.lineBetween(ox + sx * orn2, oy + sy * 4, ox + sx * orn2, oy + sy * orn2);
            bgGfx.lineBetween(ox + sx * 4, oy + sy * orn2, ox + sx * orn2, oy + sy * orn2);
            // Diagonal accent 1: corner to arm-end
            bgGfx.lineStyle(0.5, COL_TRIM, 0.3);
            bgGfx.lineBetween(ox + sx * 8, oy + sy * 8, ox + sx * orn, oy + sy * orn);
            // Diagonal accent 2: short cross inside the corner notch
            bgGfx.lineStyle(0.5, COL_TRIM, 0.2);
            bgGfx.lineBetween(ox + sx * 14, oy + sy * 6, ox + sx * 6, oy + sy * 14);
            // Filled diamond at the corner tip (single polygon)
            const ds = 4;
            bgGfx.fillStyle(COL_TRIM, 0.8);
            bgGfx.fillPoints([
                { x: ox,      y: oy - ds },
                { x: ox + ds, y: oy      },
                { x: ox,      y: oy + ds },
                { x: ox - ds, y: oy      },
            ], true);
        });

        // ── Slot emoji logo with glow ────────────────────────────────────────
        const logoY = cy - 148;
        const glowGfx = this.add.graphics();
        glowGfx.fillStyle(COL_TRIM, 0.03);
        glowGfx.fillCircle(cx, logoY, 80);
        glowGfx.fillStyle(COL_TRIM, 0.05);
        glowGfx.fillCircle(cx, logoY, 60);
        glowGfx.fillStyle(COL_TRIM, 0.09);
        glowGfx.fillCircle(cx, logoY, 40);
        glowGfx.fillStyle(COL_TRIM, 0.14);
        glowGfx.fillCircle(cx, logoY, 24);
        // Decorative gold ring
        glowGfx.lineStyle(1.5, COL_TRIM, 0.5);
        glowGfx.strokeCircle(cx, logoY, 30);
        glowGfx.lineStyle(0.5, COL_TRIM, 0.2);
        glowGfx.strokeCircle(cx, logoY, 34);
        // Second slightly larger ring (pulse-visible companion)
        glowGfx.lineStyle(0.8, COL_TRIM, 0.3);
        glowGfx.strokeCircle(cx, logoY, 40);
        // 6-ray starburst halo around logo (every 60°)
        glowGfx.lineStyle(0.5, 0xc9a84c, 0.15);
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
            const x2 = cx     + Math.cos(angle) * 50;
            const y2 = logoY  + Math.sin(angle) * 50;
            glowGfx.lineBetween(cx, logoY, x2, y2);
        }

        this.add.text(cx, logoY, '🎰', {
            fontFamily: 'monospace', fontSize: '48px',
        }).setOrigin(0.5);

        // ── Title — 4-layer neon effect ────────────────────────────────────
        // Layer 0: outer amber glow (bottommost, drawn first)
        this.add.text(cx, cy - 96, 'SLOT  CITY', {
            fontFamily: FONT, fontSize: '46px', color: '#ffd040', fontStyle: 'bold',
            letterSpacing: 12,
        }).setOrigin(0.5).setAlpha(0.4);
        // Layer 1: black shadow
        this.add.text(cx + 3, cy - 96 + 3, 'SLOT  CITY', {
            fontFamily: FONT, fontSize: '46px', color: '#000000', fontStyle: 'bold',
            letterSpacing: 12,
        }).setOrigin(0.5).setAlpha(0.6);
        // Layer 2: amber mid-tone
        this.add.text(cx + 1, cy - 96 + 1, 'SLOT  CITY', {
            fontFamily: FONT, fontSize: '46px', color: '#ffa020', fontStyle: 'bold',
            letterSpacing: 12,
        }).setOrigin(0.5).setAlpha(0.6);
        // Layer 3: bright gold top
        this.add.text(cx, cy - 96, 'SLOT  CITY', {
            fontFamily: FONT, fontSize: '46px', color: '#c9a84c', fontStyle: 'bold',
            letterSpacing: 12,
        }).setOrigin(0.5);

        // ── Subtitle with flanking lines ─────────────────────────────────
        const subY = cy - 56;
        const subText = '— Online Social Casino —';
        const subT = this.add.text(cx, subY, subText, {
            fontFamily: FONT, fontSize: '13px', color: '#c9a030',
        }).setOrigin(0.5);
        const subHW = subT.width / 2 + 18;
        const lineGfx = this.add.graphics();
        lineGfx.lineStyle(0.5, COL_TRIM, 0.4);
        lineGfx.lineBetween(cx - subHW - 40, subY, cx - subHW - 4, subY);
        lineGfx.lineBetween(cx + subHW + 4, subY, cx + subHW + 40, subY);

        // ── Double-line divider with diamond center ────────────────────────
        const divGfx = this.add.graphics();
        const divY = cy - 38;
        divGfx.lineStyle(1, COL_TRIM, 0.3);
        divGfx.lineBetween(cx - 160, divY - 2, cx + 160, divY - 2);
        divGfx.lineBetween(cx - 160, divY + 2, cx + 160, divY + 2);
        // Diamond ornament in center
        divGfx.lineStyle(1, COL_TRIM, 0.7);
        const dSize = 5;
        divGfx.lineBetween(cx - dSize, divY, cx, divY - dSize);
        divGfx.lineBetween(cx, divY - dSize, cx + dSize, divY);
        divGfx.lineBetween(cx + dSize, divY, cx, divY + dSize);
        divGfx.lineBetween(cx, divY + dSize, cx - dSize, divY);

        // ── Feature pills ─────────────────────────────────────────────────
        const features: Array<{ icon: string; label: string; color: number }> = [
            { icon: '🎰', label: 'SLOTS',      color: COL_SLOTS_ACCENT },
            { icon: '♠',  label: 'POKER',      color: COL_POKER_ACCENT },
            { icon: '🃏', label: 'BLACKJACK',  color: COL_BLACKJACK_ACCENT },
            { icon: '🍹', label: 'BAR',        color: COL_BAR_ACCENT },
        ];

        const pillW = 120;
        const pillH = 48;
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
            // Diagonal line overlay (subtle texture)
            pillGfx.lineStyle(0.5, 0xffffff, 0.03);
            for (let d = 0; d < pillW + pillH; d += 8) {
                pillGfx.lineBetween(px + d, pillY, px, pillY + d);
            }
            // Colored left accent bar with inner glow (6px wide)
            pillGfx.fillStyle(f.color, 0.75);
            pillGfx.fillRoundedRect(px, pillY, 6, pillH, { tl: 5, bl: 5, tr: 0, br: 0 });
            pillGfx.fillStyle(f.color, 0.3);
            pillGfx.fillRoundedRect(px + 6, pillY, 4, pillH, 0);
            // Border
            pillGfx.lineStyle(1, f.color, 0.35);
            pillGfx.strokeRoundedRect(px, pillY, pillW, pillH, 5);
            // 1px inner border inset 3px (subtle depth)
            pillGfx.lineStyle(1, f.color, 0.1);
            pillGfx.strokeRoundedRect(px + 3, pillY + 3, pillW - 6, pillH - 6, 3);
            // Top-left corner highlight triangle (6×6 semi-transparent white)
            pillGfx.fillStyle(0xffffff, 0.05);
            pillGfx.fillTriangle(px, pillY, px + 6, pillY, px, pillY + 6);

            this.add.text(px + pillW / 2 + 2, pillY + 10, f.icon, {
                fontFamily: FONT, fontSize: '16px',
            }).setOrigin(0.5, 0);

            this.add.text(px + pillW / 2 + 2, pillY + 28, f.label, {
                fontFamily: FONT, fontSize: '9px', color: '#888888', fontStyle: 'bold',
            }).setOrigin(0.5, 0);
        });

        // Asset loading progress bar — soft glow behind narrow bar
        const barBg = this.add.graphics();
        this.load.on('progress', (v: number) => {
            barBg.clear();
            // Soft glow behind
            barBg.lineStyle(5, COL_TRIM, 0.12);
            barBg.lineBetween(cx - 100, cy + 38, cx - 100 + 200 * v, cy + 38);
            // Track
            barBg.fillStyle(COL_TRIM, 0.18);
            barBg.fillRoundedRect(cx - 100, cy + 37, 200, 3, 1);
            // Fill
            barBg.fillStyle(COL_TRIM, 0.85);
            barBg.fillRoundedRect(cx - 100, cy + 37, Math.max(0, 200 * v), 3, 1);
            // Leading-edge bright white highlight at right end of fill
            if (v > 0.005) {
                barBg.fillStyle(0xffffff, 0.8);
                barBg.fillRect(cx - 100 + Math.max(0, 200 * v) - 3, cy + 37, 3, 3);
            }
        });
    }

    // ── create ───────────────────────────────────────────────────────────────

    create(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // ── Name entry section ────────────────────────────────────────────
        const inputSectionY = cy + 44;

        this.add.text(cx, inputSectionY, 'CHOOSE YOUR PLAYER NAME', {
            fontFamily: FONT, fontSize: '10px', color: '#7090a0', fontStyle: 'bold',
            letterSpacing: 4,
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
        const btnW = 280;
        const btnH = 48;

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
        const refW = 700;
        const refH = 54;

        const refGfx = this.add.graphics();
        refGfx.fillStyle(COL_UI_BG2, 0.85);
        refGfx.fillRoundedRect(cx - refW / 2, refY - 4, refW, refH, 4);
        // Thicker border
        refGfx.lineStyle(1.5, COL_TRIM_DIM, 0.35);
        refGfx.strokeRoundedRect(cx - refW / 2, refY - 4, refW, refH, 4);
        // Left color accent bar
        refGfx.fillStyle(COL_TRIM, 0.4);
        refGfx.fillRoundedRect(cx - refW / 2, refY - 4, 3, refH, { tl: 4, bl: 4, tr: 0, br: 0 });

        const controls: Array<[string, string]> = [
            ['WASD / ↑↓←→', 'Move avatar'],
            ['E',            'Interact with zone'],
            ['SPACE',        'Spin / Deal'],
            ['F C R',        'Poker: Fold / Call / Raise'],
            ['H S',          'Blackjack: Hit / Stand'],
            ['ESC',          'Close panel'],
        ];

        const colW = refW / 3;
        controls.forEach(([key, desc], i) => {
            const col = Math.floor(i / 2);
            const row = i % 2;
            const kx  = cx - refW / 2 + col * colW + 16;
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
            fontFamily: FONT, fontSize: '9px', color: '#4a6070',
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

        // Outer glow when focused
        if (focused) {
            g.lineStyle(8, COL_TRIM, 0.06);
            g.strokeRoundedRect(cx - 162, inputSectionY + 8, 324, 40, 8);
            // Inner glow
            g.lineStyle(3, COL_TRIM, 0.15);
            g.strokeRoundedRect(cx - 161, inputSectionY + 9, 322, 38, 7);
        }
        g.fillStyle(focused ? 0x141e30 : COL_UI_BG3, 1);
        g.fillRoundedRect(cx - 160, inputSectionY + 10, 320, 36, 5);

        // Border — gold when focused, dim when not
        const borderCol = focused ? COL_UI_BORDER : COL_TRIM_DIM;
        const borderAlpha = focused ? 0.9 : 0.4;
        const lineW = focused ? 1.5 : 1;
        g.lineStyle(lineW, borderCol, borderAlpha);
        g.strokeRoundedRect(cx - 160, inputSectionY + 10, 320, 36, 5);

        // 5th innermost glow + scanning line (focused only)
        if (focused) {
            g.lineStyle(1, 0xc9a84c, 0.45);
            g.strokeRoundedRect(cx - 160, inputSectionY + 10, 320, 36, 5);
            // Subtle scanning line near the bottom of the input field
            const scanY = inputSectionY + 10 + 36 - 8;
            g.lineStyle(1, 0xc9a84c, 0.1);
            g.lineBetween(cx - 160, scanY, cx + 160, scanY);
        }
    }

    private drawStartButton(hover: boolean): void {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        const inputSectionY = cy + 44;
        const btnY = inputSectionY + 74;
        const btnW = 280;
        const btnH = 48;
        const g = this.startBtnGfx;
        g.clear();

        const fill = hover ? COL_BTN_PRIMARY_H : COL_BTN_PRIMARY;
        // Shadow
        g.fillStyle(0x000000, 0.35);
        g.fillRoundedRect(cx - btnW / 2 + 2, btnY - btnH / 2 + 3, btnW, btnH, 7);
        // Fill
        g.fillStyle(fill, 1);
        g.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
        // Top half lighter highlight (gradient-like)
        g.fillStyle(0xffffff, hover ? 0.05 : 0.12);
        g.fillRoundedRect(cx - btnW / 2 + 2, btnY - btnH / 2 + 2, btnW - 4, 8, { tl: 5, tr: 5, bl: 0, br: 0 });
        // Left-side highlight strip
        g.fillStyle(0xffffff, 0.08);
        g.fillRoundedRect(cx - btnW / 2 + 2, btnY - btnH / 2 + 2, 4, btnH - 4, { tl: 5, bl: 5, tr: 0, br: 0 });
        // Bottom edge shadow band
        g.fillStyle(0x000000, 0.25);
        g.fillRoundedRect(cx - btnW / 2 + 2, btnY + btnH / 2 - 6, btnW - 4, 4, { tl: 0, tr: 0, bl: 5, br: 5 });
        // Border — full opacity on hover
        g.lineStyle(1.5, COL_UI_BORDER, hover ? 1.0 : 0.8);
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
