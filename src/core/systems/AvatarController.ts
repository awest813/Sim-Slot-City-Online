import Phaser from 'phaser';
import {
    AVATAR_SPEED, AVATAR_SIZE, WORLD_W, WORLD_H,
    COL_TRIM, COL_UI_BG2, DEPTH_AVATAR_BASE, DEPTH_SHADOW,
} from '../../game/constants';

interface Blocker {
    x: number; y: number; w: number; h: number;
}

export type FacingDir = 'down' | 'up' | 'left' | 'right';

export class AvatarController {
    private scene: Phaser.Scene;
    private body!: Phaser.GameObjects.Arc;
    private head!: Phaser.GameObjects.Arc;
    private dot!: Phaser.GameObjects.Arc;    // facing indicator
    private shadow!: Phaser.GameObjects.Ellipse;
    private nameTag!: Phaser.GameObjects.Text;
    private blockers: Blocker[] = [];

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

    x: number;
    y: number;
    facing: FacingDir = 'down';
    isMoving: boolean = false;

    constructor(scene: Phaser.Scene, startX: number, startY: number, displayName: string) {
        this.scene = scene;
        this.x = startX;
        this.y = startY;

        this.buildSprite(displayName);

        this.cursors = scene.input.keyboard!.createCursorKeys();
        this.wasd = {
            up:    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left:  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
    }

    private buildSprite(displayName: string): void {
        // Shadow
        this.shadow = this.scene.add.ellipse(this.x, this.y + AVATAR_SIZE - 2, AVATAR_SIZE * 2, AVATAR_SIZE * 0.8, 0x000000, 0.35)
            .setDepth(DEPTH_SHADOW);

        // Body (torso)
        this.body = this.scene.add.arc(this.x, this.y, AVATAR_SIZE, 0, 360, false, COL_UI_BG2)
            .setDepth(DEPTH_AVATAR_BASE);
        this.body.setStrokeStyle(2, COL_TRIM, 1);

        // Head
        this.head = this.scene.add.arc(this.x, this.y - AVATAR_SIZE * 0.8, AVATAR_SIZE * 0.55, 0, 360, false, 0xd4a984)
            .setDepth(DEPTH_AVATAR_BASE + 1);
        this.head.setStrokeStyle(1.5, 0xb08060, 1);

        // Facing dot
        this.dot = this.scene.add.arc(this.x, this.y + AVATAR_SIZE * 0.6, 3, 0, 360, false, COL_TRIM)
            .setDepth(DEPTH_AVATAR_BASE + 2);

        // Name tag
        this.nameTag = this.scene.add.text(this.x, this.y - AVATAR_SIZE * 2.2, displayName, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#c9a84c',
        }).setOrigin(0.5, 1).setDepth(DEPTH_AVATAR_BASE + 3);
    }

    addBlocker(b: Blocker): void {
        this.blockers.push(b);
    }

    private resolveBlockers(nx: number, ny: number): { x: number; y: number } {
        let rx = nx;
        let ry = ny;
        const r = AVATAR_SIZE;

        for (const b of this.blockers) {
            // Closest point on blocker rect to avatar center
            const cx = Math.max(b.x, Math.min(rx, b.x + b.w));
            const cy = Math.max(b.y, Math.min(ry, b.y + b.h));
            const dx = rx - cx;
            const dy = ry - cy;
            const dist2 = dx * dx + dy * dy;

            if (dist2 < r * r) {
                const dist = Math.sqrt(dist2) || 1;
                const overlap = r - dist;
                rx += (dx / dist) * overlap;
                ry += (dy / dist) * overlap;
            }
        }

        // World bounds
        rx = Phaser.Math.Clamp(rx, r, WORLD_W - r);
        ry = Phaser.Math.Clamp(ry, r, WORLD_H - r);

        return { x: rx, y: ry };
    }

    update(delta: number): void {
        const dt = delta / 1000;
        let vx = 0;
        let vy = 0;

        const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
        const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

        if (left)  { vx -= 1; this.facing = 'left';  }
        if (right) { vx += 1; this.facing = 'right'; }
        if (up)    { vy -= 1; this.facing = 'up';    }
        if (down)  { vy += 1; this.facing = 'down';  }

        this.isMoving = vx !== 0 || vy !== 0;

        if (this.isMoving) {
            // Normalize diagonal
            const mag = Math.sqrt(vx * vx + vy * vy);
            vx = (vx / mag) * AVATAR_SPEED * dt;
            vy = (vy / mag) * AVATAR_SPEED * dt;

            const resolved = this.resolveBlockers(this.x + vx, this.y + vy);
            this.x = resolved.x;
            this.y = resolved.y;
        }

        this.syncSprite();
    }

    private syncSprite(): void {
        const r = AVATAR_SIZE;

        this.shadow.setPosition(this.x, this.y + r - 2);
        this.body.setPosition(this.x, this.y);
        this.head.setPosition(this.x, this.y - r * 0.8);
        this.nameTag.setPosition(this.x, this.y - r * 2.4);

        // Depth sort: higher y = higher depth
        const depth = DEPTH_AVATAR_BASE + this.y * 0.1;
        this.body.setDepth(depth);
        this.head.setDepth(depth + 1);
        this.nameTag.setDepth(depth + 3);
        this.shadow.setDepth(depth - 5);

        // Facing indicator offset
        const offsets: Record<FacingDir, [number, number]> = {
            down:  [0,   r * 0.6],
            up:    [0,  -r * 0.6],
            left:  [-r * 0.6, 0],
            right: [ r * 0.6, 0],
        };
        const [ox, oy] = offsets[this.facing];
        this.dot.setPosition(this.x + ox, this.y + oy).setDepth(depth + 2);
    }

    destroy(): void {
        this.shadow.destroy();
        this.body.destroy();
        this.head.destroy();
        this.dot.destroy();
        this.nameTag.destroy();
    }
}
