// Original isometric people in a late-90s life-sim style.
// Big readable heads, flat bright clothes, soft upper-left light,
// and a spinning green mood crystal over the player.

import type Phaser from 'phaser';

export const SIM_W = 72;
export const SIM_H = 104;
export const SIM_FEET = 96;
export const FEET_ORIGIN = SIM_FEET / SIM_H;
/** Pixels above the feet where the bottom of the crystal sits. */
export const PLUMBOB_LIFT = 96;
export const NAME_LIFT = 152;

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

function capsule(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    fill: string, hi: string, lo: string,
): void {
    const r = Math.min(w / 2, 7);
    const g = ctx.createLinearGradient(x, y, x + w, y + h * 0.15);
    g.addColorStop(0, lo);
    g.addColorStop(0.28, hi);
    g.addColorStop(0.72, fill);
    g.addColorStop(1, lo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
}

function drawHair(
    ctx: CanvasRenderingContext2D,
    o: Outfit,
    hx: number, hy: number, hr: number,
    front: boolean,
    face: number,
): void {
    ctx.fillStyle = o.hair;
    if (o.hairStyle === 'short') {
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.22, hr * 1.12, hr * 0.95, 0, Math.PI * 0.15, Math.PI * 1.85);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.beginPath();
        ctx.ellipse(hx - 4, hy - hr * 0.55, hr * 0.42, hr * 0.22, -0.5, 0, Math.PI * 2);
        ctx.fill();
    } else if (o.hairStyle === 'bob') {
        ctx.beginPath();
        ctx.ellipse(hx, hy + 2, hr + 4, hr + 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(hx - 5, hy - hr * 0.35, 6, 4, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (front) {
            const faceGrd = ctx.createRadialGradient(hx - 3, hy - 4, 2, hx, hy + 2, hr);
            faceGrd.addColorStop(0, o.skinHi);
            faceGrd.addColorStop(0.75, o.skin);
            faceGrd.addColorStop(1, o.skinLo);
            ctx.fillStyle = faceGrd;
            ctx.beginPath();
            ctx.ellipse(hx + face * 1.5, hy + 3, hr * 0.78, hr * 0.72, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = o.hair;
            ctx.beginPath();
            ctx.ellipse(hx + face * 1, hy - hr * 0.28, hr * 0.92, hr * 0.46, 0, Math.PI, Math.PI * 2);
            ctx.fill();
        }
    } else if (o.hairStyle === 'slick') {
        ctx.beginPath();
        ctx.ellipse(hx + face * 2, hy - hr * 0.35, hr * 1.02, hr * 0.62, face * -0.15, Math.PI * 0.9, Math.PI * 2.2);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(hx - 2, hy - hr * 0.62, hr * 0.7, 2.2, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    } else {
        ctx.beginPath();
        ctx.ellipse(hx, hy - 1, hr + 2, hr * 0.9, 0, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx + 2, hy - hr - 1, 8, 9, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr - 4, 3.5, 3, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f25c6a';
        ctx.beginPath();
        ctx.ellipse(hx + 10, hy - hr - 2, 2.4, 6, 0.7, 0, Math.PI * 2);
        ctx.fill();
        if (front) {
            ctx.fillStyle = o.hair;
            ctx.beginPath();
            ctx.ellipse(hx, hy - hr * 0.45, hr * 0.95, hr * 0.38, 0, Math.PI, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawFace(
    ctx: CanvasRenderingContext2D,
    o: Outfit,
    hx: number, hy: number,
    face: number,
): void {
    const ex = hx + face * 2.5;
    ctx.fillStyle = 'rgba(214, 120, 110, 0.45)';
    ctx.beginPath();
    ctx.ellipse(ex - 7, hy + 3, 3.2, 2, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + 7, hy + 3, 3.2, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = o.hair;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - 6.2, hy - 5.2);
    ctx.quadraticCurveTo(ex - 3.2, hy - 6.4, ex - 0.6, hy - 5);
    ctx.moveTo(ex + 0.6, hy - 5);
    ctx.quadraticCurveTo(ex + 3.2, hy - 6.4, ex + 6.2, hy - 5.2);
    ctx.stroke();

    ctx.fillStyle = '#fffaf6';
    ctx.beginPath();
    ctx.ellipse(ex - 3.3, hy - 1.2, 2.5, 3.1, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + 3.3, hy - 1.2, 2.5, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a211c';
    ctx.beginPath();
    ctx.ellipse(ex - 2.7 + face * 0.4, hy - 0.8, 1.35, 1.7, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + 3.9 + face * 0.4, hy - 0.8, 1.35, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ex - 3.4, hy - 2.1, 1.1, 1.1);
    ctx.fillRect(ex + 2.8, hy - 2.1, 1.1, 1.1);

    ctx.fillStyle = o.skinLo;
    ctx.beginPath();
    ctx.moveTo(ex, hy + 1.2);
    ctx.quadraticCurveTo(ex + face * 1.6, hy + 3.6, ex - face * 0.4, hy + 4.2);
    ctx.quadraticCurveTo(ex - face * 1.2, hy + 2.4, ex, hy + 1.2);
    ctx.fill();

    ctx.strokeStyle = '#a85a52';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(ex, hy + 5.2, 3.1, 0.18, Math.PI - 0.18);
    ctx.stroke();
    ctx.strokeStyle = '#fff6f2';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(ex, hy + 4.6, 2.2, 0.35, Math.PI - 0.35);
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

    const hip = 68 + bob;
    const shoulder = hip - 22;
    const headR = 15;
    const headX = cx + face * (front ? 4 : 1);
    const headY = 28 + bob;
    const sleeve = o.clothes === 'suit' ? o.pants : o.shirt;
    const sleeveHi = o.clothes === 'suit' ? '#4a5160' : o.shirtHi;
    const sleeveLo = o.clothes === 'suit' ? o.pantsLo : o.shirtLo;

    const drawLeg = (side: number, phase: number, color: string, hi: string, lo: string) => {
        const x = cx + side * 6 + face;
        const y = hip + phase * 2;
        const h = 24 - Math.abs(phase);
        capsule(ctx, x - 4.2, y, 8.4, h, color, hi, lo);
        ctx.fillStyle = lo;
        ctx.beginPath();
        ctx.ellipse(x + face * 2.2, y + h, 5.4, 2.8, face * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.shoe;
        ctx.beginPath();
        ctx.ellipse(x + face * 2.4, y + h - 0.4, 5, 2.5, face * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.ellipse(x + face * 1.2, y + h - 1.2, 2.1, 1, 0, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawArm = (side: number, phase: number) => {
        const x = cx + side * 11 + face;
        const swing = phase * 4;
        capsule(ctx, x - 3.2, shoulder + swing, 6.6, 16, sleeve, sleeveHi, sleeveLo);
        if (o.clothes === 'suit') {
            ctx.fillStyle = o.shirt;
            ctx.fillRect(x - 3, shoulder + 12 + swing, 6, 3);
        }
        const hand = ctx.createRadialGradient(x - 1, shoulder + 16 + swing, 1, x, shoulder + 18 + swing, 4);
        hand.addColorStop(0, o.skinHi);
        hand.addColorStop(1, o.skinLo);
        ctx.fillStyle = hand;
        ctx.beginPath();
        ctx.arc(x, shoulder + 17 + swing, 3.3, 0, Math.PI * 2);
        ctx.fill();
    };

    const far = -face;
    const near = face;
    if (o.clothes !== 'dress') {
        drawLeg(far, -step, o.pants, o.pants, o.pantsLo);
        drawLeg(near, step, o.pants, o.pants, o.pantsLo);
    }
    drawArm(far, step);

    if (o.clothes === 'dress') {
        drawLeg(far, -step, o.skin, o.skinHi, o.skinLo);
        drawLeg(near, step, o.skin, o.skinHi, o.skinLo);
        const skirt = ctx.createLinearGradient(cx - 14, hip - 18, cx + 14, hip + 6);
        skirt.addColorStop(0, o.shirtLo);
        skirt.addColorStop(0.35, o.shirtHi);
        skirt.addColorStop(1, o.shirt);
        ctx.fillStyle = skirt;
        ctx.beginPath();
        ctx.moveTo(cx - 10, hip - 20);
        ctx.quadraticCurveTo(cx, hip - 24, cx + 10, hip - 20);
        ctx.lineTo(cx + 15, hip + 6);
        ctx.quadraticCurveTo(cx, hip + 10, cx - 15, hip + 6);
        ctx.closePath();
        ctx.fill();
    }

    const topW = o.clothes === 'suit' ? 20 : 18;
    const botW = o.clothes === 'dress' ? 16 : 22;
    const ty = shoulder - 4;
    const tb = hip - 2;
    const skew = face * 1.4;
    const torsoColor = o.clothes === 'suit' ? o.pants : o.shirt;
    const torsoHi = o.clothes === 'suit' ? '#3c4454' : o.shirtHi;
    const torsoLo = o.clothes === 'suit' ? o.pantsLo : o.shirtLo;
    const tg = ctx.createLinearGradient(cx - topW, ty, cx + topW, tb);
    tg.addColorStop(0, torsoLo);
    tg.addColorStop(0.32, torsoHi);
    tg.addColorStop(1, torsoColor);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2 + skew, ty + 3);
    ctx.quadraticCurveTo(cx + skew, ty - 2, cx + topW / 2 + skew, ty + 3);
    ctx.lineTo(cx + botW / 2, tb);
    ctx.quadraticCurveTo(cx, tb + 4, cx - botW / 2, tb);
    ctx.closePath();
    ctx.fill();

    if (o.clothes === 'suit') {
        ctx.fillStyle = o.shirt;
        ctx.beginPath();
        ctx.moveTo(cx - 4 + skew, ty + 3);
        ctx.lineTo(cx + 4 + skew, ty + 3);
        ctx.lineTo(cx + 1, tb - 2);
        ctx.lineTo(cx - 1, tb - 2);
        ctx.fill();
        ctx.fillStyle = '#9a2430';
        ctx.beginPath();
        ctx.moveTo(cx - 1.2, ty + 6);
        ctx.lineTo(cx + 1.2, ty + 6);
        ctx.lineTo(cx + 0.4, ty + 16);
        ctx.lineTo(cx - 0.4, ty + 16);
        ctx.fill();
        ctx.fillStyle = '#e6c56a';
        ctx.beginPath();
        ctx.arc(cx, ty + 12, 1.3, 0, Math.PI * 2);
        ctx.fill();
    } else if (o.clothes === 'casual') {
        ctx.strokeStyle = o.shirtLo;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx + skew * 0.3, ty + 4);
        ctx.lineTo(cx, tb - 2);
        ctx.stroke();
    }

    drawArm(near, -step);

    const neck = ctx.createLinearGradient(cx - 4, shoulder - 8, cx + 4, shoulder);
    neck.addColorStop(0, o.skinLo);
    neck.addColorStop(0.5, o.skin);
    neck.addColorStop(1, o.skinLo);
    ctx.fillStyle = neck;
    ctx.fillRect(cx - 3 + face, shoulder - 8, 6, 8);

    if (o.clothes !== 'dress') {
        ctx.fillStyle = '#f7f4ee';
        ctx.beginPath();
        ctx.moveTo(cx - 5, shoulder - 2);
        ctx.lineTo(cx, shoulder + 3);
        ctx.lineTo(cx + 5, shoulder - 2);
        ctx.fill();
    }

    if (front) {
        ctx.fillStyle = o.skinLo;
        ctx.beginPath();
        ctx.ellipse(headX - face * (headR - 1), headY + 2, 2.6, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.skin;
        ctx.beginPath();
        ctx.ellipse(headX - face * (headR - 2), headY + 2, 1.6, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    if (!front || o.hairStyle === 'bob' || o.hairStyle === 'updo') {
        drawHair(ctx, o, headX, headY, headR, false, face);
    }

    const grd = ctx.createRadialGradient(headX - 5, headY - 6, 2, headX + 3, headY + 3, headR + 2);
    grd.addColorStop(0, o.skinHi);
    grd.addColorStop(0.55, o.skin);
    grd.addColorStop(1, o.skinLo);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 48, 32, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (!front) {
        ctx.fillStyle = o.hair;
        ctx.beginPath();
        ctx.ellipse(headX, headY - 1, headR + 2.2, headR + 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.skinLo;
        ctx.beginPath();
        ctx.ellipse(headX, headY + headR - 3, 4.2, 2.6, 0, 0, Math.PI);
        ctx.fill();
    }

    drawHair(ctx, o, headX, headY, headR, front, face);

    if (front) drawFace(ctx, o, headX, headY, face);
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

                    const portrait = document.createElement('canvas');
                    portrait.width = 48;
                    portrait.height = 56;
                    const pctx = portrait.getContext('2d')!;
                    pctx.imageSmoothingEnabled = true;
                    pctx.drawImage(canvas, 12, 0, 48, 58, 0, 0, 48, 56);
                    addCanvas(scene, `portrait_${id}`, portrait);
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
