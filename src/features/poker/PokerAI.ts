// ── Poker AI — rule-based decision making ────────────────────────────────────
import { PokerGameState, PokerPlayer, PlayerAction, evalBestHand, callAmount } from './PokerEngine';

// ── Personality system ────────────────────────────────────────────────────────

/**
 * Each AI seat can have a distinct personality that adjusts thresholds and
 * play-style tendencies. All fields have sensible defaults via DEFAULT_PERSONALITY.
 */
export interface AIPersonality {
    /** Hand-strength required before raising (0–1). Lower = raises more often. */
    raiseThreshold: number;
    /** Base fold threshold before pot-odds adjustment (0–1). Lower = looser. */
    foldThresholdBase: number;
    /** Half-amplitude of gaussian noise added to raw strength (±noiseScale). */
    noiseScale: number;
    /** Probability of a random "bluff" raise, ignoring hand strength. */
    bluffChance?: number;
    /** Multiplier applied to raise sizes (>1 = bigger bets). */
    raiseSizeBoost?: number;
}

/** Mirrors original behaviour exactly — used as the fallback. */
export const DEFAULT_PERSONALITY: AIPersonality = {
    raiseThreshold:    0.68,
    foldThresholdBase: 0.28,
    noiseScale:        0.09,
};

/** Tight / patient — only raises premiums, folds borderline hands quickly. */
export const PERSONALITY_TIGHT: AIPersonality = {
    raiseThreshold:    0.76,
    foldThresholdBase: 0.34,
    noiseScale:        0.06,
};

/** Bluffer / unpredictable — raises often, rarely folds, occasional pure bluffs. */
export const PERSONALITY_BLUFFER: AIPersonality = {
    raiseThreshold:    0.55,
    foldThresholdBase: 0.20,
    noiseScale:        0.22,
    bluffChance:       0.12,
};

/** Aggressive / loose — very hard to bluff off a hand; bets big. */
export const PERSONALITY_AGGRESSIVE: AIPersonality = {
    raiseThreshold:    0.52,
    foldThresholdBase: 0.18,
    noiseScale:        0.12,
    raiseSizeBoost:    1.5,
};

// ── Pre-flop hand strength (0–1) based on hole cards only ────────────────────

function preflopStrength(player: PokerPlayer): number {
    const [c1, c2] = player.holeCards;
    if (!c1 || !c2) return 0;
    const hi = Math.max(c1.rank, c2.rank);
    const lo = Math.min(c1.rank, c2.rank);
    const suited = c1.suit === c2.suit;
    const isPair = hi === lo;
    const gap = hi - lo;

    if (isPair) {
        if (hi >= 14) return 1.00;  // AA
        if (hi >= 13) return 0.95;  // KK
        if (hi >= 11) return 0.85;  // QQ/JJ
        if (hi >= 8)  return 0.65;  // 88–TT
        return 0.45;                // 22–77
    }
    if (hi === 14) {
        if (lo >= 13) return 0.90;  // AK
        if (lo >= 12) return 0.82;  // AQ
        if (lo >= 11) return 0.74;  // AJ
        if (lo >= 10) return 0.65;  // AT
        return suited ? 0.50 : 0.35;
    }
    if (hi === 13) {
        if (lo >= 12) return suited ? 0.72 : 0.62;  // KQ
        if (lo >= 11) return suited ? 0.62 : 0.52;  // KJ
        return suited ? 0.45 : 0.32;
    }
    if (gap <= 1 && hi >= 9) return suited ? 0.58 : 0.42;  // connected high
    if (gap <= 2 && hi >= 9 && suited) return 0.48;
    return 0.15 + (hi + lo) / 220;
}

// ── Post-flop hand strength (0–1) using best-hand evaluation ─────────────────

function postflopStrength(player: PokerPlayer, community: typeof player.holeCards): number {
    const cards = [...player.holeCards, ...community];
    if (cards.length < 5) return preflopStrength(player);
    const { score } = evalBestHand(cards);
    const cat = score[0];
    const strengths = [0.08, 0.32, 0.58, 0.72, 0.80, 0.86, 0.92, 0.97, 1.00];
    return strengths[cat] ?? 0.08;
}

// ── Main decision function ────────────────────────────────────────────────────

export interface AIDecision {
    action: PlayerAction;
    raiseTotal?: number;  // total bet amount when raising
}

export function getAIDecision(
    state: PokerGameState,
    playerIdx: number,
    personality: AIPersonality = DEFAULT_PERSONALITY,
): AIDecision {
    const player = state.players[playerIdx];
    const { phase, community, currentBet, minRaise, pot } = state;
    const toCall = callAmount(state, playerIdx);
    const canCheck = toCall === 0;

    // Occasional bluff: raise regardless of hand strength
    if (personality.bluffChance && Math.random() < personality.bluffChance && player.chips > toCall) {
        const sizeMult = 1 + (personality.raiseSizeBoost ?? 1);
        const raiseTotal = Math.min(
            player.chips + player.roundBet,
            currentBet + minRaise * sizeMult,
        );
        if (raiseTotal > currentBet) {
            return { action: 'raise', raiseTotal };
        }
    }

    const rawStrength = phase === 'preflop'
        ? preflopStrength(player)
        : postflopStrength(player, community);

    // Add personality noise so AI isn't perfectly deterministic
    const noise = (Math.random() - 0.5) * personality.noiseScale * 2;
    const strength = Math.max(0, Math.min(1, rawStrength + noise));

    // Pot-odds adjustment: cheaper to call → lower threshold to continue
    const potOdds = pot > 0 ? toCall / (pot + toCall) : 0;
    const foldThreshold = personality.foldThresholdBase + potOdds * 0.25;
    const raiseThreshold = personality.raiseThreshold;

    if (strength >= raiseThreshold && player.chips > toCall) {
        // Decide raise size: 1–3× big blind above current bet, scaled by personality
        const baseMult = strength > 0.85 ? 3 : strength > 0.75 ? 2 : 1;
        const mult = baseMult * (personality.raiseSizeBoost ?? 1);
        const raiseTotal = Math.min(
            player.chips + player.roundBet,
            currentBet + minRaise * mult,
        );
        if (raiseTotal > currentBet) {
            return { action: 'raise', raiseTotal };
        }
    }

    if (strength >= foldThreshold) {
        return { action: canCheck ? 'check' : 'call' };
    }

    // Weak hand
    if (canCheck) return { action: 'check' };
    return { action: 'fold' };
}
