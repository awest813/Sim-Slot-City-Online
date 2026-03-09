# Slot City — Repo Truth Audit

**Date:** 2026-03-09
**Branch:** `claude/audit-repo-structure-HH8oJ`
**Auditor:** Lead gameplay engineer pass

---

## 1. What the README Claims vs What Exists

| README Claim | Reality |
|---|---|
| Account creation / login ✅ Working | **Requires running Colyseus server + PostgreSQL.** Without them, login returns a network error. |
| Persistent chip balance ✅ Working | Requires PostgreSQL + Prisma. No offline fallback. |
| Isometric casino lobby ✅ Working | Scene exists and draws correctly, but avatar/movement only spawn if server connection succeeds. |
| Player movement (keyboard + click) ✅ Working | Code exists; blocked by server dependency at runtime. |
| Real-time multiplayer ✅ Working | Colyseus rooms are defined; untested without running infrastructure. |
| Room chat + emotes ✅ Working | Code exists; depends on server for broadcast. |
| Seating system ✅ Working | Defined in schemas and BaseRoom; not testable without server. |
| Texas Hold'em engine ✅ Working | PokerEngine.ts is complete and unit-tested independently. ✅ |
| Tournament system ✅ Working | TournamentManager.ts exists and is tested. ✅ |
| Leaderboard ✅ Working | REST endpoint exists; requires DB. |
| Next.js web shell ✅ Working | Pages exist; requires DB for data. |
| Slot machines 🔜 Placeholder | **Not implemented** — just decorative props in lobby. |
| Blackjack 🔜 Room skeleton only | BlackjackTableRoom.ts exists but is a stub with no gameplay. |

**Overall:** The architecture is sound and complete as a multiplayer server skeleton. But the game is **not playable** without a running Colyseus server (port 2567) and PostgreSQL instance. There is no offline/solo mode.

---

## 2. Root-Level Legacy Code

The repo root contains a **separate, unrelated RPG battle game** under `/src/`:

```
src/
  scenes/  BattleScene.ts, CampScene.ts, DialogueScene.ts  ← Fire Emblem-style RPG
  systems/ CombatSystem.ts, GridSystem.ts, SupportSystem.ts, TurnSystem.ts
  entities/ Unit.ts
  data/    maps.ts, units.ts, support_demo.json
```

This code is orphaned. The root `index.html` points to `/src/main.ts` (the RPG), not the casino. The root `package.json` ("slot-city-client") uses Vite but `src/main.ts` still boots the RPG game — meaning `npm run dev` at repo root launches the wrong game.

**The actual casino lives in `/slot-city/apps/game-client/`.**

---

## 3. Structural Mismatches

| Issue | Location |
|---|---|
| Root `index.html` → `/src/main.ts` → RPG game | repo root |
| Root `package.json` named "slot-city-client" but points at RPG | `/package.json` |
| Vite configs at `/vite/config.dev.mjs` serve the RPG | `/vite/` |
| Casino code at `/slot-city/apps/game-client/` has its own Vite config | `/slot-city/apps/game-client/vite.config.ts` |
| `CasinoLobbyScene` creates avatar only inside `setupRoomHandlers()`, which only runs on server success | lobby scene |
| No `SlotsScene` exists despite slot machine props in the lobby | client scenes |
| Slot machine portals not mapped in lobby — Blackjack portal routes to `CasinoLobbyScene` (placeholder comment in code) | `CasinoLobbyScene.ts:433` |

---

## 4. What Actually Works Right Now (Cold Start, No Server)

- ✅ Phaser boots and loads (`slot-city/apps/game-client/`)
- ✅ PreloadScene renders loading bar + title
- ✅ LoginScene renders form with neon grid
- ❌ Login/Register fails (no server)
- ❌ Lobby does not load (requires auth)
- ❌ Avatar does not appear
- ❌ Nothing is playable

---

## 5. Execution Plan — Minimal Playable Vertical Slice

**Goal:** Playable solo slot machine in 10 steps, no server required.

### Phase 1 (this branch) — Solo Vertical Slice

1. **`LocalStore.ts`** — localStorage-backed chip balance + guest username
2. **`NetworkManager` guest mode** — `setGuestUser()`, `isGuestMode()`
3. **`LoginScene` Play Solo button** — skip auth, set guest user, enter lobby
4. **`PreloadScene` offline path** — if user already set, skip server validation
5. **`CasinoLobbyScene` always-online avatar** — create avatar + movement immediately, not gated on server
6. **Hotspot system** — detect proximity to slot machines, show `[F] Play Slots` prompt
7. **`SlotsScene`** — fully playable 3-reel slot machine with weighted symbols, bet sizing, win detection, visual feedback
8. **Wire SlotsScene** in `main.ts` scene list
9. **Rewrite README** to accurately describe current state

### Phase 2 — Multiplayer & Persistence (deferred)

See section 6 below.

---

## 6. Phase 2 TODO (Multiplayer, Persistence, Authority)

- [ ] **Dev environment setup guide** — docker-compose for Postgres + Colyseus with one command
- [ ] **Session persistence** — connect lobby chip balance to Prisma via ChipEconomyService
- [ ] **Server-authoritative slot machine** — move spin logic to a SlotMachineRoom on the server; client is display-only
- [ ] **Actual `SlotsScene` portal** in lobby (replace the Blackjack placeholder)
- [ ] **Blackjack gameplay** — complete BlackjackTableRoom + client scene
- [ ] **Avatar outfit selector** — use `outfitId` field that's already in the schema
- [ ] **Depth-sorted walking** — MovementController currently allows clicking through UI objects
- [ ] **Sprite sheet swap** — PlayerAvatar is designed for this; asset pipeline TBD
- [ ] **Next.js + game auth handoff** — share JWT between web shell and game client
- [ ] **Tournament UI** — live tournament bracket visible in BarRoomScene
- [ ] **VIP room** — defined in RoomType enum, room not implemented

---

## 7. Quarantine Recommendation

The root `/src/` RPG code should be moved to a `_legacy/` folder or deleted. It is dead code that causes confusion. The root `index.html` and root Vite configs should either be removed or redirected to the casino game.

**Short-term:** Leave as-is (don't break root build behavior). Document clearly.
**Long-term:** Remove `/src/` entirely or archive to git history.
