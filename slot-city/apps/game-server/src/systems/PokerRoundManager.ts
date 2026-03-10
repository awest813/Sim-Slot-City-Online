import { PokerGameState, Card, BLIND_SCHEDULE } from "@slot-city/shared";
import { createDeck, shuffleDeck, determineWinners } from "./PokerEngine";

export interface PokerPlayer {
  playerId: string;
  username: string;
  chips: number;
  seatIndex: number;
  holeCards: Card[];
  currentBet: number;
  totalBetInRound: number;
  isFolded: boolean;
  isAllIn: boolean;
  isActive: boolean;
  isAI?: boolean;
}

export interface PokerRoundState {
  gameState: PokerGameState;
  players: Map<string, PokerPlayer>;
  communityCards: Card[];
  pot: number;
  currentBet: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  activePlayerSeat: number;
  smallBlind: number;
  bigBlind: number;
  deck: Card[];
  sidePots: Array<{ amount: number; eligiblePlayers: string[] }>;
}

export type RoundEventType =
  | "STATE_CHANGED"
  | "CARD_DEALT"
  | "BET_PLACED"
  | "PLAYER_FOLDED"
  | "ROUND_ENDED"
  | "WINNER_DECLARED";

export interface RoundEvent {
  type: RoundEventType;
  data?: Record<string, unknown>;
}

export type RoundEventCallback = (event: RoundEvent) => void;

export class PokerRoundManager {
  private state: PokerRoundState;
  private onEvent: RoundEventCallback;
  private actionTimer: NodeJS.Timeout | null = null;
  private readonly ACTION_TIMEOUT_MS = 30_000;
  /**
   * Pre-flop only: the Big Blind is entitled to one action (the "option")
   * even after all other players have called. This flag is set when the round
   * starts and cleared as soon as the BB takes their turn or if the BB is
   * all-in (and therefore cannot bet further).
   */
  private bbHasOption: boolean = false;

  constructor(onEvent: RoundEventCallback) {
    this.onEvent = onEvent;
    this.state = this.createInitialState();
  }

  private createInitialState(): PokerRoundState {
    return {
      gameState: PokerGameState.WAITING,
      players: new Map(),
      communityCards: [],
      pot: 0,
      currentBet: 0,
      dealerSeat: 0,
      smallBlindSeat: 1,
      bigBlindSeat: 2,
      activePlayerSeat: -1,
      smallBlind: BLIND_SCHEDULE[0].small,
      bigBlind: BLIND_SCHEDULE[0].big,
      deck: [],
      sidePots: [],
    };
  }

  getState(): PokerRoundState {
    return this.state;
  }

  addPlayer(player: PokerPlayer): void {
    this.state.players.set(player.playerId, { ...player });
  }

  removePlayer(playerId: string): void {
    this.state.players.delete(playerId);
  }

  setBlindLevel(level: number): void {
    const blinds = BLIND_SCHEDULE.find((b) => b.level === level) || BLIND_SCHEDULE[0];
    this.state.smallBlind = blinds.small;
    this.state.bigBlind = blinds.big;
  }

  getActivePlayers(): PokerPlayer[] {
    return Array.from(this.state.players.values()).filter((p) => p.isActive && !p.isFolded);
  }

  getPlayerCount(): number {
    return this.state.players.size;
  }

  /** Returns the active-seat player if they are an AI, otherwise undefined. */
  getActiveAIPlayer(): PokerPlayer | undefined {
    const player = this.getPlayerBySeat(this.state.activePlayerSeat);
    if (player && player.isAI && !player.isFolded && !player.isAllIn) {
      return player;
    }
    return undefined;
  }

  canStartRound(): boolean {
    return this.state.players.size >= 2 && this.state.gameState === PokerGameState.WAITING;
  }

  startRound(): void {
    if (!this.canStartRound()) {
      throw new Error("Cannot start round: not enough players or invalid state");
    }

    const players = Array.from(this.state.players.values())
      .filter((p) => p.chips > 0)
      .sort((a, b) => a.seatIndex - b.seatIndex);

    if (players.length < 2) {
      throw new Error("Not enough players with chips to start");
    }

    // Reset round state
    this.state.deck = shuffleDeck(createDeck());
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.sidePots = [];

    // Reset player state
    for (const p of this.state.players.values()) {
      p.holeCards = [];
      p.currentBet = 0;
      p.totalBetInRound = 0;
      p.isFolded = false;
      p.isAllIn = false;
      p.isActive = p.chips > 0;
    }

    // Rotate dealer
    const activeSeatIndices = players.map((p) => p.seatIndex);
    const currentDealerIdx = activeSeatIndices.indexOf(this.state.dealerSeat);
    const nextDealerIdx = (currentDealerIdx + 1) % activeSeatIndices.length;
    this.state.dealerSeat = activeSeatIndices[nextDealerIdx];

    // Set blinds
    const dealerPos = activeSeatIndices.indexOf(this.state.dealerSeat);
    this.state.smallBlindSeat = activeSeatIndices[(dealerPos + 1) % players.length];
    this.state.bigBlindSeat = activeSeatIndices[(dealerPos + 2) % players.length];

    this.transitionTo(PokerGameState.DEAL);
    this.dealHoleCards();
    this.postBlinds();
    this.transitionTo(PokerGameState.PRE_FLOP);

    // BB gets the option to re-open action pre-flop if they can still bet.
    const bbPlayer = this.getPlayerBySeat(this.state.bigBlindSeat);
    this.bbHasOption = !!(bbPlayer && !bbPlayer.isAllIn);

    this.setNextActivePlayer();
  }

  private dealHoleCards(): void {
    const activePlayers = Array.from(this.state.players.values()).filter((p) => p.isActive);
    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
      for (const p of activePlayers) {
        const card = this.state.deck.pop()!;
        p.holeCards.push(card);
        this.onEvent({ type: "CARD_DEALT", data: { playerId: p.playerId, cardIndex: i } });
      }
    }
  }

  private postBlinds(): void {
    const sbPlayer = this.getPlayerBySeat(this.state.smallBlindSeat);
    const bbPlayer = this.getPlayerBySeat(this.state.bigBlindSeat);

    if (sbPlayer) {
      this.placeBet(sbPlayer, this.state.smallBlind);
    }
    if (bbPlayer) {
      this.placeBet(bbPlayer, this.state.bigBlind);
      this.state.currentBet = this.state.bigBlind;
    }
  }

  private placeBet(player: PokerPlayer, amount: number): void {
    const actual = Math.min(amount, player.chips);
    player.chips -= actual;
    player.currentBet += actual;
    player.totalBetInRound += actual;
    this.state.pot += actual;

    if (player.chips === 0) {
      player.isAllIn = true;
    }
    this.onEvent({ type: "BET_PLACED", data: { playerId: player.playerId, amount: actual } });
  }

  processAction(playerId: string, action: "fold" | "call" | "raise" | "check", amount?: number): boolean {
    if (this.state.gameState === PokerGameState.WAITING || this.state.gameState === PokerGameState.END_ROUND) {
      return false;
    }

    const activePlayer = this.getPlayerBySeat(this.state.activePlayerSeat);
    if (!activePlayer || activePlayer.playerId !== playerId) {
      return false;
    }

    this.clearActionTimer();

    switch (action) {
      case "fold":
        activePlayer.isFolded = true;
        this.onEvent({ type: "PLAYER_FOLDED", data: { playerId } });
        break;

      case "check":
        if (this.state.currentBet > activePlayer.currentBet) {
          return false; // Cannot check with outstanding bet
        }
        break;

      case "call": {
        const callAmount = this.state.currentBet - activePlayer.currentBet;
        if (callAmount > 0) {
          this.placeBet(activePlayer, callAmount);
        }
        break;
      }

      case "raise": {
        if (!amount || amount <= this.state.currentBet) {
          return false;
        }
        const raiseAmount = amount - activePlayer.currentBet;
        this.placeBet(activePlayer, raiseAmount);
        this.state.currentBet = amount;
        break;
      }
    }

    const active = this.getActivePlayers();
    if (active.length <= 1) {
      this.endRound(active[0]?.playerId);
      return true;
    }

    // Clear the BB's pre-flop option as soon as the BB takes any action.
    if (
      this.state.gameState === PokerGameState.PRE_FLOP &&
      activePlayer.seatIndex === this.state.bigBlindSeat
    ) {
      this.bbHasOption = false;
    }

    if (this.isBettingRoundComplete()) {
      this.advanceStreet();
    } else {
      this.setNextActivePlayer();
    }

    return true;
  }

  private isBettingRoundComplete(): boolean {
    const active = this.getActivePlayers().filter((p) => !p.isAllIn);
    if (!active.every((p) => p.currentBet === this.state.currentBet)) {
      return false;
    }
    // Pre-flop: the BB still has their option to raise even when all bets match.
    if (this.state.gameState === PokerGameState.PRE_FLOP && this.bbHasOption) {
      return false;
    }
    return true;
  }

  private advanceStreet(): void {
    // Pre-flop option no longer applies once we advance past the pre-flop street.
    this.bbHasOption = false;

    // Reset bets
    for (const p of this.state.players.values()) {
      p.currentBet = 0;
    }
    this.state.currentBet = 0;

    switch (this.state.gameState) {
      case PokerGameState.PRE_FLOP:
        this.dealCommunityCards(3);
        this.transitionTo(PokerGameState.FLOP);
        break;
      case PokerGameState.FLOP:
        this.dealCommunityCards(1);
        this.transitionTo(PokerGameState.TURN);
        break;
      case PokerGameState.TURN:
        this.dealCommunityCards(1);
        this.transitionTo(PokerGameState.RIVER);
        break;
      case PokerGameState.RIVER:
        this.transitionTo(PokerGameState.SHOWDOWN);
        this.resolveShowdown();
        return;
      default:
        break;
    }

    this.setNextActivePlayer(true);
  }

  private dealCommunityCards(count: number): void {
    // Burn one card
    this.state.deck.pop();
    for (let i = 0; i < count; i++) {
      const card = this.state.deck.pop();
      if (card) {
        this.state.communityCards.push(card);
        this.onEvent({ type: "CARD_DEALT", data: { community: true, card } });
      }
    }
  }

  private resolveShowdown(): void {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) {
      this.transitionTo(PokerGameState.END_ROUND);
      return;
    }

    const eligible = activePlayers.map((p) => ({
      playerId: p.playerId,
      holeCards: p.holeCards,
    }));

    const winners = determineWinners(eligible, this.state.communityCards);
    const share = Math.floor(this.state.pot / winners.length);
    // Remainder (odd chip) goes to the first winner, matching standard casino rules.
    const remainder = this.state.pot % winners.length;

    winners.forEach((winnerId, i) => {
      const award = share + (i === 0 ? remainder : 0);
      const winner = this.state.players.get(winnerId);
      if (winner) {
        winner.chips += award;
      }
      this.onEvent({
        type: "WINNER_DECLARED",
        data: { playerId: winnerId, amount: award, pot: this.state.pot },
      });
    });

    this.state.pot = 0;
    this.endRound();
  }

  private endRound(forcedWinnerId?: string): void {
    if (forcedWinnerId) {
      const winner = this.state.players.get(forcedWinnerId);
      if (winner) {
        winner.chips += this.state.pot;
        this.onEvent({
          type: "WINNER_DECLARED",
          data: { playerId: forcedWinnerId, amount: this.state.pot, pot: this.state.pot },
        });
        this.state.pot = 0;
      }
    }

    this.clearActionTimer();
    this.transitionTo(PokerGameState.END_ROUND);
    this.onEvent({ type: "ROUND_ENDED" });
  }

  private setNextActivePlayer(postBlinds = false): void {
    const active = this.getActivePlayers().filter((p) => !p.isAllIn);
    if (active.length === 0) {
      this.advanceStreet();
      return;
    }

    // Always work with players sorted by seat index so turn order is deterministic.
    const sorted = [...active].sort((a, b) => a.seatIndex - b.seatIndex);
    const allSeats = sorted.map((p) => p.seatIndex);

    let nextSeat: number;
    if (postBlinds) {
      // Post-flop: first active player clockwise from the dealer, starting at SB.
      const sbIdx = allSeats.findIndex((s) => s >= this.state.smallBlindSeat);
      nextSeat = sbIdx >= 0 ? allSeats[sbIdx] : allSeats[0];
    } else if (this.state.activePlayerSeat === -1) {
      // Pre-flop start: first actor is UTG — the first active player after the BB.
      const bbSeat = this.state.bigBlindSeat;
      const utgIdx = allSeats.findIndex((s) => s > bbSeat);
      nextSeat = utgIdx >= 0 ? allSeats[utgIdx] : allSeats[0];
    } else {
      // Mid-round: advance to the next seat clockwise.
      const currentIdx = sorted.findIndex((p) => p.seatIndex === this.state.activePlayerSeat);
      const nextIdx = (currentIdx + 1) % sorted.length;
      nextSeat = sorted[nextIdx].seatIndex;
    }

    this.state.activePlayerSeat = nextSeat;
    this.startActionTimer();
    this.transitionTo(this.state.gameState);
  }

  private startActionTimer(): void {
    this.clearActionTimer();
    this.actionTimer = setTimeout(() => {
      const activePlayer = this.getPlayerBySeat(this.state.activePlayerSeat);
      if (activePlayer) {
        // Auto-fold on timeout
        this.processAction(activePlayer.playerId, "fold");
      }
    }, this.ACTION_TIMEOUT_MS);
  }

  private clearActionTimer(): void {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer);
      this.actionTimer = null;
    }
  }

  private getPlayerBySeat(seatIndex: number): PokerPlayer | undefined {
    return Array.from(this.state.players.values()).find((p) => p.seatIndex === seatIndex);
  }

  private transitionTo(state: PokerGameState): void {
    this.state.gameState = state;
    this.onEvent({ type: "STATE_CHANGED", data: { state } });
  }

  reset(): void {
    this.clearActionTimer();
    this.bbHasOption = false;
    this.state = this.createInitialState();
  }
}
