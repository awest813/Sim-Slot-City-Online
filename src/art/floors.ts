// Diamond floor swatches. Each tile is painted in square-space and warped
// into a 64×32 diamond so the grout lines up with the lot grid.

import { TILE } from './iso';

export const DIAMOND_W = TILE * 2 * 0.8; // 64
export const DIAMOND_H = TILE * 2 * 0.4; // 32

export type FloorKind =
    | 'grass'
    | 'oak'
    | 'parquet'
    | 'marble'
    | 'red'
    | 'green'
    | 'burgundy'
    | 'check'
    | 'teal'
    | 'blue'
    | 'tan'
    | 'purple'
    | 'runner';

function hash(x: number, y: number): number {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function sample(kind: FloorKind, fx: number, fy: number, seed: number): [number, number, number] {
    const n = hash(Math.floor(fx * 48) + seed * 17, Math.floor(fy * 48) + seed * 3) - 0.5;
    let r = 0, g = 0, b = 0;

    if (kind === 'grass') {
        const blade = Math.sin(fx * 50 + fy * 18 + seed) > 0.72 ? -18 : 0;
        r = 78 + n * 30 + blade * 0.3;
        g = 148 + n * 36 + (hash(Math.floor(fx * 9), Math.floor(fy * 9) + seed) - 0.5) * 28;
        b = 52 + n * 16;
        if ((Math.floor(fx * 14 + seed) + Math.floor(fy * 22)) % 9 === 0) {
            g += 18; r += 10;
        }
    } else if (kind === 'oak') {
        const plank = Math.floor(fy * 5);
        const tone = 0.9 + (plank % 2) * 0.07 + hash(plank, seed) * 0.1;
        const seam = (fy * 5) % 1 < 0.07;
        const grain = Math.sin((fx * 26) + plank * 2.2) * 8;
        r = (186 * tone) + grain + n * 16;
        g = (138 * tone) + grain * 0.6 + n * 12;
        b = (78 * tone) + n * 8;
        if (seam) { r *= 0.72; g *= 0.72; b *= 0.7; }
        // occasional knot
        if (hash(plank, seed + 4) > 0.86 && Math.abs(fx - 0.3 - hash(plank, 2) * 0.4) < 0.05 && Math.abs((fy * 5) % 1 - 0.5) < 0.18) {
            r *= 0.75; g *= 0.7; b *= 0.65;
        }
    } else if (kind === 'parquet') {
        const cell = Math.floor(fx * 2) + Math.floor(fy * 2);
        const along = cell % 2 === 0 ? fx : fy;
        const stripe = Math.sin(along * 46) * 7;
        r = 132 + stripe + n * 12;
        g = 78 + stripe * 0.5 + n * 8;
        b = 42 + n * 6;
        if (Math.abs((fx * 2) % 1 - 0) < 0.04 || Math.abs((fy * 2) % 1) < 0.04) {
            r *= 0.7; g *= 0.7; b *= 0.7;
        }
    } else if (kind === 'marble') {
        const vein = Math.sin(fx * 10 + fy * 4 + seed) * Math.sin(fy * 14 - fx * 3);
        r = 214 + vein * 22 + n * 8;
        g = 210 + vein * 18 + n * 8;
        b = 200 + vein * 10 + n * 6;
        if (vein > 0.55) { r -= 30; g -= 24; b -= 16; }
    } else if (kind === 'check') {
        const on = (Math.floor(fx * 4) + Math.floor(fy * 4)) % 2 === 0;
        if (on) { r = 176; g = 42; b = 38; }
        else { r = 36; g = 32; b = 32; }
        r += n * 10; g += n * 8; b += n * 8;
    } else {
        const carpets: Record<string, [number, number, number, number, number, number]> = {
            red:      [148, 42, 46, 196, 154, 64],
            green:    [36, 112, 58, 78, 160, 86],
            burgundy: [112, 32, 52, 168, 120, 72],
            teal:     [28, 112, 112, 220, 196, 120],
            blue:     [36, 72, 138, 210, 186, 96],
            tan:      [168, 124, 72, 96, 64, 36],
            purple:   [98, 42, 120, 212, 176, 86],
            runner:   [132, 28, 36, 212, 170, 72],
        };
        const c = carpets[kind];
        const u = (fx * 3) % 1;
        const v = (fy * 3) % 1;
        const d = Math.hypot(u - 0.5, v - 0.5);
        const motif = d < 0.16;
        const ring = d > 0.16 && d < 0.24;
        r = (motif ? c[3] : c[0]) + n * 14;
        g = (motif ? c[4] : c[1]) + n * 12;
        b = (motif ? c[5] : c[2]) + n * 10;
        if (ring) { r *= 0.78; g *= 0.78; b *= 0.78; }
        // woven cross-hatch
        if ((Math.floor(fx * 22) + Math.floor(fy * 22)) % 2 === 0) {
            r += 6; g += 4;
        }
    }

    // Bevel: light on the far edges, grout on the rim. Reads as a separate tile.
    const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
    let m = 1;
    if (edge < 0.045) m = 0.55 + edge * 6;
    else if (fy < 0.14 || fx < 0.1) m = 1.08;
    else if (fy > 0.86 || fx > 0.9) m = 0.9;
    return [r * m, g * m, b * m];
}

const cache = new Map<string, HTMLCanvasElement>();

export function diamondTexture(kind: FloorKind, variant: number): HTMLCanvasElement {
    const key = `${kind}:${variant}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const w = DIAMOND_W;
    const h = DIAMOND_H;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const seed = variant * 11 + kind.length * 3;

    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            const localX = px - w / 2;
            const localY = py;
            const fx = ((localY / (h / 2)) + (localX / (w / 2))) / 2;
            const fy = ((localY / (h / 2)) - (localX / (w / 2))) / 2;
            const i = (py * w + px) * 4;
            if (fx < -0.01 || fy < -0.01 || fx > 1.01 || fy > 1.01) {
                data[i + 3] = 0;
                continue;
            }
            const [r, g, b] = sample(kind, Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy)), seed);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            const ox = Math.min(fx, fy, 1 - fx, 1 - fy);
            data[i + 3] = ox < 0 ? 0 : ox < 0.02 ? (ox / 0.02) * 255 : 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    cache.set(key, canvas);
    return canvas;
}
