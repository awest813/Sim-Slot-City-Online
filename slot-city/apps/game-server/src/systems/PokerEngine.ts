import { Card, CardSuit, CardRank } from "@slot-city/shared";

// ─────────────────────────────────────────────
//  Deck
// ─────────────────────────────────────────────

export function createDeck(): Card[] {
  const suits = Object.values(CardSuit);
  const ranks = Object.values(CardRank);
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─────────────────────────────────────────────
//  Hand evaluation
// ─────────────────────────────────────────────

const RANK_VALUES: Record<CardRank, number> = {
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

export interface HandResult {
  rank: number; // higher = better
  name: string;
  tiebreakers: number[];
}

function getCombinations(cards: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (cards.length < k) return [];
  const [first, ...rest] = cards;
  const withFirst = getCombinations(rest, k - 1).map((combo) => [first, ...combo]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function rankVal(r: CardRank): number {
  return RANK_VALUES[r];
}

function evaluateFiveCard(cards: Card[]): HandResult {
  const vals = cards.map((c) => rankVal(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const uniqueVals = [...new Set(vals)].sort((a, b) => b - a);

  // Straight detection
  const isStraight =
    uniqueVals.length === 5 &&
    vals[0] - vals[4] === 4;
  // Wheel straight: A-2-3-4-5
  const isWheel =
    uniqueVals.length === 5 &&
    JSON.stringify(vals) === JSON.stringify([14, 5, 4, 3, 2]);

  const counts: Record<number, number> = {};
  for (const v of vals) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const countValues = Object.values(counts).sort((a, b) => b - a);
  const groupsByCount = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || parseInt(b[0]) - parseInt(a[0]))
    .map(([v]) => parseInt(v));

  if (isFlush && (isStraight || isWheel)) {
    const highCard = isWheel ? 5 : vals[0];
    if (highCard === 14 && isFlush) {
      return { rank: 9, name: "Royal Flush", tiebreakers: [14] };
    }
    return { rank: 8, name: "Straight Flush", tiebreakers: [highCard] };
  }

  if (countValues[0] === 4) {
    return { rank: 7, name: "Four of a Kind", tiebreakers: groupsByCount };
  }
  if (countValues[0] === 3 && countValues[1] === 2) {
    return { rank: 6, name: "Full House", tiebreakers: groupsByCount };
  }
  if (isFlush) {
    return { rank: 5, name: "Flush", tiebreakers: vals };
  }
  if (isStraight || isWheel) {
    const highCard = isWheel ? 5 : vals[0];
    return { rank: 4, name: "Straight", tiebreakers: [highCard] };
  }
  if (countValues[0] === 3) {
    return { rank: 3, name: "Three of a Kind", tiebreakers: groupsByCount };
  }
  if (countValues[0] === 2 && countValues[1] === 2) {
    return { rank: 2, name: "Two Pair", tiebreakers: groupsByCount };
  }
  if (countValues[0] === 2) {
    return { rank: 1, name: "One Pair", tiebreakers: groupsByCount };
  }
  return { rank: 0, name: "High Card", tiebreakers: vals };
}

export function getBestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const combinations = getCombinations(allCards, 5);
  let best: HandResult | null = null;
  for (const combo of combinations) {
    const result = evaluateFiveCard(combo);
    if (!best || compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best!;
}

export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const av = a.tiebreakers[i] ?? 0;
    const bv = b.tiebreakers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export function determineWinners(
  players: Array<{ playerId: string; holeCards: Card[] }>,
  communityCards: Card[],
): string[] {
  const results = players.map(({ playerId, holeCards }) => ({
    playerId,
    hand: getBestHand(holeCards, communityCards),
  }));

  results.sort((a, b) => compareHands(b.hand, a.hand));
  const best = results[0].hand;
  return results
    .filter((r) => compareHands(r.hand, best) === 0)
    .map((r) => r.playerId);
}
