import Phaser from "phaser";
import { ChatMessage, EmoteType } from "@slot-city/shared";
import { networkManager } from "../managers/NetworkManager";

export interface ChatUIConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ChatUI {
  private scene: Phaser.Scene;
  private config: ChatUIConfig;
  private container!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Graphics;
  private messages: Phaser.GameObjects.Text[] = [];
  private inputEl!: HTMLInputElement;
  private sendBtn!: Phaser.GameObjects.Text;
  private emotePanel!: Phaser.GameObjects.Container;
  private isInputFocused = false;
  private readonly MAX_VISIBLE = 7;
  private readonly LINE_HEIGHT = 14;

  constructor(scene: Phaser.Scene, config: ChatUIConfig) {
    this.scene = scene;
    this.config = config;
    this.create();
  }

  private create(): void {
    const { x, y, width, height } = this.config;

    // Background
    this.bg = this.scene.add.graphics()
      .fillStyle(0x000000, 0.6)
      .fillRoundedRect(x, y, width, height, 4)
      .lineStyle(1, 0x224488, 0.8)
      .strokeRoundedRect(x, y, width, height, 4);
    this.bg.setScrollFactor(0).setDepth(900);

    // HTML input for chat
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.placeholder = "Press Enter to chat...";
    this.inputEl.maxLength = 200;
    this.inputEl.style.cssText = `
      position: absolute;
      left: ${x + 4}px;
      top: ${y + height - 24}px;
      width: ${width - 60}px;
      height: 20px;
      background: #0a0a1e;
      border: 1px solid #224488;
      color: #ffffff;
      font-family: monospace;
      font-size: 11px;
      padding: 2px 6px;
      outline: none;
      border-radius: 3px;
      box-sizing: border-box;
    `;
    this.inputEl.addEventListener("focus", () => {
      this.isInputFocused = true;
      this.inputEl.style.borderColor = "#4488ff";
      // Disable scene keyboard input
      this.scene.input.keyboard?.disableGlobalCapture();
    });
    this.inputEl.addEventListener("blur", () => {
      this.isInputFocused = false;
      this.inputEl.style.borderColor = "#224488";
      this.scene.input.keyboard?.enableGlobalCapture();
    });
    this.inputEl.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        this.sendMessage();
      }
    });
    document.body.appendChild(this.inputEl);

    // Send button
    this.sendBtn = this.scene.add.text(
      x + width - 46,
      y + height - 24,
      "[Send]",
      {
        fontSize: "10px",
        color: "#4488ff",
        fontFamily: "monospace",
      },
    ).setScrollFactor(0).setDepth(901).setInteractive({ cursor: "pointer" });

    this.sendBtn.on("pointerdown", () => this.sendMessage());

    // Emote button
    const emoteBtn = this.scene.add.text(x + width - 4, y + 4, "😊", {
      fontSize: "14px",
    }).setScrollFactor(0).setDepth(901).setOrigin(1, 0).setInteractive({ cursor: "pointer" });

    emoteBtn.on("pointerdown", () => this.toggleEmotePanel());

    // Emote panel
    this.emotePanel = this.createEmotePanel(x + width - 120, y - 60);
    this.emotePanel.setVisible(false);

    // Enter key to focus input
    this.scene.input.keyboard?.on("keydown-ENTER", () => {
      if (!this.isInputFocused) {
        this.inputEl.focus();
      }
    });
  }

  private createEmotePanel(x: number, y: number): Phaser.GameObjects.Container {
    const g = this.scene.add.graphics()
      .fillStyle(0x111133, 0.9)
      .fillRoundedRect(x, y, 120, 30, 4);
    g.setScrollFactor(0).setDepth(910);

    const emotes: EmoteType[] = [
      EmoteType.WAVE,
      EmoteType.LAUGH,
      EmoteType.CHEER,
      EmoteType.SHRUG,
      EmoteType.THUMBSUP,
      EmoteType.CLAP,
    ];

    const emojiMap: Record<EmoteType, string> = {
      [EmoteType.WAVE]: "👋",
      [EmoteType.LAUGH]: "😂",
      [EmoteType.CHEER]: "🎉",
      [EmoteType.SHRUG]: "🤷",
      [EmoteType.THUMBSUP]: "👍",
      [EmoteType.CLAP]: "👏",
    };

    const items = emotes.map((emote, i) => {
      const btn = this.scene.add.text(x + 4 + i * 19, y + 6, emojiMap[emote], {
        fontSize: "14px",
      }).setScrollFactor(0).setDepth(911).setInteractive({ cursor: "pointer" });

      btn.on("pointerdown", () => {
        networkManager.sendMessage({ type: "EMOTE", emote });
        this.emotePanel.setVisible(false);
      });

      return btn;
    });

    const container = this.scene.add.container(0, 0, [g, ...items]);
    container.setScrollFactor(0).setDepth(910);
    return container;
  }

  private toggleEmotePanel(): void {
    this.emotePanel.setVisible(!this.emotePanel.visible);
  }

  private sendMessage(): void {
    const text = this.inputEl.value.trim();
    if (!text) return;
    networkManager.sendMessage({ type: "CHAT", message: text });
    this.inputEl.value = "";
  }

  addMessage(msg: ChatMessage): void {
    const { x, y, width } = this.config;

    const color = msg.type === "system" ? "#888888" : msg.type === "emote" ? "#ffaa44" : "#ffffff";
    const displayText = msg.type === "system"
      ? `* ${msg.message}`
      : `${msg.username}: ${msg.message}`;

    const textObj = this.scene.add.text(x + 4, y + 4, displayText, {
      fontSize: "10px",
      color,
      fontFamily: "monospace",
      wordWrap: { width: width - 12 },
    }).setScrollFactor(0).setDepth(901);

    this.messages.push(textObj);

    if (this.messages.length > this.MAX_VISIBLE) {
      const removed = this.messages.shift()!;
      removed.destroy();
    }

    // Re-layout messages
    const startY = y + 4;
    this.messages.forEach((m, i) => {
      m.setY(startY + i * this.LINE_HEIGHT);
    });
  }

  blur(): void {
    if (this.inputEl) {
      this.inputEl.blur();
    }
  }

  destroy(): void {
    if (this.inputEl.parentNode) {
      document.body.removeChild(this.inputEl);
    }
    this.bg.destroy();
    this.sendBtn.destroy();
    this.messages.forEach((m) => m.destroy());
    this.emotePanel.destroy();
  }
}
