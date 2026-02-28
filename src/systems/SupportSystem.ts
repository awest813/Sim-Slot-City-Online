// ─────────────────────────────────────────────
//  SupportSystem – tracks affinity between unit pairs.
//  Rank up fires when thresholds are crossed.
// ─────────────────────────────────────────────

export type SupportRank = 'C' | 'B' | 'A' | 'S';

export interface SupportEntry {
    unitIdA: string;
    unitIdB: string;
    points:  number;
    rank:    SupportRank;
}

const THRESHOLDS: Record<SupportRank, number> = { C: 0, B: 20, A: 50, S: 90 };

export class SupportSystem {
    private readonly entries = new Map<string, SupportEntry>();

    private key(a: string, b: string): string {
        return [a, b].sort().join('::');
    }

    getEntry(unitIdA: string, unitIdB: string): SupportEntry {
        const k = this.key(unitIdA, unitIdB);
        if (!this.entries.has(k)) {
            this.entries.set(k, { unitIdA, unitIdB, points: 0, rank: 'C' });
        }
        return this.entries.get(k)!;
    }

    /**
     * Add support points. Returns the new rank if a rank-up occurred,
     * or null if rank is unchanged.
     */
    addPoints(unitIdA: string, unitIdB: string, pts: number): SupportRank | null {
        const entry = this.getEntry(unitIdA, unitIdB);
        entry.points = Math.min(entry.points + pts, 140);
        const newRank = this.calcRank(entry.points);
        if (newRank !== entry.rank) {
            entry.rank = newRank;
            return newRank;
        }
        return null;
    }

    private calcRank(pts: number): SupportRank {
        if (pts >= THRESHOLDS.S) return 'S';
        if (pts >= THRESHOLDS.A) return 'A';
        if (pts >= THRESHOLDS.B) return 'B';
        return 'C';
    }
}
