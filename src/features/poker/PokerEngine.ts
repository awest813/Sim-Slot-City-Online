// ── Poker Engine — Texas Hold'em core logic ──────────────────────────────────

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card { rank: Rank; suit: Suit; }

export function rankLabel(r: Rank): string {
    if (r === 14) return 'A'; if (r === 13) return 'K';
    if (r === 12) return 'Q'; if (r === 11) return 'J';
    return String(r);
}
export function suitSymbol(s: Suit): string {
    return s === 'S' ? '♠' : s === 'H' ? '♥' : s === 'D' ? '♦' : '♣';
}
export function cardLabel(c: Card): string { return rankLabel(c.rank) + suitSymbol(c.suit); }
export function isRed(c: Card): boolean { return c.suit === 'H' || c.suit === 'D'; }

export function shuffledDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of ['S', 'H', 'D', 'C'] as Suit[])
        for (let r = 2; r <= 14; r++) deck.push({ rank: r as Rank, suit });
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// ── Hand Evaluation ───────────────────────────────────────────────────────────

export const HAND_NAMES = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
];

function scoreFive(cs: Card[]): number[] {
    const ranks = cs.map(c => c.rank).sort((a, b) => b - a);
    const suits = cs.map(c => c.suit);
    const flush = suits.every(s => s === suits[0]);
    const freq: Record<number, number> = {};
    for (const r of ranks) freq[r] = (freq[r] ?? 0) + 1;
    const groups = Object.entries(freq)
        .map(([r, c]) => [+r, c] as [number, number])
        .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const pat = groups.map(g => g[1]);
    const kick = groups.map(g => g[0]);
    const uniq = [...new Set(ranks)].sort((a, b) => b - a);
    let straight = false, hi = 0;
    if (uniq.length === 5) {
        if (uniq[0] - uniq[4] === 4) { straight = true; hi = uniq[0]; }
        else if (uniq[0] === 14 && uniq[1] === 5) { straight = true; hi = 5; }
    }
    if (straight && flush) return [8, hi];
    if (pat[0] === 4) return [7, ...kick];
    if (pat[0] === 3 && pat[1] === 2) return [6, ...kick];
    if (flush) return [5, ...ranks];
    if (straight) return [4, hi];
    if (pat[0] === 3) return [3, ...kick];
    if (pat[0] === 2 && pat[1] === 2) return [2, ...kick];
    if (pat[0] === 2) return [1, ...kick];
    return [0, ...ranks];
}

export function cmpScore(a: number[], b: number[]): number {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const d = (a[i] ?? 0) - (b[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

export interface HandResult { score: number[]; name: string; }

export function evalBestHand(cards: Card[]): HandResult {
    if (cards.length < 5) {
        const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
        return { score: [0, ...ranks], name: 'High Card' };
    }
    let best: number[] = [-1];
    // Generate all C(n,5) combinations
    const n = cards.length;
    for (let a = 0; a < n - 4; a++)
        for (let b = a + 1; b < n - 3; b++)
            for (let c = b + 1; c < n - 2; c++)
                for (let d = c + 1; d < n - 1; d++)
                    for (let e = d + 1; e < n; e++) {
                        const s = scoreFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
                        if (cmpScore(s, best) > 0) best = s;
                    }
    return { score: best, name: HAND_NAMES[best[0]] ?? 'High Card' };
}

// ── Game Types ────────────────────────────────────────────────────────────────

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise';

export interface PokerPlayer {
    seatId: number;       // corresponds to UI seat index 0-5
    name: string;
    chips: number;
    holeCards: Card[];
    folded: boolean;
    allIn: boolean;
    roundBet: number;     // amount bet in the current betting round
    isAI: boolean;
}

export interface PokerGameState {
    phase: GamePhase;
    deck: Card[];
    community: Card[];
    players: PokerPlayer[];        // only active players (chips > 0)
    dealerIdx: number;             // index into players[]
    activePlayerIdx: number;       // index into players[] whose turn it is (-1 = none)
    pendingActors: number[];       // indices into players[] still to act this round
    pot: number;
    currentBet: number;            // highest total roundBet this round
    minRaise: number;
    bigBlind: number;
    smallBlind: number;
    handNumber: number;
    statusMessage: string;
    /** Seat IDs of winner(s) after showdown — used for pot-distribution animation. */
    lastWinnerSeatIds: number[];
}

// ── Game Lifecycle ────────────────────────────────────────────────────────────

export function createGame(
    activePlayers: Array<{ seatId: number; name: string; chips: number; isAI: boolean }>,
): PokerGameState {
    return {
        phase: 'waiting',
        deck: [],
        community: [],
        players: activePlayers.map(p => ({
            ...p, holeCards: [], folded: false, allIn: false, roundBet: 0,
        })),
        dealerIdx: 0,
        activePlayerIdx: -1,
        pendingActors: [],
        pot: 0,
        currentBet: 0,
        minRaise: 20,
        bigBlind: 20,
        smallBlind: 10,
        handNumber: 0,
        statusMessage: 'Press Deal to start.',
        lastWinnerSeatIds: [],
    };
}

export function dealHand(state: PokerGameState): PokerGameState {
    const deck = shuffledDeck();
    const players: PokerPlayer[] = state.players
        .filter(p => p.chips > 0)
        .map(p => ({ ...p, holeCards: [], folded: false, allIn: false, roundBet: 0 }));

    if (players.length < 2) return { ...state, statusMessage: 'Need at least 2 players.' };

    // Advance dealer
    const dealerIdx = (state.dealerIdx + 1) % players.length;

    // Deal 2 hole cards per player
    for (let round = 0; round < 2; round++)
        for (const p of players) p.holeCards.push(deck.pop()!);

    // Post blinds
    const n = players.length;
    const sbIdx = n === 2 ? dealerIdx : (dealerIdx + 1) % n;
    const bbIdx = (sbIdx + 1) % n;
    const sb = Math.min(state.smallBlind, players[sbIdx].chips);
    const bb = Math.min(state.bigBlind, players[bbIdx].chips);
    players[sbIdx].chips -= sb; players[sbIdx].roundBet = sb;
    if (players[sbIdx].chips === 0) players[sbIdx].allIn = true;
    players[bbIdx].chips -= bb; players[bbIdx].roundBet = bb;
    if (players[bbIdx].chips === 0) players[bbIdx].allIn = true;
    const pot = sb + bb;

    // Pre-flop: first to act is player after BB; BB is last and gets to re-open action
    const firstIdx = (bbIdx + 1) % n;
    const pendingActors = buildActorQueue(players, firstIdx, dealerIdx);

    return {
        ...state,
        phase: 'preflop',
        deck,
        community: [],
        players,
        dealerIdx,
        pot,
        currentBet: bb,
        minRaise: bb,
        handNumber: state.handNumber + 1,
        pendingActors,
        activePlayerIdx: pendingActors[0] ?? -1,
        statusMessage: `Hand #${state.handNumber + 1} — Blinds ${sb}/${bb} posted`,
    };
}

// Build the ordered list of player indices who need to act, starting from firstIdx
// and looping around. For pre-flop, BB (bbIdx equivalent) is included last.
function buildActorQueue(players: PokerPlayer[], startIdx: number, _dealerIdx: number): number[] {
    const n = players.length;
    const queue: number[] = [];
    for (let off = 0; off < n; off++) {
        const idx = (startIdx + off) % n;
        const p = players[idx];
        if (!p.folded && !p.allIn && p.chips > 0) queue.push(idx);
    }
    return queue;
}

// ── Action Processing ─────────────────────────────────────────────────────────

export function processAction(
    state: PokerGameState,
    action: PlayerAction,
    raiseTotal?: number,
): PokerGameState {
    const players = state.players.map(p => ({ ...p }));
    const actorIdx = state.activePlayerIdx;
    const actor = players[actorIdx];
    let { pot, currentBet, minRaise } = state;
    let msg = '';
    const callAmt = Math.max(0, currentBet - actor.roundBet);

    switch (action) {
        case 'fold':
            actor.folded = true;
            msg = `${actor.name} folds`;
            break;
        case 'check':
            msg = `${actor.name} checks`;
            break;
        case 'call': {
            const amt = Math.min(callAmt, actor.chips);
            actor.chips -= amt; actor.roundBet += amt; pot += amt;
            if (actor.chips === 0) actor.allIn = true;
            msg = `${actor.name} calls ${amt}◈`;
            break;
        }
        case 'raise': {
            const totalBet = raiseTotal ?? (currentBet + minRaise);
            const amt = Math.min(totalBet - actor.roundBet, actor.chips);
            actor.chips -= amt; actor.roundBet += amt; pot += amt;
            if (actor.chips === 0) actor.allIn = true;
            // Preserve minRaise when an all-in is less than a full raise (standard poker rules)
            const raiseIncrement = actor.roundBet - currentBet;
            if (raiseIncrement > 0) minRaise = Math.max(minRaise, raiseIncrement);
            currentBet = Math.max(currentBet, actor.roundBet);
            msg = `${actor.name} raises to ${actor.roundBet}◈`;
            break;
        }
    }

    // Remove actor from pending queue
    let pending = state.pendingActors.filter(i => i !== actorIdx);

    if (action === 'raise') {
        // Everyone except actor needs to act again
        const n = players.length;
        const others: number[] = [];
        for (let off = 1; off < n; off++) {
            const idx = (actorIdx + off) % n;
            const p = players[idx];
            if (!p.folded && !p.allIn && p.chips > 0) others.push(idx);
        }
        pending = others;
    }

    let next: PokerGameState = {
        ...state, players, pot, currentBet, minRaise,
        pendingActors: pending,
        activePlayerIdx: pending[0] ?? -1,
        statusMessage: msg,
    };

    // Check if all-but-one folded
    const remaining = players.filter(p => !p.folded);
    if (remaining.length === 1) {
        return awardPot(next, remaining[0].seatId, `${remaining[0].name} wins ${pot}◈ — everyone folded`);
    }

    // Betting round over?
    if (pending.length === 0) return advancePhase(next);
    return next;
}

// ── Phase Transitions ─────────────────────────────────────────────────────────

function advancePhase(state: PokerGameState): PokerGameState {
    const deck = [...state.deck];
    const community = [...state.community];
    // Reset round bets
    const players = state.players.map(p => ({ ...p, roundBet: 0 }));

    let phase: GamePhase;
    switch (state.phase) {
        case 'preflop':
            deck.pop(); // burn
            community.push(deck.pop()!, deck.pop()!, deck.pop()!);
            phase = 'flop';
            break;
        case 'flop':
            deck.pop();
            community.push(deck.pop()!);
            phase = 'turn';
            break;
        case 'turn':
            deck.pop();
            community.push(deck.pop()!);
            phase = 'river';
            break;
        case 'river':
            return resolveShowdown({ ...state, players });
        default:
            return state;
    }

    // First to act post-flop: first active player left of dealer
    const n = players.length;
    const startIdx = (state.dealerIdx + 1) % n;
    const pending = buildActorQueue(players, startIdx, state.dealerIdx);

    const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);
    const nextState: PokerGameState = {
        ...state, deck, community, players, phase,
        currentBet: 0, minRaise: state.bigBlind,
        pendingActors: pending,
        activePlayerIdx: pending[0] ?? -1,
        statusMessage: `— ${phaseLabel} —`,
    };

    // All remaining active players are all-in — run out remaining streets automatically.
    // Bounded recursion: the switch above returns resolveShowdown() for the 'river' phase
    // before reaching this check, so depth is at most 3 (preflop→flop, flop→turn, turn→river).
    if (pending.length === 0) return advancePhase(nextState);
    return nextState;
}

function resolveShowdown(state: PokerGameState): PokerGameState {
    const active = state.players.filter(p => !p.folded);
    let bestScore: number[] = [-1];
    let winners: PokerPlayer[] = [];

    for (const player of active) {
        const { score } = evalBestHand([...player.holeCards, ...state.community]);
        const cmp = cmpScore(score, bestScore);
        if (cmp > 0) { bestScore = score; winners = [player]; }
        else if (cmp === 0) winners.push(player);
    }

    const players = state.players.map(p => ({ ...p }));
    const share = Math.floor(state.pot / winners.length);
    const remainder = state.pot % winners.length;
    const playerBySeat = new Map(players.map(p => [p.seatId, p]));
    winners.forEach((w, i) => {
        playerBySeat.get(w.seatId)!.chips += share + (i === 0 ? remainder : 0);
    });

    const handName = evalBestHand([...winners[0].holeCards, ...state.community]).name;
    const names = winners.map(w => w.name).join(' & ');
    const msg = winners.length > 1
        ? `${names} split the pot (${state.pot}◈) — ${handName}`
        : `${names} wins ${state.pot}◈ with ${handName}!`;

    return { ...state, players, phase: 'showdown', activePlayerIdx: -1, pendingActors: [],
        statusMessage: msg, lastWinnerSeatIds: winners.map(w => w.seatId) };
}

function awardPot(state: PokerGameState, winnerSeatId: number, msg: string): PokerGameState {
    const players = state.players.map(p => ({ ...p }));
    const winner = players.find(p => p.seatId === winnerSeatId)!;
    winner.chips += state.pot;
    return { ...state, players, phase: 'showdown', activePlayerIdx: -1, pendingActors: [],
        statusMessage: msg, lastWinnerSeatIds: [winnerSeatId] };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the seat ID whose turn it is (-1 if none) */
export function activeSeatId(state: PokerGameState): number {
    if (state.activePlayerIdx < 0) return -1;
    return state.players[state.activePlayerIdx]?.seatId ?? -1;
}

/** How much the given player needs to call */
export function callAmount(state: PokerGameState, playerIdx: number): number {
    return Math.max(0, state.currentBet - (state.players[playerIdx]?.roundBet ?? 0));
}
