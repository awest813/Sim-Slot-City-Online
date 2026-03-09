import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { LoginScene } from "./scenes/LoginScene";
import { CasinoLobbyScene } from "./scenes/CasinoLobbyScene";
import { PokerRoomScene } from "./scenes/PokerRoomScene";
import { BarRoomScene } from "./scenes/BarRoomScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: "game-container",
  backgroundColor: "#0a0a1a",
  scene: [BootScene, PreloadScene, LoginScene, CasinoLobbyScene, PokerRoomScene, BarRoomScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
};

new Phaser.Game(config);
