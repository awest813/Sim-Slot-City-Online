# Slot City Online — Agent Reference Guide

> **Purpose:** This document is written for AI coding agents. It provides everything needed to
> understand, navigate, extend, debug, or test this codebase without reading every file first.

---

## 1. What Is This Project?

**Slot City Online** is a browser-based isometric social casino. Think "The Sims Online meets neon
Vegas." Players walk an avatar through a procedurally-drawn casino lobby, approach interactive zones
(slots, poker, bar), and play mini-games using fictional in-game chips.

**Two independent playable modes exist:**

| Mode | Entry Point | Works Without Server? |
|------|------------|----------------------|
| **Solo (guest)** | `npm run dev` at repo root | ✅ Yes |
| **Multiplayer** | `npm run dev` inside `slot-city/` | ❌ Needs Colyseus + PostgreSQL |

---

## 2. Repository Layout

```
/                                ← Root (solo mode game — fully playable)
├── src/                         ← Phaser 3 solo game source (TypeScript)
│   ├── main.ts                  ← Boots Phaser; entry point for solo mode
│   ├── game/
│   │   ├── config.ts            ← Phaser GameConfig (scenes list, physics)
│   │   └── constants.ts         ← All colours, depths, zone rects, fonts
│   ├── scenes/
│   │   ├── BootScene.ts         ← Trivial; starts PreloadScene
│   │   └── PreloadScene.ts      ← Name entry + progress bar → CasinoLobbyScene
│   ├── core/
│   │   ├── state/GameState.ts   ← Singleton state store (chips, zone, interaction)
│   │   └── systems/
│   │       ├── AvatarController.ts   ← WASD movement, depth sort, collisions
│   │       └── InteractionSystem.ts  ← Hotspot proximity → E-key prompt → callback
│   └── features/
│       ├── lobby/CasinoLobbyScene.ts ← Main playable scene (world, props, panels)
│       ├── slots/SlotsPanel.ts       ← 3-reel slot machine minigame
│       ├── poker/
│       │   ├── PokerEngine.ts        ← Deterministic Hold'em logic (no Phaser)
│       │   ├── PokerAI.ts            ← Rule-based AI decisions (no Phaser)
│       │   └── PokerPanel.ts         ← Poker table UI (Phaser, uses PokerEngine)
│       ├── bar/BarPanel.ts           ← Bar drinks, tips, once-per-session bonuses
│       └── ui/
│           ├── HUD.ts               ← Top-left info bar; subscribes to GameState
│           └── Panel.ts             ← Reusable modal base class
│
├── index.html                   ← Loads /src/main.ts (solo mode entry point)
├── package.json                 ← "slot-city-client"; solo mode build scripts
├── tsconfig.json                ← Covers /src only (ES2020, strict, DOM lib)
├── vite/                        ← Vite configs for solo mode build
│
├── slot-city/                   ← Multiplayer monorepo (separate from solo mode)
│   ├── apps/
│   │   ├── game-client/         ← Phaser 3 multiplayer client
│   │   │   └── src/
│   │   │       ├── scenes/      ← BootScene, LoginScene, CasinoLobbyScene,
│   │   │       │                    SlotsScene, PokerRoomScene, BarRoomScene,
│   │   │       │                    OfflinePokerScene
│   │   │       ├── systems/     ← IsoRenderer, MovementController, PlayerAvatar
│   │   │       ├── managers/    ← NetworkManager (Colyseus + guest mode)
│   │   │       ├── store/       ← LocalStore (localStorage chip balance)
│   │   │       └── ui/          ← ChatUI
│   │   ├── game-server/         ← Colyseus Node.js authoritative server
│   │   │   └── src/
│   │   │       ├── index.ts     ← Express + Colyseus setup
│   │   │       ├── rooms/       ← LobbyRoom, PokerTableRoom, BarRoom,
│   │   │       │                    BlackjackTableRoom (stub), BaseRoom
│   │   │       ├── systems/     ← PokerEngine, PokerAI, PokerRoundManager
│   │   │       ├── managers/    ← TournamentManager
│   │   │       ├── services/    ← AuthService (JWT), ApiRoutes, ChipEconomyService
│   │   │       ├── models/      ← RoomStateSchemas, PokerSchema (Colyseus @Schema)
│   │   │       └── tests/       ← Jest test suites (64 tests total)
│   │   └── web/                 ← Next.js 15 dashboard (profile, leaderboard,
│   │                                tournaments); requires DB
│   ├── packages/
│   │   └── shared/src/index.ts  ← Single file: all enums, interfaces, constants,
│   │                                message types shared between client and server
│   ├── prisma/schema.prisma     ← PostgreSQL schema (User, ChipTransaction,
│   │                                PokerHand, Tournament, LeaderboardEntry, …)
│   └── docs/                    ← architecture.md, vision.md, roadmap.md,
│                                    art-direction.md
│
├── AUDIT.md                     ← Repo truth audit; Phase 2 TODO list
├── README.md                    ← User-facing docs (accurate, up to date)
└── agents.md                    ← This file
```

---

## 3. Build, Run, and Test Commands

### Solo mode (no server)

```bash
# Install root deps (run once)
npm install

# Start dev server
npm run dev            # → http://localhost:8080

# TypeScript check (no emit)
node_modules/.bin/tsc --noEmit

# Production build
npm run build
```

### Full multiplayer stack

```bash
cd slot-city
npm install

# First-time DB setup
npm run db:migrate
npm run db:generate

# Copy and edit .env (DATABASE_URL + JWT_SECRET required)
cp .env.example .env

# Start everything in parallel
npm run dev

# Or individually:
npm run dev:server     # Colyseus  → ws://localhost:2567
npm run dev:client     # Phaser    → http://localhost:3001
npm run dev:web        # Next.js   → http://localhost:3000
```

### Tests

```bash
# All 64 tests (from repo root or slot-city/)
npm run test

# From game-server directly
cd slot-city/apps/game-server
npx jest --forceExit
```

Tests live in `slot-city/apps/game-server/src/tests/`. They are Jest unit tests covering pure
game logic — no Phaser, no network, no database needed to run them.

| Test file | What it covers |
|-----------|---------------|
| `PokerEngine.test.ts` | Deck creation, hand evaluation (all ranks), hand comparison |
| `PokerAI.test.ts` | Pre-flop/post-flop hand strength, fold/call/raise decisions |
| `PokerRound.test.ts` | Round state machine, blinds, actions, winner detection |
| `ChipEconomy.test.ts` | Chip add/remove, transfer, match result recording |
| `Tournament.test.ts` | Registration, bracket, elimination, final table |

---

## 4. Key Architectural Decisions

### 4a. Solo Mode is the Primary Playable Experience

The root `/src/` codebase boots a fully playable casino without any server. This is intentional:
offline-first, then multiplayer layered on top. When making changes to gameplay logic (slots,
poker, bar), you are almost always editing files in `src/features/`.

### 4b. Two Separate Game Clients

- **Root `/src/`** — the solo-mode client. Uses `GameState` (module-level singleton), `AvatarController`,
  and `InteractionSystem`. No network code at all.
- **`slot-city/apps/game-client/`** — the multiplayer client. Uses `NetworkManager`, `LocalStore`,
  Colyseus `Room`, and per-scene network synchronisation. Shares no runtime code with root `/src/`.

Do not mix imports between these two trees.

### 4c. PokerEngine is Duplicated by Design

`src/features/poker/PokerEngine.ts` (solo client) and
`slot-city/apps/game-server/src/systems/PokerEngine.ts` (server) are separate implementations
sharing the same logic. The server version uses `@slot-city/shared` Card types; the client version
uses its own local types. When fixing a poker logic bug, you may need to update both files.

### 4d. GameState — Singleton Observer Pattern

`src/core/state/GameState.ts` is a plain TypeScript class (no Phaser dependency). It holds the
player's chip balance, zone, and interaction state. Components subscribe via `GameState.subscribe()`.
The HUD re-renders on every chip change. SlotsPanel and PokerPanel read chips via `GameState.get()`.

```typescript
// Reading state
const { chips, zone } = GameState.get();

// Mutating state (triggers all subscribers)
GameState.addChips(-bet);
GameState.update({ interaction: 'slots' });

// Subscribing (returns unsubscribe fn)
const unsub = GameState.subscribe(s => hud.refresh(s));
```

### 4e. Panel Lifecycle

SlotsPanel, PokerPanel, and BarPanel are **not** Phaser Scenes — they are plain TypeScript classes
that add Phaser objects to the current scene. Each has a `close()` method guarded by a `closed`
boolean to prevent double-destroy. CasinoLobbyScene owns a single `activePanel` state:

```typescript
// Typical open pattern (CasinoLobbyScene)
this.activePanel = 'slots';
GameState.setInteraction('slots');
new SlotsPanel(this, () => {
    this.activePanel = 'none';
    GameState.clearInteraction();
});
```

### 4f. Shared Types Package

`slot-city/packages/shared/src/index.ts` is the single source of truth for:
- `RoomType`, `PlayerDirection`, `PlayerAnimState`, `EmoteType`
- `PokerGameState` enum (WAITING → DEAL → PRE_FLOP → … → END_ROUND)
- `CardSuit`, `CardRank`, `Card`
- `STARTING_CHIPS = 5000`, `BLIND_SCHEDULE` (10 levels), `ROOM_CONFIGS`
- All client→server and server→client message type interfaces

Build it with `npm run build --workspace=packages/shared` before running tests.

---

## 5. Solo-Mode Game Logic in Detail

### 5a. Slot Machine (`src/features/slots/SlotsPanel.ts`)

- **State machine:** `'idle' → 'spinning' → 'result' → 'idle'`
- **Symbols & weights:** `['🍒','🍋','🍊','🍇','⭐','💎','7️⃣']` with weights `[30,25,20,12,7,4,2]`
- **Payouts (3-of-a-kind):** 🍒=2×, 🍋=3×, 🍊=4×, 🍇=6×, ⭐=10×, 💎=20×, 7️⃣=50×
- **Cherry pair consolation:** 1× bet
- **Spin button stays disabled 500 ms after eval** (prevents double-spin UX bug)
- **Free chips offered** when chips = 0 and no affordable bet option
- **Keyboard:** SPACE=spin, ESC=close (via `.destroy()` on Phaser Key objects)
- **Timer cleanup:** All running `Phaser.Time.TimerEvent`s stored in `spinTimers[]`; all cancelled in `close()`

### 5b. Poker Engine (`src/features/poker/PokerEngine.ts`)

Pure TypeScript — no Phaser, no randomness in game logic (only in `shuffledDeck()`).

**Key types:**
```typescript
type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
type PlayerAction = 'fold' | 'check' | 'call' | 'raise';
```

**Key functions:**
- `createGame(activePlayers)` — initialise state (phase='waiting')
- `dealHand(state)` → new state (phase='preflop', blinds posted, `pendingActors` queue set)
- `processAction(state, action, raiseTotal?)` → new state (immutable update pattern)
- `advancePhase(state)` — burn+deal community cards, move to next street; recurses if all players are all-in
- `resolveShowdown(state)` — eval best hand per player; odd chip goes to first winner
- `evalBestHand(cards)` → `{ score: number[], name: string }` — iterates all C(n,5) combos

**Betting queue:** `pendingActors: number[]` tracks who still needs to act. On a raise, all active
non-folder players are re-added (wrap-around from raiser). Empty queue → `advancePhase()`.

**Heads-up (2 players):** dealer = SB (acts first pre-flop), other = BB.

### 5c. Poker AI (`src/features/poker/PokerAI.ts`)

`getAIDecision(state, playerIdx)` returns `{ action, raiseTotal? }`.

- Pre-flop strength via explicit look-up table (AA=1.0, KK=0.95, 22=0.45, AK=0.90…)
- Post-flop strength via `evalBestHand()` → hand rank → fixed strength map [0.08…1.0]
- ±0.09 noise added (`Math.random() - 0.5) * 0.18`)
- Raise threshold: 0.68; fold threshold: 0.28 + potOdds×0.25
- Raise size: 1–3× big blind above currentBet based on strength

AI auto-rebuys to `sc.aiChips` when eliminated (in `PokerPanel.startHand()`), so the game never
runs out of opponents.

### 5d. Bar Panel (`src/features/bar/BarPanel.ts`)

- 6 drink options; one random pick is "Today's Special" (50% off)
- "Lucky Shot" (`bonusChips: 75, oncePerSession: true`) is tracked in module-level
  `_sessionClaimedBonuses: Set<string>` — persists across bar visits within a session
- `resetBarSession()` must be called when a new casino session starts (called in `CasinoLobbyScene.create()`)
- After ordering a once-per-session drink, the button is visually dimmed immediately (rect fill → `DISABLED_COLOR`)

### 5e. HUD (`src/features/ui/HUD.ts`)

- Subscribes to `GameState` on construction; unsubscribes in `destroy()`
- Chip counter flashes green on gain, red on loss (600 ms timer)
- "Free Chips" button shown only when `chips === 0 && interaction === 'free'`
- **Free chips amount:** 500

---

## 6. Server-Side Architecture

### 6a. Entry Point (`slot-city/apps/game-server/src/index.ts`)

```
Express  ─── /auth (register, login)       ← AuthService (JWT, bcrypt, Prisma)
         ─── /leaderboard, /tournaments    ← ApiRoutes (Prisma queries)
         └── /health                       ← liveness check

Colyseus ─── RoomType.LOBBY    → LobbyRoom
         ─── RoomType.POKER    → PokerTableRoom
         ─── RoomType.BAR      → BarRoom
         └── RoomType.BLACKJACK → BlackjackTableRoom (stub — no gameplay)
```

### 6b. Room Hierarchy

```
BaseRoom          ← auth (onAuth JWT), movement (MOVE msg), chat (CHAT),
                    emote, sit/stand, playerSchema lifecycle
  ├── LobbyRoom
  ├── PokerTableRoom   ← uses PokerRoundManager for server-authoritative poker
  ├── BarRoom          ← holds globalTournamentManager instance
  └── BlackjackTableRoom  ← stub; no game logic
```

### 6c. Colyseus State Schemas

Defined in `models/RoomStateSchemas.ts`. Auto-synced to all clients via Colyseus delta patches.

```typescript
PlayerSchema:   id, username, chips, pos (tileX/tileY), direction, animState,
                seatId, roomId, emote, outfitId
SeatSchema:     id, occupantId, tileX, tileY, isInteractive
BaseRoomState:  players: MapSchema<PlayerSchema>, seats: MapSchema<SeatSchema>,
                recentMessages: ArraySchema<ChatMessageSchema>, roomType, playerCount
```

### 6d. PokerRoundManager (`game-server/src/systems/PokerRoundManager.ts`)

Server-side round state machine. Different from root PokerEngine — uses `@slot-city/shared` types
and a Map-based player store.

```typescript
manager.addPlayer(player)
manager.startRound()               // deals, posts blinds, sets PRE_FLOP
manager.processAction(playerId, action, amount?)  // returns bool (false = invalid)
manager.getActiveAIPlayer()        // returns PokerPlayer | undefined
manager.reset()
```

**Action timeout:** 30 s auto-fold via `setTimeout` (stored as `this.actionTimer`; cleared on each action and `reset()`).

**Known limitation:** `isBettingRoundComplete()` does not track whether the BB has had their option
to raise pre-flop when everyone has merely called. In standard poker, the BB gets one more action
opportunity before the flop. The client-side `PokerEngine.ts` handles this correctly via the
`pendingActors` queue.

### 6e. AuthService (`game-server/src/services/AuthService.ts`)

- JWT-based; secret from `process.env.JWT_SECRET` (falls back to dev secret — **change in prod**)
- Token expiry: 7 days
- Rate-limited: 20 auth requests / 15 min (auth endpoints), 60 API calls / 1 min (general)
- `bcryptjs` for password hashing
- Returns `{ userId, username, chips, outfitId }` on successful login/register

### 6f. ChipEconomyService (`game-server/src/services/ChipEconomyService.ts`)

- All chip mutations go through Prisma with proper `$transaction` for transfers
- `removeChips()` throws if balance is insufficient (prevents going below zero)
- `recordMatchResult()` updates `MatchHistory` and upserts `LeaderboardEntry` atomically

---

## 7. Multiplayer Client Notes

### NetworkManager (`game-client/src/managers/NetworkManager.ts`)

Central network façade. Two modes:

```typescript
networkManager.setGuestUser(name)     // guest mode — offline, no server
networkManager.isGuestMode()          // true when playing offline
networkManager.syncChipsFromStore()   // pull balance from LocalStore into user object
networkManager.joinRoom(type, opts)   // returns Colyseus Room (or throws if offline)
networkManager.sendMessage(msg)       // no-op if offline
```

### LocalStore (`game-client/src/store/LocalStore.ts`)

localStorage-backed chip balance for guest/offline play.

```typescript
localStore.load()       // { username, chips }
localStore.save(data)   // persists to localStorage
localStore.addChips(n)  // delta add, clamped to 0
```

### CasinoLobbyScene (multiplayer)

- Always creates local avatar + movement controller (not gated on server)
- Attempts `networkManager.joinRoom(RoomType.LOBBY)` asynchronously — if it fails, guest mode continues
- Avatar movement events are forwarded to the server only when `this.room` is non-null
- Sync chip count from LocalStore when returning from a sub-scene in guest mode

---

## 8. Database Schema Highlights (`slot-city/prisma/schema.prisma`)

| Model | Key fields |
|-------|-----------|
| `User` | id (cuid), email (unique), username (unique), passwordHash, chips (default 5000) |
| `ChipTransaction` | userId, amount, type (win/loss/reload/penalty), reason, timestamp |
| `PokerHand` | userId, tableId, buyIn, finalChips, duration (sec), result |
| `Tournament` | id, name, buyIn, status, startTime, endTime, maxPlayers, registeredPlayers |
| `MatchHistory` | userId, roomType, chipsWon, chipsLost, result |
| `LeaderboardEntry` | userId (unique), totalChipsWon, tournamentWins, gamesPlayed |

`STARTING_CHIPS = 5000` is the default balance defined in `@slot-city/shared`.

---

## 9. Message Protocol

All types in `slot-city/packages/shared/src/index.ts`.

### Client → Server

| Type | Fields | Purpose |
|------|--------|---------|
| `MsgMove` | `tileX, tileY, direction` | Avatar position update |
| `MsgChat` | `text` | Send chat message |
| `MsgEmote` | `emote: EmoteType` | Trigger emote animation |
| `MsgSitDown` | `seatId` | Occupy a seat |
| `MsgStandUp` | — | Leave current seat |
| `MsgPokerAction` | `action, amount?` | Poker fold/call/raise/check |
| `MsgRegisterTournament` | `tournamentId` | Enter tournament |

### Server → Client

| Type | Fields | Purpose |
|------|--------|---------|
| `MsgPlayerJoined` | `player: PlayerState` | New player arrived |
| `MsgPlayerLeft` | `playerId` | Player disconnected |
| `MsgChatReceived` | `message: ChatMessage` | Broadcast chat |
| `MsgPokerStateUpdate` | `tableState: PokerTableState` | Poker state push |
| `MsgTournamentUpdate` | `summary: TournamentSummary` | Tournament news |
| `MsgChipsUpdate` | `chips` | Chip balance changed |
| `MsgError` | `code, message` | Error from server |

---

## 10. Design Patterns Reference

| Pattern | Where Used |
|---------|-----------|
| Singleton | `GameState` (solo mode central store) |
| Observer | `GameState.subscribe()` → HUD refresh |
| Immutable state + pure functions | `PokerEngine` (every function returns new state) |
| State machine (string enum) | `SlotsPanel` (idle/spinning/result), `PokerGameState` enum |
| Pending-actor queue | `PokerEngine.pendingActors[]` (betting round tracking) |
| Abstract base room | `BaseRoom` → `LobbyRoom`, `PokerTableRoom`, `BarRoom` |
| Colyseus @Schema auto-sync | All multiplayer state (delta patches, no manual diff) |
| Module-level session set | `_sessionClaimedBonuses` in `BarPanel.ts` |

---

## 11. Known Issues and Limitations

| Issue | Severity | Location | Notes |
|-------|----------|----------|-------|
| BB pre-flop option missing | 🟡 Medium | `PokerRoundManager.isBettingRoundComplete()` | Server only; client PokerEngine is correct. Fix requires tracking a `bbHasActed` flag across the pre-flop round. |
| Blackjack room is a stub | 🟡 Low | `BlackjackTableRoom.ts` | Room defined, no game logic. |
| No E2E tests | 🟡 Low | — | Only unit tests on game logic; no browser/integration tests. |
| No sprite assets | 🟡 Low | All panels, `PlayerAvatar.ts` | All graphics are Phaser procedural shapes and emoji; designed for sprite sheet swap. |
| Root `/src/` not used by `slot-city/` | ℹ️ Info | repo root | Solo mode and multiplayer client are independent codebases; they share no runtime imports. |
| Server optional for solo gameplay | ℹ️ Info | — | The multiplayer client gracefully degrades; not a bug. |

---

## 12. Editing Guide — Where to Make Common Changes

| Task | File(s) to Edit |
|------|----------------|
| Change slot machine symbols or payouts | `src/features/slots/SlotsPanel.ts` — `SYMBOLS`, `WEIGHTS`, `PAYOUTS` |
| Change poker blinds or buy-in | `src/features/poker/PokerEngine.ts` — `createGame()` defaults; `src/features/poker/PokerPanel.ts` — `BUY_IN` const |
| Change AI poker strength / style | `src/features/poker/PokerAI.ts` — `preflopStrength()`, thresholds |
| Add/remove bar drinks | `src/features/bar/BarPanel.ts` — `ALL_DRINKS` array |
| Adjust starting chips | `src/core/state/GameState.ts` — `DEFAULT_PLAYER.chips` (solo); `slot-city/packages/shared/src/index.ts` — `STARTING_CHIPS` (server) |
| Add a new zone to the lobby | `src/game/constants.ts` — add `ZONE_*` rect; `src/features/lobby/CasinoLobbyScene.ts` — draw zone + register hotspot |
| Change colours or font | `src/game/constants.ts` |
| Add a server REST endpoint | `slot-city/apps/game-server/src/services/ApiRoutes.ts` |
| Add a Colyseus room | Extend `BaseRoom`, register in `index.ts` with `gameServer.define(...)` |
| Change DB schema | `slot-city/prisma/schema.prisma` → run `npm run db:migrate` + `npm run db:generate` |
| Add shared types | `slot-city/packages/shared/src/index.ts` → rebuild with `npm run build --workspace=packages/shared` |

---

## 13. Environment Variables

Only required for multiplayer mode. Defined in `slot-city/.env.example`.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | ✅ Multiplayer | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ Multiplayer | `"slot-city-dev-secret-change-in-prod"` | JWT signing secret (**change this**) |
| `PORT` | ❌ Optional | `2567` | Colyseus WebSocket port |
| `CORS_ORIGIN` | ❌ Optional | `"http://localhost:3000"` | Allowed CORS origin |

---

## 14. Solo Mode vs Multiplayer — Feature Matrix

| Feature | Solo (`/src/`) | Multiplayer (`slot-city/`) |
|---------|--------------|--------------------------|
| Avatar movement | ✅ WASD | ✅ WASD + server broadcast |
| Slot machine | ✅ Client-side | 🔜 Server-authoritative (TODO) |
| Texas Hold'em vs AI | ✅ Client-side | ✅ Server-authoritative |
| Chip balance | In-memory (`GameState`) | PostgreSQL + `LocalStore` fallback |
| Other players | ❌ | ✅ Colyseus room sync |
| Chat | ❌ | ✅ Colyseus broadcast |
| Leaderboard | ❌ | ✅ REST API + Next.js |
| Tournaments | ❌ | ✅ `TournamentManager` |
| Persistent balance | ❌ Session only | ✅ PostgreSQL |
| Blackjack | ❌ | 🔜 Stub only |

---

*Last updated: 2026-03-09. See also `AUDIT.md` for Phase 2 TODO list and `README.md` for user-facing setup instructions.*
