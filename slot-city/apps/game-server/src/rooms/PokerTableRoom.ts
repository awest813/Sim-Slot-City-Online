import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { BaseRoomState, PlayerSchema } from "../models/RoomStateSchemas";
import { PokerTableState, PokerPlayerSchema, CardSchema } from "../models/PokerSchema";
import { PokerRoundManager } from "../systems/PokerRoundManager";
import { getAIAction } from "../systems/PokerAI";
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

const AI_NAMES = ["Ada", "Blaze", "Clyde", "Dex", "Eve", "Felix"];
const AI_STARTING_CHIPS = 2000;
const AI_ACTION_DELAY_MS = 1500;

export class PokerTableRoom extends BaseRoom<PokerRoomState> {
  maxClients = 6;
  private roundManager!: PokerRoundManager;
  private startTimer: NodeJS.Timeout | null = null;
  private aiTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastWinnerId = "";
  private lastWinAmount = 0;
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
        this.lastWinnerId = playerId;
        this.lastWinAmount = amount;
        this.handleChipWin(playerId, amount);
      }
      if (event.type === "ROUND_ENDED") {
        this.scheduleNextRound();
      }
      if (event.type === "STATE_CHANGED") {
        this.scheduleAIActionIfNeeded();
      }
    });

    this.registerBaseHandlers();

    this.onMessage("POKER_ACTION", (client: Client, message: MsgPokerAction) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handlePokerAction(playerId, message);
    });

    // Spawn AI bots to fill the table so the game can start immediately
    this.spawnAIPlayers();

    console.log(`[PokerTableRoom] Created: ${this.roomId}`);
  }

  onDispose(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    for (const timer of this.aiTimers.values()) clearTimeout(timer);
    this.aiTimers.clear();
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
          isAI: false,
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
    // Only record economy result for human players
    const player = this.roundManager.getState().players.get(playerId);
    if (player && !player.isAI) {
      economy.recordMatchResult(playerId, "poker", amount, 0, "win").catch(console.error);
    }
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
        // Check for busted players (human players only; AI gets rechipped)
        for (const [playerId, player] of state.players) {
          if (player.chips <= 0) {
            if (player.isAI) {
              // Restock AI chips so the game continues
              player.chips = AI_STARTING_CHIPS;
            } else {
              this.roundManager.removePlayer(playerId);
              this.state.table.players.delete(playerId);
            }
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

  // ─── AI Management ────────────────────────────────────────────────────────

  private spawnAIPlayers(): void {
    // Add 3 AI bots so the game has enough players to start right away
    const count = 3;
    for (let i = 0; i < count; i++) {
      const seatIndex = this.findEmptySeatIndex();
      if (seatIndex < 0) break;
      const aiId = `ai-${this.roomId}-${i}`;
      this.roundManager.addPlayer({
        playerId: aiId,
        username: AI_NAMES[i % AI_NAMES.length],
        chips: AI_STARTING_CHIPS,
        seatIndex,
        holeCards: [],
        currentBet: 0,
        totalBetInRound: 0,
        isFolded: false,
        isAllIn: false,
        isActive: false,
        isAI: true,
      });
      this.updatePokerPlayer(aiId);
    }
    this.checkAndStartRound();
  }

  private scheduleAIActionIfNeeded(): void {
    const aiPlayer = this.roundManager.getActiveAIPlayer();
    if (!aiPlayer) return;

    const playerId = aiPlayer.playerId;
    // Prevent duplicate timers for the same player
    if (this.aiTimers.has(playerId)) return;

    const timer = setTimeout(() => {
      this.aiTimers.delete(playerId);
      const currentAI = this.roundManager.getActiveAIPlayer();
      // Re-validate that it's still this AI's turn
      if (!currentAI || currentAI.playerId !== playerId) return;

      const state = this.roundManager.getState();
      const decision = getAIAction(currentAI, state);
      console.log(
        `[PokerTableRoom] AI ${currentAI.username} decides: ${decision.action}` +
          (decision.amount ? ` (${decision.amount})` : ""),
      );
      this.roundManager.processAction(playerId, decision.action, decision.amount);
      this.syncPokerState();
    }, AI_ACTION_DELAY_MS);

    this.aiTimers.set(playerId, timer);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

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
    schema.isAI = roundPlayer.isAI ?? false;
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
    this.state.table.lastWinnerId = this.lastWinnerId;
    this.state.table.lastWinAmount = this.lastWinAmount;

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

