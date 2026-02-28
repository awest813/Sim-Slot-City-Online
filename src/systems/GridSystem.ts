// ─────────────────────────────────────────────
//  GridSystem – orthographic tile grid
//  Pure math, no Phaser dependency.
// ─────────────────────────────────────────────

export interface GridCell {
    col:       number;
    row:       number;
    walkable:  boolean;
    elevation: number;   // 0 = flat, 1+ = raised
}

export class GridSystem {
    readonly cols:  number;
    readonly rows:  number;
    readonly tileW: number;
    readonly tileH: number;

    private readonly cells: GridCell[][];

    constructor(cols: number, rows: number, tileW: number, tileH: number) {
        this.cols  = cols;
        this.rows  = rows;
        this.tileW = tileW;
        this.tileH = tileH;

        this.cells = Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => ({
                col: c, row: r, walkable: true, elevation: 0,
            }))
        );
    }

    getCell(col: number, row: number): GridCell | undefined {
        return this.cells[row]?.[col];
    }

    inBounds(col: number, row: number): boolean {
        return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
    }

    setWalkable(col: number, row: number, v: boolean): void {
        const cell = this.getCell(col, row);
        if (cell) cell.walkable = v;
    }

    /** Convert grid coords → pixel position (top-left of tile). */
    toScreen(col: number, row: number): { x: number; y: number } {
        return { x: col * this.tileW, y: row * this.tileH };
    }

    /** Convert pixel position → nearest grid coord. */
    fromScreen(sx: number, sy: number): { col: number; row: number } {
        return {
            col: Math.floor(sx / this.tileW),
            row: Math.floor(sy / this.tileH),
        };
    }

    /** Manhattan distance between two cells. */
    distance(c1: number, r1: number, c2: number, r2: number): number {
        return Math.abs(c2 - c1) + Math.abs(r2 - r1);
    }

    /**
     * Returns all walkable cells within Manhattan `range` of (col,row),
     * excluding the origin cell itself.
     */
    reachable(col: number, row: number, range: number): GridCell[] {
        const result: GridCell[] = [];
        for (let r = row - range; r <= row + range; r++) {
            for (let c = col - range; c <= col + range; c++) {
                const dist = this.distance(col, row, c, r);
                if (dist > 0 && dist <= range && this.inBounds(c, r)) {
                    const cell = this.getCell(c, r);
                    if (cell?.walkable) result.push(cell);
                }
            }
        }
        return result;
    }
}
