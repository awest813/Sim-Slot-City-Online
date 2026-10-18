import Phaser from 'phaser';
import {
    AVATAR_SPEED, AVATAR_SIZE, WORLD_W, WORLD_H,
    DEPTH_SHADOW,
} from '../../game/constants';
import { GameState } from '../state/GameState';
import { SIM_NAME_STYLE, syncSimSprite } from '../../art/actor';
import { toScreen } from '../../art/iso';
import type { FacingDir } from '../../art/characters';
import { SoundManager } from './SoundManager';

interface Blocker {
    x: number; y: number; w: number; h: number;
}

export type { FacingDir };

export class AvatarController {
    private scene: Phaser.Scene;
    private sprite!: Phaser.GameObjects.Image;
    private walkTime = 0;
    private shadow!: Phaser.GameObjects.Ellipse;
    private nameTag!: Phaser.GameObjects.Text;
    private plumbob!: Phaser.GameObjects.Image;
    private blockers: Blocker[] = [];
    private emoteBubble: Phaser.GameObjects.Container | null = null;

    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

    x: number;
    y: number;
    facing: FacingDir = 'down';
    isMoving: boolean = false;
    enabled: boolean = true;
    private targetPos: { x: number, y: number } | null = null;

    private trailTimer = 0;
    private crystalTime = 0;

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
        const here = toScreen(this.x, this.y);
        this.shadow = this.scene.add.ellipse(here.x, here.y, 32, 12, 0x1a2410, 0.35)
            .setDepth(DEPTH_SHADOW);

        const tex = GameState.get().avatarTextureKey || 'avatar_player';
        this.sprite = this.scene.add.image(here.x, here.y, tex);

        this.plumbob = this.scene.add.image(here.x, here.y, 'plumbob_0');

        this.nameTag = this.scene.add.text(here.x, here.y, displayName, SIM_NAME_STYLE)
            .setOrigin(0.5, 1);
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

        rx = Phaser.Math.Clamp(rx, r, WORLD_W - r);
        ry = Phaser.Math.Clamp(ry, r, WORLD_H - r);

        return { x: rx, y: ry };
    }

    setTarget(x: number, y: number): void {
        this.targetPos = { x, y };
    }

    update(delta: number): void {
        this.crystalTime += delta;
        if (!this.enabled) {
            this.isMoving = false;
            this.walkTime = 0;
            this.syncSprite();
            return;
        }

        const dt = delta / 1000;
        let vx = 0;
        let vy = 0;

        const left  = this.cursors.left.isDown  || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up    = this.cursors.up.isDown    || this.wasd.up.isDown;
        const down  = this.cursors.down.isDown  || this.wasd.down.isDown;

        if (left || right || up || down) {
            this.targetPos = null;
        }

        if (this.targetPos) {
            const dx = this.targetPos.x - this.x;
            const dy = this.targetPos.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 4) {
                this.targetPos = null;
            } else {
                vx = dx / dist;
                vy = dy / dist;
                if (Math.abs(vx) > Math.abs(vy)) {
                    this.facing = vx > 0 ? 'right' : 'left';
                } else {
                    this.facing = vy > 0 ? 'down' : 'up';
                }
            }
        } else {
            if (left)  { vx -= 1; this.facing = 'left';  }
            if (right) { vx += 1; this.facing = 'right'; }
            if (up)    { vy -= 1; this.facing = 'up';    }
            if (down)  { vy += 1; this.facing = 'down';  }
        }

        this.isMoving = vx !== 0 || vy !== 0;

        if (this.isMoving) {
            const mag = Math.sqrt(vx * vx + vy * vy);
            vx = (vx / mag) * AVATAR_SPEED * dt;
            vy = (vy / mag) * AVATAR_SPEED * dt;

            const oldX = this.x;
            const oldY = this.y;
            const resolved = this.resolveBlockers(this.x + vx, this.y + vy);
            this.x = resolved.x;
            this.y = resolved.y;

            if (this.targetPos && Math.abs(this.x - oldX) < 0.1 && Math.abs(this.y - oldY) < 0.1) {
                this.targetPos = null;
            }

            this.trailTimer += delta;
            if (this.trailTimer >= 140) {
                this.trailTimer = 0;
                this.emitTrailParticle();
            }
            const prevWalk = this.walkTime;
            this.walkTime += delta;
            if (Math.floor(this.walkTime / 280) !== Math.floor(prevWalk / 280)) {
                SoundManager.playStep();
            }
        } else {
            this.trailTimer = 0;
            this.walkTime = 0;
        }

        this.syncSprite();
    }

    private syncSprite(): void {
        const tex = GameState.get().avatarTextureKey || 'avatar_player';
        const frame = this.isMoving ? Math.floor(this.walkTime / 140) % 4 : 0;
        const bob = this.isMoving ? Math.sin(this.walkTime * 0.02) * 1.4 : 0;
        const s = syncSimSprite({
            sprite: this.sprite,
            shadow: this.shadow,
            nameTag: this.nameTag,
            plumbob: this.plumbob,
            x: this.x,
            y: this.y,
            bob,
            outfit: tex,
            facing: this.facing,
            frame,
            plumbobFrame: Math.floor(this.crystalTime / 90),
        });

        if (this.emoteBubble && this.emoteBubble.active) {
            this.emoteBubble.setPosition(s.x, s.y - 78 + bob);
            this.emoteBubble.setDepth(this.sprite.depth + 6);
        }
    }

    destroy(): void {
        this.shadow.destroy();
        this.plumbob.destroy();
        this.sprite.destroy();
        this.nameTag.destroy();
        if (this.emoteBubble) {
            this.emoteBubble.destroy();
            this.emoteBubble = null;
        }
    }

    playEmote(emoji: string): void {
        if (this.emoteBubble) {
            this.emoteBubble.destroy();
        }

        const s = toScreen(this.x, this.y);
        const bx = s.x;
        const by = s.y - 78;

        const bubbleGfx = this.scene.add.graphics();
        const bw = 36;
        const bh = 36;
        const br = 10;
        bubbleGfx.fillStyle(0xfff6e4, 0.96);
        bubbleGfx.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
        bubbleGfx.fillTriangle(0, bh / 2 + 5, -5, bh / 2 - 2, 5, bh / 2 - 2);
        bubbleGfx.lineStyle(1.5, 0x1a9a86, 0.9);
        bubbleGfx.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, br);

        const text = this.scene.add.text(0, -1, emoji, {
            fontSize: '20px',
        }).setOrigin(0.5);

        this.emoteBubble = this.scene.add.container(bx, by, [bubbleGfx, text]);
        this.emoteBubble.setScale(0);

        this.scene.tweens.add({
            targets: this.emoteBubble,
            scaleX: 1, scaleY: 1,
            y: by - 12,
            duration: 250,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this.emoteBubble,
                    alpha: 0,
                    y: by - 26,
                    delay: 1300,
                    duration: 350,
                    onComplete: () => {
                        if (this.emoteBubble) {
                            this.emoteBubble.destroy();
                            this.emoteBubble = null;
                        }
                    }
                });
            }
        });
    }

    private emitTrailParticle(): void {
        const s = toScreen(this.x, this.y);
        const g = this.scene.add.graphics();
        g.setDepth(this.sprite.depth - 2);
        g.fillStyle(0x6b8a48, 0.45);
        g.fillCircle(s.x, s.y, 2.2);
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
