// Central game state store — kept flat and simple so future multiplayer sync
// can replace local state by swapping this module.

export type Zone = 'entrance' | 'slots' | 'poker' | 'bar' | 'blackjack' | 'floor';
export type InteractionState = 'free' | 'slots' | 'poker' | 'bar' | 'blackjack';

export interface PlayerState {
  displayName: string;
  chips: number;
  zone: Zone;
  interaction: InteractionState;
  seated: boolean;
}

const DEFAULT_PLAYER: PlayerState = {
  displayName: 'Guest',
  chips: 1000,
  zone: 'entrance',
  interaction: 'free',
  seated: false,
};

class GameStateStore {
  private player: PlayerState = { ...DEFAULT_PLAYER };
  private listeners: Array<(state: PlayerState) => void> = [];

  get(): PlayerState {
    return { ...this.player };
  }

  update(partial: Partial<PlayerState>): void {
    this.player = { ...this.player, ...partial };
    this.listeners.forEach(fn => fn(this.get()));
  }

  addChips(amount: number): void {
    this.update({ chips: Math.max(0, this.player.chips + amount) });
  }

  setZone(zone: Zone): void {
    this.update({ zone });
  }

  setInteraction(interaction: InteractionState): void {
    this.update({ interaction, seated: interaction !== 'free' });
  }

  clearInteraction(): void {
    this.update({ interaction: 'free', seated: false });
  }

  subscribe(fn: (state: PlayerState) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  reset(): void {
    this.player = { ...DEFAULT_PLAYER };
    this.listeners.forEach(fn => fn(this.get()));
  }
}

// Singleton
export const GameState = new GameStateStore();
