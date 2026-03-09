import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload(): void {
    // Loading bar
    const { width, height } = this.scale;

    const progressBar = this.add.graphics();
    const progressBg = this.add.graphics();

    progressBg.fillStyle(0x222222, 0.8);
    progressBg.fillRect(width / 2 - 200, height / 2 - 20, 400, 40);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xff8800, 1);
      progressBar.fillRect(width / 2 - 196, height / 2 - 16, 392 * value, 32);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBg.destroy();
    });

    // Title text
    this.add.text(width / 2, height / 2 - 60, "🎰 SLOT CITY", {
      fontSize: "32px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 4,
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 50, "Loading...", {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Future: load actual assets here
    // this.load.image('iso-tiles', 'assets/tiles.png');
    // this.load.spritesheet('avatar', 'assets/avatar.png', { frameWidth: 32, frameHeight: 48 });
  }

  async create(): Promise<void> {
    // If already in guest mode (e.g. returning from SlotsScene), skip validation
    if (networkManager.getUser()) {
      this.scene.start("CasinoLobbyScene");
      return;
    }

    // Attempt to restore server session from saved token
    const user = await networkManager.validateSession();

    if (user) {
      this.scene.start("CasinoLobbyScene");
    } else {
      this.scene.start("LoginScene");
    }
  }
}
