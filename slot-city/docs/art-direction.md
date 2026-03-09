# Slot City — Art Direction

## Visual Style

**Isometric 2.5D** — the game renders in a classic isometric perspective, not top-down and not full 3D.

This means:
- All world objects are drawn as if viewed from a 45° angle from above and the side simultaneously
- The camera does not rotate; the world is a fixed isometric projection
- Depth is sorted by tile position (X + Y), not by Z in a 3D scene
- All graphics are 2D sprites or procedural 2D graphics

## Why Isometric 2.5D?

1. **Social readability**: Players can see avatars and furniture from a natural, human-scale angle. Top-down is too flat; full 3D requires heavy asset pipelines.
2. **Browser performance**: 2D rendering in Phaser is extremely performant. No WebGL shaders required.
3. **Art pipeline simplicity**: Isometric sprite sheets require fewer angles (typically 4 or 8 directions) and are easily AI-generated.
4. **Classic social game lineage**: The Sims Online, Habbo Hotel, and Club Penguin all proved this format works for social MMOs.
5. **Scalable world design**: Rooms are defined as tile grids. New rooms can be added without rebuilding the engine.

## Character Style

**Simple Sims-like isometric humans.**

Design principles:
- Adult proportions (not chibi)
- Simple, readable silhouette
- Low-detail clothing
- Limited animation frames (4 directions × idle/walk/seated/emote = 16 frames minimum)
- Easy recolor system for cosmetics (outfit color is a single tint value)
- Clear in crowded social environments (distinct username label above head)

Avoid:
- Chibi proportions
- Highly realistic anatomy
- Complex 3D rigs
- Art styles requiring heavy animation pipelines

### Minimum Avatar Animations

| State | Description |
|-------|-------------|
| idle | Stand still, slight breathing movement |
| walk | 4-directional walk cycle, ~6 frames per direction |
| seated | Sitting position on stools or chairs |
| emote | Short reaction animation triggered by player |

### Future Avatar Layers

When the asset pipeline is ready:
- Base body (4 directions × 4 states)
- Skin tone variants (tint)
- Hair layer
- Outfit layer (torso + legs, recolorable)
- Accessory layer (hat, glasses)

## Environment Style

**Neon Vegas meets isometric social space.**

Color palette:
- Floor: Deep blues and navy (`#1a1a2e`, `#16213e`)
- Accents: Neon orange/yellow/green (`#ff8800`, `#ffd700`, `#44ff88`)
- Furniture: Warm browns and reds for wood, rich greens for felt
- Background: Near-black (`#0a0a1a`)
- UI: Dark glass panels with colored borders

### Tile System

Tiles are 64×32 pixels (standard 2:1 isometric diamond).

Tile types needed:
- Floor: casino carpet, hardwood, marble
- Wall: dark paneled, brick
- Transition tiles (corners, edges)

### Props

| Prop | Usage |
|------|-------|
| Poker table | PokerTableRoom, elliptical, green felt |
| Slot machine | Lobby slot floor, tall rectangular cabinet |
| Bar counter | BarRoom, L-shaped dark wood |
| Bar stool | BarRoom, cylindrical red seat |
| Lounge sofa | BarRoom, long dark couch |
| Coffee table | BarRoom, small oval |
| Tournament board | Lobby + Bar, large backlit sign |
| Entrance sign | Lobby, neon marquee |
| VIP rope | Lobby, golden stanchion + velvet rope |
| Blackjack table | BlackjackTableRoom, semi-circular |

## Asset Folder Structure

```
apps/game-client/public/assets/
  tiles/
    floor-blue-a.png
    floor-blue-b.png
    floor-carpet-a.png
    wall-dark-a.png
  props/
    poker-table.png
    slot-machine.png
    bar-counter.png
    barstool.png
    lounge-sofa.png
    tournament-board.png
  avatars/
    base-south-idle.png        (placeholder until sprite sheets available)
    base-south-walk-0.png
    base-north-idle.png
    ...
  ui/
    chat-bubble.png
    hud-bg.png
```

All assets are swappable PNG sprite sheets. The code references asset keys loaded in `PreloadScene.ts`.

## Placeholder Strategy

Current state: all graphics are drawn procedurally using Phaser Graphics API.

Each prop and tile has a corresponding `draw*()` method that renders placeholder shapes. When real assets are ready:

1. Add sprite sheet loading in `PreloadScene.preload()`
2. Replace `add.graphics()` calls in each scene's `draw*()` method with `add.image()` or `add.sprite()`
3. Avatar `drawBody()` in `PlayerAvatar.ts` becomes a sprite with animation state

The system is designed to make this swap require only local changes in each draw method.
