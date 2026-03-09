import { Room, Client } from "colyseus";
import { BaseRoomState, PlayerSchema, SeatSchema, ChatMessageSchema } from "../models/RoomStateSchemas";
import {
  PlayerDirection,
  PlayerAnimState,
  EmoteType,
  MsgMove,
  MsgChat,
  MsgEmote,
  MsgSitDown,
  ClientMessage,
} from "@slot-city/shared";
import { verifyToken } from "../services/AuthService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MAX_CHAT_HISTORY = 50;

type AuthData = { userId: string; username: string; chips: number };

export abstract class BaseRoom<TState extends BaseRoomState> extends Room<TState> {
  protected playerSessionMap: Map<string, string> = new Map(); // clientId -> playerId

  async onAuth(_client: Client, options: { token?: string }): Promise<AuthData> {
    if (!options.token) {
      throw new Error("No token provided");
    }
    try {
      const { userId } = verifyToken(options.token);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, chips: true },
      });
      if (!user) throw new Error("User not found");
      return { userId: user.id, username: user.username, chips: user.chips };
    } catch {
      throw new Error("Invalid token");
    }
  }

  onJoin(client: Client, _options: unknown, auth?: AuthData): void {
    if (!auth) return;
    const player = new PlayerSchema();
    player.id = auth.userId;
    player.username = auth.username;
    player.chips = auth.chips;
    player.roomId = this.roomId;
    player.animState = PlayerAnimState.IDLE;
    player.direction = PlayerDirection.SOUTH;

    const spawnPos = this.getSpawnPosition();
    player.pos.tileX = spawnPos.tileX;
    player.pos.tileY = spawnPos.tileY;

    this.state.players.set(auth.userId, player);
    this.state.playerCount = this.state.players.size;
    this.playerSessionMap.set(client.sessionId, auth.userId);

    this.broadcastSystemMessage(`${auth.username} joined the room`);
    this.onPlayerJoined(client, player);
  }

  onLeave(client: Client): void {
    const playerId = this.playerSessionMap.get(client.sessionId);
    if (!playerId) return;

    const player = this.state.players.get(playerId);
    if (player) {
      if (player.seatId) {
        const seat = this.state.seats.get(player.seatId);
        if (seat) seat.occupantId = "";
      }
      this.broadcastSystemMessage(`${player.username} left the room`);
    }

    this.state.players.delete(playerId);
    this.state.playerCount = this.state.players.size;
    this.playerSessionMap.delete(client.sessionId);
    this.onPlayerLeft(client, playerId);
  }

  // Colyseus 0.15: register message handlers in subclass onCreate() via this.onMessage()
  // This base helper is called from subclass onCreate() to wire up common handlers.
  protected registerBaseHandlers(): void {
    this.onMessage("MOVE", (client: Client, message: MsgMove) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handleMove(playerId, message);
    });

    this.onMessage("CHAT", (client: Client, message: MsgChat) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handleChat(playerId, message);
    });

    this.onMessage("EMOTE", (client: Client, message: MsgEmote) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handleEmote(playerId, message);
    });

    this.onMessage("SIT_DOWN", (client: Client, message: MsgSitDown) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handleSitDown(playerId, message);
    });

    this.onMessage("STAND_UP", (client: Client) => {
      const playerId = this.playerSessionMap.get(client.sessionId);
      if (!playerId) return;
      this.handleStandUp(playerId);
    });
  }

  private handleMove(playerId: string, msg: MsgMove): void {
    const player = this.state.players.get(playerId);
    if (!player || player.seatId) return;

    player.pos.tileX = msg.pos.tileX;
    player.pos.tileY = msg.pos.tileY;
    player.direction = msg.direction;
    player.animState = PlayerAnimState.WALK;

    setTimeout(() => {
      const p = this.state.players.get(playerId);
      if (p && p.animState === PlayerAnimState.WALK) {
        p.animState = PlayerAnimState.IDLE;
      }
    }, 300);
  }

  private handleChat(playerId: string, msg: MsgChat): void {
    const player = this.state.players.get(playerId);
    if (!player) return;
    if (!msg.message || msg.message.trim().length === 0) return;
    const sanitized = msg.message.trim().slice(0, 200);

    const chatMsg = new ChatMessageSchema();
    chatMsg.playerId = playerId;
    chatMsg.username = player.username;
    chatMsg.message = sanitized;
    chatMsg.timestamp = Date.now();
    chatMsg.roomId = this.roomId;
    chatMsg.type = "chat";
    this.addChatMessage(chatMsg);
  }

  private handleEmote(playerId: string, msg: MsgEmote): void {
    const player = this.state.players.get(playerId);
    if (!player) return;
    if (!Object.values(EmoteType).includes(msg.emote)) return;

    player.emote = msg.emote;
    player.animState = PlayerAnimState.EMOTE;

    setTimeout(() => {
      const p = this.state.players.get(playerId);
      if (p) {
        p.emote = "";
        p.animState = PlayerAnimState.IDLE;
      }
    }, 3000);
  }

  private handleSitDown(playerId: string, msg: MsgSitDown): void {
    const player = this.state.players.get(playerId);
    if (!player || player.seatId) return;

    const seat = this.state.seats.get(msg.seatId);
    if (!seat || seat.occupantId) return;

    seat.occupantId = playerId;
    player.seatId = msg.seatId;
    player.animState = PlayerAnimState.SEATED;
    player.pos.tileX = seat.tileX;
    player.pos.tileY = seat.tileY;
    this.onPlayerSeated(playerId, msg.seatId);
  }

  private handleStandUp(playerId: string): void {
    const player = this.state.players.get(playerId);
    if (!player || !player.seatId) return;

    const seat = this.state.seats.get(player.seatId);
    if (seat) seat.occupantId = "";

    const prevSeatId = player.seatId;
    player.seatId = "";
    player.animState = PlayerAnimState.IDLE;
    this.onPlayerStoodUp(playerId, prevSeatId);
  }

  protected broadcastSystemMessage(text: string): void {
    const msg = new ChatMessageSchema();
    msg.playerId = "system";
    msg.username = "System";
    msg.message = text;
    msg.timestamp = Date.now();
    msg.roomId = this.roomId;
    msg.type = "system";
    this.addChatMessage(msg);
  }

  protected addChatMessage(msg: ChatMessageSchema): void {
    this.state.recentMessages.push(msg);
    if (this.state.recentMessages.length > MAX_CHAT_HISTORY) {
      this.state.recentMessages.splice(0, 1);
    }
  }

  protected addSeat(id: string, tileX: number, tileY: number): void {
    const seat = new SeatSchema();
    seat.id = id;
    seat.tileX = tileX;
    seat.tileY = tileY;
    seat.isInteractive = true;
    this.state.seats.set(id, seat);
  }

  protected abstract getSpawnPosition(): { tileX: number; tileY: number };
  protected abstract onPlayerJoined(client: Client, player: PlayerSchema): void;
  protected abstract onPlayerLeft(client: Client, playerId: string): void;
  protected abstract onPlayerSeated(playerId: string, seatId: string): void;
  protected abstract onPlayerStoodUp(playerId: string, seatId: string): void;
}
