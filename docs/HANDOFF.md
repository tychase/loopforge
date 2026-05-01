# LoopForge Handoff

Last updated: 2026-05-01

## One-Sentence State

LoopForge is now a playable Vite 5 + React 18 + TypeScript browser arcade arena: move through a 2.5D projected lab floor, collect shards, avoid judge chasers, fire shard blasts, survive waves, pick upgrades, and watch judges take damage, respawn, and adapt locally within the match.

## Current Workspace

- Repo on this machine: `D:\hermes-arcade\loopforge`
- Dev server currently verified on: `http://127.0.0.1:5173`
- Main app: `src/App.tsx`
- Simulation: `src/game.ts`
- Judge config: `src/characters.ts`
- Render helpers: `src/game/render/`
- Tests: `src/game.test.ts`, `src/game/monsterAssets.test.ts`, `src/game/render/projection.test.ts`

## Verification Status

Last verified:

```bash
npm test
npm run build
```

Results:

- `npm test`: 32 tests passed
- `npm run build`: passed
- Browser smoke: `http://127.0.0.1:5173` loaded, start button worked, player movement worked, canvas click fired a shard blast, no Vite overlay, no runtime errors.

## Important Worktree Note

The repo has ongoing uncommitted work. Do not assume a clean tree, and do not revert unrelated changes.

Known active areas include:

- `src/App.tsx`
- `src/game.ts`
- `src/game.test.ts`
- `src/characters.ts`
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

- stronger 2.5D arena presentation
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
- Blasts auto-lock toward the nearest active judge.
- Waves end by timer or shard clear.
- Upgrade choice starts the next wave.

Judges:

- Judge definitions live in `src/characters.ts`.
- Active judges chase the player after the grace window.
- Judges have health, max health, status, respawn timers, and local match experience.
- Defeated judges stop chasing, award score, then respawn.
- Respawned judges can learn bounded local behavior changes.

Rendering:

- The game now uses a 2.5D camera-follow arena, not the older pseudo-FPV tunnel direction.
- `src/game/render/camera.ts` computes the camera-follow world view.
- `src/game/render/projection.ts` maps 2D world coordinates into angled screen coordinates.
- The arena draws a compressed perspective-style grid and projected boundary lines.
- Entities use Y-based scale, elliptical shadows, and screen-Y render sorting.
- Judge and player presentation is billboard-style.
- UI remains separate from transformed world rendering.
- Shard pickups now create shard-to-player trails, small burst particles, score popups, magnet preview tethers, and a combo/streak HUD readout.
- The arena includes a canvas-drawn `Vibe Jam Portal` exit portal.
- Portal arrivals with `?portal=true` skip the start overlay, spawn the player into the arena, and create a nearby return portal when `ref` is present.
- The page chrome above and below the arena has been removed. Essential run stats now render inside the canvas HUD so the arena is the first meaningful viewport.

Threat feedback:

- Nearest judge targeting line.
- Player proximity warning rings after grace.
- Judge threat aura and lunge pulse when close.
- Offscreen edge arrows for judges outside the camera view.
- Screen-edge pulse when danger is high.

## Strategic Priority

Make the game look and feel professional before adding complex mechanics.

The next feature patches should stay small and high-impact:

1. Upgrade choice polish and stronger build identity.
2. Judge personality pass: each judge gets one simple readable behavior.
3. Arena visual pass: portals, lab boundary props, parallax particles, better floor lighting.
4. Submission pass: fast load, widget, mobile-ish check, no console errors, clear first screen.

Avoid for now:

- full Three.js rewrite
- real multiplayer
- inventory systems
- rooms/buildings/pathfinding
- account/login systems
- complex procedural generation
- heavy assets that slow first load

## Recent Patch

Shard collection juice, upgrade moment polish, and Vibe Jam portal support are implemented.

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
- arena-first layout with compact in-canvas score/wave/clock/blast/combo HUD
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
We are working on LoopForge at D:\hermes-arcade\loopforge. Please read docs/HANDOFF.md and docs/CURRENT_DIRECTION.md first. Then run git status --short, npm test, and npm run build. Continue with the next recommended patch unless I specify otherwise.
```

If the dev server is not already running:

```bash
npm run dev -- --host 0.0.0.0 --host 127.0.0.1 --port 5173
```
