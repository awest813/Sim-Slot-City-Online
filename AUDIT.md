# Slot City — Repo Truth Audit

**Originally written:** 2026-03-09 (pre-solo-vertical-slice)
**Updated:** 2026-03-09 (post-solo-vertical-slice)
**Auditor:** Lead gameplay engineer pass

> **TL;DR for agents:** The solo vertical slice described in Section 5 is **complete**. Sections 1–4
> reflect the state of the codebase *before* that work. Read Section 5 (marked ✅ DONE) and the
> Phase 2 TODO in Section 6 for the current picture.

---

## 1. What the README Claims vs What Exists

| README Claim | Reality |
|---|---|
| Account creation / login ✅ Working | **Requires running Colyseus server + PostgreSQL.** Without them, login returns a network error. Guest/solo mode bypasses this. |
| Persistent chip balance ✅ Working | Server-side requires PostgreSQL + Prisma. **LocalStore (localStorage) fallback exists for guest mode.** |
| Isometric casino lobby ✅ Working | ✅ Works fully offline. Avatar spawns immediately; no server required. |
| Player movement (keyboard + click) ✅ Working | ✅ Works in solo mode (WASD / arrow keys). |
| Real-time multiplayer ✅ Working | Colyseus rooms defined; needs server + DB to run. |
| Room chat + emotes ✅ Working | Code exists; depends on server for broadcast. |
| Seating system ✅ Working | Defined in schemas and BaseRoom; not testable without server. |
| Texas Hold'em engine ✅ Working | ✅ PokerEngine complete and unit-tested. Also fully playable in-browser vs AI without server. |
| Tournament system ✅ Working | TournamentManager.ts exists and is tested. ✅ |
| Leaderboard ✅ Working | REST endpoint exists; requires DB. |
| Next.js web shell ✅ Working | Pages exist; requires DB for data. |
| Slot machines 🔜 Placeholder | ✅ **Fully playable 3-reel slot machine implemented** (SlotsPanel.ts). |
| Blackjack 🔜 Room skeleton only | BlackjackTableRoom.ts exists but is a stub with no gameplay. |

**Overall:** The solo-mode experience is complete and fully playable. The multiplayer server
skeleton is sound but requires Colyseus + PostgreSQL to activate.

---

## 2. Root-Level Code — Current State

**The root `/src/` directory is the solo-mode casino game, not legacy RPG code.**

```
src/
  scenes/       BootScene.ts, PreloadScene.ts        ← Casino boot flow
  core/         GameState.ts, AvatarController.ts,
                InteractionSystem.ts                  ← Shared solo-mode systems
  features/
    lobby/      CasinoLobbyScene.ts                  ← Main playable casino floor
    slots/      SlotsPanel.ts                        ← ✅ Fully playable slot machine
    poker/      PokerPanel.ts, PokerEngine.ts,
                PokerAI.ts                           ← ✅ Fully playable Texas Hold'em
    bar/        BarPanel.ts                          ← ✅ Drink ordering + chip bonuses
    ui/         HUD.ts, Panel.ts                    ← Persistent UI
  game/         config.ts, constants.ts
  main.ts       ← Entry point for solo mode
```

`npm run dev` at the repo root boots this casino game correctly.

---

## 3. Structural Notes

| Issue | Location | Status |
|---|---|---|
| Root solo client and `slot-city/` multiplayer client are independent codebases | repo root vs `slot-city/apps/game-client/` | By design — no cross-imports |
| `CasinoLobbyScene` always spawns avatar + movement (no server required) | `src/features/lobby/CasinoLobbyScene.ts` | ✅ Fixed |
| `SlotsScene` exists in multiplayer client | `slot-city/apps/game-client/src/scenes/SlotsScene.ts` | ✅ |
| Blackjack portal in multiplayer lobby routes to `CasinoLobbyScene` (placeholder) | `CasinoLobbyScene.ts` (multiplayer) | 🔜 Phase 2 |
| `LocalStore` + `NetworkManager.setGuestUser()` enable offline play in multiplayer client | `slot-city/apps/game-client/` | ✅ |

---

## 4. What Works Right Now (Cold Start, No Server)

### Solo mode (`npm run dev` at root)

- ✅ Phaser boots and loads
- ✅ PreloadScene: name entry, progress bar
- ✅ CasinoLobbyScene: full isometric casino floor with avatar + movement
- ✅ **Slot machine minigame** — 3 reels, weighted RNG, bet selection, payouts
- ✅ **Texas Hold'em poker** — full game vs AI, all streets, showdown, session stats
- ✅ **Bar & Lounge** — drinks, gambling tips, once-per-session bonuses
- ✅ Chip economy (in-memory; resets on refresh)
- ✅ HUD (balance + zone label)
- ✅ Free chips reload when broke

### Multiplayer client (`slot-city/apps/game-client/`) without server

- ✅ LoginScene renders with "Play Solo — No Server" button
- ✅ Guest mode: avatar + lobby + movement work
- ✅ SlotsScene playable in guest mode (LocalStore-backed balance)
- ❌ Login/Register → server error (expected without Colyseus)
- ❌ Multiplayer avatar sync → not available without server

---

## 5. Execution Plan — Minimal Playable Vertical Slice

**Status: ✅ COMPLETE**

All 9 steps from the original plan have been implemented:

1. ✅ `LocalStore.ts` — localStorage chip balance + guest username
2. ✅ `NetworkManager` guest mode — `setGuestUser()`, `isGuestMode()`
3. ✅ `LoginScene` "Play Solo" button — skips auth, sets guest user, enters lobby
4. ✅ `CasinoLobbyScene` always-online avatar — not gated on server
5. ✅ Hotspot system — proximity prompt + E-key callback
6. ✅ `SlotsPanel.ts` — 3-reel slot machine, weighted symbols, win detection
7. ✅ `PokerPanel.ts` + `PokerEngine.ts` + `PokerAI.ts` — full Texas Hold'em
8. ✅ `BarPanel.ts` — drink ordering, session tracking
9. ✅ `README.md` — accurately reflects current state

---

## 6. Phase 2 TODO (Multiplayer, Persistence, Authority)

- [ ] **Dev environment setup guide** — docker-compose for Postgres + Colyseus with one command
- [ ] **Session persistence** — connect lobby chip balance to Prisma via ChipEconomyService
- [ ] **Server-authoritative slot machine** — move spin logic to a SlotMachineRoom on the server; client is display-only
- [ ] **Actual `SlotsScene` portal** in multiplayer lobby (replace the Blackjack placeholder)
- [ ] **Blackjack gameplay** — complete BlackjackTableRoom + client scene
- [ ] **Avatar outfit selector** — use `outfitId` field that's already in the schema
- [ ] **Depth-sorted walking** — MovementController currently allows clicking through UI objects
- [ ] **Sprite sheet swap** — PlayerAvatar is designed for this; asset pipeline TBD
- [ ] **Next.js + game auth handoff** — share JWT between web shell and game client
- [ ] **Tournament UI** — live tournament bracket visible in BarRoomScene
- [ ] **VIP room** — defined in RoomType enum, room not implemented
- [x] **Fix BB pre-flop option** in `PokerRoundManager.isBettingRoundComplete()` — BB now always gets one action pre-flop via `bbHasOption` flag; pre-flop turn ordering fixed to sort by seat index
