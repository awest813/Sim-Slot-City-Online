import { getBestHand, compareHands, determineWinners, createDeck, shuffleDeck } from "../systems/PokerEngine";
import { CardSuit, CardRank, Card } from "@slot-city/shared";

function card(rank: CardRank, suit: CardSuit): Card {
  return { rank, suit };
}

describe("PokerEngine", () => {
  describe("createDeck", () => {
    it("should create a 52-card deck", () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
    });

    it("should contain all 4 suits", () => {
      const deck = createDeck();
      const suits = new Set(deck.map((c) => c.suit));
      expect(suits.size).toBe(4);
    });

    it("should contain 13 ranks per suit", () => {
      const deck = createDeck();
      const spades = deck.filter((c) => c.suit === CardSuit.SPADES);
      expect(spades).toHaveLength(13);
    });
  });

  describe("shuffleDeck", () => {
    it("should return a deck with the same 52 cards", () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);
      expect(shuffled).toHaveLength(52);
    });

    it("should not mutate the original deck", () => {
      const deck = createDeck();
      const first = deck[0];
      shuffleDeck(deck);
      expect(deck[0]).toEqual(first);
    });
  });

  describe("getBestHand", () => {
    it("should identify a royal flush", () => {
      const hole = [card(CardRank.ACE, CardSuit.SPADES), card(CardRank.KING, CardSuit.SPADES)];
      const community = [
        card(CardRank.QUEEN, CardSuit.SPADES),
        card(CardRank.JACK, CardSuit.SPADES),
        card(CardRank.TEN, CardSuit.SPADES),
        card(CardRank.TWO, CardSuit.HEARTS),
        card(CardRank.THREE, CardSuit.HEARTS),
      ];
      const result = getBestHand(hole, community);
      expect(result.rank).toBe(9);
      expect(result.name).toBe("Royal Flush");
    });

    it("should identify four of a kind", () => {
      const hole = [card(CardRank.ACE, CardSuit.SPADES), card(CardRank.ACE, CardSuit.HEARTS)];
      const community = [
        card(CardRank.ACE, CardSuit.DIAMONDS),
        card(CardRank.ACE, CardSuit.CLUBS),
        card(CardRank.KING, CardSuit.SPADES),
        card(CardRank.TWO, CardSuit.HEARTS),
        card(CardRank.THREE, CardSuit.HEARTS),
      ];
      const result = getBestHand(hole, community);
      expect(result.rank).toBe(7);
      expect(result.name).toBe("Four of a Kind");
    });

    it("should identify a full house", () => {
      const hole = [card(CardRank.KING, CardSuit.SPADES), card(CardRank.KING, CardSuit.HEARTS)];
      const community = [
        card(CardRank.KING, CardSuit.DIAMONDS),
        card(CardRank.ACE, CardSuit.CLUBS),
        card(CardRank.ACE, CardSuit.SPADES),
        card(CardRank.TWO, CardSuit.HEARTS),
        card(CardRank.THREE, CardSuit.HEARTS),
      ];
      const result = getBestHand(hole, community);
      expect(result.rank).toBe(6);
      expect(result.name).toBe("Full House");
    });

    it("should identify a flush", () => {
      const hole = [card(CardRank.ACE, CardSuit.HEARTS), card(CardRank.KING, CardSuit.HEARTS)];
      const community = [
        card(CardRank.SEVEN, CardSuit.HEARTS),
        card(CardRank.FIVE, CardSuit.HEARTS),
        card(CardRank.THREE, CardSuit.HEARTS),
        card(CardRank.TWO, CardSuit.SPADES),
        card(CardRank.FOUR, CardSuit.CLUBS),
      ];
      const result = getBestHand(hole, community);
      expect(result.rank).toBe(5);
      expect(result.name).toBe("Flush");
    });

    it("should identify a straight", () => {
      const hole = [card(CardRank.NINE, CardSuit.SPADES), card(CardRank.EIGHT, CardSuit.HEARTS)];
      const community = [
        card(CardRank.SEVEN, CardSuit.CLUBS),
        card(CardRank.SIX, CardSuit.DIAMONDS),
        card(CardRank.FIVE, CardSuit.HEARTS),
        card(CardRank.TWO, CardSuit.SPADES),
        card(CardRank.ACE, CardSuit.CLUBS),
      ];
      const result = getBestHand(hole, community);
      expect(result.rank).toBe(4);
      expect(result.name).toBe("Straight");
    });

    it("should identify high card", () => {
      const hole = [card(CardRank.ACE, CardSuit.SPADES), card(CardRank.KING, CardSuit.HEARTS)];
      const community = [
        card(CardRank.TWO, CardSuit.CLUBS),
        card(CardRank.FOUR, CardSuit.DIAMONDS),
        card(CardRank.SIX, CardSuit.HEARTS),
        card(CardRank.EIGHT, CardSuit.SPADES),
        card(CardRank.JACK, CardSuit.CLUBS),
      ];
      const result = getBestHand(hole, community);
      expect(result.rank).toBe(0);
      expect(result.name).toBe("High Card");
    });
  });

  describe("compareHands", () => {
    it("should return positive when first hand wins", () => {
      const better = getBestHand(
        [card(CardRank.ACE, CardSuit.SPADES), card(CardRank.ACE, CardSuit.HEARTS)],
        [
          card(CardRank.ACE, CardSuit.CLUBS),
          card(CardRank.TWO, CardSuit.CLUBS),
          card(CardRank.THREE, CardSuit.HEARTS),
          card(CardRank.FOUR, CardSuit.DIAMONDS),
          card(CardRank.NINE, CardSuit.SPADES),
        ],
      );
      const worse = getBestHand(
        [card(CardRank.KING, CardSuit.SPADES), card(CardRank.KING, CardSuit.HEARTS)],
        [
          card(CardRank.TWO, CardSuit.CLUBS),
          card(CardRank.THREE, CardSuit.CLUBS),
          card(CardRank.FOUR, CardSuit.HEARTS),
          card(CardRank.FIVE, CardSuit.DIAMONDS),
          card(CardRank.NINE, CardSuit.SPADES),
        ],
      );
      expect(compareHands(better, worse)).toBeGreaterThan(0);
    });
  });

  describe("determineWinners", () => {
    it("should determine the single winner", () => {
      const community = [
        card(CardRank.ACE, CardSuit.CLUBS),
        card(CardRank.KING, CardSuit.CLUBS),
        card(CardRank.QUEEN, CardSuit.CLUBS),
        card(CardRank.JACK, CardSuit.CLUBS),
        card(CardRank.TEN, CardSuit.CLUBS),
      ];
      const players = [
        { playerId: "p1", holeCards: [card(CardRank.TWO, CardSuit.HEARTS), card(CardRank.THREE, CardSuit.HEARTS)] },
        { playerId: "p2", holeCards: [card(CardRank.FOUR, CardSuit.SPADES), card(CardRank.FIVE, CardSuit.SPADES)] },
      ];
      // Both players share the royal flush on board - should be a tie
      const winners = determineWinners(players, community);
      expect(winners).toHaveLength(2);
    });

    it("should handle two-player showdown with clear winner", () => {
      const community = [
        card(CardRank.TWO, CardSuit.CLUBS),
        card(CardRank.THREE, CardSuit.DIAMONDS),
        card(CardRank.FOUR, CardSuit.HEARTS),
        card(CardRank.FIVE, CardSuit.SPADES),
        card(CardRank.NINE, CardSuit.CLUBS),
      ];
      const players = [
        { playerId: "p1", holeCards: [card(CardRank.ACE, CardSuit.HEARTS), card(CardRank.KING, CardSuit.SPADES)] },
        { playerId: "p2", holeCards: [card(CardRank.SEVEN, CardSuit.HEARTS), card(CardRank.SIX, CardSuit.SPADES)] },
      ];
      // p1 has A-high straight (A-2-3-4-5) via wheel, p2 has 3-4-5-6-7 straight
      const winners = determineWinners(players, community);
      expect(winners).toHaveLength(1);
    });
  });
});
