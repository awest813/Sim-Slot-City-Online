# 🎰 Slot City Online

> **Browser-based isometric social casino — virtual chips only, no real money.**

*Think "The Sims Online meets neon Vegas" — walk your avatar through a procedurally-rendered casino lobby, hit the slots, sit at a Texas Hold'em poker table, or hang out at the bar.*

---

## ▶ Play Now (Solo Mode — No Setup Required)

```bash
git clone https://github.com/awest813/Sim-Slot-City-Online
cd Sim-Slot-City-Online
npm install
npm run dev
```

Open **http://localhost:8080** → enter a name → click **Enter Casino** → you're playing.

**No database. No server. No environment variables. Works offline.**

---

## 🎮 What You Can Do Right Now

| Feature | Status | Details |
|---------|--------|---------|
| 🏛️ Casino Lobby | ✅ Live | Isometric casino floor with depth-sorted avatar |
| 🕹️ Avatar Movement | ✅ Live | WASD / Arrow keys, collision system |
| 🎰 Slot Machines | ✅ Fully Playable | 3-reel weighted slots — cherries to 7s — real chip economy |
| ♠ Texas Hold'em Poker | ✅ Fully Playable | vs 3 AI opponents, all betting rounds, hand evaluation |
| 🍹 Bar & Lounge | ✅ Fully Playable | Order drinks, once-per-session Lucky Shot bonus |
| 💰 Chip Economy | ✅ Live | 1,000 chips to start · Free reload when broke |
| ⌨️ Keyboard Shortcuts | ✅ Live | SPACE=spin · F/C/R=poker actions · ESC=close |
| 📖 Hand Rankings | ✅ Live | In-game cheat sheet (click **? Help** at the poker table) |
| 🎓 New Player Tutorial | ✅ Live | Step-by-step overlay on first visit to the lobby |

### What Needs a Running Server

| Feature | Status |
|---------|--------|
| Real-time multiplayer (see other players) | 🔌 Needs Colyseus server |
| Account login / persistent balance | 🔌 Needs Colyseus + PostgreSQL |
| Tournaments | 🔌 Implemented + tested; needs server |
| Room chat & emotes | 🔌 Needs server |
| Web leaderboard | 🔌 Needs server + database |

### Not Yet Implemented

| Feature | Status |
|---------|--------|
| Blackjack gameplay | 🔜 Room skeleton only |
| Avatar outfit selector | 🔜 Data model ready, UI not built |
| Real sprite art | 🔜 All graphics are procedural Phaser shapes |
| Server-authoritative slots | 🔜 Currently client-side only |

---

## 🎰 How to Play Slots

1. **Walk** your avatar toward the top-left corner (Slots Corner)
2. When **"Press E to play slots"** appears, press **E**
3. Select your bet: **10 / 25 / 50 / 100 chips**
4. Press **Space** or click **SPIN**
5. Match symbols on the center payline to win

### Slot Paytable

| Combination | Payout |
|-------------|--------|
| 🍒🍒🍒 Three Cherries | 2× bet |
| 🍋🍋🍋 Three Lemons | 3× bet |
| 🍊🍊🍊 Three Oranges | 4× bet |
| 🍇🍇🍇 Three Grapes | 6× bet |
| ⭐⭐⭐ Three Stars | 10× bet |
| 💎💎💎 Three Diamonds | 20× bet |
| 7️⃣7️⃣7️⃣ Three Sevens | **50× bet** |
| 🍒🍒 Two Cherries | 1× bet (consolation) |

---

## ♠ How to Play Poker

1. **Walk** toward the top-right corner (Poker Room)
2. Press **E** when the prompt appears
3. **Click an OPEN seat** — costs 500 chips buy-in (you start with 1,000)
4. Click **▶ DEAL HAND** (or press **Space**) to start
5. Use action buttons **or** keyboard shortcuts each turn

### Poker Controls

| Action | Button | Key |
|--------|--------|-----|
| Fold | FOLD | **F** |
| Check / Call | CHECK or CALL | **C** |
| Min Raise | MIN raise amount | **R** |
| 2× Raise | 2× raise button | — |
| All-In | ALL IN button | — |
| Deal next hand | ▶ DEAL HAND | **Space** |
| Hand rankings | ? Help | — |
| Leave table | Leave Table | **ESC** |

> **New to poker?** Click the **? Help** button in the top-right of the panel for a hand rankings reference.

### Poker Rules

- **Texas Hold'em** — 2 hole cards per player + 5 community cards
- Blinds: **10 / 20** chips
- Buy-in: **500 chips**
- 3 AI opponents auto-rebuy so the table never goes empty
- Chips are returned to your wallet when you leave the table

---

## 🍹 How to Use the Bar

1. Walk to the center bar counter
2. Press **E** to open the bar menu
3. Order a drink to spend chips (flavour only)
4. **Lucky Shot** — once-per-session bonus that grants free chips
5. Drinks are discounted on the **Today's Special**

---

## ⌨️ Controls Reference

| Action | Keys |
|--------|------|
| Move avatar | WASD or ↑↓←→ Arrow keys |
| Interact with zone | E |
| Spin slot machine | Space |
| Poker: Fold | F |
| Poker: Check / Call | C |
| Poker: Min Raise | R |
| Poker: Deal hand | Space |
| Close any panel | ESC |

---

## 🖥️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Game Client (solo) | Phaser 3 · TypeScript · Vite |
| Game Client (multiplayer) | Phaser 3 · TypeScript · Colyseus Client |
| Web Dashboard | Next.js 15 App Router · TypeScript |
| Multiplayer Server | Node.js · Colyseus 0.15 |
| Database | PostgreSQL · Prisma ORM |
| Shared Types | TypeScript monorepo package |

---

## �� Project Structure

```
/                              ← Solo mode (fully playable, no server)
├── src/
│   ├── main.ts                ← Entry point
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   └── PreloadScene.ts    ← Name entry + feature overview screen
│   ├── core/
│   │   ├── state/GameState.ts ← Singleton chip/zone state store
│   │   └── systems/
│   │       ├── AvatarController.ts
│   │       └── InteractionSystem.ts
│   └── features/
│       ├── lobby/CasinoLobbyScene.ts  ← Main casino floor + tutorial overlay
│       ├── slots/SlotsPanel.ts        ← 3-reel slot machine
│       ├── poker/
│       │   ├── PokerEngine.ts         ← Pure Hold'em logic (no Phaser)
│       │   ├── PokerAI.ts             ← Rule-based AI decisions
│       │   └── PokerPanel.ts          ← Poker table UI + hand rankings
│       ├── bar/BarPanel.ts            ← Bar drinks + bonus chips
│       └── ui/HUD.ts                  ← Chip counter + zone display
│
slot-city/                     ← Multiplayer monorepo (needs server)
├── apps/
│   ├── game-client/           ← Phaser multiplayer client
│   ├── game-server/           ← Colyseus authoritative server
│   │   └── src/tests/         ← 64 Jest tests (poker, chips, tournaments)
│   └── web/                   ← Next.js dashboard
├── packages/shared/           ← Shared types, enums, constants
└── prisma/schema.prisma       ← PostgreSQL schema
```

---

## 🚀 Full Multiplayer Stack Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (local or cloud)
- npm 8+

### Install & Run

```bash
cd slot-city
npm install

# Copy and configure environment
cp .env.example .env
# Set DATABASE_URL and JWT_SECRET

# Initialize database
npm run db:migrate
npm run db:generate

# Start all services
npm run dev
# Or individually:
npm run dev:server   # Colyseus   → ws://localhost:2567
npm run dev:client   # Phaser     → http://localhost:3001
npm run dev:web      # Next.js    → http://localhost:3000
```

---

## 🧪 Running Tests

```bash
npm run test          # from repo root or slot-city/
```

Tests cover server-side game logic (no browser required):
- ♠ Poker hand evaluation (all hand ranks, comparison, tie-breaking)
- 🃏 Poker round state machine (blinds, betting, showdown)
- 🤖 Poker AI decisions (pre-flop / post-flop hand strength)
- 💰 Chip economy (add, remove, transfer, match result recording)
- 🏆 Tournament manager (registration, bracket, elimination, prizes)

---

## 🗺️ Roadmap

See [`slot-city/docs/roadmap.md`](slot-city/docs/roadmap.md) for the full phased roadmap.

**Current focus:**
- Phase 1: Visual polish (real sprite art, sound, animations)
- Phase 2: Gameplay depth (bet slider, side pot visualization, blackjack)
- Phase 3: Social features (friends, proximity chat, emotes)

---

## 🏛️ Architecture Notes

- **Solo-first**: The entire game is playable without any backend. Client degrades gracefully.
- **Immutable poker engine**: `PokerEngine.ts` uses pure functions returning new state — easy to test and reason about.
- **Singleton GameState**: All chip/zone changes flow through `GameState` — HUD subscribes and auto-refreshes.
- **Panel lifecycle**: SlotsPanel, PokerPanel, BarPanel are plain TypeScript classes (not Phaser Scenes) that add objects to the existing scene and clean up on `close()`.
- **Placeholder-first art**: All visuals use Phaser's Graphics API (procedural shapes + emoji). Designed for sprite sheet swap.

See [`slot-city/docs/architecture.md`](slot-city/docs/architecture.md) for full system design.

---

## 🔑 Environment Variables (Multiplayer Only)

See `slot-city/.env.example`.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | JWT signing secret | `"slot-city-dev-secret"` |
| `PORT` | Colyseus WebSocket port | `2567` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

---

## ⚖️ License

For entertainment purposes only. No real money. No real gambling. All currency is fictional.
