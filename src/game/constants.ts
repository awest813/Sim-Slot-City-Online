// ── Viewport ─────────────────────────────────────────────────────────────────
export const GAME_WIDTH  = 960;
export const GAME_HEIGHT = 540;

// ── Avatar ────────────────────────────────────────────────────────────────────
export const AVATAR_SPEED     = 160;   // px/sec
export const AVATAR_SIZE      = 14;    // collision circle radius
export const INTERACT_RADIUS  = 64;    // px — how close to trigger prompt

// ── Casino floor layout (world-space) ─────────────────────────────────────────
export const WORLD_W = 960;
export const WORLD_H = 720;

// ── Palette ───────────────────────────────────────────────────────────────────
export const COL_BG          = 0x0d1117;
export const COL_FLOOR       = 0x0f2a0f;
export const COL_WALL        = 0x1c1008;
export const COL_WALL_STRIPE = 0x2a1c0e;
export const COL_TRIM        = 0xc9a84c;
export const COL_TRIM_DIM    = 0x8a6f30;
export const COL_FELT        = 0x1a4a1a;
export const COL_TABLE       = 0x5c3a1e;
export const COL_BAR         = 0x3a1e0a;
export const COL_SLOT_BODY   = 0x1a1a3e;
export const COL_SLOT_TRIM   = 0xc9a84c;
export const COL_CHIP        = 0x2ecc71;
export const COL_LOSS        = 0xe74c3c;
export const COL_ALL_IN      = 0xcc44cc;   // magenta badge for all-in players at poker table
export const COL_WHITE       = 0xf0e6d3;
export const COL_GRAY        = 0x888888;

// ── UI ────────────────────────────────────────────────────────────────────────
export const COL_UI_BG       = 0x0d1117;
export const COL_UI_BG2      = 0x141c27;
export const COL_UI_BORDER   = 0xc9a84c;
export const COL_UI_HOVER    = 0x1e2d3e;
export const COL_UI_SELECTED = 0x2a3f54;
export const COL_BTN_PRIMARY = 0x2a5f2a;
export const COL_BTN_HOVER   = 0x3a7f3a;
export const COL_BTN_DANGER  = 0x5f2a2a;

// ── Typography ────────────────────────────────────────────────────────────────
export const FONT = 'monospace';

export const TEXT_SM     = { fontFamily: FONT, fontSize: '11px', color: '#f0e6d3' } as const;
export const TEXT_MD     = { fontFamily: FONT, fontSize: '14px', color: '#f0e6d3' } as const;
export const TEXT_LG     = { fontFamily: FONT, fontSize: '18px', color: '#f0e6d3' } as const;
export const TEXT_XL     = { fontFamily: FONT, fontSize: '24px', color: '#f0e6d3' } as const;
export const TEXT_GOLD   = { fontFamily: FONT, fontSize: '14px', color: '#c9a84c' } as const;
export const TEXT_GOLD_LG= { fontFamily: FONT, fontSize: '18px', color: '#c9a84c' } as const;
export const TEXT_GREEN  = { fontFamily: FONT, fontSize: '14px', color: '#2ecc71' } as const;
export const TEXT_RED    = { fontFamily: FONT, fontSize: '14px', color: '#e74c3c' } as const;
export const TEXT_TITLE  = { fontFamily: FONT, fontSize: '28px', color: '#c9a84c', fontStyle: 'bold' } as const;

// ── Depth layers ──────────────────────────────────────────────────────────────
export const DEPTH_FLOOR       = 0;
export const DEPTH_SHADOW      = 10;
export const DEPTH_PROPS       = 20;
export const DEPTH_AVATAR_BASE = 100;   // + y offset for depth sorting
export const DEPTH_FOREGROUND  = 500;
export const DEPTH_HUD         = 900;
export const DEPTH_PANEL       = 1000;
export const DEPTH_OVERLAY     = 1100;

// ── Zone definitions (world-space) ────────────────────────────────────────────
export const ZONE_ENTRANCE   = { x: 380, y: 580, w: 200, h: 120 };
export const ZONE_SLOTS      = { x: 30,  y: 60,  w: 260, h: 380 };
export const ZONE_POKER      = { x: 650, y: 60,  w: 280, h: 380 };
export const ZONE_BAR        = { x: 290, y: 30,  w: 380, h: 200 };
export const ZONE_BLACKJACK  = { x: 330, y: 250, w: 300, h: 200 };
