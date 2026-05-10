import Phaser from 'phaser';
import {
    AVATAR_SPEED, AVATAR_SIZE, WORLD_W, WORLD_H,
    COL_TRIM, DEPTH_AVATAR_BASE, DEPTH_SHADOW,
} from '../../game/constants';

interface Blocker {
    x: number; y: number; w: number; h: number;
}

type FacingDir = 'down' | 'up' | 'left' | 'right';

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

export class AIWalker {
    private scene:    Phaser.Scene;
    private aura!:    Phaser.GameObjects.Ellipse;
    private shoulders!: Phaser.GameObjects.Ellipse;
    private leftLeg!: Phaser.GameObjects.Ellipse;
    private rightLeg!: Phaser.GameObjects.Ellipse;
    private body!:    Phaser.GameObjects.Arc;
    private head!:    Phaser.GameObjects.Arc;
    private hair!:    Phaser.GameObjects.Arc;
    private dot!:     Phaser.GameObjects.Arc;
    private shadow!:  Phaser.GameObjects.Ellipse;
    private nameTag!: Phaser.GameObjects.Text;
    private blockers: Blocker[] = [];

    x: number;
    y: number;

    private facing:     FacingDir = 'down';
    private targetX:    number;
    private targetY:    number;
    private pauseTimer: number = 0;
    private stuckTimer: number = 0;
    private bodyColor:  number;

    constructor(
        scene: Phaser.Scene,
        startX: number, startY: number,
        name: string,
        bodyColor: number,
    ) {
        this.scene     = scene;
        this.x         = startX;
        this.y         = startY;
        this.bodyColor = bodyColor;

        const wp    = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
        this.targetX = wp[0];
        this.targetY = wp[1];

        this.buildSprite(name);
    }

    private buildSprite(name: string): void {
        const r = AVATAR_SIZE;

        this.shadow = this.scene.add
            .ellipse(this.x, this.y + r - 2, r * 2, r * 0.8, 0x000000, 0.30)
            .setDepth(DEPTH_SHADOW);

        this.aura = this.scene.add
            .ellipse(this.x, this.y - 2, r * 2.3, r * 2.75, this.bodyColor, 0.08)
            .setDepth(DEPTH_AVATAR_BASE - 2)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.leftLeg = this.scene.add
            .ellipse(this.x - r * 0.33, this.y + r * 0.82, r * 0.42, r * 0.82, 0x080a12)
            .setDepth(DEPTH_AVATAR_BASE - 1);

        this.rightLeg = this.scene.add
            .ellipse(this.x + r * 0.33, this.y + r * 0.82, r * 0.42, r * 0.82, 0x080a12)
            .setDepth(DEPTH_AVATAR_BASE - 1);

        this.shoulders = this.scene.add
            .ellipse(this.x, this.y + r * 0.12, r * 1.65, r * 1.12, 0x12172a)
            .setDepth(DEPTH_AVATAR_BASE);
        this.shoulders.setStrokeStyle(1, this.bodyColor, 0.45);

        this.body = this.scene.add
            .arc(this.x, this.y - 1, r * 0.82, 0, 360, false, this.bodyColor)
            .setDepth(DEPTH_AVATAR_BASE);
        this.body.setStrokeStyle(2, COL_TRIM, 0.7);

        this.head = this.scene.add
            .arc(this.x, this.y - r * 0.8, r * 0.55, 0, 360, false, 0xd4a984)
            .setDepth(DEPTH_AVATAR_BASE + 1);
        this.head.setStrokeStyle(1.5, 0xb08060, 1);

        this.hair = this.scene.add
            .arc(this.x, this.y - r * 0.95, r * 0.4, 180, 360, false, 0x22130e)
            .setDepth(DEPTH_AVATAR_BASE + 2);

        this.dot = this.scene.add
            .arc(this.x, this.y + r * 0.6, 3, 0, 360, false, COL_TRIM)
            .setDepth(DEPTH_AVATAR_BASE + 2);

        this.nameTag = this.scene.add
            .text(this.x, this.y - r * 2.2, name, {
                fontFamily: 'monospace',
                fontSize:   '10px',
                color:      Phaser.Display.Color.IntegerToColor(this.bodyColor).rgba,
            })
            .setOrigin(0.5, 1)
            .setDepth(DEPTH_AVATAR_BASE + 3);
    }

    addBlocker(b: Blocker): void {
        this.blockers.push(b);
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
            this.syncSprite();
            return;
        }

        const dx   = this.targetX - this.x;
        const dy   = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Arrived — rest briefly then pick a new goal
        if (dist < 10) {
            this.pauseTimer = 600 + Math.random() * 2400;
            this.pickNewTarget();
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
        const r = AVATAR_SIZE;

        this.shadow.setPosition(this.x, this.y + r - 2);
        this.aura.setPosition(this.x, this.y - 2);
        this.leftLeg.setPosition(this.x - r * 0.33, this.y + r * 0.82);
        this.rightLeg.setPosition(this.x + r * 0.33, this.y + r * 0.82);
        this.shoulders.setPosition(this.x, this.y + r * 0.12);
        this.body.setPosition(this.x, this.y - 1);
        this.head.setPosition(this.x, this.y - r * 0.8);
        this.hair.setPosition(this.x, this.y - r * 0.95);
        this.nameTag.setPosition(this.x, this.y - r * 2.4);

        const depth = DEPTH_AVATAR_BASE + this.y * 0.1;
        this.aura.setDepth(depth - 2);
        this.leftLeg.setDepth(depth - 1);
        this.rightLeg.setDepth(depth - 1);
        this.shoulders.setDepth(depth);
        this.body.setDepth(depth);
        this.head.setDepth(depth + 1);
        this.hair.setDepth(depth + 2);
        this.nameTag.setDepth(depth + 3);
        this.shadow.setDepth(depth - 5);

        const offsets: Record<FacingDir, [number, number]> = {
            down:  [0,       r * 0.6],
            up:    [0,      -r * 0.6],
            left:  [-r * 0.6, 0],
            right: [ r * 0.6, 0],
        };
        const [ox, oy] = offsets[this.facing];
        this.dot.setPosition(this.x + ox, this.y + oy).setDepth(depth + 2);
    }

    destroy(): void {
        this.shadow.destroy();
        this.aura.destroy();
        this.leftLeg.destroy();
        this.rightLeg.destroy();
        this.shoulders.destroy();
        this.body.destroy();
        this.head.destroy();
        this.hair.destroy();
        this.dot.destroy();
        this.nameTag.destroy();
    }
}
