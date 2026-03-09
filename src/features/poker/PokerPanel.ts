// ── Poker table shell — join/seat UI, placeholder state ──────────────────────
// Structured so real poker engine can plug in later without UI changes.
import Phaser from 'phaser';
import { GameState } from '../../core/state/GameState';
import {
    GAME_WIDTH, GAME_HEIGHT, DEPTH_PANEL,
    COL_FELT, COL_TRIM, COL_TABLE,
} from '../../game/constants';

interface Seat {
    id: number;
    label: string;
    state: 'empty' | 'taken' | 'you';
    chips?: number;
    playerName?: string;
}

// Placeholder seat configuration for a 6-seat Texas Hold'em table
const INITIAL_SEATS: Seat[] = [
    { id: 0, label: 'Seat 1', state: 'taken', chips: 450,  playerName: 'RoyalFlush88' },
    { id: 1, label: 'Seat 2', state: 'empty' },
    { id: 2, label: 'Seat 3', state: 'taken', chips: 1200, playerName: 'BluffMaster' },
    { id: 3, label: 'Seat 4', state: 'empty' },
    { id: 4, label: 'Seat 5', state: 'taken', chips: 780,  playerName: 'AllInAlice' },
    { id: 5, label: 'Seat 6', state: 'empty' },
];

export class PokerPanel {
    private scene: Phaser.Scene;
    private onClose: () => void;

    private overlay!: Phaser.GameObjects.Rectangle;
    private container!: Phaser.GameObjects.Container;
    private statusText!: Phaser.GameObjects.Text;
    private seats: Seat[];
    private seatBtns: Map<number, Phaser.GameObjects.Container> = new Map();
    private playerSeat: number | null = null;

    constructor(scene: Phaser.Scene, onClose: () => void) {
        this.scene = scene;
        this.onClose = onClose;
        this.seats = INITIAL_SEATS.map(s => ({ ...s }));
        this.build();
    }

    private build(): void {
        const cx = GAME_WIDTH  / 2;
        const cy = GAME_HEIGHT / 2;
        const pw = 560;
        const ph = 440;

        this.overlay = this.scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
            .setScrollFactor(0).setDepth(DEPTH_PANEL - 1).setInteractive();

        this.container = this.scene.add.container(cx, cy).setScrollFactor(0).setDepth(DEPTH_PANEL + 1);

        // Panel background
        const bg = this.scene.add.rectangle(0, 0, pw, ph, 0x0a1a0a, 1)
            .setStrokeStyle(2, COL_TRIM, 1);
        this.container.add(bg);

        // Title
        const title = this.scene.add.text(0, -ph / 2 + 22, '♠  POKER TABLE  ♠', {
            fontFamily: 'monospace', fontSize: '18px', color: '#c9a84c', fontStyle: 'bold',
        }).setOrigin(0.5);
        const divider = this.scene.add.rectangle(0, -ph / 2 + 40, pw - 40, 1, COL_TRIM, 0.5);
        this.container.add([title, divider]);

        // Table info row
        const infoText = this.scene.add.text(0, -ph / 2 + 56, 'Texas Hold\'em  ·  Blinds: 10 / 20  ·  Min buy-in: 200◈', {
            fontFamily: 'monospace', fontSize: '11px', color: '#6a8a6a',
        }).setOrigin(0.5);
        this.container.add(infoText);

        // Oval felt table
        const tableEllipse = this.scene.add.ellipse(0, -20, 340, 140, COL_FELT, 1);
        tableEllipse.setStrokeStyle(4, COL_TABLE, 1);
        this.container.add(tableEllipse);

        // Table decoration
        const tableRing = this.scene.add.ellipse(0, -20, 300, 110, 0x000000, 0);
        tableRing.setStrokeStyle(1, 0x2a6a2a, 0.6);
        this.container.add(tableRing);

        const deckText = this.scene.add.text(0, -20, '🃏', {
            fontFamily: 'monospace', fontSize: '24px',
        }).setOrigin(0.5);
        this.container.add(deckText);

        const comingSoon = this.scene.add.text(0, 10, 'Game Coming Soon', {
            fontFamily: 'monospace', fontSize: '11px', color: '#3a6a3a', fontStyle: 'italic',
        }).setOrigin(0.5);
        this.container.add(comingSoon);

        // Seat positions around the table (ellipse layout)
        // Top row: seats 0,1,2  Bottom row: 3,4,5
        const seatPositions: [number, number][] = [
            [-130, -90],   // seat 0 — top left
            [0,    -105],  // seat 1 — top center
            [130,  -90],   // seat 2 — top right
            [130,   50],   // seat 3 — bottom right
            [0,     65],   // seat 4 — bottom center
            [-130,  50],   // seat 5 — bottom left
        ];

        this.seats.forEach((seat, i) => {
            const [sx, sy] = seatPositions[i];
            const btn = this.buildSeatBtn(seat, sx, sy);
            this.seatBtns.set(seat.id, btn);
            this.container.add(btn);
        });

        // Status bar
        const statusBg = this.scene.add.rectangle(0, ph / 2 - 68, pw - 40, 28, 0x050e05, 0.9)
            .setStrokeStyle(1, 0x2a4a2a, 0.6);
        this.statusText = this.scene.add.text(0, ph / 2 - 68, 'Select an empty seat to join the table.', {
            fontFamily: 'monospace', fontSize: '11px', color: '#6a8a6a',
        }).setOrigin(0.5);
        this.container.add([statusBg, this.statusText]);

        // Close button
        const closeRect = this.scene.add.rectangle(0, ph / 2 - 30, 120, 28, 0x3a1e1e, 1)
            .setStrokeStyle(1, 0x8a3a3a, 1)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(0, ph / 2 - 30, 'Leave Table', {
            fontFamily: 'monospace', fontSize: '12px', color: '#e05050',
        }).setOrigin(0.5);

        closeRect.on('pointerover', () => closeRect.setFillStyle(0x5a2a2a));
        closeRect.on('pointerout',  () => closeRect.setFillStyle(0x3a1e1e));
        closeRect.on('pointerdown', () => this.close());
        this.container.add([closeRect, closeLabel]);

        this.scene.input.keyboard!.once('keydown-ESC', () => this.close());
    }

    private buildSeatBtn(seat: Seat, x: number, y: number): Phaser.GameObjects.Container {
        const w = 100;
        const h = 38;

        const isTaken  = seat.state === 'taken';
        const fillColor = isTaken ? 0x1a0a0a : 0x0a1a0a;
        const borderCol = isTaken ? 0x5a2a2a : 0x2a5a2a;

        const rect = this.scene.add.rectangle(0, 0, w, h, fillColor, 1)
            .setStrokeStyle(1, borderCol, 1);

        const nameLabel = this.scene.add.text(0, -8,
            isTaken ? (seat.playerName ?? 'Player') : seat.label, {
                fontFamily: 'monospace', fontSize: '10px',
                color: isTaken ? '#aa5555' : '#55aa55',
            }).setOrigin(0.5);

        const chipsLabel = this.scene.add.text(0, 8,
            isTaken ? `${seat.chips}◈` : 'OPEN', {
                fontFamily: 'monospace', fontSize: '10px',
                color: isTaken ? '#885533' : '#338855',
            }).setOrigin(0.5);

        const btn = this.scene.add.container(x, y, [rect, nameLabel, chipsLabel]);

        if (!isTaken) {
            rect.setInteractive({ useHandCursor: true });
            rect.on('pointerover', () => rect.setFillStyle(0x1a3a1a));
            rect.on('pointerout',  () => rect.setFillStyle(fillColor));
            rect.on('pointerdown', () => this.joinSeat(seat.id));
        }

        return btn;
    }

    private joinSeat(seatId: number): void {
        const chips = GameState.get().chips;
        const minBuyIn = 200;

        if (chips < minBuyIn) {
            this.statusText.setText(`Need at least ${minBuyIn}◈ to join.`).setColor('#e74c3c');
            return;
        }

        if (this.playerSeat !== null) {
            // Leave previous seat
            this.setSeatState(this.playerSeat, 'empty');
        }

        this.playerSeat = seatId;
        const seat = this.seats[seatId];
        seat.state = 'you';
        seat.playerName = GameState.get().displayName;
        seat.chips = Math.min(chips, 500);

        this.refreshSeatBtn(seatId);
        this.statusText
            .setText(`You joined Seat ${seatId + 1}. Full poker coming soon!`)
            .setColor('#c9a84c');
    }

    private setSeatState(seatId: number, state: 'empty' | 'taken'): void {
        const seat = this.seats[seatId];
        seat.state = state;
        if (state === 'empty') {
            seat.playerName = undefined;
            seat.chips = undefined;
        }
        this.refreshSeatBtn(seatId);
    }

    private refreshSeatBtn(seatId: number): void {
        const old = this.seatBtns.get(seatId);
        if (!old) return;
        const seat = this.seats[seatId];
        const [sx, sy] = old.x !== undefined ? [old.x, old.y] : [0, 0];

        old.destroy();
        const btn = this.buildSeatBtn(seat, sx, sy);
        this.seatBtns.set(seatId, btn);
        this.container.add(btn);
    }

    private close(): void {
        this.overlay.destroy();
        this.container.destroy();
        this.onClose();
    }
}
