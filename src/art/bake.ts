import type Phaser from 'phaser';
import { bakeCharacters } from './characters';
import { bakeProps } from './props';

let baked = false;

export function bakeAllSimsArt(scene: Phaser.Scene): void {
    if (baked) return;
    bakeCharacters(scene);
    bakeProps(scene);
    baked = true;
}
