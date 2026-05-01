# LoopForge Arena Characters and Combat Roadmap

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task when execution begins.

## 2026-05-01 Status Note

This document is now historical planning context. The current primary docs are:

- `docs/HANDOFF.md`
- `docs/CURRENT_DIRECTION.md`
- `docs/art-direction.md`

Major progress since this roadmap was written:

- The game moved from pseudo-FPV toward a staged ThreeJS camera-follow arena.
- Judge config, shard-blast combat, health, defeat, respawn, local learning, upgrade choices, and threat feedback are implemented.
- Render helpers now live under `src/game/render/`.
- The current strategic direction is to keep mechanics good enough for flow and spend most near-term effort on professional visuals, juice, arena polish, and judge references.

Use the phase list below only as background, not as the active task order.

**Goal:** Evolve LoopForge from a pseudo-FPV shard survival prototype into a funny open Vibe Jam arena with silly arcade mascot sprite billboards, shard-blast combat, local per-match judge learning, and eventual real-time multiplayer/open-arena systems with local/bot fallback.

**Architecture:** Keep the shipped game lightweight and instant-loading. Build mechanics locally first in typed TypeScript modules, then add assets as small sprite billboards, then add server features only after the single-player/bot loop is fun. Judge learning should be deterministic, bounded, and local per-match first; global learning can come later.

**Tech Stack:** Vite 5, React 18, TypeScript, Vitest, ThreeJS renderer layer. Optional later backend TBD; real-time multiplayer is a long-term target, not a dependency for the local game.

---

## Phase 1: Core Feel Before Art

### Task 1: Fix and tune FPV movement

**Objective:** Make movement feel readable and fair before adding art.

**Files:**
- Modify: `src/game.ts`
- Modify: `src/App.tsx`
- Test: `src/game.test.ts`

**Steps:**
1. Add tests for turn speed, forward/backward motion, and arena clamping.
2. Tune speed/turnSpeed until navigation feels good.
3. Verify arrow keys do not scroll the page.
4. Run `npm test` and `npm run build`.

### Task 2: Add clear judge proximity feedback

**Objective:** Make chasers legible before combat exists.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/game.ts`
- Test: `src/game.test.ts`

**Steps:**
1. Add nearest-judge helper tests.
2. Show distance/threat indicator in UI.
3. Add visual warning when a judge is close.
4. Verify no console errors in browser.

---

## Phase 2: Character System and Sprites

### Task 3: Move judge definitions into character config

**Objective:** Make judge data asset-ready and easy to expand.

**Files:**
- Create: `src/characters.ts`
- Modify: `src/game.ts`
- Test: `src/game.test.ts`

**Data shape:**

```ts
export type CharacterAnimation = 'idle' | 'chase' | 'attack' | 'hurt' | 'defeated' | 'respawn';

export type JudgeCharacter = {
  id: string;
  handle: string;
  displayName: string;
  role: string;
  color: string;
  prop: string;
  barkLines: string[];
  sprite?: Partial<Record<CharacterAnimation, string>>;
  baseStats: {
    health: number;
    speed: number;
    attackRange: number;
  };
};
```

### Task 4: Add placeholder sprite billboard renderer

**Objective:** Support image sprites without requiring finished art.

**Files:**
- Modify: `src/App.tsx`
- Create: `src/rendering.ts` if renderer extraction becomes useful

**Steps:**
1. Keep current card renderer as fallback.
2. Add optional `sprite` image loading.
3. Draw sprite billboards in pseudo-FPV projection.
4. Fall back gracefully if images are missing.

### Task 5: Create sprite art direction document

**Objective:** Give future image generation/art passes a consistent target.

**Files:**
- Create: `docs/art-direction.md`

**Include:**
- visual style: silly arcade mascot, low-res/hand-drawn, high silhouette readability
- sprite size target: 128x128 or 256x256
- animation states: idle, chase, attack, hurt, defeated, respawn
- avoid: realistic portraits, heavy assets, mean-spirited caricature

---

## Phase 3: Combat

### Task 6: Add judge health

**Objective:** Judges can take damage and be defeated.

**Files:**
- Modify: `src/game.ts`
- Test: `src/game.test.ts`

**Steps:**
1. Add failing tests for `damageJudge`.
2. Add `health`, `maxHealth`, and `status` to judge/enemy state.
3. Defeated judges should award points and temporarily stop chasing.
4. Run tests/build.

### Task 7: Add player attack

**Objective:** The player can fight back with one simple mechanic.

**Recommended first attack:** shard blasts.

Shard blasts should be simple, visible projectiles fired by Space/click. Shards can either charge ammo directly or increase blast strength; start with the simplest readable version.

**Files:**
- Modify: `src/game.ts`
- Modify: `src/App.tsx`
- Test: `src/game.test.ts`

**Steps:**
1. Add input flag for Space/click attack.
2. Add cooldown and range.
3. Damage nearest judge in cone/range.
4. Add minimal visual effect.

### Task 8: Add score rules for combat

**Objective:** Reward judge defeat without making shard collection irrelevant.

**Rules:**
- shards: steady score
- close calls: bonus score
- judge damage: small score
- judge defeat: bigger score
- wave survival: bonus score

---

## Phase 4: Lightweight Judge Learning

### Task 9: Add local per-match learning model

**Objective:** Judges adapt after defeat within the current match in a tiny, readable way.

**Files:**
- Modify: `src/game.ts`
- Test: `src/game.test.ts`

**Model:**

```ts
type JudgeExperience = {
  judgeId: string;
  level: number;
  experience: number;
  defeats: number;
  behaviorWeights: {
    chase: number;
    guardShards: number;
    zigZag: number;
    retreatWhenHurt: number;
  };
  lastDefeat?: {
    damageSource: string;
    distance: number;
    timeAliveSeconds: number;
  };
};
```

**Rules:**
- Increase only one or two weights per defeat.
- Clamp every weight to a safe range.
- Surface the change to the player: “@TIMSORET learned zig-zag.”

### Task 10: Add optional global learning persistence later

**Objective:** After local per-match learning feels good, preserve aggregate judge learning without making it required for local/bot play.

**Files:**
- Create: `src/persistence.ts`
- Test: `src/persistence.test.ts`

**Storage:** Start with `localStorage`, versioned JSON, safe fallback if unavailable. Later global learning should live server-side and merge cautiously into match starts.

**Rule:** Local/bot fallback must work even if persistence or server sync fails.

---

## Phase 5: Leaderboard and Open Arena

### Task 11: Design leaderboard protocol

**Objective:** Add leaderboard without mandatory login.

**Rules:**
- optional display name only
- no account required
- score submission includes run duration, score events, and client version
- basic rate limiting and sanity checks server-side

### Task 12: Add asynchronous public arena scoring

**Objective:** Make the game feel shared before attempting real-time multiplayer.

**Ideas:**
- global judge health pool by season
- recent player ghosts or score markers
- “judge learned from 37 players today” banner

### Task 13: Build toward real-time multiplayer with local/bot fallback

**Objective:** Make real-time multiplayer the target while preserving a fully playable local/bot mode.

**Decision gate:** Only proceed if single-player combat, sprites, leaderboard, and bot fallback are already polished.

**Rules:**
- Local/bot mode must remain first-class.
- Network failure should never block instant play.
- Multiplayer should reuse the same core simulation concepts rather than fork the game.
- Bots should be good enough to make an empty arena feel alive.

---

## Character Creation Advice

For the judge sprites, start with character sheets instead of isolated illustrations.

Recommended prompt pattern for image generation/art direction:

```text
Silly arcade mascot sprite billboard sheet for [judge archetype], 128x128 or 256x256, transparent background, strong readable silhouette, exaggerated prop [prop], affectionate parody not realistic portrait, six poses: idle, chase, attack, hurt, defeated, respawn, vibrant Vibe Jam neon palette, high contrast, web game asset, no text in image.
```

Use handles/names in UI text, but make the visuals archetypal rather than realistic. This is funnier, safer, easier to read, and easier to iterate.

## Clarified Decisions

- Visual style: silly arcade mascot sprite billboards.
- First combat mechanic: shard blasts.
- Judge learning: local per-match first, global later.
- Open arena: real-time multiplayer target, with local/bot fallback required.
- Humor: affectionate parody, not mean-spirited.
