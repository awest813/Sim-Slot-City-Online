# Slot City 🎰

> A browser-based multiplayer isometric social casino. Virtual chips only. No real money.

**The Sims Online meets neon Vegas in an isometric browser casino.**

Players create accounts, enter the isometric casino, walk their avatars around in real time, chat, join poker tables, enter tournaments, and hang out at the bar/lounge.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Game Client | Phaser 3 + TypeScript + Vite |
| Web Shell | Next.js 15 App Router |
| Multiplayer Server | Node.js + Colyseus 0.15 |
| Database | PostgreSQL + Prisma |
| Shared Types | TypeScript package |

---

## Project Structure

```
slot-city/
  apps/
    web/            # Next.js dashboard (home, profile, leaderboard, tournaments)
    game-client/    # Phaser 3 isometric casino game client
    game-server/    # Colyseus authoritative game server
  packages/
    shared/         # Shared TypeScript types, enums, protocol messages
  prisma/
    schema.prisma   # Database schema
  docs/             # Documentation
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
# Edit .env with your DATABASE_URL and JWT_SECRET
```

### 3. Set up the database

```bash
# Run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### 4. Start development servers

```bash
# Start all three (web, client, server) in parallel
npm run dev

# Or start individually:
npm run dev:server    # Game server on :2567
npm run dev:client    # Phaser client on :3001
npm run dev:web       # Next.js web shell on :3000
```

### 5. Open the game

- **Game**: http://localhost:3001
- **Web Shell**: http://localhost:3000
- **Colyseus Monitor**: http://localhost:2567/colyseus
- **Prisma Studio**: `npm run db:studio` → http://localhost:5555

---

## Running Tests

```bash
# Run all server tests
npm run test

# Or from the game-server directory
cd apps/game-server
npm test
```

Tests cover:
- Chip economy service (getBalance, addChips, removeChips, transferChips)
- Poker engine (deck creation, hand evaluation, winner determination)
- Poker round manager (state transitions, blind posting, action processing)
- Tournament manager (registration, start, elimination, blind progression)

---

## Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (change in production!) |
| `PORT` | Game server port (default: 2567) |
| `CORS_ORIGIN` | Allowed CORS origin (default: http://localhost:3000) |

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full system design.

### Key Points

- **Server-authoritative**: All chip changes, poker logic, and tournament state live on the server
- **Isometric 2.5D**: Phaser renders a fixed-perspective casino world with depth sorting
- **Room-based multiplayer**: Colyseus rooms (Lobby, Poker, Bar, Blackjack) sync player state
- **Placeholder-first art**: All graphics are procedurally drawn, ready to swap with real sprites

---

## Feature Status

| Feature | Status |
|---------|--------|
| Account create / login | ✅ Working |
| Persistent chip balance | ✅ Working |
| Isometric casino lobby | ✅ Working |
| Player movement (keyboard + click) | ✅ Working |
| Real-time multiplayer | ✅ Working |
| Room chat + emotes | ✅ Working |
| Seating system | ✅ Working |
| Room transitions | ✅ Working |
| Poker room | ✅ Working |
| Bar / lounge | ✅ Working |
| Texas Hold'em engine | ✅ Working |
| Tournament system | ✅ Working |
| Leaderboard | ✅ Working |
| Next.js web shell | ✅ Working |
| Real sprite assets | 🔜 Placeholder |
| Blackjack gameplay | 🔜 Room skeleton |
| Slot machines | 🔜 Placeholder |

---

## Docs

- [Vision](docs/vision.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Art Direction](docs/art-direction.md)

---

## License

For entertainment purposes only. No real money. No real gambling.
