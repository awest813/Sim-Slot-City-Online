# Slot City — Architecture

## System Overview

```
Browser Client (Phaser 3)
    │
    ├── WebSocket (Colyseus)────► Game Server (Node.js + Colyseus)
    │                                  │
    └── HTTP (fetch)────────────►      ├── Auth Service (Express + JWT)
                                       ├── Chip Economy Service
                                       ├── Room System (Colyseus Rooms)
                                       ├── Poker Round Manager
                                       ├── Tournament Manager
                                       └── Prisma (PostgreSQL)

Web Shell (Next.js App Router)
    └── HTTP API calls ──────────► Game Server REST endpoints
```

## Monorepo Structure

```
slot-city/
  apps/
    web/                # Next.js 15 App Router — account UI, leaderboard, tournaments
    game-client/        # Phaser 3 + TypeScript — isometric casino game
    game-server/        # Node.js + Colyseus — authoritative multiplayer server

  packages/
    shared/             # Shared TypeScript types, enums, constants, protocol

  prisma/
    schema.prisma       # PostgreSQL schema via Prisma
```

## Technology Choices

### Frontend Game: Phaser 3
- Battle-tested 2D browser game framework
- Built-in WebGL/Canvas rendering with full scene graph
- Texture atlases, tweens, input management, camera system
- Isometric rendering is achievable with standard 2D primitives

### Multiplayer: Colyseus 0.15
- Room-based authoritative server
- Built-in delta-patch state sync (Schema-based)
- Handles WebSocket lifecycle, reconnection, room metadata
- TypeScript-first

### Web Shell: Next.js 15 App Router
- Server components for leaderboard/tournament pages
- Clean separation of game client from account management
- Proxy to game server API for CORS simplicity

### Database: PostgreSQL + Prisma
- Prisma for type-safe ORM and migrations
- PostgreSQL for reliable relational data with JSON support
- Schemas designed for extensibility

## Room System

Each Colyseus room is a separate TypeScript class extending `BaseRoom<TState>`.

```
BaseRoom<TState>
  ├── LobbyRoom
  ├── PokerTableRoom
  ├── BarRoom
  └── BlackjackTableRoom
```

`BaseRoom` handles:
- Auth validation via JWT in `onAuth()`
- Player join/leave lifecycle
- Movement messages → position updates
- Chat messages → state broadcast
- Emote messages → avatar animations
- Sit/stand seat management

Each subclass implements:
- `getSpawnPosition()` — where new players appear
- `onPlayerJoined()` / `onPlayerLeft()`
- `onPlayerSeated()` / `onPlayerStoodUp()`
- `handleCustomMessage()` — room-specific actions (e.g., poker actions)

## Poker Architecture

```
PokerTableRoom
  └── PokerRoundManager
        ├── PokerEngine (pure functions: deck, shuffle, hand eval, winner)
        └── State machine: WAITING → DEAL → PRE_FLOP → FLOP → TURN → RIVER → SHOWDOWN → END_ROUND
```

Key principles:
- All dealing, RNG, and bet resolution happen server-side only
- Client receives opaque state; hole cards only sent to owning player (future enhancement)
- Action timer (30s) auto-folds inactive players
- Side pots tracked for all-in scenarios (architecture in place)

## Chip Economy

`ChipEconomyService` wraps all chip mutations:
- `getBalance(userId)` — read-only
- `addChips(userId, amount)` — validated increment
- `removeChips(userId, amount)` — validates sufficient balance
- `transferChips(fromId, toId, amount)` — atomic Prisma transaction
- `recordMatchResult(...)` — updates match history + leaderboard

All chip changes go through this service. The client never modifies balances.

## Tournament System

`TournamentManager` (singleton per server instance):
- In-memory tournament state with event callbacks
- Persists tournament records to PostgreSQL
- Blind increase timer per tournament
- Table allocation in batches of 6
- Elimination tracking → final table detection → winner declaration

## Isometric Rendering

```
IsoRenderer.ts
  ├── isoToScreen(tileX, tileY) → WorldPosition
  ├── screenToIso(x, y) → IsoPosition
  └── getDepth(tileX, tileY) → number (for Z-sorting)
```

Tiles are rendered as diamond (rhombus) shapes using `fillPoints`. Depth sorting is by `tileX + tileY`, with higher values drawn last (in front).

## Avatar System

`PlayerAvatar` is a Phaser Container grouping:
- Body (placeholder graphics, recolorable by outfitId)
- Username label
- Chat bubble (auto-hide after 5s)
- Emote label (emoji overlay)
- Selection circle (local player indicator)

Future swap path: replace the `drawBody()` graphics call with a sprite sheet animation lookup.

## Security

- Passwords hashed with bcrypt (cost factor 12)
- JWT for session tokens (7-day expiry)
- All game rules server-authoritative (Colyseus rooms)
- Input validation on all server handlers
- No client-trusted balance operations

## Scalability Path

Current: Single server process, in-memory tournament state.

Future:
- Redis adapter for Colyseus (horizontal scaling)
- Persistent room state in Redis
- Tournament state persisted to PostgreSQL at each transition
- CDN for static assets
- WebSocket load balancing with sticky sessions
