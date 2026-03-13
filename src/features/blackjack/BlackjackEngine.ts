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

/**
 * True when the hand is "soft" — i.e. at least one Ace is currently
 * counted as 11 (not reduced to 1).  A soft hand allows a safe extra
 * draw because the Ace can drop to 1 if needed.
 */
export function isSoftHand(cards: Card[]): boolean {
    if (!cards.some(c => c.rank === 14)) return false;
    // Sum treating all Aces as 11; if ≤ 21 at least one Ace is still 11.
    const sumAll11 = cards.reduce(
        (s, c) => s + (c.rank === 14 ? 11 : bjRankValue(c.rank)), 0,
    );
    return sumAll11 <= 21;
}

// ── State types ───────────────────────────────────────────────────────────────

/**
 * 'insurance' — inserted between deal and playing when dealer's up-card
 *               is an Ace and no immediate blackjack occurred.
 */
export type BJPhase  = 'betting' | 'insurance' | 'playing' | 'dealer' | 'result';
export type BJResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | null;

export interface BlackjackState {
    deck:            Card[];
    playerHand:      Card[];   // main (or only) hand
    dealerHand:      Card[];
    phase:           BJPhase;
    bet:             number;   // main hand bet (already deducted by panel)
    result:          BJResult; // main hand result
    dealerRevealed:  boolean;
    // Session stats (persist across hands in one BlackjackPanel session)
    handsPlayed:     number;
    sessionWins:     number;
    sessionLosses:   number;
    sessionPushes:   number;
    // ── Split state ───────────────────────────────────────────────────────────
    splitHand:       Card[] | null; // second hand cards (null = no split)
    splitBet:        number;        // split bet (deducted by panel on split)
    activeHand:      'main' | 'split';
    splitResult:     BJResult;      // split hand result
    // ── Insurance state ───────────────────────────────────────────────────────
    insuranceBet:    number;  // 0 if not taken (deducted by panel)
    insurancePaid:   number;  // chips returned via insurance win (2 × insuranceBet)
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
        splitHand:      null,
        splitBet:       0,
        activeHand:     'main',
        splitResult:    null,
        insuranceBet:   0,
        insurancePaid:  0,
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
            splitHand: null, splitBet: 0, activeHand: 'main', splitResult: null,
            insuranceBet: 0, insurancePaid: 0,
        };
    }

    // Reaching here means at most ONE side has a natural blackjack (both-BJ is handled above).
    const immediateBJ  = playerBJ || dealerBJ;
    const sessionWins  = playerBJ ? state.sessionWins   + 1 : state.sessionWins;
    const sessionLosses= dealerBJ ? state.sessionLosses + 1 : state.sessionLosses;

    // Offer insurance when dealer shows Ace and no immediate blackjack outcome
    const dealerShowsAce = dealerHand[0].rank === 14;
    const phase: BJPhase =
        immediateBJ              ? 'result'    :
        dealerShowsAce           ? 'insurance' :
                                   'playing';
    const result: BJResult = playerBJ ? 'blackjack' : (dealerBJ ? 'lose' : null);

    return {
        ...state,
        deck,
        playerHand,
        dealerHand,
        bet,
        phase,
        result,
        dealerRevealed: immediateBJ,
        handsPlayed:    state.handsPlayed + 1,
        sessionWins,
        sessionLosses,
        sessionPushes:  state.sessionPushes,
        splitHand: null, splitBet: 0, activeHand: 'main', splitResult: null,
        insuranceBet: 0, insurancePaid: 0,
    };
}

// ── Insurance actions ─────────────────────────────────────────────────────────

/**
 * Player takes insurance.  The caller must deduct `insuranceBet` chips
 * (half the original bet, rounded down) from GameState before calling.
 * If dealer has blackjack the insurance pays 2:1 (reflected in chipDelta).
 */
export function takeInsurance(state: BlackjackState, insuranceBet: number): BlackjackState {
    if (state.phase !== 'insurance') return state;
    if (isBlackjack(state.dealerHand)) {
        // Dealer has blackjack: insurance wins, round ends (player main bet is lost)
        return {
            ...state,
            phase:          'result',
            result:         'lose',
            dealerRevealed: true,
            insuranceBet,
            insurancePaid:  insuranceBet * 2,   // 2:1 payout (net +bet)
            sessionLosses:  state.sessionLosses + 1,
        };
    }
    // Dealer doesn't have blackjack: insurance is lost, continue playing
    return { ...state, phase: 'playing', insuranceBet, insurancePaid: 0 };
}

/** Player declines insurance — proceed directly to playing. */
export function declineInsurance(state: BlackjackState): BlackjackState {
    if (state.phase !== 'insurance') return state;
    return { ...state, phase: 'playing' };
}

// ── Split pairs ───────────────────────────────────────────────────────────────

/** True when the player may split (equal-rank pair, first action, no prior split). */
export function canSplit(state: BlackjackState): boolean {
    return (
        state.phase === 'playing' &&
        state.activeHand === 'main' &&
        state.splitHand === null &&
        state.playerHand.length === 2 &&
        state.playerHand[0].rank === state.playerHand[1].rank
    );
}

/**
 * Split the current pair into two independent hands.
 * Caller must deduct `state.bet` chips again (the split bet equals the original).
 */
export function split(state: BlackjackState): BlackjackState {
    if (!canSplit(state)) return state;

    let deck = [...state.deck];
    let nc1: Card, nc2: Card;
    [deck, nc1] = drawOne(deck);
    [deck, nc2] = drawOne(deck);

    const playerHand: Card[] = [state.playerHand[0], nc1];
    const splitHand:  Card[] = [state.playerHand[1], nc2];

    return {
        ...state,
        deck,
        playerHand,
        splitHand,
        splitBet:   state.bet,   // equal to original bet
        activeHand: 'main',
        splitResult: null,
    };
}

// ── Player actions ────────────────────────────────────────────────────────────

/** Player draws one card.  Handles both main and split hands. */
export function hit(state: BlackjackState): BlackjackState {
    if (state.phase !== 'playing') return state;

    let deck = [...state.deck];
    let card: Card;
    [deck, card] = drawOne(deck);

    if (state.activeHand === 'split' && state.splitHand) {
        // ── Acting on split hand ────────────────────────────────────────────
        const splitHand = [...state.splitHand, card];
        if (isBust(splitHand)) {
            if (state.result === 'bust') {
                // Main hand already busted during this split (state.result set in hit() on main);
                // both hands are now bust — skip dealer play and count both losses here.
                return {
                    ...state, deck, splitHand,
                    splitResult:    'bust',
                    phase:          'result',
                    dealerRevealed: true,
                    sessionLosses:  state.sessionLosses + 2,
                };
            }
            // Main hand stood OK; split busted — dealer plays vs main
            return runDealer({ ...state, deck, splitHand, splitResult: 'bust', dealerRevealed: true });
        }
        return { ...state, deck, splitHand };
    } else {
        // ── Acting on main hand ─────────────────────────────────────────────
        const playerHand = [...state.playerHand, card];
        if (isBust(playerHand)) {
            if (state.splitHand !== null) {
                // Main busted during split — switch to split hand, defer stats
                return { ...state, deck, playerHand, result: 'bust', activeHand: 'split' };
            }
            // No split — count loss immediately
            return {
                ...state, deck, playerHand,
                phase:          'result',
                result:         'bust',
                dealerRevealed: true,
                sessionLosses:  state.sessionLosses + 1,
            };
        }
        return { ...state, deck, playerHand };
    }
}

/** Player stands — dealer plays out, result determined. */
export function stand(state: BlackjackState): BlackjackState {
    if (state.phase !== 'playing') return state;

    if (state.activeHand === 'main' && state.splitHand !== null) {
        // Finished main hand; switch to split hand
        return { ...state, activeHand: 'split' };
    }

    // Either no split, or finished both hands — dealer plays
    return runDealer({ ...state, dealerRevealed: true });
}

/**
 * Player doubles bet, draws exactly one card, then dealer plays.
 * Double-down is only permitted on the initial 2-card main hand
 * (splitting disables this option to keep the rules simple).
 */
export function doubleDown(state: BlackjackState): BlackjackState {
    if (state.phase !== 'playing') return state;
    if (state.playerHand.length !== 2) return state;
    if (state.splitHand !== null) return state;  // no double after split

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
        splitHand:      null,
        splitBet:       0,
        activeHand:     'main',
        splitResult:    null,
        insuranceBet:   0,
        insurancePaid:  0,
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

    const dealerVal  = handValue(dealerHand);
    let sessionWins   = state.sessionWins;
    let sessionLosses = state.sessionLosses;
    let sessionPushes = state.sessionPushes;

    // ── Resolve main hand ─────────────────────────────────────────────────────
    // When the main hand busted during split play, hit() set result='bust' but
    // intentionally deferred incrementing sessionLosses (so we count it here,
    // alongside any split-hand outcome, in one place).
    let mainResult: BJResult;
    if (state.result === 'bust') {
        mainResult = 'bust';
        sessionLosses++;  // deferred loss from split-flow bust in hit()
    } else {
        const playerVal = handValue(state.playerHand);
        if (dealerVal > 21 || playerVal > dealerVal) {
            mainResult = 'win';  sessionWins++;
        } else if (playerVal === dealerVal) {
            mainResult = 'push'; sessionPushes++;
        } else {
            mainResult = 'lose'; sessionLosses++;
        }
    }

    // ── Resolve split hand (if present) ──────────────────────────────────────
    let splitResult = state.splitResult;
    if (state.splitHand !== null) {
        if (state.splitResult === 'bust') {
            sessionLosses++;  // split bust deferred from hit()
        } else {
            const splitVal = handValue(state.splitHand);
            if (dealerVal > 21 || splitVal > dealerVal) {
                splitResult = 'win';  sessionWins++;
            } else if (splitVal === dealerVal) {
                splitResult = 'push'; sessionPushes++;
            } else {
                splitResult = 'lose'; sessionLosses++;
            }
        }
    }

    return {
        ...state,
        deck,
        dealerHand,
        phase:          'result',
        result:         mainResult,
        splitResult,
        dealerRevealed: true,
        sessionWins,
        sessionLosses,
        sessionPushes,
    };
}

// ── Chip delta ─────────────────────────────────────────────────────────────────

function singleHandDelta(result: BJResult, bet: number): number {
    switch (result) {
        case 'blackjack': return bet + Math.floor(bet * 1.5);
        case 'win':       return bet * 2;
        case 'push':      return bet;
        default:          return 0;   // lose / bust: already deducted
    }
}

/**
 * Total chips to return to the player at the end of the hand.
 * All bets (main, split, insurance) were already deducted by the panel.
 *
 *  - blackjack: return bet + 1.5× (net +1.5×)
 *  - win:       return bet × 2    (net +1×)
 *  - push:      return bet        (net 0)
 *  - lose/bust: return 0          (net −1×, already deducted)
 *  - insurance win: additionally return 2 × insuranceBet
 */
export function chipDelta(state: BlackjackState): number {
    let delta = singleHandDelta(state.result, state.bet);

    if (state.splitHand !== null) {
        delta += singleHandDelta(state.splitResult, state.splitBet);
    }

    // Insurance payout
    delta += state.insurancePaid;

    return delta;
}
