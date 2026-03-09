# Slot City — Roadmap

## Phase 0 — Foundation (Complete) ✅

- [x] Monorepo scaffolding (apps/web, apps/game-client, apps/game-server, packages/shared)
- [x] Shared TypeScript package (types, enums, protocol messages, constants)
- [x] Prisma schema (User, Session, Tournament, TournamentEntry, MatchHistory, LeaderboardEntry)
- [x] Auth service (register, login, session validation via JWT)
- [x] Chip economy service (addChips, removeChips, transferChips, recordMatchResult)
- [x] Colyseus room framework (BaseRoom, LobbyRoom, PokerTableRoom, BarRoom, BlackjackTableRoom)
- [x] Isometric rendering (isoToScreen, screenToIso, depth sorting)
- [x] Player avatar system (placeholder graphics, chat bubbles, emotes, direction)
- [x] Movement controller (keyboard + click-to-move)
- [x] Network manager (auth + room join via Colyseus client)
- [x] Phaser scenes (Boot, Preload, Login, CasinoLobby, PokerRoom, BarRoom)
- [x] Chat UI (in-game chat + emotes)
- [x] Texas Hold'em engine (deck, hand evaluation, betting rounds, winner resolution)
- [x] PokerRoundManager (state machine, action timer, side pot tracking)
- [x] TournamentManager (registration, start, blinds, elimination, prize pool)
- [x] REST API (leaderboard, tournaments list, profile stats, tournament creation)
- [x] Next.js web shell (home, leaderboard, tournaments, profile)
- [x] Tests (chip economy, poker engine, poker rounds, tournament lifecycle)
- [x] Documentation (vision, architecture, roadmap, art-direction)

---

## Phase 1 — Visual Polish

- [ ] Replace placeholder avatar graphics with AI-generated sprite sheets
- [ ] Isometric tile atlas (floor tiles, walls, carpet patterns)
- [ ] Proper prop sprites (poker tables, slot machines, stools, signs)
- [ ] Avatar walk/idle animation frames
- [ ] Neon lighting effects (glow shaders or layered alpha graphics)
- [ ] Background music and ambient SFX
- [ ] Loading screen with progress bar
- [ ] Transition animations between rooms

## Phase 2 — Gameplay Depth

- [ ] Real-time poker hand display (hole cards visible to owner only)
- [ ] Community card reveal animations
- [ ] Bet sizing UI (slider / quick amounts)
- [ ] Pot distribution visualization
- [ ] Player chip stack animations
- [ ] Spectator mode for poker tables
- [ ] Blackjack game logic
- [ ] Slot machine minigame

## Phase 3 — Social Systems

- [ ] Friend system (add, online status)
- [ ] Private messages
- [ ] Player profiles (public stats, recent games)
- [ ] Proximity chat (only hear nearby players)
- [ ] Reaction system (quick emotes from radial menu)
- [ ] Player blocking and mute
- [ ] Report system

## Phase 4 — Tournament System Completion

- [ ] Scheduled tournaments (start at fixed time)
- [ ] Sit-and-go tournaments (auto-start on fill)
- [ ] Multi-table balancing as players are eliminated
- [ ] Tournament lobby room with live bracket display
- [ ] Prize distribution (chips awarded to top 3)
- [ ] Tournament history per player
- [ ] Spectator seats at tournament tables

## Phase 5 — Economy and Progression

- [ ] Daily login bonus
- [ ] Achievement system
- [ ] Cosmetics shop (purchase with chips)
- [ ] Avatar outfit variants
- [ ] Avatar accessory system (hats, glasses, accessories)
- [ ] Title / badge system
- [ ] VIP level progression

## Phase 6 — World Expansion

- [ ] VIP lounge room
- [ ] Slot floor room
- [ ] Private rooms (invite only)
- [ ] Event spaces (themed seasonal rooms)
- [ ] Room portal system (enter by walking to portal)
- [ ] Mini-map
- [ ] Room instance browser (see player counts per room)

## Phase 7 — Scale and Infrastructure

- [ ] Redis adapter for Colyseus horizontal scaling
- [ ] CDN for asset delivery
- [ ] Rate limiting on all API endpoints
- [ ] Real-time analytics dashboard
- [ ] Admin panel (Colyseus Monitor + custom tools)
- [ ] Chat moderation system
- [ ] Automated suspicious play detection

---

## Known Limitations in Current Build

- Hole cards sent to all players (need to split state per client)
- Side pots tracked in data structure but prize distribution simplified
- Tournament manager is in-memory only (lost on server restart)
- No reconnection logic for disconnected players
- Asset pipeline relies entirely on placeholder graphics
- No email verification for accounts
