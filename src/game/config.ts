import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { BootScene }        from '../scenes/BootScene';
import { PreloadScene }     from '../scenes/PreloadScene';
import { CasinoLobbyScene } from '../features/lobby/CasinoLobbyScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type:            Phaser.AUTO,
    width:           GAME_WIDTH,
    height:          GAME_HEIGHT,
    backgroundColor: '#0d1117',
    pixelArt:        false,   // smooth geometry shapes
    roundPixels:     false,
    parent:          'game-container',
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade:  { debug: false },
    },
    scene: [BootScene, PreloadScene, CasinoLobbyScene],
};
