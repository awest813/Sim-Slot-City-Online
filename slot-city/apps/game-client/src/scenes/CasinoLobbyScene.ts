import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { PlayerAvatar } from "../systems/PlayerAvatar";
import { MovementController } from "../systems/MovementController";
import { isoToScreen, getDepth } from "../systems/IsoRenderer";
import { ChatUI } from "../ui/ChatUI";
import { RoomType, PlayerState, ChatMessage, EmoteType, PlayerDirection } from "@slot-city/shared";
import { localStore } from "../store/LocalStore";

interface RoomPortal {
  tileX: number;
  tileY: number;
  targetRoom: RoomType;
  label: string;
}

interface Hotspot {
  tileX: number;
  tileY: number;
  radius: number;
  promptLabel: string;
  action: () => void;
}

const LOBBY_LAYOUT = {
  width: 20,
  height: 20,
  portals: [
    { tileX: 16, tileY: 5, targetRoom: RoomType.POKER, label: "🃏 Poker Room" },
    { tileX: 16, tileY: 12, targetRoom: RoomType.BAR, label: "🍸 Lucky Lounge" },
    { tileX: 3, tileY: 8, targetRoom: RoomType.BLACKJACK, label: "🎲 Blackjack" },
  ] as RoomPortal[],
};

export class CasinoLobbyScene extends Phaser.Scene {
  private room: Awaited<ReturnType<typeof networkManager.joinRoom>> | null = null;
  private localAvatar: PlayerAvatar | null = null;
  private remoteAvatars: Map<string, PlayerAvatar> = new Map();
  private movementController: MovementController | null = null;
  private chatUI: ChatUI | null = null;
  private chipsText!: Phaser.GameObjects.Text;
  private usernameText!: Phaser.GameObjects.Text;
  private connectionStatus!: Phaser.GameObjects.Text;
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private hotspots: Hotspot[] = [];
  private interactPrompt!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "CasinoLobbyScene" });
  }

  async create(): Promise<void> {
    const user = networkManager.getUser();
    if (!user) {
      this.scene.start("LoginScene");
      return;
    }

    // Sync chip count from local store if in guest mode (e.g. returning from SlotsScene)
    if (networkManager.isGuestMode()) {
      networkManager.syncChipsFromStore();
      user.chips = localStore.load().chips;
    }

    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.drawLobbyLayout();
    this.drawPortals();
    this.createHUD(user.username, user.chips);
    this.setupHotspots();

    // Always create local avatar + movement — works fully offline
    this.localAvatar = new PlayerAvatar(this, {
      playerId: user.id,
      username: user.username,
      tileX: 8,
      tileY: 10,
      isLocalPlayer: true,
      outfitId: user.outfitId ?? "default",
    });

    this.movementController = new MovementController(this, this.localAvatar, (msg) => {
      // Only forward to server if we have a live room connection
      if (this.room) networkManager.sendMessage(msg);
    });

    // Floating interact prompt (hidden until near a hotspot)
    this.interactPrompt = this.add.text(0, 0, "", {
      fontSize: "12px",
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 2,
      fontFamily: "monospace",
      backgroundColor: "#00000099",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(1100).setVisible(false);

    this.chatUI = new ChatUI(this, {
      x: 10,
      y: this.scale.height - 160,
      width: 320,
      height: 150,
    });

    const statusMsg = networkManager.isGuestMode() ? "✈ Solo Mode" : "Connecting...";
    this.connectionStatus = this.add.text(10, 10, statusMsg, {
      fontSize: "10px",
      color: networkManager.isGuestMode() ? "#aa00ff" : "#888888",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(1000);

    // Attempt server connection (non-blocking; solo mode still fully works without it)
    if (!networkManager.isGuestMode()) {
      try {
        this.room = await networkManager.joinRoom(RoomType.LOBBY);
        this.setupRoomHandlers();
        this.connectionStatus.setText("✅ Connected to Lobby").setColor("#44ff88");
      } catch (err) {
        console.error("Failed to join lobby:", err);
        this.connectionStatus.setText("✈ Offline Mode").setColor("#888888");
      }
    }

    // Keyboard shortcuts
    this.input.keyboard?.on("keydown-F", () => this.tryInteract());
    this.input.keyboard?.on("keydown-ESC", () => this.chatUI?.blur());
  }

  private drawLobbyLayout(): void {
    this.tileGraphics = this.add.graphics();
    const { width, height } = LOBBY_LAYOUT;

    for (let tx = 0; tx < width; tx++) {
      for (let ty = 0; ty < height; ty++) {
        const { x, y } = isoToScreen(tx, ty);

        // Checkerboard floor
        const isEven = (tx + ty) % 2 === 0;
        const fillColor = isEven ? 0x1a1a2e : 0x16213e;

        this.tileGraphics.fillStyle(fillColor, 1);
        this.tileGraphics.fillPoints([
          { x: x, y: y - 16 },
          { x: x + 32, y: y },
          { x: x, y: y + 16 },
          { x: x - 32, y: y },
        ], true);

        // Tile border
        this.tileGraphics.lineStyle(1, 0x1e2a4a, 0.5);
        this.tileGraphics.strokePoints([
          { x: x, y: y - 16 },
          { x: x + 32, y: y },
          { x: x, y: y + 16 },
          { x: x - 32, y: y },
        ], true);

        this.tileGraphics.setDepth(getDepth(tx, ty) - 0.5);
      }
    }

    // Draw walls / boundaries
    this.drawWalls();

    // Props
    this.drawProps();
  }

  private drawWalls(): void {
    const wallGraphics = this.add.graphics();
    wallGraphics.fillStyle(0x0f0f2a, 1);

    // Back wall (top edge)
    for (let tx = 0; tx < LOBBY_LAYOUT.width; tx++) {
      const { x, y } = isoToScreen(tx, 0);
      wallGraphics.fillRect(x - 32, y - 50, 64, 50);
      wallGraphics.lineStyle(1, 0x334488, 1);
      wallGraphics.strokeRect(x - 32, y - 50, 64, 50);
    }

    wallGraphics.setDepth(-10);
  }

  private drawProps(): void {
    const propGraphics = this.add.graphics();

    // Slot machines row
    const slotPositions = [[4, 2], [5, 2], [6, 2], [7, 2]];
    for (const [tx, ty] of slotPositions) {
      this.drawSlotMachine(propGraphics, tx, ty);
    }

    // Reception desk
    this.drawDesk(propGraphics, 10, 14);

    // Tournament board
    this.drawTournamentBoard(propGraphics, 12, 3);

    // Welcome sign
    this.drawSign(propGraphics, 8, 1, "🎰 SLOT CITY");

    // VIP area rope
    this.drawVIPRope(propGraphics, 2, 15);
  }

  private drawSlotMachine(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);
    g.fillStyle(0x553300, 1);
    g.fillRect(x - 12, y - 40, 24, 40);
    g.fillStyle(0xffaa00, 1);
    g.fillRect(x - 8, y - 36, 16, 20);
    g.fillStyle(0x000000, 1);
    g.fillRect(x - 6, y - 34, 4, 6);
    g.fillRect(x - 1, y - 34, 4, 6);
    g.fillRect(x + 4, y - 34, 4, 6);
    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private drawDesk(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);
    g.fillStyle(0x441100, 1);
    g.fillRect(x - 40, y - 20, 80, 20);
    g.fillStyle(0x772200, 1);
    g.fillRect(x - 40, y - 30, 80, 12);
    g.lineStyle(1, 0xaa4400, 1);
    g.strokeRect(x - 40, y - 30, 80, 30);
    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private drawTournamentBoard(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);
    g.fillStyle(0x001133, 1);
    g.fillRect(x - 30, y - 60, 60, 50);
    g.lineStyle(2, 0x0044ff, 1);
    g.strokeRect(x - 30, y - 60, 60, 50);

    const boardText = this.add.text(x, y - 38, "🏆 TOURNAMENTS", {
      fontSize: "7px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 10);

    this.add.text(x, y - 26, "No active tournaments", {
      fontSize: "6px",
      color: "#888888",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 10);

    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private drawSign(g: Phaser.GameObjects.Graphics, tx: number, ty: number, text: string): void {
    const { x, y } = isoToScreen(tx, ty);
    g.fillStyle(0x330011, 1);
    g.fillRect(x - 50, y - 30, 100, 24);
    g.lineStyle(2, 0xff4400, 1);
    g.strokeRect(x - 50, y - 30, 100, 24);

    this.add.text(x, y - 17, text, {
      fontSize: "10px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0.5).setDepth(getDepth(tx, ty) * 10 + 10);

    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private drawVIPRope(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const { x, y } = isoToScreen(tx, ty);
    g.fillStyle(0x884400, 1);
    g.fillRect(x - 2, y - 24, 4, 24);
    g.fillStyle(0xffd700, 1);
    g.fillEllipse(x, y - 26, 10, 10);
    g.lineStyle(2, 0xffd700, 0.6);
    g.beginPath();
    g.moveTo(x, y - 24);
    g.lineTo(x + 80, y - 24);
    g.strokePath();
    g.setDepth(getDepth(tx, ty) * 10 + 5);
  }

  private drawPortals(): void {
    for (const portal of LOBBY_LAYOUT.portals) {
      const { x, y } = isoToScreen(portal.tileX, portal.tileY);

      // Portal glow
      const portalGraphics = this.add.graphics();
      portalGraphics.fillStyle(0x002255, 0.7);
      portalGraphics.fillPoints([
        { x: x, y: y - 16 },
        { x: x + 32, y: y },
        { x: x, y: y + 16 },
        { x: x - 32, y: y },
      ], true);
      portalGraphics.lineStyle(2, 0x4488ff, 1);
      portalGraphics.strokePoints([
        { x: x, y: y - 16 },
        { x: x + 32, y: y },
        { x: x, y: y + 16 },
        { x: x - 32, y: y },
      ], true);
      portalGraphics.setDepth(getDepth(portal.tileX, portal.tileY) + 1);

      // Portal label
      this.add.text(x, y - 24, portal.label, {
        fontSize: "9px",
        color: "#88ccff",
        stroke: "#000",
        strokeThickness: 2,
        fontFamily: "monospace",
      }).setOrigin(0.5).setDepth(getDepth(portal.tileX, portal.tileY) + 10);

      // Make interactive
      const zone = this.add.zone(x, y, 64, 32).setInteractive({ cursor: "pointer" });
      zone.setDepth(getDepth(portal.tileX, portal.tileY) + 20);
      zone.on("pointerdown", () => this.enterRoom(portal.targetRoom));
      const portalShape = [
        { x: x, y: y - 16 },
        { x: x + 32, y: y },
        { x: x, y: y + 16 },
        { x: x - 32, y: y },
      ];
      zone.on("pointerover", () => {
        portalGraphics.clear();
        portalGraphics.fillStyle(0x0044aa, 0.9);
        portalGraphics.fillPoints(portalShape, true);
        portalGraphics.lineStyle(2, 0x88ccff, 1);
        portalGraphics.strokePoints(portalShape, true);
      });
      zone.on("pointerout", () => {
        portalGraphics.clear();
        portalGraphics.fillStyle(0x002255, 0.7);
        portalGraphics.fillPoints(portalShape, true);
        portalGraphics.lineStyle(2, 0x4488ff, 1);
        portalGraphics.strokePoints(portalShape, true);
      });

      // Animate portal
      this.tweens.add({
        targets: portalGraphics,
        alpha: { from: 0.6, to: 1 },
        yoyo: true,
        repeat: -1,
        duration: 1000,
      });
    }
  }

  private createHUD(username: string, chips: number): void {
    const { width } = this.scale;

    // HUD background
    const hudBg = this.add.graphics()
      .fillStyle(0x000000, 0.6)
      .fillRect(0, 0, width, 36);
    hudBg.setScrollFactor(0).setDepth(500);

    this.usernameText = this.add.text(16, 10, `👤 ${username}`, {
      fontSize: "13px",
      color: "#ffffff",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    this.chipsText = this.add.text(200, 10, `💰 ${chips.toLocaleString()} chips`, {
      fontSize: "13px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501);

    // Logout button
    const logoutBtn = this.add.text(width - 80, 10, "[ Logout ]", {
      fontSize: "11px",
      color: "#888888",
      fontFamily: "monospace",
    }).setScrollFactor(0).setDepth(501).setInteractive({ cursor: "pointer" });

    logoutBtn.on("pointerdown", () => {
      networkManager.logout();
      this.scene.start("LoginScene");
    });

    // Room label
    this.add.text(width / 2, 10, "🎰 Casino Lobby", {
      fontSize: "13px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(501);
  }

  private setupHotspots(): void {
    this.hotspots = [
      {
        // Slot machine area: props at tiles [4,2] to [7,2]; interact from in front
        tileX: 5,
        tileY: 4,
        radius: 2,
        promptLabel: "[F] Play Slots",
        action: () => this.scene.start("SlotsScene"),
      },
    ];
  }

  private tryInteract(): void {
    if (!this.localAvatar) return;
    const ax = this.localAvatar.tileX;
    const ay = this.localAvatar.tileY;
    for (const hotspot of this.hotspots) {
      const dist = Math.abs(ax - hotspot.tileX) + Math.abs(ay - hotspot.tileY);
      if (dist <= hotspot.radius) {
        hotspot.action();
        return;
      }
    }
  }

  private updateInteractPrompt(): void {
    if (!this.localAvatar) return;
    const ax = this.localAvatar.tileX;
    const ay = this.localAvatar.tileY;

    for (const hotspot of this.hotspots) {
      const dist = Math.abs(ax - hotspot.tileX) + Math.abs(ay - hotspot.tileY);
      if (dist <= hotspot.radius) {
        const { x, y } = isoToScreen(ax, ay);
        this.interactPrompt
          .setPosition(x, y - 60)
          .setText(hotspot.promptLabel)
          .setVisible(true);
        return;
      }
    }
    this.interactPrompt.setVisible(false);
  }

  private setupRoomHandlers(): void {
    if (!this.room) return;
    const user = networkManager.getUser()!;

    // Listen for state changes
    this.room.state.players.onAdd((player: PlayerState, playerId: string) => {
      if (playerId === user.id) {
        // Local avatar already created; just snap to server-authoritative position
        if (this.localAvatar && player.pos) {
          this.localAvatar.moveTo(player.pos.tileX, player.pos.tileY);
        }
      } else {
        const avatar = new PlayerAvatar(this, {
          playerId,
          username: player.username,
          tileX: player.pos?.tileX ?? 8,
          tileY: player.pos?.tileY ?? 10,
          isLocalPlayer: false,
          outfitId: player.outfitId ?? "default",
        });
        this.remoteAvatars.set(playerId, avatar);
      }
    });

    this.room.state.players.onRemove((_player: PlayerState, playerId: string) => {
      const avatar = this.remoteAvatars.get(playerId);
      if (avatar) {
        avatar.destroy();
        this.remoteAvatars.delete(playerId);
      }
    });

    this.room.state.players.onChange((player: PlayerState, playerId: string) => {
      if (playerId === user.id) {
        if (player.chips !== undefined) {
          this.chipsText.setText(`💰 ${player.chips.toLocaleString()} chips`);
        }
        return;
      }
      const avatar = this.remoteAvatars.get(playerId);
      if (avatar) {
        if (player.pos) {
          avatar.moveTo(player.pos.tileX, player.pos.tileY);
        }
        if (player.direction) {
          avatar.setDirection(player.direction as PlayerDirection);
        }
        if (player.emote) {
          avatar.showEmote(player.emote as EmoteType);
        }
      }
    });

    // Chat messages
    this.room.state.recentMessages.onAdd((msg: ChatMessage) => {
      this.chatUI?.addMessage(msg);
      // Show chat bubble on avatar
      const avatar = msg.playerId === user.id
        ? this.localAvatar
        : this.remoteAvatars.get(msg.playerId) ?? null;
      if (avatar && msg.type === "chat") {
        avatar.showChatBubble(msg.message);
      }
    });

    this.room.onError((code: number, message?: string) => {
      console.error("Room error:", code, message);
      this.connectionStatus.setText(`❌ Room error: ${message}`).setColor("#ff4444");
    });

    this.room.onLeave(() => {
      this.connectionStatus.setText("Disconnected").setColor("#888888");
    });
  }

  update(_time: number, delta: number): void {
    this.movementController?.update(_time, delta);
    this.updateInteractPrompt();
  }

  private async enterRoom(roomType: RoomType): Promise<void> {
    if (roomType === RoomType.BLACKJACK) {
      this.showToast("🎲 Blackjack — Coming Soon!");
      return;
    }

    const sceneMap: Partial<Record<RoomType, string>> = {
      [RoomType.POKER]: "PokerRoomScene",
      [RoomType.BAR]: "BarRoomScene",
    };

    const sceneName = sceneMap[roomType];
    if (sceneName) {
      if (this.room) await networkManager.leaveRoom();
      this.cleanup();
      this.scene.start(sceneName);
    }
  }

  private showToast(message: string): void {
    const { width, height } = this.scale;
    const toast = this.add.text(width / 2, height / 2, message, {
      fontSize: "18px",
      color: "#ffd700",
      stroke: "#000000",
      strokeThickness: 3,
      fontFamily: "monospace",
      backgroundColor: "#00000099",
      padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setDepth(2000).setScrollFactor(0);

    this.time.delayedCall(2000, () => toast.destroy());
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
