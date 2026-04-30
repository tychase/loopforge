# LoopForge handoff / minimal context reload

Last updated: 2026-04-30

## One-sentence project state

LoopForge is a Node 18-compatible Vite 5 + React 18 + TypeScript browser game prototype: a lightweight pseudo-FPV Vibe Jam arcade arena where the player collects vibe/code shards, uses mouse-look + keyboard/cursor movement, fires shard blasts, defeats silly judge chasers, and judges locally learn small per-match behaviors when they respawn.

## Where the project lives

- Repo: `/root/loopforge`
- Dev server currently observed on: `http://91.98.64.207:5174/`
- Local port: `5174`
- Current process observed: `node` listening on `0.0.0.0:5174`

## Important environment note

The "newer version of something" we were worried about was Node.js.

- Current runtime checked: Node `v18.19.1`, npm `9.2.0`
- The latest Vite/Vitest line wanted Node 20+ and failed here.
- To keep momentum, the app was pinned/scaffolded with Node 18-compatible versions:
  - Vite `^5.4.21`
  - Vitest `^1.6.1`
  - React `^18.3.1`
  - TypeScript `^5.7.3`
- If we later upgrade to current Vite/Vitest, install/use Node 20 or 22 first. Until then, do not casually run broad dependency upgrades that pull in Node 20-only packages.

## Verification status

Last verified with:

```bash
cd /root/loopforge
npm test
npm run build
```

Results:

- `npm test`: 15 tests passed
- `npm run build`: passed
- Browser smoke: `http://127.0.0.1:5174/` loaded with no console errors after clicking canvas; visual check showed HUD/canvas intact.

## Current git/worktree state

There are uncommitted changes. Do not assume the repo is clean.

Modified files observed:

- `GAME_DESIGN_PRINCIPLES.md`
- `HERMES_GAME_LAB_ARCHITECTURE.md`
- `PROJECT_BRIEF.md`
- `PROJECT_CONTEXT.md`
- `README.md`
- `src/App.tsx`
- `src/characters.ts`
- `src/game.test.ts`
- `src/game.ts`
- `src/styles.css`

Untracked directory:

- `docs/`

This handoff file is also in `docs/HANDOFF.md`.

## Core direction / product constraints

North star:

- Lightweight pseudo-FPV/open Vibe Jam arena.
- Player collects AI-code/vibe shards.
- Silly character versions of Vibe Jam judges chase the player.
- First combat mechanic: shard blasts.
- Judges have health, can be defeated, respawn, and locally learn small behaviors per match.
- Visual style should be silly arcade mascot sprite billboards.
- Humor should be affectionate parody, not mean-spirited.
- Future target: real-time multiplayer/open arena, but local/bot fallback is mandatory.

Hard MVP rules:

- Fun before impressive.
- Instant-loading browser game.
- No mandatory account/login.
- Avoid heavy assets and complex inventory.
- Avoid autonomous rewrite/deploy loops for MVP.
- Vibe Jam widget script belongs in the frontend:

```html
<script async src="https://vibej.am/2026/widget.js"></script>
```

## Current gameplay implemented

Implemented in `src/game.ts`, rendered in `src/App.tsx`, styled in `src/styles.css`, tested in `src/game.test.ts`.

Player/game loop:

- Pseudo-FPV canvas view.
- Player moves around an arena collecting shards.
- Waves, timer, score, upgrades, chasers.
- Arrow keys/WASD movement relative to the current view (forward/back/strafe).
- Mouse-look controls the player view after clicking the canvas for pointer lock.
- Q/E provide a keyboard-look fallback.
- Space/click fires shard blasts.

Judges/chasers:

- Judge definitions live in `src/characters.ts` as `JUDGE_CHASERS`.
- Each enemy has:
  - `health`
  - `maxHealth`
  - `status`: `chasing | defeated | respawning`
  - `respawnTimer`
  - `aliveTime`
  - `lastDamageDistance`
  - `experience`
- Judges chase the player while active.
- Defeated judges stop chasing, dim visually, then respawn.

Shard blasts:

- `fireShardBlast(state)` creates projectile blasts from the player heading.
- Blast constants in `src/game.ts`:
  - cooldown: `0.42`
  - speed: `720`
  - damage: `34`
  - max age: `0.9`
- Collision uses movement segment overlap, so fast blasts should not tunnel through judges.

Judge defeat/scoring:

- Damaging a judge gives a small score increment.
- Defeating a judge gives a larger score increment.
- Defeat stores last defeat details for local learning.
- Defeat starts respawn timer and updates message.

Local per-match judge learning:

- `JudgeExperience` tracks:
  - `level`
  - `experience`
  - `defeats`
  - behavior weights: `chase`, `guardShards`, `zigZag`, `retreatWhenHurt`
  - `lastDefeat`
- On respawn, a defeated judge learns one bounded behavior adjustment.
- Current simple rules include:
  - defeated from far away -> learns more zig-zag
  - survived a long time -> learns aggression/chase
  - otherwise learns basic survival/retreat
- This is intentionally local to the current match. No global persistence yet.

Judge/character definitions:

- Judge definitions now live in `src/characters.ts`.
- `src/characters.ts` exports:
  - `CharacterAnimation`: `idle | chase | attack | hurt | defeated | respawn`
  - `CharacterSprites`: optional sprite path map keyed by animation
  - `JudgeChaser`
  - `JUDGE_CHASERS`
- `src/game.ts` re-exports character types/data for compatibility and uses `JUDGE_CHASERS` to spawn enemies.

Rendering/UI:

- Canvas pseudo-FPV sky/floor grid.
- Responsive layout keeps the arena visible on smaller laptop-height screens; extra panels compact/hide on short viewports.
- Shards render as glowing diamonds.
- Blasts render visually in FPV and minimap.
- Judges render as optional sprite billboards when `JudgeChaser.sprites` image paths are available and loaded.
- Missing/unloaded/broken sprite images gracefully fall back to the neon card renderer with health bars.
- Defeated judges are dimmed.
- HUD shows score, wave, clock, active judges, blast readiness/cooldown, message.
- Minimap shows player, shards, judges, blasts.

## Existing plan document

Roadmap/art docs exist at:

- `/root/loopforge/docs/plans/2026-04-30-arena-characters-combat-roadmap.md`
- `/root/loopforge/docs/art-direction.md`

Notable roadmap state:

- Phase 1: core feel/readability.
- Phase 2: move judge definitions into `src/characters.ts`, add sprite billboard support, create art direction doc.
- Phase 3: combat. Judge health/player attack/combat scoring are partly/mostly implemented already.
- Phase 4: local judge learning is partly/mostly implemented already.
- Phase 5: leaderboard/open arena/multiplayer later.

## Recommended next implementation steps

Best next code tasks, in order:

1. Tune game feel now that the mouse-look/combat loop is playable.
   - Movement speed and mouse sensitivity.
   - Blast damage/cooldown.
   - Judge health and respawn time.
   - Score balance between shards, damage, defeats, survival.

2. Add clearer threat/proximity feedback.
   - Nearest judge helper/test.
   - On-screen danger warning.
   - Better audio/visual-like cues using CSS/canvas only.

3. Only after the single-player loop feels fun: optional leaderboard/open arena design.

## Commands to use after clearing context

```bash
cd /root/loopforge
node --version
npm --version
npm test
npm run build
git status --short
```

If dev server is not running:

```bash
cd /root/loopforge
npm run dev -- --host 0.0.0.0 --port 5174
```

If it is already running and hot-reloading, do not start another server on the same port.

## Suggested prompt after clearing context

Paste this into the fresh session:

```text
We are working on LoopForge at /root/loopforge. Please read /root/loopforge/docs/HANDOFF.md and continue from there. First run git status, node --version, npm --version, npm test, and npm run build. Then proceed with the next recommended frontend task unless I specify otherwise.
```

## Context-management recommendation

Best practical approach:

1. Keep compact durable project handoff docs in the repo, like this file.
2. Use `/compress` if you want to continue the same session but shrink the chat context.
3. Use `/new` or `/clear` when the context is messy or nearly full, then point the new session at this handoff file.
4. Keep stable facts in Hermes memory only if they are durable and broadly useful.
5. Keep procedures/workflows in Hermes skills, not memory.
6. Keep task-specific state in repo docs, not hidden chat context.

For this project, a repo handoff doc plus a fresh session is usually better than relying on automatic compression alone, because the next agent can verify the actual filesystem and tests instead of trusting a lossy chat summary.
