/**
 * PlinkoScene — fully playable Plinko minigame.
 *
 * Works 100% offline (no server required). Uses localStore for chip persistence.
 * Ball drops from the top, bounces off a triangular peg grid, and lands in a
 * multiplier slot at the bottom.
 *
 * Layout: 8 peg rows expanding from 3 pegs to 10; 11 multiplier slots at the bottom.
 * Multipliers: [0.2, 0.5, 1, 2, 5, 10, 5, 2, 1, 0.5, 0.2] (center = jackpot)
 */

import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { localStore } from "../store/LocalStore";

// ─── Board constants ──────────────────────────────────────────────────────────

const BOARD_ROWS   = 8;
const SLOT_MULTS   = [0.2, 0.5, 1, 2, 5, 10, 5, 2, 1, 0.5, 0.2];
const SLOT_COUNT   = SLOT_MULTS.length;
const BET_OPTIONS  = [10, 25, 50, 100];
const DEFAULT_BET  = 25;

// Board visual dimensions (relative to center)
const BOARD_W      = 520;
const BOARD_H      = 280;
const PEG_RADIUS   = 5;
const BALL_RADIUS  = 8;
const SLOT_H       = 30;

// Color per multiplier value
function slotColor(mult: number): string {
  if (mult >= 10) return "#ffd700";
  if (mult >= 5)  return "#f5a020";
  if (mult >= 2)  return "#2ecc71";
  if (mult >= 1)  return "#3a90e0";
  return "#445566";
}

function slotColorInt(mult: number): number {
  if (mult >= 10) return 0xffd700;
  if (mult >= 5)  return 0xf5a020;
  if (mult >= 2)  return 0x2ecc71;
  if (mult >= 1)  return 0x3a90e0;
  return 0x445566;
}

// ─── Peg position ─────────────────────────────────────────────────────────────

interface Peg { x: number; y: number; }

export class PlinkoScene extends Phaser.Scene {
  // Chip balance
  private chips = 0;
  private bet    = DEFAULT_BET;
  private dropping = false;
  private sessionStart = 0;
  private dropsThisSession = 0;
  private winsThisSession  = 0;

  // Peg layout
  private pegs: Peg[] = [];

  // Board screen coordinates
  private boardCX = 0;
  private boardCY = 0;
  private boardTop = 0;
  private boardBottom = 0;
  private boardLeft = 0;
  private boardRight = 0;

  // Dynamic objects
  private ballGfx!: Phaser.GameObjects.Graphics;
  private slotHighlightGfx!: Phaser.GameObjects.Graphics;
  private chipsText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private sessionText!: Phaser.GameObjects.Text;
  private dropBtn!: Phaser.GameObjects.Text;
  private betButtons: Phaser.GameObjects.Text[] = [];
  private topUpBtn!: Phaser.GameObjects.Container;

  // Ball animation
  private ballX = 0;
  private ballY = 0;
  private ballPath: Array<{ x: number; y: number }> & { _finalSlot?: number } = [];
  private pathIdx  = 0;
  private dropTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super({ key: "PlinkoScene" });
  }

  create(): void {
    const user = networkManager.getUser();
    if (user && !networkManager.isGuestMode()) {
      this.chips = user.chips;
    } else {
      networkManager.syncChipsFromStore();
      this.chips = localStore.load().chips;
    }
    this.sessionStart = this.chips;

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x04100c);

    this.drawBackground(width, height);
    this.computeBoardCoords(width, height);
    this.buildPegs();
    this.drawStaticBoard(width, height);
    this.createHUD(width, height);
    this.buildTopUpButton(width / 2, height / 2 + 290);

    // Dynamic graphics layers
    this.slotHighlightGfx = this.add.graphics().setDepth(15);
    this.ballGfx = this.add.graphics().setDepth(20);

    // Keyboard shortcuts
    this.input.keyboard?.on("keydown-SPACE", () => this.startDrop());
    this.input.keyboard?.on("keydown-ENTER", () => this.startDrop());
    this.input.keyboard?.on("keydown-ESC",   () => this.returnToLobby());

    this.updateTopUpVisibility();
  }

  // ─── Coordinate setup ────────────────────────────────────────────────────────

  private computeBoardCoords(w: number, h: number): void {
    this.boardCX    = w / 2;
    this.boardCY    = h / 2 - 20;
    this.boardLeft  = this.boardCX - BOARD_W / 2;
    this.boardRight = this.boardCX + BOARD_W / 2;
    this.boardTop   = this.boardCY - BOARD_H / 2;
    this.boardBottom = this.boardCY + BOARD_H / 2;
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0x082018, 0.6);
    for (let x = 0; x < w; x += 48) g.lineBetween(x, 0, x, h);
    for (let y = 0; y < h; y += 48) g.lineBetween(0, y, w, y);
  }

  // ─── Peg grid ────────────────────────────────────────────────────────────────

  private buildPegs(): void {
    this.pegs = [];
    const pegAreaH = BOARD_H - SLOT_H;
    const spacing  = BOARD_W / SLOT_COUNT;

    for (let row = 0; row < BOARD_ROWS; row++) {
      const pegsInRow = row + 3;
      const offset = (SLOT_COUNT - pegsInRow) / 2;

      for (let col = 0; col < pegsInRow; col++) {
        const px = this.boardLeft + (offset + col + 0.5) * spacing;
        const py = this.boardTop + 22 + row * (pegAreaH / BOARD_ROWS);
        this.pegs.push({ x: px, y: py });
      }
    }
  }

  // ─── Static board drawing ─────────────────────────────────────────────────────

  private drawStaticBoard(w: number, h: number): void {
    const cx = w / 2;
    const my = this.boardTop - 54;
    const g  = this.add.graphics();

    // Cabinet shadow
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(cx - BOARD_W / 2 + 12, my + 12, BOARD_W + 40, BOARD_H + 120, 18);

    // Cabinet body
    g.fillStyle(0x071a10, 1);
    g.fillRoundedRect(cx - BOARD_W / 2 - 10, my, BOARD_W + 20, BOARD_H + 110, 18);
    g.lineStyle(3, 0x20d4a0, 1);
    g.strokeRoundedRect(cx - BOARD_W / 2 - 10, my, BOARD_W + 20, BOARD_H + 110, 18);

    // Inner accent border
    g.lineStyle(1, 0x20d4a0, 0.2);
    g.strokeRoundedRect(cx - BOARD_W / 2 - 2, my + 8, BOARD_W + 4, BOARD_H + 94, 12);

    // Title strip
    g.fillStyle(0x0c2a1e, 1);
    g.fillRoundedRect(cx - BOARD_W / 2 + 10, my + 16, BOARD_W - 20, 52, 8);
    g.lineStyle(2, 0x20d4a0, 0.7);
    g.strokeRoundedRect(cx - BOARD_W / 2 + 10, my + 16, BOARD_W - 20, 52, 8);

    this.add.text(cx, my + 43, "🎯  PLINKO", {
      fontSize: "24px",
      color: "#20d4a0",
      stroke: "#004030",
      strokeThickness: 3,
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Board area background
    g.fillStyle(0x000000, 0.85);
    g.fillRoundedRect(this.boardLeft, this.boardTop, BOARD_W, BOARD_H, 8);
    g.lineStyle(2, 0x20d4a0, 0.7);
    g.strokeRoundedRect(this.boardLeft, this.boardTop, BOARD_W, BOARD_H, 8);

    // Drop-zone indicator (top center arrow)
    g.fillStyle(0x20d4a0, 0.8);
    g.fillTriangle(cx, this.boardTop + 8, cx - 10, this.boardTop - 4, cx + 10, this.boardTop - 4);

    // Draw pegs
    for (const peg of this.pegs) {
      g.fillStyle(0x20d4a0, 0.9);
      g.fillCircle(peg.x, peg.y, PEG_RADIUS);
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(peg.x - 1, peg.y - 1, 2);
    }

    // Slot bins
    const slotW = BOARD_W / SLOT_COUNT;
    const slotY = this.boardBottom - SLOT_H;

    for (let i = 0; i < SLOT_COUNT; i++) {
      const sx   = this.boardLeft + i * slotW;
      const mult = SLOT_MULTS[i];
      const col  = slotColorInt(mult);

      g.fillStyle(col, 0.18);
      g.fillRect(sx + 1, slotY + 1, slotW - 2, SLOT_H - 2);
      g.lineStyle(1, col, 0.6);
      g.strokeRect(sx + 1, slotY + 1, slotW - 2, SLOT_H - 2);

      const labelStr = mult >= 1 ? `${mult}×` : `${mult}×`;
      this.add.text(sx + slotW / 2, slotY + SLOT_H / 2, labelStr, {
        fontSize: mult >= 5 ? "11px" : "10px",
        color: slotColor(mult),
        fontFamily: "monospace",
        fontStyle: mult >= 5 ? "bold" : "normal",
      }).setOrigin(0.5).setDepth(5);
    }

    // Controls area
    this.drawBetPanel(cx, this.boardBottom + 20);
    this.drawDropButton(cx, this.boardBottom + 68);

    // Paytable hint
    this.add.text(cx, this.boardBottom + 118, "Center = 10×  |  One off = 5×  |  Two off = 2×  |  Edges = 0.2×", {
      fontSize: "11px", color: "#336655", fontFamily: "monospace",
    }).setOrigin(0.5);
  }

  // ─── Bet panel ───────────────────────────────────────────────────────────────

  private drawBetPanel(cx: number, y: number): void {
    this.add.text(cx - 220, y + 16, "BET:", {
      fontSize: "13px", color: "#446655", fontFamily: "monospace",
    }).setOrigin(1, 0.5);

    this.betButtons = BET_OPTIONS.map((b, i) => {
      const bx = cx - 140 + i * 88;
      const isSelected = b === this.bet;

      const btn = this.add.text(bx, y + 16, `[${b}]`, {
        fontSize: "14px",
        color: isSelected ? "#20d4a0" : "#2a5544",
        fontFamily: "monospace",
      }).setOrigin(0.5).setInteractive({ cursor: "pointer" });

      btn.on("pointerover", () => { if (b !== this.bet) btn.setColor("#40c090"); });
      btn.on("pointerout",  () => { btn.setColor(b === this.bet ? "#20d4a0" : "#2a5544"); });
      btn.on("pointerdown", () => {
        this.bet = b;
        this.betButtons.forEach((bb, bi) =>
          bb.setColor(BET_OPTIONS[bi] === b ? "#20d4a0" : "#2a5544"),
        );
      });

      return btn;
    });
  }

  // ─── Drop button ─────────────────────────────────────────────────────────────

  private drawDropButton(cx: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x0a2a1e, 1);
    g.fillRoundedRect(cx - 100, y, 200, 46, 12);
    g.lineStyle(3, 0x20d4a0, 1);
    g.strokeRoundedRect(cx - 100, y, 200, 46, 12);

    this.dropBtn = this.add.text(cx, y + 23, "DROP  [ Space / Enter ]", {
      fontSize: "15px",
      color: "#20d4a0",
      stroke: "#000000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" }).setDepth(5);

    this.dropBtn.on("pointerover", () => { if (!this.dropping) this.dropBtn.setColor("#60ffcc"); });
    this.dropBtn.on("pointerout",  () => this.dropBtn.setColor("#20d4a0"));
    this.dropBtn.on("pointerdown", () => this.startDrop());
  }

  // ─── HUD ─────────────────────────────────────────────────────────────────────

  private createHUD(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.75);
    g.fillRect(0, 0, width, 36);
    g.setDepth(500);

    this.chipsText = this.add.text(16, 10, `💰 ${this.chips.toLocaleString()} chips`, {
      fontSize: "14px", color: "#20d4a0", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    this.add.text(width / 2, 10, "🎯 PLINKO", {
      fontSize: "14px", color: "#20d4a0", fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    this.add.text(width - 16, 10, "[ Lobby ]  Esc", {
      fontSize: "12px", color: "#4488ff", fontFamily: "monospace",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(501)
      .setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());

    // Result text (above board)
    this.resultText = this.add.text(
      width / 2, this.boardTop - 22, "", {
        fontSize: "18px",
        color: "#20d4a0",
        stroke: "#000000",
        strokeThickness: 3,
        fontFamily: "monospace",
      },
    ).setOrigin(0.5, 1).setDepth(20);

    // Session stats (bottom-right)
    this.sessionText = this.add.text(width - 16, height - 12, "", {
      fontSize: "10px", color: "#335544", fontFamily: "monospace",
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(501);
    this.updateSessionText();
  }

  // ─── Top-up button ───────────────────────────────────────────────────────────

  private buildTopUpButton(cx: number, y: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x001a0e, 0.9);
    bg.fillRoundedRect(-130, -18, 260, 36, 8);
    bg.lineStyle(2, 0x20d4a0, 0.8);
    bg.strokeRoundedRect(-130, -18, 260, 36, 8);

    const lbl = this.add.text(0, 0, "💸 Add 1,000 Chips  [ T ]", {
      fontSize: "13px", color: "#20d4a0", fontFamily: "monospace",
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

  // ─── Drop logic ───────────────────────────────────────────────────────────────

  private startDrop(): void {
    if (this.dropping) return;

    if (this.chips < this.bet) {
      this.showResult("Not enough chips! Press T to top up.", false);
      this.chipsText.setColor("#ff4444");
      this.time.delayedCall(800, () => this.chipsText.setColor("#20d4a0"));
      this.updateTopUpVisibility();
      return;
    }

    // Deduct bet
    this.chips -= this.bet;
    this.dropsThisSession++;
    this.updateChipsDisplay();
    localStore.adjustChips(-this.bet);
    this.updateTopUpVisibility();

    this.dropping = true;
    this.dropBtn.setAlpha(0.5);
    this.resultText.setText("");
    this.slotHighlightGfx.clear();

    // Compute ball path
    this.ballPath = this.computeBallPath();
    this.pathIdx   = 0;

    // Start ball at top center
    this.ballX = this.boardCX;
    this.ballY = this.boardTop - 12;
    this.drawBall(this.ballX, this.ballY);

    this.animateBallStep();
  }

  private computeBallPath(): Array<{ x: number; y: number }> & { _finalSlot?: number } {
    const path: Array<{ x: number; y: number }> & { _finalSlot?: number } = [];
    const spacing  = BOARD_W / SLOT_COUNT;
    const pegAreaH = BOARD_H - SLOT_H;

    path.push({ x: this.boardCX, y: this.boardTop - 12 });
    path.push({ x: this.boardCX, y: this.boardTop + 10 });

    let colPos = (SLOT_COUNT - 1) / 2;   // center column (5.0 for 11 slots)

    for (let row = 0; row < BOARD_ROWS; row++) {
      const deflect = Math.random() < 0.5 ? -0.5 : 0.5;
      colPos = Phaser.Math.Clamp(colPos + deflect, 0, SLOT_COUNT - 1);

      const py = this.boardTop + 22 + row * (pegAreaH / BOARD_ROWS);
      const px = this.boardLeft + (colPos + 0.5) * spacing;

      path.push({ x: px, y: py - BALL_RADIUS - 1 });
      path.push({ x: px, y: py + BALL_RADIUS + 3 });
    }

    const finalSlot = Phaser.Math.Clamp(Math.round(colPos), 0, SLOT_COUNT - 1);
    const finalX    = this.boardLeft + (finalSlot + 0.5) * spacing;
    const finalY    = this.boardBottom - SLOT_H / 2;

    path.push({ x: finalX, y: finalY - 10 });
    path.push({ x: finalX, y: finalY });
    path._finalSlot = finalSlot;

    return path;
  }

  private animateBallStep(): void {
    if (this.pathIdx >= this.ballPath.length - 1) {
      this.onBallLanded(this.ballPath._finalSlot ?? Math.floor(SLOT_COUNT / 2));
      return;
    }

    const from = this.ballPath[this.pathIdx];
    const to   = this.ballPath[this.pathIdx + 1];
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const dur  = Math.max(55, dist * 4.2);

    this.dropTween = this.tweens.add({
      targets: { t: 0 },
      t: 1,
      duration: dur,
      ease: this.pathIdx === 0 ? "Sine.easeIn" : "Bounce.easeOut",
      onUpdate: (tween) => {
        const t = (tween.targets[0] as { t: number }).t;
        this.ballX = Phaser.Math.Linear(from.x, to.x, t);
        this.ballY = Phaser.Math.Linear(from.y, to.y, t);
        const squish = this.ballY > from.y ? 1 + (1 - t) * 0.18 : 1;
        this.drawBall(this.ballX, this.ballY, squish);
      },
      onComplete: () => {
        this.pathIdx++;
        this.animateBallStep();
      },
    });
  }

  private onBallLanded(slotIdx: number): void {
    const mult   = SLOT_MULTS[slotIdx];
    const payout = Math.round(this.bet * mult);

    this.highlightSlot(slotIdx);

    // Bounce in slot
    this.tweens.add({
      targets: { t: 0 }, t: 1, duration: 240, ease: "Bounce.easeOut",
      onUpdate: (tw) => {
        const t = (tw.targets[0] as { t: number }).t;
        this.drawBall(this.ballX, this.ballY - Math.sin(t * Math.PI) * 10, 1 + (1 - t) * 0.25);
      },
    });

    if (payout > 0) {
      this.winsThisSession++;
      this.chips += payout;
      this.updateChipsDisplay();
      localStore.adjustChips(payout);
    }

    const isJackpot = mult >= 10;
    const msg = isJackpot
      ? `🎉 JACKPOT! ${mult}× = +${payout.toLocaleString()} chips!`
      : mult >= 2
        ? `${mult}× hit! +${payout.toLocaleString()} chips`
        : mult >= 1
          ? `${mult}× push — +${payout.toLocaleString()} chips`
          : `${mult}× — house wins this round`;

    this.showResult(msg, payout > 0);
    this.updateTopUpVisibility();
    this.updateSessionText();

    if (isJackpot) {
      this.cameras.main.flash(800, 32, 212, 160);
      this.cameras.main.shake(400, 0.012);
    } else if (mult >= 2) {
      this.cameras.main.flash(300, 32, 212, 160);
    }

    this.time.delayedCall(600, () => {
      this.dropping = false;
      this.dropBtn.setAlpha(1);
    });
  }

  // ─── Draw helpers ─────────────────────────────────────────────────────────────

  private drawBall(x: number, y: number, squish = 1): void {
    const g  = this.ballGfx;
    const r  = BALL_RADIUS;
    const rx = r * squish;
    const ry = r / squish;
    g.clear();

    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x + 2, y + ry + 2, rx * 2, ry * 1.2);

    // Glow
    g.fillStyle(0x20d4a0, 0.2);
    g.fillEllipse(x, y, (rx + 4) * 2, (ry + 4) * 2);

    // Body
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(x, y, rx * 2, ry * 2);

    // Tint
    g.fillStyle(0x20d4a0, 0.65);
    g.fillEllipse(x + 1, y + 1, rx * 1.4, ry * 1.4);

    // Highlight
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(x - rx * 0.3, y - ry * 0.35, rx * 0.6, ry * 0.5);
  }

  private highlightSlot(slotIdx: number): void {
    const g    = this.slotHighlightGfx;
    const slotW = BOARD_W / SLOT_COUNT;
    const slotY = this.boardBottom - SLOT_H;
    const sx    = this.boardLeft + slotIdx * slotW;
    const col   = slotColorInt(SLOT_MULTS[slotIdx]);

    g.clear();
    g.lineStyle(2.5, col, 1);
    g.strokeRect(sx + 1, slotY + 1, slotW - 2, SLOT_H - 2);
    g.fillStyle(col, 0.4);
    g.fillRect(sx + 1, slotY + 1, slotW - 2, SLOT_H - 2);

    // Glow column lines above slot
    g.lineStyle(1, col, 0.45);
    g.lineBetween(sx + slotW / 2, slotY - 24, sx + slotW / 2, slotY);
    g.lineStyle(1, col, 0.2);
    g.lineBetween(sx + slotW / 2 - 5, slotY - 16, sx + slotW / 2 - 5, slotY);
    g.lineBetween(sx + slotW / 2 + 5, slotY - 16, sx + slotW / 2 + 5, slotY);
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────────

  private updateChipsDisplay(): void {
    this.chipsText.setText(`💰 ${this.chips.toLocaleString()} chips`);
  }

  private showResult(msg: string, isWin: boolean): void {
    this.resultText.setText(msg).setColor(isWin ? "#20d4a0" : "#888888");
  }

  private updateSessionText(): void {
    if (!this.sessionText) return;
    const pnl  = this.chips - this.sessionStart;
    const sign = pnl >= 0 ? "+" : "";
    const col  = pnl >= 0 ? "#33aa77" : "#aa4444";
    this.sessionText
      .setText(`Session: ${this.dropsThisSession} drops | ${this.winsThisSession} wins | P&L: ${sign}${pnl.toLocaleString()}`)
      .setColor(col);
  }

  private returnToLobby(): void {
    networkManager.syncChipsFromStore();
    const user = networkManager.getUser();
    if (user) user.chips = localStore.load().chips;
    this.scene.start("CasinoLobbyScene");
  }
}
