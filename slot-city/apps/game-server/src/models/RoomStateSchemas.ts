import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { PlayerDirection, PlayerAnimState, EmoteType, IsoPosition } from "@slot-city/shared";

export class IsoPositionSchema extends Schema {
  @type("number") tileX: number = 0;
  @type("number") tileY: number = 0;
}

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") username: string = "";
  @type("number") chips: number = 0;
  @type(IsoPositionSchema) pos: IsoPositionSchema = new IsoPositionSchema();
  @type("string") direction: PlayerDirection = PlayerDirection.SOUTH;
  @type("string") animState: PlayerAnimState = PlayerAnimState.IDLE;
  @type("string") seatId: string = "";
  @type("string") roomId: string = "";
  @type("string") emote: string = "";
  @type("string") outfitId: string = "default";
}

export class SeatSchema extends Schema {
  @type("string") id: string = "";
  @type("string") occupantId: string = "";
  @type("number") tileX: number = 0;
  @type("number") tileY: number = 0;
  @type("boolean") isInteractive: boolean = true;
}

export class ChatMessageSchema extends Schema {
  @type("string") playerId: string = "";
  @type("string") username: string = "";
  @type("string") message: string = "";
  @type("number") timestamp: number = 0;
  @type("string") roomId: string = "";
  @type("string") type: string = "chat";
}

export class BaseRoomState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: SeatSchema }) seats = new MapSchema<SeatSchema>();
  @type([ChatMessageSchema]) recentMessages = new ArraySchema<ChatMessageSchema>();
  @type("string") roomType: string = "";
  @type("number") playerCount: number = 0;
}

export class LobbyRoomState extends BaseRoomState {
  @type("string") announcement: string = "Welcome to Slot City! 🎰";
}

export class BarRoomState extends BaseRoomState {
  @type("string") bartenderMessage: string = "What can I get you?";
  @type("string") tournamentDisplay: string = "";
}

export class BlackjackRoomState extends BaseRoomState {
  @type("string")  dealerHand: string = "";
  @type("string")  gamePhase: string = "WAITING";
  @type("number")  minBet: number = 10;
  @type("number")  maxBet: number = 500;
}
