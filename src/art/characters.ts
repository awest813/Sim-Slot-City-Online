// Original isometric people in a late-90s life-sim style.
// Big readable heads, flat bright clothes, soft upper-left light,
// and a spinning green mood crystal over the player.

import type Phaser from 'phaser';

export const SIM_W = 72;
export const SIM_H = 104;
export const SIM_FEET = 96;
export const FEET_ORIGIN = SIM_FEET / SIM_H;
/** Pixels above the feet where the bottom of the crystal sits. */
export const PLUMBOB_LIFT = 78;
export const NAME_LIFT = 132;

export type FacingDir = 'down' | 'up' | 'left' | 'right';
type IsoDir = 'se' | 'sw' | 'ne' | 'nw';

const DIR: Record<FacingDir, IsoDir> = {
    right: 'se',
    down: 'sw',
    left: 'nw',
    up: 'ne',
};

export function simAnimKey(outfit: string, facing: FacingDir, frame: number): string {
    const f = ((frame % 4) + 4) % 4;
    return `${outfit}__${DIR[facing]}__${f}`;
}

interface Outfit {
    skin: string;
    skinHi: string;
    skinLo: string;
    hair: string;
    hairHi: string;
    shirt: string;
    shirtHi: string;
    shirtLo: string;
    pants: string;
    pantsLo: string;
    shoe: string;
    hairStyle: 'short' | 'bob' | 'slick' | 'updo';
    clothes: 'casual' | 'dress' | 'suit';
}

const OUTFITS: Record<string, Outfit> = {
    avatar_player: {
        skin: '#f0c3a0', skinHi: '#ffd8b8', skinLo: '#d39a78',
        hair: '#6b3e22', hairHi: '#8a5834',
        shirt: '#f4f1ea', shirtHi: '#ffffff', shirtLo: '#d5d0c6',
        pants: '#3d6eb5', pantsLo: '#2c5288',
        shoe: '#f7f7f5',
        hairStyle: 'short', clothes: 'casual',
    },
    avatar_ai_male: {
        skin: '#e0a67e', skinHi: '#f0c09a', skinLo: '#c48462',
        hair: '#2a211c', hairHi: '#4a3b32',
        shirt: '#d24a3a', shirtHi: '#e86a58', shirtLo: '#a83428',
        pants: '#c4a36a', pantsLo: '#9a7c48',
        shoe: '#5c4030',
        hairStyle: 'short', clothes: 'casual',
    },
    avatar_ai_female: {
        skin: '#f3c6a4', skinHi: '#ffe0c4', skinLo: '#d9a484',
        hair: '#e2b15a', hairHi: '#f6d48a',
        shirt: '#3aa8a0', shirtHi: '#6fd0c6', shirtLo: '#217e78',
        pants: '#2c2c34', pantsLo: '#1a1a20',
        shoe: '#f2efe8',
        hairStyle: 'bob', clothes: 'casual',
    },
    avatar_ai_vip: {
        skin: '#c98b62', skinHi: '#e0a67e', skinLo: '#a86c48',
        hair: '#1a1614', hairHi: '#3a3028',
        shirt: '#f7f4ee', shirtHi: '#ffffff', shirtLo: '#d9d3c8',
        pants: '#1c1e24', pantsLo: '#101216',
        shoe: '#111111',
        hairStyle: 'slick', clothes: 'suit',
    },
    avatar_showgirl: {
        skin: '#f6c8aa', skinHi: '#ffe1c8', skinLo: '#e0a888',
        hair: '#f0d070', hairHi: '#ffe9a8',
        shirt: '#e23b4a', shirtHi: '#ff6a74', shirtLo: '#b42332',
        pants: '#e23b4a', pantsLo: '#b42332',
        shoe: '#f4efe6',
        hairStyle: 'updo', clothes: 'dress',
    },
};

function roundLimb(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    fill: string, hi: string,
): void {
    ctx.fillStyle = fill;
    const r = Math.min(4, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x + 1, y + 1, Math.max(1, w * 0.35), Math.max(1, h - 2));
    ctx.globalAlpha = 1;
}

function drawHair(
    ctx: CanvasRenderingContext2D,
    o: Outfit,
    hx: number, hy: number, hr: number,
    front: boolean,
): void {
    ctx.fillStyle = o.hair;
    if (o.hairStyle === 'short') {
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.15, hr * 1.05, hr * 0.92, 0, Math.PI * 0.82, Math.PI * 2.18);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.ellipse(hx - 3, hy - hr * 0.55, hr * 0.4, hr * 0.28, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    } else if (o.hairStyle === 'bob') {
        ctx.beginPath();
        ctx.ellipse(hx, hy - 1, hr + 2, hr + 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (front) {
            // Open the face again
            ctx.fillStyle = o.skin;
            ctx.beginPath();
            ctx.ellipse(hx + (hx > 36 ? 2 : -2), hy + 2, hr * 0.72, hr * 0.68, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = o.hair;
            ctx.beginPath();
            ctx.ellipse(hx, hy - hr * 0.45, hr * 0.95, hr * 0.5, 0, Math.PI, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = o.hairHi;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(hx - 4, hy - hr * 0.4, 5, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    } else if (o.hairStyle === 'slick') {
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.45, hr * 0.92, hr * 0.55, 0, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(hx - hr * 0.5, hy - hr * 0.7, hr, 3);
        ctx.globalAlpha = 1;
    } else {
        // updo
        ctx.beginPath();
        ctx.ellipse(hx, hy - 2, hr + 1, hr * 0.85, 0, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx + 1, hy - hr - 2, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.beginPath();
        ctx.ellipse(hx - 1, hy - hr - 4, 3, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // small feather
        ctx.fillStyle = '#f25c6a';
        ctx.beginPath();
        ctx.ellipse(hx + 8, hy - hr - 4, 3, 6, 0.6, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFace(
    ctx: CanvasRenderingContext2D,
    hx: number, hy: number,
    face: number,
): void {
    const ex = hx + face * 3;
    ctx.fillStyle = '#2a211c';
    ctx.beginPath();
    ctx.ellipse(ex - 3, hy - 1, 1.3, 1.6, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + 3, hy - 1, 1.3, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ex - 3.4, hy - 1.8, 1, 1);
    ctx.fillRect(ex + 2.6, hy - 1.8, 1, 1);
    ctx.strokeStyle = '#a86458';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ex, hy + 4, 2.4, 0.15, Math.PI - 0.15);
    ctx.stroke();
}

function paintSim(
    ctx: CanvasRenderingContext2D,
    o: Outfit,
    dir: IsoDir,
    frame: number,
): void {
    const cx = SIM_W / 2;
    const front = dir === 'se' || dir === 'sw';
    const face = dir === 'se' || dir === 'ne' ? 1 : -1;
    const bob = frame === 2 ? -2 : frame === 1 || frame === 3 ? -1 : 0;
    const step = [0, 1, 0, -1][frame];

    const hip = 70 + bob;
    const shoulder = hip - 18;
    const headR = 12;
    const headX = cx + face * (front ? 3 : 1);
    const headY = 30 + bob;

    const drawLeg = (side: number, phase: number, color: string, lo: string) => {
        const x = cx + side * 5 + face * 1;
        const y = hip - 2 + phase * 3;
        const h = 22 - Math.abs(phase) * 2;
        roundLimb(ctx, x - 3.2, y, 6.4, h, color, lo);
        ctx.fillStyle = o.shoe;
        ctx.beginPath();
        ctx.ellipse(x + face * 1.2, y + h - 1, 4.2, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawArm = (side: number, phase: number) => {
        const x = cx + side * 9 + face * 1;
        const swing = phase * 3;
        roundLimb(ctx, x - 2.4, shoulder + swing, 5, 16, o.shirt, o.shirtHi);
        ctx.fillStyle = o.skin;
        ctx.beginPath();
        ctx.arc(x, shoulder + 16 + swing, 2.6, 0, Math.PI * 2);
        ctx.fill();
    };

    // Far limbs first
    const far = -face;
    const near = face;
    if (o.clothes !== 'dress') {
        drawLeg(far, -step * far, o.pants, o.pantsLo);
    }
    drawArm(far, step);

    if (o.clothes === 'dress') {
        // skirt
        ctx.fillStyle = o.shirt;
        ctx.beginPath();
        ctx.moveTo(cx - 9, hip - 16);
        ctx.lineTo(cx + 9, hip - 16);
        ctx.lineTo(cx + 12, hip + 4);
        ctx.lineTo(cx - 12, hip + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = o.shirtHi;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(cx - 8, hip - 14, 4, 14);
        ctx.globalAlpha = 1;
        drawLeg(far, -step, o.skin, o.skinLo);
        drawLeg(near, step, o.skin, o.skinLo);
    }

    // Torso
    const torsoW = o.clothes === 'suit' ? 18 : 16;
    ctx.fillStyle = o.clothes === 'suit' ? o.pants : o.shirt;
    const tx = cx - torsoW / 2 + face * 1;
    const ty = shoulder - 2;
    const th = 20;
    ctx.beginPath();
    const rr = 5;
    ctx.moveTo(tx + rr, ty);
    ctx.arcTo(tx + torsoW, ty, tx + torsoW, ty + th, rr);
    ctx.arcTo(tx + torsoW, ty + th, tx, ty + th, 3);
    ctx.arcTo(tx, ty + th, tx, ty, 3);
    ctx.arcTo(tx, ty, tx + torsoW, ty, rr);
    ctx.fill();
    ctx.fillStyle = o.clothes === 'suit' ? '#3a3e48' : o.shirtHi;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(tx + 1, ty + 1, torsoW * 0.38, th - 4);
    ctx.globalAlpha = 1;

    if (o.clothes === 'suit') {
        // shirt placket and lapels
        ctx.fillStyle = o.shirt;
        ctx.beginPath();
        ctx.moveTo(cx - 3, ty + 2);
        ctx.lineTo(cx + 3, ty + 2);
        ctx.lineTo(cx + 1, ty + th - 2);
        ctx.lineTo(cx - 1, ty + th - 2);
        ctx.fill();
        ctx.fillStyle = '#c9a24a';
        ctx.fillRect(cx - 1, ty + 8, 2, 2);
    } else if (o.clothes === 'casual') {
        ctx.fillStyle = o.shirtLo;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(cx - 1, ty + 2, 2, th - 4);
        ctx.globalAlpha = 1;
    }

    if (o.clothes !== 'dress') {
        drawLeg(near, step * near, o.pants, o.pantsLo);
    }
    drawArm(near, -step);

    // Neck
    ctx.fillStyle = o.skinLo;
    ctx.fillRect(cx - 2 + face, shoulder - 6, 5, 6);

    // Ears
    if (front) {
        ctx.fillStyle = o.skinLo;
        ctx.beginPath();
        ctx.ellipse(headX - face * (headR - 1), headY + 1, 2.2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Hair behind the skull for bob / updo
    if (!front || o.hairStyle === 'bob' || o.hairStyle === 'updo') {
        drawHair(ctx, o, headX, headY, headR, false);
    }

    // Head
    const grd = ctx.createRadialGradient(headX - 4, headY - 5, 2, headX + 2, headY + 2, headR + 1);
    grd.addColorStop(0, o.skinHi);
    grd.addColorStop(0.7, o.skin);
    grd.addColorStop(1, o.skinLo);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    drawHair(ctx, o, headX, headY, headR, front);

    if (front) drawFace(ctx, headX, headY, face);
    else {
        // back of the neck line
        ctx.strokeStyle = o.skinLo;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(headX, headY + 4, 4, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }
}

function paintCrystal(ctx: CanvasRenderingContext2D, squash: number, flip: boolean): void {
    const w = 36;
    const h = 48;
    const cx = w / 2;
    const cy = 20;
    const hw = Math.max(1.6, 11 * squash);
    ctx.clearRect(0, 0, w, h);
    // soft glow
    ctx.fillStyle = 'rgba(80, 220, 70, 0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, hw + 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const top = { x: cx, y: 3 };
    const bot = { x: cx, y: 42 };
    const left = { x: cx - hw, y: cy };
    const right = { x: cx + hw, y: cy };

    const leftCol = flip ? '#b8ff6a' : '#2f9a32';
    const rightCol = flip ? '#2f9a32' : '#7CFF45';

    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.closePath();
    ctx.fillStyle = leftCol;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.closePath();
    ctx.fillStyle = rightCol;
    ctx.fill();

    // specular
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.15, 7);
    ctx.lineTo(cx + hw * 0.05, 8);
    ctx.lineTo(cx - hw * 0.05, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(10, 60, 16, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(left.x, left.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.stroke();
}

function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
    if (scene.textures.exists(key)) return;
    scene.textures.addCanvas(key, canvas);
}

export function bakeCharacters(scene: Phaser.Scene): void {
    const dirs: IsoDir[] = ['se', 'sw', 'ne', 'nw'];
    for (const id of Object.keys(OUTFITS)) {
        const outfit = OUTFITS[id];
        dirs.forEach((dir, di) => {
            for (let frame = 0; frame < 4; frame++) {
                const canvas = document.createElement('canvas');
                canvas.width = SIM_W;
                canvas.height = SIM_H;
                const ctx = canvas.getContext('2d')!;
                ctx.imageSmoothingEnabled = true;
                paintSim(ctx, outfit, dir, frame);
                const key = `${id}__${dir}__${frame}`;
                addCanvas(scene, key, canvas);
                if (di === 0 && frame === 0) {
                    const alias = document.createElement('canvas');
                    alias.width = SIM_W;
                    alias.height = SIM_H;
                    alias.getContext('2d')!.drawImage(canvas, 0, 0);
                    addCanvas(scene, id, alias);
                }
            }
        });
    }

    for (let i = 0; i < 8; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 36;
        canvas.height = 48;
        const ctx = canvas.getContext('2d')!;
        const ang = (i / 8) * Math.PI * 2;
        const squash = Math.abs(Math.cos(ang));
        paintCrystal(ctx, 0.18 + squash * 0.82, Math.sin(ang) > 0);
        addCanvas(scene, `plumbob_${i}`, canvas);
    }
}
