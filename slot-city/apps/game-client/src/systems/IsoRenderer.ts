import { ISO_TILE_W, ISO_TILE_H, ISO_ORIGIN_X, ISO_ORIGIN_Y } from "../config/constants";
import { IsoPosition, WorldPosition } from "@slot-city/shared";

/**
 * Convert isometric tile coordinates to screen (world) pixel coordinates.
 * Standard isometric projection: 2:1 ratio tiles.
 */
export function isoToScreen(tileX: number, tileY: number): WorldPosition {
  const x = ISO_ORIGIN_X + (tileX - tileY) * (ISO_TILE_W / 2);
  const y = ISO_ORIGIN_Y + (tileX + tileY) * (ISO_TILE_H / 2);
  return { x, y };
}

/**
 * Convert screen pixel coordinates back to tile coordinates (approximate).
 */
export function screenToIso(screenX: number, screenY: number): IsoPosition {
  const relX = screenX - ISO_ORIGIN_X;
  const relY = screenY - ISO_ORIGIN_Y;
  const tileX = Math.round((relX / (ISO_TILE_W / 2) + relY / (ISO_TILE_H / 2)) / 2);
  const tileY = Math.round((relY / (ISO_TILE_H / 2) - relX / (ISO_TILE_W / 2)) / 2);
  return { tileX, tileY };
}

/**
 * Calculate depth sort value. Higher tileX + tileY = rendered in front.
 */
export function getDepth(tileX: number, tileY: number): number {
  return tileX + tileY;
}

/**
 * Calculate isometric depth from screen position for sorting.
 */
export function getScreenDepth(screenX: number, screenY: number): number {
  const iso = screenToIso(screenX, screenY);
  return getDepth(iso.tileX, iso.tileY);
}
