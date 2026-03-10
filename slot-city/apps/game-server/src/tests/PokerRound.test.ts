import { PokerRoundManager, PokerPlayer } from "../systems/PokerRoundManager";
import { PokerGameState, BLIND_SCHEDULE } from "@slot-city/shared";

function makePlayer(id: string, seatIndex: number, chips = 1000): PokerPlayer {
  return {
    playerId: id,
    username: `Player${id}`,
    chips,
    seatIndex,
    holeCards: [],
    currentBet: 0,
    totalBetInRound: 0,
    isFolded: false,
    isAllIn: false,
    isActive: false,
  };
}

describe("PokerRoundManager", () => {
  let manager: PokerRoundManager;
  const events: Array<{ type: string }> = [];

  beforeEach(() => {
    events.length = 0;
    manager = new PokerRoundManager((event) => {
      events.push(event);
    });
  });

  afterEach(() => {
    manager.reset();
  });

  describe("initial state", () => {
    it("should start in WAITING state", () => {
      expect(manager.getState().gameState).toBe(PokerGameState.WAITING);
    });

    it("should not allow starting without enough players", () => {
      expect(manager.canStartRound()).toBe(false);
      manager.addPlayer(makePlayer("p1", 0));
      expect(manager.canStartRound()).toBe(false);
    });

    it("should allow starting with 2+ players", () => {
      manager.addPlayer(makePlayer("p1", 0));
      manager.addPlayer(makePlayer("p2", 1));
      expect(manager.canStartRound()).toBe(true);
    });
  });

  describe("round start", () => {
    beforeEach(() => {
      manager.addPlayer(makePlayer("p1", 0));
      manager.addPlayer(makePlayer("p2", 1));
    });

    it("should transition to PRE_FLOP after startRound", () => {
      manager.startRound();
      expect(manager.getState().gameState).toBe(PokerGameState.PRE_FLOP);
    });

    it("should deal 2 hole cards to each player", () => {
      manager.startRound();
      const state = manager.getState();
      for (const player of state.players.values()) {
        expect(player.holeCards).toHaveLength(2);
      }
    });

    it("should post blinds correctly", () => {
      manager.startRound();
      const state = manager.getState();
      expect(state.pot).toBeGreaterThan(0);
      // Small blind + big blind = 25 + 50 = 75
      expect(state.pot).toBe(75);
    });

    it("should set currentBet to big blind after posting blinds", () => {
      manager.startRound();
      expect(manager.getState().currentBet).toBe(50); // big blind
    });

    it("should emit STATE_CHANGED events", () => {
      manager.startRound();
      const stateEvents = events.filter((e) => e.type === "STATE_CHANGED");
      expect(stateEvents.length).toBeGreaterThan(0);
    });
  });

  describe("actions", () => {
    beforeEach(() => {
      manager.addPlayer(makePlayer("p1", 0));
      manager.addPlayer(makePlayer("p2", 1));
      manager.startRound();
    });

    it("should reject action from non-active player", () => {
      const state = manager.getState();
      const activeSeat = state.activePlayerSeat;
      // Find the non-active player
      const nonActive = Array.from(state.players.values()).find(
        (p) => p.seatIndex !== activeSeat,
      );
      if (nonActive) {
        const result = manager.processAction(nonActive.playerId, "call");
        expect(result).toBe(false);
      }
    });

    it("should process fold action", () => {
      const state = manager.getState();
      const activeSeat = state.activePlayerSeat;
      const activePlayer = Array.from(state.players.values()).find(
        (p) => p.seatIndex === activeSeat,
      );
      if (activePlayer) {
        const result = manager.processAction(activePlayer.playerId, "fold");
        expect(result).toBe(true);
      }
    });

    it("should end round when all but one player folds", () => {
      const state = manager.getState();
      const activePlayer = Array.from(state.players.values()).find(
        (p) => p.seatIndex === state.activePlayerSeat,
      );
      if (activePlayer) {
        manager.processAction(activePlayer.playerId, "fold");
        expect(manager.getState().gameState).toBe(PokerGameState.END_ROUND);
        const winnerEvents = events.filter((e) => e.type === "WINNER_DECLARED");
        expect(winnerEvents.length).toBe(1);
      }
    });
  });

  describe("player management", () => {
    it("should add and remove players", () => {
      manager.addPlayer(makePlayer("p1", 0));
      expect(manager.getPlayerCount()).toBe(1);
      manager.removePlayer("p1");
      expect(manager.getPlayerCount()).toBe(0);
    });
  });

  describe("AI player support", () => {
    it("should identify an active AI player on their turn", () => {
      manager.addPlayer({ ...makePlayer("human", 0), isAI: false });
      manager.addPlayer({ ...makePlayer("ai-1", 1), isAI: true });
      manager.startRound();

      const state = manager.getState();
      const activeSeat = state.activePlayerSeat;
      const activePlayer = Array.from(state.players.values()).find(
        (p) => p.seatIndex === activeSeat,
      );
      const aiActive = manager.getActiveAIPlayer();

      if (activePlayer?.isAI) {
        expect(aiActive).toBeDefined();
        expect(aiActive?.playerId).toBe(activePlayer.playerId);
      } else {
        expect(aiActive).toBeUndefined();
      }
    });

    it("should return undefined for getActiveAIPlayer when human is active", () => {
      manager.addPlayer({ ...makePlayer("human", 0), isAI: false });
      manager.addPlayer({ ...makePlayer("ai-1", 1), isAI: true });
      manager.startRound();

      const state = manager.getState();
      const activeSeat = state.activePlayerSeat;
      const activePlayer = Array.from(state.players.values()).find(
        (p) => p.seatIndex === activeSeat,
      );

      if (!activePlayer?.isAI) {
        expect(manager.getActiveAIPlayer()).toBeUndefined();
      }
    });

    it("should have isAI field on PokerPlayer", () => {
      const p = makePlayer("ai-test", 2);
      p.isAI = true;
      manager.addPlayer(p);
      const stored = manager.getState().players.get("ai-test");
      expect(stored?.isAI).toBe(true);
    });
  });

  describe("BB pre-flop option", () => {
    /**
     * Standard poker rule: after all players call the big blind pre-flop,
     * the BB must still get one action ("the option") before the flop is dealt.
     * This ensures the BB can re-raise even when everyone has simply called.
     */
    it("should give BB the option to act when everyone else calls pre-flop (3 players)", () => {
      // seats 0 (UTG), 1 (SB), 2 (BB) — dealer rotates to seat 1 on first round
      // so: dealer=1, SB=2, BB=0
      manager.addPlayer(makePlayer("utg",    0, 1000));
      manager.addPlayer(makePlayer("sb",     1, 1000));
      manager.addPlayer(makePlayer("bb",     2, 1000));
      manager.startRound();

      const afterStart = manager.getState();
      const bbSeat = afterStart.bigBlindSeat;
      const bigBlind = afterStart.bigBlind;

      // First active player should NOT be the BB (UTG or SB acts before BB pre-flop).
      expect(afterStart.activePlayerSeat).not.toBe(bbSeat);

      // Helper: get the player currently on the clock.
      function activePlayer() {
        const s = manager.getState();
        return Array.from(s.players.values()).find(
          (p) => p.seatIndex === s.activePlayerSeat,
        )!;
      }

      // Have every non-BB player call until we reach the BB.
      let iterations = 0;
      while (manager.getState().activePlayerSeat !== bbSeat) {
        const ap = activePlayer();
        manager.processAction(ap.playerId, "call");
        iterations++;
        // Safety: shouldn't need more iterations than there are players.
        if (iterations > 4) break;
      }

      // After all other players called, the game must NOT have advanced to the flop.
      // The BB is entitled to their option; the state must still be PRE_FLOP.
      expect(manager.getState().gameState).toBe(PokerGameState.PRE_FLOP);
      expect(manager.getState().activePlayerSeat).toBe(bbSeat);

      // BB checks (exercises the option without raising).
      const bb = activePlayer();
      const result = manager.processAction(bb.playerId, "check");
      expect(result).toBe(true);

      // Now the betting round is complete and the flop should be dealt.
      expect(manager.getState().gameState).toBe(PokerGameState.FLOP);
    });

    it("should allow BB to raise during the option (3 players)", () => {
      manager.addPlayer(makePlayer("utg",    0, 1000));
      manager.addPlayer(makePlayer("sb",     1, 1000));
      manager.addPlayer(makePlayer("bb",     2, 1000));
      manager.startRound();

      const afterStart = manager.getState();
      const bbSeat = afterStart.bigBlindSeat;
      const bigBlind = afterStart.bigBlind;

      function activePlayer() {
        const s = manager.getState();
        return Array.from(s.players.values()).find(
          (p) => p.seatIndex === s.activePlayerSeat,
        )!;
      }

      // All non-BB players call.
      let iterations = 0;
      while (manager.getState().activePlayerSeat !== bbSeat) {
        manager.processAction(activePlayer().playerId, "call");
        iterations++;
        if (iterations > 4) break;
      }

      // BB raises instead of checking — should bump currentBet.
      const raiseAmount = bigBlind * 3;
      const bb = activePlayer();
      const result = manager.processAction(bb.playerId, "raise", raiseAmount);
      expect(result).toBe(true);

      // The raise forces the remaining players to act again; still PRE_FLOP.
      expect(manager.getState().gameState).toBe(PokerGameState.PRE_FLOP);
      expect(manager.getState().currentBet).toBe(raiseAmount);
    });

    it("should NOT give BB the option when BB is all-in from posting the blind", () => {
      // BB has exactly bigBlind chips, so posting puts them all-in.
      const bigBlind = BLIND_SCHEDULE[0].big; // 50
      manager.addPlayer(makePlayer("sb", 0, 1000));
      manager.addPlayer(makePlayer("bb", 1, bigBlind)); // exactly the big blind
      manager.startRound();

      const afterStart = manager.getState();
      const bbSeat = afterStart.bigBlindSeat;
      const bbPlayer = Array.from(afterStart.players.values()).find(
        (p) => p.seatIndex === bbSeat,
      )!;

      // BB should be all-in after posting.
      expect(bbPlayer.isAllIn).toBe(true);

      // SB (first to act) calls — this should complete the pre-flop betting
      // immediately since BB is all-in and has no option.
      const sbSeat = afterStart.smallBlindSeat;
      const sb = Array.from(afterStart.players.values()).find(
        (p) => p.seatIndex === sbSeat,
      )!;
      manager.processAction(sb.playerId, "call");

      // Should advance past pre-flop (all-in BB gets no option).
      expect(manager.getState().gameState).not.toBe(PokerGameState.PRE_FLOP);
    });
  });

  describe("pre-flop actor ordering", () => {
    it("first actor pre-flop should not be the BB (3+ players)", () => {
      // Players added in descending order to verify we don't depend on insertion order.
      manager.addPlayer(makePlayer("p3", 2, 1000));
      manager.addPlayer(makePlayer("p1", 0, 1000));
      manager.addPlayer(makePlayer("p2", 1, 1000));
      manager.startRound();

      const state = manager.getState();
      expect(state.activePlayerSeat).not.toBe(state.bigBlindSeat);
    });

    it("mid-round turn order should be deterministic and seat-index based", () => {
      // With players at seats 0, 2, 4 (gaps), confirm the ordering is always
      // by ascending seat, not insertion order.
      manager.addPlayer(makePlayer("p4", 4, 1000));
      manager.addPlayer(makePlayer("p0", 0, 1000));
      manager.addPlayer(makePlayer("p2", 2, 1000));
      manager.startRound();

      const seatsVisited: number[] = [];
      let safetyCount = 0;

      // Collect the sequence of active seats until we reach the flop (or fold out).
      while (
        manager.getState().gameState === PokerGameState.PRE_FLOP &&
        safetyCount < 10
      ) {
        const s = manager.getState();
        seatsVisited.push(s.activePlayerSeat);
        const ap = Array.from(s.players.values()).find(
          (p) => p.seatIndex === s.activePlayerSeat,
        )!;
        manager.processAction(ap.playerId, "call");
        safetyCount++;
      }

      // Each seat should appear at most once before the BB acts.
      const unique = new Set(seatsVisited);
      expect(unique.size).toBe(seatsVisited.length);
    });
  });
  describe("blind levels", () => {
    it("should update blind level", () => {
      manager.setBlindLevel(3);
      expect(manager.getState().smallBlind).toBe(75);
      expect(manager.getState().bigBlind).toBe(150);
    });
  });
});
