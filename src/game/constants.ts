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

// ── Palette — Base ────────────────────────────────────────────────────────────
export const COL_BG          = 0x060d18;   // Deep navy black
export const COL_FLOOR       = 0x0c2010;
export const COL_WALL        = 0x160e06;
export const COL_WALL_STRIPE = 0x221610;
export const COL_TRIM        = 0xc9a84c;   // Classic casino gold
export const COL_TRIM_LIGHT  = 0xe8c870;   // Lighter gold for highlights/glows
export const COL_TRIM_DIM    = 0x7a6030;   // Dim gold
export const COL_FELT        = 0x0e380e;
export const COL_TABLE       = 0x4a2e18;
export const COL_BAR         = 0x2e1808;
export const COL_SLOT_BODY   = 0x10103c;
export const COL_SLOT_TRIM   = 0xc9a84c;
export const COL_CHIP        = 0x2ecc71;
export const COL_LOSS        = 0xe74c3c;
export const COL_ALL_IN      = 0xcc44cc;   // magenta badge for all-in players at poker table
export const COL_WHITE       = 0xf0e6d3;
export const COL_GRAY        = 0x889090;
export const COL_GRAY_DIM    = 0x445050;

// ── Palette — Zone Accent Colors ──────────────────────────────────────────────
export const COL_SLOTS_ACCENT     = 0xf5a020;   // Amber (slots)
export const COL_POKER_ACCENT     = 0x3a90e0;   // Blue (poker)
export const COL_BAR_ACCENT       = 0xe06820;   // Orange (bar)
export const COL_BLACKJACK_ACCENT = 0x9b50c0;   // Purple (blackjack)
export const COL_ROULETTE_ACCENT  = 0xcc3333;   // Red (roulette)
export const COL_PLINKO_ACCENT    = 0x20d4a0;   // Teal (plinko)

// ── Palette — UI ──────────────────────────────────────────────────────────────
export const COL_UI_BG        = 0x080f1c;   // Panel background (deep navy)
export const COL_UI_BG2       = 0x0d1828;   // Secondary panel bg
export const COL_UI_BG3       = 0x121e32;   // Tertiary (cards, inner sections)
export const COL_UI_BORDER    = 0xc9a84c;   // Gold border
export const COL_UI_BORDER_DIM = 0x7a6030;  // Dim gold border
export const COL_UI_HOVER     = 0x1c2e44;
export const COL_UI_SELECTED  = 0x263a54;
export const COL_BTN_PRIMARY  = 0x1a5028;   // Green button (deal/confirm)
export const COL_BTN_PRIMARY_H = 0x2a7040;  // Green hover
export const COL_BTN_BLUE     = 0x153862;   // Blue button (stand/fold)
export const COL_BTN_BLUE_H   = 0x255282;   // Blue hover
export const COL_BTN_DANGER   = 0x5a1e1e;   // Red/danger button
export const COL_BTN_DANGER_H = 0x7a2828;   // Red hover
export const COL_BTN_GOLD     = 0x30280a;   // Gold button (SPIN/raise)
export const COL_BTN_GOLD_H   = 0x504014;   // Gold hover

// ── Typography ────────────────────────────────────────────────────────────────
export const FONT = 'monospace';

export const TEXT_XS     = { fontFamily: FONT, fontSize: '9px',  color: '#9090a0' } as const;
export const TEXT_SM     = { fontFamily: FONT, fontSize: '11px', color: '#c8c0b0' } as const;
export const TEXT_MD     = { fontFamily: FONT, fontSize: '14px', color: '#ede0cc' } as const;
export const TEXT_LG     = { fontFamily: FONT, fontSize: '18px', color: '#ede0cc' } as const;
export const TEXT_XL     = { fontFamily: FONT, fontSize: '24px', color: '#ede0cc' } as const;
export const TEXT_GOLD      = { fontFamily: FONT, fontSize: '14px', color: '#c9a84c' } as const;
export const TEXT_GOLD_SM   = { fontFamily: FONT, fontSize: '11px', color: '#c9a84c' } as const;
export const TEXT_GOLD_LG   = { fontFamily: FONT, fontSize: '18px', color: '#c9a84c' } as const;
export const TEXT_GREEN     = { fontFamily: FONT, fontSize: '14px', color: '#2ecc71' } as const;
export const TEXT_RED       = { fontFamily: FONT, fontSize: '14px', color: '#e74c3c' } as const;
export const TEXT_MUTED     = { fontFamily: FONT, fontSize: '11px', color: '#506070' } as const;
export const TEXT_TITLE     = { fontFamily: FONT, fontSize: '28px', color: '#c9a84c', fontStyle: 'bold' } as const;

// ── UI Layout ─────────────────────────────────────────────────────────────────
export const PANEL_RADIUS = 8;    // standard rounded corner radius for panels
export const BTN_RADIUS   = 4;    // standard button corner radius

// ── Animation Timings (ms) ────────────────────────────────────────────────────
export const ANIM_FAST = 120;    // quick feedback
export const ANIM_MED  = 260;    // standard transitions
export const ANIM_SLOW = 480;    // major transitions / panel open/close

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
export const ZONE_ROULETTE   = { x:  30, y: 450, w: 270, h: 130 };
export const ZONE_PLINKO     = { x: 650, y: 450, w: 280, h: 130 };
