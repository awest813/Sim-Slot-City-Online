import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { BaseRoomState, PlayerSchema } from "../models/RoomStateSchemas";
import { PokerTableState, PokerPlayerSchema, CardSchema } from "../models/PokerSchema";
import { PokerRoundManager } from "../systems/PokerRoundManager";
import { RoomType, PokerGameState, MsgPokerAction } from "@slot-city/shared";
import { PrismaClient } from "@prisma/client";
import { ChipEconomyService } from "../services/ChipEconomyService";
import { type } from "@colyseus/schema";

// Combined state: base room + poker table
class PokerRoomState extends BaseRoomState {
  @type(PokerTableState) table: PokerTableState = new PokerTableState();
}

const prisma = new PrismaClient();
const economy = new ChipEconomyService(prisma);

export class PokerTableRoom extends BaseRoom<PokerRoomState> {
  maxClients = 6;
  private roundManager!: PokerRoundManager;
  private startTimer: NodeJS.Timeout | null = null;
  private readonly MIN_BUY_IN = 500;
  private readonly MAX_BUY_IN = 5000;
  private readonly ROUND_START_DELAY_MS = 5000;

  onCreate(options: { minBuyIn?: number; maxBuyIn?: number; smallBlind?: number; bigBlind?: number }): void {
    const state = new PokerRoomState();
    this.setState(state);
    this.state.roomType = RoomType.POKER;

    state.table.tableId = this.roomId;
    state.table.gameState = PokerGameState.WAITING;
    state.table.minBuyIn = options.minBuyIn ?? this.MIN_BUY_IN;
    state.table.maxBuyIn = options.maxBuyIn ?? this.MAX_BUY_IN;
    state.table.smallBlind = options.smallBlind ?? 25;
    state.table.bigBlind = options.bigBlind ?? 50;
    state.table.maxSeats = 6;

    // Set up seats
    for (let i = 0; i < 6; i++) {
      this.addSeat(`poker-seat-${i}`, 5 + i, 5);
    }

    this.roundManager = new PokerRoundManager((event) => {
      this.syncPokerState();
      if (event.type === "WINNER_DECLARED") {
        const { playerId, amount } = event.data as { playerId: string; amount: number };
        this.handleChipWin(playerId, amount);
      }
      if (event.type === "ROUND_ENDED") {
        this.scheduleNextRound();
      }
    });

    this.registerBaseHandlers();

    this.onMessage("POKER_ACTION", (client: Client, message: MsgPokerAction) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handlePokerAction(playerId, message);
    });

    console.log(`[PokerTableRoom] Created: ${this.roomId}`);
  }

  onDispose(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    console.log(`[PokerTableRoom] Disposed: ${this.roomId}`);
  }

  protected getSpawnPosition(): { tileX: number; tileY: number } {
    return { tileX: 10, tileY: 8 };
  }

  protected onPlayerJoined(client: Client, player: PlayerSchema): void {
    // Auto-assign seat for new players with buy-in
    const seatIndex = this.findEmptySeatIndex();
    if (seatIndex >= 0) {
      const buyIn = Math.min(player.chips, this.state.table.maxBuyIn);
      const buyInActual = Math.max(buyIn, this.state.table.minBuyIn);

      if (player.chips >= this.state.table.minBuyIn) {
        this.roundManager.addPlayer({
          playerId: player.id,
          username: player.username,
          chips: buyInActual,
          seatIndex,
          holeCards: [],
          currentBet: 0,
          totalBetInRound: 0,
          isFolded: false,
          isAllIn: false,
          isActive: false,
        });

        // Deduct buy-in from player server chips
        economy.removeChips(player.id, buyInActual).catch(console.error);
        player.chips -= buyInActual;

        this.updatePokerPlayer(player.id);
        this.checkAndStartRound();
      }
    }
    console.log(`[PokerTableRoom] Player joined: ${player.username}`);
  }

  protected onPlayerLeft(client: Client, playerId: string): void {
    const roundPlayer = this.roundManager.getState().players.get(playerId);
    if (roundPlayer && roundPlayer.chips > 0) {
      economy.addChips(playerId, roundPlayer.chips).catch(console.error);
    }
    this.roundManager.removePlayer(playerId);
    this.state.table.players.delete(playerId);
    this.syncPokerState();
    console.log(`[PokerTableRoom] Player left: ${playerId}`);
  }

  protected onPlayerSeated(_playerId: string, _seatId: string): void {}
  protected onPlayerStoodUp(_playerId: string, _seatId: string): void {}

  private handlePokerAction(playerId: string, msg: MsgPokerAction): void {
    const state = this.roundManager.getState();
    if (state.gameState === PokerGameState.WAITING) return;

    this.roundManager.processAction(playerId, msg.action, msg.amount);
    this.syncPokerState();
  }

  private handleChipWin(playerId: string, amount: number): void {
    economy.recordMatchResult(playerId, "poker", amount, 0, "win").catch(console.error);
  }

  private checkAndStartRound(): void {
    if (this.roundManager.canStartRound()) {
      if (this.startTimer) return;
      this.startTimer = setTimeout(() => {
        this.startTimer = null;
        if (this.roundManager.canStartRound()) {
          try {
            this.roundManager.startRound();
            this.syncPokerState();
          } catch (err) {
            console.error("[PokerTableRoom] Failed to start round:", err);
          }
        }
      }, this.ROUND_START_DELAY_MS);
    }
  }

  private scheduleNextRound(): void {
    setTimeout(() => {
      const state = this.roundManager.getState();
      if (state.gameState === PokerGameState.END_ROUND) {
        // Check for busted players
        for (const [playerId, player] of state.players) {
          if (player.chips <= 0) {
            this.roundManager.removePlayer(playerId);
            this.state.table.players.delete(playerId);
          }
        }
        if (this.roundManager.canStartRound()) {
          try {
            this.roundManager.startRound();
            this.syncPokerState();
          } catch (err) {
            console.error("[PokerTableRoom] Failed to start next round:", err);
          }
        } else {
          this.state.table.gameState = PokerGameState.WAITING;
        }
      }
    }, 5000);
  }

  private findEmptySeatIndex(): number {
    const usedSeats = new Set(
      Array.from(this.roundManager.getState().players.values()).map((p) => p.seatIndex),
    );
    for (let i = 0; i < 6; i++) {
      if (!usedSeats.has(i)) return i;
    }
    return -1;
  }

  private updatePokerPlayer(playerId: string): void {
    const roundPlayer = this.roundManager.getState().players.get(playerId);
    if (!roundPlayer) return;

    if (!this.state.table.players.has(playerId)) {
      const schema = new PokerPlayerSchema();
      this.state.table.players.set(playerId, schema);
    }
    const schema = this.state.table.players.get(playerId)!;
    schema.playerId = roundPlayer.playerId;
    schema.username = roundPlayer.username;
    schema.chips = roundPlayer.chips;
    schema.seatIndex = roundPlayer.seatIndex;
    schema.currentBet = roundPlayer.currentBet;
    schema.totalBetInRound = roundPlayer.totalBetInRound;
    schema.isFolded = roundPlayer.isFolded;
    schema.isAllIn = roundPlayer.isAllIn;
    schema.isActive = roundPlayer.isActive;
  }

  private syncPokerState(): void {
    const rState = this.roundManager.getState();
    this.state.table.gameState = rState.gameState;
    this.state.table.pot = rState.pot;
    this.state.table.currentBet = rState.currentBet;
    this.state.table.dealerSeat = rState.dealerSeat;
    this.state.table.smallBlindSeat = rState.smallBlindSeat;
    this.state.table.bigBlindSeat = rState.bigBlindSeat;
    this.state.table.activePlayerSeat = rState.activePlayerSeat;
    this.state.table.smallBlind = rState.smallBlind;
    this.state.table.bigBlind = rState.bigBlind;

    // Sync community cards
    this.state.table.communityCards.splice(0, this.state.table.communityCards.length);
    for (const card of rState.communityCards) {
      const cardSchema = new CardSchema();
      cardSchema.suit = card.suit;
      cardSchema.rank = card.rank;
      this.state.table.communityCards.push(cardSchema);
    }

    // Sync all players
    for (const [playerId] of rState.players) {
      this.updatePokerPlayer(playerId);
    }
  }
}
