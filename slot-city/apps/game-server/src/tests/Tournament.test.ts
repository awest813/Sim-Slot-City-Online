import { TournamentManager, TournamentConfig } from "../managers/TournamentManager";
import { TournamentStatus } from "@slot-city/shared";

const defaultConfig: TournamentConfig = {
  name: "Test Tournament",
  buyIn: 100,
  maxPlayers: 4,
  blindIncreaseMinutes: 999, // Don't auto-fire during tests
};

describe("TournamentManager", () => {
  let manager: TournamentManager;
  const events: Array<{ type: string; tournamentId: string }> = [];

  beforeEach(() => {
    events.length = 0;
    manager = new TournamentManager((event) => {
      events.push(event);
    });
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe("createTournament", () => {
    it("should create a tournament in WAITING_FOR_PLAYERS status", () => {
      const tournament = manager.createTournament(defaultConfig);
      expect(tournament.status).toBe(TournamentStatus.WAITING_FOR_PLAYERS);
      expect(tournament.buyIn).toBe(100);
      expect(tournament.maxPlayers).toBe(4);
      expect(tournament.prizePool).toBe(0);
    });

    it("should assign a unique ID", () => {
      const t1 = manager.createTournament(defaultConfig);
      const t2 = manager.createTournament(defaultConfig);
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe("registerPlayer", () => {
    it("should register a player and add buy-in to prize pool", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "player-1", "Alice");
      expect(tournament.players.size).toBe(1);
      expect(tournament.prizePool).toBe(100);
    });

    it("should emit PLAYER_REGISTERED event", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "player-1", "Alice");
      const event = events.find((e) => e.type === "PLAYER_REGISTERED");
      expect(event).toBeDefined();
    });

    it("should prevent duplicate registration", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "player-1", "Alice");
      expect(() => manager.registerPlayer(tournament.id, "player-1", "Alice")).toThrow(
        "already registered",
      );
    });

    it("should throw if tournament is full", () => {
      const tournament = manager.createTournament({ ...defaultConfig, maxPlayers: 2 });
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      // After auto-start with 2 players, can't register
      expect(() => manager.registerPlayer(tournament.id, "p3", "Charlie")).toThrow();
    });

    it("should auto-start when max players reached", () => {
      const tournament = manager.createTournament({ ...defaultConfig, maxPlayers: 2 });
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      const t = manager.getTournament(tournament.id)!;
      expect(t.status).toBe(TournamentStatus.RUNNING);
    });

    it("should throw for unknown tournament", () => {
      expect(() => manager.registerPlayer("nonexistent", "p1", "Alice")).toThrow("not found");
    });
  });

  describe("startTournament", () => {
    it("should transition to RUNNING status", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      manager.startTournament(tournament.id);
      expect(tournament.status).toBe(TournamentStatus.RUNNING);
    });

    it("should set startTime", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      const before = Date.now();
      manager.startTournament(tournament.id);
      expect(tournament.startTime).toBeGreaterThanOrEqual(before);
    });

    it("should allocate tables with correct player distribution", () => {
      const tournament = manager.createTournament(defaultConfig);
      for (let i = 0; i < 4; i++) {
        manager.registerPlayer(tournament.id, `p${i}`, `Player${i}`);
      }
      // With 4 players and tableSize=6, should be 1 table
      expect(tournament.activeTables.size).toBe(1);
    });
  });

  describe("eliminatePlayer", () => {
    it("should mark player as eliminated", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      manager.startTournament(tournament.id);
      manager.eliminatePlayer(tournament.id, "p1");
      const player = tournament.players.get("p1");
      expect(player?.isEliminated).toBe(true);
    });

    it("should emit PLAYER_ELIMINATED event", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      manager.startTournament(tournament.id);
      manager.eliminatePlayer(tournament.id, "p1");
      const event = events.find((e) => e.type === "PLAYER_ELIMINATED");
      expect(event).toBeDefined();
    });

    it("should finish tournament when only 1 player remains", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      manager.startTournament(tournament.id);
      manager.eliminatePlayer(tournament.id, "p1");
      expect(tournament.status).toBe(TournamentStatus.FINISHED);
    });
  });

  describe("increaseBlinds", () => {
    it("should increase blind level", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      manager.startTournament(tournament.id);
      expect(tournament.blindLevel).toBe(1);
      manager.increaseBlinds(tournament.id);
      expect(tournament.blindLevel).toBe(2);
    });

    it("should emit BLIND_LEVEL_UP event", () => {
      const tournament = manager.createTournament(defaultConfig);
      manager.registerPlayer(tournament.id, "p1", "Alice");
      manager.registerPlayer(tournament.id, "p2", "Bob");
      manager.startTournament(tournament.id);
      manager.increaseBlinds(tournament.id);
      const event = events.find((e) => e.type === "BLIND_LEVEL_UP");
      expect(event).toBeDefined();
    });
  });

  describe("getSummary", () => {
    it("should return a valid summary", () => {
      const tournament = manager.createTournament(defaultConfig);
      const summary = manager.getSummary(tournament.id);
      expect(summary).toBeDefined();
      expect(summary!.name).toBe("Test Tournament");
      expect(summary!.status).toBe(TournamentStatus.WAITING_FOR_PLAYERS);
    });

    it("should return undefined for unknown tournament", () => {
      expect(manager.getSummary("nonexistent")).toBeUndefined();
    });
  });
});
