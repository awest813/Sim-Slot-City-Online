import Phaser from "phaser";
import { isoToScreen, getDepth } from "../systems/IsoRenderer";
import { PlayerDirection, PlayerAnimState, EmoteType } from "@slot-city/shared";
import { CHAT_DISPLAY_DURATION_MS } from "../config/constants";

export interface AvatarConfig {
  playerId: string;
  username: string;
  tileX: number;
  tileY: number;
  isLocalPlayer: boolean;
  outfitId?: string;
}

const OUTFIT_COLORS: Record<string, number> = {
  default: 0x4488ff,
  red: 0xff4444,
  green: 0x44ff88,
  gold: 0xffd700,
  purple: 0xaa44ff,
};

/**
 * Avatar entity for a player character.
 * Uses placeholder graphics until real sprite sheets are available.
 * Designed to swap in sprite sheets cleanly via the animState/direction system.
 */
export class PlayerAvatar {
  scene: Phaser.Scene;
  playerId: string;
  username: string;
  tileX: number;
  tileY: number;
  isLocalPlayer: boolean;
  outfitId: string;

  // Display objects
  container!: Phaser.GameObjects.Container;
  body!: Phaser.GameObjects.Graphics;
  usernameLabel!: Phaser.GameObjects.Text;
  chatBubble!: Phaser.GameObjects.Container;
  chatText!: Phaser.GameObjects.Text;
  chatBubbleBg!: Phaser.GameObjects.Graphics;
  emoteLabel!: Phaser.GameObjects.Text;
  selectionCircle!: Phaser.GameObjects.Graphics;

  private chatTimer?: Phaser.Time.TimerEvent;
  private _direction: PlayerDirection = PlayerDirection.SOUTH;
  private _animState: PlayerAnimState = PlayerAnimState.IDLE;
  private walkTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: AvatarConfig) {
    this.scene = scene;
    this.playerId = config.playerId;
    this.username = config.username;
    this.tileX = config.tileX;
    this.tileY = config.tileY;
    this.isLocalPlayer = config.isLocalPlayer;
    this.outfitId = config.outfitId ?? "default";

    this.createDisplayObjects();
    this.updatePosition();
  }

  private createDisplayObjects(): void {
    const { x, y } = isoToScreen(this.tileX, this.tileY);

    // Body (placeholder Sims-like silhouette)
    this.body = this.scene.add.graphics();
    this.drawBody();

    // Selection circle for local player
    this.selectionCircle = this.scene.add.graphics();
    if (this.isLocalPlayer) {
      this.selectionCircle.lineStyle(2, 0xffffff, 0.6);
      this.selectionCircle.strokeEllipse(0, 0, 32, 16);
    }

    // Username label
    this.usernameLabel = this.scene.add.text(0, -52, this.username, {
      fontSize: "10px",
      color: this.isLocalPlayer ? "#ffdd44" : "#ffffff",
      stroke: "#000000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setOrigin(0.5, 1);

    // Emote label
    this.emoteLabel = this.scene.add.text(0, -64, "", {
      fontSize: "18px",
      stroke: "#000000",
      strokeThickness: 2,
    }).setOrigin(0.5, 1);

    // Chat bubble
    this.chatBubbleBg = this.scene.add.graphics();
    this.chatText = this.scene.add.text(0, -76, "", {
      fontSize: "9px",
      color: "#000000",
      fontFamily: "monospace",
      wordWrap: { width: 100 },
    }).setOrigin(0.5, 1);

    this.chatBubble = this.scene.add.container(0, 0, [this.chatBubbleBg, this.chatText]);
    this.chatBubble.setVisible(false);

    // Container to group all elements
    this.container = this.scene.add.container(x, y, [
      this.selectionCircle,
      this.body,
      this.usernameLabel,
      this.emoteLabel,
      this.chatBubble,
    ]);

    this.updateDepth();
  }

  private drawBody(): void {
    const color = OUTFIT_COLORS[this.outfitId] ?? OUTFIT_COLORS.default;
    this.body.clear();

    // Shadow / floor ellipse
    this.body.fillStyle(0x000000, 0.3);
    this.body.fillEllipse(0, 6, 28, 12);

    // Legs
    this.body.fillStyle(0x333344, 1);
    this.body.fillRect(-6, 8, 5, 14);
    this.body.fillRect(1, 8, 5, 14);

    // Body / torso
    this.body.fillStyle(color, 1);
    this.body.fillRect(-9, -12, 18, 22);

    // Head
    this.body.fillStyle(0xffccaa, 1);
    this.body.fillEllipse(0, -22, 18, 18);

    // Hair
    this.body.fillStyle(0x553311, 1);
    this.body.fillEllipse(0, -28, 18, 10);

    // Eyes
    this.body.fillStyle(0x000000, 1);
    this.body.fillRect(-4, -24, 3, 3);
    this.body.fillRect(1, -24, 3, 3);
  }

  private updatePosition(): void {
    const { x, y } = isoToScreen(this.tileX, this.tileY);
    this.container.setPosition(x, y);
    this.updateDepth();
  }

  private updateDepth(): void {
    const depth = getDepth(this.tileX, this.tileY) * 10 + (this.isLocalPlayer ? 1 : 0);
    this.container.setDepth(depth);
  }

  moveTo(tileX: number, tileY: number): void {
    this.tileX = tileX;
    this.tileY = tileY;
    const { x, y } = isoToScreen(tileX, tileY);

    if (this.walkTween) {
      this.walkTween.stop();
    }

    this.walkTween = this.scene.tweens.add({
      targets: this.container,
      x,
      y,
      duration: 200,
      ease: "Linear",
      onComplete: () => {
        this.walkTween = undefined;
        this.updateDepth();
      },
    });
  }

  setDirection(direction: PlayerDirection): void {
    this._direction = direction;
    // Future: swap sprite frame based on direction
  }

  setAnimState(state: PlayerAnimState): void {
    this._animState = state;
    // Future: play animation based on state
  }

  showChatBubble(message: string): void {
    if (this.chatTimer) this.chatTimer.remove();

    this.chatText.setText(message);
    const padding = 6;
    const bounds = this.chatText.getBounds();
    const w = bounds.width + padding * 2;
    const h = bounds.height + padding * 2;

    this.chatBubbleBg.clear();
    this.chatBubbleBg.fillStyle(0xffffff, 0.9);
    this.chatBubbleBg.fillRoundedRect(-w / 2, -76 - h, w, h, 4);
    this.chatBubbleBg.lineStyle(1, 0x999999, 1);
    this.chatBubbleBg.strokeRoundedRect(-w / 2, -76 - h, w, h, 4);

    this.chatBubble.setVisible(true);

    this.chatTimer = this.scene.time.delayedCall(CHAT_DISPLAY_DURATION_MS, () => {
      this.chatBubble.setVisible(false);
      this.chatTimer = undefined;
    });
  }

  showEmote(emote: EmoteType): void {
    const emoteMap: Partial<Record<EmoteType, string>> = {
      [EmoteType.WAVE]: "👋",
      [EmoteType.LAUGH]: "😂",
      [EmoteType.CHEER]: "🎉",
      [EmoteType.SHRUG]: "🤷",
      [EmoteType.THUMBSUP]: "👍",
      [EmoteType.CLAP]: "👏",
    };
    const emoji = emoteMap[emote] ?? "❓";
    this.emoteLabel.setText(emoji);

    this.scene.time.delayedCall(3000, () => {
      this.emoteLabel.setText("");
    });
  }

  setSeated(tileX: number, tileY: number): void {
    this.tileX = tileX;
    this.tileY = tileY;
    this.updatePosition();
    this.setAnimState(PlayerAnimState.SEATED);
  }

  destroy(): void {
    if (this.chatTimer) this.chatTimer.remove();
    if (this.walkTween) this.walkTween.stop();
    this.container.destroy();
  }
}
