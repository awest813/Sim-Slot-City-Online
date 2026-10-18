// ── CasinoLobbyScene — main playable casino floor ────────────────────────────
import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT, WORLD_W, WORLD_H,
    COL_TRIM,
    COL_SLOTS_ACCENT, COL_POKER_ACCENT, COL_BAR_ACCENT, COL_BLACKJACK_ACCENT, COL_ROULETTE_ACCENT, COL_PLINKO_ACCENT, COL_BINGO_ACCENT, COL_HORSES_ACCENT,
    COL_UI_BG, COL_UI_BG2, COL_UI_BORDER,
    DEPTH_HUD, DEPTH_OVERLAY,
    ZONE_ENTRANCE, ZONE_SLOTS, ZONE_POKER, ZONE_BAR, ZONE_BLACKJACK, ZONE_ROULETTE, ZONE_PLINKO, ZONE_BINGO, ZONE_HORSES, ZONE_VIP,
    FONT, ANIM_SLOW, DOCK_Y,
} from '../../game/constants';
import { GameState, Zone } from '../../core/state/GameState';
import { AvatarController } from '../../core/systems/AvatarController';
import { AIWalker, AI_NAMES, AI_COLORS } from '../../core/systems/AIWalker';
import { InteractionSystem } from '../../core/systems/InteractionSystem';
import { SoundManager } from '../../core/systems/SoundManager';
import { StationaryNPC } from '../../core/systems/StationaryNPC';
import { HUD } from '../ui/HUD';
import { Minimap } from '../ui/Minimap';
import { SlotsPanel } from '../slots/SlotsPanel';
import { ToastManager } from '../ui/ToastManager';
import { BarPanel, resetBarSession } from '../bar/BarPanel';
import { PokerPanel } from '../poker/PokerPanel';
import { BlackjackPanel } from '../blackjack/BlackjackPanel';
import { RoulettePanel } from '../roulette/RoulettePanel';
import { PlinkoPanel } from '../plinko/PlinkoPanel';
import { BingoPanel } from '../bingo/BingoPanel';
import { HorseRacePanel } from '../horserace/HorseRacePanel';
import { ScratcherPanel } from '../scratchers/ScratcherPanel';
import { EmoteRadialMenu } from '../ui/EmoteRadialMenu';
import { StatsPanel } from '../ui/StatsPanel';
import { bakeAllSimsArt } from '../../art/bake';
import { buildSimsLot } from '../../art/lot';
import { cameraBounds, fromScreen, toScreen, worldDepth } from '../../art/iso';

export class CasinoLobbyScene extends Phaser.Scene {
    private avatar!:      AvatarController;
    private aiWalkers:    AIWalker[] = [];
    private npcs:         StationaryNPC[] = [];
    private interaction!: InteractionSystem;
    private minimap!:     Minimap;
    private activePanel:  'none' | 'slots' | 'bar' | 'poker' | 'blackjack' | 'roulette' | 'plinko' | 'bingo' | 'horses' | 'scratchers' | 'menu' = 'none';
    // Context hint bar
    private hintBg!:      Phaser.GameObjects.Rectangle;
    private hintText!:    Phaser.GameObjects.Text;
    private zoneFlashRect: Phaser.GameObjects.Rectangle | null = null;
    private hud!:         HUD;

    // Emote radial trigger key and overlay
    private qKey!:        Phaser.Input.Keyboard.Key;
    private radialMenu:   EmoteRadialMenu | null = null;
    private vipUnlocked:  boolean = false;

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

        bakeAllSimsArt(this);
        buildSimsLot(this);

        // Avatar — spawn at entrance
        const spawnX = WORLD_W / 2;
        const spawnY = WORLD_H - 100;
        this.avatar = new AvatarController(this, spawnX, spawnY, GameState.get().displayName);
        this.registerAvatarBlockers();

        // AI walkers — spawn at staggered positions around the floor
        this.spawnAIWalkers();

        // Camera — manual follow in isometric screen space
        const view = cameraBounds();
        const spawn = toScreen(spawnX, spawnY);
        this.cameras.main.setBounds(view.minX, view.minY, view.w, view.h);
        this.cameras.main.scrollX = spawn.x - GAME_WIDTH / 2;
        this.cameras.main.scrollY = spawn.y - GAME_HEIGHT * 0.68;

        // Interaction system
        this.interaction = new InteractionSystem(this);
        this.registerHotspots();
        this.spawnStationaryNPCs();

        this.events.once('shutdown', () => {
            this.npcs.forEach(npc => npc.destroy());
            this.npcs = [];
        });

        // HUD
        this.hud = new HUD(this, () => this.openStatsMenu());

        // Minimap
        this.minimap = new Minimap(this);

        // Context-sensitive hint bar (bottom edge)
        this.buildHintBar();

        // Emote radial trigger key register
        this.qKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        // A user gesture has to land before the AudioContext will start. The first
        // click or keypress on the lot unlocks it; later sounds reuse that context.
        const unlockAudio = (): void => SoundManager.init();
        this.input.once('pointerdown', unlockAudio);
        this.input.keyboard!.once('keydown', unlockAudio);

        // Click-to-move listener
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
            if (this.activePanel === 'none' && gameObjects.length === 0 && this.avatar.enabled) {
                const cart = fromScreen(pointer.worldX, pointer.worldY);
                this.avatar.setTarget(cart.x, cart.y);
            }
        });

        // Welcome tutorial overlay
        this.showWelcomeBanner();

        // Fade scene in
        this.cameras.main.fadeIn(ANIM_SLOW, 0, 0, 0);
    }

    update(_time: number, delta: number): void {
        this.interaction.setSuspended(this.activePanel !== 'none');
        if (this.activePanel !== 'none') return;

        // Handle Emote Radial Menu overlay lifecycle
        if (this.radialMenu) {
            if (this.qKey.isUp) {
                this.radialMenu.confirmSelection();
                this.radialMenu = null;
                this.avatar.enabled = true;
            } else {
                this.radialMenu.updateMenu(this.input.activePointer);
                return; // Suppress movement/camera updates while choosing emotes
            }
        } else if (this.qKey.isDown) {
            this.avatar.enabled = false;
            this.radialMenu = new EmoteRadialMenu(
                this,
                GAME_WIDTH / 2,
                GAME_HEIGHT / 2,
                (emoji) => {
                    this.avatar.playEmote(emoji);
                }
            );
            return;
        }

        this.avatar.update(delta);

        for (const ai of this.aiWalkers) {
            ai.update(delta);
        }

        // Manual camera follow in isometric screen space
        const focus = toScreen(this.avatar.x, this.avatar.y);
        const view = cameraBounds();
        // Keep the sim low in the frame so the room ahead, not the front lawn, fills the view.
        const targetX = focus.x - GAME_WIDTH  / 2;
        const targetY = focus.y - GAME_HEIGHT * 0.68;
        this.cameras.main.scrollX = Phaser.Math.Linear(this.cameras.main.scrollX, targetX, 0.12);
        this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY, 0.12);

        this.cameras.main.scrollX = Phaser.Math.Clamp(this.cameras.main.scrollX, view.minX, view.maxX - GAME_WIDTH);
        this.cameras.main.scrollY = Phaser.Math.Clamp(this.cameras.main.scrollY, view.minY, view.maxY - GAME_HEIGHT);

        this.interaction.update(this.avatar.x, this.avatar.y);
        this.updateZone();

        // Update minimap with current avatar world-space position
        this.minimap.update(this.avatar.x, this.avatar.y);
    }

    // ── World Building ────────────────────────────────────────────────────────

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

    private spawnStationaryNPCs(): void {
        // Lola (Showgirl left of entrance approach)
        const lolaQuotes = ["Buy a Lucky Scratcher and match 3 to win up to 5,000◈!"];
        const lola = new StationaryNPC(
            this, 400, 520, "Lola 💃", "avatar_showgirl", 0xff40a0, lolaQuotes
        );
        this.interaction.register({
            id: 'lola_scratchers', x: 400, y: 520, radius: 60,
            label: 'Buy Scratch Card (50◈)',
            onInteract: () => {
                lola.interact("Let's see if you're lucky today!");
                this.openScratchers();
            },
        });
        
        // Gigi (Showgirl right of entrance approach)
        const gigiQuotes = ["Feeling lucky? Scratch and win today!"];
        const gigi = new StationaryNPC(
            this, 560, 520, "Gigi 💃", "avatar_showgirl", 0xff40a0, gigiQuotes
        );
        this.interaction.register({
            id: 'gigi_scratchers', x: 560, y: 520, radius: 60,
            label: 'Buy Scratch Card (50◈)',
            onInteract: () => {
                gigi.interact("Good luck, darling!");
                this.openScratchers();
            },
        });

        // Rusty (Seated bar patron left)
        const rustyQuotes = [
            "Phew, slots took a bite out of me. Just here to drink my troubles away. 🍺",
            "The bartender makes the best Lucky Lemonade. You gotta try it!",
            "I bet 100◈ on the #3 horse and it tripped. Don't take my horse racing tips!",
            "Tipping the bartender 10◈ always gets you a friendly smile. Worth it."
        ];
        const rusty = new StationaryNPC(
            this, 320, 140, "Rusty 🥃", "avatar_ai_male", 0xcc5544, rustyQuotes
        );

        // Ginger (Seated bar patron right)
        const gingerQuotes = [
            "Just hit a nice win in Plinko! High Risk is the only way to play. 🎯",
            "I'm waiting for my slot machine to heat up. It's due, I tell you!",
            "Shh, I'm trying to study basic strategy for Blackjack. Split pairs, right?",
            "This bar is the only place in town with a free Lucky Shot bonus. Cheers!"
        ];
        const ginger = new StationaryNPC(
            this, 620, 140, "Ginger 🍹", "avatar_ai_female", 0xcc4488, gingerQuotes
        );

        // Buster (Bouncer guarding VIP Lounge entrance)
        const busterQuotes = [
            "Welcome back, boss. Go right on in! 🕶️",
            "Keep the noise down in the lounge, we have serious high rollers inside.",
            "Only the elite can enter here. You've earned it."
        ];
        const buster = new StationaryNPC(
            this, 270, 620, "Buster 🕶️", "avatar_ai_male", 0xc9a84c, busterQuotes
        );

        // Duke (VIP inside the lounge)
        const dukeQuotes = [
            "Only the finest champagne for us high rollers! 🥂",
            "I just wagered 5,000◈ at the poker table. Easy come, easy go.",
            "The slots in here are tuned for serious action. Care to spin?",
            "Ah, welcome! You must be the new face in town. Quite a chip stack you have!"
        ];
        const duke = new StationaryNPC(
            this, 180, 640, "Duke 👑", "avatar_ai_vip", 0xd4af37, dukeQuotes
        );

        this.npcs.push(lola, gigi, rusty, ginger, buster, duke);

        // Register hotspots for each NPC (except Buster, who has custom gate-check logic)
        this.npcs.forEach(npc => {
            if (npc.name.includes("Buster")) return;
            this.interaction.register({
                id: `npc_${npc.name}`,
                x: npc.x,
                y: npc.y,
                radius: 48,
                label: `Talk to ${npc.name}`,
                onInteract: () => npc.interact()
            });
        });

        // Custom hotspot for Buster the Bouncer
        this.interaction.register({
            id: 'npc_Buster',
            x: 270,
            y: 620,
            radius: 48,
            label: 'Talk to Buster 🕶️',
            onInteract: () => {
                if (this.vipUnlocked) {
                    buster.interact("Welcome back, boss. Go right on in! 🕶️");
                } else {
                    const chips = GameState.get().chips;
                    if (chips >= 15000) {
                        this.vipUnlocked = true;
                        
                        // Speak welcome
                        buster.interact("Impressive! Welcome to the High Rollers Club. Go right on in! 🕶️");
                        
                        // Tween Buster out of the way
                        this.tweens.add({
                            targets: buster,
                            x: 305,
                            duration: 800,
                            ease: 'Cubic.easeOut',
                            onUpdate: () => {
                                buster.setPosition(buster.x, buster.y);
                            },
                            onComplete: () => {
                                // Re-register hotspot at the new position so the interaction matches his visual position!
                                this.interaction.unregister('npc_Buster');
                                this.interaction.register({
                                    id: 'npc_Buster',
                                    x: 305,
                                    y: 620,
                                    radius: 48,
                                    label: 'Talk to Buster 🕶️',
                                    onInteract: () => {
                                        buster.interact("Welcome back, boss. Go right on in! 🕶️");
                                    }
                                });
                            }
                        });
                        
                        // Refresh blockers
                        const newBlockers = this.getSharedBlockers();
                        this.avatar.setBlockers(newBlockers);
                        this.aiWalkers.forEach(ai => ai.setBlockers(newBlockers));
                        
                        ToastManager.show(this, "🔓 VIP Lounge Unlocked!", "jackpot");
                    } else {
                        buster.interact("Halt. The VIP High Rollers Lounge is for guests with 15,000◈ or more. Show me the chips!");
                    }
                }
            }
        });

        // Custom hotspot for the VIP Gold Slot Machine inside the lounge
        this.interaction.register({
            id: 'vip_slots',
            x: 80,
            y: 640,
            radius: 48,
            label: '🏆 High-Stakes Slots (10x Bets)',
            onInteract: () => {
                this.activePanel = 'slots';
                GameState.setInteraction('slots');
                this.hud.setPanelOpen(true);
                new SlotsPanel(this, () => {
                    this.activePanel = 'none';
                    GameState.clearInteraction();
                    this.hud.setPanelOpen(false);
                    ToastManager.clear();
                }, true); // pass true for High Stakes
            }
        });
    }

    /** Returns the shared list of blocker rects used by all walkers (player + AI). */
    private getSharedBlockers(): Array<{ x: number; y: number; w: number; h: number }> {
        const bjCx = ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2;
        const bjCy = ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2;
        const rtCx = ZONE_ROULETTE.x  + ZONE_ROULETTE.w  / 2;
        const rtCy = ZONE_ROULETTE.y  + ZONE_ROULETTE.h  / 2;

        const list = [
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
            // VIP Slot machine cabinet inside the lounge
            { x: 80 - 22,  y: 640 - 38, w: 44, h: 70 },
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
            // Props
            { x: 384, y: WORLD_H - 130, w: 32, h: 50 }, // ATM
            { x: WORLD_W / 2 - 40, y: WORLD_H / 2 - 10, w: 80, h: 40 }, // Fountain
            { x: ZONE_BAR.x + 20, y: ZONE_BAR.y + ZONE_BAR.h - 70, w: 40, h: 60 }, // Jukebox
        ];

        if (!this.vipUnlocked) {
            // Physical gate blocker at doorway (between stanchions/velvet rope and wall)
            list.push({ x: 250, y: 580, w: 35, h: 60 });
        }

        return list;
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
        else if (this.inZone(x, y, ZONE_HORSES))     zone = 'horses';
        else if (this.inZone(x, y, ZONE_ENTRANCE))   zone = 'entrance';
        else if (this.inZone(x, y, ZONE_VIP))        zone = 'vip';

        if (GameState.get().zone !== zone) {
            GameState.setZone(zone);
            this.updateHintForZone(zone);
            this.flashZoneTransition(zone);
        }
    }

    private inZone(
        x: number, y: number,
        zone: { x: number; y: number; w: number; h: number },
    ): boolean {
        return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
    }

    private flashZoneTransition(zone: Zone): void {
        const ZONE_FLASH_COLORS: Record<Zone, number> = {
            slots:     COL_SLOTS_ACCENT,
            poker:     COL_POKER_ACCENT,
            bar:       COL_BAR_ACCENT,
            blackjack: COL_BLACKJACK_ACCENT,
            roulette:  COL_ROULETTE_ACCENT,
            plinko:    COL_PLINKO_ACCENT,
            bingo:     COL_BINGO_ACCENT,
            horses:    COL_HORSES_ACCENT,
            entrance:  COL_TRIM,
            vip:       0xf6c855,
            floor:     0x112233,
        };
        const col = ZONE_FLASH_COLORS[zone] ?? 0x112233;

        if (this.zoneFlashRect) {
            this.tweens.killTweensOf(this.zoneFlashRect);
            this.zoneFlashRect.destroy();
            this.zoneFlashRect = null;
        }

        this.zoneFlashRect = this.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, col, 0.13,
        ).setScrollFactor(0).setDepth(DEPTH_OVERLAY + 20);

        this.tweens.add({
            targets:   this.zoneFlashRect,
            fillAlpha: 0,
            duration:  640,
            ease:      'Sine.easeOut',
            onComplete: () => {
                this.zoneFlashRect?.destroy();
                this.zoneFlashRect = null;
            },
        });
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
        this.interaction.register({
            id: 'horses',
            x: ZONE_HORSES.x + ZONE_HORSES.w / 2,
            y: ZONE_HORSES.y + ZONE_HORSES.h / 2,
            radius: 100,
            label: 'Bet on Horses',
            onInteract: () => this.openHorseRace(),
        });
        
        // --- New Props Hotspots ---
        this.interaction.register({
            id: 'atm',
            x: 400, y: WORLD_H - 100, radius: 60,
            label: 'Use ATM (Daily Bonus)',
            onInteract: () => this.useATM(),
        });

        this.interaction.register({
            id: 'fountain',
            x: WORLD_W / 2, y: WORLD_H / 2 + 30, radius: 90,
            label: 'Toss Chip into Fountain (50◈)',
            onInteract: () => this.useFountain(),
        });

        this.interaction.register({
            id: 'jukebox',
            x: ZONE_BAR.x + 40, y: ZONE_BAR.y + ZONE_BAR.h - 40, radius: 60,
            label: 'Change Music',
            onInteract: () => this.useJukebox(),
        });
    }

    // ── Panel Openers ─────────────────────────────────────────────────────────

    private openSlots(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'slots';
        GameState.setInteraction('slots');
        this.hud.setPanelOpen(true);
        new SlotsPanel(this, () => this.closePanel());
    }

    private openBar(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'bar';
        GameState.setInteraction('bar');
        this.hud.setPanelOpen(true);
        new BarPanel(this, () => this.closePanel());
    }

    private openPoker(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'poker';
        GameState.setInteraction('poker');
        this.hud.setPanelOpen(true);
        new PokerPanel(this, () => this.closePanel());
    }

    private openBlackjack(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'blackjack';
        GameState.setInteraction('blackjack');
        this.hud.setPanelOpen(true);
        new BlackjackPanel(this, () => this.closePanel());
    }

    private openRoulette(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'roulette';
        GameState.setInteraction('roulette');
        this.hud.setPanelOpen(true);
        new RoulettePanel(this, () => this.closePanel());
    }

    private openPlinko(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'plinko';
        GameState.setInteraction('plinko');
        this.hud.setPanelOpen(true);
        new PlinkoPanel(this, () => this.closePanel());
    }

    private openBingo(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'bingo';
        GameState.setInteraction('bingo');
        this.hud.setPanelOpen(true);
        new BingoPanel(this, () => this.closePanel());
    }

    private openHorseRace(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'horses';
        GameState.setInteraction('horses');
        this.hud.setPanelOpen(true);
        new HorseRacePanel(this, () => this.closePanel());
    }

    private openScratchers(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'scratchers';
        GameState.setInteraction('slots');
        this.hud.setPanelOpen(true);
        new ScratcherPanel(this, () => this.closePanel());
    }

    private openStatsMenu(): void {
        if (this.activePanel !== 'none') return;
        this.activePanel = 'menu';
        this.hud.setPanelOpen(true);
        new StatsPanel(this, () => {
            this.activePanel = 'none';
            this.hud.setPanelOpen(false);
            this.updateHintForZone(GameState.get().zone);
            ToastManager.clear();
        });
    }

    private closePanel(): void {
        this.activePanel = 'none';
        GameState.clearInteraction();
        this.hud.setPanelOpen(false);
        this.updateHintForZone(GameState.get().zone);
        ToastManager.clear();
    }

    // ── Prop Interactions ─────────────────────────────────────────────────────

    private useATM(): void {
        const state = GameState.get();
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        
        let dispensed = 0;
        let msg = '';
        
        if (state.chips === 0) {
            dispensed = 1000;
            msg = 'Bailout! +1,000◈ dispensed.';
        } else if (now - state.lastDailyClaim > ONE_DAY) {
            dispensed = 500;
            msg = 'Daily Bonus! +500◈ dispensed.';
            GameState.update({ lastDailyClaim: now });
        } else {
            const hrs = Math.ceil((ONE_DAY - (now - state.lastDailyClaim)) / (60 * 60 * 1000));
            ToastManager.show(this, `ATM: Come back in ${hrs} hours.`, 'info');
            SoundManager.playFold();
            return;
        }

        GameState.addChips(dispensed);
        SoundManager.playWin(dispensed);
        ToastManager.show(this, msg, 'win');
    }

    private useFountain(): void {
        const state = GameState.get();
        if (state.chips < 50) {
            ToastManager.show(this, "Not enough chips to toss (50◈ needed)", 'info');
            return;
        }
        
        GameState.addChips(-50);
        SoundManager.playClick();
        
        // Create an upward throwing arc particle
        const x = WORLD_W / 2;
        const y = WORLD_H / 2 + 10;
        const from = toScreen(this.avatar.x, this.avatar.y);
        const splash = toScreen(x, y);
        const chip = this.add.circle(from.x, from.y - 20, 5, 0xe7c84a).setDepth(worldDepth(this.avatar.x, this.avatar.y) + 6);
        this.tweens.add({
            targets: chip,
            x: splash.x,
            y: splash.y - 16,
            duration: 600,
            ease: 'Quad.easeOut',
            onComplete: () => {
                chip.destroy();
                SoundManager.playChipLand();
                
                // Random outcome
                const rand = Math.random();
                if (rand < 0.2) {
                    GameState.addBuff('slotsLuck', 10);
                    ToastManager.show(this, "The water glows! (+10 Slots Luck)", 'jackpot');
                    SoundManager.playJackpot();
                } else if (rand < 0.4) {
                    GameState.addBuff('pokerTell', 5);
                    ToastManager.show(this, "The water shimmers! (+5 Poker Tells)", 'win');
                    SoundManager.playWin(100);
                } else {
                    ToastManager.show(this, "Plop. Nothing happens.", 'info');
                }
            }
        });
    }

    private useJukebox(): void {
        SoundManager.nextAmbient();
        ToastManager.show(this, `Playing: ${SoundManager.ambientName()}`, 'info');
    }

    // ── Context-sensitive hint bar ────────────────────────────────────────────

    private buildHintBar(): void {
        const cx = GAME_WIDTH / 2;
        this.hintBg = this.add.rectangle(cx, DOCK_Y + 32, 10, 10, 0x000000, 0)
            .setScrollFactor(0).setDepth(DEPTH_HUD + 1).setAlpha(0);

        this.hintText = this.add.text(300, DOCK_Y + 32, '', {
            fontFamily: FONT, fontSize: '11px', color: '#f4fff8', fontStyle: 'bold',
            wordWrap: { width: 280 },
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 2).setAlpha(0);

        this.updateHintForZone('floor');
    }

    private updateHintForZone(zone: Zone): void {
        const HINTS: Record<Zone, string> = {
            floor:     'WASD move   ·   Q emotes   ·   E interact',
            entrance:  'Walk north to explore the casino',
            slots:     'E play   ·   Space spin   ·   Esc close',
            poker:     'E join   ·   F fold   ·   C call   ·   R raise',
            bar:       'E order a drink   ·   Esc close',
            blackjack: 'E play   ·   H hit   ·   S stand',
            roulette:  'E play   ·   Space spin   ·   Esc close',
            plinko:    'E play   ·   Space drop   ·   Esc close',
            bingo:     'E play bingo   ·   Esc close',
            horses:    'E bet   ·   Pick a horse, then Race',
            vip:       'VIP lounge   ·   15,000◈ to enter',
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
            { icon: '②', title: 'Approach a zone',   desc: 'Walk near Slots, Poker Table, Bar, Blackjack, Roulette, Plinko, Bingo, or Horse Racing' },
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
                fontFamily: FONT, fontSize: '11px', color: '#d7f3ea',
            }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(DEPTH_HUD + 11);

            tutObjs.push(iconT, titleT, descT);
        });

        const dismiss = this.add.text(cx, tutY + tutH / 2 - 18, 'Press any key or click to dismiss  ·  Closes automatically in 12s', {
            fontFamily: FONT, fontSize: '9px', color: '#b7efe0',
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
