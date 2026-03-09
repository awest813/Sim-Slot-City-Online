import { PokerRoundManager, PokerPlayer } from "../systems/PokerRoundManager";
import { PokerGameState } from "@slot-city/shared";

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

  describe("blind levels", () => {
    it("should update blind level", () => {
      manager.setBlindLevel(3);
      expect(manager.getState().smallBlind).toBe(75);
      expect(manager.getState().bigBlind).toBe(150);
    });
  });
});
