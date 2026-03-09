import Phaser from "phaser";
import { PlayerAvatar } from "./PlayerAvatar";
import { PlayerState, PlayerDirection, PlayerAnimState, IsoPosition } from "@slot-city/shared";
import { screenToIso } from "./IsoRenderer";
import { MsgMove } from "@slot-city/shared";

/**
 * Manages local player input and sends movement updates to server.
 */
export class MovementController {
  private scene: Phaser.Scene;
  private avatar: PlayerAvatar;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private onMove: (msg: MsgMove) => void;
  private lastMoveTime = 0;
  private readonly MOVE_COOLDOWN_MS = 150;
  private isSeated = false;

  constructor(scene: Phaser.Scene, avatar: PlayerAvatar, onMove: (msg: MsgMove) => void) {
    this.scene = scene;
    this.avatar = avatar;
    this.onMove = onMove;
    this.setupInput();
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Click to move
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isSeated) return;
      const iso = screenToIso(pointer.worldX, pointer.worldY);
      this.sendMove(iso.tileX, iso.tileY, PlayerDirection.SOUTH);
    });
  }

  setSeated(seated: boolean): void {
    this.isSeated = seated;
  }

  update(_time: number, _delta: number): void {
    if (this.isSeated) return;

    const now = Date.now();
    if (now - this.lastMoveTime < this.MOVE_COOLDOWN_MS) return;

    let dx = 0;
    let dy = 0;
    let dir = PlayerDirection.SOUTH;

    const upPressed = this.cursors.up.isDown || this.wasd.up.isDown;
    const downPressed = this.cursors.down.isDown || this.wasd.down.isDown;
    const leftPressed = this.cursors.left.isDown || this.wasd.left.isDown;
    const rightPressed = this.cursors.right.isDown || this.wasd.right.isDown;

    if (upPressed && leftPressed) { dx = -1; dy = -1; dir = PlayerDirection.NORTH; }
    else if (upPressed && rightPressed) { dx = 1; dy = -1; dir = PlayerDirection.EAST; }
    else if (downPressed && leftPressed) { dx = -1; dy = 1; dir = PlayerDirection.WEST; }
    else if (downPressed && rightPressed) { dx = 1; dy = 1; dir = PlayerDirection.SOUTH; }
    else if (upPressed) { dx = 0; dy = -1; dir = PlayerDirection.NORTH; }
    else if (downPressed) { dx = 0; dy = 1; dir = PlayerDirection.SOUTH; }
    else if (leftPressed) { dx = -1; dy = 0; dir = PlayerDirection.WEST; }
    else if (rightPressed) { dx = 1; dy = 0; dir = PlayerDirection.EAST; }

    if (dx !== 0 || dy !== 0) {
      const newX = this.avatar.tileX + dx;
      const newY = this.avatar.tileY + dy;
      this.sendMove(newX, newY, dir);
      this.lastMoveTime = now;
    }
  }

  private sendMove(tileX: number, tileY: number, direction: PlayerDirection): void {
    // Clamp to walkable area
    const clampedX = Math.max(0, Math.min(30, tileX));
    const clampedY = Math.max(0, Math.min(30, tileY));

    this.avatar.moveTo(clampedX, clampedY);
    this.avatar.setDirection(direction);
    this.avatar.setAnimState(PlayerAnimState.WALK);

    this.onMove({
      type: "MOVE",
      pos: { tileX: clampedX, tileY: clampedY },
      direction,
    });
  }
}
