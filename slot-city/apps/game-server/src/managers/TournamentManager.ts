import { v4 as uuidv4 } from "uuid";
import { TournamentStatus, TournamentSummary, BLIND_SCHEDULE } from "@slot-city/shared";

export interface TournamentPlayer {
  playerId: string;
  username: string;
  chips: number;
  place: number | null;
  isEliminated: boolean;
  tableId: string | null;
}

export interface TournamentConfig {
  name: string;
  buyIn: number;
  maxPlayers: number;
  blindIncreaseMinutes?: number;
}

export interface Tournament {
  id: string;
  name: string;
  buyIn: number;
  maxPlayers: number;
  prizePool: number;
  status: TournamentStatus;
  players: Map<string, TournamentPlayer>;
  activeTables: Map<string, string[]>;
  blindLevel: number;
  blindIncreaseMinutes: number;
  startTime: number | null;
  endTime: number | null;
  blindTimer: NodeJS.Timeout | null;
}

export type TournamentEventType =
  | "PLAYER_REGISTERED"
  | "TOURNAMENT_STARTED"
  | "BLIND_LEVEL_UP"
  | "PLAYER_ELIMINATED"
  | "FINAL_TABLE"
  | "TOURNAMENT_FINISHED";

export interface TournamentEvent {
  type: TournamentEventType;
  tournamentId: string;
  data?: Record<string, unknown>;
}

export type TournamentEventCallback = (event: TournamentEvent) => void;

export class TournamentManager {
  private tournaments: Map<string, Tournament> = new Map();
  private onEvent: TournamentEventCallback;

  constructor(onEvent: TournamentEventCallback) {
    this.onEvent = onEvent;
  }

  createTournament(config: TournamentConfig): Tournament {
    const id = uuidv4();
    const tournament: Tournament = {
      id,
      name: config.name,
      buyIn: config.buyIn,
      maxPlayers: config.maxPlayers,
      prizePool: 0,
      status: TournamentStatus.WAITING_FOR_PLAYERS,
      players: new Map(),
      activeTables: new Map(),
      blindLevel: 1,
      blindIncreaseMinutes: config.blindIncreaseMinutes ?? 15,
      startTime: null,
      endTime: null,
      blindTimer: null,
    };
    this.tournaments.set(id, tournament);
    return tournament;
  }

  getTournament(id: string): Tournament | undefined {
    return this.tournaments.get(id);
  }

  getAllTournaments(): Tournament[] {
    return Array.from(this.tournaments.values());
  }

  getActiveTournaments(): Tournament[] {
    return this.getAllTournaments().filter(
      (t) => t.status !== TournamentStatus.FINISHED,
    );
  }

  registerPlayer(tournamentId: string, playerId: string, username: string): void {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }
    if (tournament.status !== TournamentStatus.WAITING_FOR_PLAYERS) {
      throw new Error("Tournament is not accepting registrations");
    }
    if (tournament.players.size >= tournament.maxPlayers) {
      throw new Error("Tournament is full");
    }
    if (tournament.players.has(playerId)) {
      throw new Error("Player already registered");
    }

    tournament.players.set(playerId, {
      playerId,
      username,
      chips: tournament.buyIn * 100, // Starting chip stack
      place: null,
      isEliminated: false,
      tableId: null,
    });
    tournament.prizePool += tournament.buyIn;

    this.onEvent({
      type: "PLAYER_REGISTERED",
      tournamentId,
      data: { playerId, username, playerCount: tournament.players.size },
    });

    // Auto-start if full
    if (tournament.players.size === tournament.maxPlayers) {
      this.startTournament(tournamentId);
    }
  }

  startTournament(tournamentId: string): void {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);
    if (tournament.players.size < 2) throw new Error("Need at least 2 players");

    tournament.status = TournamentStatus.STARTING;
    tournament.startTime = Date.now();

    // Allocate tables
    this.allocateTables(tournament);

    tournament.status = TournamentStatus.RUNNING;

    this.onEvent({
      type: "TOURNAMENT_STARTED",
      tournamentId,
      data: { tableCount: tournament.activeTables.size },
    });

    // Start blind increase timer
    this.startBlindTimer(tournament);
  }

  private allocateTables(tournament: Tournament): void {
    const players = Array.from(tournament.players.keys());
    const tableSize = 6;
    let tableIndex = 0;

    tournament.activeTables.clear();

    for (let i = 0; i < players.length; i += tableSize) {
      const tableId = `${tournament.id}-table-${tableIndex++}`;
      const tablePlayers = players.slice(i, i + tableSize);
      tournament.activeTables.set(tableId, tablePlayers);
      for (const playerId of tablePlayers) {
        const player = tournament.players.get(playerId);
        if (player) player.tableId = tableId;
      }
    }
  }

  private startBlindTimer(tournament: Tournament): void {
    if (tournament.blindTimer) {
      clearInterval(tournament.blindTimer);
    }
    tournament.blindTimer = setInterval(() => {
      this.increaseBlinds(tournament.id);
    }, tournament.blindIncreaseMinutes * 60 * 1000);
  }

  increaseBlinds(tournamentId: string): void {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== TournamentStatus.RUNNING) return;

    const maxLevel = BLIND_SCHEDULE.length;
    if (tournament.blindLevel < maxLevel) {
      tournament.blindLevel++;
      this.onEvent({
        type: "BLIND_LEVEL_UP",
        tournamentId,
        data: {
          level: tournament.blindLevel,
          smallBlind: BLIND_SCHEDULE[tournament.blindLevel - 1].small,
          bigBlind: BLIND_SCHEDULE[tournament.blindLevel - 1].big,
        },
      });
    }
  }

  eliminatePlayer(tournamentId: string, playerId: string): void {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    const player = tournament.players.get(playerId);
    if (!player || player.isEliminated) return;

    const activePlayers = Array.from(tournament.players.values()).filter((p) => !p.isEliminated);
    player.isEliminated = true;
    player.place = activePlayers.length; // Place is current active count

    this.onEvent({
      type: "PLAYER_ELIMINATED",
      tournamentId,
      data: { playerId, place: player.place },
    });

    const remaining = activePlayers.filter((p) => p.playerId !== playerId);

    if (remaining.length <= 9 && tournament.status === TournamentStatus.RUNNING) {
      tournament.status = TournamentStatus.FINAL_TABLE;
      this.onEvent({ type: "FINAL_TABLE", tournamentId, data: { playerCount: remaining.length } });
    }

    if (remaining.length === 1) {
      this.finishTournament(tournamentId, remaining[0].playerId);
    }
  }

  private finishTournament(tournamentId: string, winnerId: string): void {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    const winner = tournament.players.get(winnerId);
    if (winner) {
      winner.place = 1;
    }

    if (tournament.blindTimer) {
      clearInterval(tournament.blindTimer);
      tournament.blindTimer = null;
    }

    tournament.status = TournamentStatus.FINISHED;
    tournament.endTime = Date.now();

    this.onEvent({
      type: "TOURNAMENT_FINISHED",
      tournamentId,
      data: { winnerId, prizePool: tournament.prizePool },
    });
  }

  getSummary(tournamentId: string): TournamentSummary | undefined {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return undefined;

    const activePlayers = Array.from(tournament.players.values()).filter((p) => !p.isEliminated);

    return {
      id: tournament.id,
      name: tournament.name,
      buyIn: tournament.buyIn,
      prizePool: tournament.prizePool,
      maxPlayers: tournament.maxPlayers,
      registeredPlayers: tournament.players.size,
      status: tournament.status,
      startTime: tournament.startTime,
      blindLevel: tournament.blindLevel,
      blindIncreaseMinutes: tournament.blindIncreaseMinutes,
    };
  }

  getAllSummaries(): TournamentSummary[] {
    return Array.from(this.tournaments.keys())
      .map((id) => this.getSummary(id))
      .filter((s): s is TournamentSummary => s !== undefined);
  }

  cleanup(): void {
    for (const tournament of this.tournaments.values()) {
      if (tournament.blindTimer) {
        clearInterval(tournament.blindTimer);
        tournament.blindTimer = null;
      }
    }
  }
}
