// ─────────────────────────────────────────────
//  Enums
// ─────────────────────────────────────────────

export enum RoomType {
  LOBBY = "lobby",
  POKER = "poker",
  BLACKJACK = "blackjack",
  BAR = "bar",
  VIP = "vip",
}

export enum PlayerDirection {
  NORTH = "north",
  SOUTH = "south",
  EAST = "east",
  WEST = "west",
}

export enum PlayerAnimState {
  IDLE = "idle",
  WALK = "walk",
  SEATED = "seated",
  EMOTE = "emote",
}

export enum PokerGameState {
  WAITING = "WAITING",
  DEAL = "DEAL",
  PRE_FLOP = "PRE_FLOP",
  FLOP = "FLOP",
  TURN = "TURN",
  RIVER = "RIVER",
  SHOWDOWN = "SHOWDOWN",
  END_ROUND = "END_ROUND",
}

export enum TournamentStatus {
  WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
  STARTING = "STARTING",
  RUNNING = "RUNNING",
  FINAL_TABLE = "FINAL_TABLE",
  FINISHED = "FINISHED",
}

export enum EmoteType {
  WAVE = "wave",
  LAUGH = "laugh",
  CHEER = "cheer",
  SHRUG = "shrug",
  THUMBSUP = "thumbsup",
  CLAP = "clap",
}

// ─────────────────────────────────────────────
//  Position types
// ─────────────────────────────────────────────

export interface IsoPosition {
  tileX: number;
  tileY: number;
}

export interface WorldPosition {
  x: number;
  y: number;
}

// ─────────────────────────────────────────────
//  Player / Avatar
// ─────────────────────────────────────────────

export interface PlayerState {
  id: string;
  username: string;
  chips: number;
  pos: IsoPosition;
  direction: PlayerDirection;
  animState: PlayerAnimState;
  seatId: string | null;
  roomId: string;
  emote: EmoteType | null;
  outfitId: string;
}

// ─────────────────────────────────────────────
//  Chat
// ─────────────────────────────────────────────

export interface ChatMessage {
  playerId: string;
  username: string;
  message: string;
  timestamp: number;
  roomId: string;
  type: "chat" | "system" | "emote";
}

// ─────────────────────────────────────────────
//  Seat / Interaction
// ─────────────────────────────────────────────

export interface SeatState {
  id: string;
  occupantId: string | null;
  pos: IsoPosition;
  isInteractive: boolean;
}

// ─────────────────────────────────────────────
//  Poker
// ─────────────────────────────────────────────

export enum CardSuit {
  SPADES = "S",
  HEARTS = "H",
  DIAMONDS = "D",
  CLUBS = "C",
}

export enum CardRank {
  TWO = "2",
  THREE = "3",
  FOUR = "4",
  FIVE = "5",
  SIX = "6",
  SEVEN = "7",
  EIGHT = "8",
  NINE = "9",
  TEN = "T",
  JACK = "J",
  QUEEN = "Q",
  KING = "K",
  ACE = "A",
}

export interface Card {
  suit: CardSuit;
  rank: CardRank;
}

export interface PokerPlayerState {
  playerId: string;
  username: string;
  chips: number;
  seatIndex: number;
  cards: Card[];
  currentBet: number;
  totalBetInRound: number;
  isFolded: boolean;
  isAllIn: boolean;
  isActive: boolean;
}

export interface PokerTableState {
  tableId: string;
  gameState: PokerGameState;
  players: PokerPlayerState[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  activePlayerSeat: number;
  minBuyIn: number;
  maxBuyIn: number;
  smallBlind: number;
  bigBlind: number;
  maxSeats: number;
}

// ─────────────────────────────────────────────
//  Tournament
// ─────────────────────────────────────────────

export interface TournamentSummary {
  id: string;
  name: string;
  buyIn: number;
  prizePool: number;
  maxPlayers: number;
  registeredPlayers: number;
  status: TournamentStatus;
  startTime: number | null;
  blindLevel: number;
  blindIncreaseMinutes: number;
}

export interface TournamentPlayerEntry {
  playerId: string;
  username: string;
  chips: number;
  place: number | null;
  isEliminated: boolean;
  tableId: string | null;
}

// ─────────────────────────────────────────────
//  Client → Server Messages
// ─────────────────────────────────────────────

export interface MsgMove {
  type: "MOVE";
  pos: IsoPosition;
  direction: PlayerDirection;
}

export interface MsgChat {
  type: "CHAT";
  message: string;
}

export interface MsgEmote {
  type: "EMOTE";
  emote: EmoteType;
}

export interface MsgSitDown {
  type: "SIT_DOWN";
  seatId: string;
}

export interface MsgStandUp {
  type: "STAND_UP";
}

export interface MsgPokerAction {
  type: "POKER_ACTION";
  action: "fold" | "call" | "raise" | "check";
  amount?: number;
}

export interface MsgRegisterTournament {
  type: "REGISTER_TOURNAMENT";
  tournamentId: string;
}

export type ClientMessage =
  | MsgMove
  | MsgChat
  | MsgEmote
  | MsgSitDown
  | MsgStandUp
  | MsgPokerAction
  | MsgRegisterTournament;

// ─────────────────────────────────────────────
//  Server → Client Messages
// ─────────────────────────────────────────────

export interface MsgPlayerJoined {
  type: "PLAYER_JOINED";
  player: PlayerState;
}

export interface MsgPlayerLeft {
  type: "PLAYER_LEFT";
  playerId: string;
}

export interface MsgChatReceived {
  type: "CHAT_RECEIVED";
  message: ChatMessage;
}

export interface MsgPokerStateUpdate {
  type: "POKER_STATE_UPDATE";
  table: PokerTableState;
}

export interface MsgTournamentUpdate {
  type: "TOURNAMENT_UPDATE";
  tournament: TournamentSummary;
}

export interface MsgChipsUpdate {
  type: "CHIPS_UPDATE";
  chips: number;
}

export interface MsgError {
  type: "ERROR";
  code: string;
  message: string;
}

export type ServerMessage =
  | MsgPlayerJoined
  | MsgPlayerLeft
  | MsgChatReceived
  | MsgPokerStateUpdate
  | MsgTournamentUpdate
  | MsgChipsUpdate
  | MsgError;

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

export const STARTING_CHIPS = 5000;

export const ROOM_CONFIGS = {
  [RoomType.LOBBY]: { maxClients: 100, displayName: "Casino Lobby" },
  [RoomType.POKER]: { maxClients: 6, displayName: "Poker Room" },
  [RoomType.BLACKJACK]: { maxClients: 7, displayName: "Blackjack Table" },
  [RoomType.BAR]: { maxClients: 50, displayName: "The Lucky Lounge" },
  [RoomType.VIP]: { maxClients: 20, displayName: "VIP Lounge" },
} as const;

export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

export const BLIND_SCHEDULE = [
  { level: 1, small: 25, big: 50 },
  { level: 2, small: 50, big: 100 },
  { level: 3, small: 75, big: 150 },
  { level: 4, small: 100, big: 200 },
  { level: 5, small: 150, big: 300 },
  { level: 6, small: 200, big: 400 },
  { level: 7, small: 300, big: 600 },
  { level: 8, small: 400, big: 800 },
  { level: 9, small: 600, big: 1200 },
  { level: 10, small: 1000, big: 2000 },
] as const;
