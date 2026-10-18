// Original isometric furniture. Chunky, brightly colored, lit from the upper left.

import type Phaser from 'phaser';
import type { Pt } from './iso';
import { box, cylinder, disc, hex, poly, project, scale, shadow } from './draw3d';

export interface PropOrigin {
    x: number;
    y: number;
}

const origins = new Map<string, PropOrigin>();

export function propOrigin(key: string): PropOrigin {
    return origins.get(key) ?? { x: 0.5, y: 0.8 };
}

function bake(
    scene: Phaser.Scene,
    key: string,
    draw: (ctx: CanvasRenderingContext2D, ground: Pt) => void,
): void {
    if (scene.textures.exists(key) && origins.has(key)) return;
    const w = 760;
    const h = 580;
    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const ctx = src.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    const ground = { x: 380, y: 440 };
    draw(ctx, ground);

    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 6) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < minX) return;
    const pad = 2;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    out.getContext('2d')!.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, out);
    origins.set(key, {
        x: (ground.x - minX) / cw,
        y: (ground.y - minY) / ch,
    });
}

function screenOnFace(
    ground: Pt,
    ax: number, ay: number,
    bx: number, by: number,
    lift: number,
): Pt {
    return project(ground, (ax + bx) / 2, (ay + by) / 2, lift);
}

/** A short cylinder whose base sits at `base` instead of on the floor. */
function peg(
    ctx: CanvasRenderingContext2D,
    g: Pt,
    x: number, y: number,
    base: number, h: number, r: number,
    side: string, top: string,
): void {
    const rx = Math.max(0.6, r * 1.131);
    const ry = Math.max(0.4, r * 0.566);
    const b = project(g, x, y, base);
    const t = project(g, x, y, base + h);
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(t.x - rx, t.y);
    ctx.lineTo(b.x - rx, b.y);
    ctx.lineTo(b.x + rx, b.y);
    ctx.lineTo(t.x + rx, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = top;
    ctx.fill();
}

function slab(
    ctx: CanvasRenderingContext2D,
    g: Pt,
    x: number, y: number, w: number, d: number,
    lift: number, fill: string,
): void {
    poly(ctx, [
        project(g, x, y, lift),
        project(g, x + w, y, lift),
        project(g, x + w, y + d, lift),
        project(g, x, y + d, lift),
    ], fill);
}

function stool(ctx: CanvasRenderingContext2D, g: Pt, x: number, y: number, seat: string): void {
    cylinder(ctx, g, x, y, 1.7, 15, '#8e949c', '#e8eef2');
    disc(ctx, g, x, y, 5.4, 5, '#c5ccd2');
    disc(ctx, g, x, y, 7.4, 15, '#5a3824');
    disc(ctx, g, x, y, 6.4, 17, seat);
    disc(ctx, g, x, y, 2.6, 18, '#ffe6c4');
}

function chipStack(
    ctx: CanvasRenderingContext2D,
    g: Pt, x: number, y: number,
    color: string, n: number, base: number,
): void {
    for (let i = 0; i < n; i++) disc(ctx, g, x, y, 4.4, base + i * 2.2, color);
    disc(ctx, g, x, y, 4.4, base + n * 2.2, '#fff4cc');
}

function playingCard(
    ctx: CanvasRenderingContext2D,
    g: Pt, x: number, y: number,
    lift: number, label: string, red: boolean,
): void {
    const p = project(g, x, y, lift);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(red ? -0.28 : 0.22);
    ctx.fillStyle = '#f7f4ee';
    ctx.fillRect(-6, -8, 12, 16);
    ctx.strokeStyle = '#c8bfb0';
    ctx.lineWidth = 1;
    ctx.strokeRect(-6, -8, 12, 16);
    ctx.fillStyle = red ? '#d23b3b' : '#1c2430';
    ctx.font = 'bold 8px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 3);
    ctx.restore();
}

function drawSlot(ctx: CanvasRenderingContext2D, g: Pt, vip: boolean): void {
    shadow(ctx, g, 26, 11, 0.32);
    const w = 38;
    const d = 30;
    const h = 86;
    const body = vip ? 0x7a4ea0 : 0xe25448;
    const side = vip ? 0x5a3880 : 0xb83832;
    const dark = vip ? 0x3a2060 : 0x7a2420;
    box(ctx, g, -w / 2, -d / 2, w, d, h,
        scale(body, 1.15), side, dark);

    // Lit marquee
    box(ctx, g, -w / 2 + 3, -d / 2 + 3, w - 6, d - 6, h + 14,
        vip ? 0xffe08a : 0xffd24a,
        vip ? 0xe6b040 : 0xf0a030,
        vip ? 0xb48420 : 0xc47818);

    const sign = project(g, 0, 0, h + 8);
    ctx.fillStyle = vip ? '#4a2068' : '#8a1820';
    ctx.font = 'bold 12px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(vip ? 'VIP' : '777', sign.x, sign.y + 4);
    for (let i = 0; i < 6; i++) {
        const bulb = project(g, -14 + i * 5.6, -d / 2 + 2, h + 18);
        ctx.fillStyle = i % 2 === 0 ? '#fff6c8' : '#ffe08a';
        ctx.beginPath();
        ctx.arc(bulb.x, bulb.y, 2.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Reel glass sits on the south face so it follows the cabinet.
    const gy = d / 2 - 0.5;
    const glass = (x0: number, x1: number, lift0: number, lift1: number) => [
        project(g, x0, gy, lift0),
        project(g, x1, gy, lift0),
        project(g, x1, gy, lift1),
        project(g, x0, gy, lift1),
    ];
    poly(ctx, glass(-11, 11, 28, 58), '#1a2430');
    poly(ctx, glass(-9, 9, 31, 55), '#f4fbff');
    ctx.strokeStyle = '#8aa0b0';
    ctx.lineWidth = 1;
    for (const x of [-3, 3]) {
        const a = project(g, x, gy, 55);
        const b = project(g, x, gy, 31);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    const symbols = ['#e23b4a', '#f2c84a', '#3dbb5a'];
    symbols.forEach((c, i) => {
        const p = project(g, -6 + i * 6, gy, 43);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
    });

    const lever = project(g, w / 2 + 2, 0, 40);
    ctx.strokeStyle = '#e6c36a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lever.x, lever.y);
    ctx.lineTo(lever.x + 10, lever.y - 18);
    ctx.stroke();
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(lever.x + 10, lever.y - 18, 4, 0, Math.PI * 2);
    ctx.fill();

    box(ctx, g, -10, d / 2 - 4, 20, 8, 12, 0xe7e2d4, 0xc8c2b4, 0x9a9488);
    cylinder(ctx, g, -4, d / 2, 3.4, 10, '#c9a24a', '#ffe9a0');
    cylinder(ctx, g, 5, d / 2 + 1, 3.4, 6, '#c9a24a', '#ffe9a0');
    // A stool in front of the cabinet, on the walk-up side.
    stool(ctx, g, 0, d / 2 + 14, vip ? '#e6c56a' : '#d08958');
}

function drawPlant(ctx: CanvasRenderingContext2D, g: Pt, leaf: number): void {
    shadow(ctx, g, 12, 5, 0.25);
    cylinder(ctx, g, 0, 0, 7, 12, hex(0x8a4e32), hex(0xc47848));
    cylinder(ctx, g, 0, 0, 8, 4, hex(0x6e3c26), hex(0xa8643c));
    const pots = [
        [0, 0, 22],
        [-6, 2, 30],
        [6, -1, 28],
        [1, 5, 34],
        [-2, -4, 26],
    ];
    for (const [x, y, h] of pots) {
        disc(ctx, g, x, y, 7, h, hex(scale(leaf, 0.78)));
        disc(ctx, g, x - 1, y - 1, 5, h + 2, hex(leaf));
    }
}

function drawLamp(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 10, 4, 0.22);
    cylinder(ctx, g, 0, 0, 5, 4, '#6e5438', '#a07848');
    cylinder(ctx, g, 0, 0, 1.4, 58, '#d9d3c4', '#f4efe4');
    // shade
    const top = project(g, 0, 0, 64);
    const bot = project(g, 0, 0, 48);
    ctx.fillStyle = '#f6e7b8';
    ctx.beginPath();
    ctx.moveTo(top.x - 6, top.y);
    ctx.lineTo(bot.x - 12, bot.y);
    ctx.lineTo(bot.x + 12, bot.y);
    ctx.lineTo(top.x + 6, top.y);
    ctx.fill();
    ctx.fillStyle = '#fff6d4';
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawChair(ctx: CanvasRenderingContext2D, g: Pt, cushion: number): void {
    shadow(ctx, g, 10, 4, 0.22);
    // legs
    for (const [x, y] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
        box(ctx, g, x - 1, y - 1, 2, 2, 12, 0x6b4a2e, 0x5a3c24, 0x3e2818);
    }
    box(ctx, g, -8, -8, 16, 16, 14, cushion, scale(cushion, 0.82), scale(cushion, 0.6));
    box(ctx, g, -8, -8, 16, 3, 28, scale(cushion, 0.9), scale(cushion, 0.7), scale(cushion, 0.5));
}

function drawOvalTable(
    ctx: CanvasRenderingContext2D,
    g: Pt,
    rx: number,
    ryCart: number,
    felt: number,
    wood: number,
): void {
    shadow(ctx, g, rx * 0.85, ryCart * 0.42, 0.3);
    // apron
    disc(ctx, g, 0, 0, rx, 10, hex(scale(wood, 0.7)));
    disc(ctx, g, 0, 0, rx, 16, hex(wood));
    disc(ctx, g, 0, 0, rx * 0.86, 18, hex(scale(felt, 0.75)));
    disc(ctx, g, 0, 0, rx * 0.82, 20, hex(felt));
    // highlight
    disc(ctx, g, -rx * 0.2, -ryCart * 0.15, rx * 0.22, 21, 'rgba(255,255,255,0.18)');
}

function drawPoker(ctx: CanvasRenderingContext2D, g: Pt): void {
    // Far chairs first so the felt covers their inner edges.
    for (const [x, y] of [[-28, -36], [28, -36]] as Array<[number, number]>) {
        box(ctx, g, x - 7, y - 7, 14, 14, 14, 0xc4473a, 0x9a3228, 0x6e221c);
    }
    drawOvalTable(ctx, g, 96, 54, 0x1f8a45, 0x8a5a32);
    disc(ctx, g, 0, 0, 84, 17, hex(0x6e4424));
    disc(ctx, g, 0, 0, 74, 20, hex(0x2ea85a));
    const stacks: Array<[number, number, string]> = [
        [-28, -8, '#e23b3b'],
        [16, -4, '#f2f2f2'],
        [32, 6, '#3a7ad4'],
        [-10, 12, '#2a2a2a'],
        [4, 16, '#3aa06a'],
    ];
    for (const [x, y, color] of stacks) chipStack(ctx, g, x, y, color, 4, 22);
    ['A', 'K', 'Q', 'J', '10'].forEach((label, i) => {
        playingCard(ctx, g, -22 + i * 12, -2, 23, label, i % 2 === 0);
    });
    disc(ctx, g, 40, -14, 3.2, 23, '#f4f1ea');
    disc(ctx, g, 40, -14, 1.6, 24, '#e23b3b');
    for (const [x, y] of [[-62, 16], [62, 16], [-24, 44], [24, 44]] as Array<[number, number]>) {
        box(ctx, g, x - 7, y - 7, 14, 14, 14, 0xc4473a, 0x9a3228, 0x6e221c);
    }
}

function drawBlackjack(ctx: CanvasRenderingContext2D, g: Pt): void {
    drawOvalTable(ctx, g, 84, 44, 0x1c7a3e, 0x6b3e28);
    box(ctx, g, 22, -14, 20, 12, 30, 0x2a2e38, 0x1c2028, 0x12141a);
    box(ctx, g, -36, -8, 16, 10, 26, 0xf2f0ea, 0xd0cdc4, 0xaaa69c);
    chipStack(ctx, g, -18, 6, '#e23b3b', 5, 22);
    chipStack(ctx, g, 6, 10, '#3a7ad4', 4, 22);
    chipStack(ctx, g, 24, 2, '#f2f2f2', 3, 22);
    playingCard(ctx, g, -8, -2, 23, 'A', true);
    playingCard(ctx, g, 6, -6, 23, 'K', false);
    for (const x of [-40, 0, 40]) stool(ctx, g, x, 36, '#d08958');
}

function drawBar(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 130, 32, 0.32);
    // Back cabinet against the north side of the counter.
    box(ctx, g, -158, -62, 316, 24, 86, 0x6a4028, 0x4e2e1c, 0x3a2014);
    poly(ctx, [
        project(g, -130, -60, 50),
        project(g, 130, -60, 50),
        project(g, 130, -60, 82),
        project(g, -130, -60, 82),
    ], '#c9ebe4');
    poly(ctx, [
        project(g, -122, -59, 54),
        project(g, 122, -59, 54),
        project(g, 122, -59, 78),
        project(g, -122, -59, 78),
    ], '#f4fffc');
    // Counter, then the shelves and bottles so they sit above the wood.
    box(ctx, g, -166, -40, 332, 46, 34, 0xc48a48, 0x8d5a30, 0x5c3a20);
    slab(ctx, g, -162, -36, 324, 38, 35, '#e2b078');
    const shelf = (lift: number): void => {
        slab(ctx, g, -148, -58, 296, 16, lift, '#e6c48a');
        poly(ctx, [
            project(g, -148, -42, lift),
            project(g, 148, -42, lift),
            project(g, 148, -42, lift - 4),
            project(g, -148, -42, lift - 4),
        ], '#c4924a');
    };
    shelf(46);
    shelf(70);
    ctx.strokeStyle = 'rgba(92, 52, 24, 0.45)';
    ctx.lineWidth = 1;
    for (const lift of [10, 18, 26]) {
        const a = project(g, -158, 4, lift);
        const b = project(g, 158, 4, lift);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    box(ctx, g, -162, 2, 324, 4, 16, 0xe6c56a, 0xc4a24e, 0x8a7030);

    const cols = [0x3aa06a, 0xc4473a, 0xf4f1e4, 0x3a6ec4, 0xe8d060, 0x9a4ec4];
    cols.forEach((c, i) => {
        const x = -120 + i * 46;
        peg(ctx, g, x, -52, 46, 18, 4.8, hex(scale(c, 0.7)), hex(c));
        peg(ctx, g, x + 10, -50, 70, 14, 4.2, hex(scale(c, 0.78)), hex(c));
    });
    // Taps, glasses, a nut bowl, and a tip jar on the counter.
    peg(ctx, g, -28, -18, 34, 20, 3.2, '#c4923a', '#ffe9a0');
    peg(ctx, g, -12, -18, 34, 20, 3.2, '#c4923a', '#ffe9a0');
    for (const x of [-86, -70, 28, 44, 60]) {
        peg(ctx, g, x, -12, 34, 11, 3.6, 'rgba(170,214,224,0.9)', 'rgba(244,252,255,0.95)');
    }
    disc(ctx, g, 100, -14, 9, 36, '#f3e2c4');
    disc(ctx, g, 100, -14, 6.2, 39, '#c48a48');
    peg(ctx, g, 132, -16, 34, 14, 4.2, 'rgba(150,205,186,0.55)', 'rgba(230,255,246,0.85)');
    for (const x of [-130, -78, -26, 26, 78, 130]) stool(ctx, g, x, 32, '#d08958');
}

function drawRoulette(ctx: CanvasRenderingContext2D, g: Pt): void {
    drawOvalTable(ctx, g, 78, 36, 0x1e7a40, 0x7a4a2c);
    disc(ctx, g, -18, -4, 20, 24, '#6b2a28');
    disc(ctx, g, -18, -4, 15, 26, '#1a1a1a');
    disc(ctx, g, -18, -4, 5, 28, '#e6c56a');
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        disc(ctx, g, -18 + Math.cos(a) * 10, -4 + Math.sin(a) * 10, 1.7, 27, i % 2 ? '#f2f2f2' : '#e23b3b');
    }
    disc(ctx, g, -12, -8, 1.5, 29, '#f7f4ee');
    box(ctx, g, 8, -8, 34, 16, 8, 0x1f8a48, 0x146838, 0x0e4828);
    chipStack(ctx, g, 16, 4, '#e23b3b', 4, 10);
    chipStack(ctx, g, 28, 6, '#3a7ad4', 3, 10);
    chipStack(ctx, g, 22, 12, '#f2f2f2', 3, 10);
    for (const x of [-52, 0, 52]) stool(ctx, g, x, 30, '#c45c4c');
}

function drawPlinko(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 32, 12, 0.28);
    box(ctx, g, -36, -14, 72, 24, 96, 0x3a7c84, 0x2a5c64, 0x1c4048);
    const face = screenOnFace(g, 36, -8, 36, 8, 58);
    ctx.fillStyle = '#12343a';
    ctx.fillRect(face.x - 22, face.y - 36, 30, 62);
    ctx.fillStyle = '#e7f6f4';
    ctx.fillRect(face.x - 19, face.y - 33, 24, 56);
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 5; col++) {
            ctx.fillStyle = '#2a6a72';
            ctx.beginPath();
            ctx.arc(face.x - 14 + col * 5, face.y - 26 + row * 6, 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.fillStyle = '#e23b3b';
    ctx.beginPath();
    ctx.arc(face.x - 4, face.y - 30, 2.4, 0, Math.PI * 2);
    ctx.fill();
    const bins = ['#e23b3b', '#e6c56a', '#3dbb5a', '#3a7ad4', '#9a4ec4'];
    bins.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(face.x - 18 + i * 5, face.y + 16, 4.2, 6);
    });
}

function drawBingo(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 52, 16, 0.26);
    box(ctx, g, -70, -22, 140, 44, 18, 0xd8d2c4, 0xb7b0a2, 0x8e877c);
    box(ctx, g, -48, -14, 78, 28, 22, 0xf7f1e2, 0xe4dcc8, 0xc8bfa8);
    const origin = project(g, -28, -6, 24);
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const marked = r === 2 && c === 2;
            ctx.fillStyle = marked ? '#3aaa78' : (r + c) % 2 === 0 ? '#f7f4ea' : '#d7eadf';
            ctx.fillRect(origin.x + c * 8, origin.y + r * 7, 7, 6);
            ctx.strokeStyle = '#8aa890';
            ctx.strokeRect(origin.x + c * 8, origin.y + r * 7, 7, 6);
        }
    }
    cylinder(ctx, g, 46, -2, 12, 28, 'rgba(80,80,90,0.35)', 'rgba(220,220,230,0.85)');
    const balls = ['#e23b4a', '#3a7ad4', '#f2f2f2', '#3dbb5a', '#e6c56a'];
    balls.forEach((c, i) => {
        disc(ctx, g, 40 + (i % 3) * 5, -4 + Math.floor(i / 3) * 4, 2.4, 30 + (i % 2) * 3, c);
    });
    peg(ctx, g, -52, 8, 18, 4, 2.2, '#e23b4a', '#ff8a90');
}

function drawHorses(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 40, 12, 0.26);
    box(ctx, g, -48, -12, 96, 22, 78, 0x6b4a2c, 0x8a6238, 0x4e3420);
    box(ctx, g, -44, 8, 88, 10, 16, 0x8a6238, 0x6b4a2c, 0x4e3420);
    const face = screenOnFace(g, 48, -6, 48, 6, 48);
    ctx.fillStyle = '#1c2418';
    ctx.fillRect(face.x - 30, face.y - 28, 40, 48);
    const lanes = ['#e23b3b', '#3a7ad4', '#3dbb5a', '#e6c56a', '#9a4ec4'];
    lanes.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(face.x - 26, face.y - 22 + i * 8, 14 + i * 3, 6);
        ctx.beginPath();
        ctx.arc(face.x - 26 + 16 + i * 3, face.y - 19 + i * 8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4efe4';
        ctx.font = 'bold 8px Verdana';
        ctx.textAlign = 'left';
        ctx.fillText(String(i + 1), face.x - 24, face.y - 17 + i * 8);
    });
}

function drawATM(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 16, 6, 0.28);
    box(ctx, g, -14, -12, 28, 22, 58, 0xd8efe8, 0x3eaea0, 0x1f6e64);
    const face = project(g, 2, 2, 40);
    ctx.fillStyle = '#102820';
    ctx.fillRect(face.x - 10, face.y - 14, 20, 16);
    ctx.fillStyle = '#b8ffe0';
    ctx.font = 'bold 8px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('ATM', face.x, face.y - 3);
    // keypad
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
            ctx.fillStyle = '#f4efe4';
            ctx.fillRect(face.x - 8 + c * 5, face.y + 6 + r * 4, 4, 3);
        }
    }
    box(ctx, g, -8, 8, 16, 5, 16, 0x22302c, 0x182420, 0x101816);
}

function drawFountain(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 30, 12, 0.25);
    disc(ctx, g, 0, 0, 28, 6, '#b7b2a4');
    disc(ctx, g, 0, 0, 24, 10, '#8a9aa0');
    disc(ctx, g, 0, 0, 20, 12, '#6ec4e0');
    disc(ctx, g, 0, 0, 16, 13, '#d4f4ff');
    cylinder(ctx, g, 0, 0, 3, 22, '#d9d4c8', '#f4f0e6');
    disc(ctx, g, 0, 0, 2, 30, 'rgba(255,255,255,0.85)');
    disc(ctx, g, -2, 1, 1.2, 26, 'rgba(255,255,255,0.7)');
    disc(ctx, g, 2, -1, 1.2, 24, 'rgba(255,255,255,0.7)');
}

function drawJukebox(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 16, 6, 0.28);
    box(ctx, g, -16, -14, 32, 26, 8, 0x6e5438, 0x5a4030, 0x3e2c20);
    box(ctx, g, -14, -12, 28, 22, 52, 0xf0d56a, 0xe23b6a, 0x2a6870);
    box(ctx, g, -12, -10, 24, 18, 58, 0xfff1a8, 0xf25c8a, 0x3aa8a0);
    const top = project(g, 0, 0, 64);
    const tubes = ['#e23b4a', '#f0a030', '#f2e14a', '#3dbb5a', '#3a7ad4', '#9a4ec4'];
    tubes.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(top.x, top.y + 6, 6 + i * 1.6, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
    });
    const face = screenOnFace(g, 14, -6, 14, 6, 34);
    ctx.fillStyle = '#142028';
    ctx.beginPath();
    ctx.arc(face.x - 2, face.y - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fe4ff';
    ctx.beginPath();
    ctx.arc(face.x - 2, face.y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2430';
    ctx.fillRect(face.x - 8, face.y + 6, 12, 8);
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ['#e23b4a', '#f2e14a', '#3dbb5a'][i];
        ctx.fillRect(face.x - 6 + i * 3.5, face.y + 8, 2.4, 4);
    }
}

function drawSofa(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 28, 10, 0.26);
    for (const [x, y] of [[-26, -8], [22, -8], [-26, 8], [22, 8]] as Array<[number, number]>) {
        cylinder(ctx, g, x, y, 2.1, 8, '#6b4228', '#c49060');
    }
    box(ctx, g, -32, -12, 64, 24, 16, 0xd06a58, 0xb24e40, 0x8a382e);
    box(ctx, g, -32, -14, 64, 6, 30, 0xe07a68, 0xc45c4c, 0x8a382e);
    box(ctx, g, -32, -12, 6, 24, 26, 0xe07a68, 0xc45c4c, 0x8a382e);
    box(ctx, g, 26, -12, 6, 24, 26, 0xe07a68, 0xc45c4c, 0x8a382e);
    // cushions
    box(ctx, g, -22, -6, 20, 14, 20, 0xf0b0a4, 0xd8887c, 0xb4685c);
    box(ctx, g, 2, -6, 20, 14, 20, 0xf0b0a4, 0xd8887c, 0xb4685c);
}

function drawColumn(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 8, 4, 0.2);
    cylinder(ctx, g, 0, 0, 6, 90, '#efe6d4', '#f7f1e4');
    cylinder(ctx, g, 0, 0, 8, 8, '#e6d3a4', '#f3e2b8');
    cylinder(ctx, g, 0, 0, 8, 96, '#e6d3a4', '#f7edd2');
    disc(ctx, g, 0, 0, 8, 100, '#f8f1dc');
}

export function bakeProps(scene: Phaser.Scene): void {
    bake(scene, 'prop_slot', (ctx, g) => drawSlot(ctx, g, false));
    bake(scene, 'prop_slot_vip', (ctx, g) => drawSlot(ctx, g, true));
    bake(scene, 'prop_poker', drawPoker);
    bake(scene, 'prop_blackjack', drawBlackjack);
    bake(scene, 'prop_bar', drawBar);
    bake(scene, 'prop_roulette', drawRoulette);
    bake(scene, 'prop_plinko', drawPlinko);
    bake(scene, 'prop_bingo', drawBingo);
    bake(scene, 'prop_horses', drawHorses);
    bake(scene, 'prop_atm', drawATM);
    bake(scene, 'prop_fountain', drawFountain);
    bake(scene, 'prop_jukebox', drawJukebox);
    bake(scene, 'prop_sofa', drawSofa);
    bake(scene, 'prop_plant', (ctx, g) => drawPlant(ctx, g, 0x3aaa48));
    bake(scene, 'prop_plant_b', (ctx, g) => drawPlant(ctx, g, 0x2e8a58));
    bake(scene, 'prop_lamp', drawLamp);
    bake(scene, 'prop_chair', (ctx, g) => drawChair(ctx, g, 0xd24a3a));
    bake(scene, 'prop_column', drawColumn);
}
