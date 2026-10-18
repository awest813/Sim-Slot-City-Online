// Isometric projection for the casino lot.
// Gameplay stays in cartesian pixels; only the picture is projected.
// A 40px square becomes the classic 64×32 diamond.

import { WORLD_W, WORLD_H } from '../game/constants';

export const TILE = 40;
export const ISO_X = 0.8;
export const ISO_Y = 0.4;
export const WALL_H = 152;

/** Shifts the lot so the yard sits in positive screen space. */
export const ORIGIN_X = 780;
export const ORIGIN_Y = 150;

export interface Pt {
    x: number;
    y: number;
}

export function toScreen(x: number, y: number): Pt {
    return {
        x: ORIGIN_X + (x - y) * ISO_X,
        y: ORIGIN_Y + (x + y) * ISO_Y,
    };
}

export function fromScreen(sx: number, sy: number): Pt {
    const dx = (sx - ORIGIN_X) / ISO_X;
    const dy = (sy - ORIGIN_Y) / ISO_Y;
    return {
        x: (dy + dx) / 2,
        y: (dy - dx) / 2,
    };
}

/** Depth sort. Stays under the HUD (900) for every point on the lot. */
export function worldDepth(x: number, y: number): number {
    return 24 + (x + y) * 0.38;
}

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    w: number;
    h: number;
}

/** Grass past the walls, in cartesian pixels. Matches the lot painter. */
export const YARD = 14 * TILE;

export function cameraBounds(): Bounds {
    const pts = [
        toScreen(-YARD, -YARD),
        toScreen(WORLD_W + YARD, -YARD),
        toScreen(-YARD, WORLD_H + YARD),
        toScreen(WORLD_W + YARD, WORLD_H + YARD),
    ];
    const minX = Math.floor(Math.min(...pts.map(p => p.x))) - 24;
    const maxX = Math.ceil(Math.max(...pts.map(p => p.x))) + 24;
    const minY = Math.floor(Math.min(...pts.map(p => p.y))) - WALL_H - 36;
    const maxY = Math.ceil(Math.max(...pts.map(p => p.y))) + 28;
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
