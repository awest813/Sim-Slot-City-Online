# Slot City 🎰

> **A browser-based multiplayer isometric social casino — virtual chips only, no real money.**

*The Sims Online meets neon Vegas in an isometric browser casino.*

Players create accounts, walk their avatar through an isometric casino in real time, chat with others, sit at poker tables, join tournaments, and hang out at the bar/lounge — all powered by fictional in-game chips.

---

## What Is Slot City?

Slot City is a social MMO casino experience inspired by:

- **The Sims Online** — avatar-driven social spaces and emergent gameplay
- **Habbo Hotel** — isometric rooms, furniture, and social gathering spots
- **Club Penguin** — approachable community-first design with expressive characters
- **PokerStars** — serious poker mechanics with clear game flow
- **Retro neon Vegas** — visual warmth, energy, and glamour

The game is a **social venue**, not a menu of disconnected mini-games. The casino itself is the content.

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
    game-server/             # Colyseus authoritative multiplayer server
  packages/
    shared/                  # Shared TypeScript types, enums, constants, protocol
  prisma/
    schema.prisma            # PostgreSQL schema via Prisma
  docs/                      # Architecture, vision, roadmap, art direction
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (local or remote)
- npm 8+

### 1. Clone and install

```bash
git clone <repo-url>
cd slot-city
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET at minimum
```

### 3. Set up the database

```bash
npm run db:migrate      # Run Prisma migrations
npm run db:generate     # Generate Prisma client
```

### 4. Start development servers

```bash
npm run dev             # All three servers in parallel

# Or individually:
npm run dev:server      # Colyseus game server  → http://localhost:2567
npm run dev:client      # Phaser game client   → http://localhost:3001
npm run dev:web         # Next.js web shell    → http://localhost:3000
```

### 5. Open the game

| URL | Description |
|-----|-------------|
| http://localhost:3001 | Isometric game client |
| http://localhost:3000 | Web shell (login, profile, leaderboard) |
| http://localhost:2567/colyseus | Colyseus room monitor |

Run `npm run db:studio` to open Prisma Studio at http://localhost:5555.

---

## Running Tests

```bash
npm run test            # Run all server-side tests
```

Tests cover:

- Chip economy service (`getBalance`, `addChips`, `removeChips`, `transferChips`)
- Poker engine (deck creation, hand evaluation, winner determination)
- Poker round manager (state transitions, blind posting, action processing)
- Tournament manager (registration, start, elimination, blind progression)

---

## Environment Variables

See `slot-city/.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (change before production!) |
| `PORT` | Game server port (default: `2567`) |
| `CORS_ORIGIN` | Allowed CORS origin (default: `http://localhost:3000`) |

---

## Feature Status

| Feature | Status |
|---------|--------|
| Account creation / login | ✅ Working |
| Persistent chip balance | ✅ Working |
| Isometric casino lobby | ✅ Working |
| Player movement (keyboard + click-to-move) | ✅ Working |
| Real-time multiplayer (see other players) | ✅ Working |
| Room chat + emotes | ✅ Working |
| Seating system | ✅ Working |
| Room transitions (lobby → poker, bar, etc.) | ✅ Working |
| Poker room | ✅ Working |
| Bar / lounge room | ✅ Working |
| Texas Hold'em engine (server-authoritative) | ✅ Working |
| Tournament system (registration, blinds, elimination) | ✅ Working |
| Leaderboard | ✅ Working |
| Next.js web shell | ✅ Working |
| Real sprite assets | 🔜 Placeholder graphics |
| Blackjack gameplay | 🔜 Room skeleton only |
| Slot machines | 🔜 Placeholder |

---

## Architecture Highlights

- **Server-authoritative**: All chip changes, poker logic, and tournament state live on the server. The client never modifies balances or game outcomes.
- **Isometric 2.5D**: Phaser renders a fixed-perspective casino world with depth sorting by tile position.
- **Room-based multiplayer**: Colyseus rooms (`LobbyRoom`, `PokerTableRoom`, `BarRoom`, `BlackjackTableRoom`) sync player state in real time.
- **Placeholder-first art**: All graphics are procedurally drawn using the Phaser Graphics API, ready to swap with real sprite sheets.

See [`slot-city/docs/architecture.md`](slot-city/docs/architecture.md) for the full system design.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`slot-city/docs/vision.md`](slot-city/docs/vision.md) | Product vision and player experience goals |
| [`slot-city/docs/architecture.md`](slot-city/docs/architecture.md) | Full system architecture and technology choices |
| [`slot-city/docs/roadmap.md`](slot-city/docs/roadmap.md) | Phase-by-phase development roadmap |
| [`slot-city/docs/art-direction.md`](slot-city/docs/art-direction.md) | Visual style guide and asset pipeline |

---

## License

For entertainment purposes only. No real money. No real gambling. All currency is fictional in-game currency.
