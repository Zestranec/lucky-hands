// ─── Responsive preset ───────────────────────────────────────────────────────
// Evaluated once at module-load time (always runs in browser; Node sim doesn't
// import this file, so `typeof window` guard is a safety net only).
const SCREEN_W = typeof window !== 'undefined' ? window.innerWidth : 800;
export const MOBILE = SCREEN_W < 760;

// ─── Canvas ───────────────────────────────────────────────────────────────────
export const CANVAS_W = MOBILE ? 460 : 800;
export const CANVAS_H = MOBILE ? 790 : 722;

// ─── HUD (top bar) ────────────────────────────────────────────────────────────
export const HUD_H     = MOBILE ? 56 : 66;
export const VOL_BAR_H = MOBILE ? 40 : 46;
// VOL_BAR_Y is no longer in the top section — the pill lives at BOTTOM_VOL_Y.

// Pill segmented-control segment width (imported by HUD.ts)
export const VOL_SEG_W = MOBILE ? 110 : 88;

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const GAP_S = MOBILE ? 10 : 12;
export const GAP_M = MOBILE ? 18 : 24;
export const GAP_L = MOBILE ? 24 : 32;

// ─── Tiles ────────────────────────────────────────────────────────────────────
export const NUM_TILES    = 5;
export const TILE_W       = MOBILE ? 130 : 108;
export const TILE_H       = MOBILE ? 155 : 172;
export const TILE_GAP     = 12;
export const TILE_ROW_GAP = MOBILE ? 14 : 0;   // vertical gap between rows (3x2 only)

// ─── Board ────────────────────────────────────────────────────────────────────
export type BoardLayout = '3x2' | '5row';
export const BOARD_LAYOUT = (MOBILE ? '3x2' : '5row') as BoardLayout;

// Board container x/y (set on the Board pixi Container)
const BOARD_ROW1_W  = MOBILE ? 3 * TILE_W + 2 * TILE_GAP : 5 * TILE_W + 4 * TILE_GAP;
export const BOARD_X = MOBILE ? 0 : Math.floor((CANVAS_W - BOARD_ROW1_W) / 2);
export const BOARD_Y = HUD_H + GAP_M;  // vol bar moved to bottom, no longer in top

// Tile positions WITHIN the board container (local coords)
export const TILE_ROW1_X = MOBILE ? Math.floor((CANVAS_W - (3 * TILE_W + 2 * TILE_GAP)) / 2) : 0;
export const TILE_ROW2_X = MOBILE ? Math.floor((CANVAS_W - (2 * TILE_W + TILE_GAP)) / 2) : 0;
export const TILE_ROW2_Y = MOBILE ? TILE_H + TILE_ROW_GAP : 0;

export const BOARD_HEIGHT = MOBILE ? TILE_H * 2 + TILE_ROW_GAP : TILE_H;

// ─── Portal lane (animation strip between board and info label) ──────────────
export const PORTAL_LANE_H = MOBILE ? 80 : 90;
export const PORTAL_LANE_Y = BOARD_Y + BOARD_HEIGHT + GAP_M;

// ─── Info label (hint text between portal lane and controls) ─────────────────
export const INFO_LABEL_Y = PORTAL_LANE_Y + PORTAL_LANE_H + GAP_S;

// ─── Controls column (Play button stacked above Bet selector) ─────────────────
export const CONTROLS_Y  = INFO_LABEL_Y + GAP_L;

export const PLAY_BTN_W  = MOBILE ? 420 : 380;
export const PLAY_BTN_H  = 52;
export const PLAY_BTN_X  = Math.floor((CANVAS_W - PLAY_BTN_W) / 2);
export const PLAY_BTN_Y  = CONTROLS_Y;

// Bet selector sits UNDER the Play button (centred separately)
const BET_SEL_GAP        = 10;   // gap between play bottom and bet top
export const BET_SEL_H   = 38;
export const BET_SEL_W   = 200;
export const BET_SEL_X   = Math.floor((CANVAS_W - BET_SEL_W) / 2);
export const BET_SEL_Y   = PLAY_BTN_Y + PLAY_BTN_H + BET_SEL_GAP;

export const BET_BTN_W      = 38;
export const BET_DISPLAY_W  = BET_SEL_W - 2 * BET_BTN_W - 16;  // 200-76-16 = 108

// ─── Bottom volatility section (anchored to canvas bottom) ───────────────────
export const AUTO_SEL_H = 34;   // height of auto-select button (also used in GameApp)
// The pill is flush with the bottom edge; label sits 22 px above it.
export const BOTTOM_VOL_Y       = CANVAS_H - VOL_BAR_H - GAP_M;
export const BOTTOM_VOL_LABEL_Y = BOTTOM_VOL_Y - 22;

// ─── Colours (shared palette) ────────────────────────────────────────────────
export const COLOR = {
  gold:       0xffd700,
  bgDark:     0x080d18,
  hudBg:      0x0d1526,
  volBarBg:   0x0a1020,
  tileBg:     0x0f1e38,
  tileBorder: 0x2d3a5a,
  rock:       0xef4444,
  paper:      0x60a5fa,
  scissors:   0x4ade80,
  win:        0x4ade80,
  lose:       0xf87171,
  tie:        0xfbbf24,
  textDim:    0x556677,
  textMid:    0x8899aa,
  white:      0xffffff,
} as const;
