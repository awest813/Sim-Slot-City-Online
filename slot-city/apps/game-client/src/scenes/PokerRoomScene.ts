import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { PlayerAvatar } from "../systems/PlayerAvatar";
import { isoToScreen, getDepth } from "../systems/IsoRenderer";
import { ChatUI } from "../ui/ChatUI";
import { RoomType, PokerGameState, PlayerState, ChatMessage } from "@slot-city/shared";

export class PokerRoomScene extends Phaser.Scene {
  private room: Awaited<ReturnType<typeof networkManager.joinRoom>> | null = null;
  private localAvatar: PlayerAvatar | null = null;
  private remoteAvatars: Map<string, PlayerAvatar> = new Map();
  private chatUI: ChatUI | null = null;
  private pokerHUD!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private potText!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Text[] = [];

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
      console.error("Failed to join poker room:", err);
    }
  }

  private drawPokerRoom(): void {
    const { width, height } = this.scale;
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

    // Table surface
    g.fillStyle(0x115511, 1);
    g.fillEllipse(x, y + 10, 200, 80);
    g.lineStyle(4, 0x553300, 1);
    g.strokeEllipse(x, y + 10, 200, 80);

    // Felt highlight
    g.fillStyle(0x1a7a1a, 0.5);
    g.fillEllipse(x, y + 8, 180, 70);

    // Community cards area
    g.fillStyle(0x0d5a0d, 0.8);
    g.fillRect(x - 60, y - 4, 120, 24);
    g.lineStyle(1, 0x228822, 0.8);
    g.strokeRect(x - 60, y - 4, 120, 24);

    this.add.text(x, y + 8, "Community Cards", {
      fontSize: "7px",
      color: "#aaffaa",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 20);

    // Pot display
    this.add.text(x, y - 14, "💰 POT: 0", {
      fontSize: "9px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 20);

    // Seat positions
    const seatPositions = [
      { x: x - 90, y: y + 12 },
      { x: x - 60, y: y - 24 },
      { x: x, y: y - 32 },
      { x: x + 60, y: y - 24 },
      { x: x + 90, y: y + 12 },
      { x: x, y: y + 44 },
    ];

    for (let i = 0; i < 6; i++) {
      const sp = seatPositions[i];
      g.fillStyle(0x553300, 1);
      g.fillEllipse(sp.x, sp.y, 28, 14);
      g.lineStyle(1, 0x884400, 1);
      g.strokeEllipse(sp.x, sp.y, 28, 14);

      this.add.text(sp.x, sp.y, `${i + 1}`, {
        fontSize: "7px",
        color: "#888888",
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 25);
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

    // Action buttons (hidden until player's turn)
    const actions = [
      { label: "FOLD", color: "#ff4444", action: "fold" },
      { label: "CHECK", color: "#4488ff", action: "check" },
      { label: "CALL", color: "#44ff88", action: "call" },
      { label: "RAISE", color: "#ffaa00", action: "raise" },
    ];

    actions.forEach((act, i) => {
      const btn = this.add.text(width / 2 - 200 + i * 110, height - 40, `[ ${act.label} ]`, {
        fontSize: "14px",
        color: act.color,
        stroke: "#000",
        strokeThickness: 2,
        fontFamily: "monospace",
      }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
        .setVisible(false);

      btn.on("pointerdown", () => {
        networkManager.sendMessage({
          type: "POKER_ACTION",
          action: act.action as "fold" | "check" | "call" | "raise",
        });
      });

      this.actionButtons.push(btn);
    });
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
      const gameState = tableState.gameState as PokerGameState;
      const pot = tableState.pot as number;

      this.statusText.setText(`State: ${gameState}`);
      this.potText.setText(`💰 POT: ${pot}`);

      const activePlayerSeat = tableState.activePlayerSeat as number;
      const isMyTurn = Array.from(this.room!.state.table?.players?.values() ?? [])
        .some((p: Record<string, unknown>) => p.playerId === user.id && (p.seatIndex as number) === activePlayerSeat);

      this.actionButtons.forEach((btn) => btn.setVisible(isMyTurn));
    });

    this.room.state.recentMessages?.onAdd((msg: ChatMessage) => {
      this.chatUI?.addMessage(msg);
    });
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
  }

  shutdown(): void {
    this.cleanup();
  }
}
