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

Threat feedback:

- Nearest judge targeting line.
- Player proximity warning rings after grace.
- Judge threat aura and lunge pulse when close.
- Offscreen edge arrows for judges outside the camera view.
- Screen-edge pulse when danger is high.

## Strategic Priority

Make the game look and feel professional before adding complex mechanics.

The next feature patches should stay small and high-impact:

1. Shard collection juice and combo feedback.
2. Upgrade choice polish and stronger build identity.
3. Judge personality pass: each judge gets one simple readable behavior.
4. Arena visual pass: portals, lab boundary props, parallax particles, better floor lighting.
5. Submission pass: fast load, widget, mobile-ish check, no console errors, clear first screen.

Avoid for now:

- full Three.js rewrite
- real multiplayer
- inventory systems
- rooms/buildings/pathfinding
- account/login systems
- complex procedural generation
- heavy assets that slow first load

## Next Recommended Patch

Do the shard collection juice pass next.

Scope:

- pickup trails from shard to player
- score popups
- small burst particles
- stronger magnet visual when a shard is within pickup range
- combo/streak counter for fast pickups
- tests only for any new state transitions, not for every visual particle

Reason:

The player needs a satisfying reward beat every few seconds. This is the fastest path from "prototype" to "one more run."

## Fresh Chat Prompt

Use this in the next chat:

```text
We are working on LoopForge at D:\hermes-arcade\loopforge. Please read docs/HANDOFF.md and docs/CURRENT_DIRECTION.md first. Then run git status --short, npm test, and npm run build. Continue with the next recommended patch unless I specify otherwise.
```

If the dev server is not already running:

```bash
npm run dev -- --host 0.0.0.0 --host 127.0.0.1 --port 5173
```
