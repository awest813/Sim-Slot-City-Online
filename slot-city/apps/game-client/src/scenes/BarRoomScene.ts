import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { PlayerAvatar } from "../systems/PlayerAvatar";
import { MovementController } from "../systems/MovementController";
import { isoToScreen, getDepth } from "../systems/IsoRenderer";
import { ChatUI } from "../ui/ChatUI";
import { RoomType, PlayerState, ChatMessage, PlayerDirection } from "@slot-city/shared";

export class BarRoomScene extends Phaser.Scene {
  private room: Awaited<ReturnType<typeof networkManager.joinRoom>> | null = null;
  private localAvatar: PlayerAvatar | null = null;
  private remoteAvatars: Map<string, PlayerAvatar> = new Map();
  private movementController: MovementController | null = null;
  private chatUI: ChatUI | null = null;
  private tournamentBoard!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "BarRoomScene" });
  }

  async create(): Promise<void> {
    const user = networkManager.getUser();
    if (!user) {
      this.scene.start("LoginScene");
      return;
    }

    this.cameras.main.setBackgroundColor(0x1a0a05);
    this.drawBarRoom();
    this.createHUD(user.username);

    this.chatUI = new ChatUI(this, {
      x: 10,
      y: this.scale.height - 160,
      width: 320,
      height: 140,
    });

    try {
      this.room = await networkManager.joinRoom(RoomType.BAR);
      this.setupRoomHandlers();
    } catch (err) {
      console.error("Failed to join bar room:", err);
    }
  }

  private drawBarRoom(): void {
    const { width } = this.scale;
    const g = this.add.graphics();

    // Floor
    for (let tx = 0; tx < 16; tx++) {
      for (let ty = 0; ty < 14; ty++) {
        const { x, y } = isoToScreen(tx, ty);
        const color = (tx + ty) % 2 === 0 ? 0x2a1a0a : 0x221208;
        g.fillStyle(color, 1);
        g.fillPoints([
          { x, y: y - 16 }, { x: x + 32, y }, { x, y: y + 16 }, { x: x - 32, y },
        ], true);
        g.lineStyle(1, 0x3a2a1a, 0.5);
        g.strokePoints([
          { x, y: y - 16 }, { x: x + 32, y }, { x, y: y + 16 }, { x: x - 32, y },
        ], true);
      }
    }

    // Bar counter
    this.drawBarCounter(g, 3, 2);

    // Lounge area
    this.drawLoungeArea(g, 8, 8);

    // Tournament display board
    this.drawTournamentDisplay(g, 13, 3);

    // Back button
    this.add.text(16, 46, "← Back to Lobby", {
      fontSize: "12px",
      color: "#4488ff",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(502).setInteractive({ cursor: "pointer" })
      .on("pointerdown", () => this.returnToLobby());

    // Room title
    this.add.text(width / 2, 10, "🍸 The Lucky Lounge", {
      fontSize: "13px",
      color: "#ffaa44",
      fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);
  }

  private drawBarCounter(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);

    // Counter surface
    g.fillStyle(0x441100, 1);
    g.fillRect(x - 10, y - 20, 200, 20);
    g.fillStyle(0x662200, 1);
    g.fillRect(x - 10, y - 30, 200, 12);
    g.lineStyle(2, 0x884400, 1);
    g.strokeRect(x - 10, y - 30, 200, 30);

    // Bar stools
    for (let i = 0; i < 8; i++) {
      const sx = x - 10 + i * 24;
      g.fillStyle(0x330000, 1);
      g.fillEllipse(sx + 12, y + 20, 20, 10);
      g.fillStyle(0x550000, 1);
      g.fillRect(sx + 8, y, 8, 22);
      g.lineStyle(1, 0x772222, 1);
      g.strokeEllipse(sx + 12, y + 20, 20, 10);
    }

    // Bartender NPC placeholder
    this.add.text(x + 80, y - 50, "🧑‍🍳", {
      fontSize: "20px",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 20);

    this.add.text(x + 80, y - 70, "Bartender", {
      fontSize: "8px",
      color: "#ffaa44",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 20);

    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private drawLoungeArea(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);

    // Lounge sofa
    g.fillStyle(0x332211, 1);
    g.fillRect(x - 50, y - 20, 100, 30);
    g.fillStyle(0x553322, 1);
    g.fillRect(x - 50, y - 30, 100, 12);
    g.lineStyle(2, 0x775533, 1);
    g.strokeRect(x - 50, y - 30, 100, 40);

    // Coffee table
    g.fillStyle(0x221100, 1);
    g.fillEllipse(x, y + 30, 50, 20);
    g.lineStyle(1, 0x443300, 1);
    g.strokeEllipse(x, y + 30, 50, 20);

    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private drawTournamentDisplay(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);

    g.fillStyle(0x000022, 1);
    g.fillRect(x - 40, y - 70, 80, 60);
    g.lineStyle(2, 0x0044aa, 1);
    g.strokeRect(x - 40, y - 70, 80, 60);

    this.add.text(x, y - 64, "🏆 TOURNAMENTS", {
      fontSize: "6px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 15);

    this.tournamentBoard = this.add.text(x, y - 48, "Loading...", {
      fontSize: "6px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      wordWrap: { width: 72 },
    }).setOrigin(0.5, 0).setDepth(getDepth(tx, ty) * 10 + 15);

    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private createHUD(username: string): void {
    const { width } = this.scale;

    this.add.graphics()
      .fillStyle(0x000000, 0.6)
      .fillRect(0, 0, width, 36)
      .setScrollFactor(0).setDepth(500);

    this.add.text(16, 10, `👤 ${username}`, {
      fontSize: "13px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);
  }

  private setupRoomHandlers(): void {
    if (!this.room) return;
    const user = networkManager.getUser()!;

    this.room.state.players?.onAdd((player: PlayerState, playerId: string) => {
      if (playerId === user.id) {
        this.localAvatar = new PlayerAvatar(this, {
          playerId,
          username: player.username,
          tileX: player.pos?.tileX ?? 8,
          tileY: player.pos?.tileY ?? 5,
          isLocalPlayer: true,
        });
        this.movementController = new MovementController(this, this.localAvatar, (msg) => {
          networkManager.sendMessage(msg);
        });
      } else {
        this.remoteAvatars.set(playerId, new PlayerAvatar(this, {
          playerId,
          username: player.username,
          tileX: player.pos?.tileX ?? 8,
          tileY: player.pos?.tileY ?? 5,
          isLocalPlayer: false,
        }));
      }
    });

    this.room.state.players?.onRemove((_: PlayerState, playerId: string) => {
      const av = this.remoteAvatars.get(playerId);
      if (av) { av.destroy(); this.remoteAvatars.delete(playerId); }
    });

    this.room.state.players?.onChange((player: PlayerState, playerId: string) => {
      if (playerId === user.id) return;
      const av = this.remoteAvatars.get(playerId);
      if (av && player.pos) {
        av.moveTo(player.pos.tileX, player.pos.tileY);
      }
      if (av && player.direction) {
        av.setDirection(player.direction as PlayerDirection);
      }
    });

    this.room.state.recentMessages?.onAdd((msg: ChatMessage) => {
      this.chatUI?.addMessage(msg);
    });

    this.room.state.onChange?.((state: Record<string, unknown>) => {
      const tournamentDisplay = state.tournamentDisplay as string;
      if (tournamentDisplay && this.tournamentBoard) {
        this.tournamentBoard.setText(tournamentDisplay);
      }
    });
  }

  update(_time: number, delta: number): void {
    this.movementController?.update(_time, delta);
  }

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
