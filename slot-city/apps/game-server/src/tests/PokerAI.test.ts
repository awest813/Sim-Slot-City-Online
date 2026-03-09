import { getAIAction } from "../systems/PokerAI";
import { PokerPlayer, PokerRoundState } from "../systems/PokerRoundManager";
import { PokerGameState, CardSuit, CardRank, Card, BLIND_SCHEDULE } from "@slot-city/shared";

function card(rank: CardRank, suit: CardSuit): Card {
  return { rank, suit };
}

function makePlayer(overrides: Partial<PokerPlayer> = {}): PokerPlayer {
  return {
    playerId: "ai-1",
    username: "TestBot",
    chips: 1000,
    seatIndex: 0,
    holeCards: [],
    currentBet: 0,
    totalBetInRound: 0,
    isFolded: false,
    isAllIn: false,
    isActive: true,
    isAI: true,
    ...overrides,
  };
}

function makeState(overrides: Partial<PokerRoundState> = {}): PokerRoundState {
  return {
    gameState: PokerGameState.PRE_FLOP,
    players: new Map(),
    communityCards: [],
    pot: 100,
    currentBet: 50,
    dealerSeat: 0,
    smallBlindSeat: 1,
    bigBlindSeat: 2,
    activePlayerSeat: 0,
    smallBlind: BLIND_SCHEDULE[0].small,
    bigBlind: BLIND_SCHEDULE[0].big,
    deck: [],
    sidePots: [],
    ...overrides,
  };
}

describe("PokerAI", () => {
  describe("getAIAction", () => {
    it("should return a valid action type", () => {
      const player = makePlayer({
        holeCards: [card(CardRank.ACE, CardSuit.SPADES), card(CardRank.KING, CardSuit.HEARTS)],
      });
      const state = makeState();
      const { action } = getAIAction(player, state);
      expect(["fold", "call", "raise", "check"]).toContain(action);
    });

    it("should include amount when action is raise", () => {
      // Run many times to catch a raise decision
      let sawRaise = false;
      // Force a raise by giving very strong hand (AA) with no noise
      for (let i = 0; i < 50; i++) {
        const player = makePlayer({
          chips: 2000,
          currentBet: 0,
          holeCards: [card(CardRank.ACE, CardSuit.SPADES), card(CardRank.ACE, CardSuit.HEARTS)],
        });
        const state = makeState({ currentBet: 50 });
        const decision = getAIAction(player, state);
        if (decision.action === "raise") {
          sawRaise = true;
          expect(decision.amount).toBeDefined();
          expect(decision.amount).toBeGreaterThan(state.currentBet);
          break;
        }
      }
      // With AA, we expect at least one raise among 50 attempts
      expect(sawRaise).toBe(true);
    });

    it("should tend to fold weak hands when facing a large bet", () => {
      let folds = 0;
      const trials = 30;
      for (let i = 0; i < trials; i++) {
        const player = makePlayer({
          chips: 1000,
          currentBet: 0,
          holeCards: [card(CardRank.TWO, CardSuit.SPADES), card(CardRank.SEVEN, CardSuit.HEARTS)],
        });
        const state = makeState({ currentBet: 400, pot: 500 });
        const { action } = getAIAction(player, state);
        if (action === "fold") folds++;
      }
      // With a very weak hand facing a large bet, should fold majority of the time
      expect(folds).toBeGreaterThan(trials * 0.5);
    });

    it("should check (not fold) when no bet is outstanding", () => {
      let checks = 0;
      const trials = 20;
      for (let i = 0; i < trials; i++) {
        const player = makePlayer({
          chips: 1000,
          currentBet: 0,
          holeCards: [card(CardRank.TWO, CardSuit.CLUBS), card(CardRank.SEVEN, CardSuit.DIAMONDS)],
        });
        const state = makeState({ currentBet: 0, pot: 0 });
        const { action } = getAIAction(player, state);
        // Should never fold when check is free
        if (action === "check") checks++;
        expect(action).not.toBe("fold");
      }
      expect(checks).toBeGreaterThan(0);
    });

    it("should make valid decisions post-flop with community cards", () => {
      const player = makePlayer({
        chips: 800,
        currentBet: 0,
        holeCards: [card(CardRank.ACE, CardSuit.HEARTS), card(CardRank.KING, CardSuit.HEARTS)],
      });
      const state = makeState({
        currentBet: 50,
        communityCards: [
          card(CardRank.QUEEN, CardSuit.HEARTS),
          card(CardRank.JACK, CardSuit.HEARTS),
          card(CardRank.TEN, CardSuit.HEARTS),
        ],
      });
      const { action } = getAIAction(player, state);
      // Royal flush draw - should not fold
      expect(action).not.toBe("fold");
    });

    it("should handle all-in scenario correctly (raise capped at chips)", () => {
      const player = makePlayer({
        chips: 100,
        currentBet: 0,
        holeCards: [card(CardRank.ACE, CardSuit.SPADES), card(CardRank.ACE, CardSuit.CLUBS)],
      });
      const state = makeState({ currentBet: 50, bigBlind: 50 });
      for (let i = 0; i < 30; i++) {
        const decision = getAIAction(player, state);
        if (decision.action === "raise") {
          expect(decision.amount).toBeDefined();
          // Can't raise more than chips + currentBet
          expect(decision.amount!).toBeLessThanOrEqual(player.chips + player.currentBet);
        }
      }
    });
  });
});
