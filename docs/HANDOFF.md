# LoopForge Handoff

Last updated: 2026-05-01

## One-Sentence State

LoopForge is now a playable Vite 5 + React 18 + TypeScript + ThreeJS browser arcade arena: move through a 3D neon lab floor, collect shards, avoid judge chasers, fire shard blasts, survive waves, pick upgrades, and watch judges take damage, respawn, and adapt locally within the match.

## Current Workspace

- Repo on this machine: `D:\hermes-arcade\loopforge`
- Dev server currently verified on: `http://127.0.0.1:5180`
- Main app: `src/App.tsx`
- ThreeJS renderer: `src/ThreeCanvas.tsx`
- React HUD overlay: `src/GameHud.tsx`
- Simulation: `src/game.ts`
- Judge config: `src/characters.ts`
- Legacy 2.5D render helpers: `src/game/render/`
- Tests: `src/game.test.ts`, `src/game/monsterAssets.test.ts`, `src/game/render/projection.test.ts`

## Verification Status

Last verified:

```bash
npm test
npm run build
```

Results:

- `npm test`: 35 tests passed
- `npm run build`: passed; Vite reports the expected large chunk warning after adding ThreeJS (`~190.8 kB` gzip JS)
- Browser smoke: `http://127.0.0.1:5180` loaded, start button worked, player movement worked, ThreeJS canvas rendered, Vibe Jam widget remained visible, no Vite overlay, no console errors or warnings.

## Important Worktree Note

The repo has ongoing uncommitted work. Do not assume a clean tree, and do not revert unrelated changes.

Known active areas include:

- `src/App.tsx`
- `src/game.ts`
- `src/game.test.ts`
- `src/characters.ts`
- `src/ThreeCanvas.tsx`
- `src/GameHud.tsx`
- `src/game/render/`
- `public/assets/`
- `docs/`

## Product Strategy

The target is not a deep systems game. The target is a professional-feeling, instantly playable, visually impressive web arcade game with strong Vibe Jam judge references.

Mechanics should be "just good enough" to support replay, clarity, and flow:

- clear movement
- clear collection
- clear danger
- satisfying shard blast
- short waves
- meaningful but simple upgrades
- judges that are readable and funny

Once those are stable, most effort should go into:

- stronger ThreeJS arena presentation
- judge character identity
- sprite/billboard polish
- particles and screen feedback
- readable UI/hud polish
- first-60-seconds pacing
- submission reliability

## Implemented Gameplay

Core loop:

- Ready screen starts the run.
- Player moves with WASD/arrow keys.
- Player collects shards for score.
- Shard pickups use the player's collision radius and magnet radius.
- Space/click fires shard blasts.
- Mouse cursor aims shard blasts; movement does not change aim.
- Waves end by timer or shard clear.
- Upgrade choice starts the next wave.

Judges:

- Judge definitions live in `src/characters.ts`.
- Active judges chase the player after the grace window.
- Judges have health, max health, status, respawn timers, and local match experience.
- Defeated judges stop chasing, award score, then respawn.
- Respawned judges can learn bounded local behavior changes.

Rendering:

- The game now uses a staged ThreeJS camera-follow arena, not the older canvas-only renderer.
- `src/ThreeCanvas.tsx` reads the existing `GameState` snapshot and renders the arena as a 3D floor plane/grid.
- Player, shards, blasts, portals, and judges render as simple 3D objects and billboards.
- The camera follows from an angled third-person/top-down perspective.
- Lighting, emissive materials, additive glow meshes, and fake shadows provide the current 3D look without postprocessing or large assets.
- `src/GameHud.tsx` keeps score, wave, clock, boss health, minimap, threat, and notice UI in React overlays.
- `src/game.ts` remains the simulation source of truth.
- Shard pickups now create shard-to-player trails, small burst particles, score popups, magnet preview tethers, and a combo/streak HUD readout.
- The arena includes a ThreeJS-rendered `Vibe Jam Portal` exit portal.
- Portal arrivals with `?portal=true` skip the start overlay, spawn the player into the arena, and create a nearby return portal when `ref` is present.
- The page chrome above and below the arena has been removed. Essential run stats now render as React overlays on top of the ThreeJS scene so the arena is the first meaningful viewport.

Threat feedback:

- Nearest-judge threat panel.
- Grace ring, judge aura, boss health, minimap, and notice overlays.
- React HUD stays separate from the ThreeJS world render.

## Strategic Priority

Make the game look and feel professional before adding complex mechanics.

The next feature patches should stay small and high-impact:

1. Upgrade choice polish and stronger build identity.
2. Judge personality pass: each judge gets one simple readable behavior.
3. Arena visual pass: portals, lab boundary props, parallax particles, better floor lighting.
4. Submission pass: fast load, widget, mobile-ish check, no console errors, clear first screen.

Avoid for now:

- gameplay rewrites beyond the staged ThreeJS renderer
- real multiplayer
- inventory systems
- rooms/buildings/pathfinding
- account/login systems
- complex procedural generation
- heavy assets that slow first load

## Recent Patch

Shard collection juice, upgrade moment polish, Vibe Jam portal support, and the initial ThreeJS arena renderer layer are implemented.

Added:

- pickup trails from shard to player
- score popups
- small burst particles
- stronger magnet preview visual when a shard is close to pickup range
- combo/streak counter for fast pickups
- focused test coverage for pickup feedback and combo expiry
- more dramatic upgrade overlay with mutation tags, sigils, and next-wave language
- exit portal collision for `https://vibej.am/portal/2026`
- portal arrival support for `?portal=true`
- return portal support when a `ref` query parameter exists
- arena-first ThreeJS scene with React score/wave/clock/blast/combo HUD
- focused test coverage for exit/return portal triggers

## Next Recommended Patch

Do a compact arena visual pass next.

Scope:

- animated boundary lights
- portal staging polish
- corner lab machinery silhouettes
- subtle parallax lab particles
- keep gameplay collision unchanged

Reason:

The core reward, upgrade, and portal loops now exist. The fastest route to "impressive" is making the arena feel more staged and intentional without adding systems risk.

## Submission Requirements Status

- Required widget snippet is present in `index.html`:

```html
<script async src="https://vibej.am/2026/widget.js"></script>
```

- Exit portal is implemented in the arena and redirects to `https://vibej.am/portal/2026`.
- Exit portal sends continuity params including `username`, `color`, `speed`, and `ref`.
- `ref` is built from the current game origin/path so final deployment should use one canonical domain.
- Receiving `?portal=true` starts the game immediately with no start overlay.
- Receiving `?portal=true&ref=...` adds a nearby return portal that redirects back to the previous game while preserving continuity params.
- Remaining submission responsibility: deploy to one stable domain and use that single domain as the submitted URL.

## Fresh Chat Prompt

Use this in the next chat:

```text
We are working on LoopForge at D:\hermes-arcade\loopforge. Please read docs/HANDOFF.md, docs/CURRENT_DIRECTION.md, and docs/art-direction.md first. Then run git status --short, npm test, and npm run build. The project is now classified as ThreeJS, but this is a staged migration: keep React UI overlays and keep src/game.ts as the simulation source of truth. Continue with the next recommended patch unless I specify otherwise.
```

If the dev server is not already running:

```bash
npm run dev -- --host 0.0.0.0 --host 127.0.0.1 --port 5180
```

Suggested next steps for the next chat:

1. Tighten the ThreeJS camera framing so the player stays comfortably inside the first viewport while moving in all directions.
2. Add lightweight ThreeJS arena staging: animated rail lights, better portal glow, corner machinery silhouettes, and subtle lab particles.
3. Run a submission pass: mobile-ish viewport smoke, portal handoff smoke, widget visibility, console errors, bundle size note, and final deploy readiness.
