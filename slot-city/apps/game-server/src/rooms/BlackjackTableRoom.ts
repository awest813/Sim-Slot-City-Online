import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { BlackjackRoomState, PlayerSchema } from "../models/RoomStateSchemas";
import {
  RoomType,
  MsgBlackjackAction,
  BlackjackGameState,
  BlackjackTableState,
  BlackjackPlayerState,
} from "@slot-city/shared";
import {
  BJServerState, BJServerPhase,
  createServerGame, addPlayer, removePlayer,
  placeBet, dealHands,
  playerHit, playerStand, playerDouble,
  resetRound, handValue,
} from "../systems/BlackjackEngine";

const DEFAULT_MIN_BET = 10;
const DEFAULT_MAX_BET = 500;
const BETTING_WINDOW_MS = 20_000;   // 20 s for players to place bets
const RESULT_DISPLAY_MS = 5_000;    // 5 s to display result before next round

export class BlackjackTableRoom extends BaseRoom<BlackjackRoomState> {
  maxClients = 7;

  private bjState!: BJServerState;
  private bettingTimer: NodeJS.Timeout | null = null;
  private resultTimer:  NodeJS.Timeout | null = null;

  onCreate(options: { minBet?: number; maxBet?: number } = {}): void {
    const roomState = new BlackjackRoomState();
    this.setState(roomState);
    roomState.roomType = RoomType.BLACKJACK;
    roomState.minBet   = options.minBet ?? DEFAULT_MIN_BET;
    roomState.maxBet   = options.maxBet ?? DEFAULT_MAX_BET;

    this.bjState = createServerGame();

    // Blackjack seats (up to 6 players + dealer position)
    for (let i = 0; i < 6; i++) {
      this.addSeat(`bj-seat-${i}`, 4 + i, 5);
    }

    this.registerBaseHandlers();

    this.onMessage("BLACKJACK_ACTION", (client: Client, message: MsgBlackjackAction) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handleBlackjackAction(playerId, message);
    });

    console.log(`[BlackjackTableRoom] Created: ${this.roomId}`);
  }

  onDispose(): void {
    if (this.bettingTimer) clearTimeout(this.bettingTimer);
    if (this.resultTimer)  clearTimeout(this.resultTimer);
    console.log(`[BlackjackTableRoom] Disposed: ${this.roomId}`);
  }

  protected getSpawnPosition(): { tileX: number; tileY: number } {
    return { tileX: 7, tileY: 8 };
  }

  protected onPlayerJoined(_client: Client, player: PlayerSchema): void {
    console.log(`[BlackjackTableRoom] Player joined: ${player.username}`);
    this.broadcastSystemMessage(`${player.username} approaches the blackjack table.`);

    this.bjState = addPlayer(this.bjState, {
      playerId:  player.id,
      username:  player.username,
      chips:     player.chips,
      seatIndex: this.bjState.players.length,
    });

    // Start betting round if we have players and are idle
    if (this.bjState.phase === BJServerPhase.WAITING) {
      this.startBettingPhase();
    }

    this.broadcastBJState();
  }

  protected onPlayerLeft(_client: Client, playerId: string): void {
    console.log(`[BlackjackTableRoom] Player left: ${playerId}`);
    this.bjState = removePlayer(this.bjState, playerId);

    if (this.bjState.players.length === 0) {
      if (this.bettingTimer) { clearTimeout(this.bettingTimer); this.bettingTimer = null; }
      if (this.resultTimer)  { clearTimeout(this.resultTimer);  this.resultTimer  = null; }
      this.bjState = createServerGame();
    }

    this.broadcastBJState();
  }

  protected onPlayerSeated(_playerId: string, _seatId: string): void {
    // Handled via onPlayerJoined — seat assignment is visual only here
  }

  protected onPlayerStoodUp(_playerId: string, _seatId: string): void {
    // No special action needed
  }

  // ── Blackjack action handler ───────────────────────────────────────────────

  private handleBlackjackAction(playerId: string, msg: MsgBlackjackAction): void {
    let newState: BJServerState | null = null;

    switch (msg.action) {
      case "bet":
        if (msg.amount === undefined) return;
        newState = placeBet(
          this.bjState, playerId, msg.amount,
          this.state.minBet, this.state.maxBet,
        );
        if (newState) {
          this.bjState = newState;
          // Check if all seated players have bet → deal immediately
          const seated = this.bjState.players.filter(p => p.chips + p.bet > 0);
          const allBet = seated.length > 0 && seated.every(p => p.hasActed);
          if (allBet) {
            if (this.bettingTimer) { clearTimeout(this.bettingTimer); this.bettingTimer = null; }
            this.dealAndPlay();
          }
        }
        break;

      case "hit":
        newState = playerHit(this.bjState, playerId);
        if (newState) this.bjState = newState;
        break;

      case "stand":
        newState = playerStand(this.bjState, playerId);
        if (newState) this.bjState = newState;
        break;

      case "double":
        newState = playerDouble(this.bjState, playerId);
        if (newState) this.bjState = newState;
        break;
    }

    if (newState) {
      this.syncRoomState();
      this.broadcastBJState();

      if (this.bjState.phase === BJServerPhase.RESULT) {
        this.scheduleNextRound();
      }
    }
  }

  // ── Round lifecycle ────────────────────────────────────────────────────────

  private startBettingPhase(): void {
    this.bjState = { ...this.bjState, phase: BJServerPhase.BETTING };
    this.syncRoomState();
    this.broadcastBJState();

    // Auto-deal after betting window
    this.bettingTimer = setTimeout(() => {
      this.bettingTimer = null;
      this.dealAndPlay();
    }, BETTING_WINDOW_MS);
  }

  private dealAndPlay(): void {
    this.bjState = dealHands(this.bjState);
    this.syncRoomState();
    this.broadcastBJState();

    if (this.bjState.phase === BJServerPhase.RESULT) {
      this.scheduleNextRound();
    }
  }

  private scheduleNextRound(): void {
    this.resultTimer = setTimeout(() => {
      this.resultTimer = null;
      if (this.bjState.players.length > 0) {
        this.bjState = resetRound(this.bjState);
        this.startBettingPhase();
      }
    }, RESULT_DISPLAY_MS);
  }

  // ── State sync ─────────────────────────────────────────────────────────────

  private syncRoomState(): void {
    this.state.gamePhase = this.bjState.phase;
  }

  /** Broadcast full blackjack table state to all clients. */
  private broadcastBJState(): void {
    const table = this.buildTableState();
    this.broadcast("BLACKJACK_STATE_UPDATE", { type: "BLACKJACK_STATE_UPDATE", table });
  }

  private buildTableState(): BlackjackTableState {
    const phaseMap: Record<BJServerPhase, BlackjackGameState> = {
      [BJServerPhase.WAITING]:     BlackjackGameState.WAITING,
      [BJServerPhase.BETTING]:     BlackjackGameState.BETTING,
      [BJServerPhase.PLAYER_TURN]: BlackjackGameState.PLAYER_TURN,
      [BJServerPhase.DEALER_TURN]: BlackjackGameState.DEALER_TURN,
      [BJServerPhase.RESULT]:      BlackjackGameState.RESULT,
    };

    const players: BlackjackPlayerState[] = this.bjState.players.map(p => ({
      playerId:   p.playerId,
      username:   p.username,
      chips:      p.chips,
      hand:       this.bjState.dealerRevealed || p.result !== null ? p.hand : p.hand,
      handValue:  handValue(p.hand),
      bet:        p.bet,
      result:     p.result,
      isActive:   p.isActive,
      hasActed:   p.hasActed,
      seatIndex:  p.seatIndex,
    }));

    return {
      tableId:         this.roomId,
      gameState:       phaseMap[this.bjState.phase],
      players,
      dealerHand:      this.bjState.dealerRevealed
        ? this.bjState.dealerHand
        : this.bjState.dealerHand.slice(0, 1),    // only show first card
      dealerHandValue: this.bjState.dealerRevealed
        ? handValue(this.bjState.dealerHand)
        : handValue(this.bjState.dealerHand.slice(0, 1)),
      dealerRevealed:  this.bjState.dealerRevealed,
      minBet:          this.state.minBet,
      maxBet:          this.state.maxBet,
      maxSeats:        6,
    };
  }
}

