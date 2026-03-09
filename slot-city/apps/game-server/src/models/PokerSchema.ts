import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { PokerGameState } from "@slot-city/shared";
export class CardSchema extends Schema {
  @type("string") suit: string = "";
  @type("string") rank: string = "";
}

export class PokerPlayerSchema extends Schema {
  @type("string") playerId: string = "";
  @type("string") username: string = "";
  @type("number") chips: number = 0;
  @type("number") seatIndex: number = 0;
  @type([CardSchema]) cards = new ArraySchema<CardSchema>();
  @type("number") currentBet: number = 0;
  @type("number") totalBetInRound: number = 0;
  @type("boolean") isFolded: boolean = false;
  @type("boolean") isAllIn: boolean = false;
  @type("boolean") isActive: boolean = false;
  @type("boolean") isConnected: boolean = true;
  @type("boolean") isAI: boolean = false;
}

export class PokerTableState extends Schema {
  @type("string") tableId: string = "";
  @type("string") gameState: PokerGameState = PokerGameState.WAITING;
  @type({ map: PokerPlayerSchema }) players = new MapSchema<PokerPlayerSchema>();
  @type([CardSchema]) communityCards = new ArraySchema<CardSchema>();
  @type("number") pot: number = 0;
  @type("number") currentBet: number = 0;
  @type("number") dealerSeat: number = 0;
  @type("number") smallBlindSeat: number = 1;
  @type("number") bigBlindSeat: number = 2;
  @type("number") activePlayerSeat: number = -1;
  @type("number") minBuyIn: number = 500;
  @type("number") maxBuyIn: number = 5000;
  @type("number") smallBlind: number = 25;
  @type("number") bigBlind: number = 50;
  @type("number") maxSeats: number = 6;
  @type("string") lastWinnerId: string = "";
  @type("number") lastWinAmount: number = 0;
}
