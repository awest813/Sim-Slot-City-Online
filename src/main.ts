import Phaser from 'phaser';
import { gameConfig } from './game/config';

// Module scripts in index.html are deferred – DOM is ready by the time
// this executes, so no DOMContentLoaded wrapper needed.
new Phaser.Game(gameConfig);
