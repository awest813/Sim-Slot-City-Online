import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { ChatUI } from "../ui/ChatUI";
import { isoToScreen, getDepth } from "../systems/IsoRenderer";
import {
  RoomType,
  BlackjackGameState,
  BlackjackTableState,
  BlackjackPlayerState,
  Card,
  ChatMessage,
  PlayerState,
} from "@slot-city/shared";

// ── Layout ────────────────────────────────────────────────────────────────────

/** Screen coords of seats relative to table center. Up to 6 players. */
const SEAT_OFFSETS = [
  { x: -120, y: 30 },
  { x:  -72, y: -20 },
  { x:    0, y: -36 },
  { x:   72, y: -20 },
  { x:  120, y: 30 },
  { x:    0, y: 60 },
];

const CARD_SUITS: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLORS: Record<string, string> = { S: "#ffffff", H: "#ff6666", D: "#ff6666", C: "#ffffff" };

const BET_AMOUNTS = [10, 25, 50, 100, 250, 500];

function cardLabel(rank: string, suit: string): string {
  return `${rank}${CARD_SUITS[suit] ?? suit}`;
}

function cardColor(suit: string): string {
  return SUIT_COLORS[suit] ?? "#ffffff";
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export class BlackjackRoomScene extends Phaser.Scene {
  private room: Awaited<ReturnType<typeof networkManager.joinRoom>> | null = null;
  private chatUI: ChatUI | null = null;

  // HUD
  private statusText!: Phaser.GameObjects.Text;
  private chipsText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private resultBanner!: Phaser.GameObjects.Text;

  // Table coords
  private tableCx = 0;
  private tableCy = 0;

  // Dealer area
  private dealerHandTexts: Phaser.GameObjects.Text[] = [];
  private dealerValueText!: Phaser.GameObjects.Text;

  // Per-seat displays (indexed by seatIndex 0-5)
  private seatNameLabels: Map<number, Phaser.GameObjects.Text> = new Map();
  private seatCardTexts: Map<number, Phaser.GameObjects.Text[]> = new Map();
  private seatBetLabels: Map<number, Phaser.GameObjects.Text> = new Map();
  private seatResultLabels: Map<number, Phaser.GameObjects.Text> = new Map();

  // Action UI
  private betButtons: Phaser.GameObjects.Text[] = [];
  private betConfirmBtn!: Phaser.GameObjects.Text;
  private hitBtn!: Phaser.GameObjects.Text;
  private standBtn!: Phaser.GameObjects.Text;
  private doubleBtn!: Phaser.GameObjects.Text;
  private selectedBet = 25;
  private pendingBetInput: HTMLInputElement | null = null;

  // Latest table state
  private tableState: BlackjackTableState | null = null;

  constructor() {
    super({ key: "BlackjackRoomScene" });
  }

  async create(): Promise<void> {
    const user = networkManager.getUser();
    if (!user) {
      this.scene.start("LoginScene");
      return;
    }

    this.cameras.main.setBackgroundColor(0x071407);
    this.drawRoom();
    this.createHUD();

    this.chatUI = new ChatUI(this, {
      x: 10,
      y: this.scale.height - 160,
      width: 300,
      height: 140,
    });

    try {
      this.room = await networkManager.joinRoom(RoomType.BLACKJACK);
      this.setupRoomHandlers();
    } catch (err) {
      const msg = networkManager.isGuestMode()
        ? "Solo Mode — Online Blackjack requires a server connection."
        : "Could not connect to blackjack server. Check connection and try again.";
      this.statusText.setText(msg).setColor("#ff8844");
      console.error("[BlackjackRoomScene] Failed to join room:", err);
    }
  }

  // ── Room drawing ─────────────────────────────────────────────────────────────

  private drawRoom(): void {
    const { width } = this.scale;
    const g = this.add.graphics();

    // Isometric floor
    for (let tx = 0; tx < 16; tx++) {
      for (let ty = 0; ty < 14; ty++) {
        const { x, y } = isoToScreen(tx, ty);
        const color = (tx + ty) % 2 === 0 ? 0x061606 : 0x071a07;
        g.fillStyle(color, 1);
        g.fillPoints([
          { x, y: y - 16 }, { x: x + 32, y }, { x, y: y + 16 }, { x: x - 32, y },
        ], true);
        g.lineStyle(1, 0x0e2e0e, 0.4);
        g.strokePoints([
          { x, y: y - 16 }, { x: x + 32, y }, { x, y: y + 16 }, { x: x - 32, y },
        ], true);
      }
    }

    this.drawBlackjackTable(g, 5, 4);

    // Back button
    this.add.text(16, 46, "← Back to Lobby", {
      fontSize: "12px",
      color: "#4488ff",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());

    // Title
    this.add.text(width / 2, 10, "🃏  Blackjack Table", {
      fontSize: "13px",
      color: "#c9a84c",
      fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);
  }

  private drawBlackjackTable(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);
    this.tableCx = x;
    this.tableCy = y;
    const depth = getDepth(tx, ty) * 10;

    // Table surface
    g.fillStyle(0x0d5c1e, 1);
    g.fillEllipse(x, y + 10, 280, 120);
    g.lineStyle(5, 0x5c3a00, 1);
    g.strokeEllipse(x, y + 10, 280, 120);

    // Felt highlight
    g.fillStyle(0x178a30, 0.4);
    g.fillEllipse(x, y + 8, 260, 106);

    // Dealer zone label
    this.add.text(x, y - 46, "DEALER", {
      fontSize: "8px",
      color: "#aaffaa",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(depth + 20);

    // Dealer hand value
    this.dealerValueText = this.add.text(x + 80, y - 46, "", {
      fontSize: "9px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0, 0.5).setDepth(depth + 22);

    // Dealer card slots (up to 8 cards)
    for (let i = 0; i < 8; i++) {
      const ct = this.add.text(x - 70 + i * 20, y - 34, "", {
        fontSize: "8px",
        fontFamily: "monospace",
        color: "#888888",
      }).setOrigin(0.5).setDepth(depth + 25);
      this.dealerHandTexts.push(ct);
    }

    // Draw seats
    for (let i = 0; i < 6; i++) {
      const off = SEAT_OFFSETS[i];
      const sx = x + off.x;
      const sy = y + off.y;

      g.fillStyle(0x3a2000, 1);
      g.fillEllipse(sx, sy, 42, 22);
      g.lineStyle(1, 0x7a5a00, 1);
      g.strokeEllipse(sx, sy, 42, 22);

      const nameLabel = this.add.text(sx, sy - 2, `${i + 1}`, {
        fontSize: "7px",
        color: "#666666",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(depth + 26);
      this.seatNameLabels.set(i, nameLabel);

      // Card display area per seat (2 slots)
      const cardTexts: Phaser.GameObjects.Text[] = [];
      for (let j = 0; j < 6; j++) {
        const ct = this.add.text(sx - 20 + j * 9, sy - 20, "", {
          fontSize: "8px",
          fontFamily: "monospace",
          color: "#ffffff",
        }).setOrigin(0.5).setDepth(depth + 27);
        cardTexts.push(ct);
      }
      this.seatCardTexts.set(i, cardTexts);

      // Bet label
      const betLabel = this.add.text(sx, sy + 16, "", {
        fontSize: "7px",
        color: "#ffd700",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(depth + 26);
      this.seatBetLabels.set(i, betLabel);

      // Result label
      const resultLabel = this.add.text(sx, sy + 28, "", {
        fontSize: "8px",
        color: "#ffd700",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(depth + 28);
      this.seatResultLabels.set(i, resultLabel);
    }

    g.setDepth(depth + 5);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────────

  private createHUD(): void {
    const { width, height } = this.scale;

    // Top bar background
    this.add.graphics()
      .fillStyle(0x000000, 0.75)
      .fillRect(0, 0, width, 38)
      .setScrollFactor(0).setDepth(500);

    this.statusText = this.add.text(width / 2, 10, "Connecting…", {
      fontSize: "12px",
      color: "#aaaaaa",
      fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    this.phaseText = this.add.text(16, 10, "", {
      fontSize: "11px",
      color: "#44ff88",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    this.chipsText = this.add.text(width - 16, 10, "", {
      fontSize: "11px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(501);

    // Result banner (center screen)
    this.resultBanner = this.add.text(width / 2, height / 2 - 40, "", {
      fontSize: "26px",
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 5,
      fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(520).setVisible(false);

    // Bottom action panel background
    this.add.graphics()
      .fillStyle(0x000000, 0.7)
      .fillRect(0, height - 56, width, 56)
      .setScrollFactor(0).setDepth(500);

    this.createActionButtons();
  }

  private createActionButtons(): void {
    const { width, height } = this.scale;
    const btnY = height - 28;

    // Bet amount selector buttons
    BET_AMOUNTS.forEach((amt, i) => {
      const x = width / 2 - 210 + i * 70;
      const btn = this.add.text(x, btnY, `◈${amt}`, {
        fontSize: "11px",
        color: amt === this.selectedBet ? "#ffd700" : "#888888",
        stroke: "#000000",
        strokeThickness: 2,
        fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
        .setVisible(false);

      btn.on("pointerdown", () => {
        this.selectedBet = amt;
        this.betButtons.forEach((b, j) => {
          b.setColor(BET_AMOUNTS[j] === amt ? "#ffd700" : "#888888");
        });
      });

      this.betButtons.push(btn);
    });

    // Bet confirm
    this.betConfirmBtn = this.add.text(width / 2 + 230, btnY, "[ BET ]", {
      fontSize: "14px",
      color: "#44ff88",
      stroke: "#000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .setVisible(false);
    this.betConfirmBtn.on("pointerdown", () => this.sendBet());

    // Action buttons (shown when it's player turn)
    this.hitBtn = this.add.text(width / 2 - 100, btnY, "[ HIT ]", {
      fontSize: "14px",
      color: "#44ff88",
      stroke: "#000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .setVisible(false);
    this.hitBtn.on("pointerdown", () => this.sendAction("hit"));

    this.standBtn = this.add.text(width / 2, btnY, "[ STAND ]", {
      fontSize: "14px",
      color: "#4488ff",
      stroke: "#000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .setVisible(false);
    this.standBtn.on("pointerdown", () => this.sendAction("stand"));

    this.doubleBtn = this.add.text(width / 2 + 110, btnY, "[ DOUBLE ]", {
      fontSize: "14px",
      color: "#ffaa00",
      stroke: "#000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .setVisible(false);
    this.doubleBtn.on("pointerdown", () => this.sendAction("double"));
  }

  // ── Room handlers ─────────────────────────────────────────────────────────────

  private setupRoomHandlers(): void {
    if (!this.room) return;
    const user = networkManager.getUser()!;

    this.statusText.setText("Connected — waiting for players…").setColor("#44ff88");

    // Generic state updates (player joins/leaves, chat)
    this.room.state.players?.onAdd((_player: PlayerState, playerId: string) => {
      if (playerId === user.id) {
        const u = networkManager.getUser();
        if (u) this.chipsText.setText(`◈ ${u.chips.toLocaleString()}`);
      }
    });

    this.room.state.recentMessages?.onAdd((msg: ChatMessage) => {
      this.chatUI?.addMessage(msg);
    });

    // Main blackjack state updates
    this.room.onMessage("BLACKJACK_STATE_UPDATE", (msg: { table: BlackjackTableState }) => {
      this.tableState = msg.table;
      this.syncTableUI(msg.table, user.id);
    });

    // Chip sync from server
    this.room.onMessage("CHIPS_UPDATE", (msg: { chips: number }) => {
      if (networkManager.getUser()) {
        (networkManager.getUser() as { chips: number }).chips = msg.chips;
      }
      this.chipsText.setText(`◈ ${msg.chips.toLocaleString()}`);
    });

    this.room.onError((code: number, message?: string) => {
      console.error(`[BlackjackRoomScene] Room error ${code}:`, message);
      this.statusText.setText(`Error: ${message ?? code}`).setColor("#ff4444");
    });

    this.room.onLeave(() => {
      this.statusText.setText("Disconnected").setColor("#888888");
      this.hideAllButtons();
    });
  }

  // ── UI sync ───────────────────────────────────────────────────────────────────

  private syncTableUI(table: BlackjackTableState, myId: string): void {
    const { gameState } = table;

    // Phase label
    const phaseLabels: Partial<Record<BlackjackGameState, string>> = {
      [BlackjackGameState.WAITING]:     "Waiting for players",
      [BlackjackGameState.BETTING]:     "Place your bets!",
      [BlackjackGameState.DEALING]:     "Dealing cards…",
      [BlackjackGameState.PLAYER_TURN]: "Players' turn",
      [BlackjackGameState.DEALER_TURN]: "Dealer's turn",
      [BlackjackGameState.RESULT]:      "Round over",
    };
    this.phaseText.setText(phaseLabels[gameState] ?? gameState);

    // Update dealer hand
    this.updateDealerDisplay(table);

    // Update all player seats
    const me = table.players.find(p => p.playerId === myId);
    this.updateSeatDisplays(table.players);

    // Button visibility
    this.updateButtons(table, me ?? null);

    // Result banner
    this.updateResultBanner(table, me ?? null);

    // Status text
    if (gameState === BlackjackGameState.BETTING) {
      this.statusText.setText(
        `Bet ${table.minBet}–${table.maxBet} chips — round starting soon`
      ).setColor("#ffd700");
    } else if (gameState === BlackjackGameState.PLAYER_TURN && me?.isActive) {
      this.statusText.setText("Your turn — Hit, Stand, or Double").setColor("#44ff88");
    } else if (gameState === BlackjackGameState.PLAYER_TURN) {
      this.statusText.setText("Waiting for other players…").setColor("#aaaaaa");
    } else if (gameState === BlackjackGameState.RESULT) {
      this.statusText.setText("Round complete — next hand starting soon").setColor("#c9a84c");
    } else {
      this.statusText.setText(`Phase: ${gameState}`).setColor("#aaaaaa");
    }

    // Sync chips display
    if (me) this.chipsText.setText(`◈ ${me.chips.toLocaleString()}`);
  }

  private updateDealerDisplay(table: BlackjackTableState): void {
    const hand = table.dealerHand as Card[];

    for (let i = 0; i < this.dealerHandTexts.length; i++) {
      const ct = this.dealerHandTexts[i];
      if (i < hand.length) {
        const c = hand[i] as { rank: string; suit: string };
        if ((c.rank as string) === "?") {
          ct.setText("??").setColor("#666666");
        } else {
          ct.setText(cardLabel(c.rank, c.suit)).setColor(cardColor(c.suit));
        }
      } else {
        ct.setText("");
      }
    }

    if (hand.length > 0) {
      if (table.dealerRevealed) {
        const v = table.dealerHandValue;
        this.dealerValueText.setText(`(${v}${v > 21 ? " BUST" : ""})`);
        this.dealerValueText.setColor(v > 21 ? "#ff4444" : "#ffd700");
      } else {
        this.dealerValueText.setText("(?+?)");
        this.dealerValueText.setColor("#888888");
      }
    } else {
      this.dealerValueText.setText("");
    }
  }

  private updateSeatDisplays(players: BlackjackPlayerState[]): void {
    // Reset all seats first
    for (let i = 0; i < 6; i++) {
      const nameLabel = this.seatNameLabels.get(i);
      const betLabel = this.seatBetLabels.get(i);
      const resultLabel = this.seatResultLabels.get(i);
      const cardSlots = this.seatCardTexts.get(i) ?? [];

      if (nameLabel) { nameLabel.setText(`${i + 1}`).setColor("#444444"); }
      if (betLabel) betLabel.setText("");
      if (resultLabel) resultLabel.setText("");
      cardSlots.forEach(ct => ct.setText(""));
    }

    for (const player of players) {
      const si = player.seatIndex;
      const nameLabel = this.seatNameLabels.get(si);
      const betLabel = this.seatBetLabels.get(si);
      const resultLabel = this.seatResultLabels.get(si);
      const cardSlots = this.seatCardTexts.get(si) ?? [];

      if (nameLabel) {
        const activeIndicator = player.isActive && !player.hasActed ? " ◄" : "";
        nameLabel.setText(`${player.username}${activeIndicator}\n${player.chips}c`);
        nameLabel.setColor(player.isActive ? "#ffffff" : "#aaaaaa");
        nameLabel.setFontSize(6);
      }

      if (betLabel && player.bet > 0) {
        betLabel.setText(`bet: ${player.bet}`);
      }

      // Cards (only shown if hand is populated)
      const hand = player.hand as Card[];
      for (let j = 0; j < cardSlots.length; j++) {
        const ct = cardSlots[j];
        if (j < hand.length) {
          const c = hand[j] as { rank: string; suit: string };
          ct.setText(cardLabel(c.rank, c.suit)).setColor(cardColor(c.suit));
        } else {
          ct.setText("");
        }
      }

      // Result
      if (resultLabel && player.result) {
        const resultDisplay: Record<string, [string, string]> = {
          blackjack: ["BJ!", "#ffd700"],
          win:       ["WIN", "#44ff88"],
          push:      ["PUSH", "#aaaaaa"],
          lose:      ["LOSE", "#ff4444"],
          bust:      ["BUST", "#ff4444"],
        };
        const [label, color] = resultDisplay[player.result] ?? [player.result, "#ffffff"];
        resultLabel.setText(label).setColor(color);
      }
    }
  }

  private updateButtons(table: BlackjackTableState, me: BlackjackPlayerState | null): void {
    const { gameState } = table;
    const isBetting = gameState === BlackjackGameState.BETTING;
    const isMyTurn  = gameState === BlackjackGameState.PLAYER_TURN && !!me?.isActive && !me?.hasActed;
    const canDouble = isMyTurn && me?.hand?.length === 2;

    // Bet buttons
    const hasBet = me ? me.bet > 0 || me.hasActed : false;
    const showBet = isBetting && !hasBet;
    this.betButtons.forEach(b => b.setVisible(showBet));
    this.betConfirmBtn.setVisible(showBet);

    // Action buttons
    this.hitBtn.setVisible(isMyTurn);
    this.standBtn.setVisible(isMyTurn);
    this.doubleBtn.setVisible(canDouble);
  }

  private updateResultBanner(table: BlackjackTableState, me: BlackjackPlayerState | null): void {
    if (table.gameState !== BlackjackGameState.RESULT || !me) {
      this.resultBanner.setVisible(false);
      return;
    }

    if (!me.result) {
      this.resultBanner.setVisible(false);
      return;
    }

    const messages: Record<string, [string, string]> = {
      blackjack: ["🎉 BLACKJACK!", "#ffd700"],
      win:       ["✓ YOU WIN!", "#44ff88"],
      push:      ["PUSH — Tie", "#aaaaaa"],
      lose:      ["✗ Dealer Wins", "#ff4444"],
      bust:      ["✗ BUST!", "#ff4444"],
    };

    const [msg, color] = messages[me.result] ?? [me.result, "#ffffff"];
    this.resultBanner.setText(msg).setColor(color).setVisible(true);

    this.tweens.add({
      targets: this.resultBanner,
      scaleX: [1.3, 1],
      scaleY: [1.3, 1],
      duration: 350,
      ease: "Back.Out",
    });

    // Auto-hide before next round
    this.time.delayedCall(3500, () => this.resultBanner.setVisible(false));
  }

  private hideAllButtons(): void {
    this.betButtons.forEach(b => b.setVisible(false));
    this.betConfirmBtn.setVisible(false);
    this.hitBtn.setVisible(false);
    this.standBtn.setVisible(false);
    this.doubleBtn.setVisible(false);
  }

  // ── Player actions ────────────────────────────────────────────────────────────

  private sendBet(): void {
    networkManager.sendMessage({
      type: "BLACKJACK_ACTION",
      action: "bet",
      amount: this.selectedBet,
    });
    // Optimistically hide bet UI
    this.betButtons.forEach(b => b.setVisible(false));
    this.betConfirmBtn.setVisible(false);
  }

  private sendAction(action: "hit" | "stand" | "double"): void {
    networkManager.sendMessage({ type: "BLACKJACK_ACTION", action });
    // Optimistically hide action buttons
    this.hitBtn.setVisible(false);
    this.standBtn.setVisible(false);
    this.doubleBtn.setVisible(false);
  }

  // ── Navigation ────────────────────────────────────────────────────────────────

  private async returnToLobby(): Promise<void> {
    await networkManager.leaveRoom();
    this.cleanup();
    this.scene.start("CasinoLobbyScene");
  }

  private cleanup(): void {
    this.chatUI?.destroy();
    if (this.pendingBetInput) {
      document.body.removeChild(this.pendingBetInput);
      this.pendingBetInput = null;
    }
  }

  shutdown(): void {
    this.cleanup();
  }
}
