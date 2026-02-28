// ─────────────────────────────────────────────
//  Global game constants
//  Keep everything here so tweaks are one-stop.
// ─────────────────────────────────────────────

/** Native render resolution – scales up via Phaser.Scale.FIT */
export const GAME_WIDTH  = 480;
export const GAME_HEIGHT = 270;

/** Battle grid tile size (pixels at native res) */
export const TILE_W = 24;
export const TILE_H = 24;

/** Default battle grid dimensions */
export const GRID_COLS = 12;
export const GRID_ROWS  = 8;

// ── Palette ────────────────────────────────────
export const COL_UI_BG     = 0x1a1a2e;
export const COL_UI_BORDER = 0xe0c55a;

// ── Shared text styles ─────────────────────────
export const FONT_BASE = {
    fontFamily: 'monospace',
    fontSize:   '8px',
    color:      '#f0e6d3',
} as const;

export const FONT_TITLE = {
    fontFamily: 'monospace',
    fontSize:   '10px',
    color:      '#e0c55a',
} as const;
