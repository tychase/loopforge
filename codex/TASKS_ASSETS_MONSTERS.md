# Codex Task: Monster Asset Pipeline

## Goal

Implement the full monster asset pipeline for the Cursor Vibe Jam 2026 web arena game.

The game is an arena survival game where monsters chase the player. Monsters are parody/caricature versions of Vibe Jam judges, themed around AI coding, game jams, browser chaos, and indie hacker energy.

## Direction

- Use lightweight 2D sprites with transparent PNGs.
- Do not use photorealistic likenesses.
- Use exaggerated parody monster designs inspired by public personas, roles, and judging archetypes.
- Keep sprites readable at small canvas sizes.
- Keep the runtime resilient when final art is missing.

## Monster Roster

1. The Shipper, inspired by @levelsio, organizer
2. The Silent Reviewer, inspired by @s13k_, lead judge
3. The Perfectionist, inspired by @timsoret, game dev judge
4. The Optimizer, inspired by @NicolaManzini, judge
5. The Autocoder, inspired by @edwinarbus, judge

## Asset Format

- One sprite sheet per monster.
- Frame size: 128x128.
- Sheet size: 512x512.
- Layout: 4 columns x 4 rows.
- Row 0: idle, 4 frames.
- Row 1: chase, 4 frames.
- Row 2: attack, 4 frames.
- Row 3: death, 4 frames.
- Transparent background.
- Pixel, low-poly, glitch arcade style.

## Required Files

- `public/assets/monsters/`
- `public/assets/monsters/README.md`
- `src/game/assets/monsterAtlas.ts`
- `src/game/monsters/monsterTypes.ts`
- `src/game/monsters/monsterFactory.ts`
- `src/game/monsters/monsterAnimations.ts`
- `src/game/systems/monsterSpawnSystem.ts`
- `src/game/systems/monsterCombatSystem.ts`

## Monster Data Contract

Each monster definition must include:

- `id`
- `displayName`
- `spriteSheetPath`
- `speed`
- `hp`
- `damage`
- `attackCooldownMs`
- `spawnWeight`
- `abilityName`
- `abilityDescription`
- `voiceLines`

## Animation Keys

- `idle`
- `chase`
- `attack`
- `death`

## Placeholder Policy

Final PNG sprite sheets are not required for the pipeline to compile or run.

If a monster PNG is missing, code must resolve a deterministic placeholder descriptor containing colored frame boxes and labels. Real PNG sheets can later be dropped into `public/assets/monsters/` without code changes.

## Tests

Add and keep green:

- Unit tests for monster definitions.
- Tests confirming all sprite paths exist or fall back safely.
- Tests confirming animation frame ranges are valid.
- Tests confirming spawn weights are positive.

## Validation

Run:

```bash
npm test
npm run build
```
