import Phaser from 'phaser';
import { toScreen, worldDepth } from './iso';
import { FEET_ORIGIN, NAME_LIFT, PLUMBOB_LIFT, simAnimKey, type FacingDir } from './characters';

export function syncSimSprite(opts: {
    sprite: Phaser.GameObjects.Image;
    shadow: Phaser.GameObjects.Ellipse;
    nameTag: Phaser.GameObjects.Text;
    plumbob?: Phaser.GameObjects.Image | null;
    x: number;
    y: number;
    bob: number;
    outfit: string;
    facing: FacingDir;
    frame: number;
    plumbobFrame?: number;
}): { x: number; y: number } {
    const s = toScreen(opts.x, opts.y);
    const key = simAnimKey(opts.outfit, opts.facing, opts.frame);
    if (opts.sprite.scene.textures.exists(key) && opts.sprite.texture.key !== key) {
        opts.sprite.setTexture(key);
    }
    opts.sprite.setFlipX(false);
    opts.sprite.setOrigin(0.5, FEET_ORIGIN);
    opts.sprite.setPosition(s.x, s.y + opts.bob);
    opts.shadow.setPosition(s.x + 3, s.y + 2);
    opts.nameTag.setPosition(s.x, s.y - NAME_LIFT + opts.bob);
    const d = worldDepth(opts.x, opts.y);
    opts.shadow.setDepth(d - 1);
    opts.sprite.setDepth(d);
    opts.nameTag.setDepth(d + 4);
    if (opts.plumbob) {
        const pk = `plumbob_${(opts.plumbobFrame ?? 0) % 8}`;
        if (opts.plumbob.scene.textures.exists(pk) && opts.plumbob.texture.key !== pk) {
            opts.plumbob.setTexture(pk);
        }
        opts.plumbob.setOrigin(0.5, 1);
        opts.plumbob.setPosition(s.x, s.y - PLUMBOB_LIFT + opts.bob + Math.sin((opts.plumbobFrame ?? 0) * 0.4) * 1.5);
        opts.plumbob.setDepth(d + 3);
    }
    return s;
}

export const SIM_NAME_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: 'Verdana, Trebuchet MS, sans-serif',
    fontSize: '11px',
    color: '#173428',
    fontStyle: 'bold',
    stroke: '#fff8ea',
    strokeThickness: 3,
};
