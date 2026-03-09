import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { BarRoomState, PlayerSchema } from "../models/RoomStateSchemas";
import { RoomType } from "@slot-city/shared";
import { TournamentManager } from "../managers/TournamentManager";

// Shared singleton tournament manager (accessible across rooms)
export const globalTournamentManager = new TournamentManager((event) => {
  console.log(`[TournamentManager] Event: ${event.type} for tournament ${event.tournamentId}`);
});

export class BarRoom extends BaseRoom<BarRoomState> {
  maxClients = 50;
  private displayRefreshInterval: NodeJS.Timeout | null = null;

  onCreate(): void {
    this.setState(new BarRoomState());
    this.state.roomType = RoomType.BAR;
    this.state.bartenderMessage = "Welcome to the Lucky Lounge! Can I get you something? 🍸";

    this.registerBaseHandlers();

    // Bar stools at the counter
    for (let i = 0; i < 8; i++) {
      this.addSeat(`barstool-${i}`, 3 + i, 3);
    }

    // Lounge seats
    for (let i = 0; i < 6; i++) {
      this.addSeat(`lounge-seat-${i}`, 4 + (i % 3), 7 + Math.floor(i / 3));
    }

    // Refresh tournament display periodically
    this.displayRefreshInterval = setInterval(() => {
      this.updateTournamentDisplay();
    }, 10_000);

    this.updateTournamentDisplay();
    console.log(`[BarRoom] Created: ${this.roomId}`);
  }

  onDispose(): void {
    if (this.displayRefreshInterval) clearInterval(this.displayRefreshInterval);
    console.log(`[BarRoom] Disposed: ${this.roomId}`);
  }

  protected getSpawnPosition(): { tileX: number; tileY: number } {
    return { tileX: 8 + Math.floor(Math.random() * 3), tileY: 5 + Math.floor(Math.random() * 2) };
  }

  protected onPlayerJoined(_client: Client, player: PlayerSchema): void {
    console.log(`[BarRoom] Player joined: ${player.username}`);
    this.updateTournamentDisplay();
  }

  protected onPlayerLeft(_client: Client, playerId: string): void {
    console.log(`[BarRoom] Player left: ${playerId}`);
  }

  protected onPlayerSeated(_playerId: string, seatId: string): void {
    if (seatId.startsWith("barstool-")) {
      this.state.bartenderMessage = "What can I get you? 🍸";
    }
  }

  protected onPlayerStoodUp(_playerId: string, _seatId: string): void {}

  private updateTournamentDisplay(): void {
    const summaries = globalTournamentManager.getAllSummaries();
    if (summaries.length === 0) {
      this.state.tournamentDisplay = "No active tournaments. Check back soon!";
      return;
    }

    const lines = summaries.slice(0, 5).map((t) => {
      return `${t.name} | Buy-in: ${t.buyIn} | Players: ${t.registeredPlayers}/${t.maxPlayers} | ${t.status}`;
    });

    this.state.tournamentDisplay = lines.join("\n");
  }
}
