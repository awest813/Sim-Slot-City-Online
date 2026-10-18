// Paints the casino as one bright isometric lot: sky, yard, diamond floors,
// cutaway wallpaper, and furniture you can walk behind.

import Phaser from 'phaser';
import {
    WORLD_W, WORLD_H,
    ZONE_SLOTS, ZONE_POKER, ZONE_BAR, ZONE_BLACKJACK, ZONE_ROULETTE,
    ZONE_PLINKO, ZONE_BINGO, ZONE_HORSES, ZONE_ENTRANCE, ZONE_VIP,
    GAME_WIDTH, GAME_HEIGHT,
} from '../game/constants';
import { TILE, WALL_H, YARD, cameraBounds, toScreen, worldDepth, type Pt } from './iso';
import { diamondTexture, type FloorKind } from './floors';
import { box, cylinder, hex, scale } from './draw3d';
import { propOrigin } from './props';

function floorKind(x: number, y: number): FloorKind {
    const hit = (z: { x: number; y: number; w: number; h: number }) =>
        x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
    if (hit(ZONE_VIP)) return 'purple';
    if (hit(ZONE_SLOTS)) return 'red';
    if (hit(ZONE_POKER)) return 'green';
    if (hit(ZONE_BAR)) return 'parquet';
    if (hit(ZONE_BLACKJACK)) return 'burgundy';
    if (hit(ZONE_ROULETTE)) return 'check';
    if (hit(ZONE_PLINKO)) return 'teal';
    if (hit(ZONE_BINGO)) return 'blue';
    if (hit(ZONE_HORSES)) return 'tan';
    if (hit(ZONE_ENTRANCE)) return 'marble';
    if (Math.abs(x - WORLD_W / 2) < 70 && y > 200 && y < WORLD_H - 40) return 'runner';
    return 'oak';
}

function stamp(ctx: CanvasRenderingContext2D, kind: FloorKind, cartX: number, cartY: number, origin: Pt): void {
    const s = toScreen(cartX, cartY);
    const variant = (Math.floor(cartX / TILE) * 3 + Math.floor(cartY / TILE)) % 3;
    const tex = diamondTexture(kind, variant);
    ctx.drawImage(tex, s.x - origin.x - tex.width / 2, s.y - origin.y);
}

function quad(
    ctx: CanvasRenderingContext2D,
    a: Pt, b: Pt, c: Pt, d: Pt,
    fill: string,
): void {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

function wallSegment(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number,
    x1: number, y1: number,
    origin: Pt,
    windowed: boolean,
    lit: boolean,
): void {
    const L = (x: number, y: number, lift = 0): Pt => {
        const s = toScreen(x, y);
        return { x: s.x - origin.x, y: s.y - origin.y - lift };
    };
    const b0 = L(x0, y0);
    const b1 = L(x1, y1);
    const t0 = L(x0, y0, WALL_H);
    const t1 = L(x1, y1, WALL_H);
    const cap0 = L(x0, y0, WALL_H + 8);
    const cap1 = L(x1, y1, WALL_H + 8);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.lineTo(t0.x, t0.y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = lit ? '#f6ead2' : '#e4d0b0';
    const minX = Math.min(b0.x, b1.x, t0.x, t1.x) - 2;
    const maxX = Math.max(b0.x, b1.x, t0.x, t1.x) + 2;
    const minY = Math.min(t0.y, t1.y) - 2;
    const maxY = Math.max(b0.y, b1.y) + 2;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.strokeStyle = 'rgba(176, 132, 86, 0.22)';
    ctx.lineWidth = 2;
    for (let x = minX; x < maxX; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, minY);
        ctx.lineTo(x, maxY);
        ctx.stroke();
    }
    // tiny floral dots
    ctx.fillStyle = 'rgba(186, 84, 96, 0.42)';
    for (let y = minY + 12; y < maxY - 18; y += 16) {
        for (let x = minX + 4; x < maxX; x += 14) {
            ctx.beginPath();
            ctx.arc(x, y, 1.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 4, y + 3, 1.1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    // Wood wainscot under the chair rail, with a baseboard and panel grooves.
    const wainTop = 60;
    const wtA = L(x0, y0, wainTop);
    const wtB = L(x1, y1, wainTop);
    quad(ctx, b0, b1, wtB, wtA, lit ? '#c99562' : '#a87448');
    ctx.strokeStyle = 'rgba(70, 40, 18, 0.4)';
    ctx.lineWidth = 1;
    for (const t of [0.33, 0.66]) {
        const gx = x0 + (x1 - x0) * t;
        const gy = y0 + (y1 - y0) * t;
        const a = L(gx, gy, 12);
        const b = L(gx, gy, wainTop - 4);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    const rail0 = L(x0, y0, 12);
    const rail1 = L(x1, y1, 12);
    quad(ctx, b0, b1, rail1, rail0, '#5c3820');
    const cr0 = L(x0, y0, wainTop + 6);
    const cr1 = L(x1, y1, wainTop + 6);
    const crb0 = L(x0, y0, wainTop - 2);
    const crb1 = L(x1, y1, wainTop - 2);
    quad(ctx, crb0, crb1, cr1, cr0, lit ? '#f0d7a4' : '#d4b484');

    // top plate of the wall
    quad(ctx, t0, t1, cap1, cap0, '#d8b888');
    ctx.strokeStyle = 'rgba(90, 58, 32, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.stroke();

    if (windowed) {
        const wx0 = x0 + (x1 - x0) * 0.22;
        const wy0 = y0 + (y1 - y0) * 0.22;
        const wx1 = x0 + (x1 - x0) * 0.78;
        const wy1 = y0 + (y1 - y0) * 0.78;
        const winBot = 74;
        const winTop = WALL_H - 28;
        const wb0 = L(wx0, wy0, winBot);
        const wb1 = L(wx1, wy1, winBot);
        const wt0 = L(wx0, wy0, winTop);
        const wt1 = L(wx1, wy1, winTop);
        quad(ctx, wb0, wb1, wt1, wt0, '#f7f3ea');
        const inset = 0.18;
        const ix0 = wx0 + (wx1 - wx0) * inset;
        const iy0 = wy0 + (wy1 - wy0) * inset;
        const ix1 = wx1 - (wx1 - wx0) * inset;
        const iy1 = wy1 - (wy1 - wy0) * inset;
        const glassBot = winBot + 6;
        const glassTop = winTop - 6;
        quad(ctx,
            L(ix0, iy0, glassBot),
            L(ix1, iy1, glassBot),
            L(ix1, iy1, glassTop),
            L(ix0, iy0, glassTop),
            '#9fd4ea',
        );
        // mullion
        ctx.strokeStyle = '#f7f3ea';
        ctx.lineWidth = 1.5;
        const midLift = (glassBot + glassTop) / 2;
        const mid = L((ix0 + ix1) / 2, (iy0 + iy1) / 2, midLift);
        const topM = L((ix0 + ix1) / 2, (iy0 + iy1) / 2, glassTop);
        const botM = L((ix0 + ix1) / 2, (iy0 + iy1) / 2, glassBot);
        ctx.beginPath();
        ctx.moveTo(topM.x, topM.y);
        ctx.lineTo(botM.x, botM.y);
        ctx.moveTo(mid.x - 8, mid.y);
        ctx.lineTo(mid.x + 8, mid.y);
        ctx.stroke();
    }
}

function paintLotCanvas(): { canvas: HTMLCanvasElement; origin: Pt } {
    const bounds = cameraBounds();
    const canvas = document.createElement('canvas');
    canvas.width = bounds.w;
    canvas.height = bounds.h;
    const ctx = canvas.getContext('2d')!;
    const origin = { x: bounds.minX, y: bounds.minY };

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, bounds.h);
    sky.addColorStop(0, '#6eb6ea');
    sky.addColorStop(0.45, '#b7e4f8');
    sky.addColorStop(1, '#d5f0c8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, bounds.w, bounds.h);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    const clouds: Array<[number, number, number]> = [
        [180, 70, 46], [260, 54, 28], [520, 40, 54], [860, 78, 36], [1100, 48, 50],
    ];
    for (const [x, y, r] of clouds) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(x + r * 0.6, y + 6, r * 0.7, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Yard, then the room floor on top.
    const x0 = -YARD;
    const y0 = -YARD;
    const x1 = WORLD_W + YARD;
    const y1 = WORLD_H + YARD;
    for (let y = y0; y < y1; y += TILE) {
        for (let x = x0; x < x1; x += TILE) {
            const inside = x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
            stamp(ctx, inside ? floorKind(x + TILE / 2, y + TILE / 2) : 'grass', x, y, origin);
            if (!inside && ((Math.floor(x / TILE) * 5 + Math.floor(y / TILE)) % 29 === 0)) {
                const s = toScreen(x + TILE * 0.5, y + TILE * 0.35);
                const colors = ['#f2e14a', '#f25c6a', '#ffffff', '#7a4ea0'];
                const color = colors[(Math.floor(x / TILE) + Math.floor(y / TILE)) & 3];
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(s.x - origin.x, s.y - origin.y, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Contact shadow just inside the two standing walls.
    ctx.save();
    ctx.fillStyle = 'rgba(40, 30, 16, 0.16)';
    for (let x = 0; x < WORLD_W; x += TILE) {
        const a = toScreen(x, 18);
        const b = toScreen(x + TILE, 18);
        const c = toScreen(x + TILE, 0);
        const d = toScreen(x, 0);
        ctx.beginPath();
        ctx.moveTo(a.x - origin.x, a.y - origin.y);
        ctx.lineTo(b.x - origin.x, b.y - origin.y);
        ctx.lineTo(c.x - origin.x, c.y - origin.y);
        ctx.lineTo(d.x - origin.x, d.y - origin.y);
        ctx.fill();
    }
    ctx.restore();

    // West wall (down the left edge), then north wall.
    let i = 0;
    for (let y = 0; y < WORLD_H; y += TILE) {
        wallSegment(ctx, 0, y, 0, y + TILE, origin, i % 5 === 2, false);
        i++;
    }
    i = 0;
    for (let x = 0; x < WORLD_W; x += TILE) {
        wallSegment(ctx, x, 0, x + TILE, 0, origin, i % 6 === 3, true);
        i++;
    }

    // Front corner newel, so the open side still reads as a room.
    const post = (cartX: number, cartY: number) => {
        const s = toScreen(cartX, cartY);
        const g = { x: s.x - origin.x, y: s.y - origin.y };
        box(ctx, g, -5, -5, 10, 10, WALL_H,
            0xe7d3a4, 0xd2b888, 0xb48e62);
        cylinder(ctx, g, 0, 0, 6, WALL_H + 6, hex(scale(0xe7d3a4, 0.9)), '#f8f1dc');
    };
    post(0, WORLD_H);
    post(WORLD_W, WORLD_H);
    post(WORLD_W, 0);

    // Lot name on the back wall, painted into the wallpaper.
    const sign = toScreen(WORLD_W * 0.55, 0);
    ctx.fillStyle = '#14675c';
    ctx.beginPath();
    const sx = sign.x - origin.x;
    const sy = sign.y - origin.y - WALL_H + 28;
    ctx.fillRect(sx - 70, sy, 140, 26);
    ctx.fillStyle = '#f6e7a8';
    ctx.font = 'bold 14px Verdana, Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SLOT CITY', sx, sy + 18);

    return { canvas, origin: { x: bounds.minX, y: bounds.minY } };
}

function placeProp(scene: Phaser.Scene, key: string, x: number, y: number): void {
    const s = toScreen(x, y);
    const o = propOrigin(key);
    const img = scene.add.image(s.x, s.y, key);
    img.setOrigin(o.x, o.y);
    img.setDepth(worldDepth(x, y));
}

function floorSign(scene: Phaser.Scene, x: number, y: number, label: string): void {
    const s = toScreen(x, y);
    const t = scene.add.text(s.x, s.y, label, {
        fontFamily: 'Verdana, Trebuchet MS, sans-serif',
        fontSize: '11px',
        color: '#1b3a28',
        fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(worldDepth(x, y) - 0.5);
    const g = scene.add.graphics().setDepth(t.depth - 0.2);
    const w = t.width + 14;
    const h = t.height + 6;
    g.fillStyle(0xfff6e4, 0.92);
    g.fillRoundedRect(s.x - w / 2, s.y - h / 2, w, h, 8);
    g.lineStyle(1, 0x6e9a62, 0.9);
    g.strokeRoundedRect(s.x - w / 2, s.y - h / 2, w, h, 8);
}

export function buildSimsLot(scene: Phaser.Scene): void {
    const { canvas, origin } = paintLotCanvas();
    const key = 'sims_lot';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
    scene.add.image(origin.x, origin.y, key).setOrigin(0, 0).setDepth(1);

    // Furniture, grounded on the same spots the collision boxes use.
    // Ground points match the collision-box centers in the lobby.
    placeProp(scene, 'prop_slot', 60, 97);
    placeProp(scene, 'prop_slot', 120, 97);
    placeProp(scene, 'prop_slot', 60, 197);
    placeProp(scene, 'prop_slot', 120, 197);
    placeProp(scene, 'prop_slot_vip', 80, 637);
    placeProp(scene, 'prop_poker', 790, 190);
    placeProp(scene, 'prop_blackjack',
        ZONE_BLACKJACK.x + ZONE_BLACKJACK.w / 2,
        ZONE_BLACKJACK.y + ZONE_BLACKJACK.h / 2 + 10);
    placeProp(scene, 'prop_bar', ZONE_BAR.x + ZONE_BAR.w / 2, ZONE_BAR.y + 78);
    placeProp(scene, 'prop_roulette',
        ZONE_ROULETTE.x + ZONE_ROULETTE.w / 2,
        ZONE_ROULETTE.y + ZONE_ROULETTE.h / 2);
    placeProp(scene, 'prop_plinko',
        ZONE_PLINKO.x + ZONE_PLINKO.w / 2,
        ZONE_PLINKO.y + ZONE_PLINKO.h / 2);
    placeProp(scene, 'prop_bingo',
        ZONE_BINGO.x + ZONE_BINGO.w / 2,
        ZONE_BINGO.y + ZONE_BINGO.h / 2);
    placeProp(scene, 'prop_horses',
        ZONE_HORSES.x + ZONE_HORSES.w / 2,
        ZONE_HORSES.y + ZONE_HORSES.h / 2);
    placeProp(scene, 'prop_atm', 400, WORLD_H - 105);
    placeProp(scene, 'prop_fountain', WORLD_W / 2, WORLD_H / 2 + 10);
    placeProp(scene, 'prop_jukebox', ZONE_BAR.x + 40, ZONE_BAR.y + ZONE_BAR.h - 40);
    placeProp(scene, 'prop_sofa', 470, 560);
    placeProp(scene, 'prop_plant', 200, 48);
    placeProp(scene, 'prop_plant_b', 760, 48);
    placeProp(scene, 'prop_plant', 48, 360);
    placeProp(scene, 'prop_plant_b', WORLD_W - 48, 360);
    placeProp(scene, 'prop_lamp', 250, 300);
    placeProp(scene, 'prop_lamp', 700, 340);
    placeProp(scene, 'prop_column', 40, 80);
    placeProp(scene, 'prop_column', WORLD_W - 36, 70);

    floorSign(scene, 210, 150, 'Slots');
    floorSign(scene, 700, 100, 'Poker');
    floorSign(scene, 480, 48, 'Bar');
    floorSign(scene, 390, 248, 'Blackjack');
    floorSign(scene, 150, 470, 'Roulette');
    floorSign(scene, 800, 470, 'Plinko');
    floorSign(scene, 470, 470, 'Bingo');
    floorSign(scene, 800, 610, 'Horses');
    floorSign(scene, 480, 660, 'Entrance');
    floorSign(scene, 150, 620, 'VIP');

    // Warm pools under the lamps, the way a lot reads at noon indoors.
    for (const [x, y] of [[250, 300], [700, 340], [WORLD_W / 2, 90]] as Array<[number, number]>) {
        const s = toScreen(x, y);
        const glow = scene.add.ellipse(s.x, s.y, 90, 46, 0xffe08a, 0.18).setDepth(worldDepth(x, y) - 0.4);
        scene.tweens.add({
            targets: glow,
            alpha: { from: 0.12, to: 0.28 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }
}

/** Neighborhood behind the name-entry screen. */
export function paintTitleBackdrop(scene: Phaser.Scene): void {
    const skyGfx = scene.add.graphics().setDepth(-2);
    skyGfx.fillStyle(0x7ec4ee, 1);
    skyGfx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    skyGfx.fillStyle(0xb7e4f8, 1);
    skyGfx.fillRect(0, 160, GAME_WIDTH, 180);
    skyGfx.fillStyle(0x67b85a, 1);
    skyGfx.fillRect(0, 300, GAME_WIDTH, GAME_HEIGHT);
    skyGfx.fillStyle(0xffffff, 0.9);
    skyGfx.fillEllipse(160, 70, 90, 36);
    skyGfx.fillEllipse(210, 78, 70, 28);
    skyGfx.fillEllipse(720, 54, 110, 40);
    skyGfx.fillEllipse(790, 64, 64, 26);

    if (!scene.textures.exists('title_grass')) {
        scene.textures.addCanvas('title_grass', diamondTexture('grass', 1));
    }
    for (let row = 0; row < 10; row++) {
        for (let col = -1; col < 18; col++) {
            const x = col * 64 + (row % 2) * 32;
            const y = 268 + row * 16;
            scene.add.image(x, y, 'title_grass').setOrigin(0.5, 0).setDepth(-1);
        }
    }

    // Plastic shell the menus sit on. Dark well keeps the existing light type readable.
    const panel = scene.add.graphics().setDepth(0);
    const px = 70;
    const py = 28;
    const pw = GAME_WIDTH - 140;
    const ph = GAME_HEIGHT - 56;
    panel.fillStyle(0x06362f, 0.28);
    panel.fillRoundedRect(px + 6, py + 8, pw, ph, 28);
    panel.fillStyle(0x22b89a, 1);
    panel.fillRoundedRect(px, py, pw, ph, 26);
    panel.fillStyle(0xd8fff2, 0.7);
    panel.fillRoundedRect(px + 3, py + 3, pw - 6, 18, 12);
    panel.fillStyle(0x14685c, 1);
    panel.fillRoundedRect(px + 14, py + 18, pw - 28, ph - 32, 18);
    panel.lineStyle(2, 0xd8ffe8, 0.8);
    panel.strokeRoundedRect(px, py, pw, ph, 26);
}
