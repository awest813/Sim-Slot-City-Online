// ─────────────────────────────────────────────
//  Map definitions
//  Tile values: 0 = floor, 1 = wall, 2 = raised
// ─────────────────────────────────────────────

export interface MapDef {
    id:   string;
    name: string;
    cols: number;
    rows: number;
    /** Flat tile array (row-major). Length must equal cols × rows. */
    tiles: number[];
}

export const MAP_DEMO: MapDef = {
    id:   'map_demo',
    name: 'Training Grounds',
    cols: 8,
    rows: 8,
    tiles: [
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 1, 0, 0, 0, 0,
        0, 0, 0, 1, 0, 2, 0, 0,
        0, 0, 0, 0, 0, 2, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0, 1, 0, 0, 0, 0, 1, 0,
        0, 1, 0, 0, 0, 0, 1, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
    ],
};
