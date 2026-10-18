// Original isometric people in a late-90s life-sim style.
// Big heads, chunky clothes, a real walk stride, and a green mood crystal.
// Every shape is drawn here. Nothing is traced from a life-sim sprite sheet.

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

type HairStyle = 'short' | 'bob' | 'slick' | 'updo' | 'curly' | 'crop';
type Clothes = 'casual' | 'dress' | 'suit' | 'skirt';
type Build = 'slim' | 'broad';

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
    hairStyle: HairStyle;
    clothes: Clothes;
    build: Build;
    glasses?: boolean;
    shades?: boolean;
}

const OUTFITS: Record<string, Outfit> = {
    avatar_player: {
        skin: '#f0c3a0', skinHi: '#ffe0c4', skinLo: '#d39a78',
        hair: '#6b3e22', hairHi: '#a56a3c',
        shirt: '#f4f1ea', shirtHi: '#ffffff', shirtLo: '#c9c3b6',
        pants: '#3d6eb5', pantsLo: '#2a4f86',
        shoe: '#f7f7f5',
        hairStyle: 'short', clothes: 'casual', build: 'slim',
    },
    avatar_ai_male: {
        skin: '#e0a67e', skinHi: '#f3c6a2', skinLo: '#c48462',
        hair: '#241c18', hairHi: '#4e4036',
        shirt: '#d24a3a', shirtHi: '#f07a68', shirtLo: '#9c3024',
        pants: '#c4a36a', pantsLo: '#8f7040',
        shoe: '#5c4030',
        hairStyle: 'crop', clothes: 'casual', build: 'broad',
    },
    avatar_ai_female: {
        skin: '#f3c6a4', skinHi: '#ffe0c8', skinLo: '#d9a484',
        hair: '#e2b15a', hairHi: '#ffe09a',
        shirt: '#3aa8a0', shirtHi: '#7fe0d4', shirtLo: '#1d6e68',
        pants: '#2c2c34', pantsLo: '#16161c',
        shoe: '#f2efe8',
        hairStyle: 'bob', clothes: 'skirt', build: 'slim',
    },
    avatar_ai_vip: {
        skin: '#c98b62', skinHi: '#e4b08a', skinLo: '#a86c48',
        hair: '#1a1614', hairHi: '#5a4c40',
        shirt: '#f7f4ee', shirtHi: '#ffffff', shirtLo: '#d4cdc2',
        pants: '#1c1e24', pantsLo: '#0c0e12',
        shoe: '#111111',
        hairStyle: 'slick', clothes: 'suit', build: 'broad',
        glasses: true,
    },
    avatar_showgirl: {
        skin: '#f6c8aa', skinHi: '#ffe4cc', skinLo: '#e0a888',
        hair: '#f0d070', hairHi: '#fff0b8',
        shirt: '#e23b4a', shirtHi: '#ff8a90', shirtLo: '#a41e2e',
        pants: '#ffd0d4', pantsLo: '#c45460',
        shoe: '#f4efe6',
        hairStyle: 'updo', clothes: 'dress', build: 'slim',
    },
    avatar_gigi: {
        skin: '#e8b090', skinHi: '#f8d0b4', skinLo: '#c88868',
        hair: '#4a2418', hairHi: '#7a4030',
        shirt: '#d4548a', shirtHi: '#f090b4', shirtLo: '#9a3060',
        pants: '#ffe0ea', pantsLo: '#c46888',
        shoe: '#f6f1ea',
        hairStyle: 'updo', clothes: 'dress', build: 'slim',
    },
    avatar_bouncer: {
        skin: '#8d5a3c', skinHi: '#b07858', skinLo: '#6a402c',
        hair: '#1a120e', hairHi: '#3a2c24',
        shirt: '#20242c', shirtHi: '#3a4250', shirtLo: '#101218',
        pants: '#2a241c', pantsLo: '#16120e',
        shoe: '#0e0e0e',
        hairStyle: 'crop', clothes: 'casual', build: 'broad',
        shades: true,
    },
    avatar_town_riley: {
        skin: '#f6d0b4', skinHi: '#fff0e0', skinLo: '#e0b090',
        hair: '#8a4e28', hairHi: '#c4844c',
        shirt: '#3d8a4a', shirtHi: '#7ec87a', shirtLo: '#246030',
        pants: '#d9d2c4', pantsLo: '#b0a894',
        shoe: '#f4f1ea',
        hairStyle: 'curly', clothes: 'casual', build: 'slim',
    },
    avatar_town_casey: {
        skin: '#c98460', skinHi: '#e8aa84', skinLo: '#a86848',
        hair: '#1c1418', hairHi: '#4a3840',
        shirt: '#ee6a9a', shirtHi: '#ffb0c8', shirtLo: '#c04070',
        pants: '#3a3e48', pantsLo: '#22262e',
        shoe: '#f7f4ee',
        hairStyle: 'bob', clothes: 'skirt', build: 'slim',
    },
    avatar_town_jordan: {
        skin: '#e8b898', skinHi: '#ffd8bc', skinLo: '#cc9474',
        hair: '#a84828', hairHi: '#e08050',
        shirt: '#2a3e78', shirtHi: '#5a78b0', shirtLo: '#182448',
        pants: '#f2f0ea', pantsLo: '#c8c4ba',
        shoe: '#6a4a32',
        hairStyle: 'short', clothes: 'casual', build: 'broad',
    },
    avatar_town_taylor: {
        skin: '#6e442e', skinHi: '#946848', skinLo: '#4e2e1e',
        hair: '#140e0c', hairHi: '#3a2a22',
        shirt: '#f0c040', shirtHi: '#ffe088', shirtLo: '#c08820',
        pants: '#2a3a6a', pantsLo: '#182444',
        shoe: '#f0ece4',
        hairStyle: 'curly', clothes: 'casual', build: 'broad',
    },
    avatar_town_sam: {
        skin: '#d8a888', skinHi: '#f0c8ac', skinLo: '#b88868',
        hair: '#8d6238', hairHi: '#e6c48a',
        shirt: '#b9a0e0', shirtHi: '#e4d6ff', shirtLo: '#8870b8',
        pants: '#6a6e76', pantsLo: '#454850',
        shoe: '#f6f3ec',
        hairStyle: 'slick', clothes: 'casual', build: 'slim',
    },
};

const INK = 'rgba(42, 24, 16, 0.42)';

function ink(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.15;
    ctx.lineJoin = 'round';
    ctx.stroke();
}

function capsule(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    fill: string, hi: string, lo: string,
): void {
    const r = Math.min(w / 2, 8);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, hi);
    g.addColorStop(0.45, fill);
    g.addColorStop(1, lo);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
    ink(ctx);
}

function hairCap(ctx: CanvasRenderingContext2D, hx: number, hy: number, hr: number): void {
    ctx.beginPath();
    ctx.ellipse(hx, hy - 1, hr + 1.4, hr + 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ink(ctx);
}

function drawHair(
    ctx: CanvasRenderingContext2D,
    o: Outfit,
    hx: number, hy: number, hr: number,
    front: boolean,
    face: number,
): void {
    ctx.fillStyle = o.hair;
    if (!front) {
        if (o.hairStyle === 'crop') {
            ctx.fillStyle = o.skin;
            ctx.beginPath();
            ctx.arc(hx, hy, hr, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = o.skinLo;
            ctx.beginPath();
            ctx.ellipse(hx - hr + 1, hy + 2, 3, 4, 0, 0, Math.PI * 2);
            ctx.ellipse(hx + hr - 1, hy + 2, 3, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = o.hair;
            ctx.beginPath();
            ctx.ellipse(hx, hy - hr * 0.42, hr * 1.02, hr * 0.55, 0, Math.PI, Math.PI * 2);
            ctx.fill();
        } else if (o.hairStyle === 'curly') {
            // Puffs only — a cap underneath reads as a smooth helmet from behind.
            ctx.fillStyle = o.hair;
            const puffs: Array<[number, number, number]> = [
                [0, 1, hr * 0.72],
                [-12, 2, 7.2], [12, 2, 7.2],
                [0, -hr * 0.62, 7],
                [-7, -hr * 0.95, 5.8], [7, -hr * 0.88, 5.8],
                [-7, hr * 0.52, 5.2], [7, hr * 0.48, 5.2],
            ];
            for (const [dx, dy, r] of puffs) {
                ctx.beginPath();
                ctx.arc(hx + dx, hy + dy, r, 0, Math.PI * 2);
                ctx.fill();
                ink(ctx);
            }
        } else if (o.hairStyle === 'slick') {
            hairCap(ctx, hx, hy, hr);
            ctx.fillStyle = o.hair;
            ctx.beginPath();
            ctx.ellipse(hx - hr * 0.95, hy + 5, 5, 9, 0.2, 0, Math.PI * 2);
            ctx.ellipse(hx + hr * 0.95, hy + 5, 5, 9, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ink(ctx);
            ctx.strokeStyle = o.hairHi;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(hx - 1, hy - hr * 0.7);
            ctx.quadraticCurveTo(hx + 7, hy - 1, hx + 3, hy + hr * 0.4);
            ctx.stroke();
        } else {
            hairCap(ctx, hx, hy, hr);
        }
        if (o.hairStyle === 'bob') {
            ctx.fillStyle = o.hair;
            ctx.beginPath();
            ctx.ellipse(hx, hy + 8, hr + 2, 14, 0, 0, Math.PI);
            ctx.fill();
        } else if (o.hairStyle === 'updo') {
            ctx.fillStyle = o.hair;
            ctx.beginPath();
            ctx.ellipse(hx, hy - hr - 1, 6.5, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = o.shirt;
            ctx.beginPath();
            ctx.ellipse(hx + 7, hy - hr + 1, 3.4, 2.2, 0.4, 0, Math.PI * 2);
            ctx.ellipse(hx + 7, hy - hr + 5, 3.4, 2.2, -0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = o.hairHi;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(hx - hr * 0.45, hy - hr * 0.72, hr * 0.7, 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = o.skinLo;
        ctx.beginPath();
        ctx.ellipse(hx, hy + hr - 2, 4.6, 3, 0, 0, Math.PI);
        ctx.fill();
        return;
    }

    if (o.hairStyle === 'short' || o.hairStyle === 'crop' || o.hairStyle === 'slick') {
        const squat = o.hairStyle === 'crop' ? 0.42 : o.hairStyle === 'slick' ? 0.62 : 0.78;
        ctx.beginPath();
        ctx.ellipse(hx + face, hy - hr * 0.28, hr * 1.05, hr * squat, face * -0.08, Math.PI * 0.95, Math.PI * 2.05);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.beginPath();
        ctx.ellipse(hx - 4, hy - hr * 0.62, hr * 0.36, 2.2, -0.5, 0, Math.PI * 2);
        ctx.fill();
    } else if (o.hairStyle === 'bob') {
        ctx.beginPath();
        ctx.ellipse(hx - hr * 0.72, hy + 4, 5.5, 12, face * 0.15, 0, Math.PI * 2);
        ctx.ellipse(hx + hr * 0.72, hy + 4, 5.5, 12, face * -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.35, hr * 1.05, hr * 0.55, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.hairHi;
        ctx.beginPath();
        ctx.ellipse(hx - 5, hy - hr * 0.55, 4.5, 2.4, -0.6, 0, Math.PI * 2);
        ctx.fill();
    } else if (o.hairStyle === 'curly') {
        const puffs: Array<[number, number, number]> = [
            [-8, -2, 5.2], [8, -1, 5.2], [0, -hr * 0.62, 5.5],
            [-5, -hr * 0.9, 4.2], [5, -hr * 0.85, 4.2],
        ];
        for (const [dx, dy, r] of puffs) {
            ctx.beginPath();
            ctx.arc(hx + dx, hy + dy, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = o.hairHi;
        ctx.beginPath();
        ctx.arc(hx - 3, hy - hr * 0.75, 2.2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.ellipse(hx, hy - hr * 0.2, hr + 1, hr * 0.72, 0, Math.PI * 0.85, Math.PI * 2.15);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx + 1, hy - hr - 1, 6.2, 5.6, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.shirt;
        ctx.beginPath();
        ctx.ellipse(hx + 8, hy - hr + 2, 3.6, 2.3, 0.5, 0, Math.PI * 2);
        ctx.ellipse(hx + 8, hy - hr + 6, 3.6, 2.3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.shirtHi;
        ctx.beginPath();
        ctx.ellipse(hx + 7, hy - hr + 3, 1.4, 1, 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFace(
    ctx: CanvasRenderingContext2D,
    o: Outfit,
    hx: number, hy: number,
    face: number,
): void {
    const ex = hx + face * 1.5;
    const look = face * 0.7;

    ctx.fillStyle = 'rgba(210, 110, 100, 0.4)';
    ctx.beginPath();
    ctx.ellipse(ex - 7, hy + 4, 3.4, 2.1, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + 7, hy + 4, 3.4, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = o.hair;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - 7.2, hy - 6.4);
    ctx.quadraticCurveTo(ex - 4, hy - 8, ex - 1, hy - 6.2);
    ctx.moveTo(ex + 1, hy - 6.2);
    ctx.quadraticCurveTo(ex + 4, hy - 8, ex + 7.2, hy - 6.4);
    ctx.stroke();

    ctx.fillStyle = '#fffaf6';
    ctx.beginPath();
    ctx.ellipse(ex - 3.6, hy - 1.4, 2.7, 3.3, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + 3.6, hy - 1.4, 2.7, 3.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 36, 28, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = '#241c18';
    ctx.beginPath();
    ctx.ellipse(ex - 3.2 + look, hy - 0.8, 1.45, 1.85, 0, 0, Math.PI * 2);
    ctx.ellipse(ex + 4.0 + look, hy - 0.8, 1.45, 1.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ex - 3.6 + look, hy - 2.2, 1.2, 1.2);
    ctx.fillRect(ex + 3.4 + look, hy - 2.2, 1.2, 1.2);

    ctx.fillStyle = o.skinLo;
    ctx.beginPath();
    ctx.moveTo(ex + face * 0.4, hy + 1.4);
    ctx.quadraticCurveTo(ex + face * 2.2, hy + 3.8, ex + face * 0.2, hy + 4.6);
    ctx.quadraticCurveTo(ex - face * 1.4, hy + 3.2, ex + face * 0.4, hy + 1.4);
    ctx.fill();

    ctx.strokeStyle = '#a85a52';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ex, hy + 6.4, 3.4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 246, 242, 0.9)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(ex, hy + 5.6, 2.3, 0.4, Math.PI - 0.4);
    ctx.stroke();

    if (o.glasses) {
        ctx.strokeStyle = '#e6c56a';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.ellipse(ex - 3.6, hy - 1.2, 4.6, 3.6, 0, 0, Math.PI * 2);
        ctx.ellipse(ex + 3.6, hy - 1.2, 4.6, 3.6, 0, 0, Math.PI * 2);
        ctx.moveTo(ex - 0.2, hy - 1.2);
        ctx.lineTo(ex + 0.2, hy - 1.2);
        ctx.moveTo(ex - 8.2, hy - 1.4);
        ctx.lineTo(ex - 11, hy - 2.2);
        ctx.moveTo(ex + 8.2, hy - 1.4);
        ctx.lineTo(ex + 11, hy - 2.2);
        ctx.stroke();
    }

    if (o.shades) {
        ctx.fillStyle = '#14181e';
        ctx.beginPath();
        ctx.roundRect(ex - 9.2, hy - 4.2, 8.2, 5.4, 1.4);
        ctx.roundRect(ex + 1, hy - 4.2, 8.2, 5.4, 1.4);
        ctx.fill();
        ctx.fillStyle = '#c8d4e0';
        ctx.globalAlpha = 0.45;
        ctx.fillRect(ex - 7.6, hy - 3.4, 2.2, 1.2);
        ctx.fillRect(ex + 2.4, hy - 3.4, 2.2, 1.2);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#0c0e12';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ex - 1, hy - 1.6);
        ctx.lineTo(ex + 1, hy - 1.6);
        ctx.stroke();
    }
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
    const phase = [1, 0.35, -1, -0.35][frame];
    const bob = frame % 2 === 1 ? -2.5 : 0;
    const broad = o.build === 'broad';

    const hip = 68 + bob;
    const shoulder = hip - 24;
    const headR = 15.5;
    const headX = cx + face * (front ? 3.5 : 0.5);
    const headY = 30 + bob;
    const legSpread = broad ? 6.2 : 5.2;
    const armSpread = broad ? 16 : 14;

    const sleeve = o.clothes === 'suit' ? o.pants : o.shirt;
    const sleeveHi = o.clothes === 'suit' ? '#4a5468' : o.shirtHi;
    const sleeveLo = o.clothes === 'suit' ? o.pantsLo : o.shirtLo;
    const legFill = o.clothes === 'dress' || o.clothes === 'skirt' ? o.skin : o.pants;
    const legHi = o.clothes === 'dress' || o.clothes === 'skirt' ? o.skinHi : o.pants;
    const legLo = o.clothes === 'dress' || o.clothes === 'skirt' ? o.skinLo : o.pantsLo;

    const drawLeg = (side: number, legPhase: number) => {
        const x = cx + side * legSpread + face * 0.8;
        const angle = face * legPhase * 0.48;
        const lift = legPhase < 0 ? -5 : 0;
        const shoePad = o.clothes === 'dress' ? 4.2 : 2.2;
        // Length is solved from the hip so a planted shoe lands on y=95.
        // The trailing foot uses the same length, then shifts up.
        const len = Math.max(14, (95 - hip - shoePad) / Math.cos(Math.abs(angle)));
        ctx.save();
        ctx.translate(x, hip + lift);
        ctx.rotate(angle);
        capsule(ctx, -4.3, 0, 8.6, len, legFill, legHi, legLo);
        ctx.fillStyle = '#241c16';
        ctx.beginPath();
        ctx.ellipse(0.5, len + 0.4, 5.3, 1.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = o.shoe;
        ctx.beginPath();
        ctx.ellipse(0.4, len - 1.1, 5.1, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ink(ctx);
        if (o.clothes === 'dress') {
            ctx.fillStyle = o.shoe;
            ctx.fillRect(-1.1, len - 1, 2.1, 5.2);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(-0.8, len - 1.8, 2, 1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    const drawArm = (side: number, armPhase: number) => {
        const x = cx + side * armSpread + face * 0.6;
        // Front views swing wide. From behind, that same mirror claps both
        // hands onto the spine, so the back swing stays on its own side.
        const angle = front
            ? face * armPhase * 0.95
            : -side * 0.36 + face * armPhase * 0.2;
        const lift = front ? 0 : -armPhase * 3.5;
        ctx.save();
        ctx.translate(x, shoulder + 2 + lift);
        ctx.rotate(angle);
        capsule(ctx, -3.3, 0, 6.6, 16, sleeve, sleeveHi, sleeveLo);
        if (o.clothes === 'suit') {
            ctx.fillStyle = o.shirt;
            ctx.fillRect(-3.1, 11, 6.2, 3);
        }
        const hx = 0;
        const hy = 16.5;
        const hand = ctx.createRadialGradient(hx - 1, hy - 1, 1, hx, hy, 4);
        hand.addColorStop(0, o.skinHi);
        hand.addColorStop(1, o.skinLo);
        ctx.fillStyle = hand;
        ctx.beginPath();
        ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ink(ctx);
        ctx.restore();
    };

    const far = -face;
    const near = face;
    drawLeg(far, -phase);
    drawLeg(near, phase);
    if (front) drawArm(far, phase);

    const topW = broad ? 22 : 17;
    const botW = o.clothes === 'dress' ? 14 : broad ? 18 : 15;
    const ty = o.clothes === 'skirt' ? shoulder - 2 : shoulder - 3;
    const tb = o.clothes === 'skirt' ? hip - 8 : hip - 1;
    const skew = face * 2.2;
    const torsoColor = o.clothes === 'suit' ? o.pants : o.shirt;
    const torsoHi = o.clothes === 'suit' ? '#3a4458' : o.shirtHi;
    const torsoLo = o.clothes === 'suit' ? o.pantsLo : o.shirtLo;

    ctx.beginPath();
    ctx.moveTo(cx - face * 2 + skew, ty + 3);
    ctx.lineTo(cx - face * (topW * 0.55) + skew * 0.3, ty + 7);
    ctx.lineTo(cx - face * (botW * 0.62), tb);
    ctx.lineTo(cx - face * 1, tb - 1);
    ctx.closePath();
    ctx.fillStyle = torsoLo;
    ctx.fill();
    ink(ctx);

    const tg = ctx.createLinearGradient(cx - face * topW, ty, cx + face * topW, tb);
    tg.addColorStop(0, face > 0 ? torsoLo : torsoHi);
    tg.addColorStop(0.42, torsoHi);
    tg.addColorStop(1, torsoColor);
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(cx - topW / 2 + skew, ty + 4);
    ctx.quadraticCurveTo(cx + skew * 0.3, ty - 2, cx + topW / 2 + skew, ty + 5);
    ctx.lineTo(cx + botW / 2, tb);
    ctx.quadraticCurveTo(cx, tb + 4, cx - botW / 2, tb);
    ctx.closePath();
    ctx.fill();
    ink(ctx);

    if (o.clothes === 'suit') {
        ctx.fillStyle = o.shirt;
        ctx.beginPath();
        ctx.moveTo(cx - 5 + skew, ty + 4);
        ctx.lineTo(cx + 5 + skew, ty + 5);
        ctx.lineTo(cx + 2, tb - 1);
        ctx.lineTo(cx - 2, tb - 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = o.shirtHi;
        ctx.beginPath();
        ctx.moveTo(cx - 5 + skew, ty + 4);
        ctx.lineTo(cx - 1, ty + 16);
        ctx.lineTo(cx + 1, ty + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#9a2430';
        ctx.beginPath();
        ctx.moveTo(cx - 1.3, ty + 7);
        ctx.lineTo(cx + 1.3, ty + 7);
        ctx.lineTo(cx + 0.6, tb - 2);
        ctx.lineTo(cx - 0.6, tb - 2);
        ctx.fill();
        ctx.fillStyle = '#e6c56a';
        ctx.beginPath();
        ctx.arc(cx, ty + 14, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f7f4ee';
        ctx.fillRect(cx + face * 5, ty + 10, 4, 3);
    } else if (o.clothes === 'casual' || o.clothes === 'skirt') {
        ctx.strokeStyle = o.shirtLo;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cx + skew * 0.2, ty + 5);
        ctx.lineTo(cx, tb - 2);
        ctx.stroke();
        ctx.fillStyle = o.shirtLo;
        ctx.beginPath();
        ctx.arc(cx - 1.2, ty + 9, 0.9, 0, Math.PI * 2);
        ctx.arc(cx - 0.6, ty + 13, 0.9, 0, Math.PI * 2);
        ctx.fill();
    }

    if (o.clothes === 'dress' || o.clothes === 'skirt') {
        const hem = o.clothes === 'dress' ? hip + 10 : hip + 16;
        const flare = o.clothes === 'dress' ? 16 : 14;
        const skirt = ctx.createLinearGradient(cx - flare, hip - 10, cx + flare, hem);
        skirt.addColorStop(0, o.clothes === 'dress' ? o.shirtLo : o.pantsLo);
        skirt.addColorStop(0.35, o.clothes === 'dress' ? o.shirtHi : o.pants);
        skirt.addColorStop(1, o.clothes === 'dress' ? o.shirt : o.pants);
        ctx.fillStyle = skirt;
        ctx.beginPath();
        ctx.moveTo(cx - topW * 0.42, hip - 12);
        ctx.quadraticCurveTo(cx, hip - 16, cx + topW * 0.42, hip - 12);
        ctx.lineTo(cx + flare, hem);
        ctx.quadraticCurveTo(cx, hem + 4, cx - flare, hem);
        ctx.closePath();
        ctx.fill();
        ink(ctx);
        ctx.strokeStyle = o.clothes === 'dress' ? o.pants : o.shirtHi;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - flare + 1, hem - 1);
        ctx.quadraticCurveTo(cx, hem + 3, cx + flare - 1, hem - 1);
        ctx.stroke();
    } else {
        ctx.fillStyle = o.pantsLo;
        ctx.fillRect(cx - botW * 0.42, hip - 3, botW * 0.84, 3.2);
        ctx.fillStyle = '#e6c56a';
        ctx.fillRect(cx - 1.3, hip - 3.2, 2.6, 2.4);
    }

    if (o.clothes === 'dress') {
        ctx.fillStyle = '#e6c56a';
        ctx.beginPath();
        ctx.ellipse(cx + face, shoulder + 2, 2.2, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawArm(near, -phase);
    if (!front) drawArm(far, phase);

    const neck = ctx.createLinearGradient(cx - 4, shoulder - 10, cx + 4, shoulder);
    neck.addColorStop(0, o.skinLo);
    neck.addColorStop(0.45, o.skinHi);
    neck.addColorStop(1, o.skinLo);
    ctx.fillStyle = neck;
    ctx.beginPath();
    ctx.moveTo(cx - 3.5 + face, shoulder - 8);
    ctx.lineTo(cx + 3.5 + face, shoulder - 8);
    ctx.lineTo(cx + 4.5, shoulder + 1);
    ctx.lineTo(cx - 4.5, shoulder + 1);
    ctx.closePath();
    ctx.fill();

    if (o.clothes !== 'dress') {
        ctx.fillStyle = o.shirtHi;
        ctx.beginPath();
        ctx.moveTo(cx - 6, shoulder - 1);
        ctx.lineTo(cx, shoulder + 4);
        ctx.lineTo(cx + 6, shoulder - 1);
        ctx.closePath();
        ctx.fill();
        ink(ctx);
    }

    if (front) {
        ctx.fillStyle = o.skinLo;
        ctx.beginPath();
        ctx.ellipse(headX - face * (headR - 0.5), headY + 2, 3.1, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ink(ctx);
        ctx.fillStyle = o.skin;
        ctx.beginPath();
        ctx.ellipse(headX - face * (headR - 1.4), headY + 2.2, 1.6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    if (!front) {
        drawHair(ctx, o, headX, headY, headR, false, face);
        return;
    }

    const grd = ctx.createRadialGradient(headX - 6, headY - 7, 2, headX + 2, headY + 2, headR + 1);
    grd.addColorStop(0, o.skinHi);
    grd.addColorStop(0.62, o.skin);
    grd.addColorStop(1, o.skinLo);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ink(ctx);

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(headX - 5, headY - 8, 4.5, 2.6, -0.6, 0, Math.PI * 2);
    ctx.fill();

    drawHair(ctx, o, headX, headY, headR, true, face);
    drawFace(ctx, o, headX, headY, face);
}

function paintCrystal(ctx: CanvasRenderingContext2D, squash: number, flip: boolean): void {
    const w = 36;
    const h = 48;
    const cx = w / 2;
    const cy = 20;
    const hw = Math.max(1.6, 11 * squash);
    ctx.clearRect(0, 0, w, h);
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
                    pctx.drawImage(canvas, 12, 8, 48, 56, 0, 0, 48, 56);
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
