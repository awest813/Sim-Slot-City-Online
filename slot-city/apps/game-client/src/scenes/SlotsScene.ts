/**
 * SlotsScene — fully playable 3-reel slot machine.
 *
 * Works 100% offline (no server required). Uses localStore for chip persistence.
 * Ready to be backed by a server-authoritative SlotMachineRoom in a future phase.
 *
 * Layout: 3 reels × 3 visible rows. Middle row is the payline.
 * Symbols are weighted: commons appear more often, jackpot is rare.
 */

import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { localStore } from "../store/LocalStore";

// ─── Symbol table ──────────────────────────────────────────────────────────────

interface SlotSymbol {
  emoji: string;
  name: string;
  weight: number; // higher = more common on the strip
  payout3: number; // multiplier for 3-of-a-kind on payline
  payout2: number; // multiplier for 2-of-a-kind (0 = no 2x payout)
}

const SYMBOLS: SlotSymbol[] = [
  { emoji: "🍒", name: "cherry",  weight: 6, payout3: 5,   payout2: 2  },
  { emoji: "🍋", name: "lemon",   weight: 5, payout3: 8,   payout2: 0  },
  { emoji: "🍊", name: "orange",  weight: 5, payout3: 10,  payout2: 0  },
  { emoji: "🔔", name: "bell",    weight: 3, payout3: 15,  payout2: 0  },
  { emoji: "⭐", name: "star",    weight: 2, payout3: 25,  payout2: 3  },
  { emoji: "💎", name: "gem",     weight: 2, payout3: 40,  payout2: 5  },
  { emoji: "🎰", name: "jackpot", weight: 1, payout3: 100, payout2: 10 },
];

// ─── Reel strip builder ────────────────────────────────────────────────────────

/** Build a weighted reel strip and shuffle it. Each reel gets its own strip. */
function buildReelStrip(): number[] {
  const strip: number[] = [];
  SYMBOLS.forEach((sym, idx) => {
    for (let i = 0; i < sym.weight; i++) strip.push(idx);
  });
  // Simple Fisher-Yates shuffle
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  return strip;
}

// ─── Bet options ───────────────────────────────────────────────────────────────

const BET_OPTIONS = [10, 25, 50, 100];
const DEFAULT_BET = 25;

// ─── Layout constants ──────────────────────────────────────────────────────────

const REEL_COUNT = 3;
const ROW_COUNT = 3;
const PAYLINE_ROW = 1; // middle row

export class SlotsScene extends Phaser.Scene {
  // Game state
  private chips = 0;
  private bet = DEFAULT_BET;
  private spinning = false;
  private sessionStart = 0;   // chips at scene start
  private spinsThisSession = 0;
  private winsThisSession  = 0;

  // Reel data
  private strips: number[][] = [];
  private reelState: number[][] = [[], [], []]; // [reel][row] = symIdx
  private reelTexts: Phaser.GameObjects.Text[][] = [];
  private spinTimers: Phaser.Time.TimerEvent[] = [];

  // UI objects
  private chipsText!: Phaser.GameObjects.Text;
  private sessionText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private spinBtn!: Phaser.GameObjects.Text;
  private betButtons: Phaser.GameObjects.Text[] = [];
  private topUpBtn!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: "SlotsScene" });
  }

  create(): void {
    // Load chips from guest store (or server user if applicable)
    const user = networkManager.getUser();
    if (user && !networkManager.isGuestMode()) {
      this.chips = user.chips;
    } else {
      networkManager.syncChipsFromStore();
      this.chips = localStore.load().chips;
    }
    this.sessionStart = this.chips;

    this.strips = Array.from({ length: REEL_COUNT }, () => buildReelStrip());

    // Initialise reel state randomly
    this.reelState = Array.from({ length: REEL_COUNT }, () =>
      Array.from({ length: ROW_COUNT }, () => Math.floor(Math.random() * SYMBOLS.length)),
    );

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x08001a);
    this.drawBackground(width, height);
    this.drawCabinet(width / 2, height / 2 - 10);
    this.createHUD(width, height);
    this.buildTopUpButton(width / 2, height / 2 + 220);

    // Keyboard shortcuts
    this.input.keyboard?.on("keydown-SPACE", () => this.spinReels());
    this.input.keyboard?.on("keydown-ENTER", () => this.spinReels());
    this.input.keyboard?.on("keydown-ESC",   () => this.returnToLobby());

    this.updateTopUpVisibility();
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const g = this.add.graphics();
    // Subtle neon grid
    g.lineStyle(1, 0x1a0033, 0.5);
    for (let x = 0; x < w; x += 48) g.lineBetween(x, 0, x, h);
    for (let y = 0; y < h; y += 48) g.lineBetween(0, y, w, y);
  }

  // ─── Cabinet ────────────────────────────────────────────────────────────────

  private drawCabinet(cx: number, cy: number): void {
    const CW = 640, CH = 490;
    const mx = cx - CW / 2, my = cy - CH / 2;

    const g = this.add.graphics();

    // Drop shadow
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(mx + 10, my + 10, CW, CH, 20);

    // Cabinet body
    g.fillStyle(0x1a0033, 1);
    g.fillRoundedRect(mx, my, CW, CH, 20);
    g.lineStyle(3, 0xaa00ff, 1);
    g.strokeRoundedRect(mx, my, CW, CH, 20);

    // Inner accent border
    g.lineStyle(1, 0xff00ff, 0.3);
    g.strokeRoundedRect(mx + 8, my + 8, CW - 16, CH - 16, 14);

    // Title strip
    g.fillStyle(0x2d0055, 1);
    g.fillRoundedRect(mx + 20, my + 16, CW - 40, 52, 8);
    g.lineStyle(2, 0xcc00ff, 0.8);
    g.strokeRoundedRect(mx + 20, my + 16, CW - 40, 52, 8);

    this.add.text(cx, my + 43, "🎰  SLOT CITY  SLOTS  🎰", {
      fontSize: "22px",
      color: "#ffd700",
      stroke: "#7700aa",
      strokeThickness: 3,
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Reel window
    const RWW = 460, RWH = 240;
    const rwx = cx - RWW / 2, rwy = my + 86;

    g.fillStyle(0x000000, 1);
    g.fillRoundedRect(rwx, rwy, RWW, RWH, 10);
    g.lineStyle(3, 0x6600bb, 1);
    g.strokeRoundedRect(rwx, rwy, RWW, RWH, 10);

    // Reel separators
    const reelW = RWW / REEL_COUNT;
    for (let r = 1; r < REEL_COUNT; r++) {
      g.lineStyle(1, 0x330055, 0.9);
      g.lineBetween(rwx + r * reelW, rwy + 4, rwx + r * reelW, rwy + RWH - 4);
    }

    // Payline indicators
    const plyY = rwy + RWH / 2;
    g.lineStyle(2, 0xff4444, 0.85);
    g.lineBetween(rwx - 14, plyY, rwx + RWW + 14, plyY);
    this.add.text(rwx - 16, plyY, "►", { fontSize: "11px", color: "#ff4444", fontFamily: "monospace" }).setOrigin(1, 0.5);
    this.add.text(rwx + RWW + 16, plyY, "◄", { fontSize: "11px", color: "#ff4444", fontFamily: "monospace" }).setOrigin(0, 0.5);

    // Draw reels
    this.drawReels(cx, rwy, RWW, RWH);

    // Controls area below reel window
    const ctrlY = rwy + RWH + 14;
    this.drawBetPanel(cx, ctrlY);
    this.drawSpinButton(cx, ctrlY + 50);
    this.drawPaytable(cx, ctrlY + 108);

    // Result text (overlaps reel window top edge)
    this.resultText = this.add.text(cx, rwy - 18, "", {
      fontSize: "18px",
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 3,
      fontFamily: "monospace",
    }).setOrigin(0.5, 1).setDepth(20);
  }

  // ─── Reels ───────────────────────────────────────────────────────────────────

  private drawReels(cx: number, rwY: number, rwW: number, rwH: number): void {
    const reelW = rwW / REEL_COUNT;
    const rowH  = rwH / ROW_COUNT;

    this.reelTexts = [];

    for (let r = 0; r < REEL_COUNT; r++) {
      const rx = cx - rwW / 2 + r * reelW + reelW / 2;
      const rowTexts: Phaser.GameObjects.Text[] = [];

      for (let row = 0; row < ROW_COUNT; row++) {
        const ry = rwY + row * rowH + rowH / 2;
        const symIdx = this.reelState[r][row];

        const txt = this.add.text(rx, ry, SYMBOLS[symIdx].emoji, {
          fontSize: "44px",
          fontFamily: "Arial, sans-serif",
        }).setOrigin(0.5).setDepth(10);

        // Dim non-payline rows
        if (row !== PAYLINE_ROW) txt.setAlpha(0.35);

        rowTexts.push(txt);
      }
      this.reelTexts.push(rowTexts);
    }
  }

  // ─── Bet panel ───────────────────────────────────────────────────────────────

  private drawBetPanel(cx: number, y: number): void {
    this.add.text(cx - 200, y + 16, "BET:", {
      fontSize: "13px",
      color: "#888888",
      fontFamily: "monospace",
    }).setOrigin(1, 0.5);

    this.betButtons = BET_OPTIONS.map((b, i) => {
      const bx = cx - 120 + i * 74;
      const isSelected = b === this.bet;

      const btn = this.add.text(bx, y + 16, `[${b}]`, {
        fontSize: "14px",
        color: isSelected ? "#ffd700" : "#555577",
        fontFamily: "monospace",
      }).setOrigin(0.5).setInteractive({ cursor: "pointer" });

      btn.on("pointerover", () => { if (b !== this.bet) btn.setColor("#9988cc"); });
      btn.on("pointerout",  () => { btn.setColor(b === this.bet ? "#ffd700" : "#555577"); });
      btn.on("pointerdown", () => {
        this.bet = b;
        this.betButtons.forEach((bb, bi) => bb.setColor(BET_OPTIONS[bi] === b ? "#ffd700" : "#555577"));
      });

      return btn;
    });
  }

  // ─── Spin button ─────────────────────────────────────────────────────────────

  private drawSpinButton(cx: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x660000, 1);
    g.fillRoundedRect(cx - 90, y, 180, 46, 12);
    g.lineStyle(3, 0xff4444, 1);
    g.strokeRoundedRect(cx - 90, y, 180, 46, 12);

    this.spinBtn = this.add.text(cx, y + 23, "SPIN  [ Space / Enter ]", {
      fontSize: "15px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" }).setDepth(5);

    this.spinBtn.on("pointerover", () => { if (!this.spinning) this.spinBtn.setColor("#ffd700"); });
    this.spinBtn.on("pointerout",  () => this.spinBtn.setColor("#ffffff"));
    this.spinBtn.on("pointerdown", () => this.spinReels());
  }

  // ─── Paytable ─────────────────────────────────────────────────────────────────

  private drawPaytable(cx: number, y: number): void {
    const entries = SYMBOLS.map(s => `${s.emoji}×3=${s.payout3}x`).join("  ");
    this.add.text(cx, y, entries, {
      fontSize: "11px",
      color: "#8855aa",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(cx, y + 16, "🍒×2=2x  ⭐×2=3x  💎×2=5x  🎰×2=10x  |  payline = middle row", {
      fontSize: "10px",
      color: "#554466",
      fontFamily: "monospace",
    }).setOrigin(0.5);
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  private createHUD(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.7);
    g.fillRect(0, 0, width, 36);
    g.setDepth(500);

    this.chipsText = this.add.text(16, 10, `💰 ${this.chips.toLocaleString()} chips`, {
      fontSize: "14px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    this.add.text(width / 2, 10, "🎰 SLOT CITY SLOTS", {
      fontSize: "14px",
      color: "#cc00ff",
      fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    this.add.text(width - 16, 10, "[ Lobby ]  Esc", {
      fontSize: "12px",
      color: "#4488ff",
      fontFamily: "monospace",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(501)
      .setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());

    // Session P&L (bottom-right corner)
    this.sessionText = this.add.text(width - 16, height - 12, "", {
      fontSize: "10px",
      color: "#555577",
      fontFamily: "monospace",
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(501);
    this.updateSessionText();
  }

  // ─── Top-up button (shown when chips < min bet) ──────────────────────────────

  private buildTopUpButton(cx: number, y: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x002200, 0.9);
    bg.fillRoundedRect(-130, -18, 260, 36, 8);
    bg.lineStyle(2, 0x44ff44, 0.8);
    bg.strokeRoundedRect(-130, -18, 260, 36, 8);

    const lbl = this.add.text(0, 0, "💸 Add 1,000 Chips  [ T ]", {
      fontSize: "13px", color: "#44ff88", fontFamily: "monospace",
    }).setOrigin(0.5);

    const zone = this.add.zone(0, 0, 260, 36).setInteractive({ cursor: "pointer" });
    zone.on("pointerdown", () => this.doTopUp());

    this.topUpBtn = this.add.container(cx, y, [bg, lbl, zone]);
    this.topUpBtn.setScrollFactor(0).setDepth(510);

    this.input.keyboard?.on("keydown-T", () => this.doTopUp());
  }

  private doTopUp(): void {
    const ADD = 1000;
    this.chips += ADD;
    localStore.adjustChips(ADD);
    this.updateChipsDisplay();
    this.updateTopUpVisibility();
    this.showResult(`+${ADD.toLocaleString()} chips added!`, true);
    this.time.delayedCall(1500, () => {
      if (this.resultText.text === `+${ADD.toLocaleString()} chips added!`) {
        this.resultText.setText("");
      }
    });
  }

  private updateTopUpVisibility(): void {
    if (!this.topUpBtn) return;
    this.topUpBtn.setVisible(this.chips < BET_OPTIONS[0]);
  }

  private updateSessionText(): void {
    if (!this.sessionText) return;
    const pnl = this.chips - this.sessionStart;
    const sign = pnl >= 0 ? "+" : "";
    const col = pnl >= 0 ? "#44aa44" : "#aa4444";
    this.sessionText.setText(
      `Session: ${this.spinsThisSession} spins | ${this.winsThisSession} wins | P&L: ${sign}${pnl.toLocaleString()}`
    ).setColor(col);
  }

  // ─── Spin logic ──────────────────────────────────────────────────────────────

  private spinReels(): void {
    if (this.spinning) return;

    if (this.chips < this.bet) {
      this.showResult("Not enough chips! Press T to top up.", false);
      this.chipsText.setColor("#ff4444");
      this.time.delayedCall(800, () => this.chipsText.setColor("#ffd700"));
      this.updateTopUpVisibility();
      return;
    }

    // Deduct bet
    this.chips -= this.bet;
    this.spinsThisSession++;
    this.updateChipsDisplay();
    localStore.adjustChips(-this.bet);
    this.updateTopUpVisibility();

    this.spinning = true;
    this.spinBtn.setAlpha(0.5);
    this.resultText.setText("");

    // Determine final payline symbols (one per reel)
    const paylineSymbols: number[] = this.strips.map(strip =>
      strip[Math.floor(Math.random() * strip.length)],
    );

    // Build full 3-row final state per reel (payline = middle row)
    const finalRows: number[][] = paylineSymbols.map((mid, r) => [
      this.strips[r][Math.floor(Math.random() * this.strips[r].length)],
      mid,
      this.strips[r][Math.floor(Math.random() * this.strips[r].length)],
    ]);

    const STOP_DELAYS = [900, 1400, 1900]; // ms; staggered reel stop

    // Clean up any lingering timers from a previous spin
    this.spinTimers.forEach(t => t.remove());
    this.spinTimers = [];

    for (let r = 0; r < REEL_COUNT; r++) {
      // Rapid symbol cycling during spin
      const timer = this.time.addEvent({
        delay: 80,
        loop: true,
        callback: () => {
          for (let row = 0; row < ROW_COUNT; row++) {
            const idx = this.strips[r][Math.floor(Math.random() * this.strips[r].length)];
            this.reelTexts[r][row].setText(SYMBOLS[idx].emoji);
          }
        },
      });
      this.spinTimers.push(timer);

      // Stop this reel after its delay
      this.time.delayedCall(STOP_DELAYS[r], () => {
        timer.remove();
        for (let row = 0; row < ROW_COUNT; row++) {
          const sym = finalRows[r][row];
          this.reelState[r][row] = sym;
          this.reelTexts[r][row].setText(SYMBOLS[sym].emoji);
          this.reelTexts[r][row].setAlpha(row === PAYLINE_ROW ? 1 : 0.35);
        }

        if (r === REEL_COUNT - 1) {
          this.spinning = false;
          this.spinBtn.setAlpha(1);
          this.resolveWin(paylineSymbols);
        }
      });
    }
  }

  // ─── Win resolution ──────────────────────────────────────────────────────────

  private resolveWin(payline: number[]): void {
    const [a, b, c] = payline;
    let winAmount = 0;
    let msg = "";

    if (a === b && b === c) {
      // Three of a kind
      winAmount = this.bet * SYMBOLS[a].payout3;
      msg = `🎉 THREE ${SYMBOLS[a].emoji}! +${winAmount.toLocaleString()} chips`;
    } else if (a === b) {
      const p = SYMBOLS[a].payout2;
      if (p > 0) {
        winAmount = this.bet * p;
        msg = `✨ Two ${SYMBOLS[a].emoji}! +${winAmount.toLocaleString()} chips`;
      } else {
        msg = "No win — try again!";
      }
    } else if (b === c) {
      const p = SYMBOLS[b].payout2;
      if (p > 0) {
        winAmount = this.bet * p;
        msg = `✨ Two ${SYMBOLS[b].emoji}! +${winAmount.toLocaleString()} chips`;
      } else {
        msg = "No win — try again!";
      }
    } else {
      msg = "No win — try again!";
    }

    if (winAmount > 0) {
      this.winsThisSession++;
      this.chips += winAmount;
      this.updateChipsDisplay();
      localStore.adjustChips(winAmount);
      this.flashWin(SYMBOLS[payline[1]].name === "jackpot");
    }

    this.updateTopUpVisibility();
    this.updateSessionText();
    this.showResult(msg, winAmount > 0);
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────────

  private updateChipsDisplay(): void {
    this.chipsText.setText(`💰 ${this.chips.toLocaleString()} chips`);
  }

  private showResult(msg: string, isWin: boolean): void {
    this.resultText
      .setText(msg)
      .setColor(isWin ? "#ffd700" : "#888888");
  }

  private flashWin(isJackpot: boolean): void {
    if (isJackpot) {
      this.cameras.main.flash(800, 255, 215, 0);
      this.cameras.main.shake(400, 0.015);
    } else {
      this.cameras.main.flash(400, 255, 215, 0);
      this.cameras.main.shake(200, 0.008);
    }
  }

  private returnToLobby(): void {
    // Sync chips back into network manager user so the lobby HUD shows fresh balance
    networkManager.syncChipsFromStore();
    const user = networkManager.getUser();
    if (user) user.chips = localStore.load().chips;

    this.scene.start("CasinoLobbyScene");
  }
}
