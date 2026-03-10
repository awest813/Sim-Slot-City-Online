// ── Server-side Blackjack Engine ──────────────────────────────────────────────
// Pure TypeScript — no Colyseus / Phaser dependency.
// Uses @slot-city/shared Card types for consistency with the poker engine.

import { Card, CardSuit, CardRank, BlackjackResult } from "@slot-city/shared";

// ── Deck helpers ──────────────────────────────────────────────────────────────

/** Create an unshuffled 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of Object.values(CardSuit)) {
    for (const rank of Object.values(CardRank)) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/** Return a new shuffled copy (Fisher-Yates). Does not mutate the input. */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ── Card value ────────────────────────────────────────────────────────────────

export function rankValue(rank: CardRank): number {
  switch (rank) {
    case CardRank.ACE:                              return 11;
    case CardRank.KING:
    case CardRank.QUEEN:
    case CardRank.JACK:
    case CardRank.TEN:                              return 10;
    case CardRank.NINE:                             return 9;
    case CardRank.EIGHT:                            return 8;
    case CardRank.SEVEN:                            return 7;
    case CardRank.SIX:                              return 6;
    case CardRank.FIVE:                             return 5;
    case CardRank.FOUR:                             return 4;
    case CardRank.THREE:                            return 3;
    case CardRank.TWO:                              return 2;
    default:                                        return 0;
  }
}

/** Calculate best (non-busting) hand value for a set of cards. */
export function handValue(cards: Card[]): number {
  let total = 0;
  let aces  = 0;
  for (const card of cards) {
    const v = rankValue(card.rank);
    if (card.rank === CardRank.ACE) aces++;
    total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards) > 21;
}

// ── Game state ────────────────────────────────────────────────────────────────

export enum BJServerPhase {
  WAITING     = "WAITING",
  BETTING     = "BETTING",
  PLAYER_TURN = "PLAYER_TURN",
  DEALER_TURN = "DEALER_TURN",
  RESULT      = "RESULT",
}

export interface BJServerPlayer {
  playerId: string;
  username: string;
  chips:    number;
  hand:     Card[];
  bet:      number;
  result:   BlackjackResult;
  isActive: boolean;
  hasActed: boolean;
  seatIndex: number;
}

export interface BJServerState {
  phase:          BJServerPhase;
  deck:           Card[];
  dealerHand:     Card[];
  players:        BJServerPlayer[];
  dealerRevealed: boolean;
  roundId:        number;
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createServerGame(): BJServerState {
  return {
    phase:          BJServerPhase.WAITING,
    deck:           shuffleDeck(createDeck()),
    dealerHand:     [],
    players:        [],
    dealerRevealed: false,
    roundId:        0,
  };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function drawOne(deck: Card[]): [Card[], Card] {
  if (deck.length < 10) deck = shuffleDeck(createDeck());
  return [deck.slice(1), deck[0]];
}

function updatePlayer(
  state: BJServerState,
  playerId: string,
  patch: Partial<BJServerPlayer>,
): BJServerState {
  return {
    ...state,
    players: state.players.map(p =>
      p.playerId === playerId ? { ...p, ...patch } : p,
    ),
  };
}

// ── Player management ─────────────────────────────────────────────────────────

type NewBJPlayer = Omit<BJServerPlayer, "hand" | "bet" | "result" | "hasActed" | "isActive">;

export function addPlayer(state: BJServerState, player: NewBJPlayer): BJServerState {
  if (state.players.find(p => p.playerId === player.playerId)) return state;
  return {
    ...state,
    players: [...state.players, {
      ...player,
      hand:     [],
      bet:      0,
      result:   null,
      hasActed: false,
      isActive: false,
    }],
  };
}

export function removePlayer(state: BJServerState, playerId: string): BJServerState {
  return { ...state, players: state.players.filter(p => p.playerId !== playerId) };
}

// ── Betting ───────────────────────────────────────────────────────────────────

/**
 * Accept a bet from a player during the BETTING phase.
 * Returns null if the action is invalid (wrong phase / insufficient chips / duplicate bet).
 */
export function placeBet(
  state: BJServerState,
  playerId: string,
  amount: number,
  minBet: number,
  maxBet: number,
): BJServerState | null {
  if (state.phase !== BJServerPhase.BETTING) return null;
  const player = state.players.find(p => p.playerId === playerId);
  if (!player) return null;
  if (player.hasActed) return null;          // already bet this round
  if (amount < minBet || amount > maxBet) return null;
  if (amount > player.chips) return null;

  return updatePlayer(state, playerId, {
    bet:      amount,
    chips:    player.chips - amount,
    hasActed: true,
  });
}

// ── Dealing ───────────────────────────────────────────────────────────────────

/**
 * Deal initial hands to all players who have placed a bet.
 * Transitions phase to PLAYER_TURN (or RESULT if all players have blackjack).
 */
export function dealHands(state: BJServerState): BJServerState {
  let deck = [...state.deck];

  const activePlayers = state.players.filter(p => p.bet > 0);
  if (activePlayers.length === 0) return state;

  // Deal two cards to each player and to the dealer
  const updatedPlayers = state.players.map(p => ({ ...p, hand: [] as Card[] }));

  // Deal round 1
  for (const p of updatedPlayers) {
    if (p.bet > 0) {
      let card: Card;
      [deck, card] = drawOne(deck);
      p.hand = [card];
    }
  }

  let dealerHand: Card[] = [];
  let dc1: Card;
  [deck, dc1] = drawOne(deck);
  dealerHand = [dc1];

  // Deal round 2
  for (const p of updatedPlayers) {
    if (p.bet > 0) {
      let card: Card;
      [deck, card] = drawOne(deck);
      p.hand = [...p.hand, card];
      p.isActive = true;
      p.hasActed = false;
    }
  }

  let dc2: Card;
  [deck, dc2] = drawOne(deck);
  dealerHand = [...dealerHand, dc2];

  // Resolve any immediate blackjacks
  const resolvedPlayers = updatedPlayers.map(p => {
    if (p.bet > 0 && isBlackjack(p.hand)) {
      const payout = p.bet + Math.floor(p.bet * 1.5);
      return { ...p, result: "blackjack" as BlackjackResult, chips: p.chips + payout, hasActed: true };
    }
    return p;
  });

  // If every active player already has blackjack, jump to RESULT
  const allDone = resolvedPlayers.filter(p => p.bet > 0).every(p => p.hasActed);

  return {
    ...state,
    deck,
    dealerHand,
    players:        resolvedPlayers,
    phase:          allDone ? BJServerPhase.RESULT : BJServerPhase.PLAYER_TURN,
    dealerRevealed: allDone,
    roundId:        state.roundId + 1,
  };
}

// ── Player actions ────────────────────────────────────────────────────────────

/**
 * Process a HIT action.
 * Returns null if the action is not valid for the given player.
 */
export function playerHit(state: BJServerState, playerId: string): BJServerState | null {
  if (state.phase !== BJServerPhase.PLAYER_TURN) return null;
  const player = state.players.find(p => p.playerId === playerId && !p.hasActed && p.isActive);
  if (!player) return null;

  let deck = [...state.deck];
  let card: Card;
  [deck, card] = drawOne(deck);
  const hand = [...player.hand, card];

  const bust = isBust(hand);
  let newState = updatePlayer({ ...state, deck }, playerId, {
    hand,
    result:   bust ? "bust" : null,
    hasActed: bust,
  });

  if (bust) newState = advanceIfRoundOver(newState);
  return newState;
}

/**
 * Process a STAND action.
 */
export function playerStand(state: BJServerState, playerId: string): BJServerState | null {
  if (state.phase !== BJServerPhase.PLAYER_TURN) return null;
  const player = state.players.find(p => p.playerId === playerId && !p.hasActed && p.isActive);
  if (!player) return null;

  let newState = updatePlayer(state, playerId, { hasActed: true });
  newState = advanceIfRoundOver(newState);
  return newState;
}

/**
 * Process a DOUBLE DOWN action — double bet, draw one card, then stand.
 */
export function playerDouble(state: BJServerState, playerId: string): BJServerState | null {
  if (state.phase !== BJServerPhase.PLAYER_TURN) return null;
  const player = state.players.find(p => p.playerId === playerId && !p.hasActed && p.isActive);
  if (!player || player.hand.length !== 2 || player.chips < player.bet) return null;

  let deck = [...state.deck];
  let card: Card;
  [deck, card] = drawOne(deck);
  const hand    = [...player.hand, card];
  const newBet  = player.bet * 2;
  const bust    = isBust(hand);

  let newState = updatePlayer({ ...state, deck }, playerId, {
    hand,
    bet:      newBet,
    chips:    player.chips - player.bet,  // deduct second half
    result:   bust ? "bust" : null,
    hasActed: true,
  });

  newState = advanceIfRoundOver(newState);
  return newState;
}

// ── Dealer play ───────────────────────────────────────────────────────────────

/**
 * Run the dealer hand.  Called automatically when all players have acted.
 * Dealer stands on 17+.
 */
export function runDealer(state: BJServerState): BJServerState {
  if (state.phase !== BJServerPhase.DEALER_TURN) return state;

  let deck       = [...state.deck];
  let dealerHand = [...state.dealerHand];

  while (handValue(dealerHand) < 17) {
    let card: Card;
    [deck, card] = drawOne(deck);
    dealerHand   = [...dealerHand, card];
  }

  const dealerVal = handValue(dealerHand);

  // Settle remaining (non-busted, non-blackjack) players
  const players = state.players.map(p => {
    if (!p.isActive || p.result !== null) return p;  // already settled

    const playerVal = handValue(p.hand);
    let result: BlackjackResult;
    let chips = p.chips;

    if (dealerVal > 21 || playerVal > dealerVal) {
      result  = "win";
      chips  += p.bet * 2;
    } else if (playerVal === dealerVal) {
      result  = "push";
      chips  += p.bet;              // return bet
    } else {
      result  = "lose";
      // chips unchanged (bet already deducted at placement)
    }

    return { ...p, result, chips };
  });

  return {
    ...state,
    deck,
    dealerHand,
    players,
    phase:          BJServerPhase.RESULT,
    dealerRevealed: true,
  };
}

/** Reset to BETTING phase for the next round. Preserves player chip counts. */
export function resetRound(state: BJServerState): BJServerState {
  return {
    ...state,
    dealerHand:     [],
    dealerRevealed: false,
    phase:          BJServerPhase.BETTING,
    players:        state.players.map(p => ({
      ...p,
      hand:     [],
      bet:      0,
      result:   null,
      hasActed: false,
      isActive: false,
    })),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Advance to DEALER_TURN if all active players have acted; run dealer immediately. */
function advanceIfRoundOver(state: BJServerState): BJServerState {
  const activePlayers = state.players.filter(p => p.isActive && p.bet > 0);
  const allActed      = activePlayers.every(p => p.hasActed);
  if (!allActed) return state;

  // All non-bust players need dealer resolution
  const anyUnresolved = activePlayers.some(p => p.result === null || p.result === undefined);
  if (!anyUnresolved) {
    return { ...state, phase: BJServerPhase.RESULT, dealerRevealed: true };
  }

  return runDealer({ ...state, phase: BJServerPhase.DEALER_TURN, dealerRevealed: true });
}
