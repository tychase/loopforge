# LoopForge art direction

Last updated: 2026-04-30

## North star

LoopForge should look like a fast, silly arcade mascot fever dream: neon pseudo-FPV arena, chunky sprite billboards, glowing vibe shards, and judge chasers that read instantly at small size.

The goal is affectionate parody and readable arcade action, not realistic portraits or mean-spirited caricature.

## Sprite billboard format

Target sizes:

- Preferred source size: 256x256 PNG with transparency.
- Minimum acceptable game size: 128x128 PNG with transparency.
- Keep files lightweight; avoid large spritesheets until the gameplay earns them.
- Use square canvases and center the mascot silhouette.

Future asset paths can hang off `JudgeChaser.sprites` in `src/characters.ts`:

```ts
sprites: {
  idle: '/characters/levelsio-idle.png',
  chase: '/characters/levelsio-chase.png',
  attack: '/characters/levelsio-attack.png',
  hurt: '/characters/levelsio-hurt.png',
  defeated: '/characters/levelsio-defeated.png',
  respawn: '/characters/levelsio-respawn.png',
}
```

## Animation states

The character type supports these states:

- `idle`: default readable mascot pose.
- `chase`: leaning forward, energetic, threatening but goofy.
- `attack`: exaggerated scorecard / laser pointer / vibe-zap pose.
- `hurt`: surprised squash-and-stretch reaction.
- `defeated`: dimmed, dizzy, taking notes, or holding a tiny “BRB” sign.
- `respawn`: glitchy reload / scorecard reboot pose.

## Character design rules

Do:

- Use big readable shapes and flat arcade colors.
- Use each judge's existing game color from `src/characters.ts` as the accent color.
- Make characters mascot-like: hats, scorecards, controllers, lightning bolts, floating badges.
- Push silhouettes more than facial likeness.
- Make everyone look like they belong in the same toybox.

Do not:

- Use realistic portraits or photo traces.
- Make ugly, cruel, or defamatory caricatures.
- Add heavy visual detail that disappears in motion.
- Depend on external images at runtime for MVP.

## Current fallback style

`src/App.tsx` now attempts to draw optional `JudgeChaser.sprites` image billboards first. If a sprite path is absent, still loading, or broken, it falls back to neon card billboards with:

- emoji avatar,
- handle,
- role label,
- health bar,
- short bark text.

Keep this fallback. Sprite loading should be optional and should gracefully fall back to the current card renderer when an image is missing.

## Visual priorities

1. Readability at speed.
2. Instant loading.
3. Silly mascot energy.
4. Clear health / defeat / respawn state.
5. Consistent neon arcade palette.

## Next implementation notes

- Add actual lightweight placeholder or generated transparent PNGs under a stable public asset path, then wire them into `JudgeChaser.sprites`.
- Never block gameplay on asset loading.
- Keep the minimap symbolic even after billboard sprites are added.
- If generated art is used, post-process it into simple transparent PNGs instead of shipping large raw outputs.
