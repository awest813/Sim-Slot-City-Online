// ── CasinoLobbyScene — main playable casino floor ────────────────────────────
import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, WORLD_W, WORLD_H,
    COL_BG, COL_FLOOR, COL_WALL, COL_WALL_STRIPE,
    COL_TRIM, COL_TRIM_DIM, COL_FELT, COL_TABLE, COL_BAR,
    COL_SLOT_BODY, COL_SLOT_TRIM,
    DEPTH_FLOOR, DEPTH_PROPS, DEPTH_FOREGROUND, DEPTH_HUD,
    ZONE_ENTRANCE, ZONE_SLOTS, ZONE_POKER, ZONE_BAR, ZONE_BLACKJACK,
    FONT,
} from '../../game/constants';
import { GameState, Zone } from '../../core/state/GameState';
import { AvatarController } from '../../core/systems/AvatarController';
import { InteractionSystem } from '../../core/systems/InteractionSystem';
import { HUD } from '../ui/HUD';
import { SlotsPanel } from '../slots/SlotsPanel';
import { BarPanel, resetBarSession } from '../bar/BarPanel';
import { PokerPanel } from '../poker/PokerPanel';
import { BlackjackPanel } from '../blackjack/BlackjackPanel';

export class CasinoLobbyScene extends Phaser.Scene {
    private avatar!: AvatarController;
    private interaction!: InteractionSystem;
    private activePanel: 'none' | 'slots' | 'bar' | 'poker' | 'blackjack' = 'none';
    private graphics!: Phaser.GameObjects.Graphics;

    constructor() { super({ key: 'CasinoLobbyScene' }); }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    create(): void {
        // Preserve the player name set in PreloadScene — only reset non-name fields
        const savedName = GameState.get().displayName;
        GameState.reset();
        if (savedName && savedName !== 'Guest') {
            GameState.update({ displayName: savedName });
        }

        // Reset per-session bar bonuses (e.g. Lucky Shot) so a new game session
        // starts fresh but bonuses don't carry across bar reopens.
        resetBarSession();

        this.graphics = this.add.graphics();

        this.buildWorld();
        this.buildProps();
        this.buildLabels();
        this.buildEntranceFx();

        // Avatar — spawn at entrance with the player's chosen name
        const spawnX = WORLD_W / 2;
        const spawnY = WORLD_H - 100;
        this.avatar = new AvatarController(this, spawnX, spawnY, GameState.get().displayName);
        this.registerAvatarBlockers();

        // Camera — manual follow in update()
        this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
        this.cameras.main.scrollX = spawnX - GAME_WIDTH / 2;
        this.cameras.main.scrollY = spawnY - GAME_HEIGHT / 2;

        // Interaction system
        this.interaction = new InteractionSystem(this);
        this.registerHotspots();

        // HUD
        new HUD(this);

        // Welcome text (briefly shown)
        this.showWelcomeBanner();
    }

    update(_time: number, delta: number): void {
        if (this.activePanel !== 'none') return;

        this.avatar.update(delta);

        // Manual camera follow
        const targetX = this.avatar.x - GAME_WIDTH  / 2;
        const targetY = this.avatar.y - GAME_HEIGHT / 2;
        this.cameras.main.scrollX = Phaser.Math.Linear(this.cameras.main.scrollX, targetX, 0.12);
        this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, 0.12);

        // Clamp camera to world
        this.cameras.main.scrollX = Phaser.Math.Clamp(this.cameras.main.scrollX, 0, WORLD_W - GAME_WIDTH);
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY, 0, WORLD_H - GAME_HEIGHT);

        this.interaction.update(this.avatar.x, this.avatar.y);
        this.updateZone();
    }

    // ── World Building ────────────────────────────────────────────────────────

    private buildWorld(): void {
        const g = this.graphics;

        // === Background / sky ===
        g.fillStyle(COL_BG, 1);
        g.fillRect(0, 0, WORLD_W, WORLD_H);

        // === Walls ===
        g.fillStyle(COL_WALL, 1);
        // Perimeter walls
        g.fillRect(0,           0,           WORLD_W, 32);          // top wall
        g.fillRect(0,           0,           24,      WORLD_H);     // left wall
        g.fillRect(WORLD_W - 24, 0,          24,      WORLD_H);     // right wall
        g.fillRect(0,           WORLD_H - 24, WORLD_W, 24);         // bottom wall

        // Wall stripe decoration
        g.fillStyle(COL_WALL_STRIPE, 1);
        g.fillRect(24, 8, WORLD_W - 48, 6);   // top stripe

        // === Casino carpet floor ===
        g.fillStyle(COL_FLOOR, 1);
        g.fillRect(24, 32, WORLD_W - 48, WORLD_H - 56);

        // === Carpet pattern — subtle diamond grid ===
        g.lineStyle(0.5, 0x163016, 0.4);
        const gridSize = 48;
        for (let x = 24; x < WORLD_W - 24; x += gridSize) {
            g.lineBetween(x, 32, x, WORLD_H - 24);
        }
        for (let y = 32; y < WORLD_H - 24; y += gridSize) {
            g.lineBetween(24, y, WORLD_W - 24, y);
        }

        // === Zone area fills — slightly different floor tone ===
        // Slots zone
        g.fillStyle(0x0d2a0d, 0.5);
        g.fillRect(ZONE_SLOTS.x, ZONE_SLOTS.y, ZONE_SLOTS.w, ZONE_SLOTS.h);

        // Poker zone
        g.fillStyle(0x0d0d2a, 0.5);
        g.fillRect(ZONE_POKER.x, ZONE_POKER.y, ZONE_POKER.w, ZONE_POKER.h);

        // Bar zone
        g.fillStyle(0x1a1005, 0.5);
        g.fillRect(ZONE_BAR.x, ZONE_BAR.y, ZONE_BAR.w, ZONE_BAR.h);

        // Blackjack zone
        g.fillStyle(0x1a0d1a, 0.5);
        g.fillRect(ZONE_BLACKJACK.x, ZONE_BLACKJACK.y, ZONE_BLACKJACK.w, ZONE_BLACKJACK.h);

        // === Zone trim borders ===
        g.lineStyle(1, COL_TRIM_DIM, 0.4);
        g.strokeRect(ZONE_SLOTS.x, ZONE_SLOTS.y, ZONE_SLOTS.w, ZONE_SLOTS.h);
        g.strokeRect(ZONE_POKER.x, ZONE_POKER.y, ZONE_POKER.w, ZONE_POKER.h);
        g.strokeRect(ZONE_BAR.x,   ZONE_BAR.y,   ZONE_BAR.w,   ZONE_BAR.h);
        g.strokeRect(ZONE_BLACKJACK.x, ZONE_BLACKJACK.y, ZONE_BLACKJACK.w, ZONE_BLACKJACK.h);

        // === Entrance path ===
        g.fillStyle(0x1a3a1a, 1);
        g.fillRect(ZONE_ENTRANCE.x, ZONE_ENTRANCE.y, ZONE_ENTRANCE.w, ZONE_ENTRANCE.h);

        // Entrance arch / doorway indicator
        g.lineStyle(2, COL_TRIM, 0.8);
        g.strokeRect(ZONE_ENTRANCE.x, ZONE_ENTRANCE.y, ZONE_ENTRANCE.w, ZONE_ENTRANCE.h);

        g.setDepth(DEPTH_FLOOR);
    }

    private buildProps(): void {
        // === SLOTS ZONE — 4 slot machines ===
        const slotMachinePositions: [number, number][] = [
            [60, 100], [120, 100], [60, 200], [120, 200],
        ];
        for (const [mx, my] of slotMachinePositions) {
            this.drawSlotMachine(mx, my);
        }

        // === POKER ZONE — 1 large poker table ===
        this.drawPokerTable(790, 190);

        // === BLACKJACK ZONE — 1 blackjack table ===
        this.drawBlackjackTable(ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2, ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2);

        // === BAR ZONE — bar counter + stools ===
        this.drawBarCounter();

        // === Decorative pillars ===
        const pillarPositions: [number, number][] = [
            [30, 230], [WORLD_W - 30, 230],
            [30, 450], [WORLD_W - 30, 450],
        ];
        for (const [px, py] of pillarPositions) {
            this.drawPillar(px, py);
        }

        // === Chandelier / ceiling lights ===
        this.drawChandelier(WORLD_W / 2, 90);
        this.drawChandelier(200, 200);
        this.drawChandelier(760, 200);
    }

    private drawSlotMachine(x: number, y: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS + y * 0.1);

        // Machine body
        g2.fillStyle(COL_SLOT_BODY, 1);
        g2.fillRoundedRect(x - 22, y - 38, 44, 70, 4);

        // Gold trim
        g2.lineStyle(2, COL_SLOT_TRIM, 1);
        g2.strokeRoundedRect(x - 22, y - 38, 44, 70, 4);

        // Screen area
        g2.fillStyle(0x050510, 1);
        g2.fillRoundedRect(x - 16, y - 30, 32, 26, 3);

        // Reel dividers
        g2.lineStyle(1, COL_SLOT_TRIM, 0.5);
        g2.lineBetween(x - 5, y - 30, x - 5, y - 4);
        g2.lineBetween(x + 5, y - 30, x + 5, y - 4);

        // Reel symbols (text)
        this.add.text(x - 10, y - 22, '7', {
            fontFamily: FONT, fontSize: '12px', color: '#c9a84c',
        }).setOrigin(0.5).setDepth(DEPTH_PROPS + y * 0.1 + 1);
        this.add.text(x, y - 22, '★', {
            fontFamily: FONT, fontSize: '12px', color: '#e05050',
        }).setOrigin(0.5).setDepth(DEPTH_PROPS + y * 0.1 + 1);
        this.add.text(x + 10, y - 22, '◆', {
            fontFamily: FONT, fontSize: '12px', color: '#5050e0',
        }).setOrigin(0.5).setDepth(DEPTH_PROPS + y * 0.1 + 1);

        // Spin button
        g2.fillStyle(COL_SLOT_TRIM, 1);
        g2.fillCircle(x, y + 14, 7);
        g2.fillStyle(0xc9a84c, 0.5);
        g2.fillCircle(x - 2, y + 12, 3);

        // Shadow
        g2.fillStyle(0x000000, 0.2);
        g2.fillEllipse(x, y + 36, 40, 8);
    }

    private drawBlackjackTable(cx: number, cy: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);

        // Table shadow
        g2.fillStyle(0x000000, 0.25);
        g2.fillEllipse(cx, cy + 8, 200, 80);

        // Table wood rim
        g2.fillStyle(COL_TABLE, 1);
        g2.fillEllipse(cx, cy, 190, 90);

        // Felt surface
        g2.fillStyle(0x2a0d2a, 1);
        g2.fillEllipse(cx, cy, 162, 74);

        // Felt ring
        g2.lineStyle(2, 0x6a2a6a, 1);
        g2.strokeEllipse(cx, cy, 148, 66);

        // Center arc (insurance / blackjack pays 3:2 text area)
        g2.lineStyle(1, 0x5a1a5a, 0.6);
        g2.strokeEllipse(cx, cy - 6, 80, 34);

        // Card suits
        const suits = ['♠', '♣', '♥', '♦'];
        const angles = [270, 0, 90, 180];
        for (let i = 0; i < 4; i++) {
            const rad = (angles[i] * Math.PI) / 180;
            const sx = cx + Math.cos(rad) * 40;
            const sy = cy + Math.sin(rad) * 18;
            this.add.text(sx, sy, suits[i], {
                fontFamily: FONT, fontSize: '12px',
                color: i < 2 ? '#3a1a3a' : '#5a1a1a',
            }).setOrigin(0.5).setDepth(DEPTH_PROPS + 1);
        }

        // Dealer position indicator (top of table)
        g2.fillStyle(COL_TRIM, 0.4);
        g2.fillRect(cx - 20, cy - 35, 40, 6);

        // Player betting circles
        const betPositions = [-70, -35, 0, 35, 70];
        for (const bx of betPositions) {
            g2.lineStyle(1, 0x8a3a8a, 0.6);
            g2.strokeCircle(cx + bx, cy + 20, 10);
        }

        // Chip stacks
        for (let i = 0; i < 2; i++) {
            const chipX = cx - 20 + i * 40;
            g2.fillStyle(0x9b59b6, 1);
            g2.fillCircle(chipX, cy - 8, 6);
            g2.lineStyle(1, 0x6c3483, 1);
            g2.strokeCircle(chipX, cy - 8, 6);
        }
    }

    private drawPokerTable(cx: number, cy: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);

        // Table shadow
        g2.fillStyle(0x000000, 0.25);
        g2.fillEllipse(cx, cy + 10, 230, 100);

        // Table wood rim
        g2.fillStyle(COL_TABLE, 1);
        g2.fillEllipse(cx, cy, 220, 120);

        // Felt surface
        g2.fillStyle(COL_FELT, 1);
        g2.fillEllipse(cx, cy, 190, 100);

        // Felt ring
        g2.lineStyle(2, 0x2a6a2a, 1);
        g2.strokeEllipse(cx, cy, 175, 88);

        // Center decoration
        g2.lineStyle(1, 0x2a6a2a, 0.4);
        g2.strokeEllipse(cx, cy, 100, 50);

        // Card suits decoration
        const suits = ['♠', '♣', '♥', '♦'];
        const angles = [270, 0, 90, 180];
        for (let i = 0; i < 4; i++) {
            const rad = (angles[i] * Math.PI) / 180;
            const sx = cx + Math.cos(rad) * 50;
            const sy = cy + Math.sin(rad) * 24;
            this.add.text(sx, sy, suits[i], {
                fontFamily: FONT, fontSize: '14px',
                color: i < 2 ? '#1a4a1a' : '#3a1a1a',
            }).setOrigin(0.5).setDepth(DEPTH_PROPS + 1);
        }

        // Chip stacks on table
        for (let i = 0; i < 3; i++) {
            const chipX = cx - 40 + i * 40;
            g2.fillStyle(0x2ecc71, 1);
            g2.fillCircle(chipX, cy - 10, 6);
            g2.lineStyle(1, 0x1a8a1a, 1);
            g2.strokeCircle(chipX, cy - 10, 6);
        }
    }

    private drawBarCounter(): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS);
        const bx = ZONE_BAR.x + 20;
        const by = ZONE_BAR.y + 30;
        const bw = ZONE_BAR.w - 40;
        const bh = 50;

        // Counter shadow
        g2.fillStyle(0x000000, 0.25);
        g2.fillRect(bx + 4, by + 4, bw, bh);

        // Counter surface
        g2.fillStyle(COL_BAR, 1);
        g2.fillRoundedRect(bx, by, bw, bh, 4);

        // Trim
        g2.lineStyle(2, COL_TRIM, 0.7);
        g2.strokeRoundedRect(bx, by, bw, bh, 4);

        // Counter top highlight
        g2.fillStyle(0x4a2a0e, 1);
        g2.fillRoundedRect(bx, by, bw, 8, { tl: 4, tr: 4, bl: 0, br: 0 });

        // Bar stools
        const stoolCount = 5;
        const stoolSpacing = bw / (stoolCount + 1);
        for (let i = 0; i < stoolCount; i++) {
            const sx = bx + stoolSpacing * (i + 1);
            const sy = by + bh + 18;
            g2.fillStyle(0x3a1e08, 1);
            g2.fillCircle(sx, sy, 10);
            g2.lineStyle(1, COL_TRIM, 0.5);
            g2.strokeCircle(sx, sy, 10);
            // Stool leg
            g2.lineStyle(2, 0x2a1205, 1);
            g2.lineBetween(sx, sy + 10, sx, sy + 22);
        }

        // Bottles on shelf behind bar
        const shelf = by - 12;
        g2.fillStyle(0x2a1008, 1);
        g2.fillRect(bx, shelf - 14, bw, 14);
        g2.lineStyle(1, COL_TRIM, 0.3);
        g2.strokeRect(bx, shelf - 14, bw, 14);

        const bottleColors = [0x2040a0, 0x40a020, 0xa04020, 0xc0a000, 0x802080];
        for (let i = 0; i < 9; i++) {
            const btx = bx + 20 + i * 36;
            const bty = shelf - 10;
            g2.fillStyle(bottleColors[i % bottleColors.length], 0.8);
            g2.fillRect(btx, bty, 10, 8);
            g2.fillRect(btx + 3, bty - 6, 4, 6);  // bottle neck
        }
    }

    private drawPillar(x: number, y: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_PROPS + 1);
        g2.fillStyle(0x2a1c0e, 1);
        g2.fillRect(x - 10, y - 40, 20, 80);
        g2.lineStyle(1, COL_TRIM, 0.6);
        g2.strokeRect(x - 10, y - 40, 20, 80);
        // Capital
        g2.fillStyle(COL_TRIM, 0.3);
        g2.fillRect(x - 14, y - 44, 28, 6);
        g2.fillRect(x - 14, y + 36, 28, 6);
    }

    private drawChandelier(x: number, y: number): void {
        const g2 = this.add.graphics().setDepth(DEPTH_FOREGROUND);

        // Main body
        g2.fillStyle(COL_TRIM, 0.9);
        g2.fillCircle(x, y, 12);
        g2.lineStyle(1, 0xffd700, 0.8);
        g2.strokeCircle(x, y, 12);

        // Glow
        g2.fillStyle(0xffd700, 0.08);
        g2.fillCircle(x, y, 36);
        g2.fillStyle(0xffd700, 0.04);
        g2.fillCircle(x, y, 60);

        // Light spokes
        g2.lineStyle(1, COL_TRIM, 0.5);
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            g2.lineBetween(x, y, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
        }

        // Hanging chain (line from ceiling)
        g2.lineStyle(1, COL_TRIM_DIM, 0.5);
        g2.lineBetween(x, 0, x, y - 12);
    }

    private buildLabels(): void {
        const d = DEPTH_PROPS + 5;

        // Zone signs
        this.buildZoneSign(ZONE_SLOTS.x + ZONE_SLOTS.w / 2, ZONE_SLOTS.y + 20, '🎰 SLOTS CORNER', d);
        this.buildZoneSign(ZONE_POKER.x + ZONE_POKER.w / 2, ZONE_POKER.y + 20, '♠ POKER ROOM', d);
        this.buildZoneSign(ZONE_BAR.x + ZONE_BAR.w / 2, ZONE_BAR.y + 14, '🍹 BAR & LOUNGE', d);
        this.buildZoneSign(ZONE_ENTRANCE.x + ZONE_ENTRANCE.w / 2, ZONE_ENTRANCE.y + 14, '↑ ENTRANCE', d);
        this.buildZoneSign(ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2, ZONE_BLACKJACK.y + 14, '🃏 BLACKJACK', d);
    }

    private buildZoneSign(x: number, y: number, text: string, depth: number): void {
        const t = this.add.text(x, y, text, {
            fontFamily: FONT, fontSize: '13px', color: '#c9a84c',
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(depth);

        // Background pill
        const pad = 10;
        const bg = this.add.rectangle(x, y, t.width + pad * 2, t.height + 6, 0x000000, 0.55)
            .setDepth(depth - 1);
        bg.setStrokeStyle(1, COL_TRIM_DIM, 0.5);
    }

    private buildEntranceFx(): void {
        // Welcome mat
        const g3 = this.add.graphics().setDepth(DEPTH_FLOOR + 1);
        const ex = ZONE_ENTRANCE.x;
        const ey = ZONE_ENTRANCE.y;
        const ew = ZONE_ENTRANCE.w;
        const eh = ZONE_ENTRANCE.h;

        g3.fillStyle(0x0a200a, 1);
        g3.fillRect(ex + 20, ey + 20, ew - 40, eh - 40);
        g3.lineStyle(2, COL_TRIM, 0.5);
        g3.strokeRect(ex + 20, ey + 20, ew - 40, eh - 40);

        this.add.text(ex + ew / 2, ey + eh / 2, 'WELCOME', {
            fontFamily: FONT, fontSize: '11px', color: '#3a5a3a',
        }).setOrigin(0.5).setDepth(DEPTH_FLOOR + 2);
    }

    // ── Avatar Blockers ───────────────────────────────────────────────────────

    private registerAvatarBlockers(): void {
        // Perimeter walls
        this.avatar.addBlocker({ x: 0,           y: 0,            w: WORLD_W, h: 32  });
        this.avatar.addBlocker({ x: 0,           y: 0,            w: 24,      h: WORLD_H });
        this.avatar.addBlocker({ x: WORLD_W - 24, y: 0,           w: 24,      h: WORLD_H });
        this.avatar.addBlocker({ x: 0,           y: WORLD_H - 24, w: WORLD_W, h: 24  });

        // Slot machines
        const slotPositions: [number, number][] = [[60, 100], [120, 100], [60, 200], [120, 200]];
        for (const [mx, my] of slotPositions) {
            this.avatar.addBlocker({ x: mx - 22, y: my - 38, w: 44, h: 70 });
        }

        // Poker table (ellipse approximated as rect)
        this.avatar.addBlocker({ x: 790 - 110, y: 190 - 60, w: 220, h: 120 });

        // Blackjack table (ellipse approximated as rect)
        const bjCx = ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2;
        const bjCy = ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2;
        this.avatar.addBlocker({ x: bjCx - 95, y: bjCy - 45, w: 190, h: 90 });

        // Bar counter
        this.avatar.addBlocker({ x: ZONE_BAR.x + 20, y: ZONE_BAR.y + 30, w: ZONE_BAR.w - 40, h: 50 });
    }

    // ── Zone Detection ────────────────────────────────────────────────────────

    private updateZone(): void {
        const { x, y } = this.avatar;

        let zone: Zone = 'floor';

        if (this.inZone(x, y, ZONE_SLOTS)) zone = 'slots';
        else if (this.inZone(x, y, ZONE_POKER)) zone = 'poker';
        else if (this.inZone(x, y, ZONE_BAR))   zone = 'bar';
        else if (this.inZone(x, y, ZONE_BLACKJACK)) zone = 'blackjack';
        else if (this.inZone(x, y, ZONE_ENTRANCE)) zone = 'entrance';

        if (GameState.get().zone !== zone) {
            GameState.setZone(zone);
        }
    }

    private inZone(x: number, y: number, zone: { x: number; y: number; w: number; h: number }): boolean {
        return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
    }

    // ── Interaction Hotspots ──────────────────────────────────────────────────

    private registerHotspots(): void {
        // Slot machines — one hotspot that covers the cluster
        this.interaction.register({
            id: 'slots',
            x: 90, y: 150,
            radius: 90,
            label: 'Press E to play slots',
            onInteract: () => this.openSlots(),
        });

        // Poker table
        this.interaction.register({
            id: 'poker',
            x: 790, y: 190,
            radius: 130,
            label: 'Press E to join poker table',
            onInteract: () => this.openPoker(),
        });

        // Bar
        this.interaction.register({
            id: 'bar',
            x: ZONE_BAR.x + ZONE_BAR.w / 2,
            y: ZONE_BAR.y + 120,
            radius: 120,
            label: 'Press E to order at bar',
            onInteract: () => this.openBar(),
        });

        // Blackjack table
        this.interaction.register({
            id: 'blackjack',
            x: ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2,
            y: ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2,
            radius: 100,
            label: 'Press E to play blackjack',
            onInteract: () => this.openBlackjack(),
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

    private closePanel(): void {
        this.activePanel = 'none';
        GameState.clearInteraction();
    }

    // ── Welcome Banner ────────────────────────────────────────────────────────

    private showWelcomeBanner(): void {
        const cx = GAME_WIDTH / 2;
        const name = GameState.get().displayName;

        // ── Tutorial overlay — fades out after 12 seconds ──────────────────
        const tutY = GAME_HEIGHT / 2;
        const tutW = 560;
        const tutH = 260;

        const tutBg = this.add.rectangle(cx, tutY, tutW, tutH, 0x020a02, 0.94)
            .setScrollFactor(0).setDepth(DEPTH_HUD + 10);
        tutBg.setStrokeStyle(2, COL_TRIM, 0.9);

        const greeting = name !== 'Guest' ? `Welcome to Slot City, ${name}!` : 'Welcome to Slot City Casino!';
        const tutTitle = this.add.text(cx, tutY - 108, `★  ${greeting}  ★`, {
            fontFamily: FONT, fontSize: '15px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);

        const divLine = this.add.rectangle(cx, tutY - 90, tutW - 40, 1, COL_TRIM, 0.4)
            .setScrollFactor(0).setDepth(DEPTH_HUD + 11);

        const steps: Array<{ icon: string; title: string; desc: string }> = [
            { icon: '①', title: 'Move around', desc: 'WASD or Arrow keys to walk your avatar through the casino' },
            { icon: '②', title: 'Approach a zone', desc: 'Walk near Slots, Poker Table, or Bar until a prompt appears' },
            { icon: '③', title: 'Press E to interact', desc: 'Open Slots, Poker table, Blackjack table, or Bar order panel' },
            { icon: '④', title: 'Play & earn chips', desc: 'You start with 1,000 ◈ · Free reload offered if you go broke' },
        ];

        const tutObjs: Phaser.GameObjects.GameObject[] = [tutBg, tutTitle, divLine];

        steps.forEach((s, i) => {
            const sy = tutY - 66 + i * 44;
            const iconT = this.add.text(cx - 240, sy, s.icon, {
                fontFamily: FONT, fontSize: '18px', color: '#c9a84c',
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);
            const titleT = this.add.text(cx - 210, sy - 8, s.title, {
                fontFamily: FONT, fontSize: '12px', color: '#a0c8a0', fontStyle: 'bold',
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);
            const descT = this.add.text(cx - 210, sy + 10, s.desc, {
                fontFamily: FONT, fontSize: '10px', color: '#5a7a5a',
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);
            tutObjs.push(iconT, titleT, descT);
        });

        const dismiss = this.add.text(cx, tutY + 108, 'Press any key or click to dismiss  ·  Closes automatically in 12s', {
            fontFamily: FONT, fontSize: '9px', color: '#3a5a3a',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);
        tutObjs.push(dismiss);

        let tutorialDismissed = false;

        const closeTutorial = (): void => {
            if (tutorialDismissed) return;
            tutorialDismissed = true;
            this.tweens.add({
                targets: tutObjs,
                alpha: 0,
                duration: 500,
                onComplete: () => {
                    tutObjs.forEach(o => o.destroy());
                    // Fade in the persistent hint bar once tutorial is gone
                    if (hint.active) {
                        this.tweens.add({ targets: [hintBg, hint], alpha: 1, duration: 500 });
                    }
                },
            });
        };

        // Click anywhere on overlay to dismiss
        tutBg.setInteractive();
        tutBg.once('pointerdown', closeTutorial);

        // Any key dismisses
        this.input.keyboard!.once('keydown', closeTutorial);

        // Auto-close after 12 seconds
        this.time.delayedCall(12000, closeTutorial);

        // ── Persistent controls hint at bottom edge ────────────────────────
        const hintBg = this.add.rectangle(cx, GAME_HEIGHT - 14, 560, 20, 0x000000, 0.65)
            .setScrollFactor(0).setDepth(DEPTH_HUD + 1);
        hintBg.setStrokeStyle(0);

        const hint = this.add.text(cx, GAME_HEIGHT - 14,
            'WASD / ↑↓←→ move  ·  E interact  ·  Slots: SPACE spin  ·  Poker: F=Fold C=Call R=Raise  ·  Blackjack: H=Hit S=Stand  ·  ESC close', {
            fontFamily: FONT, fontSize: '9px', color: '#446644',
        }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 2);
        hint.setAlpha(0);
    }
}
