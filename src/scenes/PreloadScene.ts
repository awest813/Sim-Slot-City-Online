import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT,
    COL_UI_BG2, COL_UI_BG3, COL_UI_BORDER, COL_TRIM, COL_TRIM_DIM,
    COL_BTN_PRIMARY, COL_BTN_PRIMARY_H,
    COL_SLOTS_ACCENT, COL_POKER_ACCENT, COL_BLACKJACK_ACCENT, COL_BAR_ACCENT, COL_BINGO_ACCENT,
    COL_ROULETTE_ACCENT, COL_PLINKO_ACCENT, COL_HORSES_ACCENT,
    FONT, ANIM_MED, ANIM_SLOW,
} from '../game/constants';
import { GameState } from '../core/state/GameState';
import { paintTitleBackdrop } from '../art/lot';
import { bakeAllSimsArt } from '../art/bake';

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
    private spotlightsGfx!: Phaser.GameObjects.Graphics;
    private spotlightAngle: number = 0;
    private titleGlowText!: Phaser.GameObjects.Text;
    
    private selectedSkinKey: string = 'avatar_player';
    private skinButtonsGfx!: Phaser.GameObjects.Graphics;
    private skinImages: Phaser.GameObjects.Image[] = [];

    constructor() { super({ key: 'PreloadScene' }); }

    // ── preload ──────────────────────────────────────────────────────────────

    preload(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        paintTitleBackdrop(this);


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
        glowGfx.lineStyle(1, 0x40b0ff, 0.18);
        glowGfx.strokeCircle(cx, logoY, 52);
        glowGfx.lineStyle(1, 0xff40a0, 0.14);
        glowGfx.strokeCircle(cx, logoY, 58);

        this.add.text(cx, logoY, '🎰', {
            fontFamily: 'monospace', fontSize: '48px',
        }).setOrigin(0.5);
        this.add.text(cx - 48, logoY + 8, '♠', {
            fontFamily: FONT, fontSize: '18px', color: '#40b0ff', fontStyle: 'bold',
        }).setOrigin(0.5);
        this.add.text(cx + 48, logoY + 8, '♦', {
            fontFamily: FONT, fontSize: '18px', color: '#ff4fa8', fontStyle: 'bold',
        }).setOrigin(0.5);

        // ── Title — 4-layer neon effect ────────────────────────────────────
        // Layer 0: outer amber glow (bottommost, drawn first)
        this.titleGlowText = this.add.text(cx, cy - 96, 'SLOT  CITY', {
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
        const features: Array<{ icon: string; label: string; color: number; desc: string }> = [
            { icon: '🎰', label: 'SLOTS',     color: COL_SLOTS_ACCENT,     desc: 'Spin the reels and hit the jackpot!' },
            { icon: '♠',  label: 'POKER',     color: COL_POKER_ACCENT,     desc: 'Showdown against AI poker masters!' },
            { icon: '🃏', label: 'BLACKJACK', color: COL_BLACKJACK_ACCENT, desc: 'Double down and beat the dealer!' },
            { icon: '🎡', label: 'ROULETTE',  color: COL_ROULETTE_ACCENT,  desc: 'Place your bets on red or black!' },
            { icon: '🎯', label: 'PLINKO',    color: COL_PLINKO_ACCENT,    desc: 'Bounce down pegs for high multipliers!' },
            { icon: '🍹', label: 'BAR',       color: COL_BAR_ACCENT,       desc: 'Order special drinks for session bonuses!' },
            { icon: '🎱', label: 'BINGO',     color: COL_BINGO_ACCENT,     desc: 'Mark called numbers and achieve line wins!' },
            { icon: '🏇', label: 'HORSES',    color: COL_HORSES_ACCENT,    desc: 'Cheer your racehorse down the track!' },
        ];

        // Compact pill size to fit all feature pills across the screen width
        const pillW = 96;
        const pillH = 46;
        const pillGap = 10;
        const pillTotalW = features.length * pillW + (features.length - 1) * pillGap;
        const pillStartX = cx - pillTotalW / 2;
        const pillY = cy - 16;

        // Persistent tooltip text centered below feature pills
        const tooltipText = this.add.text(cx, pillY + pillH + 10, '', {
            fontFamily: FONT, fontSize: '10px', color: '#d5eee6', fontStyle: 'bold',
        }).setOrigin(0.5);

        features.forEach((f, i) => {
            const px = pillStartX + i * (pillW + pillGap) + pillW / 2;
            const py = pillY + pillH / 2;

            const pillContainer = this.add.container(px, py);

            const pGfx = this.add.graphics();
            const drawPill = (hover: boolean) => {
                pGfx.clear();
                pGfx.fillStyle(hover ? 0x091e2a : COL_UI_BG3, 1);
                pGfx.fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, 5);
                
                pGfx.lineStyle(0.5, 0xffffff, hover ? 0.05 : 0.03);
                for (let d = 0; d < pillW + pillH; d += 8) {
                    pGfx.lineBetween(-pillW / 2 + d, -pillH / 2, -pillW / 2, -pillH / 2 + d);
                }

                pGfx.fillStyle(f.color, hover ? 0.95 : 0.75);
                pGfx.fillRoundedRect(-pillW / 2, -pillH / 2, 6, pillH, { tl: 5, bl: 5, tr: 0, br: 0 });
                pGfx.fillStyle(f.color, 0.3);
                pGfx.fillRoundedRect(-pillW / 2 + 6, -pillH / 2, 4, pillH, 0);

                pGfx.lineStyle(1.5, f.color, hover ? 0.8 : 0.35);
                pGfx.strokeRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, 5);
                
                pGfx.lineStyle(1, f.color, hover ? 0.2 : 0.1);
                pGfx.strokeRoundedRect(-pillW / 2 + 3, -pillH / 2 + 3, pillW - 6, pillH - 6, 3);
            };
            drawPill(false);

            const iconText = this.add.text(0, -pillH / 2 + 9, f.icon, {
                fontFamily: FONT, fontSize: '15px',
            }).setOrigin(0.5, 0);

            const labelText = this.add.text(0, -pillH / 2 + 27, f.label, {
                fontFamily: FONT, fontSize: '8px', color: '#d5eee6', fontStyle: 'bold',
            }).setOrigin(0.5, 0);

            pillContainer.add([pGfx, iconText, labelText]);

            const hitArea = this.add.rectangle(0, 0, pillW, pillH, 0x000000, 0)
                .setInteractive({ useHandCursor: true });

            hitArea.on('pointerover', () => {
                drawPill(true);
                labelText.setColor(Phaser.Display.Color.IntegerToColor(f.color).rgba);
                tooltipText.setText(f.desc).setColor('#00c8ff');
                this.tweens.add({
                    targets: pillContainer,
                    scaleX: 1.08,
                    scaleY: 1.08,
                    duration: 180,
                    ease: 'Back.easeOut'
                });
            });

            hitArea.on('pointerout', () => {
                drawPill(false);
                labelText.setColor('#888888');
                tooltipText.setText('').setColor('#d5eee6');
                this.tweens.add({
                    targets: pillContainer,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 150,
                    ease: 'Quad.easeOut'
                });
            });

            pillContainer.add(hitArea);
        });

        // ── Load Premium Visual Assets ──────────────────────────────────────
        this.load.image('slots_cherry', 'assets/slots/cherry.png');
        this.load.image('slots_lemon', 'assets/slots/lemon.png');
        this.load.image('slots_orange', 'assets/slots/orange.png');
        this.load.image('slots_grape', 'assets/slots/grape.png');
        this.load.image('slots_star', 'assets/slots/star.png');
        this.load.image('slots_diamond', 'assets/slots/diamond.png');
        this.load.image('slots_seven', 'assets/slots/seven.png');
        this.load.image('slots_wild', 'assets/slots/wild.png');
        this.load.image('slots_bezel', 'assets/slots/slots_bezel.png');
        this.load.image('card_back', 'assets/cards/card_back.png');

        // Card Suits
        this.load.image('suit_S', 'assets/cards/spades.png');
        this.load.image('suit_H', 'assets/cards/hearts.png');
        this.load.image('suit_C', 'assets/cards/clubs.png');
        this.load.image('suit_D', 'assets/cards/diamonds.png');

        // People are painted in create() — original isometric sprites, not the old portraits.

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
        bakeAllSimsArt(this);
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;

        // Sweeping spotlights background
        this.spotlightsGfx = this.add.graphics();
        this.spotlightAngle = 0;
        this.drawSpotlights();

        this.tweens.add({
            targets: this,
            spotlightAngle: 0.22,
            duration: 4500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                this.drawSpotlights();
            }
        });

        // Pulsing Neon Gold Title text
        this.tweens.add({
            targets: this.titleGlowText,
            alpha: { from: 0.22, to: 0.65 },
            duration: 1600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // ── Avatar Skin Selection section (Left Column) ──────────────────────
        const cxLeft = cx - 160;
        const inputSectionY = cy + 64;
        
        this.add.text(cxLeft, inputSectionY, 'PICK A SIM', {
            fontFamily: FONT, fontSize: '11px', color: '#e7fff6', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.skinButtonsGfx = this.add.graphics();
        this.selectedSkinKey = 'avatar_player';
        GameState.update({ avatarTextureKey: 'avatar_player' });

        const skins = [
            { key: 'avatar_player', label: 'Classic' },
            { key: 'avatar_ai_male', label: 'Male' },
            { key: 'avatar_ai_female', label: 'Female' },
            { key: 'avatar_ai_vip', label: 'VIP' }
        ];

        const selectY = inputSectionY + 42;
        const spacing = 58;

        skins.forEach((s, idx) => {
            const bx = cxLeft - 87 + idx * spacing;

            // Avatar sprite image
            const img = this.add.image(bx, selectY + 3, s.key);
            img.setOrigin(0.5, 0.85);
            img.setScale(0.42);
            this.skinImages.push(img);

            // Small text label underneath avatar
            const labelText = this.add.text(bx, selectY + 28, s.label, {
                fontFamily: FONT, fontSize: '8px', color: '#d5eee6', fontStyle: 'bold',
            }).setOrigin(0.5);

            // Invisible interactive click zone
            const hit = this.add.circle(bx, selectY, 22, 0x000000, 0)
                .setInteractive({ useHandCursor: true });

            hit.on('pointerover', () => {
                if (this.selectedSkinKey !== s.key) {
                    labelText.setColor('#c9a84c');
                this.tweens.add({
                    targets: img,
                    scaleX: 0.48,
                    scaleY: 0.48,
                    duration: 120,
                });
                }
            });

            hit.on('pointerout', () => {
                labelText.setColor(this.selectedSkinKey === s.key ? '#ffd700' : '#4a6070');
                this.tweens.add({
                    targets: img,
                    scaleX: 0.42,
                    scaleY: 0.42,
                    duration: 120,
                });
            });

            hit.on('pointerdown', () => {
                this.selectedSkinKey = s.key;
                GameState.update({ avatarTextureKey: s.key });
                this.drawAvatarSelector();

                // Reset all text colors
                skins.forEach((otherSkin, otherIdx) => {
                    const otherLabel = this.children.list.find(
                        c => c instanceof Phaser.GameObjects.Text && 
                             c.x === cxLeft - 87 + otherIdx * spacing && 
                             c.y === selectY + 28
                    ) as Phaser.GameObjects.Text;
                    if (otherLabel) {
                        otherLabel.setColor(otherSkin.key === s.key ? '#ffd700' : '#4a6070');
                    }
                });

                // Play scale bounce pop on selected image
                this.tweens.add({
                    targets: img,
                    scaleX: [0.55, 0.42],
                    scaleY: [0.55, 0.42],
                    duration: 200,
                    ease: 'Back.easeOut'
                });
            });
        });

        this.drawAvatarSelector();

        // ── Name entry section (Right Column) ─────────────────────────────
        const cxRight = cx + 160;

        this.add.text(cxRight, inputSectionY, 'YOUR NAME', {
            fontFamily: FONT, fontSize: '11px', color: '#e7fff6', fontStyle: 'bold',
        }).setOrigin(0.5);

        // Input border (drawn via Graphics so we can animate it)
        this.inputBorderGfx = this.add.graphics();
        this.drawInputBorder(true);

        // Name text inside input
        this.nameDisplay = this.add.text(cxRight, inputSectionY + 28, 'Guest▌', {
            fontFamily: FONT, fontSize: '17px', color: '#c9a84c',
        }).setOrigin(0.5);

        // Invisible hit area for click to activate
        const inputHit = this.add.rectangle(cxRight, inputSectionY + 28, 320, 36, 0x000000, 0)
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

        this.startBtnLabel = this.add.text(cxRight, btnY, 'ENTER CASINO  ▶', {
            fontFamily: FONT, fontSize: '14px', color: '#c8e8c8', fontStyle: 'bold',
        }).setOrigin(0.5);

        // Invisible hit area
        this.startBtnHit = this.add.rectangle(cxRight, btnY, btnW, btnH, 0x000000, 0)
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
                fontFamily: FONT, fontSize: '10px', color: '#d5eee6',
            }).setOrigin(0, 0.5);
        });

        // Chips hint
        this.add.text(cx, refY + 60,
            'Start with 1,000 ◈ chips  ·  Poker buy-in 500 ◈  ·  Slots from 10 ◈  ·  Free reload when broke', {
            fontFamily: FONT, fontSize: '9px', color: '#d5eee6',
        }).setOrigin(0.5);

        // ── Keyboard input ────────────────────────────────────────────────
        this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.keyboard!.removeAllListeners('keydown');
            if (this.cursorTimer) this.cursorTimer.remove();
        });

        this.inputActive = true;

        // Ambient sparkle particles drifting upward
        this.spawnAmbientParticles();

        // Entrance animation — fade scene in
        this.cameras.main.fadeIn(ANIM_SLOW, 0, 0, 0);
    }

    private spawnAmbientParticles(): void {
        const PARTICLE_COUNT = 18;
        const colors = [COL_TRIM, 0xffe0a0, 0xc0d8ff, 0x80ffb0, 0xffc0e0];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const x      = Phaser.Math.Between(30, GAME_WIDTH - 30);
            const startY = Phaser.Math.Between(60, GAME_HEIGHT - 30);
            const size   = Phaser.Math.FloatBetween(1.2, 3.0);
            const alpha0 = Phaser.Math.FloatBetween(0.12, 0.40);
            const delay  = Phaser.Math.Between(0, 4000);
            const dur    = Phaser.Math.Between(3200, 6500);
            const col    = colors[Math.floor(Math.random() * colors.length)];

            const g = this.add.graphics();
            g.fillStyle(col, alpha0);
            g.fillCircle(0, 0, size);
            g.setPosition(x, startY);
            g.setAlpha(0);

            this.tweens.add({
                targets:     g,
                y:           startY - Phaser.Math.Between(70, 160),
                alpha:       { from: 0, to: alpha0, yoyo: true },
                duration:    dur,
                delay,
                ease:        'Sine.easeInOut',
                repeat:      -1,
                repeatDelay: Phaser.Math.Between(300, 1800),
            });
        }
    }

    private drawSpotlights(): void {
        const cx = GAME_WIDTH / 2;
        const g = this.spotlightsGfx;
        g.clear();

        const angle = this.spotlightAngle;

        // Spotlight 1: Neon Blue (swings left/right)
        const x1 = cx - 210;
        const y1 = GAME_HEIGHT;
        const angle1 = -0.35 + angle;
        g.fillStyle(0xfff6d0, 0.05);
        g.fillTriangle(
            x1, y1,
            x1 + Math.cos(angle1 - 0.07) * 480, y1 + Math.sin(angle1 - 0.07) * 480,
            x1 + Math.cos(angle1 + 0.07) * 480, y1 + Math.sin(angle1 + 0.07) * 480
        );

        // Spotlight 2: Neon Pink (swings opposite)
        const x2 = cx + 210;
        const y2 = GAME_HEIGHT;
        const angle2 = -Math.PI + 0.35 - angle;
        g.fillStyle(0xfff6d0, 0.04);
        g.fillTriangle(
            x2, y2,
            x2 + Math.cos(angle2 - 0.07) * 480, y2 + Math.sin(angle2 - 0.07) * 480,
            x2 + Math.cos(angle2 + 0.07) * 480, y2 + Math.sin(angle2 + 0.07) * 480
        );

        // Spotlight 3: Gold (swings center)
        const x3 = cx;
        const y3 = GAME_HEIGHT;
        const angle3 = -Math.PI / 2 + angle * 0.4;
        g.fillStyle(0xffd040, 0.035);
        g.fillTriangle(
            x3, y3,
            x3 + Math.cos(angle3 - 0.05) * 520, y3 + Math.sin(angle3 - 0.05) * 520,
            x3 + Math.cos(angle3 + 0.05) * 520, y3 + Math.sin(angle3 + 0.05) * 520
        );
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private drawAvatarSelector(): void {
        const cx = GAME_WIDTH / 2;
        const cxLeft = cx - 160;
        const cy = GAME_HEIGHT / 2;
        const inputSectionY = cy + 64;
        const selectY = inputSectionY + 42;
        const spacing = 58;

        const g = this.skinButtonsGfx;
        g.clear();

        const skins = [
            { key: 'avatar_player', label: 'Classic' },
            { key: 'avatar_ai_male', label: 'Male' },
            { key: 'avatar_ai_female', label: 'Female' },
            { key: 'avatar_ai_vip', label: 'VIP' }
        ];

        skins.forEach((s, idx) => {
            const bx = cxLeft - 87 + idx * spacing;
            const isSelected = s.key === this.selectedSkinKey;
            
            // Draw background circle
            g.fillStyle(isSelected ? 0x142a20 : 0x0d1828, 1);
            g.fillCircle(bx, selectY, 21);

            // Draw border outline
            const borderCol = isSelected ? COL_TRIM : COL_TRIM_DIM;
            const borderAlpha = isSelected ? 0.95 : 0.25;
            g.lineStyle(isSelected ? 2 : 1, borderCol, borderAlpha);
            g.strokeCircle(bx, selectY, 21);

            if (isSelected) {
                // Outer glow ring
                g.lineStyle(5, COL_TRIM, 0.08);
                g.strokeCircle(bx, selectY, 23);
            }
        });
    }

    private drawInputBorder(focused: boolean): void {
        const cx = GAME_WIDTH / 2 + 160;
        const cy = GAME_HEIGHT / 2;
        const inputSectionY = cy + 64;
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
        const cx = GAME_WIDTH / 2 + 160;
        const cy = GAME_HEIGHT / 2;
        const inputSectionY = cy + 64;
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

        let typed = false;
        if (e.key === 'Backspace') {
            this.nameInput = this.nameInput.slice(0, -1);
            typed = true;
        } else if (/^[\w\s\-.'!?]$/.test(e.key) && this.nameInput.length < 16) {
            this.nameInput += e.key;
            typed = true;
        }
        
        if (typed) {
            this.spawnTypeSparkle();
        }
        this.refreshNameDisplay();
    }

    private spawnTypeSparkle(): void {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        const inputSectionY = cy + 64;
        
        const colors = [0xc9a84c, 0x00c8ff, 0xff40a0, 0x40ff80];
        const count = 4;
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 20;
            const col = colors[Math.floor(Math.random() * colors.length)];
            
            const sp = this.add.graphics();
            sp.fillStyle(col, 0.95);
            sp.fillCircle(0, 0, 1.5 + Math.random() * 1.5);
            sp.setPosition(cx + (Math.random() - 0.5) * 120, inputSectionY + 28 + (Math.random() - 0.5) * 10);
            
            this.tweens.add({
                targets: sp,
                x: sp.x + Math.cos(angle) * dist,
                y: sp.y + Math.sin(angle) * dist - 15, // float up
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 500 + Math.random() * 200,
                ease: 'Quad.easeOut',
                onComplete: () => sp.destroy()
            });
        }
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
