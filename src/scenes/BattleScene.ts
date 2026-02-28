import Phaser from 'phaser';
import {
    GAME_WIDTH, GAME_HEIGHT,
    FONT_BASE, FONT_TITLE,
    TILE_W, TILE_H,
} from '../game/constants';
import { GridSystem }    from '../systems/GridSystem';
import { TurnSystem }    from '../systems/TurnSystem';
import { CombatSystem }  from '../systems/CombatSystem';
import { Unit }          from '../entities/Unit';
import { drawPanel }     from '../ui/UIHelpers';
import { roster, enemies } from '../data/units';

// ── Layout ────────────────────────────────────────────────────────────────────
const SIDEBAR_W    = 100;
const GRID_OX      = 4;                               // grid origin X
const GRID_OY      = 4;                               // grid origin Y
const BATTLE_COLS  = 10;
const BATTLE_ROWS  = 6;
const GRID_PX_H    = BATTLE_ROWS * TILE_H;            // 144 px
const INFO_PANEL_Y = GRID_OY + GRID_PX_H + 4;        // 152
const STATUS_Y     = GAME_HEIGHT - 20;                // 250

// ── Types ─────────────────────────────────────────────────────────────────────
type BattleState =
    | 'player_idle'    // waiting for player to pick a unit
    | 'unit_selected'  // unit chosen – showing move + attack ranges
    | 'unit_moved'     // unit moved – showing attack range only
    | 'enemy_phase'    // AI running
    | 'battle_over';

interface UnitView {
    body:  Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    hpBar: Phaser.GameObjects.Graphics;
}

// ─────────────────────────────────────────────────────────────────────────────
export class BattleScene extends Phaser.Scene {

    // ── Systems ───────────────────────────────────────────────────────────────
    private grid!:  GridSystem;
    private turns!: TurnSystem;
    private units:  Unit[] = [];

    // ── State ─────────────────────────────────────────────────────────────────
    private battleState: BattleState = 'player_idle';
    private selected:    Unit | null = null;

    // ── Visuals ───────────────────────────────────────────────────────────────
    private views     = new Map<Unit, UnitView>();
    private highlight!: Phaser.GameObjects.Graphics;

    // ── Dynamic UI refs ───────────────────────────────────────────────────────
    private phaseText!:   Phaser.GameObjects.Text;
    private activeText!:  Phaser.GameObjects.Text;
    private hintText!:    Phaser.GameObjects.Text;
    private sidebarRows:  Phaser.GameObjects.Text[] = [];

    // ── Debug / keys ─────────────────────────────────────────────────────────
    private debugText!:    Phaser.GameObjects.Text;
    private debugVisible = false;
    private keyF1!:  Phaser.Input.Keyboard.Key;
    private keyF5!:  Phaser.Input.Keyboard.Key;
    private keyEsc!: Phaser.Input.Keyboard.Key;
    private keyZ!:   Phaser.Input.Keyboard.Key;

    constructor() { super({ key: 'BattleScene' }); }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    create(): void {
        this.cameras.main.setBackgroundColor(0x0d1a0d);

        this.units = [...roster, ...enemies].map(d => new Unit(d));
        this.grid  = new GridSystem(BATTLE_COLS, BATTLE_ROWS, TILE_W, TILE_H);
        this.turns = new TurnSystem(this.units);

        this.drawGrid();
        this.highlight = this.add.graphics().setDepth(15);
        this.placeUnits();
        this.buildSidebar();
        this.buildInfoPanel();
        this.buildStatusBar();

        // Debug overlay
        this.debugText = this.add.text(4, 4, '', {
            fontFamily: 'monospace', fontSize: '7px',
            color: '#00ff88', backgroundColor: '#000000cc',
        }).setDepth(100).setVisible(false);

        // Input
        this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
            this.handleClick(ptr.worldX, ptr.worldY);
        });

        if (this.input.keyboard) {
            this.keyF1  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F1);
            this.keyF5  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
            this.keyEsc = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.keyZ   = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        }

        this.turns.startPhase('player');
        this.setState('player_idle');
    }

    update(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyF1)) {
            this.debugVisible = !this.debugVisible;
            this.debugText.setVisible(this.debugVisible);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keyF5))  { this.scene.restart(); }
        if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) { this.scene.start('CampScene'); }

        // Z = end selected unit's turn (skip remaining actions)
        if (Phaser.Input.Keyboard.JustDown(this.keyZ) &&
            (this.battleState === 'unit_selected' || this.battleState === 'unit_moved')) {
            if (this.selected) this.endUnitTurn(this.selected);
        }

        if (this.debugVisible) {
            this.debugText.setText([
                `BattleScene  fps:${Math.round(this.game.loop.actualFps)}`,
                `state:${this.battleState}  phase:${this.turns.phase}`,
                `sel:${this.selected?.data.name ?? 'none'}`,
                `alive P:${this.turns.alivePlayer.length} E:${this.turns.aliveEnemy.length}`,
            ]);
        }
    }

    // ── Input handler ─────────────────────────────────────────────────────────

    private handleClick(px: number, py: number): void {
        if (this.battleState === 'enemy_phase' || this.battleState === 'battle_over') return;

        const col = Math.floor((px - GRID_OX) / TILE_W);
        const row = Math.floor((py - GRID_OY) / TILE_H);
        if (col < 0 || col >= BATTLE_COLS || row < 0 || row >= BATTLE_ROWS) return;

        const clicked = this.unitAt(col, row);

        switch (this.battleState) {

            case 'player_idle':
                if (clicked?.data.team === 'player' && !clicked.turnEnded) {
                    this.selectUnit(clicked);
                }
                break;

            case 'unit_selected': {
                if (!this.selected) break;

                // Deselect by clicking same unit
                if (clicked === this.selected) { this.deselect(); break; }

                // Attack enemy in range
                if (clicked?.data.team === 'enemy' &&
                    CombatSystem.canAttack(this.selected, clicked)) {
                    this.doAttack(this.selected, clicked);
                    this.endUnitTurn(this.selected);
                    break;
                }

                // Move to empty reachable tile
                if (!clicked) {
                    const cells = this.grid.reachable(
                        this.selected.col, this.selected.row, this.selected.data.move,
                    );
                    if (cells.some(c => c.col === col && c.row === row)) {
                        this.moveUnit(this.selected, col, row);
                        this.setState('unit_moved');
                        break;
                    }
                }

                // Switch to another ready player unit
                if (clicked?.data.team === 'player' && !clicked.turnEnded) {
                    this.selectUnit(clicked);
                }
                break;
            }

            case 'unit_moved':
                if (!this.selected) break;
                if (clicked?.data.team === 'enemy' &&
                    CombatSystem.canAttack(this.selected, clicked)) {
                    this.doAttack(this.selected, clicked);
                    this.endUnitTurn(this.selected);
                }
                break;
        }
    }

    // ── Player actions ────────────────────────────────────────────────────────

    private selectUnit(unit: Unit): void {
        this.selected = unit;
        this.setState('unit_selected');
    }

    private deselect(): void {
        this.selected = null;
        this.setState('player_idle');
    }

    private moveUnit(unit: Unit, col: number, row: number): void {
        unit.col      = col;
        unit.row      = row;
        unit.hasMoved = true;
        this.refreshUnitView(unit);
    }

    private doAttack(attacker: Unit, defender: Unit): void {
        const dmg = CombatSystem.attack(attacker, defender);
        this.flashUnit(defender);
        this.spawnDmgText(defender, dmg);
        this.refreshUnitView(defender);
        if (!defender.isAlive) this.hideUnitView(defender);
    }

    private endUnitTurn(unit: Unit): void {
        unit.turnEnded = true;
        this.selected  = null;
        this.highlight.clear();

        const over = this.turns.checkGameOver();
        if (over) { this.endBattle(over); return; }

        if (this.turns.isPhaseComplete()) {
            this.setState('enemy_phase');
            this.time.delayedCall(400, () => { this.runEnemyPhase(); });
        } else {
            this.setState('player_idle');
        }
        this.refreshAllUnitViews(); // dim units that have acted
    }

    // ── Enemy AI ──────────────────────────────────────────────────────────────

    private runEnemyPhase(): void {
        this.turns.startPhase('enemy');
        this.refreshSidebar();

        const foes = [...this.turns.aliveEnemy];
        let delay  = 0;

        foes.forEach(enemy => {
            this.time.delayedCall(delay, () => {
                if (this.battleState !== 'enemy_phase') return;
                this.runEnemyAI(enemy);
                this.refreshSidebar();
                const over = this.turns.checkGameOver();
                if (over) { this.endBattle(over); }
            });
            delay += 650;
        });

        // After last enemy acted, hand back to player
        this.time.delayedCall(delay + 200, () => {
            if (this.battleState === 'enemy_phase') this.startPlayerPhase();
        });
    }

    private runEnemyAI(enemy: Unit): void {
        const players = this.turns.alivePlayer;
        if (players.length === 0) return;

        // Find nearest living player (Manhattan)
        const target = players.reduce((best, p) =>
            CombatSystem.dist(enemy, p) < CombatSystem.dist(enemy, best) ? p : best,
        );

        // Only move if not already in attack range
        if (!CombatSystem.canAttack(enemy, target)) {
            const occ = this.occupiedSet();
            occ.delete(`${enemy.col},${enemy.row}`); // exclude self
            const moved = CombatSystem.greedyStep(
                enemy, target, occ, BATTLE_COLS, BATTLE_ROWS,
            );
            if (moved) this.refreshUnitView(enemy);
        }

        // Attack if now in range
        if (CombatSystem.canAttack(enemy, target)) {
            this.doAttack(enemy, target);
        }

        enemy.turnEnded = true;
    }

    private startPlayerPhase(): void {
        this.turns.startPhase('player');
        this.selected = null;
        this.highlight.clear();
        this.refreshAllUnitViews();
        this.setState('player_idle');
    }

    // ── Battle end ────────────────────────────────────────────────────────────

    private endBattle(result: 'player_wins' | 'enemy_wins'): void {
        this.setState('battle_over');
        this.selected = null;
        this.highlight.clear();

        const label = result === 'player_wins' ? 'VICTORY!' : 'DEFEAT';
        const color = result === 'player_wins' ? '#e0c55a' : '#ff4444';
        const bw = 140, bh = 42;
        const bx = (GAME_WIDTH - SIDEBAR_W) / 2 - bw / 2;
        const by = GAME_HEIGHT / 2 - bh / 2;

        drawPanel(this, bx, by, bw, bh).setDepth(190);
        this.add.text(bx + bw / 2, by + bh / 2, label, {
            fontFamily: 'monospace', fontSize: '20px',
            color, stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(200);

        this.time.delayedCall(2200, () => {
            this.scene.start('CampScene', {
                result: result === 'player_wins' ? 'Victory' : 'Defeat',
            });
        });
    }

    // ── Grid drawing ──────────────────────────────────────────────────────────

    private drawGrid(): void {
        const gfx = this.add.graphics().setDepth(0);
        for (let r = 0; r < BATTLE_ROWS; r++) {
            for (let c = 0; c < BATTLE_COLS; c++) {
                const px = GRID_OX + c * TILE_W;
                const py = GRID_OY + r * TILE_H;
                gfx.fillStyle((c + r) % 2 === 0 ? 0x1a3a1a : 0x143214);
                gfx.fillRect(px, py, TILE_W - 1, TILE_H - 1);
                gfx.lineStyle(1, 0x2a5a2a, 0.4);
                gfx.strokeRect(px, py, TILE_W - 1, TILE_H - 1);
            }
        }
    }

    // ── Unit visuals ──────────────────────────────────────────────────────────

    private placeUnits(): void {
        const players = this.units.filter(u => u.data.team === 'player');
        const foes    = this.units.filter(u => u.data.team === 'enemy');
        players.forEach((u, i) => { u.col = i; u.row = 0; });
        foes   .forEach((u, i) => { u.col = i; u.row = BATTLE_ROWS - 1; });
        this.units.forEach(u => { this.views.set(u, this.createUnitView(u)); });
    }

    private createUnitView(unit: Unit): UnitView {
        const { x, y } = this.tileXY(unit.col, unit.row);
        const isPlayer  = unit.data.team === 'player';

        const body = this.add.graphics().setDepth(10);
        body.fillStyle(isPlayer ? 0x4488ff : 0xff4444);
        body.fillRect(x + 3, y + 3, TILE_W - 7, TILE_H - 7);

        const label = this.add.text(
            x + TILE_W / 2, y + TILE_H / 2,
            unit.data.name[0] ?? '?',
            { fontFamily: 'monospace', fontSize: '7px', color: '#ffffff' },
        ).setOrigin(0.5).setDepth(11);

        const hpBar = this.add.graphics().setDepth(12);
        this.paintHpBar(hpBar, x, y + TILE_H - 4, TILE_W - 1, 3, unit.hpPercent);

        return { body, label, hpBar };
    }

    private refreshUnitView(unit: Unit): void {
        const view = this.views.get(unit);
        if (!view) return;
        const { x, y } = this.tileXY(unit.col, unit.row);
        const isPlayer  = unit.data.team === 'player';

        view.body.clear();
        view.body.fillStyle(isPlayer ? 0x4488ff : 0xff4444);
        view.body.fillRect(x + 3, y + 3, TILE_W - 7, TILE_H - 7);
        view.body.setAlpha(unit.turnEnded ? 0.45 : 1);

        view.label.setPosition(x + TILE_W / 2, y + TILE_H / 2);

        view.hpBar.clear();
        this.paintHpBar(view.hpBar, x, y + TILE_H - 4, TILE_W - 1, 3, unit.hpPercent);
    }

    private refreshAllUnitViews(): void {
        this.units.forEach(u => { if (u.isAlive) this.refreshUnitView(u); });
    }

    private hideUnitView(unit: Unit): void {
        const view = this.views.get(unit);
        if (!view) return;
        view.body .setVisible(false);
        view.label.setVisible(false);
        view.hpBar.setVisible(false);
    }

    private paintHpBar(
        gfx: Phaser.GameObjects.Graphics,
        x: number, y: number, w: number, h: number, pct: number,
    ): void {
        gfx.fillStyle(0x222222);
        gfx.fillRect(x, y, w, h);
        const col = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xddaa00 : 0xcc2222;
        gfx.fillStyle(col);
        gfx.fillRect(x, y, Math.max(1, Math.round(w * pct)), h);
    }

    // ── Highlight overlay ─────────────────────────────────────────────────────

    private drawHighlight(): void {
        this.highlight.clear();
        if (!this.selected) return;

        const sel          = this.selected;
        const { x, y }     = this.tileXY(sel.col, sel.row);

        // White outline on selected unit's tile
        this.highlight.lineStyle(2, 0xffffff, 1.0);
        this.highlight.strokeRect(x, y, TILE_W - 1, TILE_H - 1);

        if (this.battleState === 'unit_selected') {
            // Blue fill on reachable, empty move tiles
            this.highlight.fillStyle(0x4488ff, 0.28);
            this.grid.reachable(sel.col, sel.row, sel.data.move).forEach(c => {
                if (!this.unitAt(c.col, c.row)) {
                    this.highlight.fillRect(
                        GRID_OX + c.col * TILE_W,
                        GRID_OY + c.row * TILE_H,
                        TILE_W - 1, TILE_H - 1,
                    );
                }
            });
        }

        // Red outline on enemies the selected unit can attack from current position
        this.highlight.lineStyle(2, 0xff3333, 0.9);
        this.turns.aliveEnemy.forEach(e => {
            if (CombatSystem.canAttack(sel, e)) {
                this.highlight.strokeRect(
                    GRID_OX + e.col * TILE_W,
                    GRID_OY + e.row * TILE_H,
                    TILE_W - 1, TILE_H - 1,
                );
            }
        });
    }

    // ── FX ────────────────────────────────────────────────────────────────────

    private spawnDmgText(unit: Unit, dmg: number): void {
        const { x, y } = this.tileXY(unit.col, unit.row);
        const txt = this.add.text(x + TILE_W / 2, y + 2, `-${dmg}`, {
            fontFamily: 'monospace', fontSize: '9px',
            color: '#ff4444', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(200);
        this.tweens.add({
            targets: txt, y: y - 16, alpha: 0, duration: 700,
            ease: 'Power1', onComplete: () => { txt.destroy(); },
        });
    }

    private flashUnit(unit: Unit): void {
        const view = this.views.get(unit);
        if (!view) return;
        const restoreAlpha = unit.turnEnded ? 0.45 : 1;
        this.tweens.add({
            targets: view.body, alpha: 0.1, duration: 70,
            yoyo: true, repeat: 1,
            onComplete: () => { view.body.setAlpha(restoreAlpha); },
        });
    }

    // ── UI panels ─────────────────────────────────────────────────────────────

    private buildSidebar(): void {
        const sx = GAME_WIDTH - SIDEBAR_W;
        drawPanel(this, sx, 0, SIDEBAR_W, GAME_HEIGHT);
        this.add.text(sx + 5, 5, 'UNITS', FONT_TITLE);

        this.phaseText = this.add.text(sx + 5, 18, '▶ PLAYER', {
            fontFamily: 'monospace', fontSize: '8px', color: '#88aaff',
        });

        this.units.forEach((_u, i) => {
            const txt = this.add.text(sx + 5, 32 + i * 12, '', {
                fontFamily: 'monospace', fontSize: '7px', color: '#ffffff',
            });
            this.sidebarRows.push(txt);
        });
    }

    private buildInfoPanel(): void {
        const panelW = GAME_WIDTH - SIDEBAR_W - 8;
        drawPanel(this, 4, INFO_PANEL_Y, panelW, 46);

        this.activeText = this.add.text(9, INFO_PANEL_Y + 7, 'Select a unit', FONT_BASE);
        this.hintText   = this.add.text(9, INFO_PANEL_Y + 21, 'Click a friendly unit to act', {
            fontFamily: 'monospace', fontSize: '7px', color: '#888888',
        });
        this.add.text(9, INFO_PANEL_Y + 33, 'Z: end turn  |  ESC: camp  |  F1: debug', {
            fontFamily: 'monospace', fontSize: '7px', color: '#555555',
        });
    }

    private buildStatusBar(): void {
        drawPanel(this, 0, STATUS_Y, GAME_WIDTH - SIDEBAR_W, 20);
    }

    // ── UI refresh ────────────────────────────────────────────────────────────

    private refreshSidebar(): void {
        const phase = this.turns.phase;
        this.phaseText
            .setText(phase === 'player' ? '▶ PLAYER PHASE' : '▶ ENEMY PHASE')
            .setColor(phase === 'player' ? '#88aaff' : '#ff8888');

        this.units.forEach((u, i) => {
            const row = this.sidebarRows[i];
            if (!row) return;
            const hp   = u.isAlive ? `${u.hp}/${u.data.maxHp}` : 'dead';
            const done = u.isAlive && u.turnEnded ? '✓' : ' ';
            const col  = u.data.team === 'player' ? '#88aaff' : '#ff8888';
            row.setText(`${done}${u.data.name.slice(0, 5).padEnd(5)} ${hp}`)
               .setColor(col)
               .setAlpha(u.isAlive ? 1 : 0.35);
        });
    }

    private setState(state: BattleState): void {
        this.battleState = state;
        this.drawHighlight();
        this.refreshSidebar();

        // Active unit info
        if (this.selected) {
            const u = this.selected;
            this.activeText.setText(`${u.data.name} (${u.data.job})  HP ${u.hp}/${u.data.maxHp}`);
        } else {
            const label: Record<BattleState, string> = {
                player_idle:   'Select a unit',
                unit_selected: '',
                unit_moved:    '',
                enemy_phase:   'Enemy is thinking…',
                battle_over:   '',
            };
            this.activeText.setText(label[state]);
        }

        // Context hint
        const hint: Record<BattleState, string> = {
            player_idle:   'Click a friendly unit to act',
            unit_selected: 'Blue=move  Red=attack  Z=end turn',
            unit_moved:    'Click red enemy to attack  |  Z=end turn',
            enemy_phase:   '',
            battle_over:   '',
        };
        this.hintText.setText(hint[state]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private unitAt(col: number, row: number): Unit | undefined {
        return this.units.find(u => u.isAlive && u.col === col && u.row === row);
    }

    private occupiedSet(): Set<string> {
        const s = new Set<string>();
        this.units.filter(u => u.isAlive).forEach(u => s.add(`${u.col},${u.row}`));
        return s;
    }

    /** Top-left pixel of a grid tile. */
    private tileXY(col: number, row: number): { x: number; y: number } {
        return { x: GRID_OX + col * TILE_W, y: GRID_OY + row * TILE_H };
    }
}
