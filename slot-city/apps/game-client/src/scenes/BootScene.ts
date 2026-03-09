import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    networkManager.init();
    this.scene.start("PreloadScene");
  }
}
