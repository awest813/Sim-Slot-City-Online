# Slot City 🎰

> **A browser-based isometric social casino — virtual chips only, no real money.**

*The Sims Online meets neon Vegas in an isometric browser casino.*

Players walk their avatar through an isometric casino lobby, chat with others, approach slot machines, sit at poker tables, and hang out at the bar — powered entirely by fictional in-game chips.

---

## Current State (Honest)

This is a **working prototype**. The game client runs fully in the browser. The multiplayer server and database are scaffolded but require a separate setup to run.

### What works right now (no server needed)

| Feature | Status |
|---------|--------|
| Name entry screen | ✅ Enter your player name on first load |
| Isometric casino lobby | ✅ Renders with floor, zones, props |
| Controllable avatar (WASD / arrow keys) | ✅ Works in solo mode |
| Depth sorting | ✅ Avatar draws behind/in-front of props correctly |
| **Slot machine minigame** | ✅ Fully playable — 3 reels, weighted symbols, real chip economy |
| **Texas Hold'em Poker** | ✅ Fully playable offline vs AI opponents — all betting rounds, showdown |
| Bar & Lounge | ✅ Order drinks, chip economy |
| Keyboard shortcuts | ✅ SPACE=spin, F/C/R=fold/call/raise in poker |
| Free chip reload | ✅ Automatically offered when balance hits zero |
| Local chip balance | ✅ Persists during session |

### What requires a running server

| Feature | Status |
|---------|--------|
| Real-time multiplayer (see other players) | 🔌 Needs Colyseus server |
| Account creation / server login | 🔌 Needs Colyseus + PostgreSQL |
| Persistent chip balance (server-side) | 🔌 Needs PostgreSQL + Prisma |
| Texas Hold'em poker engine | 🔌 Implemented + tested; needs server running |
| Tournament system | 🔌 Implemented + tested; needs server running |
| Room chat | 🔌 Needs server running |
| Leaderboard / web shell | 🔌 Needs server + database |

### Not yet implemented

| Feature | Status |
|---------|--------|
| Blackjack gameplay | 🔜 Room skeleton only, no gameplay |
| Avatar outfit selector | 🔜 Data model ready, UI not built |
| Server-authoritative slot machine | 🔜 Currently client-side only |
| Real sprite assets | 🔜 All graphics are procedural Phaser shapes |

---

## Quick Start — Solo Mode (No Server)

```bash
npm install
npm run dev
```

Open **http://localhost:8080** → enter your name → click **Enter Casino** → walk around the lobby → approach the slot machines → press **E** to play.

That's it. No database, no server, no environment variables needed.

---

## Quick Start — Full Multiplayer Stack

### Prerequisites

- Node.js 18+
- PostgreSQL (local or remote)
- npm 8+

### 1. Install

```bash
cd slot-city
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Set DATABASE_URL and JWT_SECRET at minimum
```

### 3. Set up the database

```bash
npm run db:migrate
npm run db:generate
```

### 4. Start all services

```bash
npm run dev          # All three servers in parallel

# Or individually:
npm run dev:server   # Colyseus server  → http://localhost:2567
npm run dev:client   # Phaser client    → http://localhost:3001
npm run dev:web      # Next.js web shell → http://localhost:3000
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Game Client | Phaser 3 · TypeScript · Vite |
| Web Shell | Next.js 15 App Router · TypeScript |
| Multiplayer Server | Node.js · Colyseus 0.15 |
| Database | PostgreSQL · Prisma ORM |
| Shared Types | TypeScript monorepo package |

---

## Project Structure

```
slot-city/                   ← main game monorepo
  apps/
    web/                     # Next.js dashboard (home, profile, leaderboard, tournaments)
    game-client/             # Phaser 3 isometric casino game client
      src/
        scenes/              # BootScene, PreloadScene, LoginScene, CasinoLobbyScene,
        │                    #   SlotsScene ✅, PokerRoomScene, BarRoomScene
        systems/             # IsoRenderer, MovementController, PlayerAvatar
        managers/            # NetworkManager (server + guest mode)
        store/               # LocalStore (offline chip balance)
        ui/                  # ChatUI
    game-server/             # Colyseus authoritative multiplayer server
  packages/
    shared/                  # Shared TypeScript types, enums, constants, protocol
  prisma/
    schema.prisma            # PostgreSQL schema via Prisma
  docs/                      # Architecture, vision, roadmap, art direction

AUDIT.md                     ← Repo truth audit (read this before making big changes)
```

---

## How to Play Slots

1. Walk your avatar near the slot machine props in the top-left area of the lobby
2. When `Press E to play slots` appears, press **E**
3. Select your bet (10 / 25 / 50 / 100 chips)
4. Press **Space** or click **SPIN**
5. Match symbols on the middle payline to win

### Paytable

| Match | Payout |
|-------|--------|
| 🍒🍒🍒 | 2× bet |
| 🍋🍋🍋 | 3× bet |
| 🍊🍊🍊 | 4× bet |
| 🍇🍇🍇 | 6× bet |
| ⭐⭐⭐ | 10× bet |
| 💎💎💎 | 20× bet |
| 7️⃣7️⃣7️⃣ | 50× bet |
| 🍒🍒 (two cherries) | 1× bet (consolation) |

Chip balance is tracked in memory during the session.

---

## How to Play Poker

1. Walk toward the green poker table in the top-right Poker Room
2. When `Press E to join poker table` appears, press **E**
3. Click an empty seat (costs 500 chips buy-in)
4. Click **▶ DEAL HAND** to start
5. Use the action buttons or keyboard shortcuts: **F** = Fold · **C** = Check/Call · **R** = Min-Raise
6. ESC closes the table (refunds remaining chips)

---

## Running Tests

```bash
cd slot-city
npm run test
```

Tests cover the server-side game logic (no browser required):

- Chip economy service
- Poker hand evaluation
- Poker round state machine
- Tournament manager

---

## Architecture Notes

- **Solo-first design**: The game client degrades gracefully to offline mode. Avatar movement, slot machine gameplay, and chip balance all work without any backend.
- **Server-authoritative multiplayer**: When the server is running, all chip changes, poker logic, and tournament state are server-side. The client is display-only for those features.
- **Isometric 2.5D**: Phaser renders a fixed-perspective casino with depth sorting by tile position.
- **Placeholder-first art**: All graphics use the Phaser Graphics API (procedural shapes + emoji). Designed for a sprite sheet swap — see `PlayerAvatar.ts`.
- **Modular rooms**: Colyseus rooms (`LobbyRoom`, `PokerTableRoom`, `BarRoom`, `BlackjackTableRoom`) are independently replaceable.

See [`slot-city/docs/architecture.md`](slot-city/docs/architecture.md) for the full system design.
See [`AUDIT.md`](AUDIT.md) for the repo truth audit and Phase 2 TODO list.

---

## Environment Variables

See `slot-city/.env.example`. Only needed for multiplayer mode.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `PORT` | Game server port (default: `2567`) |
| `CORS_ORIGIN` | Allowed CORS origin (default: `http://localhost:3000`) |

---

## License

For entertainment purposes only. No real money. No real gambling. All currency is fictional in-game currency.
