import Phaser from 'phaser';
import {
    AVATAR_SPEED, AVATAR_SIZE, WORLD_W, WORLD_H,
    DEPTH_SHADOW, FONT,
} from '../../game/constants';
import { SIM_NAME_STYLE, syncSimSprite } from '../../art/actor';
import { toScreen, worldDepth } from '../../art/iso';
import type { FacingDir } from '../../art/characters';

interface Blocker {
    x: number; y: number; w: number; h: number;
}


// Walkable waypoints spread around the casino floor (avoiding furniture)
const WAYPOINTS: [number, number][] = [
    [480, 630], // entrance center
    [340, 460], // center-left open floor
    [640, 460], // center-right open floor
    [480, 460], // center open floor
    [160, 350], // slots zone walkway
    [230, 500], // left corridor
    [800, 350], // poker zone walkway
    [870, 480], // right corridor
    [480, 540], // pre-entrance corridor
    [160, 530], // roulette area
    [400, 300], // blackjack approach
    [560, 300], // blackjack right side
    [240, 160], // bar left approach
    [720, 160], // bar right approach
    [790, 515], // plinko area
];

export const AI_NAMES  = ['Alex', 'Jamie', 'Morgan', 'Riley', 'Casey', 'Jordan', 'Taylor', 'Sam'];
export const AI_COLORS = [0x4488cc, 0xcc5544, 0x44cc88, 0xcc8844, 0x9955cc, 0x44b844, 0xcc4488, 0x66aabb];

const WALK_COMMENTS = [
    "Lady luck, where are you? 🍀",
    "I need a cold drink from the bar! 🍹",
    "Let's see if the slots are hot! 🎰",
    "Pocket Aces is the dream... ♠",
    "Double down on 11! 🃏",
    "Red or black... roulette is calling! 🎡",
    "Bingo blackout is so close! 🎱",
    "I'm feeling lucky! ✨",
    "Time to tip the bartender. 💵",
    "Look at those showgirls, gorgeous! 💃",
    "Let's bet on the underdog horse! 🏇",
    "Almost hit a Plinko 10x! 🎯",
];

export class AIWalker {
    private scene:    Phaser.Scene;
    private sprite!:  Phaser.GameObjects.Image;
    private walkTime: number = 0;
    private shadow!:  Phaser.GameObjects.Ellipse;
    private nameTag!: Phaser.GameObjects.Text;
    private outfit = 'avatar_ai_male';
    private blockers: Blocker[] = [];
    private activeBubble: Phaser.GameObjects.Container | null = null;
    private bubbleTimer: Phaser.Time.TimerEvent | null = null;
    private bubbleOffsetY: number = 0;

    x: number;
    y: number;

    private facing:     FacingDir = 'down';
    private targetX:    number;
    private targetY:    number;
    private pauseTimer: number = 0;
    private stuckTimer: number = 0;

    constructor(
        scene: Phaser.Scene,
        startX: number, startY: number,
        name: string,
        _bodyColor: number,
    ) {
        this.scene     = scene;
        this.x         = startX;
        this.y         = startY;

        const wp    = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
        this.targetX = wp[0];
        this.targetY = wp[1];

        this.buildSprite(name);
    }

    private buildSprite(name: string): void {
        const here = toScreen(this.x, this.y);
        this.shadow = this.scene.add
            .ellipse(here.x, here.y, 24, 10, 0x1a2410, 0.32)
            .setDepth(DEPTH_SHADOW);

        const idx = AI_NAMES.indexOf(name);
        let labelName = name;
        if (idx % 3 === 0) this.outfit = 'avatar_ai_male';
        else if (idx % 3 === 1) this.outfit = 'avatar_ai_female';
        else {
            this.outfit = 'avatar_ai_vip';
            labelName = `${name}`;
        }

        this.sprite = this.scene.add.image(here.x, here.y, this.outfit);
        this.nameTag = this.scene.add.text(here.x, here.y, labelName, {
            ...SIM_NAME_STYLE,
            color: this.outfit === 'avatar_ai_vip' ? '#6a4a12' : SIM_NAME_STYLE.color,
        }).setOrigin(0.5, 1);
        this.syncSprite();
    }

    addBlocker(b: Blocker): void {
        this.blockers.push(b);
    }

    setBlockers(blockers: Blocker[]): void {
        this.blockers = [...blockers];
    }

    private resolveBlockers(nx: number, ny: number): { x: number; y: number } {
        let rx = nx;
        let ry = ny;
        const r = AVATAR_SIZE;

        for (const b of this.blockers) {
            const cx    = Math.max(b.x, Math.min(rx, b.x + b.w));
            const cy    = Math.max(b.y, Math.min(ry, b.y + b.h));
            const dx    = rx - cx;
            const dy    = ry - cy;
            const dist2 = dx * dx + dy * dy;

            if (dist2 < r * r) {
                const dist    = Math.sqrt(dist2) || 1;
                const overlap = r - dist;
                rx += (dx / dist) * overlap;
                ry += (dy / dist) * overlap;
            }
        }

        rx = Phaser.Math.Clamp(rx, r, WORLD_W - r);
        ry = Phaser.Math.Clamp(ry, r, WORLD_H - r);

        return { x: rx, y: ry };
    }

    private pickNewTarget(): void {
        const wp     = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
        this.targetX = wp[0] + (Math.random() - 0.5) * 60;
        this.targetY = wp[1] + (Math.random() - 0.5) * 60;
    }

    update(delta: number): void {
        const dt = delta / 1000;

        // Pause at destination
        if (this.pauseTimer > 0) {
            this.pauseTimer -= delta;
            this.walkTime = 0;
            this.syncSprite();
            return;
        }

        this.walkTime += delta;

        const dx   = this.targetX - this.x;
        const dy   = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Arrived — rest briefly then pick a new goal
        if (dist < 10) {
            this.pauseTimer = 600 + Math.random() * 2400;
            this.pickNewTarget();
            if (Math.random() < 0.18) {
                this.speakRandomComment();
            }
            this.syncSprite();
            return;
        }

        // Update facing
        if (Math.abs(dx) > Math.abs(dy)) {
            this.facing = dx > 0 ? 'right' : 'left';
        } else {
            this.facing = dy > 0 ? 'down' : 'up';
        }

        const speed = AVATAR_SPEED * 0.65;
        const vx    = (dx / dist) * speed * dt;
        const vy    = (dy / dist) * speed * dt;

        const resolved = this.resolveBlockers(this.x + vx, this.y + vy);

        // Detect if stuck (e.g. blocked by obstacle) and reroute
        const moved = Math.abs(resolved.x - this.x) + Math.abs(resolved.y - this.y);
        if (moved < 0.05 && dist > 20) {
            this.stuckTimer += delta;
            if (this.stuckTimer > 400) {
                this.stuckTimer = 0;
                this.pickNewTarget();
            }
        } else {
            this.stuckTimer = 0;
        }

        this.x = resolved.x;
        this.y = resolved.y;

        this.syncSprite();
    }

    private syncSprite(): void {
        const moving = this.pauseTimer <= 0;
        const frame = moving ? Math.floor(this.walkTime / 150) % 4 : 0;
        const bob = moving ? Math.sin(this.walkTime * 0.02) * 1.2 : 0;
        const s = syncSimSprite({
            sprite: this.sprite,
            shadow: this.shadow,
            nameTag: this.nameTag,
            x: this.x,
            y: this.y,
            bob,
            outfit: this.outfit,
            facing: this.facing,
            frame,
        });
        if (this.activeBubble) {
            this.activeBubble.setPosition(s.x, s.y + this.bubbleOffsetY + bob);
            this.activeBubble.setDepth(worldDepth(this.x, this.y) + 8);
        }
    }

    private speakRandomComment(): void {
        if (this.activeBubble) {
            this.activeBubble.destroy();
            this.activeBubble = null;
        }
        if (this.bubbleTimer) {
            this.bubbleTimer.remove();
            this.bubbleTimer = null;
        }

        const comment = WALK_COMMENTS[Math.floor(Math.random() * WALK_COMMENTS.length)];

        const text = this.scene.add.text(0, 0, comment, {
            fontFamily: FONT,
            fontSize: '9px',
            color: '#0a0d14',
            align: 'center',
            wordWrap: { width: 110 }
        }).setOrigin(0.5);

        const bw = Math.max(60, text.width + 12);
        const bh = text.height + 8;
        const br = 4;

        const bubbleGfx = this.scene.add.graphics();
        // shadow
        bubbleGfx.fillStyle(0x000000, 0.15);
        bubbleGfx.fillRoundedRect(-bw / 2 + 1, -bh / 2 + 1, bw, bh, br);
        // bubble
        bubbleGfx.fillStyle(0xfcf8f2, 0.95);
        bubbleGfx.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
        bubbleGfx.fillTriangle(0, bh / 2 + 4, -4, bh / 2 - 2, 4, bh / 2 - 2);
        // border
        bubbleGfx.lineStyle(1.0, 0x908070, 0.6);
        bubbleGfx.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, br);

        text.setPosition(0, -1);

        const head = toScreen(this.x, this.y);
        this.bubbleOffsetY = -108 - bh / 2;
        const bx = head.x;
        const by = head.y + this.bubbleOffsetY;

        const depth = worldDepth(this.x, this.y);

        this.activeBubble = this.scene.add.container(bx, by, [bubbleGfx, text])
            .setDepth(depth + 10)
            .setScale(0);

        this.scene.tweens.add({
            targets: this.activeBubble,
            scaleX: 1,
            scaleY: 1,
            duration: 150,
            ease: 'Back.easeOut'
        });

        this.bubbleTimer = this.scene.time.delayedCall(2500, () => {
            this.fadeBubble();
        });
    }

    private fadeBubble(): void {
        if (!this.activeBubble) return;
        this.scene.tweens.add({
            targets: this.activeBubble,
            alpha: 0,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 200,
            onComplete: () => {
                if (this.activeBubble) {
                    this.activeBubble.destroy();
                    this.activeBubble = null;
                }
            }
        });
    }

    destroy(): void {
        if (this.activeBubble) {
            this.activeBubble.destroy();
        }
        if (this.bubbleTimer) {
            this.bubbleTimer.remove();
        }
        this.shadow.destroy();
        this.sprite.destroy();
        this.nameTag.destroy();
    }
}
