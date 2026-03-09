import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { BlackjackRoomState, PlayerSchema } from "../models/RoomStateSchemas";
import { RoomType } from "@slot-city/shared";

export class BlackjackTableRoom extends BaseRoom<BlackjackRoomState> {
  maxClients = 7;

  onCreate(): void {
    this.setState(new BlackjackRoomState());
    this.state.roomType = RoomType.BLACKJACK;
    this.state.dealerHand = "hidden";

    this.registerBaseHandlers();

    // Blackjack seats (up to 6 players + dealer)
    for (let i = 0; i < 6; i++) {
      this.addSeat(`bj-seat-${i}`, 4 + i, 5);
    }

    console.log(`[BlackjackTableRoom] Created: ${this.roomId}`);
  }

  onDispose(): void {
    console.log(`[BlackjackTableRoom] Disposed: ${this.roomId}`);
  }

  protected getSpawnPosition(): { tileX: number; tileY: number } {
    return { tileX: 7, tileY: 8 };
  }

  protected onPlayerJoined(_client: Client, player: PlayerSchema): void {
    console.log(`[BlackjackTableRoom] Player joined: ${player.username}`);
    this.broadcastSystemMessage(`${player.username} approaches the blackjack table.`);
  }

  protected onPlayerLeft(_client: Client, playerId: string): void {
    console.log(`[BlackjackTableRoom] Player left: ${playerId}`);
  }

  protected onPlayerSeated(_playerId: string, _seatId: string): void {
    // Future: trigger buy-in prompt
  }

  protected onPlayerStoodUp(_playerId: string, _seatId: string): void {
    // Future: handle chip return
  }
}
