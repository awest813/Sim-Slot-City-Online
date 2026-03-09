/**
 * LocalStore — browser localStorage wrapper for offline/guest mode.
 * Tracks chip balance and guest username without a server.
 * Intentionally simple — designed to be replaced by server persistence later.
 */

const STORAGE_KEY = "slot_city_v1";

interface LocalSave {
  username: string;
  chips: number;
}

const DEFAULTS: LocalSave = {
  username: "Guest",
  chips: 5000,
};

export const localStore = {
  load(): LocalSave {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LocalSave>) };
      }
    } catch {
      /* ignore parse errors */
    }
    return { ...DEFAULTS };
  },

  save(patch: Partial<LocalSave>): void {
    const current = this.load();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  },

  /**
   * Add or subtract chips. Returns new total (clamped to 0).
   * Pass a negative delta to deduct.
   */
  adjustChips(delta: number): number {
    const data = this.load();
    const next = Math.max(0, data.chips + delta);
    this.save({ chips: next });
    return next;
  },

  setUsername(username: string): void {
    this.save({ username });
  },

  /** Reset to defaults (new guest). */
  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
