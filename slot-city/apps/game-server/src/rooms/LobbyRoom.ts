import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { LobbyRoomState } from "../models/RoomStateSchemas";
import { PlayerSchema } from "../models/RoomStateSchemas";
import { RoomType } from "@slot-city/shared";

export class LobbyRoom extends BaseRoom<LobbyRoomState> {
  maxClients = 100;

  onCreate(): void {
    this.setState(new LobbyRoomState());
    this.state.roomType = RoomType.LOBBY;
    this.state.announcement = "Welcome to Slot City! 🎰 Walk around, chat, and find your game!";

    this.registerBaseHandlers();

    // Set up lobby layout seats (waiting area / reception)
    this.addSeat("lobby-seat-1", 5, 3);
    this.addSeat("lobby-seat-2", 6, 3);
    this.addSeat("lobby-seat-3", 7, 3);
    this.addSeat("lobby-seat-4", 5, 4);
    this.addSeat("lobby-seat-5", 6, 4);
    this.addSeat("lobby-seat-6", 7, 4);

    console.log(`[LobbyRoom] Created: ${this.roomId}`);
  }

  onDispose(): void {
    console.log(`[LobbyRoom] Disposed: ${this.roomId}`);
  }

  protected getSpawnPosition(): { tileX: number; tileY: number } {
    // Spawn near entrance
    return { tileX: 8 + Math.floor(Math.random() * 4), tileY: 10 + Math.floor(Math.random() * 2) };
  }

  protected onPlayerJoined(_client: Client, player: PlayerSchema): void {
    console.log(`[LobbyRoom] Player joined: ${player.username}`);
  }

  protected onPlayerLeft(_client: Client, playerId: string): void {
    console.log(`[LobbyRoom] Player left: ${playerId}`);
  }

  protected onPlayerSeated(playerId: string, seatId: string): void {
    console.log(`[LobbyRoom] Player ${playerId} seated at ${seatId}`);
  }

  protected onPlayerStoodUp(playerId: string, _seatId: string): void {
    console.log(`[LobbyRoom] Player ${playerId} stood up`);
  }
}
