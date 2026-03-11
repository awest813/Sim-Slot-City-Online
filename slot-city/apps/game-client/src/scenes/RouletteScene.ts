/**
 * RouletteScene — fully playable European roulette (single zero, 0-36).
 *
 * Works 100% offline (no server required). Uses localStore for chip persistence.
 * Bet types: straight (35:1), red/black/odd/even/low/high (1:1), dozens (2:1).
 */

import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { localStore } from "../store/LocalStore";

// ─── Roulette data ─────────────────────────────────────────────────────────────

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

// European wheel physical order
const WHEEL_ORDER = [
  0, 32, 15, 19,  4, 21,  2, 25, 17, 34,  6, 27, 13,
  36, 11, 30,  8, 23, 10,  5, 24, 16, 33,  1, 20, 14,
  31,  9, 22, 18, 29,  7, 28, 12, 35,  3, 26,
];

type BetType =
  | "straight"
  | "red" | "black"
  | "odd" | "even"
  | "low" | "high"
  | "dozen1" | "dozen2" | "dozen3";

interface Bet {
  type: BetType;
  number?: number;
  amount: number;
}

function getColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

function evalBet(bet: Bet, result: number): number {
  const isRed   = RED_NUMBERS.has(result);
  const isBlack = result !== 0 && !isRed;
  switch (bet.type) {
    case "straight": return bet.number === result ? bet.amount * 35 : -bet.amount;
    case "red":      return isRed   ? bet.amount : -bet.amount;
    case "black":    return isBlack ? bet.amount : -bet.amount;
    case "odd":      return (result !== 0 && result % 2 === 1) ? bet.amount : -bet.amount;
    case "even":     return (result !== 0 && result % 2 === 0) ? bet.amount : -bet.amount;
    case "low":      return (result >= 1  && result <= 18) ? bet.amount : -bet.amount;
    case "high":     return (result >= 19 && result <= 36) ? bet.amount : -bet.amount;
    case "dozen1":   return (result >= 1  && result <= 12) ? bet.amount * 2 : -bet.amount;
    case "dozen2":   return (result >= 13 && result <= 24) ? bet.amount * 2 : -bet.amount;
    case "dozen3":   return (result >= 25 && result <= 36) ? bet.amount * 2 : -bet.amount;
    default:         return -bet.amount;
  }
}

// ─── Bet/chip options ──────────────────────────────────────────────────────────

const CHIP_OPTIONS = [5, 10, 25, 50, 100];
const DEFAULT_CHIP = 10;

// ─── Layout ────────────────────────────────────────────────────────────────────

// Roulette table grid dimensions
const CELL_W  = 30;
const CELL_H  = 24;
const ZERO_W  = 28;
const ZERO_H  = CELL_H * 3;
const COLS    = 12;

export class RouletteScene extends Phaser.Scene {
  // Economy
  private chips        = 0;
  private sessionStart = 0;
  private spinsCount   = 0;
  private winsCount    = 0;

  // Betting
  private bets: Map<string, Bet> = new Map();
  private chipValue = DEFAULT_CHIP;
  private spinning  = false;
  private lastResult: number | null = null;

  // UI refs
  private chipsText!:    Phaser.GameObjects.Text;
  private resultText!:   Phaser.GameObjects.Text;
  private betTotalText!: Phaser.GameObjects.Text;
  private sessionText!:  Phaser.GameObjects.Text;
  private spinBtn!:      Phaser.GameObjects.Text;
  private clearBtn!:     Phaser.GameObjects.Text;
  private wheelContainer!: Phaser.GameObjects.Container;
  private wheelGfx!:     Phaser.GameObjects.Graphics;
  private resultCircle!: Phaser.GameObjects.Graphics;
  private resultNumTxt!: Phaser.GameObjects.Text;
  private chipBtns:      Phaser.GameObjects.Text[] = [];

  // Number + outside cell graphics for highlight
  private numCellGfx: Map<number, { g: Phaser.GameObjects.Graphics; bx: number; by: number; cw: number; ch: number; col: string }> = new Map();
  private outsideCellGfx: Map<string, { g: Phaser.GameObjects.Graphics; bx: number; by: number; cw: number; ch: number }> = new Map();

  constructor() {
    super({ key: "RouletteScene" });
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
    this.cameras.main.setBackgroundColor(0x050d08);

    this.drawBackground(width, height);
    this.drawTable(width, height);
    this.createHUD(width, height);
    this.buildChipSelector(width, height);
    this.buildNumberGrid(width, height);
    this.buildOutsideBets(width, height);
    this.buildWheel(width, height);
    this.buildButtons(width, height);
    this.buildTopUpButton(width, height);

    this.input.keyboard?.on("keydown-SPACE", () => this.doSpin());
    this.input.keyboard?.on("keydown-ENTER", () => this.doSpin());
    this.input.keyboard?.on("keydown-ESC",   () => this.returnToLobby());
    this.input.keyboard?.on("keydown-C",     () => this.clearBets());

    this.refreshBetTotal();
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(w: number, h: number): void {
    const g = this.add.graphics();
    g.lineStyle(1, 0x0a1a08, 0.4);
    for (let x = 0; x < w; x += 48) g.lineBetween(x, 0, x, h);
    for (let y = 0; y < h; y += 48) g.lineBetween(0, y, w, y);
  }

  // ─── Table felt ─────────────────────────────────────────────────────────────

  private drawTable(w: number, h: number): void {
    const g  = this.add.graphics();
    const tw = 760;
    const th = 360;
    const tx = w / 2 - 20;
    const ty = h / 2 + 10;

    // Table body
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(tx - tw / 2 + 8, ty - th / 2 + 8, tw, th, 20);
    g.fillStyle(0x0c2a10, 1);
    g.fillRoundedRect(tx - tw / 2, ty - th / 2, tw, th, 20);
    g.lineStyle(3, 0x1a8830, 0.8);
    g.strokeRoundedRect(tx - tw / 2, ty - th / 2, tw, th, 20);
    g.lineStyle(1, 0x0a4a18, 0.4);
    g.strokeRoundedRect(tx - tw / 2 + 8, ty - th / 2 + 8, tw - 16, th - 16, 14);
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  private createHUD(width: number, _height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.7);
    g.fillRect(0, 0, width, 36);
    g.setDepth(500);

    this.chipsText = this.add.text(16, 10, `💰 ${this.chips.toLocaleString()} chips`, {
      fontSize: "14px", color: "#ffd700", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    this.add.text(width / 2, 10, "🎡 ROULETTE", {
      fontSize: "14px", color: "#cc3333", fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    this.add.text(width - 16, 10, "[ Lobby ]  Esc", {
      fontSize: "12px", color: "#4488ff", fontFamily: "monospace",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(501)
      .setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());

    this.sessionText = this.add.text(width - 16, 32, "", {
      fontSize: "9px", color: "#336633", fontFamily: "monospace",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(501);

    this.betTotalText = this.add.text(16, 32, "No bets placed", {
      fontSize: "9px", color: "#4a8a4a", fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);
  }

  // ─── Chip selector ───────────────────────────────────────────────────────────

  private buildChipSelector(width: number, height: number): void {
    const { cx, gridTop } = this.gridLayout(width, height);
    const y    = gridTop - 36;
    const x0   = cx - ZERO_W - (COLS * CELL_W) / 2;

    this.add.text(x0, y, "CHIP:", {
      fontSize: "11px", color: "#668866", fontFamily: "monospace",
    }).setOrigin(0, 0.5).setDepth(10);

    CHIP_OPTIONS.forEach((val, i) => {
      const bx = x0 + 56 + i * 54;
      const btn = this.add.text(bx, y, `[${val}]`, {
        fontSize: "13px",
        color: val === this.chipValue ? "#ffd700" : "#446644",
        fontFamily: "monospace",
      }).setOrigin(0.5).setInteractive({ cursor: "pointer" }).setDepth(10);

      btn.on("pointerover",  () => { if (val !== this.chipValue) btn.setColor("#99cc88"); });
      btn.on("pointerout",   () => btn.setColor(val === this.chipValue ? "#ffd700" : "#446644"));
      btn.on("pointerdown",  () => {
        this.chipValue = val;
        this.chipBtns.forEach((b, bi) => b.setColor(CHIP_OPTIONS[bi] === val ? "#ffd700" : "#446644"));
      });

      this.chipBtns.push(btn);
    });

    this.add.text(width - 16, height / 2 + 10 + 180, "Paytable:  Straight 35:1  |  Dozens 2:1  |  Even-money 1:1", {
      fontSize: "9px", color: "#224422", fontFamily: "monospace",
    }).setOrigin(1, 0).setDepth(10);
  }

  // ─── Number grid ─────────────────────────────────────────────────────────────

  private buildNumberGrid(width: number, height: number): void {
    const { cx, gridTop } = this.gridLayout(width, height);
    const gx = cx - ZERO_W - (COLS * CELL_W) / 2;

    // 0 cell
    this.buildNumCell(0, gx, gridTop, ZERO_W, ZERO_H, "green");

    // 1-36: 12 cols × 3 rows. For column c, row r: num = 3*(c+1) - r
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < 3; r++) {
        const num = 3 * (c + 1) - r;
        const bx  = gx + ZERO_W + c * CELL_W;
        const by  = gridTop + r * CELL_H;
        this.buildNumCell(num, bx, by, CELL_W, CELL_H, getColor(num));
      }
    }
  }

  private buildNumCell(num: number, bx: number, by: number, cw: number, ch: number, col: string): void {
    const baseFill = col === "green" ? 0x0a2a10 : col === "red" ? 0x3a0808 : 0x080808;

    const g = this.add.graphics().setDepth(8);
    g.fillStyle(baseFill, 1);
    g.fillRect(bx, by, cw, ch);
    g.lineStyle(0.5, 0x1a4a1a, 0.6);
    g.strokeRect(bx, by, cw, ch);

    const lblCol = col === "green" ? "#40dd60" : col === "red" ? "#ff8888" : "#cccccc";
    this.add.text(bx + cw / 2, by + ch / 2, `${num}`, {
      fontSize: num === 0 ? "12px" : "10px", color: lblCol, fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(9);

    const zone = this.add.zone(bx + cw / 2, by + ch / 2, cw, ch)
      .setInteractive({ cursor: "pointer" }).setDepth(12);
    zone.on("pointerover",  () => { g.clear(); g.fillStyle(baseFill + 0x111111, 1); g.fillRect(bx, by, cw, ch); g.lineStyle(1, 0x44aa44, 0.8); g.strokeRect(bx, by, cw, ch); });
    zone.on("pointerout",   () => { this.redrawNumCell(g, num, bx, by, cw, ch, col, false); });
    zone.on("pointerdown",  () => this.addBet("straight", num));

    this.numCellGfx.set(num, { g, bx, by, cw, ch, col });
  }

  private redrawNumCell(g: Phaser.GameObjects.Graphics, num: number, bx: number, by: number, cw: number, ch: number, col: string, winning: boolean): void {
    const hasBet  = this.bets.has(`straight:${num}`);
    const baseFill = col === "green" ? 0x0a2a10 : col === "red" ? 0x3a0808 : 0x080808;
    g.clear();
    g.fillStyle(winning ? 0x0a3a08 : hasBet ? 0x1a3a08 : baseFill, 1);
    g.fillRect(bx, by, cw, ch);
    const bc = winning ? 0x44ff44 : hasBet ? 0xaaaa22 : 0x1a4a1a;
    g.lineStyle(winning ? 1.5 : hasBet ? 1 : 0.5, bc, winning || hasBet ? 0.9 : 0.6);
    g.strokeRect(bx, by, cw, ch);
  }

  // ─── Outside bets ─────────────────────────────────────────────────────────────

  private buildOutsideBets(width: number, height: number): void {
    const { cx, gridTop } = this.gridLayout(width, height);
    const gx   = cx - ZERO_W - (COLS * CELL_W) / 2 + ZERO_W;
    const dW   = (COLS * CELL_W) / 3;   // dozen cell width (4 columns each)
    const emW  = (COLS * CELL_W) / 6;   // even-money cell width (2 columns each)
    const dy   = gridTop + ZERO_H + 6;
    const emy  = dy + CELL_H + 4;

    // Dozens
    this.buildOutsideCell("dozen1", "1st 12",  gx + dW * 0, dy, dW, CELL_H, 0x101428, "#aaaadd");
    this.buildOutsideCell("dozen2", "2nd 12",  gx + dW * 1, dy, dW, CELL_H, 0x101428, "#aaaadd");
    this.buildOutsideCell("dozen3", "3rd 12",  gx + dW * 2, dy, dW, CELL_H, 0x101428, "#aaaadd");

    // Even-money
    this.buildOutsideCell("low",   "1-18",  gx + emW * 0, emy, emW, CELL_H, 0x101418, "#aaccaa");
    this.buildOutsideCell("even",  "Even",  gx + emW * 1, emy, emW, CELL_H, 0x101418, "#aaccaa");
    this.buildOutsideCell("red",   "Red",   gx + emW * 2, emy, emW, CELL_H, 0x1e0808, "#ff8888");
    this.buildOutsideCell("black", "Black", gx + emW * 3, emy, emW, CELL_H, 0x080808, "#cccccc");
    this.buildOutsideCell("odd",   "Odd",   gx + emW * 4, emy, emW, CELL_H, 0x101418, "#aaccaa");
    this.buildOutsideCell("high",  "19-36", gx + emW * 5, emy, emW, CELL_H, 0x101418, "#aaccaa");
  }

  private buildOutsideCell(type: BetType, label: string, bx: number, by: number, cw: number, ch: number, bgColor: number, txtColor: string): void {
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(bgColor, 1);
    g.fillRect(bx, by, cw, ch);
    g.lineStyle(0.5, 0x1a4a1a, 0.6);
    g.strokeRect(bx, by, cw, ch);

    this.add.text(bx + cw / 2, by + ch / 2, label, {
      fontSize: "10px", color: txtColor, fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(9);

    const zone = this.add.zone(bx + cw / 2, by + ch / 2, cw, ch)
      .setInteractive({ cursor: "pointer" }).setDepth(12);
    zone.on("pointerover",  () => { g.clear(); g.fillStyle(bgColor + 0x101010, 1); g.fillRect(bx, by, cw, ch); g.lineStyle(1, 0x44aa44, 0.8); g.strokeRect(bx, by, cw, ch); });
    zone.on("pointerout",   () => this.redrawOutsideCell(g, type, bx, by, cw, ch, bgColor, false));
    zone.on("pointerdown",  () => this.addBet(type));

    this.outsideCellGfx.set(type, { g, bx, by, cw, ch });
  }

  private redrawOutsideCell(g: Phaser.GameObjects.Graphics, type: string, bx: number, by: number, cw: number, ch: number, bgColor: number, winning: boolean): void {
    const hasBet = this.bets.has(type);
    g.clear();
    g.fillStyle(winning ? 0x0a3a08 : hasBet ? 0x102808 : bgColor, 1);
    g.fillRect(bx, by, cw, ch);
    const bc = winning ? 0x44ff44 : hasBet ? 0xaaaa22 : 0x1a4a1a;
    g.lineStyle(winning ? 1.5 : hasBet ? 1 : 0.5, bc, winning || hasBet ? 0.9 : 0.6);
    g.strokeRect(bx, by, cw, ch);
  }

  // ─── Roulette wheel ──────────────────────────────────────────────────────────

  private buildWheel(width: number, height: number): void {
    const { gridTop } = this.gridLayout(width, height);
    const wx = width - 170;
    const wy = gridTop + ZERO_H / 2 + CELL_H;  // vertically centered with grid

    // Wheel container (rotates)
    this.wheelContainer = this.add.container(wx, wy).setDepth(20);
    this.wheelGfx       = this.add.graphics();
    this.drawWheelGfx(this.wheelGfx);
    this.wheelContainer.add(this.wheelGfx);

    // Static frame + pointer
    const frame = this.add.graphics().setDepth(20);
    const outerR = 110;
    const fr = outerR + 12;
    frame.fillStyle(0x3a1c08, 1);
    frame.fillCircle(wx, wy, fr);
    frame.lineStyle(2, 0xc9a84c, 0.8);
    frame.strokeCircle(wx, wy, fr);
    frame.fillStyle(0x1a0e04, 1);
    frame.fillCircle(wx, wy, outerR + 2);
    frame.lineStyle(1, 0x7a6030, 0.5);
    frame.strokeCircle(wx, wy, outerR + 2);
    // Pointer triangle
    frame.fillStyle(0xc9a84c, 1);
    frame.fillTriangle(wx, wy - fr + 2, wx - 7, wy - fr + 16, wx + 7, wy - fr + 16);

    // Static result display in center
    this.resultCircle = this.add.graphics().setDepth(22);
    this.drawResultCircle(wx, wy, null);

    this.resultNumTxt = this.add.text(wx, wy, "?", {
      fontSize: "26px", color: "#c9a84c", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(23);

    // Wheel label
    this.add.text(wx, wy + fr + 16, "European Roulette", {
      fontSize: "9px", color: "#336633", fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(10);
  }

  private drawWheelGfx(g: Phaser.GameObjects.Graphics): void {
    const count    = WHEEL_ORDER.length;
    const segAngle = (Math.PI * 2) / count;
    const innerR   = 36;
    const outerR   = 110;

    for (let i = 0; i < count; i++) {
      const num   = WHEEL_ORDER[i];
      const start = i * segAngle - Math.PI / 2;
      const end   = (i + 1) * segAngle - Math.PI / 2;
      const color = num === 0 ? 0x1a7a30 : RED_NUMBERS.has(num) ? 0xcc2222 : 0x111111;

      // Draw annular segment
      const steps = 5;
      const pts: { x: number; y: number }[] = [];
      for (let s = 0; s <= steps; s++) {
        const a = start + (end - start) * s / steps;
        pts.push({ x: Math.cos(a) * outerR, y: Math.sin(a) * outerR });
      }
      for (let s = steps; s >= 0; s--) {
        const a = start + (end - start) * s / steps;
        pts.push({ x: Math.cos(a) * innerR, y: Math.sin(a) * innerR });
      }
      g.fillStyle(color, 1);
      g.fillPoints(pts, true);

      // Separator
      g.lineStyle(0.5, 0x2a2a2a, 0.8);
      g.lineBetween(Math.cos(start) * innerR, Math.sin(start) * innerR,
                    Math.cos(start) * outerR,  Math.sin(start) * outerR);
    }

    // Hub
    g.fillStyle(0x080808, 1);
    g.fillCircle(0, 0, innerR + 3);
    g.lineStyle(1, 0x1a7a30, 0.5);
    g.strokeCircle(0, 0, innerR + 3);
  }

  private drawResultCircle(wx: number, wy: number, result: number | null): void {
    const g = this.resultCircle;
    g.clear();
    const col = result === null ? 0x050d08
      : result === 0            ? 0x0a3a14
      : RED_NUMBERS.has(result) ? 0x3a0a0a
      : 0x0a0a0a;
    g.fillStyle(col, 1);
    g.fillCircle(wx, wy, 32);
    g.lineStyle(1.5, result === null ? 0x1a7a30 : 0xc9a84c, 0.9);
    g.strokeCircle(wx, wy, 32);
  }

  // ─── Spin / Clear buttons ─────────────────────────────────────────────────────

  private buildButtons(width: number, height: number): void {
    const { cx, gridTop } = this.gridLayout(width, height);
    const by = gridTop + ZERO_H + CELL_H * 2 + 24;

    const sg = this.add.graphics().setDepth(8);
    sg.fillStyle(0x041808, 1);
    sg.fillRoundedRect(cx - 200, by - 3, 170, 38, 8);
    sg.lineStyle(2, 0x1a7a30, 0.9);
    sg.strokeRoundedRect(cx - 200, by - 3, 170, 38, 8);

    this.spinBtn = this.add.text(cx - 115, by + 16, "SPIN  [ Space ]", {
      fontSize: "15px", color: "#28cc50", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" }).setDepth(10);

    this.spinBtn.on("pointerover",  () => { if (!this.spinning) this.spinBtn.setColor("#ffd700"); });
    this.spinBtn.on("pointerout",   () => this.spinBtn.setColor("#28cc50"));
    this.spinBtn.on("pointerdown",  () => this.doSpin());

    // Clear bets button
    const cg = this.add.graphics().setDepth(8);
    cg.fillStyle(0x180404, 1);
    cg.fillRoundedRect(cx - 20, by - 3, 120, 38, 8);
    cg.lineStyle(1, 0x6a1a1a, 0.7);
    cg.strokeRoundedRect(cx - 20, by - 3, 120, 38, 8);

    this.clearBtn = this.add.text(cx + 40, by + 16, "CLEAR  [ C ]", {
      fontSize: "11px", color: "#884444", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" }).setDepth(10);

    this.clearBtn.on("pointerover",  () => this.clearBtn.setColor("#cc4444"));
    this.clearBtn.on("pointerout",   () => this.clearBtn.setColor("#884444"));
    this.clearBtn.on("pointerdown",  () => this.clearBets());

    this.resultText = this.add.text(cx, by + 52, "", {
      fontSize: "16px", color: "#ffd700", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);
  }

  private buildTopUpButton(width: number, height: number): void {
    const { gridTop } = this.gridLayout(width, height);
    const by = gridTop + ZERO_H + CELL_H * 2 + 80;

    const bg = this.add.graphics().setDepth(8);
    bg.fillStyle(0x041808, 0.9);
    bg.fillRoundedRect(width / 2 - 130, by - 14, 260, 30, 6);
    bg.lineStyle(1, 0x28aa44, 0.7);
    bg.strokeRoundedRect(width / 2 - 130, by - 14, 260, 30, 6);

    const btn = this.add.text(width / 2, by, "💸 Add 1,000 Chips  [ T ]", {
      fontSize: "11px", color: "#44cc66", fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" }).setDepth(10);

    btn.on("pointerdown", () => this.doTopUp());
    this.input.keyboard?.on("keydown-T", () => this.doTopUp());

    // Only show if broke
    const checkVisibility = (): void => {
      const visible = this.chips < CHIP_OPTIONS[0];
      bg.setVisible(visible);
      btn.setVisible(visible);
    };
    checkVisibility();
    this.time.addEvent({ delay: 500, loop: true, callback: checkVisibility });
  }

  // ─── Betting logic ────────────────────────────────────────────────────────────

  private addBet(type: BetType, number?: number): void {
    if (this.spinning) return;
    if (this.chips < this.chipValue) {
      this.resultText.setText("Not enough chips!").setColor("#ff4444");
      return;
    }

    const key      = type === "straight" ? `straight:${number}` : type;
    const existing = this.bets.get(key);
    if (existing) {
      existing.amount += this.chipValue;
    } else {
      this.bets.set(key, { type, number, amount: this.chipValue });
    }

    this.chips -= this.chipValue;
    localStore.adjustChips(-this.chipValue);
    this.updateChipsDisplay();
    this.refreshBetTotal();

    // Highlight the bet cell
    if (type === "straight" && number !== undefined) {
      const cell = this.numCellGfx.get(number);
      if (cell) this.redrawNumCell(cell.g, number, cell.bx, cell.by, cell.cw, cell.ch, cell.col, false);
    } else {
      const cell = this.outsideCellGfx.get(type);
      if (cell) this.redrawOutsideCell(cell.g, type, cell.bx, cell.by, cell.cw, cell.ch, 0, false);
    }
  }

  private clearBets(): void {
    if (this.spinning) return;
    let refund = 0;
    this.bets.forEach(b => refund += b.amount);
    this.bets.clear();
    if (refund > 0) {
      this.chips += refund;
      localStore.adjustChips(refund);
      this.updateChipsDisplay();
    }
    this.refreshBetTotal();
    this.resetAllCellHighlights(null);
  }

  // ─── Spin ─────────────────────────────────────────────────────────────────────

  private doSpin(): void {
    if (this.spinning) return;
    if (this.bets.size === 0) {
      this.resultText.setText("Place a bet first!").setColor("#ff4444");
      return;
    }

    const result = Math.floor(Math.random() * 37);
    this.spinning = true;
    this.spinBtn.setAlpha(0.4);
    this.resultText.setText("Spinning...");

    // Animate wheel
    const winIdx    = WHEEL_ORDER.indexOf(result);
    const segAngle  = 360 / WHEEL_ORDER.length;
    const finalAngle = 5 * 360 + (-(winIdx * segAngle));

    this.tweens.add({
      targets:   this.wheelContainer,
      angle:     finalAngle,
      duration:  3000,
      ease:      "Cubic.easeOut",
      onComplete: () => this.onSpinComplete(result),
    });
  }

  private onSpinComplete(result: number): void {
    this.spinning   = false;
    this.lastResult = result;
    this.spinsCount++;
    this.spinBtn.setAlpha(1);

    // Update wheel center
    const { width, height } = this.scale;
    const { gridTop } = this.gridLayout(width, height);
    const wx = width - 170;
    const wy = gridTop + ZERO_H / 2 + CELL_H;
    this.drawResultCircle(wx, wy, result);
    const col = result === 0 ? "#44dd66" : RED_NUMBERS.has(result) ? "#ff6666" : "#cccccc";
    this.resultNumTxt.setText(`${result}`).setColor(col);

    // Evaluate
    const betList  = [...this.bets.values()];
    const wagered  = betList.reduce((s, b) => s + b.amount, 0);
    let net = 0;
    betList.forEach(b => { net += evalBet(b, result); });

    this.bets.clear();

    // totalReturn = stake returned + net profit (always >= 0)
    const totalReturn = wagered + net;
    if (totalReturn > 0) {
      this.chips += totalReturn;
      localStore.adjustChips(totalReturn);
    }

    if (net > 0) {
      this.winsCount++;
      this.resultText.setText(`${result} — WIN! +${net.toLocaleString()} chips`).setColor("#ffd700");
      this.cameras.main.flash(400, 200, 200, 0);
    } else if (net === 0) {
      this.resultText.setText(`${result} — Push`).setColor("#888888");
    } else if (totalReturn > 0) {
      // Partial return: some bets won, overall net loss
      this.resultText.setText(`${result} — Net loss  (${totalReturn.toLocaleString()} returned)`).setColor("#888888");
    } else {
      this.resultText.setText(`${result} — No win  -${wagered.toLocaleString()} chips`).setColor("#888888");
    }

    this.updateChipsDisplay();
    this.refreshBetTotal();
    this.updateSessionText();
    this.resetAllCellHighlights(result);
  }

  // ─── Highlight helpers ────────────────────────────────────────────────────────

  private resetAllCellHighlights(winResult: number | null): void {
    for (const [num, cell] of this.numCellGfx) {
      this.redrawNumCell(cell.g, num, cell.bx, cell.by, cell.cw, cell.ch, cell.col, num === winResult);
    }
    for (const [type, cell] of this.outsideCellGfx) {
      const wins = winResult !== null && evalBet({ type: type as BetType, amount: 1 }, winResult) > 0;
      this.redrawOutsideCell(cell.g, type, cell.bx, cell.by, cell.cw, cell.ch, 0, wins);
    }
  }

  // ─── Top-up ───────────────────────────────────────────────────────────────────

  private doTopUp(): void {
    const ADD = 1000;
    this.chips += ADD;
    localStore.adjustChips(ADD);
    this.updateChipsDisplay();
    this.resultText.setText(`+${ADD.toLocaleString()} chips added!`).setColor("#44ff88");
    this.time.delayedCall(1500, () => {
      if (this.resultText.text.includes("chips added")) this.resultText.setText("");
    });
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────────

  private updateChipsDisplay(): void {
    this.chipsText.setText(`💰 ${this.chips.toLocaleString()} chips`);
  }

  private refreshBetTotal(): void {
    let total = 0;
    this.bets.forEach(b => total += b.amount);
    this.betTotalText.setText(total === 0 ? "No bets placed" : `Bets: ${total.toLocaleString()} chips`);
  }

  private updateSessionText(): void {
    const pnl  = this.chips - this.sessionStart;
    const sign = pnl >= 0 ? "+" : "";
    const col  = pnl >= 0 ? "#44aa44" : "#aa4444";
    this.sessionText.setText(
      `Session: ${this.spinsCount} spins | ${this.winsCount} wins | P&L: ${sign}${pnl.toLocaleString()}`
    ).setColor(col);
  }

  // ─── Layout helper ────────────────────────────────────────────────────────────

  /** Returns grid anchor based on current screen dimensions. */
  private gridLayout(width: number, height: number): { cx: number; gridTop: number } {
    // Center the grid horizontally (excluding wheel space on right)
    const gridTotalW = ZERO_W + COLS * CELL_W;
    const cx         = (width - 200) / 2;  // leave space for wheel
    const gridTop    = height / 2 - ZERO_H / 2 - CELL_H / 2;
    return { cx, gridTop };
  }

  // ─── Return to lobby ──────────────────────────────────────────────────────────

  private returnToLobby(): void {
    // Refund outstanding bets
    let refund = 0;
    this.bets.forEach(b => refund += b.amount);
    if (refund > 0) {
      this.chips += refund;
      localStore.adjustChips(refund);
    }

    networkManager.syncChipsFromStore();
    const user = networkManager.getUser();
    if (user) user.chips = localStore.load().chips;
    this.scene.start("CasinoLobbyScene");
  }
}
