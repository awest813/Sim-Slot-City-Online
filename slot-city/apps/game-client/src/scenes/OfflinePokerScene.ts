/**
 * OfflinePokerScene — fully playable Texas Hold'em vs 3 AI opponents.
 * No server required. Works 100% in guest/solo mode via localStore.
 *
 * Buy-in: up to 2000 chips from wallet.
 * Blinds: 25 / 50.
 * 4 seats: human (bottom) + 3 AIs.
 */

import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { localStore } from "../store/LocalStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type Suit = 0 | 1 | 2 | 3; // 0=♠ 1=♥ 2=♦ 3=♣
interface Card { rank: number; suit: Suit; } // rank 2–14

const SUIT_SYM   = ["♠", "♥", "♦", "♣"];
const SUIT_COLOR = ["#dddddd", "#ff6666", "#ff6666", "#dddddd"];
const RANK_LABEL = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

enum Phase { WAITING, PREFLOP, FLOP, TURN, RIVER, SHOWDOWN }

interface PokerPlayer {
  seat: number;           // 0=human, 1-3=AI
  name: string;
  chips: number;
  holeCards: Card[];
  bet: number;            // bet in current betting round
  folded: boolean;
  allIn: boolean;
  isHuman: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUY_IN       = 2000;
const SMALL_BLIND  = 25;
const BIG_BLIND    = 50;
const AI_NAMES     = ["Alex", "Bella", "Carlos", "Diana", "Erik", "Fiona"];

// ─── Hand evaluation ─────────────────────────────────────────────────────────

/** Score a 5-card hand. Higher score = better hand. */
function scoreHand5(five: Card[]): number {
  const rs = five.map(c => c.rank).sort((a, b) => b - a); // desc
  const rc = new Map<number, number>();
  for (const r of rs) rc.set(r, (rc.get(r) ?? 0) + 1);
  const pairs = Array.from(rc.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const flush   = five.every(c => c.suit === five[0].suit);
  const uniq    = [...new Set(rs)];
  let straight  = false;
  let strHigh   = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) { straight = true; strHigh = uniq[0]; }
    // Wheel A-2-3-4-5
    if (!straight && uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) {
      straight = true; strHigh = 5;
    }
  }

  // Straight flush
  if (straight && flush) return 8e12 + strHigh;
  // Four of a kind
  if (pairs[0][1] === 4) return 7e12 + pairs[0][0] * 1e6 + pairs[1][0];
  // Full house
  if (pairs[0][1] === 3 && pairs[1][1] === 2) return 6e12 + pairs[0][0] * 1e6 + pairs[1][0];
  // Flush
  if (flush) return 5e12 + rs.reduce((a, r, i) => a + r * Math.pow(100, 4 - i), 0);
  // Straight
  if (straight) return 4e12 + strHigh;
  // Three of a kind
  if (pairs[0][1] === 3) {
    const k = pairs.slice(1).map(p => p[0]);
    return 3e12 + pairs[0][0] * 1e6 + k[0] * 1e3 + k[1];
  }
  // Two pair
  if (pairs[0][1] === 2 && pairs[1][1] === 2) {
    const hi = Math.max(pairs[0][0], pairs[1][0]);
    const lo = Math.min(pairs[0][0], pairs[1][0]);
    return 2e12 + hi * 1e6 + lo * 1e3 + (pairs[2]?.[0] ?? 0);
  }
  // One pair
  if (pairs[0][1] === 2) {
    const k = pairs.slice(1).map(p => p[0]);
    return 1e12 + pairs[0][0] * 1e8 + k[0] * 1e6 + (k[1] ?? 0) * 1e4 + (k[2] ?? 0) * 1e2;
  }
  // High card
  return rs.reduce((a, r, i) => a + r * Math.pow(100, 4 - i), 0);
}

/** Best 5-card hand from 5–7 cards. */
function bestHand(cards: Card[]): number {
  if (cards.length === 5) return scoreHand5(cards);
  let best = 0;
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++)
            best = Math.max(best, scoreHand5([cards[a], cards[b], cards[c], cards[d], cards[e]]));
  return best;
}

function handName(score: number): string {
  const cat = Math.floor(score / 1e12);
  return ["High Card","One Pair","Two Pair","Three of a Kind","Straight","Flush","Full House","Four of a Kind","Straight Flush"][cat] ?? "High Card";
}

// ─── Pre-flop strength (0–1) ─────────────────────────────────────────────────

function preflopStrength(c1: Card, c2: Card): number {
  const hi = Math.max(c1.rank, c2.rank);
  const lo = Math.min(c1.rank, c2.rank);
  const suited = c1.suit === c2.suit ? 0.06 : 0;
  const gap = hi - lo;
  if (hi === lo) return hi >= 12 ? 0.92 : hi >= 9 ? 0.78 : hi >= 6 ? 0.62 : 0.48;
  if (hi === 14) return lo >= 11 ? 0.87 + suited : lo >= 8 ? 0.66 + suited : 0.42 + suited;
  if (hi === 13) return lo >= 10 ? 0.72 + suited : 0.40 + suited;
  if (gap === 1) return 0.45 + suited;
  if (gap === 2) return 0.36 + suited;
  return 0.20 + suited;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class OfflinePokerScene extends Phaser.Scene {
  // Game state
  private players: PokerPlayer[] = [];
  private deck: Card[] = [];
  private community: Card[] = [];
  private pot = 0;
  private currentBet = 0;
  private phase = Phase.WAITING;
  private activeIdx = 0;
  private dealerIdx = 0;
  private roundNum  = 0;
  private playersToAct: Set<number> = new Set(); // seats that still need to act
  private isAITurn  = false;

  // Wallet bookkeeping
  private walletAtStart = 0;
  private buyIn = 0;

  // UI refs
  private chipsText!:    Phaser.GameObjects.Text;
  private potText!:      Phaser.GameObjects.Text;
  private phaseText!:    Phaser.GameObjects.Text;
  private statusText!:   Phaser.GameObjects.Text;
  private handNameText!: Phaser.GameObjects.Text;
  private winnerBanner!: Phaser.GameObjects.Text;
  private actionBtns:    Phaser.GameObjects.Container[] = [];
  private callBtn!:      Phaser.GameObjects.Text;
  private raisePanelBg!: Phaser.GameObjects.Container;
  private raiseInputEl:  HTMLInputElement | null = null;

  // Per-seat UI
  private seatContainers: Phaser.GameObjects.Container[] = [];
  private communitySlots: Phaser.GameObjects.Container[] = [];
  private holeSlots:      Phaser.GameObjects.Container[] = [];

  constructor() { super({ key: "OfflinePokerScene" }); }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    const user = networkManager.getUser();
    if (!user) { this.scene.start("LoginScene"); return; }

    // Wallet management: snapshot, deduct buy-in
    this.walletAtStart = localStore.load().chips;
    this.buyIn = Math.min(this.walletAtStart, BUY_IN);
    if (this.buyIn < BIG_BLIND * 2) {
      // Not enough chips to play — return to lobby
      this.scene.start("CasinoLobbyScene");
      return;
    }
    // Deduct from wallet immediately so other scenes see reduced balance
    localStore.adjustChips(-this.buyIn);

    // Build players
    const aiPool = Phaser.Utils.Array.Shuffle([...AI_NAMES]) as string[];
    this.players = [
      { seat: 0, name: user.username, chips: this.buyIn, holeCards: [], bet: 0, folded: false, allIn: false, isHuman: true },
      { seat: 1, name: aiPool[0], chips: 900 + Math.floor(Math.random() * 600), holeCards: [], bet: 0, folded: false, allIn: false, isHuman: false },
      { seat: 2, name: aiPool[1], chips: 900 + Math.floor(Math.random() * 600), holeCards: [], bet: 0, folded: false, allIn: false, isHuman: false },
      { seat: 3, name: aiPool[2], chips: 900 + Math.floor(Math.random() * 600), holeCards: [], bet: 0, folded: false, allIn: false, isHuman: false },
    ];

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0a1a0a);

    this.drawBackground(width, height);
    this.drawTable(width / 2, height / 2 - 20);
    this.buildHUD(width, height);
    this.buildCommunitySlots(width / 2, height / 2 - 22);
    this.buildHoleCardSlots(width / 2, height - 130);
    this.buildSeatDisplays(width, height);
    this.buildActionButtons(width, height);
    this.buildRaisePanel(width, height);

    // Status + hand name labels
    this.statusText = this.add.text(width / 2, height - 190, "", {
      fontSize: "14px", color: "#aaccaa", fontFamily: "monospace",
      stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.handNameText = this.add.text(width / 2, height - 170, "", {
      fontSize: "13px", color: "#ffd700", fontFamily: "monospace",
      stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    this.winnerBanner = this.add.text(width / 2, height / 2 - 60, "", {
      fontSize: "22px", color: "#ffd700", fontFamily: "monospace",
      stroke: "#000000", strokeThickness: 4,
      backgroundColor: "#00000099", padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(600).setVisible(false);

    // Keyboard shortcuts
    this.input.keyboard?.on("keydown-ESC", () => this.returnToLobby());
    this.input.keyboard?.on("keydown-F",   () => this.onHumanAction("fold"));
    this.input.keyboard?.on("keydown-C",   () => this.onHumanAction("checkcall"));
    this.input.keyboard?.on("keydown-R",   () => this.onHumanAction("raise"));

    this.updateHUD();
    this.time.delayedCall(600, () => this.startHand());
  }

  shutdown(): void { this.cleanup(); }

  // ─── Background / table drawing ─────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const g = this.add.graphics();
    for (let x = 0; x < w; x += 56) {
      for (let y = 36; y < h; y += 56) {
        g.fillStyle(((x / 56 + y / 56) % 2 === 0) ? 0x091a09 : 0x072007, 1);
        g.fillRect(x, y, 56, 56);
      }
    }
    g.lineStyle(1, 0x0f2a0f, 0.35);
    for (let x = 0; x < w; x += 56) g.lineBetween(x, 36, x, h);
    for (let y = 36; y < h; y += 56) g.lineBetween(0, y, w, y);
  }

  private drawTable(cx: number, cy: number): void {
    const g = this.add.graphics().setDepth(5);

    // Shadow
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(cx + 8, cy + 12, 620, 290);

    // Felt body
    g.fillStyle(0x0c5a0c, 1);
    g.fillEllipse(cx, cy, 620, 280);

    // Rail (wood)
    g.lineStyle(10, 0x3d1e00, 1);
    g.strokeEllipse(cx, cy, 620, 280);
    g.lineStyle(3, 0x6b3a00, 0.7);
    g.strokeEllipse(cx, cy, 608, 268);

    // Inner felt highlight
    g.fillStyle(0x1a7a1a, 0.25);
    g.fillEllipse(cx - 8, cy - 8, 580, 250);

    // Community card area (darker center rect)
    g.fillStyle(0x0a4a0a, 0.7);
    g.fillRoundedRect(cx - 168, cy - 42, 336, 84, 10);
    g.lineStyle(1, 0x33883388, 0.5);
    g.strokeRoundedRect(cx - 168, cy - 42, 336, 84, 10);

    // Pot area
    g.fillStyle(0x082d08, 0.85);
    g.fillRoundedRect(cx - 90, cy - 88, 180, 32, 6);
    g.lineStyle(1, 0x228822, 0.5);
    g.strokeRoundedRect(cx - 90, cy - 88, 180, 32, 6);

    this.potText = this.add.text(cx, cy - 72, "💰  POT: 0", {
      fontSize: "13px", color: "#ffd700", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(20);

    this.phaseText = this.add.text(cx, cy + 58, "", {
      fontSize: "12px", color: "#88cc88", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(20);
  }

  // ─── Community card slots ────────────────────────────────────────────────────

  private buildCommunitySlots(cx: number, cy: number): void {
    const CW = 48, CH = 68, GAP = 8;
    const total = 5 * CW + 4 * GAP;
    this.communitySlots = [];
    for (let i = 0; i < 5; i++) {
      const sx = cx - total / 2 + i * (CW + GAP) + CW / 2;
      this.communitySlots.push(this.makeCardSlot(sx, cy, CW, CH));
    }
  }

  private refreshCommunity(): void {
    const CW = 48, CH = 68;
    for (let i = 0; i < 5; i++) {
      this.setCardSlot(this.communitySlots[i], this.community[i] ?? null, false, CW, CH);
    }
  }

  // ─── Player hole card slots ──────────────────────────────────────────────────

  private buildHoleCardSlots(cx: number, cy: number): void {
    const CW = 60, CH = 84, GAP = 14;
    this.holeSlots = [];
    for (let i = 0; i < 2; i++) {
      const sx = cx - (CW + GAP) / 2 + i * (CW + GAP);
      const slot = this.makeCardSlot(sx, cy, CW, CH);
      slot.setDepth(60);
      this.holeSlots.push(slot);
    }
    // "YOUR CARDS" label
    this.add.text(cx, cy + 54, "YOUR CARDS", {
      fontSize: "9px", color: "#668866", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(61);
  }

  private refreshHoleCards(): void {
    const human = this.players[0];
    const CW = 60, CH = 84;
    for (let i = 0; i < 2; i++) {
      this.setCardSlot(this.holeSlots[i], human.holeCards[i] ?? null, false, CW, CH);
    }
  }

  // ─── Card slot helpers ───────────────────────────────────────────────────────

  private makeCardSlot(x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.lineStyle(1, 0x336633, 0.35);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    const c = this.add.container(x, y, [g]);
    c.setDepth(50);
    return c;
  }

  /** Rebuild the visual contents of a card slot. */
  private setCardSlot(container: Phaser.GameObjects.Container, card: Card | null, faceDown: boolean, w: number, h: number): void {
    // Remove all existing children and redraw
    while (container.length > 0) container.removeAt(0, true);

    const g = this.add.graphics();
    if (!card) {
      g.lineStyle(1, 0x336633, 0.35);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
      container.add(g);
      return;
    }
    if (faceDown) {
      g.fillStyle(0x1a0033, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      g.lineStyle(1, 0xaa00ff, 0.7);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
      // Diamond pattern
      g.lineStyle(1, 0x33005588, 0.4);
      for (let dy = -h / 2 + 6; dy < h / 2; dy += 7) g.lineBetween(-w / 2 + 3, dy, w / 2 - 3, dy);
      container.add(g);
      return;
    }
    // Face-up
    g.fillStyle(0xfafafa, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    g.lineStyle(1.5, 0x888888, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);

    const col   = SUIT_COLOR[card.suit];
    const rLbl  = RANK_LABEL[card.rank];
    const sLbl  = SUIT_SYM[card.suit];
    const fSz   = w < 50 ? 11 : 14;

    const topRank = this.add.text(-w / 2 + 3, -h / 2 + 2, rLbl, {
      fontSize: `${fSz}px`, color: col, fontFamily: "Arial,sans-serif", fontStyle: "bold",
    });
    const centerSuit = this.add.text(0, 2, sLbl, {
      fontSize: `${Math.floor(h * 0.38)}px`, color: col, fontFamily: "Arial,sans-serif",
    }).setOrigin(0.5);
    const botRank = this.add.text(w / 2 - 3, h / 2 - 2, rLbl, {
      fontSize: `${fSz}px`, color: col, fontFamily: "Arial,sans-serif", fontStyle: "bold",
    }).setOrigin(1, 1);

    container.add([g, topRank, centerSuit, botRank]);
  }

  // ─── Seat displays ───────────────────────────────────────────────────────────

  private getSeatPos(seat: number, w: number, h: number): { x: number; y: number } {
    const cx = w / 2, cy = h / 2 - 20;
    const positions: { x: number; y: number }[] = [
      { x: cx,       y: h - 130 },  // Human (bottom center)
      { x: cx - 310, y: cy - 50  }, // AI-1 (left)
      { x: cx,       y: cy - 165 }, // AI-2 (top center)
      { x: cx + 310, y: cy - 50  }, // AI-3 (right)
    ];
    return positions[seat] ?? { x: cx, y: cy };
  }

  private buildSeatDisplays(w: number, h: number): void {
    this.seatContainers = [];
    for (let s = 0; s < 4; s++) {
      const pos = this.getSeatPos(s, w, h);
      const c = this.add.container(pos.x, pos.y).setDepth(80);
      this.seatContainers.push(c);
    }
    this.refreshSeatDisplays();
  }

  private refreshSeatDisplays(): void {
    const { width, height } = this.scale;
    for (let s = 0; s < 4; s++) {
      const p   = this.players[s];
      const cnt = this.seatContainers[s];
      if (!p || !cnt) continue;

      // Clear previous children
      cnt.removeAll(true);

      const isActive = this.activeIdx === s && !p.folded && !p.allIn && this.phase !== Phase.WAITING;
      const isDealer = this.dealerIdx === s;

      // Box background
      const bw = s === 0 ? 180 : 160;
      const bh = s === 0 ? 48 : 60;
      const bg = this.add.graphics();

      let bgColor = 0x111822;
      if (p.folded)   bgColor = 0x221a1a;
      if (isActive)   bgColor = 0x0a2a1a;

      bg.fillStyle(bgColor, 0.9);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      bg.lineStyle(2, isActive ? 0x44ff88 : (p.folded ? 0x443333 : 0x224422), 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      cnt.add(bg);

      // Name
      const nameColor = p.isHuman ? "#ffffaa" : (p.folded ? "#664444" : (isActive ? "#ffffff" : "#aaccaa"));
      const nameTxt = this.add.text(0, s === 0 ? -10 : -14, p.name, {
        fontSize: "12px", color: nameColor, fontFamily: "monospace",
      }).setOrigin(0.5);
      cnt.add(nameTxt);

      // Chips
      const chipColor = p.chips <= 100 ? "#ff6666" : "#ffd700";
      const chipTxt = this.add.text(0, s === 0 ? 8 : 2, `💰 ${p.chips.toLocaleString()}`, {
        fontSize: "11px", color: chipColor, fontFamily: "monospace",
      }).setOrigin(0.5);
      cnt.add(chipTxt);

      // Status badge
      if (s !== 0) {
        let statusStr = "";
        let statusCol = "#888888";
        if (p.folded)   { statusStr = "FOLDED";  statusCol = "#664444"; }
        if (p.allIn)    { statusStr = "ALL-IN";  statusCol = "#ff8800"; }
        if (isActive)   { statusStr = "▶ TURN";  statusCol = "#44ff88"; }
        if (p.bet > 0 && !p.folded && !isActive) { statusStr = `bet ${p.bet}`; statusCol = "#88aaff"; }

        const stTxt = this.add.text(0, 18, statusStr, {
          fontSize: "9px", color: statusCol, fontFamily: "monospace",
        }).setOrigin(0.5);
        cnt.add(stTxt);

        // Face-down cards for AI
        if (!p.folded && p.holeCards.length === 2) {
          const CW = 18, CH = 26;
          for (let i = 0; i < 2; i++) {
            const cx2 = -CW - 4 + i * (CW + 4) + CW;
            const g2 = this.add.graphics();
            g2.fillStyle(0x1a0033, 1);
            g2.fillRoundedRect(cx2 - CW / 2, -bh / 2 - CH - 4, CW, CH, 2);
            g2.lineStyle(1, 0xaa00ff, 0.8);
            g2.strokeRoundedRect(cx2 - CW / 2, -bh / 2 - CH - 4, CW, CH, 2);
            cnt.add(g2);
          }
        }
      }

      // Dealer button
      if (isDealer) {
        const dbBg = this.add.graphics();
        dbBg.fillStyle(0xffd700, 1);
        dbBg.fillCircle(bw / 2 - 8, -bh / 2 + 8, 9);
        const dbTxt = this.add.text(bw / 2 - 8, -bh / 2 + 8, "D", {
          fontSize: "8px", color: "#000000", fontFamily: "monospace", fontStyle: "bold",
        }).setOrigin(0.5);
        cnt.add(dbBg);
        cnt.add(dbTxt);
      }

      // Active indicator for human
      if (s === 0 && isActive) {
        const pos2 = this.getSeatPos(0, width, height);
        const arrow = this.add.text(pos2.x, pos2.y - 40, "▼ YOUR TURN ▼", {
          fontSize: "11px", color: "#44ff88", fontFamily: "monospace",
          stroke: "#000", strokeThickness: 2,
        }).setOrigin(0.5).setDepth(81);
        // Stored as temp text; we'll clean it on next refresh
        // Use container data to find and destroy it
        (cnt as unknown as { _arrowRef?: Phaser.GameObjects.Text })._arrowRef?.destroy();
        (cnt as unknown as { _arrowRef?: Phaser.GameObjects.Text })._arrowRef = arrow;
      } else {
        const old = (cnt as unknown as { _arrowRef?: Phaser.GameObjects.Text })._arrowRef;
        if (old) { old.destroy(); delete (cnt as unknown as { _arrowRef?: Phaser.GameObjects.Text })._arrowRef; }
      }

      // Human bet indicator in current round
      if (s === 0 && p.bet > 0 && !p.folded) {
        const betTxt = this.add.text(width / 2, height - 80, `Current bet: ${p.bet}`, {
          fontSize: "10px", color: "#88aaff", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(201);
        (cnt as unknown as { _betLabel?: Phaser.GameObjects.Text })._betLabel?.destroy();
        (cnt as unknown as { _betLabel?: Phaser.GameObjects.Text })._betLabel = betTxt;
      } else {
        (cnt as unknown as { _betLabel?: Phaser.GameObjects.Text })._betLabel?.destroy();
      }
    }
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  private buildHUD(w: number, h: number): void {
    this.add.graphics()
      .fillStyle(0x000000, 0.8)
      .fillRect(0, 0, w, 36)
      .setScrollFactor(0).setDepth(500);

    this.chipsText = this.add.text(14, 10, "", {
      fontSize: "13px", color: "#ffd700", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    this.add.text(w / 2, 10, "🃏 Poker — Offline vs AI", {
      fontSize: "13px", color: "#44ff88", fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    this.add.text(w - 14, 10, "[ Leave ]  ESC", {
      fontSize: "12px", color: "#4488ff", fontFamily: "monospace",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(501)
      .setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());
  }

  private updateHUD(): void {
    const human = this.players[0];
    if (this.chipsText) this.chipsText.setText(`💰 ${human.chips.toLocaleString()} chips`);
    if (this.potText) this.potText.setText(`💰  POT: ${this.pot.toLocaleString()}`);
  }

  private setStatus(msg: string): void {
    if (this.statusText) this.statusText.setText(msg);
  }

  private updateHandName(): void {
    const human = this.players[0];
    if (!this.handNameText) return;
    if (human.folded || human.holeCards.length < 2) { this.handNameText.setText(""); return; }
    const all = [...human.holeCards, ...this.community];
    if (all.length < 2) { this.handNameText.setText(""); return; }
    const score = bestHand(all);
    this.handNameText.setText(handName(score));
  }

  // ─── Action buttons ──────────────────────────────────────────────────────────

  private buildActionButtons(w: number, h: number): void {
    const defs = [
      { label: "FOLD", key: "F", col: "#ff5555", action: "fold" },
      { label: "CHECK / CALL", key: "C", col: "#44ff88", action: "checkcall" },
      { label: "RAISE", key: "R", col: "#ffaa00", action: "raise" },
    ];
    this.actionBtns = [];
    const bw = 200, bh = 42, gap = 16;
    const totalW = defs.length * bw + (defs.length - 1) * gap;
    const startX = w / 2 - totalW / 2;

    defs.forEach((def, i) => {
      const bx = startX + i * (bw + gap) + bw / 2;
      const by = h - 52;

      const bg = this.add.graphics();
      const col = parseInt(def.col.replace("#", ""), 16);
      const drawBg = (hover: boolean): void => {
        bg.clear();
        bg.fillStyle(hover ? 0x222222 : 0x111111, 0.85);
        bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
        bg.lineStyle(2, col, hover ? 1 : 0.7);
        bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
      };
      drawBg(false);

      const lbl = this.add.text(0, -1, `[ ${def.label} ]  ${def.key}`, {
        fontSize: "14px", color: def.col, fontFamily: "monospace",
      }).setOrigin(0.5);
      if (def.action === "checkcall") this.callBtn = lbl;

      const zone = this.add.zone(0, 0, bw, bh).setInteractive({ cursor: "pointer" });
      zone.on("pointerover", () => drawBg(true));
      zone.on("pointerout",  () => drawBg(false));
      zone.on("pointerdown", () => this.onHumanAction(def.action));

      const cnt = this.add.container(bx, by, [bg, lbl, zone]);
      cnt.setScrollFactor(0).setDepth(510).setVisible(false);
      this.actionBtns.push(cnt);
    });
  }

  private showActionButtons(show: boolean): void {
    // Update CALL button label dynamically
    if (show) {
      const human = this.players[0];
      const toCall = this.currentBet - human.bet;
      if (this.callBtn) {
        this.callBtn.setText(toCall <= 0 ? "[ CHECK ]  C" : `[ CALL ${toCall} ]  C`);
      }
    }
    this.actionBtns.forEach(b => b.setVisible(show));
  }

  // ─── Raise panel ─────────────────────────────────────────────────────────────

  private buildRaisePanel(w: number, h: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.97);
    bg.fillRoundedRect(-150, -34, 300, 68, 8);
    bg.lineStyle(2, 0xffaa00, 1);
    bg.strokeRoundedRect(-150, -34, 300, 68, 8);

    const lbl = this.add.text(-144, -20, "Raise to:", {
      fontSize: "12px", color: "#ffaa00", fontFamily: "monospace",
    });

    const okBtn = this.add.text(72, -8, "[ OK ]", {
      fontSize: "14px", color: "#44ff88", fontFamily: "monospace",
    }).setInteractive({ cursor: "pointer" }).on("pointerdown", () => this.confirmRaise());

    const cancelBtn = this.add.text(112, -8, "[ ✕ ]", {
      fontSize: "14px", color: "#ff4444", fontFamily: "monospace",
    }).setInteractive({ cursor: "pointer" }).on("pointerdown", () => this.hideRaisePanel());

    this.raisePanelBg = this.add.container(w / 2, h - 110, [bg, lbl, okBtn, cancelBtn]);
    this.raisePanelBg.setScrollFactor(0).setDepth(530).setVisible(false);
  }

  private showRaisePanel(): void {
    this.raisePanelBg.setVisible(true);
    if (!this.raiseInputEl) {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.style.cssText = [
        "position:fixed",
        `left:${this.scale.width / 2 - 50}px`,
        `top:${this.scale.height - 126}px`,
        "width:80px",
        "background:#0d1b2a",
        "color:#fff",
        "border:1px solid #ffaa00",
        "font-size:13px",
        "padding:3px 6px",
        "z-index:1000",
        "border-radius:4px",
      ].join(";");
      document.body.appendChild(inp);
      this.raiseInputEl = inp;
    }
    const p     = this.players[this.activeIdx];
    const minR  = this.currentBet + BIG_BLIND;
    const maxR  = p.chips + p.bet;
    this.raiseInputEl.min   = String(minR);
    this.raiseInputEl.max   = String(maxR);
    this.raiseInputEl.value = String(Math.min(minR * 2, maxR));
    this.raiseInputEl.style.display = "block";
    this.raiseInputEl.focus();
  }

  private hideRaisePanel(): void {
    this.raisePanelBg.setVisible(false);
    if (this.raiseInputEl) this.raiseInputEl.style.display = "none";
  }

  private confirmRaise(): void {
    const val = parseInt(this.raiseInputEl?.value ?? "0", 10);
    this.hideRaisePanel();
    if (!isNaN(val) && val > 0) {
      this.doRaise(this.activeIdx, val);
    } else {
      this.doCall(this.activeIdx);
    }
    this.afterAction(this.activeIdx, "raise");
  }

  // ─── Game flow ───────────────────────────────────────────────────────────────

  private buildDeck(): Card[] {
    const d: Card[] = [];
    for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push({ rank: r, suit: s as Suit });
    return Phaser.Utils.Array.Shuffle(d) as Card[];
  }

  private startHand(): void {
    this.roundNum++;
    this.pot = 0;
    this.currentBet = 0;
    this.community = [];
    this.deck = this.buildDeck();
    this.isAITurn = false;

    // Reset players
    for (const p of this.players) {
      p.holeCards = [];
      p.bet = 0;
      p.folded = false;
      p.allIn = false;
    }

    // Auto-sit-out busted players (<= 0 chips, auto-fold)
    const alive = this.players.filter(p => p.chips > 0);
    if (alive.length < 2) { this.triggerGameOver(); return; }

    // Rotate dealer
    this.dealerIdx = (this.dealerIdx + 1) % 4;
    while (this.players[this.dealerIdx].chips <= 0) {
      this.dealerIdx = (this.dealerIdx + 1) % 4;
    }

    // Deal cards only to players with chips
    for (const p of this.players) {
      if (p.chips > 0) {
        p.holeCards = [this.deck.pop()!, this.deck.pop()!];
      } else {
        p.folded = true;
      }
    }

    // Post blinds
    const sbIdx = this.nextSeat(this.dealerIdx);
    const bbIdx = this.nextSeat(sbIdx);
    this.postBlind(sbIdx, SMALL_BLIND);
    this.postBlind(bbIdx, BIG_BLIND);
    this.currentBet = BIG_BLIND;

    // Set up who needs to act (everyone, including SB and BB who still get their option)
    this.playersToAct.clear();
    for (const p of this.players) {
      if (!p.folded && !p.allIn) this.playersToAct.add(p.seat);
    }

    // First to act: UTG (after BB)
    this.activeIdx = this.nextSeat(bbIdx);
    this.phase = Phase.PREFLOP;

    this.refreshCommunity();
    this.refreshHoleCards();
    this.updateHUD();
    this.updatePhaseLabel();
    this.refreshSeatDisplays();
    this.setStatus(`Round ${this.roundNum} — Dealer: ${this.players[this.dealerIdx].name} | Blinds: ${SMALL_BLIND}/${BIG_BLIND}`);

    this.time.delayedCall(400, () => this.processTurn());
  }

  private postBlind(idx: number, amount: number): void {
    const p = this.players[idx];
    const actual = Math.min(amount, p.chips);
    p.chips -= actual;
    p.bet   += actual;
    this.pot += actual;
    if (p.chips === 0) p.allIn = true;
  }

  private nextSeat(from: number): number {
    let idx = (from + 1) % 4;
    let attempts = 0;
    while ((this.players[idx].folded || this.players[idx].chips <= 0) && attempts < 4) {
      idx = (idx + 1) % 4;
      attempts++;
    }
    return idx;
  }

  private processTurn(): void {
    const alive = this.players.filter(p => !p.folded);
    if (alive.length <= 1) {
      this.endHand(alive[0] ?? this.players[0]);
      return;
    }

    const current = this.players[this.activeIdx];

    if (current.folded || current.allIn || !this.playersToAct.has(current.seat)) {
      // Find next player who needs to act
      const nextIdx = this.findNextToAct(this.activeIdx);
      if (nextIdx === -1) {
        // No one left to act
        this.time.delayedCall(300, () => this.advancePhase());
        return;
      }
      this.activeIdx = nextIdx;
      this.time.delayedCall(100, () => this.processTurn());
      return;
    }

    this.refreshSeatDisplays();

    if (current.isHuman) {
      this.showActionButtons(true);
      this.setStatus("Your turn!");
      this.updateHandName();
    } else {
      this.showActionButtons(false);
      this.setStatus(`${current.name} is thinking...`);
      this.isAITurn = true;
      this.time.delayedCall(500 + Math.random() * 700, () => {
        this.isAITurn = false;
        if (this.phase !== Phase.WAITING && this.phase !== Phase.SHOWDOWN) {
          this.runAI(current);
        }
      });
    }
  }

  private findNextToAct(from: number): number {
    let idx = (from + 1) % 4;
    let count = 0;
    while (count < 4) {
      if (this.playersToAct.has(idx)) return idx;
      idx = (idx + 1) % 4;
      count++;
    }
    return -1;
  }

  private afterAction(seat: number, action: "fold" | "check" | "call" | "raise"): void {
    this.playersToAct.delete(seat);

    if (action === "raise") {
      // Everyone else needs to act again
      for (const p of this.players) {
        if (!p.folded && !p.allIn && p.seat !== seat) {
          this.playersToAct.add(p.seat);
        }
      }
    }

    this.refreshSeatDisplays();

    // Check if round is over
    const nextIdx = this.findNextToAct(seat);
    if (nextIdx === -1 || this.playersToAct.size === 0) {
      this.time.delayedCall(350, () => this.advancePhase());
    } else {
      this.activeIdx = nextIdx;
      this.time.delayedCall(250, () => this.processTurn());
    }
  }

  private advancePhase(): void {
    // Reset round bets
    for (const p of this.players) p.bet = 0;
    this.currentBet = 0;
    this.playersToAct.clear();

    const alive = this.players.filter(p => !p.folded);
    if (alive.length <= 1) { this.endHand(alive[0] ?? this.players[0]); return; }

    // Set all non-folded, non-all-in players to act
    for (const p of this.players) {
      if (!p.folded && !p.allIn && p.chips > 0) this.playersToAct.add(p.seat);
    }

    // If everyone is all-in, run out the board
    const needToAct = this.players.filter(p => !p.folded && !p.allIn && p.chips > 0);
    const runout = needToAct.length === 0;

    switch (this.phase) {
      case Phase.PREFLOP:
        this.phase = Phase.FLOP;
        this.community.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
        break;
      case Phase.FLOP:
        this.phase = Phase.TURN;
        this.community.push(this.deck.pop()!);
        break;
      case Phase.TURN:
        this.phase = Phase.RIVER;
        this.community.push(this.deck.pop()!);
        break;
      case Phase.RIVER:
      case Phase.SHOWDOWN:
        this.resolveShowdown();
        return;
      default:
        return;
    }

    this.refreshCommunity();
    this.updatePhaseLabel();
    this.updateHUD();
    this.updateHandName();
    this.setStatus("");

    if (runout) {
      // Skip betting, go straight to next phase
      this.time.delayedCall(700, () => this.advancePhase());
      return;
    }

    // First to act post-flop: first active player after dealer
    this.activeIdx = this.nextSeat(this.dealerIdx - 1 < 0 ? 3 : this.dealerIdx - 1);
    while (this.players[this.activeIdx].folded || this.players[this.activeIdx].allIn || this.players[this.activeIdx].chips <= 0) {
      this.activeIdx = this.nextSeat(this.activeIdx);
    }

    this.time.delayedCall(400, () => this.processTurn());
  }

  private updatePhaseLabel(): void {
    const names: Record<number, string> = {
      [Phase.PREFLOP]: "Pre-Flop",
      [Phase.FLOP]:    "Flop",
      [Phase.TURN]:    "Turn",
      [Phase.RIVER]:   "River",
      [Phase.SHOWDOWN]:"Showdown",
    };
    this.phaseText?.setText(names[this.phase] ?? "");
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  private onHumanAction(action: string): void {
    if (this.isAITurn) return;
    if (!this.actionBtns[0]?.visible) return;
    if (this.players[this.activeIdx].seat !== 0) return;

    if (action === "raise") {
      this.showRaisePanel();
      return; // confirmRaise handles continuation
    }

    this.showActionButtons(false);
    this.hideRaisePanel();

    const human = this.players[this.activeIdx];
    const toCall = this.currentBet - human.bet;

    if (action === "fold") {
      this.doFold(this.activeIdx);
      this.afterAction(this.activeIdx, "fold");
    } else if (action === "checkcall") {
      if (toCall <= 0) {
        this.doCheck(this.activeIdx);
        this.afterAction(this.activeIdx, "check");
      } else {
        this.doCall(this.activeIdx);
        this.afterAction(this.activeIdx, "call");
      }
    }
  }

  private doFold(idx: number): void {
    this.players[idx].folded = true;
    this.setStatus(`${this.players[idx].name} folds.`);
  }

  private doCheck(idx: number): void {
    this.setStatus(`${this.players[idx].name} checks.`);
  }

  private doCall(idx: number): void {
    const p = this.players[idx];
    const toCall = Math.min(this.currentBet - p.bet, p.chips);
    p.chips -= toCall;
    p.bet   += toCall;
    this.pot += toCall;
    if (p.chips === 0) p.allIn = true;
    this.setStatus(`${p.name} calls ${toCall}.`);
    this.updateHUD();
  }

  private doRaise(idx: number, raiseTo: number): void {
    const p   = this.players[idx];
    const min = this.currentBet + BIG_BLIND;
    raiseTo   = Math.max(raiseTo, min);
    const extra  = Math.min(raiseTo - p.bet, p.chips);
    p.chips -= extra;
    p.bet   += extra;
    this.pot += extra;
    this.currentBet = p.bet;
    if (p.chips === 0) p.allIn = true;
    this.setStatus(`${p.name} raises to ${this.currentBet}.`);
    this.updateHUD();
  }

  // ─── AI logic ────────────────────────────────────────────────────────────────

  private runAI(player: PokerPlayer): void {
    const toCall   = this.currentBet - player.bet;
    const strength = this.computeStrength(player);
    const pot      = this.pot;

    let action: "fold" | "check" | "call" | "raise";

    if (toCall <= 0) {
      if (strength > 0.75 && Math.random() < 0.65) action = "raise";
      else if (strength > 0.55 && Math.random() < 0.30) action = "raise";
      else if (Math.random() < 0.09) action = "raise"; // bluff
      else action = "check";
    } else {
      const potOdds = toCall / (pot + toCall + 1);
      if (strength > 0.88) {
        action = Math.random() < 0.45 ? "raise" : "call";
      } else if (strength > potOdds + 0.15) {
        action = "call";
      } else if (strength > potOdds && Math.random() < 0.35) {
        action = "call";
      } else if (Math.random() < 0.07 && toCall <= BIG_BLIND * 2) {
        action = "call"; // small bluff call
      } else {
        action = "fold";
      }
    }

    if (action === "fold") {
      this.doFold(player.seat);
      this.afterAction(player.seat, "fold");
    } else if (action === "check") {
      this.doCheck(player.seat);
      this.afterAction(player.seat, "check");
    } else if (action === "call") {
      this.doCall(player.seat);
      this.afterAction(player.seat, "call");
    } else {
      const size = Math.floor(pot * (0.35 + Math.random() * 0.45));
      const raiseTo = Math.max(this.currentBet + BIG_BLIND, this.currentBet + size);
      if (raiseTo > this.currentBet && raiseTo <= player.chips + player.bet) {
        this.doRaise(player.seat, raiseTo);
        this.afterAction(player.seat, "raise");
      } else {
        this.doCall(player.seat);
        this.afterAction(player.seat, "call");
      }
    }
  }

  private computeStrength(player: PokerPlayer): number {
    if (player.holeCards.length < 2) return 0.5;
    if (this.community.length === 0) {
      return preflopStrength(player.holeCards[0], player.holeCards[1]);
    }
    const all  = [...player.holeCards, ...this.community];
    const sc   = bestHand(all);
    const cat  = Math.floor(sc / 1e12);
    const base = [0.12, 0.32, 0.50, 0.65, 0.75, 0.82, 0.90, 0.95, 0.99][cat] ?? 0.12;
    return Math.min(1, Math.max(0, base + (Math.random() - 0.5) * 0.12));
  }

  // ─── Showdown ────────────────────────────────────────────────────────────────

  private resolveShowdown(): void {
    this.phase = Phase.SHOWDOWN;
    this.showActionButtons(false);
    this.updatePhaseLabel();

    const active = this.players.filter(p => !p.folded);
    if (active.length === 1) {
      this.endHand(active[0]);
      return;
    }

    // Evaluate
    let bestScore = -1;
    let winners: PokerPlayer[] = [];
    for (const p of active) {
      const sc = bestHand([...p.holeCards, ...this.community]);
      if (sc > bestScore) { bestScore = sc; winners = [p]; }
      else if (sc === bestScore) winners.push(p);
    }

    const share = Math.floor(this.pot / winners.length);
    for (const w of winners) w.chips += share;

    const wNames = winners.map(w => w.name).join(" & ");
    const hn     = handName(bestScore);
    this.showBanner(`🏆 ${wNames} wins ${this.pot} chips!\n${hn}`);
    this.refreshSeatDisplays();
    this.updateHUD();

    // Save human chips update to wallet bookkeeping is handled on exit
    this.time.delayedCall(3200, () => {
      this.winnerBanner.setVisible(false);
      const stillAlive = this.players.filter(p => p.chips > 0);
      if (stillAlive.length < 2 || stillAlive.every(p => !p.isHuman)) {
        this.triggerGameOver();
      } else if (this.players[0].chips <= 0) {
        this.offerRebuy();
      } else {
        this.time.delayedCall(300, () => this.startHand());
      }
    });
  }

  private endHand(winner: PokerPlayer): void {
    this.showActionButtons(false);
    winner.chips += this.pot;
    this.showBanner(`🏆 ${winner.name} wins ${this.pot} chips!`);
    this.refreshSeatDisplays();
    this.updateHUD();

    this.time.delayedCall(2200, () => {
      this.winnerBanner.setVisible(false);
      if (this.players[0].chips <= 0) {
        this.offerRebuy();
      } else {
        this.time.delayedCall(300, () => this.startHand());
      }
    });
  }

  private triggerGameOver(): void {
    this.showBanner("🎲 Game Over — Returning to Lobby...");
    this.saveChipsToWallet();
    this.time.delayedCall(2500, () => {
      this.cleanup();
      this.scene.start("CasinoLobbyScene");
    });
  }

  private offerRebuy(): void {
    const walletNow = localStore.load().chips;
    if (walletNow < BIG_BLIND * 4) {
      // Can't rebuy
      this.showBanner("💸 Busted! No chips left.\nReturning to Lobby...");
      this.time.delayedCall(2500, () => {
        this.cleanup();
        this.scene.start("CasinoLobbyScene");
      });
      return;
    }
    const rebuyAmount = Math.min(walletNow, BUY_IN);
    this.showBanner(`💸 Busted! Rebuy ${rebuyAmount.toLocaleString()} chips?\n[ Click anywhere to rebuy ]`);

    this.input.once("pointerdown", () => {
      this.winnerBanner.setVisible(false);
      localStore.adjustChips(-rebuyAmount);
      this.players[0].chips = rebuyAmount;
      this.buyIn += rebuyAmount; // Track total buy-in for session accounting
      this.updateHUD();
      this.time.delayedCall(300, () => this.startHand());
    });
  }

  private showBanner(msg: string): void {
    if (this.winnerBanner) {
      this.winnerBanner.setText(msg).setVisible(true);
    }
    this.cameras.main.flash(500, 255, 215, 0, true);
  }

  // ─── Cleanup & exit ─────────────────────────────────────────────────────────

  private saveChipsToWallet(): void {
    const human = this.players[0];
    if (human) {
      localStore.adjustChips(human.chips);
      networkManager.syncChipsFromStore();
      const user = networkManager.getUser();
      if (user) user.chips = localStore.load().chips;
    }
  }

  private returnToLobby(): void {
    this.saveChipsToWallet();
    this.cleanup();
    this.scene.start("CasinoLobbyScene");
  }

  private cleanup(): void {
    if (this.raiseInputEl?.parentNode) {
      document.body.removeChild(this.raiseInputEl);
      this.raiseInputEl = null;
    }
    // Clean up seat arrow refs
    for (const cnt of this.seatContainers) {
      const old = (cnt as unknown as { _arrowRef?: Phaser.GameObjects.Text })._arrowRef;
      if (old) old.destroy();
      const bet = (cnt as unknown as { _betLabel?: Phaser.GameObjects.Text })._betLabel;
      if (bet) bet.destroy();
    }
  }
}
