// ── CasinoLobbyScene — main playable casino floor ────────────────────────────
import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, WORLD_W, WORLD_H,
    COL_BG, COL_FLOOR, COL_WALL, COL_WALL_STRIPE,
    COL_TRIM, COL_TRIM_DIM,
    COL_TABLE,
    COL_SLOTS_ACCENT, COL_POKER_ACCENT, COL_BAR_ACCENT, COL_BLACKJACK_ACCENT, COL_ROULETTE_ACCENT, COL_PLINKO_ACCENT, COL_BINGO_ACCENT,
    COL_UI_BG, COL_UI_BG2, COL_UI_BORDER,
    DEPTH_FLOOR, DEPTH_PROPS, DEPTH_FOREGROUND, DEPTH_HUD,
    ZONE_ENTRANCE, ZONE_SLOTS, ZONE_POKER, ZONE_BAR, ZONE_BLACKJACK, ZONE_ROULETTE, ZONE_PLINKO, ZONE_BINGO,
    FONT, ANIM_SLOW,
} from '../../game/constants';
import { GameState, Zone } from '../../core/state/GameState';
import { AvatarController } from '../../core/systems/AvatarController';
import { AIWalker, AI_NAMES, AI_COLORS } from '../../core/systems/AIWalker';
import { InteractionSystem } from '../../core/systems/InteractionSystem';
import { SoundManager } from '../../core/systems/SoundManager';
import { HUD } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import { SlotsPanel } from '../slots/SlotsPanel';
import { BarPanel, resetBarSession } from '../bar/BarPanel';
import { PokerPanel } from '../poker/PokerPanel';
import { BlackjackPanel } from '../blackjack/BlackjackPanel';
import { RoulettePanel } from '../roulette/RoulettePanel';
import { PlinkoPanel } from '../plinko/PlinkoPanel';
import { BingoPanel } from '../bingo/BingoPanel';

export class CasinoLobbyScene extends Phaser.Scene {
    private avatar!:      AvatarController;
    private aiWalkers:    AIWalker[] = [];
    private interaction!: InteractionSystem;
    private minimap!:     Minimap;
    private activePanel:  'none' | 'slots' | 'bar' | 'poker' | 'blackjack' | 'roulette' | 'plinko' | 'bingo' = 'none';
    private graphics!:    Phaser.GameObjects.Graphics;
    // Context hint bar
    private hintBg!:      Phaser.GameObjects.Rectangle;
    private hintText!:    Phaser.GameObjects.Text;

    constructor() { super({ key: 'CasinoLobbyScene' }); }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    create(): void {
        // Preserve player name from PreloadScene
        const savedName = GameState.get().displayName;
        GameState.reset();
        if (savedName && savedName !== 'Guest') {
            GameState.update({ displayName: savedName });
        }
        resetBarSession();

        this.graphics = this.add.graphics();

        this.buildWorld();
        this.buildProps();
        this.buildAmbientLighting();
        this.buildLabels();
        this.buildEntranceFx();

        // Avatar — spawn at entrance
        const spawnX = WORLD_W / 2;
        const spawnY = WORLD_H - 100;
        this.avatar = new AvatarController(this, spawnX, spawnY, GameState.get().displayName);
        this.registerAvatarBlockers();

        // AI walkers — spawn at staggered positions around the floor
        this.spawnAIWalkers();

        // Camera — manual follow in update()
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.scrollX = spawnX - GAME_WIDTH / 2;
        this.cameras.main.scrollY = spawnY - GAME_HEIGHT / 2;

        // Interaction system
        this.interaction = new InteractionSystem(this);
        this.registerHotspots();

        // HUD
        new HUD(this);

        // Minimap
        this.minimap = new Minimap(this);

        // Context-sensitive hint bar (bottom edge)
        this.buildHintBar();

        // Initialise sound engine on the first pointer-down (browser autoplay policy
        // requires a user gesture before creating / resuming an AudioContext).
        this.input.once('pointerdown', () => SoundManager.init());

        // Welcome tutorial overlay
        this.showWelcomeBanner();

        // Fade scene in
        this.cameras.main.fadeIn(ANIM_SLOW, 0, 0, 0);
    }

    update(_time: number, delta: number): void {
        if (this.activePanel !== 'none') return;

        this.avatar.update(delta);

        for (const ai of this.aiWalkers) {
            ai.update(delta);
        }

        // Manual camera follow with easing
        const targetX = this.avatar.x - GAME_WIDTH  / 2;
        const targetY = this.avatar.y - GAME_HEIGHT / 2;
        this.cameras.main.scrollX = Phaser.Math.Linear(this.cameras.main.scrollX, targetX, 0.12);
        this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, 0.12);

        // Clamp to world bounds
        this.cameras.main.scrollX = Phaser.Math.Clamp(this.cameras.main.scrollX, 0, WORLD_W - GAME_WIDTH);
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY, 0, WORLD_H - GAME_HEIGHT);

        this.interaction.update(this.avatar.x, this.avatar.y);
        this.updateZone();

        // Update minimap with current avatar world-space position
        this.minimap.update(this.avatar.x, this.avatar.y);
    }

    // ── World Building ────────────────────────────────────────────────────────

    private buildWorld(): void {
        const g = this.graphics;

        // === Background ===
        g.fillStyle(COL_BG, 1);
        g.fillRect(0, 0, WORLD_W, WORLD_H);

        // Subtle radial gradient from center
        g.fillStyle(0x080e20, 0.4);
        g.fillCircle(WORLD_W / 2, WORLD_H / 2, 600);
        g.fillStyle(0x0a1428, 0.25);
        g.fillCircle(WORLD_W / 2, WORLD_H / 2, 400);

        // === Walls ===
        g.fillStyle(COL_WALL, 1);
        g.fillRect(0,            0,            WORLD_W, 32);
        g.fillRect(0,            0,            24,      WORLD_H);
        g.fillRect(WORLD_W - 24, 0,            24,      WORLD_H);
        g.fillRect(0,            WORLD_H - 24, WORLD_W, 24);

        // Wall stripe decoration
        g.fillStyle(COL_WALL_STRIPE, 1);
        g.fillRect(24, 8, WORLD_W - 48, 6);
        // Second amber thin stripe
        g.lineStyle(1, 0xc9a84c, 0.3);
        g.lineBetween(24, 14, WORLD_W - 24, 14);
        // Gold wall trim line — higher opacity
        g.lineStyle(1, COL_TRIM_DIM, 0.65);
        g.lineBetween(24, 30, WORLD_W - 24, 30);

        // Decorative wall panels (wainscoting effect)
        const panelCount = 8;
        const panelW = (WORLD_W - 60) / panelCount;
        for (let i = 0; i < panelCount; i++) {
            const px = 30 + i * panelW;
            g.lineStyle(0.5, COL_TRIM, 0.2);
            g.strokeRect(px + 4, 2, panelW - 8, 26);
            g.lineStyle(0.5, COL_TRIM, 0.1);
            g.strokeRect(px + 7, 5, panelW - 14, 20);
        }

        // Side wall columns — thin gold vertical accents
        const colSpacing = 80;
        for (let cy2 = 80; cy2 < WORLD_H - 24; cy2 += colSpacing) {
            g.lineStyle(1, COL_TRIM, 0.12);
            g.lineBetween(24, cy2, 24, cy2 + 40);
            g.lineBetween(WORLD_W - 24, cy2, WORLD_W - 24, cy2 + 40);
        }

        // === Casino carpet ===
        g.fillStyle(COL_FLOOR, 1);
        g.fillRect(24, 32, WORLD_W - 48, WORLD_H - 56);

        // === Marble tile checkerboard ===
        const tileSize    = 48;
        const TILE_LIGHT  = 0x0d2212;   // lighter marble tile shade
        const TILE_DARK   = 0x0b1e0f;   // darker marble tile shade
        for (let ty = 32; ty < WORLD_H - 24; ty += tileSize) {
            for (let tx = 24; tx < WORLD_W - 24; tx += tileSize) {
                const col = (((tx - 24) / tileSize) + ((ty - 32) / tileSize)) % 2 === 0
                    ? TILE_LIGHT : TILE_DARK;
                g.fillStyle(col, 1);
                g.fillRect(tx, ty, tileSize, tileSize);
                // Top-left inner highlight to simulate 3D marble edge
                g.lineStyle(0.5, 0x1a3a1a, 0.25);
                g.lineBetween(tx + 2, ty + 2, tx + tileSize - 3, ty + 2);
                g.lineBetween(tx + 2, ty + 2, tx + 2, ty + tileSize - 3);
            }
        }

        // Diamond diagonal overlay — subtle
        g.lineStyle(0.5, 0x143018, 0.12);
        const diagSpacing = 40;
        for (let d = -WORLD_H; d < WORLD_W + WORLD_H; d += diagSpacing) {
            g.lineBetween(Math.max(24, d), 32, Math.min(WORLD_W - 24, d + WORLD_H), Math.min(WORLD_H - 24, 32 + WORLD_H));
            g.lineBetween(Math.max(24, WORLD_W - d - diagSpacing), 32, Math.min(WORLD_W - 24, WORLD_W - d), Math.min(WORLD_H - 24, 32 + WORLD_H));
        }

        // Light reflection pools below chandeliers
        const chandPos: Array<[number, number]> = [
            [WORLD_W / 2, 200],
            [200, 200],
            [760, 200],
        ];
        for (const [lrx, lry] of chandPos) {
            g.fillStyle(0xffd700, 0.03); g.fillCircle(lrx, lry, 180);
            g.fillStyle(0xffcc40, 0.04); g.fillCircle(lrx, lry, 100);
            g.fillStyle(0xffe060, 0.05); g.fillCircle(lrx, lry, 55);
        }

        // === Zone area fills — two-layer diffuse + focused ===
        // Slots
        g.fillStyle(0x0c250c, 0.3);
        g.fillRect(ZONE_SLOTS.x - 8, ZONE_SLOTS.y - 8, ZONE_SLOTS.w + 16, ZONE_SLOTS.h + 16);
        g.fillStyle(0x0c250c, 0.6);
        g.fillRect(ZONE_SLOTS.x, ZONE_SLOTS.y, ZONE_SLOTS.w, ZONE_SLOTS.h);
        // Poker
        g.fillStyle(0x0c0c28, 0.3);
        g.fillRect(ZONE_POKER.x - 8, ZONE_POKER.y - 8, ZONE_POKER.w + 16, ZONE_POKER.h + 16);
        g.fillStyle(0x0c0c28, 0.6);
        g.fillRect(ZONE_POKER.x, ZONE_POKER.y, ZONE_POKER.w, ZONE_POKER.h);
        // Bar
        g.fillStyle(0x1e1008, 0.3);
        g.fillRect(ZONE_BAR.x - 8, ZONE_BAR.y - 8, ZONE_BAR.w + 16, ZONE_BAR.h + 16);
        g.fillStyle(0x1e1008, 0.5);
        g.fillRect(ZONE_BAR.x, ZONE_BAR.y, ZONE_BAR.w, ZONE_BAR.h);
        // Blackjack
        g.fillStyle(0x1a0c1a, 0.3);
        g.fillRect(ZONE_BLACKJACK.x - 8, ZONE_BLACKJACK.y - 8, ZONE_BLACKJACK.w + 16, ZONE_BLACKJACK.h + 16);
        g.fillStyle(0x1a0c1a, 0.6);
        g.fillRect(ZONE_BLACKJACK.x, ZONE_BLACKJACK.y, ZONE_BLACKJACK.w, ZONE_BLACKJACK.h);
        // Roulette
        g.fillStyle(0x1a0808, 0.3);
        g.fillRect(ZONE_ROULETTE.x - 8, ZONE_ROULETTE.y - 8, ZONE_ROULETTE.w + 16, ZONE_ROULETTE.h + 16);
        g.fillStyle(0x1a0808, 0.6);
        g.fillRect(ZONE_ROULETTE.x, ZONE_ROULETTE.y, ZONE_ROULETTE.w, ZONE_ROULETTE.h);
        // Plinko
        g.fillStyle(0x071a14, 0.3);
        g.fillRect(ZONE_PLINKO.x - 8, ZONE_PLINKO.y - 8, ZONE_PLINKO.w + 16, ZONE_PLINKO.h + 16);
        g.fillStyle(0x071a14, 0.6);
        g.fillRect(ZONE_PLINKO.x, ZONE_PLINKO.y, ZONE_PLINKO.w, ZONE_PLINKO.h);
        // Bingo
        g.fillStyle(0x041820, 0.3);
        g.fillRect(ZONE_BINGO.x - 8, ZONE_BINGO.y - 8, ZONE_BINGO.w + 16, ZONE_BINGO.h + 16);
        g.fillStyle(0x041820, 0.6);
        g.fillRect(ZONE_BINGO.x, ZONE_BINGO.y, ZONE_BINGO.w, ZONE_BINGO.h);

        // Spotlight radial layer on each zone center
        g.fillStyle(COL_SLOTS_ACCENT, 0.04);
        g.fillCircle(ZONE_SLOTS.x + ZONE_SLOTS.w / 2, ZONE_SLOTS.y + ZONE_SLOTS.h / 2, Math.max(ZONE_SLOTS.w, ZONE_SLOTS.h) * 0.7);
        g.fillStyle(COL_POKER_ACCENT, 0.04);
        g.fillCircle(ZONE_POKER.x + ZONE_POKER.w / 2, ZONE_POKER.y + ZONE_POKER.h / 2, Math.max(ZONE_POKER.w, ZONE_POKER.h) * 0.7);
        g.fillStyle(COL_BAR_ACCENT, 0.04);
        g.fillCircle(ZONE_BAR.x + ZONE_BAR.w / 2, ZONE_BAR.y + ZONE_BAR.h / 2, Math.max(ZONE_BAR.w, ZONE_BAR.h) * 0.7);
        g.fillStyle(COL_BLACKJACK_ACCENT, 0.04);
        g.fillCircle(ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2, ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2, Math.max(ZONE_BLACKJACK.w, ZONE_BLACKJACK.h) * 0.7);
        g.fillStyle(COL_ROULETTE_ACCENT, 0.04);
        g.fillCircle(ZONE_ROULETTE.x + ZONE_ROULETTE.w / 2, ZONE_ROULETTE.y + ZONE_ROULETTE.h / 2, Math.max(ZONE_ROULETTE.w, ZONE_ROULETTE.h) * 0.7);
        g.fillStyle(COL_PLINKO_ACCENT, 0.04);
        g.fillCircle(ZONE_PLINKO.x + ZONE_PLINKO.w / 2, ZONE_PLINKO.y + ZONE_PLINKO.h / 2, Math.max(ZONE_PLINKO.w, ZONE_PLINKO.h) * 0.7);
        g.fillStyle(COL_BINGO_ACCENT, 0.04);
        g.fillCircle(ZONE_BINGO.x + ZONE_BINGO.w / 2, ZONE_BINGO.y + ZONE_BINGO.h / 2, Math.max(ZONE_BINGO.w, ZONE_BINGO.h) * 0.7);

        // === Zone accent borders — 3-layer neon glow ===
        const zones: Array<[typeof ZONE_SLOTS, number]> = [
            [ZONE_SLOTS,      COL_SLOTS_ACCENT],
            [ZONE_POKER,      COL_POKER_ACCENT],
            [ZONE_BAR,        COL_BAR_ACCENT],
            [ZONE_BLACKJACK,  COL_BLACKJACK_ACCENT],
            [ZONE_ROULETTE,   COL_ROULETTE_ACCENT],
            [ZONE_PLINKO,     COL_PLINKO_ACCENT],
            [ZONE_BINGO,      COL_BINGO_ACCENT],
        ];
        for (const [z, col] of zones) {
            // Outer glow
            g.lineStyle(4, col, 0.15);
            g.strokeRect(z.x - 2, z.y - 2, z.w + 4, z.h + 4);
            // Mid glow
            g.lineStyle(2, col, 0.4);
            g.strokeRect(z.x, z.y, z.w, z.h);
            // Inner accent
            g.lineStyle(0.5, col, 0.25);
            g.strokeRect(z.x + 2, z.y + 2, z.w - 4, z.h - 4);
        }

        // === Entrance path ===
        g.fillStyle(0x183818, 1);
        g.fillRect(ZONE_ENTRANCE.x, ZONE_ENTRANCE.y, ZONE_ENTRANCE.w, ZONE_ENTRANCE.h);
        g.lineStyle(2, COL_TRIM, 0.75);
        g.strokeRect(ZONE_ENTRANCE.x, ZONE_ENTRANCE.y, ZONE_ENTRANCE.w, ZONE_ENTRANCE.h);

        g.setDepth(DEPTH_FLOOR);
    }

    private buildProps(): void {
        // Slot machines — 4 units
        const slotPositions: [number, number][] = [
            [60, 100], [120, 100], [60, 200], [120, 200],
        ];
        for (const [mx, my] of slotPositions) {
            this.drawSlotMachine(mx, my);
        }

        // Poker table
        this.drawPokerTable(790, 190);

        // Blackjack table
        this.drawBlackjackTable(
            ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2,
            ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2,
        );

        // Bar counter
        this.drawBarCounter();

        // Pillars
        const pillarPositions: [number, number][] = [
            [30, 230], [WORLD_W - 30, 230],
            [30, 450], [WORLD_W - 30, 450],
        ];
        for (const [px, py] of pillarPositions) {
            this.drawPillar(px, py);
        }

        // Roulette table
        this.drawRouletteTable(
            ZONE_ROULETTE.x + ZONE_ROULETTE.w / 2,
            ZONE_ROULETTE.y + ZONE_ROULETTE.h / 2,
        );

        // Plinko board
        this.drawPlinkoBoard(
            ZONE_PLINKO.x + ZONE_PLINKO.w / 2,
            ZONE_PLINKO.y + ZONE_PLINKO.h / 2,
        );

        // Bingo board
        this.drawBingoBoard(
            ZONE_BINGO.x + ZONE_BINGO.w / 2,
            ZONE_BINGO.y + ZONE_BINGO.h / 2,
        );

        // Chandeliers
        this.drawChandelier(WORLD_W / 2, 90);
        this.drawChandelier(200, 200);
        this.drawChandelier(760, 200);
    }

    private drawSlotMachine(x: number, y: number): void {
        const depth = DEPTH_PROPS + y * 0.1;
        const g2 = this.add.graphics().setDepth(depth);

        // Shadow
        g2.fillStyle(0x000000, 0.3);
        g2.fillEllipse(x, y + 36, 52, 10);

        // Main cabinet body — deep blue-black metallic
        g2.fillStyle(0x080824, 1);
        g2.fillRoundedRect(x - 24, y - 42, 48, 80, 5);

        // Side panel highlights for 3D effect
        g2.fillStyle(0x1c1c4a, 0.8);
        g2.fillRoundedRect(x - 24, y - 42, 8, 80, { tl: 5, bl: 5, tr: 0, br: 0 });
        g2.fillStyle(0x141440, 0.8);
        g2.fillRoundedRect(x + 16, y - 42, 8, 80, { tl: 0, bl: 0, tr: 5, br: 5 });

        // Gold trim — main border + inner highlight
        g2.lineStyle(2, 0xc9a84c, 1);
        g2.strokeRoundedRect(x - 24, y - 42, 48, 80, 5);
        g2.lineStyle(1, 0xe8c870, 0.4);
        g2.strokeRoundedRect(x - 22, y - 40, 44, 76, 4);

        // Top marquee area
        g2.fillStyle(0x10103a, 1);
        g2.fillRoundedRect(x - 21, y - 40, 42, 16, { tl: 3, tr: 3, bl: 0, br: 0 });
        g2.lineStyle(1, 0xffb020, 0.8);
        g2.lineBetween(x - 18, y - 33, x + 18, y - 33);

        // Marquee label
        this.add.text(x, y - 36, '♦ SLOTS ♦', {
            fontFamily: FONT, fontSize: '7px', color: '#ffb020', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(depth + 1);

        // Screen outer bezel
        g2.fillStyle(0x040410, 1);
        g2.fillRoundedRect(x - 18, y - 24, 36, 30, 3);
        // Screen inner glass
        g2.fillStyle(0x060620, 1);
        g2.fillRoundedRect(x - 17, y - 23, 34, 28, 2);
        // Screen inner glow — larger blue-purple fill
        g2.fillStyle(0x1818ee, 0.1);
        g2.fillRoundedRect(x - 17, y - 23, 34, 28, 2);
        // Screen border
        g2.lineStyle(1.5, 0xc9a84c, 0.7);
        g2.strokeRoundedRect(x - 18, y - 24, 36, 30, 3);

        // Reel dividers
        g2.lineStyle(1, 0xc9a84c, 0.5);
        g2.lineBetween(x - 6, y - 23, x - 6, y + 6);
        g2.lineBetween(x + 6, y - 23, x + 6, y + 6);

        // Reel symbols
        const symDepth = depth + 1;
        this.add.text(x - 12, y - 9, '🎰', {
            fontFamily: FONT, fontSize: '11px', color: '#ffd040', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(symDepth);
        this.add.text(x, y - 9, '🎰', {
            fontFamily: FONT, fontSize: '11px', color: '#ff5050',
        }).setOrigin(0.5).setDepth(symDepth);
        this.add.text(x + 12, y - 9, '🎰', {
            fontFamily: FONT, fontSize: '11px', color: '#5080ff',
        }).setOrigin(0.5).setDepth(symDepth);

        // Payline indicator
        g2.lineStyle(1, 0xffb020, 0.5);
        g2.lineBetween(x - 16, y - 9, x + 16, y - 9);

        // Lower panel
        g2.fillStyle(0x0a0a22, 1);
        g2.fillRoundedRect(x - 18, y + 8, 36, 16, 2);
        g2.lineStyle(1, 0xc9a84c, 0.3);
        g2.strokeRoundedRect(x - 18, y + 8, 36, 16, 2);

        // Spin button — chrome layered
        g2.fillStyle(0x000000, 0.4);
        g2.fillCircle(x + 1, y + 17, 8);
        g2.fillStyle(0x404060, 1);
        g2.fillCircle(x, y + 16, 8);
        g2.fillStyle(0xc9a84c, 1);
        g2.fillCircle(x, y + 16, 6);
        g2.fillStyle(0xffffff, 0.3);
        g2.fillCircle(x - 2, y + 14, 2.5);
        g2.lineStyle(1, 0xe8c870, 0.8);
        g2.strokeCircle(x, y + 16, 6);

        // Side accent lights
        g2.fillStyle(0xffb020, 0.6);
        g2.fillCircle(x - 20, y - 20, 2);
        g2.fillCircle(x - 20, y - 5, 2);
        g2.fillCircle(x + 20, y - 20, 2);
        g2.fillCircle(x + 20, y - 5, 2);

        // Status ticker dots — row of 5 lights below spin button, alternating amber/off
        for (let ti = 0; ti < 5; ti++) {
            g2.fillStyle(ti % 2 === 0 ? 0xffb020 : 0x332200, 0.9);
            g2.fillCircle(x - 12 + ti * 6, y + 30, 2);
        }
    }

    private drawBlackjackTable(cx: number, cy: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);

        g2.fillStyle(0x000000, 0.25);
        g2.fillEllipse(cx, cy + 8, 200, 80);
        g2.fillStyle(COL_TABLE, 1);
        g2.fillEllipse(cx, cy, 190, 90);
        // Purple felt
        g2.fillStyle(0x280d28, 1);
        g2.fillEllipse(cx, cy, 162, 74);
        g2.lineStyle(2, 0x6a2a6a, 1);
        g2.strokeEllipse(cx, cy, 148, 66);
        g2.lineStyle(1, 0x5a1a5a, 0.6);
        g2.strokeEllipse(cx, cy - 6, 80, 34);

        // Accent corner — zone color accent line
        g2.lineStyle(1, COL_BLACKJACK_ACCENT, 0.3);
        g2.strokeEllipse(cx, cy, 164, 76);

        // Card suits
        const suits  = ['♠', '♣', '♥', '♦'];
        const angles = [270, 0, 90, 180];
        for (let i = 0; i < 4; i++) {
            const rad = (angles[i] * Math.PI) / 180;
            this.add.text(
                cx + Math.cos(rad) * 40, cy + Math.sin(rad) * 18, suits[i], {
                    fontFamily: FONT, fontSize: '12px',
                    color: i < 2 ? '#3a1a3a' : '#5a1a1a',
                },
            ).setOrigin(0.5).setDepth(DEPTH_PROPS + 1);
        }

        // Dealer indicator
        g2.fillStyle(COL_TRIM, 0.4);
        g2.fillRect(cx - 20, cy - 35, 40, 6);

        // Player betting circles
        for (const bx of [-70, -35, 0, 35, 70]) {
            g2.lineStyle(1, 0x8a3a8a, 0.6);
            g2.strokeCircle(cx + bx, cy + 20, 10);
        }

        // Chip stacks
        for (let i = 0; i < 2; i++) {
            g2.fillStyle(0x9b59b6, 1);
            g2.fillCircle(cx - 20 + i * 40, cy - 8, 6);
            g2.lineStyle(1, 0x6c3483, 1);
            g2.strokeCircle(cx - 20 + i * 40, cy - 8, 6);
        }
    }

    private drawPokerTable(cx: number, cy: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);

        // Shadow
        g2.fillStyle(0x000000, 0.35);
        g2.fillEllipse(cx + 4, cy + 12, 236, 108);

        // Mahogany wood rim — outer dark
        g2.fillStyle(0x2a1408, 1);
        g2.fillEllipse(cx, cy, 230, 128);
        // Rim highlight (lighter on top for 3D)
        g2.fillStyle(0x5a3018, 0.6);
        g2.fillEllipse(cx, cy - 8, 225, 110);
        g2.fillStyle(0x2a1408, 1);
        g2.fillEllipse(cx, cy + 2, 222, 120);

        // Felt surface
        g2.fillStyle(0x0a2a0a, 1);
        g2.fillEllipse(cx, cy, 200, 108);
        // Felt center highlight
        g2.fillStyle(0x0d320d, 0.5);
        g2.fillEllipse(cx, cy - 8, 170, 80);

        // Inner felt ring
        g2.lineStyle(2.5, 0x3a8a3a, 0.9);
        g2.strokeEllipse(cx, cy, 184, 96);

        // Poker accent
        g2.lineStyle(1, COL_POKER_ACCENT, 0.3);
        g2.strokeEllipse(cx, cy, 202, 110);

        // Center ring
        g2.lineStyle(1, 0x2a6a2a, 0.5);
        g2.strokeEllipse(cx, cy, 110, 58);

        // Simulated wood grain on rim — 10 lines with varying opacities
        for (let i = 0; i < 10; i++) {
            g2.lineStyle(0.5, 0x5a3018, 0.1 + (i % 3) * 0.06);
            g2.strokeEllipse(cx, cy, 230 - i * 3, 128 - i * 2);
        }

        // Card suits
        const suits  = ['♠', '♣', '♥', '♦'];
        const angles = [270, 0, 90, 180];
        const suitColors = ['#1a5a1a', '#1a5a1a', '#5a1a1a', '#5a1a1a'];
        for (let i = 0; i < 4; i++) {
            const rad = (angles[i] * Math.PI) / 180;
            this.add.text(
                cx + Math.cos(rad) * 52, cy + Math.sin(rad) * 26, suits[i], {
                    fontFamily: FONT, fontSize: '14px', color: suitColors[i],
                },
            ).setOrigin(0.5).setDepth(DEPTH_PROPS + 1);
        }

        // Center diamond logo
        this.add.text(cx, cy, '♦', {
            fontFamily: FONT, fontSize: '16px', color: '#1a5a1a',
        }).setOrigin(0.5).setDepth(DEPTH_PROPS + 1);

        // Chip stacks — gold color with darker border
        for (let i = 0; i < 3; i++) {
            const chipX = cx - 40 + i * 40;
            const chipY = cy - 12;
            g2.fillStyle(0x000000, 0.25);
            g2.fillCircle(chipX + 1, chipY + 2, 7);
            g2.fillStyle(0x8a6a20, 1);
            g2.fillCircle(chipX, chipY, 7);
            g2.fillStyle(0xc9a84c, 0.9);
            g2.fillCircle(chipX, chipY - 2, 7);
            g2.fillStyle(0xe8c870, 0.6);
            g2.fillCircle(chipX, chipY - 4, 7);
            g2.lineStyle(1, 0x5a3a10, 0.9);
            g2.strokeCircle(chipX, chipY - 4, 7);
            g2.lineStyle(0.5, 0xffffff, 0.2);
            g2.lineBetween(chipX - 5, chipY - 4, chipX + 5, chipY - 4);
        }
    }

    private drawBarCounter(): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);
        const bx = ZONE_BAR.x + 20;
        const by = ZONE_BAR.y + 30;
        const bw = ZONE_BAR.w - 40;
        const bh = 54;

        // Shadow
        g2.fillStyle(0x000000, 0.35);
        g2.fillRoundedRect(bx + 5, by + 6, bw, bh, 5);

        // Counter body — dark mahogany
        g2.fillStyle(0x1a0c04, 1);
        g2.fillRoundedRect(bx, by, bw, bh, 5);

        // Wood grain lines
        for (let i = 0; i < 4; i++) {
            g2.fillStyle(0x2a1808, 0.4);
            g2.fillRect(bx + 4, by + 8 + i * 10, bw - 8, 3);
        }

        // Counter top — lighter surface
        g2.fillStyle(0x3a1e0a, 1);
        g2.fillRoundedRect(bx, by, bw, 10, { tl: 5, tr: 5, bl: 0, br: 0 });
        // Top edge highlight
        g2.fillStyle(0x6a3a14, 0.5);
        g2.fillRoundedRect(bx + 2, by + 1, bw - 4, 3, { tl: 4, tr: 4, bl: 0, br: 0 });
        // Under-counter LED glow — thin amber line along bottom of counter top
        g2.lineStyle(1.5, 0xffb020, 0.35);
        g2.lineBetween(bx + 6, by + 10, bx + bw - 6, by + 10);

        // Gold trim
        g2.lineStyle(2, 0xc9a84c, 0.8);
        g2.strokeRoundedRect(bx, by, bw, bh, 5);
        g2.lineStyle(1, 0xe8c870, 0.3);
        g2.strokeRoundedRect(bx + 2, by + 2, bw - 4, bh - 4, 4);
        // Bar zone accent
        g2.lineStyle(1, COL_BAR_ACCENT, 0.2);
        g2.strokeRoundedRect(bx + 3, by + 3, bw - 6, bh - 6, 3);

        // Bar stools — detailed with legs and cushions
        const stoolCount   = 5;
        const stoolSpacing = bw / (stoolCount + 1);
        for (let i = 0; i < stoolCount; i++) {
            const sx = bx + stoolSpacing * (i + 1);
            const sy = by + bh + 20;
            // Stool shadow
            g2.fillStyle(0x000000, 0.2);
            g2.fillEllipse(sx, sy + 2, 22, 5);
            // Stool legs
            g2.lineStyle(2, 0x2a1408, 1);
            g2.lineBetween(sx - 4, sy + 12, sx - 6, sy + 26);
            g2.lineBetween(sx + 4, sy + 12, sx + 6, sy + 26);
            // Cross brace
            g2.lineStyle(1, 0x3a2010, 0.8);
            g2.lineBetween(sx - 5, sy + 18, sx + 5, sy + 18);
            // Seat cushion
            g2.fillStyle(0x4a2a10, 1);
            g2.fillEllipse(sx, sy, 22, 9);
            g2.fillStyle(0x6a3e1a, 0.6);
            g2.fillEllipse(sx, sy - 1, 18, 6);
            g2.lineStyle(1, 0xc9a84c, 0.4);
            g2.strokeEllipse(sx, sy, 22, 9);
        }

        // Bottle shelf (back wall)
        const shelfY = by - 16;
        g2.fillStyle(0x1a0c04, 1);
        g2.fillRect(bx, shelfY - 18, bw, 18);
        g2.fillStyle(0x3a2010, 0.5);
        g2.fillRect(bx, shelfY - 18, bw, 4);
        g2.lineStyle(1, 0xc9a84c, 0.3);
        g2.strokeRect(bx, shelfY - 18, bw, 18);

        // Mirror/glass backdrop behind bottles
        g2.fillStyle(0x0a1a2a, 0.5);
        g2.fillRect(bx, shelfY - 36, bw, 36);
        // Subtle blue-tint reflective highlight at top of mirror
        g2.fillStyle(0x4080c0, 0.06);
        g2.fillRect(bx, shelfY - 36, bw, 6);

        // Bottles — colorful and detailed
        const bottleColors: Array<[number, number]> = [
            [0x2040c0, 0x4060ff],
            [0x40a020, 0x60d040],
            [0xa04020, 0xd06040],
            [0xc0a000, 0xffd040],
            [0x802080, 0xb030b0],
            [0x208080, 0x40c0c0],
            [0xb04000, 0xe06020],
            [0x4040c0, 0x6060ff],
            [0x606020, 0xa0a030],
        ];
        for (let i = 0; i < 9; i++) {
            const btx = bx + 16 + i * Math.floor((bw - 32) / 9);
            const bty = shelfY - 14;
            const [darkC, lightC] = bottleColors[i % bottleColors.length];
            g2.fillStyle(darkC, 0.85);
            g2.fillRoundedRect(btx - 4, bty + 4, 8, 10, 2);
            g2.fillStyle(lightC, 0.6);
            g2.fillRoundedRect(btx - 3, bty + 2, 6, 5, 2);
            g2.fillStyle(darkC, 0.9);
            g2.fillRect(btx - 1, bty - 4, 3, 8);
            // White specular highlight dot
            g2.fillStyle(0xffffff, 0.35);
            g2.fillCircle(btx - 2, bty + 5, 1.5);
            g2.fillStyle(0xffffff, 0.2);
            g2.fillRect(btx - 3, bty + 5, 2, 6);
        }
    }

    private drawRouletteTable(cx: number, cy: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);

        // Shadow
        g2.fillStyle(0x000000, 0.25);
        g2.fillEllipse(cx, cy + 8, 200, 56);
        // Table rim
        g2.fillStyle(0x3a1c08, 1);
        g2.fillEllipse(cx, cy, 190, 60);
        // Green felt
        g2.fillStyle(0x0c2a0c, 1);
        g2.fillEllipse(cx, cy, 162, 50);
        // Red roulette accent ring
        g2.lineStyle(2, 0x882222, 0.8);
        g2.strokeEllipse(cx, cy, 148, 44);
        // Gold rim highlight
        g2.lineStyle(1, COL_ROULETTE_ACCENT, 0.3);
        g2.strokeEllipse(cx, cy, 164, 52);

        // Wheel representation (small circle left of table)
        const wx = cx - 52;
        g2.fillStyle(0x3a1c08, 1);
        g2.fillCircle(wx, cy, 22);
        g2.fillStyle(0x881818, 1);
        g2.fillCircle(wx, cy, 17);
        g2.fillStyle(0x000000, 0.8);
        g2.fillCircle(wx, cy, 9);
        g2.lineStyle(1, COL_ROULETTE_ACCENT, 0.6);
        g2.strokeCircle(wx, cy, 17);
        // Wheel spokes
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            g2.lineStyle(0.5, 0xcc3333, 0.4);
            g2.lineBetween(wx, cy, wx + Math.cos(angle) * 9, cy + Math.sin(angle) * 9);
        }

        // Betting grid lines on felt
        g2.lineStyle(0.5, 0x1a4a1a, 0.7);
        for (let i = 0; i < 4; i++) {
            g2.lineBetween(cx - 30 + i * 20, cy - 18, cx - 30 + i * 20, cy + 18);
        }
        g2.lineBetween(cx - 32, cy - 6, cx + 32, cy - 6);
        g2.lineBetween(cx - 32, cy + 6, cx + 32, cy + 6);

        // Chip stack
        g2.fillStyle(COL_ROULETTE_ACCENT, 1);
        g2.fillCircle(cx + 55, cy - 8, 5);
        g2.lineStyle(1, 0x882222, 1);
        g2.strokeCircle(cx + 55, cy - 8, 5);
        g2.fillStyle(0x111111, 1);
        g2.fillCircle(cx + 55, cy + 4, 5);
        g2.lineStyle(1, 0x444444, 1);
        g2.strokeCircle(cx + 55, cy + 4, 5);
    }

    private drawPlinkoBoard(cx: number, cy: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);
        const bw = 120;
        const bh = 70;

        // Shadow
        g2.fillStyle(0x000000, 0.3);
        g2.fillRoundedRect(cx - bw / 2 + 3, cy - bh / 2 + 4, bw, bh, 5);
        // Board background
        g2.fillStyle(0x040e0a, 1);
        g2.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 5);
        // Teal border
        g2.lineStyle(2, COL_PLINKO_ACCENT, 0.85);
        g2.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 5);
        // Inner inset
        g2.lineStyle(1, COL_PLINKO_ACCENT, 0.2);
        g2.strokeRoundedRect(cx - bw / 2 + 3, cy - bh / 2 + 3, bw - 6, bh - 6, 3);

        // Mini peg grid (decorative)
        const pegRows = 4;
        const pegCols = 5;
        const pegSpX  = (bw - 24) / (pegCols + 1);
        const pegSpY  = (bh - 28) / (pegRows + 1);
        for (let row = 0; row < pegRows; row++) {
            const offset = row % 2 === 0 ? 0 : pegSpX / 2;
            const colsThisRow = row % 2 === 0 ? pegCols : pegCols - 1;
            for (let col = 0; col < colsThisRow; col++) {
                const px = cx - bw / 2 + 12 + offset + col * pegSpX;
                const py = cy - bh / 2 + 14 + row * pegSpY;
                g2.fillStyle(COL_PLINKO_ACCENT, 0.7);
                g2.fillCircle(px, py, 2);
            }
        }

        // Slot bins at bottom
        const slotColors = [0x445060, 0x3a90e0, 0x2ecc71, 0xf5a020, 0xffd700];
        const nSlots = 5;
        const slotW  = (bw - 8) / nSlots;
        const slotBaseY = cy + bh / 2 - 10;
        for (let i = 0; i < nSlots; i++) {
            const sx = cx - bw / 2 + 4 + i * slotW;
            g2.fillStyle(slotColors[i], 0.4);
            g2.fillRect(sx, slotBaseY - 6, slotW - 1, 8);
            g2.lineStyle(1, slotColors[i], 0.6);
            g2.strokeRect(sx, slotBaseY - 6, slotW - 1, 8);
        }

        // Drop ball indicator
        g2.fillStyle(0xffffff, 0.9);
        g2.fillCircle(cx, cy - bh / 2 + 6, 3);
        g2.fillStyle(COL_PLINKO_ACCENT, 0.5);
        g2.fillCircle(cx, cy - bh / 2 + 6, 5);
    }

    private drawBingoBoard(cx: number, cy: number): void {
        const g2  = this.add.graphics().setDepth(DEPTH_PROPS);
        const bw  = 130;
        const bh  = 70;

        // Shadow
        g2.fillStyle(0x000000, 0.3);
        g2.fillRoundedRect(cx - bw / 2 + 3, cy - bh / 2 + 4, bw, bh, 5);
        // Board background
        g2.fillStyle(0x030c14, 1);
        g2.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 5);
        // Cyan border
        g2.lineStyle(2, COL_BINGO_ACCENT, 0.85);
        g2.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 5);
        // Inner inset
        g2.lineStyle(1, COL_BINGO_ACCENT, 0.2);
        g2.strokeRoundedRect(cx - bw / 2 + 3, cy - bh / 2 + 3, bw - 6, bh - 6, 3);

        // Mini 5×5 grid (decorative)
        const cellW = (bw - 16) / 5;
        const cellH = (bh - 24) / 5;
        const gridX = cx - bw / 2 + 8;
        const gridY = cy - bh / 2 + 16;

        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const rx = gridX + c * cellW;
                const ry = gridY + r * cellH;
                // FREE center + aesthetic checker — purely decorative for the lobby prop
                const isMarked = (r === 2 && c === 2) || (r + c) % 3 === 0;
                g2.fillStyle(isMarked ? 0x004060 : 0x020a12, isMarked ? 0.7 : 0.9);
                g2.fillRect(rx, ry, cellW - 1, cellH - 1);
                g2.lineStyle(0.5, COL_BINGO_ACCENT, isMarked ? 0.5 : 0.2);
                g2.strokeRect(rx, ry, cellW - 1, cellH - 1);
            }
        }

        // B I N G O header
        const headers = ['B', 'I', 'N', 'G', 'O'];
        const headerColors = ['#4080ff', '#ff4080', '#40c040', '#ffa020', '#c040ff'];
        for (let c = 0; c < 5; c++) {
            this.add.text(
                gridX + c * cellW + cellW / 2,
                cy - bh / 2 + 9,
                headers[c],
                { fontFamily: FONT, fontSize: '7px', color: headerColors[c], fontStyle: 'bold' },
            ).setOrigin(0.5).setDepth(DEPTH_PROPS + 1);
        }
    }

    private drawPillar(x: number, y: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS + 1);

        // Shadow
        g2.fillStyle(0x000000, 0.25);
        g2.fillEllipse(x + 3, y + 46, 18, 6);

        // Pillar shaft
        g2.fillStyle(0x1e1008, 1);
        g2.fillRect(x - 10, y - 42, 20, 86);
        // Side highlights for 3D
        g2.fillStyle(0x3a2010, 0.5);
        g2.fillRect(x - 10, y - 42, 4, 86);
        g2.fillStyle(0x0e0804, 0.5);
        g2.fillRect(x + 6, y - 42, 4, 86);
        // Main border
        g2.lineStyle(1.5, COL_TRIM, 0.6);
        g2.strokeRect(x - 10, y - 42, 20, 86);
        // Fluting grooves
        g2.lineStyle(0.5, 0x4a3018, 0.3);
        g2.lineBetween(x - 4, y - 40, x - 4, y + 42);
        g2.lineBetween(x + 4, y - 40, x + 4, y + 42);

        // Capital (top ornament)
        g2.fillStyle(0x2a1808, 1);
        g2.fillRect(x - 14, y - 46, 28, 8);
        g2.fillStyle(0x5a3018, 0.4);
        g2.fillRect(x - 14, y - 46, 28, 3);
        g2.lineStyle(1.5, COL_TRIM, 0.7);
        g2.strokeRect(x - 14, y - 46, 28, 8);

        // Base (bottom ornament)
        g2.fillStyle(0x2a1808, 1);
        g2.fillRect(x - 14, y + 38, 28, 8);
        g2.fillStyle(0x5a3018, 0.4);
        g2.fillRect(x - 14, y + 38, 28, 3);
        g2.lineStyle(1.5, COL_TRIM, 0.7);
        g2.strokeRect(x - 14, y + 38, 28, 8);

        // Gold accent lines on shaft
        g2.lineStyle(1, COL_TRIM, 0.3);
        g2.lineBetween(x - 8, y - 28, x + 8, y - 28);
        g2.lineBetween(x - 8, y + 20, x + 8, y + 20);
    }

    private drawChandelier(x: number, y: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_FOREGROUND);

        // Hanging chain
        g2.lineStyle(1.5, 0xc9a84c, 0.5);
        g2.lineBetween(x, 0, x, y - 16);
        g2.lineStyle(1, 0xe8c870, 0.2);
        g2.lineBetween(x, 0, x, y - 16);

        // Long radial light rays (star burst)
        const RAY_COUNT  = 12;
        const RAY_LENGTH = 70;
        for (let i = 0; i < RAY_COUNT; i++) {
            const angle = (i / RAY_COUNT) * Math.PI * 2;
            g2.lineStyle(0.5, 0xffd700, 0.06);
            g2.lineBetween(x, y, x + Math.cos(angle) * RAY_LENGTH, y + Math.sin(angle) * RAY_LENGTH);
        }

        // Glow rings — outer to inner
        g2.fillStyle(0xffd700, 0.03);
        g2.fillCircle(x, y, 80);
        g2.fillStyle(0xffd700, 0.05);
        g2.fillCircle(x, y, 60);
        g2.fillStyle(0xffaa20, 0.08);
        g2.fillCircle(x, y, 40);
        g2.fillStyle(0xffcc40, 0.12);
        g2.fillCircle(x, y, 24);
        g2.fillStyle(0xffe080, 0.18);
        g2.fillCircle(x, y, 14);

        // Crystal arms (spokes)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const ax = x + Math.cos(angle) * 22;
            const ay = y + Math.sin(angle) * 22;
            g2.lineStyle(1.5, 0xc9a84c, 0.5);
            g2.lineBetween(x, y, ax, ay);
            g2.fillStyle(0xffe080, 0.7);
            g2.fillCircle(ax, ay, 2.5);
            g2.fillStyle(0xffffff, 0.4);
            g2.fillCircle(ax - 0.5, ay - 0.5, 1);
        }
        // Secondary inner ring spokes
        for (let i = 0; i < 8; i++) {
            const angle = ((i + 0.5) / 8) * Math.PI * 2;
            const ax = x + Math.cos(angle) * 14;
            const ay = y + Math.sin(angle) * 14;
            g2.lineStyle(1, 0xc9a84c, 0.35);
            g2.lineBetween(x, y, ax, ay);
        }

        // 4 outer pendant chains at 45° offsets with tiny crystal tips
        for (let i = 0; i < 4; i++) {
            const angle = Math.PI / 4 + (i / 4) * Math.PI * 2;
            const px = x + Math.cos(angle) * 30;
            const py = y + Math.sin(angle) * 30;
            g2.lineStyle(1, 0xc9a84c, 0.3);
            g2.lineBetween(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, px, py);
            g2.fillStyle(0xffe080, 0.6);
            g2.fillCircle(px, py, 2);
            g2.fillStyle(0xffffff, 0.3);
            g2.fillCircle(px - 0.5, py - 0.5, 0.8);
        }

        // Main crystal sphere
        g2.lineStyle(1.5, 0xe8c870, 0.6);
        g2.strokeCircle(x, y, 14);
        g2.fillStyle(0x7a6030, 1);
        g2.fillCircle(x, y, 13);
        g2.fillStyle(0xc9a84c, 0.9);
        g2.fillCircle(x, y, 11);
        g2.fillStyle(0xffe880, 0.6);
        g2.fillCircle(x, y, 8);
        g2.fillStyle(0xffffff, 0.35);
        g2.fillCircle(x - 3, y - 4, 5);
        g2.fillStyle(0xffffff, 0.15);
        g2.fillCircle(x + 2, y + 3, 3);

        // Bottom pendant
        g2.fillStyle(0xc9a84c, 0.7);
        g2.fillCircle(x, y + 16, 3);
        g2.lineStyle(1, 0xe8c870, 0.5);
        g2.strokeCircle(x, y + 16, 3);
        g2.lineStyle(1, 0xc9a84c, 0.4);
        g2.lineBetween(x, y + 14, x, y + 13);
    }

    private buildAmbientLighting(): void {
        const lightPools: Array<[number, number, number, number]> = [
            [ZONE_SLOTS.x + ZONE_SLOTS.w / 2,           ZONE_SLOTS.y + ZONE_SLOTS.h / 2,           0xf5a020, 140],
            [ZONE_POKER.x + ZONE_POKER.w / 2,           ZONE_POKER.y + ZONE_POKER.h / 2,           0x3a90e0, 150],
            [ZONE_BAR.x + ZONE_BAR.w / 2,               ZONE_BAR.y + ZONE_BAR.h / 2,               0xe06820, 140],
            [ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2,   ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2,   0x9b50c0, 110],
            [ZONE_ROULETTE.x + ZONE_ROULETTE.w / 2,     ZONE_ROULETTE.y + ZONE_ROULETTE.h / 2,     0xcc3333, 100],
            [ZONE_PLINKO.x + ZONE_PLINKO.w / 2,         ZONE_PLINKO.y + ZONE_PLINKO.h / 2,         0x20d4a0, 100],
            [ZONE_BINGO.x  + ZONE_BINGO.w  / 2,         ZONE_BINGO.y  + ZONE_BINGO.h  / 2,         0x00c8ff, 100],
        ];

        const ambientGfx = this.add.graphics().setDepth(DEPTH_FLOOR + 2);
        for (const [lx, ly, col, radius] of lightPools) {
            ambientGfx.fillStyle(col, 0.025);
            ambientGfx.fillCircle(lx, ly, radius);
            ambientGfx.fillStyle(col, 0.035);
            ambientGfx.fillCircle(lx, ly, radius * 0.55);
            ambientGfx.fillStyle(col, 0.05);
            ambientGfx.fillCircle(lx, ly, radius * 0.28);
        }
    }

    private buildLabels(): void {
        const d = DEPTH_PROPS + 5;
        this.buildZoneSign(ZONE_SLOTS.x + ZONE_SLOTS.w / 2, ZONE_SLOTS.y + 18, '🎰 SLOTS CORNER', COL_SLOTS_ACCENT, d);
        this.buildZoneSign(ZONE_POKER.x + ZONE_POKER.w / 2, ZONE_POKER.y + 18, '♠ POKER ROOM', COL_POKER_ACCENT, d);
        this.buildZoneSign(ZONE_BAR.x + ZONE_BAR.w / 2, ZONE_BAR.y + 14, '🍹 BAR & LOUNGE', COL_BAR_ACCENT, d);
        this.buildZoneSign(ZONE_ENTRANCE.x + ZONE_ENTRANCE.w / 2, ZONE_ENTRANCE.y + 14, '↑ ENTRANCE', COL_TRIM, d);
        this.buildZoneSign(ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2, ZONE_BLACKJACK.y + 14, '🃏 BLACKJACK', COL_BLACKJACK_ACCENT, d);
        this.buildZoneSign(ZONE_ROULETTE.x + ZONE_ROULETTE.w / 2, ZONE_ROULETTE.y + 14, '🎡 ROULETTE', COL_ROULETTE_ACCENT, d);
        this.buildZoneSign(ZONE_PLINKO.x + ZONE_PLINKO.w / 2, ZONE_PLINKO.y + 14, '🎯 PLINKO', COL_PLINKO_ACCENT, d);
        this.buildZoneSign(ZONE_BINGO.x + ZONE_BINGO.w / 2, ZONE_BINGO.y + 14, '🎱 BINGO', COL_BINGO_ACCENT, d);
    }

    private buildZoneSign(x: number, y: number, text: string, accentColor: number, depth: number): void {
        const t = this.add.text(x, y, text, {
            fontFamily: FONT, fontSize: '13px',
            color: Phaser.Display.Color.IntegerToColor(accentColor).rgba,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(depth);

        const pad = 14;
        const sw = t.width + pad * 2;
        const sh = t.height + 10;

        const bgGfx = this.add.graphics().setDepth(depth - 1);

        // Extra outer neon glow (4th ring)
        bgGfx.lineStyle(8, accentColor, 0.04);
        bgGfx.strokeRoundedRect(x - sw / 2 - 5, y - sh / 2 - 5, sw + 10, sh + 10, 8);
        // Outer neon glow
        bgGfx.lineStyle(6, accentColor, 0.08);
        bgGfx.strokeRoundedRect(x - sw / 2 - 3, y - sh / 2 - 3, sw + 6, sh + 6, 7);
        // Mid glow
        bgGfx.lineStyle(3, accentColor, 0.15);
        bgGfx.strokeRoundedRect(x - sw / 2 - 1, y - sh / 2 - 1, sw + 2, sh + 2, 6);

        // Background fill — 3-layer vertical gradient: dark top (30%), lighter centre (40%), dark bottom (30%)
        bgGfx.fillStyle(0x000000, 0.75);
        bgGfx.fillRoundedRect(x - sw / 2, y - sh / 2, sw, sh, 5);
        bgGfx.fillStyle(accentColor, 0.04);
        bgGfx.fillRoundedRect(x - sw / 2, y - sh / 2 + sh * 0.3, sw, sh * 0.4, 0);
        bgGfx.fillStyle(accentColor, 0.06);
        bgGfx.fillRoundedRect(x - sw / 2, y - sh / 2, sw, sh, 5);

        // Neon border
        bgGfx.lineStyle(1.5, accentColor, 0.8);
        bgGfx.strokeRoundedRect(x - sw / 2, y - sh / 2, sw, sh, 5);

        // Left accent bar
        bgGfx.fillStyle(accentColor, 0.8);
        bgGfx.fillRoundedRect(x - sw / 2, y - sh / 2, 3, sh, { tl: 5, bl: 5, tr: 0, br: 0 });

        // Double bottom reflection (neon tube effect)
        bgGfx.lineStyle(1, accentColor, 0.25);
        bgGfx.lineBetween(x - sw / 2 + 8, y + sh / 2 - 2, x + sw / 2 - 8, y + sh / 2 - 2);
        bgGfx.lineStyle(0.5, accentColor, 0.12);
        bgGfx.lineBetween(x - sw / 2 + 10, y + sh / 2 - 4, x + sw / 2 - 10, y + sh / 2 - 4);
    }

    private buildEntranceFx(): void {
        const g3  = this.add.graphics().setDepth(DEPTH_FLOOR + 1);
        const ex  = ZONE_ENTRANCE.x;
        const ey  = ZONE_ENTRANCE.y;
        const ew  = ZONE_ENTRANCE.w;
        const eh  = ZONE_ENTRANCE.h;

        // Welcome mat base
        g3.fillStyle(0x0a1c0a, 1);
        g3.fillRoundedRect(ex + 12, ey + 12, ew - 24, eh - 24, 4);

        // Mat border strips — layered
        g3.lineStyle(3, COL_TRIM, 0.5);
        g3.strokeRoundedRect(ex + 12, ey + 12, ew - 24, eh - 24, 4);
        g3.lineStyle(1, COL_TRIM, 0.2);
        g3.strokeRoundedRect(ex + 18, ey + 18, ew - 36, eh - 36, 3);
        g3.lineStyle(1, COL_TRIM_DIM, 0.15);
        g3.strokeRoundedRect(ex + 22, ey + 22, ew - 44, eh - 44, 2);

        // Mat diagonal pattern — 45° lines clipped to mat inner bounds [ex+14..ex+ew-14, ey+14..ey+eh-14]
        g3.lineStyle(0.5, 0x1a3a1a, 0.4);
        const mdiag = 16;
        const matX1 = ex + 14, matX2 = ex + ew - 14;
        const matY1 = ey + 14, matY2 = ey + eh - 14;
        for (let d = -(eh); d < ew + eh; d += mdiag) {
            // Each diagonal line goes from (ex+d, ey+14) to (ex+d+eh, ey+eh-14), clipped to mat bounds
            const x1 = Math.max(matX1, ex + d);
            const y1 = matY1 + Math.max(0, matX1 - (ex + d));   // slide y down if x was clamped left
            const x2 = Math.min(matX2, ex + d + eh);
            const y2 = matY2 - Math.max(0, (ex + d + eh) - matX2); // slide y up if x was clamped right
            if (x1 < x2) g3.lineBetween(x1, y1, x2, y2);
        }

        // Glow overlay
        g3.fillStyle(0x1a3a1a, 0.15);
        g3.fillRoundedRect(ex + 12, ey + 12, ew - 24, eh - 24, 4);

        this.add.text(ex + ew / 2, ey + eh / 2, '✦ WELCOME ✦', {
            fontFamily: FONT, fontSize: '11px', color: '#5a9a5a', fontStyle: 'bold', letterSpacing: 3,
        }).setOrigin(0.5).setDepth(DEPTH_FLOOR + 2);

        // Golden arrow guide lights up the path
        const arrowY = ey + eh / 2 + 10;
        for (let i = 0; i < 5; i++) {
            g3.fillStyle(COL_TRIM, i % 2 === 0 ? 0.7 : 0.3);
            g3.fillCircle(ex + ew / 2, arrowY - i * 12, 3);
        }

        // Neon arch above the entrance path
        g3.lineStyle(2, COL_TRIM, 0.5);
        g3.beginPath();
        g3.arc(ex + ew / 2, ey + 12, ew / 2 - 8, Math.PI, 0, false);
        g3.strokePath();
        g3.lineStyle(4, COL_TRIM, 0.12);
        g3.beginPath();
        g3.arc(ex + ew / 2, ey + 12, ew / 2 - 6, Math.PI, 0, false);
        g3.strokePath();
    }

    // ── Avatar Blockers ───────────────────────────────────────────────────────

    private registerAvatarBlockers(): void {
        for (const b of this.getSharedBlockers()) {
            this.avatar.addBlocker(b);
        }
    }

    // ── AI Walkers ────────────────────────────────────────────────────────────

    private spawnAIWalkers(): void {
        // Starting positions spread across the walkable floor
        const spawns: [number, number][] = [
            [200, 490],   // left corridor
            [760, 470],   // right corridor
            [480, 560],   // pre-entrance
            [340, 310],   // blackjack approach
            [640, 200],   // poker zone approach
        ];

        const blockerDefs = this.getSharedBlockers();

        for (let i = 0; i < spawns.length; i++) {
            const [sx, sy] = spawns[i];
            const name  = AI_NAMES[i % AI_NAMES.length];
            const color = AI_COLORS[i % AI_COLORS.length];

            const ai = new AIWalker(this, sx, sy, name, color);
            for (const b of blockerDefs) {
                ai.addBlocker(b);
            }
            this.aiWalkers.push(ai);
        }
    }

    /** Returns the shared list of blocker rects used by all walkers (player + AI). */
    private getSharedBlockers(): Array<{ x: number; y: number; w: number; h: number }> {
        const bjCx = ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2;
        const bjCy = ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2;
        const rtCx = ZONE_ROULETTE.x  + ZONE_ROULETTE.w  / 2;
        const rtCy = ZONE_ROULETTE.y  + ZONE_ROULETTE.h  / 2;

        return [
            // Perimeter walls
            { x: 0,            y: 0,            w: WORLD_W, h: 32   },
            { x: 0,            y: 0,            w: 24,      h: WORLD_H },
            { x: WORLD_W - 24, y: 0,            w: 24,      h: WORLD_H },
            { x: 0,            y: WORLD_H - 24, w: WORLD_W, h: 24   },
            // Slot machines
            { x: 60  - 22, y: 100 - 38, w: 44, h: 70 },
            { x: 120 - 22, y: 100 - 38, w: 44, h: 70 },
            { x: 60  - 22, y: 200 - 38, w: 44, h: 70 },
            { x: 120 - 22, y: 200 - 38, w: 44, h: 70 },
            // Poker table
            { x: 790 - 110, y: 190 - 60, w: 220, h: 120 },
            // Blackjack table
            { x: bjCx - 95, y: bjCy - 45, w: 190, h: 90 },
            // Bar counter
            { x: ZONE_BAR.x + 20, y: ZONE_BAR.y + 30, w: ZONE_BAR.w - 40, h: 50 },
            // Roulette table
            { x: rtCx - 95, y: rtCy - 28, w: 190, h: 56 },
            // Plinko board
            {
                x: ZONE_PLINKO.x + ZONE_PLINKO.w / 2 - 60,
                y: ZONE_PLINKO.y + ZONE_PLINKO.h / 2 - 35,
                w: 120, h: 70,
            },
            // Bingo board
            {
                x: ZONE_BINGO.x + ZONE_BINGO.w / 2 - 65,
                y: ZONE_BINGO.y + ZONE_BINGO.h / 2 - 35,
                w: 130, h: 70,
            },
        ];
    }

    // ── Zone Detection ────────────────────────────────────────────────────────

    private updateZone(): void {
        const { x, y } = this.avatar;
        let zone: Zone  = 'floor';

        if (this.inZone(x, y, ZONE_SLOTS))          zone = 'slots';
        else if (this.inZone(x, y, ZONE_POKER))      zone = 'poker';
        else if (this.inZone(x, y, ZONE_BAR))        zone = 'bar';
        else if (this.inZone(x, y, ZONE_BLACKJACK))  zone = 'blackjack';
        else if (this.inZone(x, y, ZONE_ROULETTE))   zone = 'roulette';
        else if (this.inZone(x, y, ZONE_PLINKO))     zone = 'plinko';
        else if (this.inZone(x, y, ZONE_BINGO))      zone = 'bingo';
        else if (this.inZone(x, y, ZONE_ENTRANCE))   zone = 'entrance';

        if (GameState.get().zone !== zone) {
            GameState.setZone(zone);
            this.updateHintForZone(zone);
        }
    }

    private inZone(
        x: number, y: number,
        zone: { x: number; y: number; w: number; h: number },
    ): boolean {
        return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
    }

    // ── Interaction Hotspots ──────────────────────────────────────────────────

    private registerHotspots(): void {
        this.interaction.register({
            id: 'slots', x: 90, y: 150, radius: 90,
            label: 'Play Slot Machines',
            onInteract: () => this.openSlots(),
        });
        this.interaction.register({
            id: 'poker', x: 790, y: 190, radius: 130,
            label: "Join Poker Table",
            onInteract: () => this.openPoker(),
        });
        this.interaction.register({
            id: 'bar',
            x: ZONE_BAR.x + ZONE_BAR.w / 2, y: ZONE_BAR.y + 120, radius: 120,
            label: 'Order at the Bar',
            onInteract: () => this.openBar(),
        });
        this.interaction.register({
            id: 'blackjack',
            x: ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2,
            y: ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2,
            radius: 100,
            label: 'Play Blackjack',
            onInteract: () => this.openBlackjack(),
        });
        this.interaction.register({
            id: 'roulette',
            x: ZONE_ROULETTE.x + ZONE_ROULETTE.w / 2,
            y: ZONE_ROULETTE.y + ZONE_ROULETTE.h / 2,
            radius: 100,
            label: 'Play Roulette',
            onInteract: () => this.openRoulette(),
        });
        this.interaction.register({
            id: 'plinko',
            x: ZONE_PLINKO.x + ZONE_PLINKO.w / 2,
            y: ZONE_PLINKO.y + ZONE_PLINKO.h / 2,
            radius: 100,
            label: 'Play Plinko',
            onInteract: () => this.openPlinko(),
        });
        this.interaction.register({
            id: 'bingo',
            x: ZONE_BINGO.x + ZONE_BINGO.w / 2,
            y: ZONE_BINGO.y + ZONE_BINGO.h / 2,
            radius: 100,
            label: 'Play Bingo',
            onInteract: () => this.openBingo(),
        });
    }

    // ── Panel Openers ─────────────────────────────────────────────────────────

    private openSlots(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'slots';
        GameState.setInteraction('slots');
        new SlotsPanel(this, () => this.closePanel());
    }

    private openBar(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'bar';
        GameState.setInteraction('bar');
        new BarPanel(this, () => this.closePanel());
    }

    private openPoker(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'poker';
        GameState.setInteraction('poker');
        new PokerPanel(this, () => this.closePanel());
    }

    private openBlackjack(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'blackjack';
        GameState.setInteraction('blackjack');
        new BlackjackPanel(this, () => this.closePanel());
    }

    private openRoulette(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'roulette';
        GameState.setInteraction('roulette');
        new RoulettePanel(this, () => this.closePanel());
    }

    private openPlinko(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'plinko';
        GameState.setInteraction('plinko');
        new PlinkoPanel(this, () => this.closePanel());
    }

    private openBingo(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'bingo';
        GameState.setInteraction('bingo');
        new BingoPanel(this, () => this.closePanel());
    }

    private closePanel(): void {
        this.activePanel = 'none';
        GameState.clearInteraction();
        this.updateHintForZone(GameState.get().zone);
    }

    // ── Context-sensitive hint bar ────────────────────────────────────────────

    private buildHintBar(): void {
        const cx = GAME_WIDTH / 2;
        this.hintBg = this.add.rectangle(cx, GAME_HEIGHT - 13, GAME_WIDTH - 16, 18, 0x000000, 0.72)
            .setScrollFactor(0).setDepth(DEPTH_HUD + 1).setAlpha(0);

        this.hintText = this.add.text(cx, GAME_HEIGHT - 13, '', {
            fontFamily: FONT, fontSize: '9px', color: '#3a5a4a',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 2).setAlpha(0);

        this.updateHintForZone('floor');
    }

    private updateHintForZone(zone: Zone): void {
        const HINTS: Record<Zone, string> = {
            floor:     'WASD / ↑↓←→ move  ·  approach a zone and press  E  to interact  ·  ESC close',
            entrance:  'WASD / ↑↓←→ move  ·  walk north to explore the casino',
            slots:     'Walk up and press  E  to play  ·  SPACE spin  ·  ESC close',
            poker:     'Walk up and press  E  to join  ·  F=Fold  C=Call  R=Raise  ·  ESC close',
            bar:       'Walk up and press  E  to order  ·  ESC close',
            blackjack: 'Walk up and press  E  to play  ·  H=Hit  S=Stand  ·  ESC close',
            roulette:  'Walk up and press  E  to play  ·  SPACE spin  ·  ESC close',
            plinko:    'Walk up and press  E  to play  ·  SPACE drop  ·  ESC close',
            bingo:     'Walk up and press  E  to play  ·  ESC close',
        };

        if (this.hintText) {
            this.hintText.setText(HINTS[zone] ?? HINTS['floor']);
        }
    }

    // ── Welcome Banner ────────────────────────────────────────────────────────

    private showWelcomeBanner(): void {
        const cx   = GAME_WIDTH / 2;
        const name = GameState.get().displayName;
        const tutY = GAME_HEIGHT / 2;

        const tutW = 580;
        const tutH = 280;

        // Panel background
        const tutBgGfx = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_HUD + 10);
        tutBgGfx.fillStyle(0x000000, 0.55);
        tutBgGfx.fillRoundedRect(cx - tutW / 2 + 3, tutY - tutH / 2 + 4, tutW, tutH, 10);
        tutBgGfx.fillStyle(COL_UI_BG, 0.95);
        tutBgGfx.fillRoundedRect(cx - tutW / 2, tutY - tutH / 2, tutW, tutH, 10);
        tutBgGfx.fillStyle(COL_UI_BG2, 1);
        tutBgGfx.fillRoundedRect(cx - tutW / 2, tutY - tutH / 2, tutW, 52, { tl: 10, tr: 10, bl: 0, br: 0 });
        tutBgGfx.lineStyle(2, COL_UI_BORDER, 0.8);
        tutBgGfx.strokeRoundedRect(cx - tutW / 2, tutY - tutH / 2, tutW, tutH, 10);
        tutBgGfx.lineStyle(1.5, COL_TRIM, 0.4);
        tutBgGfx.lineBetween(cx - tutW / 2 + 16, tutY - tutH / 2 + 52, cx + tutW / 2 - 16, tutY - tutH / 2 + 52);

        const greeting = name !== 'Guest'
            ? `Welcome to Slot City, ${name}!`
            : 'Welcome to Slot City Casino!';
        const tutTitle = this.add.text(cx, tutY - tutH / 2 + 26, `★  ${greeting}  ★`, {
            fontFamily: FONT, fontSize: '15px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);

        const steps: Array<{ icon: string; title: string; desc: string }> = [
            { icon: '①', title: 'Move around',       desc: 'WASD or Arrow keys to walk your avatar through the casino' },
            { icon: '②', title: 'Approach a zone',   desc: 'Walk near Slots, Poker Table, Bar, Blackjack, Roulette, Plinko or Bingo' },
            { icon: '③', title: 'Press E to interact', desc: 'Approach any zone and press E when the prompt appears' },
            { icon: '④', title: 'Play & earn chips',  desc: 'Start with 1,000 ◈  ·  Free reload if you go broke  ·  Minimap: bottom-right' },
        ];

        const tutObjs: Phaser.GameObjects.GameObject[] = [tutBgGfx, tutTitle];

        steps.forEach((s, i) => {
            const sy = tutY - tutH / 2 + 78 + i * 46;

            const iconT = this.add.text(cx - 256, sy, s.icon, {
                fontFamily: FONT, fontSize: '18px', color: '#c9a84c',
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);

            const titleT = this.add.text(cx - 224, sy - 9, s.title, {
                fontFamily: FONT, fontSize: '12px', color: '#9acca8', fontStyle: 'bold',
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);

            const descT = this.add.text(cx - 224, sy + 9, s.desc, {
                fontFamily: FONT, fontSize: '10px', color: '#4a6a5a',
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);

            tutObjs.push(iconT, titleT, descT);
        });

        const dismiss = this.add.text(cx, tutY + tutH / 2 - 18, 'Press any key or click to dismiss  ·  Closes automatically in 12s', {
            fontFamily: FONT, fontSize: '9px', color: '#3a5a4a',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);
        tutObjs.push(dismiss);

        let tutorialDismissed = false;

        const closeTutorial = (): void => {
            if (tutorialDismissed) return;
            tutorialDismissed = true;
            this.tweens.add({
                targets:  tutObjs,
                alpha:    0,
                duration: 400,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    tutObjs.forEach(o => o.destroy());
                    // Fade in the context hint bar
                    this.tweens.add({ targets: [this.hintBg, this.hintText], alpha: 1, duration: 500 });
                },
            });
        };

        // Make overlay interactive for click-to-dismiss
        tutBgGfx.setInteractive(
            new Phaser.Geom.Rectangle(cx - tutW / 2, tutY - tutH / 2, tutW, tutH),
            Phaser.Geom.Rectangle.Contains,
        );
        tutBgGfx.once('pointerdown', closeTutorial);
        this.input.keyboard!.once('keydown', closeTutorial);
        this.time.delayedCall(12000, closeTutorial);
    }
}
