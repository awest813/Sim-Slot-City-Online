import { Card, CardRank, CardSuit } from "@slot-city/shared";
import { getBestHand } from "./PokerEngine";
import { PokerPlayer, PokerRoundState } from "./PokerRoundManager";

// ─────────────────────────────────────────────
//  AI Action type
// ─────────────────────────────────────────────

export interface AIAction {
  action: "fold" | "call" | "raise" | "check";
  amount?: number;
}

// ─────────────────────────────────────────────
//  Hand strength helpers
// ─────────────────────────────────────────────

const RANK_ORDER: Record<CardRank, number> = {
  [CardRank.TWO]: 2,
  [CardRank.THREE]: 3,
  [CardRank.FOUR]: 4,
  [CardRank.FIVE]: 5,
  [CardRank.SIX]: 6,
  [CardRank.SEVEN]: 7,
  [CardRank.EIGHT]: 8,
  [CardRank.NINE]: 9,
  [CardRank.TEN]: 10,
  [CardRank.JACK]: 11,
  [CardRank.QUEEN]: 12,
  [CardRank.KING]: 13,
  [CardRank.ACE]: 14,
};

/**
 * Estimate pre-flop hand strength (0–100).
 * Higher = stronger starting hand.
 */
function preFlopStrength(holeCards: Card[]): number {
  if (holeCards.length < 2) return 0;

  const [a, b] = holeCards.map((c) => RANK_ORDER[c.rank]).sort((x, y) => y - x);
  const suited = holeCards[0].suit === holeCards[1].suit;
  const isPair = a === b;

  if (isPair) {
    // Pairs: AA=100, KK=95, QQ=90, JJ=85, TT=80, 99=70, 88=65, 77-22=55-30
    if (a >= 14) return 100;
    if (a >= 13) return 95;
    if (a >= 12) return 90;
    if (a >= 11) return 85;
    if (a >= 10) return 80;
    if (a >= 9) return 70;
    if (a >= 8) return 65;
    return 30 + (a - 2) * 5;
  }

  // AK suited = 78, AK offsuit = 72
  if (a === 14 && b === 13) return suited ? 78 : 72;
  if (a === 14 && b === 12) return suited ? 74 : 66;
  if (a === 14 && b === 11) return suited ? 72 : 64;
  if (a === 14 && b === 10) return suited ? 68 : 60;
  if (a === 13 && b === 12) return suited ? 68 : 60;
  if (a === 13 && b === 11) return suited ? 64 : 56;
  if (a === 13 && b === 10) return suited ? 60 : 52;
  if (a === 12 && b === 11) return suited ? 60 : 52;
  if (a === 12 && b === 10) return suited ? 56 : 48;
  if (a === 11 && b === 10) return suited ? 54 : 46;

  // Connected cards (potential straight draws)
  const gap = a - b;
  const highBonus = Math.max(0, b - 5) * 1.5;
  const suitBonus = suited ? 8 : 0;
  if (gap === 1) return Math.min(50, 30 + highBonus + suitBonus);
  if (gap === 2) return Math.min(42, 20 + highBonus + suitBonus);

  // Aces with low kicker
  if (a === 14) return suited ? 35 + highBonus : 28 + highBonus;

  return Math.max(5, 10 + highBonus + suitBonus - gap * 3);
}

/**
 * Post-flop strength (0–100) based on best-hand rank.
 * hand rank 0 = high card, 9 = royal flush
 */
function postFlopStrength(holeCards: Card[], communityCards: Card[]): number {
  if (communityCards.length === 0) return preFlopStrength(holeCards);
  const result = getBestHand(holeCards, communityCards);
  // rank 0–9 → map to 0–100 with non-linear scaling
  const BASE = [5, 20, 35, 50, 60, 70, 80, 88, 94, 100];
  return BASE[result.rank] ?? 5;
}

// ─────────────────────────────────────────────
//  AI Decision
// ─────────────────────────────────────────────

/**
 * Decide an action for an AI player given the current round state.
 * Uses a simple probability-based approach with slight randomness.
 */
export function getAIAction(player: PokerPlayer, state: PokerRoundState): AIAction {
  const strength = postFlopStrength(player.holeCards, state.communityCards);
  const callAmount = state.currentBet - player.currentBet;
  const canCheck = callAmount <= 0;

  // Add a small random variance (±10%) to simulate bluffing / unpredictability
  const noise = (Math.random() - 0.5) * 20;
  const effectiveStrength = Math.max(0, Math.min(100, strength + noise));

  // Very weak hand: mostly fold, sometimes call/check
  if (effectiveStrength < 20) {
    if (canCheck) return { action: "check" };
    // Fold 80% of the time with a weak hand facing a bet
    if (Math.random() < 0.8) return { action: "fold" };
    return { action: "call" };
  }

  // Marginal hand: check/call, rarely raise
  if (effectiveStrength < 45) {
    if (canCheck) {
      // Occasionally bet with marginal hands (20% bluff)
      if (Math.random() < 0.2 && player.chips > state.bigBlind * 2) {
        const raiseAmt = state.currentBet + state.bigBlind * 2;
        if (raiseAmt < player.chips) return { action: "raise", amount: raiseAmt };
      }
      return { action: "check" };
    }
    // Call if the pot odds are reasonable
    const potOdds = callAmount / (state.pot + callAmount);
    if (potOdds < 0.35) return { action: "call" };
    return { action: "fold" };
  }

  // Good hand: call, raise some of the time
  if (effectiveStrength < 70) {
    if (canCheck) {
      // Bet for value ~50% of the time
      if (Math.random() < 0.5 && player.chips > state.bigBlind * 2) {
        const raiseAmt = state.currentBet + state.bigBlind * 3;
        if (raiseAmt < player.chips) return { action: "raise", amount: raiseAmt };
      }
      return { action: "check" };
    }
    return { action: "call" };
  }

  // Strong hand: raise aggressively
  if (Math.random() < 0.75) {
    const multiplier = effectiveStrength >= 88 ? 4 : 3;
    const raiseAmt = state.currentBet + state.bigBlind * multiplier;
    const cappedRaise = Math.min(raiseAmt, player.chips + player.currentBet);
    if (cappedRaise > state.currentBet && player.chips > 0) {
      return { action: "raise", amount: cappedRaise };
    }
  }

  return canCheck ? { action: "check" } : { action: "call" };
}
