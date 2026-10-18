// Small isometric drawing helpers. Light comes from the upper left,
// the same way late-90s pre-rendered life-sim objects were lit.

import { ISO_X, ISO_Y, type Pt } from './iso';

export function rgb(r: number, g: number, b: number): string {
    const c = (n: number) => Math.max(0, Math.min(255, n | 0));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
}

export function hex(n: number): string {
    return `#${n.toString(16).padStart(6, '0')}`;
}

export function mix(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = ar + (br - ar) * t;
    const g = ag + (bg - ag) * t;
    const bl = ab + (bb - ab) * t;
    return ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
}

export function scale(n: number, m: number): number {
    const r = Math.min(255, ((n >> 16) & 255) * m);
    const g = Math.min(255, ((n >> 8) & 255) * m);
    const b = Math.min(255, (n & 255) * m);
    return ((r | 0) << 16) | ((g | 0) << 8) | (b | 0);
}

export function project(ground: Pt, fx: number, fy: number, lift = 0): Pt {
    return {
        x: ground.x + (fx - fy) * ISO_X,
        y: ground.y + (fx + fy) * ISO_Y - lift,
    };
}

export function poly(
    ctx: CanvasRenderingContext2D,
    pts: Pt[],
    fill: string,
    stroke?: string,
): void {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

export function shadow(ctx: CanvasRenderingContext2D, ground: Pt, rx = 18, ry = 8, alpha = 0.28): void {
    ctx.save();
    ctx.fillStyle = `rgba(30, 40, 16, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(ground.x + 4, ground.y + 3, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Axis-aligned box. (x, y) is the back corner; w runs +x, d runs +y, h is pixels up. */
export function box(
    ctx: CanvasRenderingContext2D,
    ground: Pt,
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    top: number,
    left: number,
    right: number,
): void {
    const p = (fx: number, fy: number, lift: number) => project(ground, fx, fy, lift);
    const f10 = p(x + w, y, 0);
    const f11 = p(x + w, y + d, 0);
    const f01 = p(x, y + d, 0);
    const t00 = p(x, y, h);
    const t10 = p(x + w, y, h);
    const t11 = p(x + w, y + d, h);
    const t01 = p(x, y + d, h);
    const edge = '#00000018';
    poly(ctx, [f10, f11, t11, t10], hex(right), edge);
    poly(ctx, [f01, f11, t11, t01], hex(left), edge);
    poly(ctx, [t00, t10, t11, t01], hex(top), edge);
}

export function disc(
    ctx: CanvasRenderingContext2D,
    ground: Pt,
    fx: number,
    fy: number,
    r: number,
    lift: number,
    fill: string,
): void {
    const p = project(ground, fx, fy, lift);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(0.5, r * 1.131), Math.max(0.5, r * 0.566), 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
}

export function cylinder(
    ctx: CanvasRenderingContext2D,
    ground: Pt,
    fx: number,
    fy: number,
    r: number,
    h: number,
    side: string,
    top: string,
): void {
    const base = project(ground, fx, fy, 0);
    const cap = project(ground, fx, fy, h);
    const rx = Math.max(0.6, r * 1.131);
    const ry = Math.max(0.4, r * 0.566);
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(cap.x - rx, cap.y);
    ctx.lineTo(base.x - rx, base.y);
    ctx.ellipse(base.x, base.y, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cap.x + rx, cap.y);
    ctx.ellipse(cap.x, cap.y, rx, ry, 0, 0, Math.PI, true);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cap.x, cap.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = top;
    ctx.fill();
}

export function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}
