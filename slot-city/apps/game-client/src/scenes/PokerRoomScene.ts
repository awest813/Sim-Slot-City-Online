import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { PlayerAvatar } from "../systems/PlayerAvatar";
import { isoToScreen, getDepth } from "../systems/IsoRenderer";
import { ChatUI } from "../ui/ChatUI";
import { RoomType, PokerGameState, PlayerState, ChatMessage } from "@slot-city/shared";

// Seat positions relative to table center (screen coordinates)
const SEAT_OFFSETS = [
  { x: -90, y: 12 },
  { x: -60, y: -24 },
  { x: 0,   y: -32 },
  { x: 60,  y: -24 },
  { x: 90,  y: 12 },
  { x: 0,   y: 44 },
];

const CARD_SUITS: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLORS: Record<string, string> = { S: "#ffffff", H: "#ff6666", D: "#ff6666", C: "#ffffff" };

function cardLabel(rank: string, suit: string): string {
  return `${rank}${CARD_SUITS[suit] ?? suit}`;
}

interface PokerPlayerData {
  playerId: string;
  username: string;
  chips: number;
  seatIndex: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  isActive: boolean;
  isAI: boolean;
}

export class PokerRoomScene extends Phaser.Scene {
  private room: Awaited<ReturnType<typeof networkManager.joinRoom>> | null = null;
  private localAvatar: PlayerAvatar | null = null;
  private remoteAvatars: Map<string, PlayerAvatar> = new Map();
  private chatUI: ChatUI | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private potText!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Text[] = [];
  private communityCardTexts: Phaser.GameObjects.Text[] = [];
  private seatLabels: Map<number, Phaser.GameObjects.Text> = new Map();
  private seatBetLabels: Map<number, Phaser.GameObjects.Text> = new Map();
  private winnerText!: Phaser.GameObjects.Text;
  private raisePanel!: Phaser.GameObjects.Container;
  private raiseInput: HTMLInputElement | null = null;
  private tableCenterX = 0;
  private tableCenterY = 0;

  constructor() {
    super({ key: "PokerRoomScene" });
  }

  async create(): Promise<void> {
    const user = networkManager.getUser();
    if (!user) {
      this.scene.start("LoginScene");
      return;
    }

    this.cameras.main.setBackgroundColor(0x0a1a0a);
    this.drawPokerRoom();
    this.createPokerHUD();

    this.chatUI = new ChatUI(this, {
      x: 10,
      y: this.scale.height - 160,
      width: 300,
      height: 140,
    });

    try {
      this.room = await networkManager.joinRoom(RoomType.POKER);
      this.setupRoomHandlers();
    } catch (err) {
      const msg = networkManager.isGuestMode()
        ? "Solo Mode — Poker requires a server. Return to Lobby and play Slots offline."
        : "Could not connect to poker server. Check connection and try again.";
      this.statusText.setText(msg).setColor("#ff8844");
      console.error("Failed to join poker room:", err);
    }
  }

  private drawPokerRoom(): void {
    const { width } = this.scale;
    const g = this.add.graphics();

    // Floor
    for (let tx = 0; tx < 16; tx++) {
      for (let ty = 0; ty < 14; ty++) {
        const { x, y } = isoToScreen(tx, ty);
        const color = (tx + ty) % 2 === 0 ? 0x0a2a0a : 0x082008;
        g.fillStyle(color, 1);
        g.fillPoints([
          { x, y: y - 16 }, { x: x + 32, y }, { x, y: y + 16 }, { x: x - 32, y },
        ], true);
        g.lineStyle(1, 0x1a3a1a, 0.5);
        g.strokePoints([
          { x, y: y - 16 }, { x: x + 32, y }, { x, y: y + 16 }, { x: x - 32, y },
        ], true);
      }
    }

    // Poker table
    this.drawPokerTable(g, 5, 4);

    // Back button
    this.add.text(16, 46, "← Back to Lobby", {
      fontSize: "12px",
      color: "#4488ff",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());

    // Room title
    this.add.text(width / 2, 10, "🃏 Poker Room", {
      fontSize: "13px",
      color: "#44ff88",
      fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);
  }

  private drawPokerTable(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);
    this.tableCenterX = x;
    this.tableCenterY = y;

    // Table surface
    g.fillStyle(0x115511, 1);
    g.fillEllipse(x, y + 10, 220, 90);
    g.lineStyle(4, 0x553300, 1);
    g.strokeEllipse(x, y + 10, 220, 90);

    // Felt highlight
    g.fillStyle(0x1a7a1a, 0.5);
    g.fillEllipse(x, y + 8, 200, 80);

    // Community cards area
    g.fillStyle(0x0d5a0d, 0.8);
    g.fillRect(x - 65, y - 6, 130, 26);
    g.lineStyle(1, 0x228822, 0.8);
    g.strokeRect(x - 65, y - 6, 130, 26);

    this.add.text(x, y + 8, "Community Cards", {
      fontSize: "7px",
      color: "#aaffaa",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 20);

    // Community card slots (5 placeholders)
    for (let i = 0; i < 5; i++) {
      const cx = x - 48 + i * 24;
      const cardText = this.add.text(cx, y - 1, "--", {
        fontSize: "8px",
        color: "#444444",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 25);
      this.communityCardTexts.push(cardText);
    }

    // Pot display placeholder (updated via syncPokerState)
    this.add.text(x, y - 16, "💰 POT: 0", {
      fontSize: "9px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 20);

    // Seat positions
    for (let i = 0; i < 6; i++) {
      const off = SEAT_OFFSETS[i];
      const sx = x + off.x;
      const sy = y + off.y;

      g.fillStyle(0x553300, 1);
      g.fillEllipse(sx, sy, 34, 18);
      g.lineStyle(1, 0x884400, 1);
      g.strokeEllipse(sx, sy, 34, 18);

      // Seat label (player name / seat #)
      const label = this.add.text(sx, sy - 1, `${i + 1}`, {
        fontSize: "7px",
        color: "#888888",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 26);
      this.seatLabels.set(i, label);

      // Bet label below seat
      const betLabel = this.add.text(sx, sy + 14, "", {
        fontSize: "6px",
        color: "#ffd700",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 26);
      this.seatBetLabels.set(i, betLabel);
    }

    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private createPokerHUD(): void {
    const { width, height } = this.scale;

    // HUD background
    this.add.graphics()
      .fillStyle(0x000000, 0.7)
      .fillRect(0, 0, width, 36)
      .setScrollFactor(0).setDepth(500);

    this.statusText = this.add.text(width / 2, 10, "Waiting for players...", {
      fontSize: "12px",
      color: "#aaaaaa",
      fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);

    this.potText = this.add.text(16, 10, "💰 POT: 0", {
      fontSize: "12px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    // Winner banner (hidden initially)
    this.winnerText = this.add.text(width / 2, height / 2 - 30, "", {
      fontSize: "22px",
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 4,
      fontFamily: "monospace",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(510).setVisible(false);

    // Action buttons (hidden until player's turn)
    const actionDefs = [
      { label: "FOLD",  color: "#ff4444", action: "fold"  },
      { label: "CHECK", color: "#4488ff", action: "check" },
      { label: "CALL",  color: "#44ff88", action: "call"  },
      { label: "RAISE", color: "#ffaa00", action: "raise" },
    ];

    actionDefs.forEach((act, i) => {
      const btn = this.add.text(width / 2 - 180 + i * 120, height - 40, `[ ${act.label} ]`, {
        fontSize: "14px",
        color: act.color,
        stroke: "#000",
        strokeThickness: 2,
        fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
        .setVisible(false);

      btn.on("pointerdown", () => {
        if (act.action === "raise") {
          this.showRaisePanel();
        } else {
          networkManager.sendMessage({
            type: "POKER_ACTION",
            action: act.action as "fold" | "check" | "call",
          });
        }
      });

      this.actionButtons.push(btn);
    });

    // Raise panel (hidden initially)
    this.createRaisePanel();
  }

  private createRaisePanel(): void {
    const { width, height } = this.scale;
    const panelX = width / 2;
    const panelY = height - 90;

    const bg = this.add.graphics()
      .fillStyle(0x1a1a2e, 0.95)
      .fillRoundedRect(-100, -22, 200, 44, 6)
      .lineStyle(1, 0xffaa00, 1)
      .strokeRoundedRect(-100, -22, 200, 44, 6);

    const label = this.add.text(-94, -16, "Raise to:", {
      fontSize: "10px", color: "#ffaa00", fontFamily: "monospace",
    });

    const confirmBtn = this.add.text(55, -8, "[OK]", {
      fontSize: "13px", color: "#44ff88", fontFamily: "monospace",
    }).setInteractive({ cursor: "pointer" });

    const cancelBtn = this.add.text(82, -8, "[X]", {
      fontSize: "13px", color: "#ff4444", fontFamily: "monospace",
    }).setInteractive({ cursor: "pointer" });

    confirmBtn.on("pointerdown", () => {
      const val = parseInt(this.raiseInput?.value ?? "0", 10);
      if (!isNaN(val) && val > 0) {
        networkManager.sendMessage({ type: "POKER_ACTION", action: "raise", amount: val });
      }
      this.hideRaisePanel();
    });

    cancelBtn.on("pointerdown", () => this.hideRaisePanel());

    this.raisePanel = this.add.container(panelX, panelY, [bg, label, confirmBtn, cancelBtn]);
    this.raisePanel.setScrollFactor(0).setDepth(520).setVisible(false);
  }

  private showRaisePanel(): void {
    this.raisePanel.setVisible(true);

    // Create a native HTML input for the raise amount
    if (!this.raiseInput) {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.style.cssText = [
        "position:fixed",
        `left:${this.scale.width / 2 - 30}px`,
        `top:${this.scale.height - 106}px`,
        "width:55px",
        "background:#0d1b2a",
        "color:#fff",
        "border:1px solid #ffaa00",
        "font-size:12px",
        "padding:2px 4px",
        "z-index:1000",
      ].join(";");
      document.body.appendChild(input);
      this.raiseInput = input;
    }
    this.raiseInput.value = "";
    this.raiseInput.style.display = "block";
    this.raiseInput.focus();
  }

  private hideRaisePanel(): void {
    this.raisePanel.setVisible(false);
    if (this.raiseInput) {
      this.raiseInput.style.display = "none";
    }
  }

  private setupRoomHandlers(): void {
    if (!this.room) return;
    const user = networkManager.getUser()!;

    this.room.state.players?.onAdd((player: PlayerState, playerId: string) => {
      if (playerId === user.id) {
        this.localAvatar = new PlayerAvatar(this, {
          playerId,
          username: player.username,
          tileX: 10,
          tileY: 8,
          isLocalPlayer: true,
        });
      } else {
        this.remoteAvatars.set(playerId, new PlayerAvatar(this, {
          playerId,
          username: player.username,
          tileX: 10,
          tileY: 8,
          isLocalPlayer: false,
        }));
      }
    });

    this.room.state.players?.onRemove((_: PlayerState, playerId: string) => {
      const av = this.remoteAvatars.get(playerId);
      if (av) { av.destroy(); this.remoteAvatars.delete(playerId); }
    });

    this.room.state.table?.onChange((tableState: Record<string, unknown>) => {
      this.onTableStateChange(tableState, user.id);
    });

    this.room.state.recentMessages?.onAdd((msg: ChatMessage) => {
      this.chatUI?.addMessage(msg);
    });
  }

  private onTableStateChange(tableState: Record<string, unknown>, myPlayerId: string): void {
    const gameState = tableState.gameState as PokerGameState;
    const pot = tableState.pot as number;
    const activePlayerSeat = tableState.activePlayerSeat as number;

    this.statusText.setText(`State: ${gameState}`);
    this.potText.setText(`💰 POT: ${pot}`);

    // Update community cards
    const communityCards = (tableState.communityCards as Array<{ rank: string; suit: string }>) ?? [];
    for (let i = 0; i < 5; i++) {
      const ct = this.communityCardTexts[i];
      if (!ct) continue;
      if (i < communityCards.length) {
        const c = communityCards[i];
        ct.setText(cardLabel(c.rank, c.suit));
        ct.setColor(SUIT_COLORS[c.suit] ?? "#ffffff");
      } else {
        ct.setText("--");
        ct.setColor("#444444");
      }
    }

    // Update player seats — tableState.players is a Colyseus MapSchema (iterable as [key, value] pairs)
    const playersMap = tableState.players as Map<string, PokerPlayerData> | null;
    const playerList: PokerPlayerData[] = playersMap
      ? Array.from(playersMap.values())
      : [];

    for (const player of playerList) {
      this.updateSeatDisplay(player, activePlayerSeat);
    }

    // Check if it's the human player's turn
    const isMyTurn = playerList.some(
      (p) => p.playerId === myPlayerId && p.seatIndex === activePlayerSeat,
    );

    this.actionButtons.forEach((btn) => btn.setVisible(isMyTurn));
    if (!isMyTurn) this.hideRaisePanel();

    // Show winner banner on SHOWDOWN / END_ROUND
    const lastWinnerId = tableState.lastWinnerId as string;
    const lastWinAmount = tableState.lastWinAmount as number;
    if (
      (gameState === PokerGameState.SHOWDOWN || gameState === PokerGameState.END_ROUND) &&
      lastWinnerId
    ) {
      const winnerPlayer = playerList.find((p) => p.playerId === lastWinnerId);
      const winnerName = winnerPlayer ? winnerPlayer.username : lastWinnerId;
      this.winnerText.setText(`🏆 ${winnerName} wins ${lastWinAmount} chips!`);
      this.winnerText.setVisible(true);
      // Auto-hide after 4 seconds
      this.time.delayedCall(4000, () => this.winnerText.setVisible(false));
    }
  }

  private updateSeatDisplay(player: PokerPlayerData, activeSeat: number): void {
    const label = this.seatLabels.get(player.seatIndex);
    const betLabel = this.seatBetLabels.get(player.seatIndex);
    if (!label) return;

    const isActive = player.seatIndex === activeSeat && !player.isFolded;
    const isFolded = player.isFolded;
    const isAllIn = player.isAllIn;

    let nameColor = player.isAI ? "#aaaaff" : "#ffff88";
    if (isFolded) nameColor = "#555555";
    if (isActive) nameColor = "#ffffff";

    let statusSuffix = "";
    if (isFolded) statusSuffix = " F";
    else if (isAllIn) statusSuffix = " ALL-IN";
    else if (isActive) statusSuffix = " ◄";

    label.setText(`${player.username}${statusSuffix}\n${player.chips}c`);
    label.setColor(nameColor);
    label.setFontSize(6);

    if (betLabel) {
      betLabel.setText(player.currentBet > 0 ? `bet:${player.currentBet}` : "");
    }
  }

  update(_time: number, _delta: number): void {}

  private async returnToLobby(): Promise<void> {
    await networkManager.leaveRoom();
    this.cleanup();
    this.scene.start("CasinoLobbyScene");
  }

  private cleanup(): void {
    this.localAvatar?.destroy();
    this.remoteAvatars.forEach((a) => a.destroy());
    this.remoteAvatars.clear();
    this.chatUI?.destroy();
    if (this.raiseInput) {
      document.body.removeChild(this.raiseInput);
      this.raiseInput = null;
    }
  }

  shutdown(): void {
    this.cleanup();
  }
}
