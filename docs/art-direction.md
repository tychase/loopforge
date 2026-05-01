# LoopForge Art Direction

Last updated: 2026-05-01

## North Star

LoopForge should look like a polished neon AI-lab arcade arena: fast, readable, funny, and more professional than its simple mechanics imply.

The game should win attention visually first, then keep attention through a clean reward/danger loop. The judge references are the signature hook.

## Current Visual Baseline

The renderer is now a lightweight 2.5D canvas arena:

- camera-follow world view
- angled projection floor grid
- projected arena boundaries
- screen-Y depth sorting
- scale-by-Y entities
- billboard player and judge characters
- elliptical shadows
- shard/blast VFX sheet support
- threat rings, lunge aura, edge arrows, and danger vignette

Keep this path for the jam build. Do not switch to Three.js unless canvas polish becomes the blocker.

## Desired Look

The visual tone should combine:

- neon AI lab
- arcade boss arena
- crisp UI
- readable mascot billboards
- glowing shards and particles
- playful Vibe Jam contest parody

It should not look like a generic dark sci-fi template. The judge bosses, shard effects, and Hermes lab context should make it feel specific.

## Professional Polish Priorities

Prioritize:

1. Readability at motion.
2. Satisfying pickup/combat feedback.
3. Strong judge silhouettes.
4. Clear danger telegraphs.
5. Fast load and lightweight assets.
6. Consistent color roles.
7. Clean HUD with no text overflow.

Avoid:

- overly detailed sprites that disappear at game scale
- realistic portraits
- heavy full-screen images
- large raw generated assets
- visual effects that hide collision clarity
- UI panels that explain mechanics with too much text

## Sprite Billboard Format

Target format:

- 256x256 PNG with transparency preferred
- 128x128 PNG with transparency acceptable
- square canvas
- centered silhouette
- strong outline
- limited palette
- readable at small size

Animation states supported by `src/characters.ts`:

- `idle`
- `chase`
- `attack`
- `hurt`
- `defeated`
- `respawn`

Future sprite paths should hang off `JudgeChaser.sprites`:

```ts
sprites: {
  idle: '/assets/judges/levelsio/idle.png',
  chase: '/assets/judges/levelsio/chase.png',
  attack: '/assets/judges/levelsio/attack.png',
  hurt: '/assets/judges/levelsio/hurt.png',
  defeated: '/assets/judges/levelsio/defeated.png',
  respawn: '/assets/judges/levelsio/respawn.png',
}
```

Missing sprites must gracefully fall back to canvas-drawn billboards.

## Judge Character Direction

Each judge needs a simple visual identity:

- `@levelsio`: launch timer, speed lines, yellow/orange warning color, direct pressure.
- `@S13K_`: magenta/cyan verdict blade or scorecard duelist, dash/lunge motif.
- `@TIMSORET`: cyan game-feel meter, controller/projectile motif, hazard pulse motif.
- `@NICOLAMANZINI`: green/yellow polish scanner, shard-guarding motif.
- `@EDWINARBUS`: purple/magenta vibe containment, charging intensity motif.

Use handles and boss titles in UI. Make visuals archetypal and readable rather than realistic likenesses.

## Arena Direction

Next arena visual additions should be lightweight canvas elements:

- judge spawn portals
- animated boundary lights
- floor highlight pulses
- parallax lab particles
- corner machinery silhouettes
- shard pickup trails
- score popups
- brief impact flashes

These should reinforce the 2.5D illusion without changing collision or movement logic.

## VFX Direction

Shard collection should be the next visual priority.

Add:

- magnet pull streaks
- shard-to-player trails
- small burst particles
- score popups
- combo pulse

Threat VFX should remain readable:

- danger rings show range
- lunge aura shows imminent contact
- edge arrows show offscreen direction
- screen-edge pulse signals high danger

## Asset Rule

Use generated or handmade bitmap assets only when they clearly improve the game at runtime scale.

Before shipping an asset:

- make it transparent
- compress it
- verify it renders in the browser
- verify it reads at the actual canvas size
- keep fallback rendering working
