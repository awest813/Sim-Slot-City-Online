import Phaser from 'phaser';
import {
    AVATAR_SPEED, AVATAR_SIZE, WORLD_W, WORLD_H,
    COL_TRIM, COL_UI_BG2, DEPTH_AVATAR_BASE, DEPTH_SHADOW,
    COL_NEON_BLUE, COL_NEON_PINK,
} from '../../game/constants';

interface Blocker {
    x: number; y: number; w: number; h: number;
}

export type FacingDir = 'down' | 'up' | 'left' | 'right';

export class AvatarController {
    private scene: Phaser.Scene;
    private aura!: Phaser.GameObjects.Ellipse;
    private floorGlow!: Phaser.GameObjects.Ellipse;
    private leftArm!: Phaser.GameObjects.Ellipse;
    private rightArm!: Phaser.GameObjects.Ellipse;
    private leftLeg!: Phaser.GameObjects.Ellipse;
    private rightLeg!: Phaser.GameObjects.Ellipse;
    private shoulders!: Phaser.GameObjects.Ellipse;
    private body!: Phaser.GameObjects.Arc;
    private lapel!: Phaser.GameObjects.Triangle;
    private head!: Phaser.GameObjects.Arc;
    private hair!: Phaser.GameObjects.Arc;
    private faceGlow!: Phaser.GameObjects.Arc;
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

    private trailTimer = 0;

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

        this.floorGlow = this.scene.add.ellipse(this.x, this.y + AVATAR_SIZE * 0.55, AVATAR_SIZE * 2.4, AVATAR_SIZE * 0.7, COL_NEON_PINK, 0.12)
            .setDepth(DEPTH_AVATAR_BASE - 3)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.aura = this.scene.add.ellipse(this.x, this.y - 2, AVATAR_SIZE * 2.8, AVATAR_SIZE * 3.3, COL_NEON_BLUE, 0.14)
            .setDepth(DEPTH_AVATAR_BASE - 1)
            .setBlendMode(Phaser.BlendModes.ADD);

        this.leftLeg = this.scene.add.ellipse(this.x - AVATAR_SIZE * 0.36, this.y + AVATAR_SIZE * 0.92, AVATAR_SIZE * 0.45, AVATAR_SIZE * 0.9, 0x0a0c18)
            .setDepth(DEPTH_AVATAR_BASE - 1);
        this.rightLeg = this.scene.add.ellipse(this.x + AVATAR_SIZE * 0.36, this.y + AVATAR_SIZE * 0.92, AVATAR_SIZE * 0.45, AVATAR_SIZE * 0.9, 0x0a0c18)
            .setDepth(DEPTH_AVATAR_BASE - 1);

        this.leftArm = this.scene.add.ellipse(this.x - AVATAR_SIZE * 0.9, this.y + AVATAR_SIZE * 0.08, AVATAR_SIZE * 0.42, AVATAR_SIZE * 1.25, 0x10142b)
            .setDepth(DEPTH_AVATAR_BASE);
        this.rightArm = this.scene.add.ellipse(this.x + AVATAR_SIZE * 0.9, this.y + AVATAR_SIZE * 0.08, AVATAR_SIZE * 0.42, AVATAR_SIZE * 1.25, 0x10142b)
            .setDepth(DEPTH_AVATAR_BASE);
        this.leftArm.setStrokeStyle(1, COL_NEON_BLUE, 0.28);
        this.rightArm.setStrokeStyle(1, COL_NEON_PINK, 0.28);

        this.shoulders = this.scene.add.ellipse(this.x, this.y + AVATAR_SIZE * 0.15, AVATAR_SIZE * 1.85, AVATAR_SIZE * 1.35, 0x151a34)
            .setDepth(DEPTH_AVATAR_BASE);
        this.shoulders.setStrokeStyle(1.5, COL_NEON_PINK, 0.18);

        // Body (torso)
        this.body = this.scene.add.arc(this.x, this.y - 1, AVATAR_SIZE * 0.84, 0, 360, false, COL_UI_BG2)
            .setDepth(DEPTH_AVATAR_BASE);
        this.body.setStrokeStyle(2, COL_TRIM, 1);

        this.lapel = this.scene.add.triangle(this.x, this.y - 1, 0, -AVATAR_SIZE * 0.55, -AVATAR_SIZE * 0.42, AVATAR_SIZE * 0.34, AVATAR_SIZE * 0.42, AVATAR_SIZE * 0.34, 0x1d2c46, 0.95)
            .setDepth(DEPTH_AVATAR_BASE + 1);
        this.lapel.setStrokeStyle(1, COL_NEON_BLUE, 0.3);

        // Head
        this.head = this.scene.add.arc(this.x, this.y - AVATAR_SIZE * 0.8, AVATAR_SIZE * 0.55, 0, 360, false, 0xd4a984)
            .setDepth(DEPTH_AVATAR_BASE + 1);
        this.head.setStrokeStyle(1.5, 0xb08060, 1);

        this.faceGlow = this.scene.add.arc(this.x - AVATAR_SIZE * 0.15, this.y - AVATAR_SIZE * 0.95, AVATAR_SIZE * 0.18, 0, 360, false, 0xffe0b0, 0.42)
            .setDepth(DEPTH_AVATAR_BASE + 2);

        this.hair = this.scene.add.arc(this.x, this.y - AVATAR_SIZE * 0.95, AVATAR_SIZE * 0.42, 180, 360, false, 0x2a1a14)
            .setDepth(DEPTH_AVATAR_BASE + 2);
        this.hair.setStrokeStyle(1, 0x483024, 0.75);

        // Facing dot
        this.dot = this.scene.add.arc(this.x, this.y + AVATAR_SIZE * 0.6, 3, 0, 360, false, COL_TRIM)
            .setDepth(DEPTH_AVATAR_BASE + 3);

        // Name tag
        this.nameTag = this.scene.add.text(this.x, this.y - AVATAR_SIZE * 2.2, displayName, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#c9a84c',
        }).setOrigin(0.5, 1).setDepth(DEPTH_AVATAR_BASE + 4);
        this.nameTag.setShadow(0, 1, '#000000', 3, false, true);
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

            // Footstep trail
            this.trailTimer += delta;
            if (this.trailTimer >= 90) {
                this.trailTimer = 0;
                this.emitTrailParticle();
            }
        } else {
            this.trailTimer = 0;
        }

        this.syncSprite();
    }

    private syncSprite(): void {
        const r = AVATAR_SIZE;

        this.shadow.setPosition(this.x, this.y + r - 2);
        this.floorGlow.setPosition(this.x, this.y + r * 0.55).setAlpha(this.isMoving ? 0.2 : 0.12);
        this.aura.setPosition(this.x, this.y - 2).setAlpha(this.isMoving ? 0.22 : 0.14);
        this.leftLeg.setPosition(this.x - r * 0.36, this.y + r * 0.92);
        this.rightLeg.setPosition(this.x + r * 0.36, this.y + r * 0.92);
        this.leftArm.setPosition(this.x - r * 0.9, this.y + r * 0.08);
        this.rightArm.setPosition(this.x + r * 0.9, this.y + r * 0.08);
        this.shoulders.setPosition(this.x, this.y + r * 0.12);
        this.body.setPosition(this.x, this.y - 1);
        this.lapel.setPosition(this.x, this.y - 1);
        this.head.setPosition(this.x, this.y - r * 0.8);
        this.faceGlow.setPosition(this.x - r * 0.15, this.y - r * 0.95);
        this.hair.setPosition(this.x, this.y - r * 0.95);
        this.nameTag.setPosition(this.x, this.y - r * 2.4);

        // Depth sort: higher y = higher depth
        const depth = DEPTH_AVATAR_BASE + this.y * 0.1;
        this.floorGlow.setDepth(depth - 6);
        this.aura.setDepth(depth - 2);
        this.leftLeg.setDepth(depth - 1);
        this.rightLeg.setDepth(depth - 1);
        this.leftArm.setDepth(depth);
        this.rightArm.setDepth(depth);
        this.shoulders.setDepth(depth);
        this.body.setDepth(depth);
        this.lapel.setDepth(depth + 1);
        this.head.setDepth(depth + 1);
        this.faceGlow.setDepth(depth + 2);
        this.hair.setDepth(depth + 2);
        this.nameTag.setDepth(depth + 4);
        this.shadow.setDepth(depth - 5);

        // Facing indicator offset
        const offsets: Record<FacingDir, [number, number]> = {
            down:  [0,   r * 0.6],
            up:    [0,  -r * 0.6],
            left:  [-r * 0.6, 0],
            right: [ r * 0.6, 0],
        };
        const [ox, oy] = offsets[this.facing];
        this.dot.setPosition(this.x + ox, this.y + oy).setDepth(depth + 3);
    }

    destroy(): void {
        this.shadow.destroy();
        this.floorGlow.destroy();
        this.aura.destroy();
        this.leftLeg.destroy();
        this.rightLeg.destroy();
        this.leftArm.destroy();
        this.rightArm.destroy();
        this.shoulders.destroy();
        this.body.destroy();
        this.lapel.destroy();
        this.head.destroy();
        this.faceGlow.destroy();
        this.hair.destroy();
        this.dot.destroy();
        this.nameTag.destroy();
    }

    private emitTrailParticle(): void {
        const g = this.scene.add.graphics();
        g.setDepth(DEPTH_SHADOW - 1);
        g.fillStyle(COL_TRIM, 0.5);
        g.fillCircle(this.x, this.y + AVATAR_SIZE * 0.5, 2.5);
        this.scene.tweens.add({
            targets:  g,
            alpha:    0,
            scaleX:   0.2,
            scaleY:   0.2,
            duration: 400,
            ease:     'Sine.easeOut',
            onComplete: () => { g.destroy(); },
        });
    }
}
