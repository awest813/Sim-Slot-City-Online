// Original isometric furniture. Chunky, brightly colored, lit from the upper left.

import type Phaser from 'phaser';
import type { Pt } from './iso';
import { box, cylinder, disc, hex, project, scale, shadow } from './draw3d';

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
    const w = 420;
    const h = 340;
    const src = document.createElement('canvas');
    src.width = w;
    src.height = h;
    const ctx = src.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    const ground = { x: 200, y: 250 };
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

function drawSlot(ctx: CanvasRenderingContext2D, g: Pt, vip: boolean): void {
    shadow(ctx, g, 22, 9, 0.32);
    const w = 30;
    const d = 24;
    const h = 74;
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
    ctx.font = 'bold 11px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(vip ? 'VIP' : '777', sign.x, sign.y + 4);

    // Reel glass, drawn large so it reads at lot scale
    const glass = project(g, 4, 4, 46);
    ctx.fillStyle = '#1a2430';
    ctx.fillRect(glass.x - 16, glass.y - 16, 30, 28);
    ctx.fillStyle = '#f4fbff';
    ctx.fillRect(glass.x - 14, glass.y - 14, 26, 24);
    ctx.strokeStyle = '#8aa0b0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(glass.x - 5, glass.y - 14);
    ctx.lineTo(glass.x - 5, glass.y + 10);
    ctx.moveTo(glass.x + 5, glass.y - 14);
    ctx.lineTo(glass.x + 5, glass.y + 10);
    ctx.stroke();
    const symbols = ['#e23b4a', '#f2c84a', '#3dbb5a'];
    symbols.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(glass.x - 9 + i * 9, glass.y - 1, 3.2, 0, Math.PI * 2);
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

    box(ctx, g, -8, d / 2 - 3, 16, 6, 10, 0xe7e2d4, 0xc8c2b4, 0x9a9488);
    cylinder(ctx, g, -3, d / 2, 3.2, 8, '#c9a24a', '#ffe9a0');
    cylinder(ctx, g, 4, d / 2 + 1, 3.2, 5, '#c9a24a', '#ffe9a0');
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
    for (const [x, y] of [[-24, -30], [24, -30]] as Array<[number, number]>) {
        box(ctx, g, x - 6, y - 6, 12, 12, 12, 0xc4473a, 0x9a3228, 0x6e221c);
    }
    drawOvalTable(ctx, g, 78, 46, 0x1f8a45, 0x8a5a32);
    disc(ctx, g, 0, 0, 70, 17, hex(0x6e4424));
    disc(ctx, g, 0, 0, 62, 20, hex(0x2ea85a));
    const stacks: Array<[number, number, string]> = [
        [-18, -6, '#e23b3b'],
        [8, -2, '#f2f2f2'],
        [22, 4, '#3a7ad4'],
        [-6, 8, '#2a2a2a'],
    ];
    for (const [x, y, color] of stacks) {
        for (let i = 0; i < 4; i++) disc(ctx, g, x, y, 4.2, 22 + i * 2.1, color);
        disc(ctx, g, x, y, 4.2, 30.5, '#fff6d0');
    }
    for (const [x, y] of [[-50, 12], [50, 12], [-18, 38], [18, 38]] as Array<[number, number]>) {
        box(ctx, g, x - 6, y - 6, 12, 12, 12, 0xc4473a, 0x9a3228, 0x6e221c);
    }
}

function drawBlackjack(ctx: CanvasRenderingContext2D, g: Pt): void {
    drawOvalTable(ctx, g, 70, 36, 0x1c7a3e, 0x6b3e28);
    // dealer shoe
    box(ctx, g, 18, -8, 16, 10, 28, 0x2a2e38, 0x1c2028, 0x12141a);
    box(ctx, g, -28, -4, 14, 8, 24, 0xf2f0ea, 0xd0cdc4, 0xaaa69c);
}

function drawBar(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 90, 22, 0.3);
    const w = 300;
    const d = 36;
    box(ctx, g, -w / 2, -d / 2, w, d, 28,
        0xc48a48, 0x8d5a30, 0x5c3a20);
    ctx.strokeStyle = 'rgba(92, 52, 24, 0.45)';
    ctx.lineWidth = 1;
    for (const lift of [8, 16, 22]) {
        const a = project(g, -w / 2 + 4, d / 2, lift);
        const b = project(g, w / 2 - 4, d / 2, lift);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    // brass rail
    box(ctx, g, -w / 2, d / 2 - 3, w, 3, 16, 0xe6c56a, 0xc4a24e, 0x8a7030);
    // bottles
    const bottles = [-110, -70, -30, 20, 70, 110];
    const cols = [0x3aa06a, 0xe8d8a0, 0xc4473a, 0xf2f2f2, 0x3a6ec4, 0xe8d060];
    bottles.forEach((x, i) => {
        cylinder(ctx, g, x, -6, 3.2, 16 + (i % 3) * 4, hex(scale(cols[i], 0.8)), hex(cols[i]));
    });
    // diner stools: chrome stem, foot ring, round wood seat
    for (const x of [-100, -40, 20, 80]) {
        cylinder(ctx, g, x, 28, 1.5, 16, '#8e949c', '#e6eaee');
        disc(ctx, g, x, 28, 5.5, 6, '#c5ccd2');
        disc(ctx, g, x, 28, 7.2, 16, '#6b3a28');
        disc(ctx, g, x, 28, 6.2, 18, '#d08958');
        disc(ctx, g, x, 28, 2.8, 19, '#f0c090');
    }
}

function drawRoulette(ctx: CanvasRenderingContext2D, g: Pt): void {
    drawOvalTable(ctx, g, 62, 28, 0x1e7a40, 0x7a4a2c);
    // wheel
    disc(ctx, g, -16, -2, 16, 24, '#6b2a28');
    disc(ctx, g, -16, -2, 12, 26, '#1a1a1a');
    disc(ctx, g, -16, -2, 4, 28, '#e6c56a');
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        disc(ctx, g, -16 + Math.cos(a) * 8, -2 + Math.sin(a) * 8, 1.6, 27, i % 2 ? '#f2f2f2' : '#e23b3b');
    }
    // layout pads
    box(ctx, g, 10, -6, 26, 14, 6, 0x1f8a48, 0x146838, 0x0e4828);
}

function drawPlinko(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 24, 8, 0.28);
    box(ctx, g, -28, -10, 56, 18, 78, 0x3a7c84, 0x2a5c64, 0x1c4048);
    const face = screenOnFace(g, 28, -6, 28, 6, 50);
    ctx.fillStyle = '#12343a';
    ctx.fillRect(face.x - 16, face.y - 28, 22, 48);
    ctx.fillStyle = '#e7f6f4';
    ctx.fillRect(face.x - 14, face.y - 26, 18, 44);
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
            ctx.fillStyle = '#2a6a72';
            ctx.beginPath();
            ctx.arc(face.x - 10 + col * 4, face.y - 18 + row * 6, 1.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    const bins = ['#e23b3b', '#e6c56a', '#3dbb5a', '#3a7ad4'];
    bins.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(face.x - 13 + i * 4, face.y + 12, 3.5, 5);
    });
}

function drawBingo(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 36, 12, 0.26);
    box(ctx, g, -50, -18, 100, 36, 16, 0xd8d2c4, 0xb7b0a2, 0x8e877c);
    box(ctx, g, -36, -12, 72, 24, 20, 0xf7f1e2, 0xe4dcc8, 0xc8bfa8);
    // card grid
    const origin = project(g, -20, -4, 22);
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#f7f4ea' : '#d7eadf';
            ctx.fillRect(origin.x + c * 7, origin.y + r * 6, 6, 5);
            ctx.strokeStyle = '#8aa890';
            ctx.strokeRect(origin.x + c * 7, origin.y + r * 6, 6, 5);
        }
    }
    // cage
    cylinder(ctx, g, 34, 0, 8, 22, 'rgba(80,80,90,0.35)', 'rgba(220,220,230,0.8)');
    disc(ctx, g, 34, 0, 3, 24, '#e23b4a');
}

function drawHorses(ctx: CanvasRenderingContext2D, g: Pt): void {
    shadow(ctx, g, 28, 8, 0.26);
    box(ctx, g, -36, -8, 72, 16, 64, 0x6b4a2c, 0x8a6238, 0x4e3420);
    const face = screenOnFace(g, 36, -4, 36, 4, 40);
    ctx.fillStyle = '#1c2418';
    ctx.fillRect(face.x - 22, face.y - 22, 28, 36);
    const lanes = ['#e23b3b', '#3a7ad4', '#3dbb5a', '#e6c56a'];
    lanes.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(face.x - 18, face.y - 16 + i * 8, 10 + i * 3, 5);
        ctx.fillStyle = '#f4efe4';
        ctx.font = '7px Verdana';
        ctx.fillText(String(i + 1), face.x - 16, face.y - 12 + i * 8);
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
