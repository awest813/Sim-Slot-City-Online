import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL, FONT } from '../../game/constants';
import { SoundManager } from '../../core/systems/SoundManager';
import { ToastManager } from '../ui/ToastManager';
import { paintLifeSimShell } from '../ui/shell';
import { PAYOUTS } from '../slots/SlotsEngine';

export class ScratcherPanel {
    private scene: Phaser.Scene;
    private onClose: () => void;
    private closed = false;

    private overlay!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private escHandler!: () => void;

    private grid: string[] = [];
    private scratched: boolean[] = [];
    private boardActive = false;

    private statusText!: Phaser.GameObjects.Text;
    private buyBtn!: Phaser.GameObjects.Rectangle;
    private buyLabel!: Phaser.GameObjects.Text;
    
    // UI Refs
    private scratchTiles: Phaser.GameObjects.Rectangle[] = [];
    private scratchLinesList: Phaser.GameObjects.Graphics[] = [];
    private symbolTexts: Phaser.GameObjects.Text[] = [];

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene = scene;
        this.onClose = onClose;
        this.build();
    }

    private build(): void {
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        const pw = 400;
        const ph = 460;

        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();

        this.container = this.scene.add.container(cx, cy).setScrollFactor(0).setDepth(DEPTH_PANEL + 1);

        // BG
        const bg = this.scene.add.graphics();
        paintLifeSimShell(bg, -pw / 2, -ph / 2, pw, ph);
        
        const title = this.scene.add.text(0, -ph / 2 + 30, '🎟️ SHOWGIRL SCRATCHERS', {
            fontFamily: FONT, fontSize: '20px', color: '#ff66b2', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.statusText = this.scene.add.text(0, -ph / 2 + 64, 'Match 3 to win! Buy a card to start.', {
            fontFamily: FONT, fontSize: '13px', color: '#d7f3ea'
        }).setOrigin(0.5);

        this.container.add([bg, title, this.statusText]);

        // Grid (3x3)
        const startX = -100;
        const startY = -80;
        const spacing = 100;

        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const x = startX + col * spacing;
            const y = startY + row * spacing;

            // Background of cell
            const cellBg = this.scene.add.rectangle(x, y, 80, 80, 0x2a2035, 1)
                .setStrokeStyle(1, 0x4a3a55);
            
            // Symbol text (hidden initially)
            const symTxt = this.scene.add.text(x, y, '', {
                fontFamily: FONT, fontSize: '40px'
            }).setOrigin(0.5).setAlpha(0);
            
            // Scratch off layer
            const scratchLayer = this.scene.add.rectangle(x, y, 80, 80, 0x888888, 1)
                .setStrokeStyle(2, 0xaaaaaa);
            
            // Texture for "scratching"
            const scratchLines = this.scene.add.graphics();
            scratchLines.lineStyle(1, 0x666666, 0.4);
            for(let k=0; k<8; k++) {
                scratchLines.lineBetween(x - 40, y - 40 + k*10, x + 40, y - 40 + k*10);
            }

            // Interactive hit area
            const hit = this.scene.add.rectangle(x, y, 80, 80, 0x000000, 0)
                .setInteractive({ useHandCursor: true });

            hit.on('pointerover', () => {
                if (!this.boardActive || this.scratched[i]) return;
                
                // Reduce opacity on hover to simulate scratching
                let a = scratchLayer.fillAlpha - 0.25;
                if (a <= 0) {
                    a = 0;
                    this.scratched[i] = true;
                    scratchLayer.setVisible(false);
                    scratchLines.setVisible(false);
                    this.scene.tweens.add({ targets: symTxt, alpha: 1, duration: 150 });
                    SoundManager.playClick();
                    this.checkWin();
                } else {
                    scratchLayer.setFillStyle(0x888888, a);
                    scratchLines.setAlpha(a);
                }
            });

            this.scratchTiles.push(scratchLayer);
            this.scratchLinesList.push(scratchLines);
            this.symbolTexts.push(symTxt);

            this.container.add([cellBg, symTxt, scratchLayer, scratchLines, hit]);
        }

        // Buy Button
        this.buyBtn = this.scene.add.rectangle(0, ph / 2 - 80, 200, 40, 0x2ecc71, 1)
            .setStrokeStyle(2, 0x27ae60, 1)
            .setInteractive({ useHandCursor: true });
        this.buyLabel = this.scene.add.text(0, ph / 2 - 80, 'BUY CARD (50◈)', {
            fontFamily: FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.buyBtn.on('pointerover', () => this.buyBtn.setFillStyle(0x27ae60));
        this.buyBtn.on('pointerout', () => this.buyBtn.setFillStyle(0x2ecc71));
        this.buyBtn.on('pointerdown', () => this.buyCard());

        // Close Button
        const closeBtn = this.scene.add.rectangle(0, ph / 2 - 30, 120, 28, 0xe7fff4, 1)
            .setStrokeStyle(2, 0x0e3f38, 1)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(0, ph / 2 - 30, 'Leave', {
            fontFamily: FONT, fontSize: '12px', color: '#0e3f38', fontStyle: 'bold'
        }).setOrigin(0.5);
        closeBtn.on('pointerover', () => closeBtn.setFillStyle(0xffffff));
        closeBtn.on('pointerout', () => closeBtn.setFillStyle(0xe7fff4));
        closeBtn.on('pointerdown', () => this.close());

        this.container.add([this.buyBtn, this.buyLabel, closeBtn, closeLabel]);

        this.escHandler = () => this.close();
        this.scene.input.keyboard!.on('keydown-ESC', this.escHandler);
        
        // Initial state
        this.resetBoard();
    }

    private resetBoard(): void {
        this.boardActive = false;
        this.grid = [];
        this.scratched = Array(9).fill(false);
        for(let i=0; i<9; i++) {
            this.scratchTiles[i].setFillStyle(0x888888, 1).setVisible(true);
            this.scratchLinesList[i].setAlpha(1).setVisible(true);
            this.symbolTexts[i].setAlpha(0).setText('');
        }
        this.buyBtn.setFillStyle(0x2ecc71);
        this.buyBtn.setInteractive();
        this.buyLabel.setText('BUY CARD (50◈)');
    }

    private buyCard(): void {
        if (this.boardActive) return;
        const chips = GameState.get().chips;
        if (chips < 50) {
            this.statusText.setText('Not enough chips!').setColor('#e74c3c');
            return;
        }

        GameState.addChips(-50);
        SoundManager.playClick();
        
        this.resetBoard();
        this.boardActive = true;
        this.statusText.setText('Hover over the tiles to scratch!').setColor('#ffffff');
        
        this.buyBtn.setFillStyle(0x555555);
        this.buyBtn.disableInteractive();
        this.buyLabel.setText('SCRATCHING...');

        let forceWin = false;
        if (GameState.hasBuff('guaranteedSlotsWin')) {
            GameState.consumeBuff('guaranteedSlotsWin');
            forceWin = true;
        }

        // Determine if this is a winning card
        let isWin = false;
        let winSym = '🍒';
        
        if (forceWin) {
            isWin = true;
            winSym = '⭐'; // Guaranteed good win
        } else {
            const r = Math.random();
            if (r < 0.15) { isWin = true; winSym = '🍒'; }
            else if (r < 0.25) { isWin = true; winSym = '🍋'; }
            else if (r < 0.29) { isWin = true; winSym = '🍊'; }
            else if (r < 0.305) { isWin = true; winSym = '🍇'; }
            else if (r < 0.309) { isWin = true; winSym = '⭐'; }
            else if (r < 0.310) { isWin = true; winSym = '💎'; }
            else if (r < 0.3102) { isWin = true; winSym = '7️⃣'; }
        }

        // Fill board with 9 symbols
        // We want at most 2 of any symbol if it's not the win symbol
        const availableSymbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
        const counts: Record<string, number> = {};
        for (const s of availableSymbols) counts[s] = 0;
        
        let pool: string[] = [];
        if (isWin) {
            pool.push(winSym, winSym, winSym);
            counts[winSym] = 3;
        }

        while (pool.length < 9) {
            const s = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
            // Don't accidentally create another 3-of-a-kind or make the winSym 4-of-a-kind
            if (counts[s] < 2) {
                pool.push(s);
                counts[s]++;
            }
        }

        // Shuffle the pool
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        for(let i=0; i<9; i++) {
            this.grid.push(pool[i]);
            this.symbolTexts[i].setText(pool[i]);
        }
    }

    private checkWin(): void {
        if (!this.scratched.every(s => s)) return;

        this.boardActive = false;
        
        const counts: Record<string, number> = {};
        for(const s of this.grid) {
            counts[s] = (counts[s] || 0) + 1;
        }

        let wonSymbol: string | null = null;
        for (const [sym, count] of Object.entries(counts)) {
            if (count >= 3 && sym !== '🎰') {
                if (PAYOUTS[sym]) {
                    wonSymbol = sym;
                    break;
                }
            }
        }

        if (wonSymbol) {
            const winAmount = 50 * PAYOUTS[wonSymbol];
            GameState.addChips(winAmount);
            SoundManager.playClick();
            this.statusText.setText(`MATCH 3! You won ${winAmount.toLocaleString()}◈!`).setColor('#2ecc71');
            ToastManager.show(this.scene, `Scratcher Win: +${winAmount.toLocaleString()}◈`, 'win');
        } else {
            this.statusText.setText('No match. Better luck next time!').setColor('#e74c3c');
        }

        this.buyBtn.setFillStyle(0x2ecc71);
        this.buyBtn.setInteractive();
        this.buyLabel.setText('PLAY AGAIN (50◈)');
    }

    private close(): void {
        if (this.closed) return;
        this.closed = true;
        this.scene.input.keyboard!.off('keydown-ESC', this.escHandler);
        this.scene.tweens.add({
            targets: this.overlay,
            alpha: 0,
            duration: 200
        });
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 200,
            onComplete: () => {
                this.overlay.destroy();
                this.container.destroy();
                this.onClose();
            }
        });
    }
}
