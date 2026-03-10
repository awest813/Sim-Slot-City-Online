# Slot City — Roadmap

> **Legend:** ✅ Complete · 🔄 In Progress · 🔜 Planned · 💡 Future Idea

---

## Phase 0 — Foundation ✅ Complete

The full engine, server scaffolding, and test suite are in place.

- [x] Monorepo: `apps/web`, `apps/game-client`, `apps/game-server`, `packages/shared`
- [x] Shared TypeScript package (types, enums, protocol messages, constants)
- [x] Prisma schema (`User`, `Session`, `Tournament`, `TournamentEntry`, `MatchHistory`, `LeaderboardEntry`)
- [x] Auth service — register, login, JWT session validation, bcrypt hashing
- [x] Chip economy service — `addChips`, `removeChips`, `transferChips`, `recordMatchResult`
- [x] Colyseus room framework (`BaseRoom`, `LobbyRoom`, `PokerTableRoom`, `BarRoom`, `BlackjackTableRoom`)
- [x] Isometric rendering (`isoToScreen`, `screenToIso`, depth sorting by tile position)
- [x] Player avatar system (placeholder graphics, chat bubbles, emotes, 4 directions)
- [x] Movement controller (keyboard + click-to-move)
- [x] Network manager (auth + room join, guest/offline mode fallback)
- [x] Phaser scenes: Boot, Preload, Login, CasinoLobby, SlotsScene, PokerRoom, BarRoom
- [x] Chat UI (in-game text chat + emote buttons)
- [x] Texas Hold'em engine — deck, hand evaluation (all 9 ranks), betting, winner resolution
- [x] `PokerRoundManager` — state machine, 30s action timer, BB pre-flop option, side pot tracking
- [x] `TournamentManager` — registration, start, blind schedule, elimination, prize pool
- [x] REST API — leaderboard, tournament list, player profile, tournament creation
- [x] Next.js web shell — home, leaderboard, tournaments, profile pages
- [x] 64 Jest tests — chip economy, poker engine, poker rounds, tournament lifecycle
- [x] Documentation — `vision.md`, `architecture.md`, `roadmap.md`, `art-direction.md`

---

## Phase 0.5 — Solo Mode Polish ✅ Complete

Single-player is now the primary entry point with a complete new-user experience.

- [x] PreloadScene redesign — feature pills, controls reference, starting chips display
- [x] New-player tutorial overlay — 4-step guide on first lobby entry, click/key to dismiss
- [x] Persistent controls hint bar at bottom of screen (fades in after tutorial)
- [x] Poker panel: **? Help** button with in-game hand rankings cheat sheet
- [x] Poker panel: **★ YOUR TURN ★** pulsing banner when player must act
- [x] Poker panel: call button shows exact chip amount (`CALL 40◈`)
- [x] Poker panel: MIN / 2× / ALL-IN raise presets shown when raise is available
- [x] Poker panel: improved initial instruction text ("Click a green OPEN seat")
- [x] PokerEngine: bounded recursion for all-in run-outs
- [x] PokerEngine: odd chip goes to first winner in split pots
- [x] PokerRoundManager (server): BB pre-flop option correctly tracked
- [x] HUD: chip counter flashes green/red on balance change (timer guarded)
- [x] SlotsPanel: free chips offer when balance hits zero
- [x] BarPanel: once-per-session Lucky Shot bonus correctly tracked

---

## Phase 1 — Visual Polish 🔜

> Replace procedural placeholder graphics with real isometric art assets.

- [ ] Simple Sims-like isometric avatar sprite sheets (idle, walk, seated — 4 directions)
- [ ] Isometric tile atlas (casino carpet, hardwood, marble, wall panels)
- [ ] Prop sprites: poker table, slot machines, bar counter, stools, lounge chairs
- [ ] Avatar walk/idle animation frames (slot into existing `PlayerAvatar` draw hook)
- [ ] Neon lighting glow effects (layered alpha sprites or Graphics overlays)
- [ ] Background ambient music loop + room-specific SFX (win jingle, card flip, etc.)
- [ ] Loading screen with animated progress bar and tip text
- [ ] Smooth room-transition fade animations
- [ ] Improved chat bubble styling and emote overlays
- [ ] Responsive HUD polish — chip counter animations, zone indicator icon

---

## Phase 2 — Gameplay Depth 🔜

> Make the casino floor feel alive and complete.

- [ ] Blackjack game logic (hit, stand, double-down, split)
- [ ] Bet sizing slider for poker (drag to set custom raise amount)
- [ ] Pot distribution animation (chips fly to winner seat)
- [ ] Player chip stack displayed on poker table felt
- [ ] Spectator mode — watch a poker table without joining
- [ ] Community card reveal animation (flip + brief glow)
- [ ] Action replay / hand history (last 5 hands, review cards played)
- [ ] Slot machine reel spin animation (spinning reels before landing)
- [ ] Server-authoritative slot machine (move RNG to server)

---

## Phase 3 — Social Systems 🔜

> Make the casino feel alive with people.

- [ ] Friend system (send/accept requests, online status indicator)
- [ ] Private direct messages
- [ ] Public player profiles (stats, recent games, cosmetics showcase)
- [ ] Proximity chat (messages visible only to nearby avatars)
- [ ] Radial emote menu (hold E to open quick-reaction wheel)
- [ ] Player blocking and muting
- [ ] Report system (flag abusive behavior)
- [ ] "Sitting nearby" social panel (see who is at your table)
- [ ] Player titles (earned through achievements)

---

## Phase 4 — Tournament System Completion 🔜

> Full tournament lifecycle from lobby to winner payout.

- [ ] Scheduled tournaments (start at a fixed calendar time)
- [ ] Sit-and-go tournaments (auto-start when seats fill)
- [ ] Multi-table rebalancing as players are eliminated
- [ ] Live tournament bracket display in lobby and web dashboard
- [ ] Automatic chip prize distribution to top 3 finishers
- [ ] Per-player tournament history page
- [ ] Spectator seats at active tournament tables
- [ ] Rebuy and add-on support for designated tournament formats
- [ ] Tournament chat channel (separate from room chat)

---

## Phase 5 — Economy & Progression 🔜

> Give players goals to chase and reasons to return.

- [ ] Daily login bonus (escalating streak rewards)
- [ ] Achievement system (unlock titles and chip bonuses)
- [ ] Cosmetics shop (purchase avatar outfits with chips)
- [ ] Avatar outfit layer system (torso + legs + shoes + accessories)
- [ ] VIP level progression (unlocked by chip milestones)
- [ ] Seasonal / limited-time cosmetic events
- [ ] Chip gifting between friends

---

## Phase 6 — World Expansion 💡

> Grow the casino floor with new rooms.

- [ ] Full slot floor room (rows of playable machines)
- [ ] VIP lounge (unlocked at VIP level 5+)
- [ ] Private rooms (invite-only, host sets buy-in)
- [ ] Themed event spaces (New Year's Eve, Halloween, etc.)
- [ ] Walk-up portal system (enter rooms by walking to a door)
- [ ] Mini-map overlay (all rooms, occupancy, tournament status)
- [ ] Rooftop bar (VIP outdoor area)

---

## Phase 7 — Scale & Infrastructure 💡

> Harden the platform for real concurrent users.

- [ ] Redis adapter for Colyseus horizontal scaling (sticky sessions)
- [ ] Persistent tournament state in PostgreSQL (survive server restarts)
- [ ] Reconnection logic — players rejoin their seat after disconnect
- [ ] CDN for static assets (sprite sheets, audio)
- [ ] Input validation hardening across all Colyseus message handlers
- [ ] Real-time analytics dashboard (DAU, chip flow, room occupancy)
- [ ] Admin panel (Colyseus Monitor + moderation tools)
- [ ] Suspicious-play detection (chip injection, unusual win rates)
- [ ] Email verification for account registration
- [ ] Password reset flow

---

## Known Limitations

| Limitation | Severity | Notes |
|------------|----------|-------|
| Hole cards sent to all clients | 🟡 Medium | Split-state per-client planned for Phase 2 |
| Side pots simplified | 🟡 Medium | Architecture in place; full distribution logic in Phase 2 |
| Tournament state in-memory only | 🟡 Medium | Lost on server restart; DB persistence in Phase 7 |
| No reconnection logic | 🟡 Medium | Disconnected players lose their seat |
| All art is procedural placeholder | 🟢 Low | Designed for sprite sheet swap in Phase 1 |
| Blackjack room is a stub | 🟢 Low | No game logic yet; Phase 2 |
| No email verification | 🟢 Low | Hardening in Phase 7 |
| No rate limiting on REST API | 🟢 Low | Hardening in Phase 7 |
