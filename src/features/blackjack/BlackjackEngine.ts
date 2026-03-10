// ── Blackjack Engine — pure game logic, no Phaser dependency ─────────────────
// Re-uses Card / Suit / Rank types from PokerEngine so the two share one deck.

import { Card, Rank, Suit, shuffledDeck, rankLabel, suitSymbol } from '../poker/PokerEngine';

export type { Card, Rank, Suit };

// ── Card helpers ──────────────────────────────────────────────────────────────

export function cardLabel(c: Card): string { return rankLabel(c.rank) + suitSymbol(c.suit); }
export function isRed(c: Card): boolean { return c.suit === 'H' || c.suit === 'D'; }

// Blackjack numeric value for a single card rank.
export function bjRankValue(r: Rank): number {
    if (r === 14) return 11;   // Ace starts at 11
    if (r >= 11)  return 10;   // J (11), Q (12), K (13)
    return r;                  // 2–10
}

// Total hand value — Aces reduced from 11→1 as needed to avoid bust.
export function handValue(cards: Card[]): number {
    let total = 0;
    let aces  = 0;
    for (const c of cards) {
        if (c.rank === 14) { aces++; total += 11; }
        else                 total += bjRankValue(c.rank);
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

export function isBlackjack(cards: Card[]): boolean {
    return cards.length === 2 && handValue(cards) === 21;
}
export function isBust(cards: Card[]): boolean { return handValue(cards) > 21; }

// ── State types ───────────────────────────────────────────────────────────────

export type BJPhase  = 'betting' | 'playing' | 'dealer' | 'result';
export type BJResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | null;

export interface BlackjackState {
    deck:            Card[];
    playerHand:      Card[];
    dealerHand:      Card[];
    phase:           BJPhase;
    bet:             number;
    result:          BJResult;
    dealerRevealed:  boolean;
    // Session stats (persist across hands in one BlackjackPanel session)
    handsPlayed:     number;
    sessionWins:     number;
    sessionLosses:   number;
    sessionPushes:   number;
}

// ── Factories ─────────────────────────────────────────────────────────────────

export function createGame(): BlackjackState {
    return {
        deck:           shuffledDeck(),
        playerHand:     [],
        dealerHand:     [],
        phase:          'betting',
        bet:            0,
        result:         null,
        dealerRevealed: false,
        handsPlayed:    0,
        sessionWins:    0,
        sessionLosses:  0,
        sessionPushes:  0,
    };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function drawOne(deck: Card[]): [Card[], Card] {
    if (deck.length === 0) deck = shuffledDeck();
    return [deck.slice(1), deck[0]];
}

function freshDeckIfNeeded(deck: Card[]): Card[] {
    return deck.length < 15 ? shuffledDeck() : deck;
}

// ── Public actions ────────────────────────────────────────────────────────────

/** Start a new hand: deduct bet from pot (caller handles GameState), deal 4 cards. */
export function deal(state: BlackjackState, bet: number): BlackjackState {
    let deck = freshDeckIfNeeded([...state.deck]);

    let c1: Card, c2: Card, c3: Card, c4: Card;
    [deck, c1] = drawOne(deck);
    [deck, c2] = drawOne(deck);
    [deck, c3] = drawOne(deck);
    [deck, c4] = drawOne(deck);

    const playerHand: Card[] = [c1, c3];
    const dealerHand: Card[] = [c2, c4];

    const playerBJ = isBlackjack(playerHand);
    const dealerBJ = isBlackjack(dealerHand);

    // Both have blackjack → push (return bet, no 1.5× bonus)
    if (playerBJ && dealerBJ) {
        return {
            ...state,
            deck,
            playerHand,
            dealerHand,
            bet,
            phase:          'result',
            result:         'push',
            dealerRevealed: true,
            handsPlayed:    state.handsPlayed + 1,
            sessionPushes:  state.sessionPushes + 1,
        };
    }

    return {
        ...state,
        deck,
        playerHand,
        dealerHand,
        bet,
        phase:          playerBJ ? 'result' : 'playing',
        result:         playerBJ ? 'blackjack' : null,
        dealerRevealed: playerBJ,
        handsPlayed:    state.handsPlayed + 1,
        sessionWins:    playerBJ ? state.sessionWins + 1 : state.sessionWins,
    };
}

/** Player draws one card.  Returns updated state (possibly with bust result). */
export function hit(state: BlackjackState): BlackjackState {
    if (state.phase !== 'playing') return state;

    let deck = [...state.deck];
    let card: Card;
    [deck, card] = drawOne(deck);
    const playerHand = [...state.playerHand, card];

    if (isBust(playerHand)) {
        return {
            ...state,
            deck,
            playerHand,
            phase:          'result',
            result:         'bust',
            dealerRevealed: true,
            sessionLosses:  state.sessionLosses + 1,
        };
    }
    return { ...state, deck, playerHand };
}

/** Player stands — dealer plays out, result determined. */
export function stand(state: BlackjackState): BlackjackState {
    if (state.phase !== 'playing') return state;
    return runDealer({ ...state, dealerRevealed: true });
}

/** Player doubles bet, draws one card, then dealer plays. */
export function doubleDown(state: BlackjackState): BlackjackState {
    if (state.phase !== 'playing' || state.playerHand.length !== 2) return state;

    let deck = [...state.deck];
    let card: Card;
    [deck, card] = drawOne(deck);
    const playerHand = [...state.playerHand, card];
    const newBet = state.bet * 2;

    if (isBust(playerHand)) {
        return {
            ...state,
            deck,
            playerHand,
            bet:            newBet,
            phase:          'result',
            result:         'bust',
            dealerRevealed: true,
            sessionLosses:  state.sessionLosses + 1,
        };
    }

    return runDealer({
        ...state,
        deck,
        playerHand,
        bet:            newBet,
        dealerRevealed: true,
    });
}

/** Reset to betting phase, keeping session stats and leftover deck. */
export function nextHand(state: BlackjackState): BlackjackState {
    return {
        ...state,
        playerHand:     [],
        dealerHand:     [],
        phase:          'betting',
        bet:            0,
        result:         null,
        dealerRevealed: false,
    };
}

// ── Dealer AI ─────────────────────────────────────────────────────────────────

// Dealer must stand on 17+, hit on 16 or below (hard 17 rule).
function runDealer(state: BlackjackState): BlackjackState {
    let deck       = [...state.deck];
    let dealerHand = [...state.dealerHand];

    while (handValue(dealerHand) < 17) {
        let card: Card;
        [deck, card] = drawOne(deck);
        dealerHand = [...dealerHand, card];
    }

    const playerVal = handValue(state.playerHand);
    const dealerVal = handValue(dealerHand);

    let result: BJResult;
    let sessionWins    = state.sessionWins;
    let sessionLosses  = state.sessionLosses;
    let sessionPushes  = state.sessionPushes;

    if (dealerVal > 21 || playerVal > dealerVal) {
        result = 'win';    sessionWins++;
    } else if (playerVal === dealerVal) {
        result = 'push';   sessionPushes++;
    } else {
        result = 'lose';   sessionLosses++;
    }

    return {
        ...state,
        deck,
        dealerHand,
        phase:          'result',
        result,
        dealerRevealed: true,
        sessionWins,
        sessionLosses,
        sessionPushes,
    };
}

// ── Chip delta ─────────────────────────────────────────────────────────────────

/**
 * Net chip change for the player given the hand result.
 * Positive = player gains chips (net), negative = player loses.
 * Bet was already deducted on deal, so:
 *  - blackjack: return bet + 1.5× (net +1.5×)
 *  - win:       return bet × 2 (net +1×)
 *  - push:      return bet    (net 0)
 *  - lose/bust: return 0      (net −1×, already deducted)
 */
export function chipDelta(state: BlackjackState): number {
    switch (state.result) {
        case 'blackjack': return state.bet + Math.floor(state.bet * 1.5);
        case 'win':       return state.bet * 2;
        case 'push':      return state.bet;
        default:          return 0;
    }
}
