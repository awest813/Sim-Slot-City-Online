// ─────────────────────────────────────────────
//  Phaser game config
// ─────────────────────────────────────────────
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants';
import { BootScene }     from '../scenes/BootScene';
import { PreloadScene }  from '../scenes/PreloadScene';
import { CampScene }     from '../scenes/CampScene';
import { BattleScene }   from '../scenes/BattleScene';
import { DialogueScene } from '../scenes/DialogueScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type:            Phaser.AUTO,
    width:           GAME_WIDTH,
    height:          GAME_HEIGHT,
    backgroundColor: '#0d0d1a',
    pixelArt:        true,
    roundPixels:     true,
    parent:          'game-container',
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, CampScene, BattleScene, DialogueScene],
};
