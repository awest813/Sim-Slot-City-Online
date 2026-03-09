# Slot City — Roadmap

## Phase 0 — Foundation ✅ Complete

- [x] Monorepo scaffolding (`apps/web`, `apps/game-client`, `apps/game-server`, `packages/shared`)
- [x] Shared TypeScript package (types, enums, protocol messages, constants)
- [x] Prisma schema (`User`, `Session`, `Tournament`, `TournamentEntry`, `MatchHistory`, `LeaderboardEntry`)
- [x] Auth service (register, login, session validation via JWT)
- [x] Chip economy service (`addChips`, `removeChips`, `transferChips`, `recordMatchResult`)
- [x] Colyseus room framework (`BaseRoom`, `LobbyRoom`, `PokerTableRoom`, `BarRoom`, `BlackjackTableRoom`)
- [x] Isometric rendering (`isoToScreen`, `screenToIso`, depth sorting by tile position)
- [x] Player avatar system (placeholder graphics, chat bubbles, emotes, direction)
- [x] Movement controller (keyboard + click-to-move)
- [x] Network manager (auth + room join via Colyseus client)
- [x] Phaser scenes (`Boot`, `Preload`, `Login`, `CasinoLobby`, `PokerRoom`, `BarRoom`)
- [x] Chat UI (in-game chat + emote buttons)
- [x] Texas Hold'em engine (deck, hand evaluation, betting rounds, winner resolution)
- [x] `PokerRoundManager` (state machine, action timer, side pot tracking)
- [x] `TournamentManager` (registration, start, blinds, elimination, prize pool)
- [x] REST API (leaderboard, tournament list, player profile, tournament creation)
- [x] Next.js web shell (home, leaderboard, tournaments, profile pages)
- [x] Tests (chip economy, poker engine, poker rounds, tournament lifecycle)
- [x] Documentation (`vision.md`, `architecture.md`, `roadmap.md`, `art-direction.md`)

---

## Phase 1 — Visual Polish

> Replace placeholder graphics with real isometric art assets.

- [ ] Simple Sims-like isometric avatar sprite sheets (idle, walk, seated, emote — 4 directions each)
- [ ] Isometric tile atlas (casino carpet, hardwood, marble, wall panels)
- [ ] Prop sprites: poker tables, slot machines, bar counter, stools, lounge sofas, signs
- [ ] Avatar walk and idle animation frames (swap into existing `PlayerAvatar` draw hook)
- [ ] Neon lighting glow effects (layered alpha graphics or sprite overlays)
- [ ] Background ambient music and room-specific SFX
- [ ] Loading screen with animated progress bar
- [ ] Smooth room-transition animations (fade / portal effects)
- [ ] Improved chat bubble styling and emote overlays
- [ ] Responsive HUD polish (chip counter, room name, player count)

---

## Phase 2 — Gameplay Depth

> Make poker and the casino floor feel alive.

- [ ] Hole cards visible only to the owning player (split Colyseus state per client)
- [ ] Community card reveal animations (flip + glow)
- [ ] Bet sizing UI (slider + quick-amount buttons)
- [ ] Pot distribution visualization (chips fly to winner)
- [ ] Player chip stack display on table
- [ ] Spectator mode — sit and watch a poker table without joining
- [ ] Blackjack game logic (hit, stand, double down, split)
- [ ] Slot machine minigame (reel spin animation + win lines)
- [ ] Action replay / hand history viewer (last 5 hands)

---

## Phase 3 — Social Systems

> Make the casino feel alive with people.

- [ ] Friend system (send/accept requests, online status indicator)
- [ ] Private direct messages
- [ ] Public player profile pages (stats, recent games, cosmetics showcase)
- [ ] Proximity chat (chat messages only visible to nearby avatars)
- [ ] Radial emote menu (press E to open quick-reaction wheel)
- [ ] Player blocking and muting
- [ ] Report system (flag abusive behavior)
- [ ] "Sitting nearby" social panel (see who is at the same table)
- [ ] Player title display (earned through achievements)

---

## Phase 4 — Tournament System Completion

> Full tournament lifecycle from lobby to winner payout.

- [ ] Scheduled tournaments (start at a fixed calendar time)
- [ ] Sit-and-go tournaments (auto-start when seats are filled)
- [ ] Multi-table rebalancing as players are eliminated
- [ ] Live tournament bracket display in lobby and bar
- [ ] Prize distribution — chips awarded to top 3 finishers automatically
- [ ] Per-player tournament history page
- [ ] Spectator seats at active tournament tables
- [ ] Rebuy and add-on support for designated tournament formats
- [ ] Tournament chat channel (separate from room chat)

---

## Phase 5 — Economy and Progression

> Give players reasons to return and goals to chase.

- [ ] Daily login bonus (escalating streak rewards)
- [ ] Achievement system (unlock titles and chip bonuses)
- [ ] Cosmetics shop (purchase avatar outfits, colors, accessories with chips)
- [ ] Avatar outfit variant system (torso + legs + shoes layers)
- [ ] Avatar accessory slots (hats, glasses, badge pins)
- [ ] Player title / badge display system
- [ ] VIP level progression (unlocked by chip milestones)
- [ ] Seasonal and limited-time cosmetic events
- [ ] Chip gifting between friends

---

## Phase 6 — World Expansion

> Grow the casino floor with new rooms and experiences.

- [ ] VIP lounge room (unlocked at VIP level 5+)
- [ ] Full slot floor room (rows of playable slot machines)
- [ ] Private rooms (invite-only, host sets buy-in)
- [ ] Event spaces (themed seasonal rooms: New Year's, Halloween, etc.)
- [ ] Walk-up portal system (enter rooms by walking your avatar to a door)
- [ ] Mini-map overlay (see all rooms, player counts, tournament status)
- [ ] Room browser panel (list of all active rooms with occupancy)
- [ ] Outdoor area / casino entrance plaza
- [ ] Rooftop bar (VIP outdoor area)

---

## Phase 7 — Scale and Infrastructure

> Harden the platform for real concurrent users.

- [ ] Redis adapter for Colyseus horizontal scaling (sticky sessions)
- [ ] Persistent tournament state in PostgreSQL (survive server restarts)
- [ ] Reconnection logic — players rejoin their seat after disconnect
- [ ] CDN for static assets (sprite sheets, audio)
- [ ] Rate limiting on all REST API endpoints
- [ ] Input validation hardening across all Colyseus message handlers
- [ ] Real-time analytics dashboard (DAU, chip economy, room occupancy)
- [ ] Admin panel (Colyseus Monitor + custom moderation tools)
- [ ] Automated suspicious-play detection (chip injection, unusual win rates)
- [ ] Email verification for account registration
- [ ] Password reset flow

---

## Known Limitations in Current Build

| Limitation | Notes |
|------------|-------|
| Hole cards sent to all clients | Split-state per-client delivery planned for Phase 2 |
| Side pots tracked but not fully distributed | Architecture in place; prize split logic is simplified |
| Tournament state is in-memory only | Lost on server restart; persistent storage planned for Phase 7 |
| No reconnection logic | Disconnected players lose their seat |
| All art is procedural placeholder | Real sprite sheets replace draw calls in Phase 1 |
| No email verification | Accounts are username + password only |
| No rate limiting | All endpoints are open; hardening planned for Phase 7 |
