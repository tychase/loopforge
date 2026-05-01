# LoopForge Current Direction

Last updated: 2026-05-01

## Goal

Build LoopForge into a professional-feeling Vibe Jam arcade game that looks impressive quickly, is understandable in seconds, and uses the contest judge references as the memorable hook.

The intended standard is not "largest mechanics list." The intended standard is:

- instantly playable
- visually polished
- funny judge references
- clear danger and reward feedback
- fast restart loop
- no login
- no heavy load
- no confusing systems

## Current Position

LoopForge has crossed from rough prototype into a playable vertical slice foundation.

Already in place:

- staged ThreeJS camera-follow arena renderer
- 3D neon floor plane/grid with angled third-person camera follow
- simple 3D/billboard player, shards, portals, blasts, and judge bosses
- shard collection
- shard collection trails, score popups, burst particles, magnet preview tethers, and combo/streak feedback
- shard blast combat
- judge health/defeat/respawn
- local per-match judge learning
- wave timer
- upgrade choice
- polished upgrade mutation overlay with tags, sigils, and next-wave language
- Vibe Jam exit portal and portal-arrival return portal support
- arena-first layout with React HUD overlays above the ThreeJS scene
- threat warning rings, lunge aura, edge arrows, and danger pulse
- tests/build passing

This means the next work should not chase big new systems. The next work should make every existing interaction feel better.

## Design Philosophy

Mechanics, theory, and psychology should be good enough to support flow, replay, and clarity.

The bulk of effort should now move toward presentation:

- satisfying feedback
- readable silhouettes
- strong judge identity
- polished arena staging
- short-run drama
- memorable Vibe Jam theming

Use game design and psychology as guardrails, not as an excuse to build deep systems.

The player should feel:

- "I know what to do."
- "That pickup felt good."
- "That judge is getting close."
- "I barely escaped."
- "This upgrade changes my next run."
- "The judge references are funny and specific."

## North Star Experience

In the first 60 seconds:

1. The player sees a polished lab arena and judge bosses.
2. The player starts immediately.
3. Shards pull attention with glow, trails, and pickup reward.
4. Judges enter as physical threats with obvious warnings.
5. The player fires a readable shard blast.
6. The wave ends quickly enough to see an upgrade.
7. The player wants to retry or continue.

## Visual Direction

Engine classification: ThreeJS.

Keep this as a staged migration, not a full game rewrite. React remains the app/UI layer, `src/game.ts` remains the local simulation source of truth, and ThreeJS is responsible for rendering the arena and world entities.

The game should feel like:

- neon AI lab arena
- arcade boss rush
- readable mascot billboards and simple 3D silhouettes
- energetic particle feedback
- playful contest parody
- professional web game polish

Do not add a second simulation, multiplayer, accounts, inventory, or large assets during this migration. The ThreeJS work should improve presentation while preserving the current playable core.

## Judge Reference Direction

The judge references should become the game identity.

Each judge should have:

- recognizable handle in UI
- strong color
- readable silhouette
- one prop or visual motif
- one simple behavior difference
- one bark/personality angle
- one defeat/respawn gag

Keep it affectionate and arcade-like. The goal is "fun boss character," not realistic likeness.

Suggested simple behaviors:

- `@levelsio`: fastest direct rusher, pressures instant action.
- `@S13K_`: dash/lunge telegraph, strong danger rings.
- `@TIMSORET`: game-feel auditor, leaves temporary hazard pulses.
- `@NICOLAMANZINI`: polish detector, guards or steals high-value shards.
- `@EDWINARBUS`: vibe containment, grows stronger if ignored too long.

Implement only one behavior at a time and keep each behavior visually obvious.

## Near-Term Roadmap

### Patch 1: Shard Collection Juice

Purpose: make the reward loop satisfying every few seconds.

Status: implemented.

Added:

- pickup trails
- burst particles
- score popups
- magnet pull visual
- combo/streak counter for fast pickups

### Patch 2: Upgrade Moment Polish

Purpose: make wave completion feel like a mutation moment.

Status: implemented.

Added:

- more dramatic upgrade overlay
- clear build language
- upgrade sigils and tags
- next-wave effect language

### Patch 2B: Vibe Jam Portal Support

Purpose: satisfy optional webring continuity while preserving instant play.

Status: implemented.

Added:

- required widget is present in `index.html`
- exit portal redirects to `https://vibej.am/portal/2026`
- portal handoff params are preserved and forwarded
- `?portal=true` starts the game immediately
- `?portal=true&ref=...` adds a return portal near the spawn point

### Patch 3: Judge Personality Pass

Purpose: make judge references memorable.

Add one simple behavior per judge, with visible telegraphs.

### Patch 4: Arena Visual Pass

Purpose: make the game look more professional through the staged ThreeJS renderer without a full gameplay rewrite.

Add:

- judge spawn portals
- animated boundary lights
- parallax lab particles
- arena corner structures
- better floor highlight zones

### Patch 5: Submission Polish

Purpose: remove friction and make the game judge-ready.

Check:

- first screen clarity
- widget visible and not blocking
- no console errors
- fast load
- responsive laptop/mobile-ish layout
- build output small enough
- incognito smoke test

## What Not To Do Yet

Avoid:

- real multiplayer
- server leaderboard
- account systems
- deep progression trees
- complex inventory
- multiple rooms
- pathfinding
- large 3D engine rewrite
- procedural content systems

These can come later only if the core arcade experience already feels good.

## Reference Order For Future Chats

Read these first:

1. `docs/HANDOFF.md`
2. `docs/CURRENT_DIRECTION.md`
3. `docs/art-direction.md`
4. `PROJECT_BRIEF.md`

Use `docs/plans/2026-04-30-arena-characters-combat-roadmap.md` as historical context, not the primary current plan.
