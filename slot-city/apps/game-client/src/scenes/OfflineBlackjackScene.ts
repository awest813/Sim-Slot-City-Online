/**
 * OfflineBlackjackScene — fully playable blackjack vs dealer AI.
 * No server required. Works 100% in guest/solo mode via localStore.
 *
 * Rules:
 *  - Dealer stands on soft 17.
 *  - Blackjack pays 3:2.
 *  - Double down allowed on first two cards.
 *  - No split or insurance (standard simplified ruleset).
 */

import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { localStore } from "../store/LocalStore";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Suit = "S" | "H" | "D" | "C";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K";

interface Card { rank: Rank; suit: Suit; }

type Phase = "betting" | "playing" | "dealer" | "result";
type Result = "blackjack" | "win" | "push" | "lose" | "bust" | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const SUIT_SYM:   Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLOR: Record<Suit, string> = { S: "#ffffff", H: "#ff6666", D: "#ff6666", C: "#ffffff" };
const RANK_VALUES: Record<Rank, number> = {
  A: 11, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  T: 10, J: 10, Q: 10, K: 10,
};
const BET_OPTIONS = [10, 25, 50, 100, 250, 500];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","T","J","Q","K"];
const SUITS: Suit[] = ["S","H","D","C"];

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

function shuffled(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === "A") aces++;
    total += RANK_VALUES[c.rank];
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

function cardLabel(c: Card): string {
  return `${c.rank}${SUIT_SYM[c.suit]}`;
}

function isRed(c: Card): boolean {
  return c.suit === "H" || c.suit === "D";
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class OfflineBlackjackScene extends Phaser.Scene {
  // Game state
  private deck: Card[] = [];
  private playerHand: Card[] = [];
  private dealerHand: Card[] = [];
  private phase: Phase = "betting";
  private result: Result = null;
  private bet = 25;
  private chips = 1000;
  private dealerRevealed = false;

  // Session stats
  private handsPlayed = 0;
  private wins = 0;
  private losses = 0;
  private pushes = 0;

  // Phaser objects
  private chipsText!: Phaser.GameObjects.Text;
  private betText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private dealerValueText!: Phaser.GameObjects.Text;
  private playerValueText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;

  // Dynamic card objects (rebuilt on each render)
  private dealerCardObjs: Phaser.GameObjects.GameObject[] = [];
  private playerCardObjs: Phaser.GameObjects.GameObject[] = [];

  // Buttons (groups toggled by phase)
  private betBtns: Phaser.GameObjects.Container[] = [];
  private dealBtn!: Phaser.GameObjects.Container;
  private hitBtn!: Phaser.GameObjects.Container;
  private standBtn!: Phaser.GameObjects.Container;
  private doubleBtn!: Phaser.GameObjects.Container;
  private nextHandBtn!: Phaser.GameObjects.Container;

  private readonly CX: number = 512;
  private readonly CY: number = 384;

  constructor() {
    super({ key: "OfflineBlackjackScene" });
  }

  create(): void {
    // Load chips from localStore
    const saved = localStore.load();
    this.chips = Math.max(saved.chips, 100); // give 100 chips minimum

    this.cameras.main.setBackgroundColor(0x071407);
    this.drawTable();
    this.buildHUD();
    this.buildBetUI();
    this.buildActionButtons();
    this.buildNextHandButton();
    this.enterPhase("betting");
    this.refreshDisplay();
  }

  // ── Table drawing ─────────────────────────────────────────────────────────────

  private drawTable(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const g = this.add.graphics();

    // Felt background
    g.fillStyle(0x0d5c1e, 1);
    g.fillEllipse(cx, cy + 20, 600, 280);
    g.lineStyle(6, 0x5c3a00, 1);
    g.strokeEllipse(cx, cy + 20, 600, 280);

    // Inner highlight
    g.fillStyle(0x178a30, 0.3);
    g.fillEllipse(cx, cy + 18, 570, 260);

    // Dealer zone
    g.fillStyle(0x0a4a18, 0.8);
    g.fillRect(cx - 180, cy - 110, 360, 40);
    g.lineStyle(1, 0x228833, 0.5);
    g.strokeRect(cx - 180, cy - 110, 360, 40);

    this.add.text(cx, cy - 108, "DEALER", {
      fontSize: "9px", color: "#aaffaa", fontFamily: "monospace",
    }).setOrigin(0.5, 0).setDepth(10);

    // Player zone
    g.fillStyle(0x0a4a18, 0.8);
    g.fillRect(cx - 180, cy + 50, 360, 40);
    g.lineStyle(1, 0x228833, 0.5);
    g.strokeRect(cx - 180, cy + 50, 360, 40);

    this.add.text(cx, cy + 52, "YOUR HAND", {
      fontSize: "9px", color: "#aaffaa", fontFamily: "monospace",
    }).setOrigin(0.5, 0).setDepth(10);

    // Back button
    this.add.text(16, 46, "← Back to Lobby", {
      fontSize: "12px", color: "#4488ff", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());

    // Title
    this.add.text(width / 2, 10, "🃏  Blackjack  (Solo Mode)", {
      fontSize: "13px", color: "#c9a84c", fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    // HUD bar background
    this.add.graphics()
      .fillStyle(0x000000, 0.75)
      .fillRect(0, 0, width, 38)
      .setScrollFactor(0).setDepth(500);

    // Bottom bar background
    this.add.graphics()
      .fillStyle(0x000000, 0.7)
      .fillRect(0, height - 68, width, 68)
      .setScrollFactor(0).setDepth(500);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────────

  private buildHUD(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    this.chipsText = this.add.text(20, 10, "", {
      fontSize: "13px", color: "#ffd700", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    this.betText = this.add.text(width - 20, 10, "", {
      fontSize: "13px", color: "#ffffff", fontFamily: "monospace",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(501);

    this.statusText = this.add.text(cx, 10, "", {
      fontSize: "12px", color: "#aaaaaa", fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    this.statsText = this.add.text(cx, height - 8, "", {
      fontSize: "9px", color: "#446644", fontFamily: "monospace",
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(501);

    // Dealer value (right of dealer zone)
    this.dealerValueText = this.add.text(cx + 190, cy - 90, "", {
      fontSize: "11px", color: "#ffd700", fontFamily: "monospace",
    }).setOrigin(0, 0.5).setDepth(20);

    // Player value (right of player zone)
    this.playerValueText = this.add.text(cx + 190, cy + 70, "", {
      fontSize: "11px", color: "#ffd700", fontFamily: "monospace",
    }).setOrigin(0, 0.5).setDepth(20);

    // Result banner (center)
    this.resultText = this.add.text(cx, cy - 10, "", {
      fontSize: "28px", color: "#ffd700",
      stroke: "#000000", strokeThickness: 5,
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(30).setAlpha(0);
  }

  // ── Bet UI ────────────────────────────────────────────────────────────────────

  private buildBetUI(): void {
    const { width, height } = this.scale;
    const btnY = height - 44;

    this.add.text(16, btnY, "BET:", {
      fontSize: "11px", color: "#c9a84c", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setName("betLabel");

    BET_OPTIONS.forEach((amt, i) => {
      const x = 60 + i * 72;
      const btn = this.makeBtn(x, btnY, 64, 26, `◈${amt}`,
        amt === this.bet ? 0x1a5a1a : 0x1a2a1a,
        () => this.selectBet(amt));
      btn.setScrollFactor(0).setDepth(502);
      this.betBtns.push(btn);
    });

    this.dealBtn = this.makeBtn(width - 80, btnY, 90, 26, "DEAL ▶", 0x1a5a1a, () => this.startHand());
    this.dealBtn.setScrollFactor(0).setDepth(502);
  }

  private selectBet(amt: number): void {
    if (this.phase !== "betting") return;
    if (amt > this.chips) return;
    this.bet = amt;
    this.betBtns.forEach((b, i) => {
      const bg = b.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(BET_OPTIONS[i] === amt ? 0x1a5a1a : 0x1a2a1a);
    });
    this.refreshDisplay();
  }

  // ── Action buttons ────────────────────────────────────────────────────────────

  private buildActionButtons(): void {
    const { width, height } = this.scale;
    const ay = height - 44;
    const cx = width / 2;

    this.hitBtn    = this.makeBtn(cx - 110, ay, 80, 26, "HIT",    0x1a5a1a, () => this.doHit());
    this.standBtn  = this.makeBtn(cx,       ay, 80, 26, "STAND",  0x1a2a5a, () => this.doStand());
    this.doubleBtn = this.makeBtn(cx + 110, ay, 100, 26, "DOUBLE", 0x4a3a00, () => this.doDouble());
    [this.hitBtn, this.standBtn, this.doubleBtn].forEach(b => {
      b.setScrollFactor(0).setDepth(502).setVisible(false);
    });
  }

  // ── Next hand button ──────────────────────────────────────────────────────────

  private buildNextHandButton(): void {
    const { width, height } = this.scale;
    this.nextHandBtn = this.makeBtn(width / 2, height - 44, 140, 26, "NEXT HAND ▶", 0x1a5a1a,
      () => this.resetForNextHand());
    this.nextHandBtn.setScrollFactor(0).setDepth(502).setVisible(false);
  }

  // ── Game logic ────────────────────────────────────────────────────────────────

  private startHand(): void {
    if (this.phase !== "betting") return;

    // Clamp bet to chips
    if (this.bet > this.chips) {
      const max = BET_OPTIONS.slice().reverse().find(o => o <= this.chips);
      if (!max) return; // no affordable bet
      this.bet = max;
    }

    this.chips -= this.bet;
    this.deck = shuffled([...buildDeck(), ...buildDeck(), ...buildDeck(), ...buildDeck(), ...buildDeck(), ...buildDeck()]); // 6-deck shoe
    this.playerHand = [this.deck.pop()!, this.deck.pop()!];
    this.dealerHand = [this.deck.pop()!, this.deck.pop()!];
    this.dealerRevealed = false;
    this.result = null;

    this.enterPhase("playing");
    this.refreshDisplay();

    // Check for immediate blackjack
    if (isBlackjack(this.playerHand)) {
      this.runDealer();
    }
  }

  private doHit(): void {
    if (this.phase !== "playing") return;
    this.playerHand.push(this.deck.pop()!);
    this.refreshDisplay();
    if (handValue(this.playerHand) > 21) {
      this.runDealer();
    }
  }

  private doStand(): void {
    if (this.phase !== "playing") return;
    this.runDealer();
  }

  private doDouble(): void {
    if (this.phase !== "playing") return;
    if (this.chips < this.bet) return;
    this.chips -= this.bet;
    this.bet *= 2;
    this.playerHand.push(this.deck.pop()!);
    this.refreshDisplay();
    this.runDealer();
  }

  private runDealer(): void {
    this.enterPhase("dealer");
    this.dealerRevealed = true;

    // Dealer draws until 17+
    while (handValue(this.dealerHand) < 17) {
      this.dealerHand.push(this.deck.pop()!);
    }

    this.resolveResult();
  }

  private resolveResult(): void {
    const pv = handValue(this.playerHand);
    const dv = handValue(this.dealerHand);
    const pBJ = isBlackjack(this.playerHand);
    const dBJ = isBlackjack(this.dealerHand);

    let res: Result;
    if (pv > 21) {
      res = "bust";
    } else if (pBJ && dBJ) {
      res = "push";
    } else if (pBJ) {
      res = "blackjack";
    } else if (dBJ || dv > pv && dv <= 21) {
      res = "lose";
    } else if (dv > 21 || pv > dv) {
      res = "win";
    } else {
      res = "push";
    }

    this.result = res;

    // Payout
    if (res === "blackjack") {
      this.chips += this.bet + Math.floor(this.bet * 1.5); // original bet + 1.5× bonus
    } else if (res === "win") {
      this.chips += this.bet * 2;
    } else if (res === "push") {
      this.chips += this.bet; // refund
    }
    // lose/bust: bet already deducted, no refund

    this.handsPlayed++;
    if (res === "win" || res === "blackjack") this.wins++;
    else if (res === "push") this.pushes++;
    else this.losses++;

    // Persist chips
    localStore.setChips(this.chips);
    networkManager.syncChipsFromStore();

    this.enterPhase("result");
    this.refreshDisplay();
  }

  private resetForNextHand(): void {
    this.playerHand = [];
    this.dealerHand = [];
    this.result = null;
    this.dealerRevealed = false;
    // Reset bet to last value (or reduce if can't afford)
    if (this.bet > this.chips) {
      const max = BET_OPTIONS.slice().reverse().find(o => o <= this.chips);
      this.bet = max ?? BET_OPTIONS[0];
    }
    this.enterPhase("betting");
    this.refreshDisplay();
  }

  // ── Phase UI ─────────────────────────────────────────────────────────────────

  private enterPhase(phase: Phase): void {
    this.phase = phase;
    const betting = phase === "betting";
    const playing = phase === "playing";
    const result  = phase === "result";

    this.betBtns.forEach(b => b.setVisible(betting));
    this.dealBtn.setVisible(betting);
    this.hitBtn.setVisible(playing);
    this.standBtn.setVisible(playing);

    const canDouble = playing && this.playerHand.length === 2 && this.chips >= this.bet;
    this.doubleBtn.setVisible(canDouble);

    this.nextHandBtn.setVisible(result);
  }

  // ── Display refresh ───────────────────────────────────────────────────────────

  private refreshDisplay(): void {
    this.renderCards();
    this.updateValues();
    this.updateHUD();
    this.updateResult();
  }

  private renderCards(): void {
    this.dealerCardObjs.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.playerCardObjs.forEach(o => (o as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.dealerCardObjs = [];
    this.playerCardObjs = [];

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const renderHand = (hand: Card[], baseY: number, hiddenIdx: number | null): Phaser.GameObjects.GameObject[] => {
      const objs: Phaser.GameObjects.GameObject[] = [];
      const startX = cx - ((hand.length - 1) * 46) / 2;
      for (let i = 0; i < hand.length; i++) {
        const x = startX + i * 46;
        const hidden = hiddenIdx === i;
        objs.push(...this.renderCard(x, baseY, hand[i], hidden));
      }
      return objs;
    };

    if (this.dealerHand.length > 0) {
      const hideIdx = this.dealerRevealed ? null : 1;
      this.dealerCardObjs = renderHand(this.dealerHand, cy - 88, hideIdx);
    }
    if (this.playerHand.length > 0) {
      this.playerCardObjs = renderHand(this.playerHand, cy + 70, null);
    }
  }

  private renderCard(x: number, y: number, card: Card, hidden: boolean): Phaser.GameObjects.GameObject[] {
    const W = 38, H = 54;

    const shadow = this.add.rectangle(x + 2, y + 2, W, H, 0x000000, 0.4).setDepth(15);
    const bg = this.add.rectangle(x, y, W, H, hidden ? 0x1a1a3e : 0xf5f0e8, 1)
      .setStrokeStyle(1.5, hidden ? 0x4444aa : 0xaaa090, 1).setDepth(16);

    if (hidden) {
      const pat = this.add.text(x, y, "🂠", {
        fontFamily: "monospace", fontSize: "28px", color: "#4444aa",
      }).setOrigin(0.5).setDepth(17);
      return [shadow, bg, pat];
    }

    const col = isRed(card) ? "#c0301a" : "#111111";
    const lbl = cardLabel(card);

    const tl = this.add.text(x - W / 2 + 3, y - H / 2 + 2, lbl, {
      fontFamily: "monospace", fontSize: "9px", color: col, fontStyle: "bold",
    }).setOrigin(0, 0).setDepth(17);

    const cs = this.add.text(x, y, lbl.slice(-1), {
      fontFamily: "monospace", fontSize: "22px", color: col,
    }).setOrigin(0.5).setDepth(17);

    const br = this.add.text(x + W / 2 - 3, y + H / 2 - 2, lbl, {
      fontFamily: "monospace", fontSize: "9px", color: col, fontStyle: "bold",
    }).setOrigin(1, 1).setDepth(17);

    return [shadow, bg, tl, cs, br];
  }

  private updateValues(): void {
    if (this.playerHand.length > 0) {
      const pv = handValue(this.playerHand);
      const bj = isBlackjack(this.playerHand);
      this.playerValueText.setText(bj ? "BLACKJACK!" : `${pv}`);
      this.playerValueText.setColor(pv > 21 ? "#ff4444" : bj ? "#ffd700" : "#f0e6d3");
    } else {
      this.playerValueText.setText("");
    }

    if (this.dealerHand.length > 0) {
      if (this.dealerRevealed) {
        const dv = handValue(this.dealerHand);
        this.dealerValueText.setText(`${dv}${dv > 21 ? " (BUST)" : ""}`);
        this.dealerValueText.setColor(dv > 21 ? "#ff4444" : "#f0e6d3");
      } else {
        const v1 = handValue([this.dealerHand[0]]);
        this.dealerValueText.setText(`${v1} + ?`);
        this.dealerValueText.setColor("#888888");
      }
    } else {
      this.dealerValueText.setText("");
    }
  }

  private updateHUD(): void {
    this.chipsText.setText(`◈ ${this.chips.toLocaleString()}`);
    this.betText.setText(
      this.phase === "betting"
        ? `Bet: ◈ ${this.bet}`
        : `Bet: ◈ ${this.bet}`
    );

    if (this.phase === "betting") {
      if (this.chips <= 0) {
        this.statusText.setText("Out of chips! Return to lobby.").setColor("#ff4444");
      } else {
        this.statusText.setText("Select your bet and press DEAL").setColor("#aaaaaa");
      }
    } else if (this.phase === "playing") {
      this.statusText.setText("Hit, Stand, or Double Down").setColor("#44ff88");
    } else if (this.phase === "dealer") {
      this.statusText.setText("Dealer's turn…").setColor("#ffaa44");
    } else {
      this.statusText.setText("Press NEXT HAND to continue").setColor("#c9a84c");
    }

    if (this.handsPlayed > 0) {
      this.statsText.setText(
        `Hands: ${this.handsPlayed}  ·  Wins: ${this.wins}  ·  Losses: ${this.losses}  ·  Pushes: ${this.pushes}`
      );
    } else {
      this.statsText.setText("ESC / ← to return to Lobby");
    }
  }

  private updateResult(): void {
    if (!this.result) { this.resultText.setAlpha(0); return; }

    const msgs: Record<NonNullable<Result>, [string, string]> = {
      blackjack: [`🎉 BLACKJACK! +${Math.floor(this.bet * 0.5)} bonus`, "#ffd700"],
      win:       ["✓ YOU WIN!", "#44ff88"],
      push:      ["PUSH — Tie", "#aaaaaa"],
      lose:      ["✗ Dealer Wins", "#ff4444"],
      bust:      ["✗ BUST!", "#ff4444"],
    };

    const [msg, col] = msgs[this.result];
    this.resultText.setText(msg).setColor(col).setAlpha(1);

    this.tweens.add({
      targets: this.resultText,
      scaleX: [1.3, 1],
      scaleY: [1.3, 1],
      duration: 300,
      ease: "Back.Out",
    });
  }

  // ── Button factory ────────────────────────────────────────────────────────────

  private makeBtn(
    x: number, y: number, w: number, h: number,
    label: string, color: number,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, color, 1)
      .setStrokeStyle(1, 0x446644, 0.8)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, label, {
      fontFamily: "monospace", fontSize: "11px", color: "#f0e6d3",
    }).setOrigin(0.5);

    bg.on("pointerover",  () => bg.setFillStyle(lighten(color)));
    bg.on("pointerout",   () => bg.setFillStyle(color));
    bg.on("pointerdown",  onClick);

    btn.add([bg, txt]);
    return btn;
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  private async returnToLobby(): Promise<void> {
    localStore.setChips(this.chips);
    networkManager.syncChipsFromStore();
    this.scene.start("CasinoLobbyScene");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lighten(hex: number): number {
  const r = Math.min(255, ((hex >> 16) & 0xff) + 40);
  const g = Math.min(255, ((hex >>  8) & 0xff) + 40);
  const b = Math.min(255, ( hex        & 0xff) + 40);
  return (r << 16) | (g << 8) | b;
}
