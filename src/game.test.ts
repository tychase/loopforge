import { describe, expect, it } from 'vitest';
import { JUDGE_CHASERS, selectJudgeSprite, type CharacterAnimation } from './characters';
import {
  DEFAULT_VARIANT,
  applyUpgradeAndStartNextWave,
  clampPlayerToArena,
  collectShard,
  createInitialState,
  chooseUpgradeOptions,
  distance,
  fireShardBlast,
  isNavigationKey,
  nearestChasingEnemy,
  respawnDefeatedJudges,
  spawnEnemyForWave,
  startGame,
  tickGame,
  turnPlayerView,
  type GameState,
  type Upgrade,
} from './game';

describe('LoopForge game logic', () => {
  it('starts the player centered with zero score and first wave active', () => {
    const state = createInitialState(DEFAULT_VARIANT);

    expect(state.player.x).toBe(DEFAULT_VARIANT.arena.width / 2);
    expect(state.player.y).toBe(DEFAULT_VARIANT.arena.height / 2);
    expect(state.score).toBe(0);
    expect(state.wave).toBe(1);
    expect(state.status).toBe('ready');
    expect(state.graceRemaining).toBeGreaterThan(0);
    expect(state.shards.length).toBeGreaterThan(0);
  });

  it('keeps the player fully inside the arena bounds', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    state.player.x = -100;
    state.player.y = 9999;

    clampPlayerToArena(state);

    expect(state.player.x).toBe(state.player.radius);
    expect(state.player.y).toBe(DEFAULT_VARIANT.arena.height - state.player.radius);
  });

  it('collects a nearby shard and increases score', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    state.player.x = 100;
    state.player.y = 100;
    state.shards = [{ id: 1, x: 104, y: 102, radius: 8, value: 3 }];

    const collected = collectShard(state);

    expect(collected).toBe(true);
    expect(state.score).toBe(3);
    expect(state.shards).toHaveLength(0);
  });

  it('scales enemy speed with wave while staying deterministic from the variant', () => {
    const waveOne = spawnEnemyForWave(DEFAULT_VARIANT, 1, 0);
    const waveFour = spawnEnemyForWave(DEFAULT_VARIANT, 4, 0);

    expect(waveFour.speed).toBeGreaterThan(waveOne.speed);
    expect(waveOne.x).toBe(waveFour.x);
  });

  it('offers three upgrade options after a wave', () => {
    const state: GameState = createInitialState(DEFAULT_VARIANT);
    state.wave = 2;

    const options = chooseUpgradeOptions(state, DEFAULT_VARIANT);

    expect(options).toHaveLength(3);
    expect(new Set(options.map((option) => option.id)).size).toBe(3);
  });

  it('applies upgrades after the next wave refills', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const upgrade: Upgrade = {
      id: 'test-next-wave-boost',
      title: 'Test Boost',
      description: 'Boost next wave shards and clock',
      apply: (current) => {
        current.shards.forEach((shard) => {
          shard.value += 4;
        });
        current.waveTimeRemaining += 4;
      },
    };

    applyUpgradeAndStartNextWave(state, upgrade);

    expect(state.wave).toBe(2);
    expect(state.status).toBe('playing');
    expect(state.graceRemaining).toBeGreaterThan(0);
    expect(state.waveTimeRemaining).toBe(DEFAULT_VARIANT.waveSeconds + 4);
    expect(state.shards.every((shard) => shard.value === 5)).toBe(true);
  });

  it('uses the real Vibe Jam jury as named judge chasers', () => {
    const state = createInitialState(DEFAULT_VARIANT);

    expect(JUDGE_CHASERS.map((judge) => judge.handle)).toEqual([
      '@levelsio',
      '@S13K_',
      '@TIMSORET',
      '@NICOLAMANZINI',
      '@EDWINARBUS',
    ]);
    expect(state.enemies[0].judge.handle).toBe('@levelsio');
    expect(state.enemies[1].judge.bark).toContain('ship');
  });

  it('keeps judge characters asset-ready for future sprite billboards', () => {
    const expectedStates: CharacterAnimation[] = ['idle', 'chase', 'attack', 'hurt', 'defeated', 'respawn'];

    expect(expectedStates).toContain('chase');
    expect(JUDGE_CHASERS.every((judge) => 'sprites' in judge || judge.sprites === undefined)).toBe(true);
    expect(JUDGE_CHASERS[0].sprites?.chase).toBe('/assets/judges/levelsio/boss.png');
  });

  it('selects the best available judge sprite and falls back when no image exists', () => {
    const judge = { ...JUDGE_CHASERS[0], sprites: { idle: '/idle.png', chase: '/chase.png' } };

    expect(selectJudgeSprite(judge, 'chase')).toBe('/chase.png');
    expect(selectJudgeSprite(judge, 'hurt')).toBe('/idle.png');
    expect(selectJudgeSprite(JUDGE_CHASERS[1], 'chase')).toBeUndefined();
  });

  it('moves with cursor keys across arena map space', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    startGame(state);
    state.graceRemaining = 0;
    const startX = state.player.x;
    const startY = state.player.y;

    tickGame(state, { x: 1, y: -1 }, 0.25);

    expect(state.player.x).toBeGreaterThan(startX);
    expect(state.player.y).toBeLessThan(startY);
    expect(state.player.heading).toBeCloseTo(-Math.PI / 4, 5);
  });

  it('waits in the ready state until the player starts the run', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const startClock = state.waveTimeRemaining;
    const enemyX = state.enemies[0].x;

    tickGame(state, { x: 0, y: -1 }, 1);

    expect(state.status).toBe('ready');
    expect(state.waveTimeRemaining).toBe(startClock);
    expect(state.enemies[0].x).toBe(enemyX);
  });

  it('finds the nearest active judge for arena auto-targeting', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    state.enemies[0].x = state.player.x + 400;
    state.enemies[0].y = state.player.y;
    state.enemies[1].x = state.player.x + 80;
    state.enemies[1].y = state.player.y;
    state.enemies[2].x = state.player.x + 30;
    state.enemies[2].y = state.player.y;
    state.enemies[2].status = 'defeated';

    expect(nearestChasingEnemy(state)?.id).toBe(state.enemies[1].id);
  });

  it('starts with a grace window before judges can catch the player', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const judge = state.enemies[0];
    startGame(state);
    judge.x = state.player.x;
    judge.y = state.player.y;

    tickGame(state, { x: 0, y: 0 }, 0.4);

    expect(state.status).toBe('playing');
    expect(state.graceRemaining).toBeGreaterThan(0);
  });

  it('lets judges chase once the grace window is over', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const judge = state.enemies[0];
    startGame(state);
    state.graceRemaining = 0;
    judge.x = state.player.x + 220;
    judge.y = state.player.y;
    const startDistance = distance(state.player, judge);

    tickGame(state, { x: 0, y: 0 }, 0.5);

    expect(distance(state.player, judge)).toBeLessThan(startDistance);
  });

  it('ends the run when an unshielded judge collides after grace', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const judge = state.enemies[0];
    startGame(state);
    state.graceRemaining = 0;
    judge.x = state.player.x;
    judge.y = state.player.y;

    tickGame(state, { x: 0, y: 0 }, 0.1);

    expect(state.status).toBe('gameover');
    expect(state.message).toContain(judge.judge.handle);
  });

  it('turns the player view from mouse movement deltas', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const startHeading = state.player.heading;

    turnPlayerView(state, 40);

    expect(state.player.heading).toBeGreaterThan(startHeading);
  });

  it('scales mouse-look sensitivity from the player turn speed', () => {
    const slow = createInitialState(DEFAULT_VARIANT);
    const fast = createInitialState(DEFAULT_VARIANT);
    slow.player.turnSpeed = 1;
    fast.player.turnSpeed = 2.5;

    turnPlayerView(slow, 50);
    turnPlayerView(fast, 50);

    expect(fast.player.heading).toBeCloseTo(slow.player.heading * 2.5, 5);
  });

  it('keeps mouse-look heading normalized after large turns', () => {
    const state = createInitialState(DEFAULT_VARIANT);

    turnPlayerView(state, 5000);

    expect(state.player.heading).toBeGreaterThanOrEqual(-Math.PI);
    expect(state.player.heading).toBeLessThanOrEqual(Math.PI);
  });

  it('marks browser navigation keys so handlers can prevent page scrolling', () => {
    expect(isNavigationKey('ArrowUp')).toBe(true);
    expect(isNavigationKey(' ')).toBe(true);
    expect(isNavigationKey('w')).toBe(false);
  });

  it('starts judges with health and active chase status', () => {
    const state = createInitialState(DEFAULT_VARIANT);

    expect(state.enemies[0].maxHealth).toBeGreaterThan(0);
    expect(state.enemies[0].health).toBe(state.enemies[0].maxHealth);
    expect(state.enemies[0].status).toBe('chasing');
  });

  it('fires a shard blast from the player heading with a cooldown', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    startGame(state);
    state.enemies = [];
    state.player.heading = 0;

    const fired = fireShardBlast(state);
    const blocked = fireShardBlast(state);

    expect(fired).toBe(true);
    expect(blocked).toBe(false);
    expect(state.blasts).toHaveLength(1);
    expect(state.blasts[0].x).toBeGreaterThan(state.player.x);
    expect(state.blasts[0].vx).toBeGreaterThan(0);
    expect(state.player.blastCooldown).toBeGreaterThan(0);
  });

  it('auto-locks shard blasts onto the nearest active judge', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    startGame(state);
    state.player.x = 200;
    state.player.y = 200;
    state.enemies[0].x = 200;
    state.enemies[0].y = 60;
    state.enemies[1].x = 600;
    state.enemies[1].y = 200;

    expect(fireShardBlast(state)).toBe(true);

    expect(state.blasts[0].vy).toBeLessThan(0);
    expect(Math.abs(state.blasts[0].vx)).toBeLessThan(1);
    expect(state.message).toContain(state.enemies[0].judge.handle);
  });

  it('damages and defeats judges with shard blasts for score', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    startGame(state);
    state.graceRemaining = 0;
    const judge = state.enemies[0];
    state.player.x = 200;
    state.player.y = 200;
    state.player.heading = 0;
    judge.x = 310;
    judge.y = 200;
    judge.health = 20;
    const startScore = state.score;

    expect(fireShardBlast(state)).toBe(true);
    tickGame(state, { x: 0, y: 0 }, 0.2);

    expect(judge.status).toBe('defeated');
    expect(judge.health).toBe(0);
    expect(state.score).toBeGreaterThan(startScore);
    expect(state.message).toContain('defeated');
  });

  it('respawns defeated judges with local per-match learning', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const judge = state.enemies[0];
    judge.status = 'defeated';
    judge.health = 0;
    judge.respawnTimer = 0;
    judge.lastDamageDistance = 420;
    const previousZigZag = judge.experience.behaviorWeights.zigZag;

    respawnDefeatedJudges(state, 0.1);

    expect(judge.status).toBe('chasing');
    expect(judge.health).toBe(judge.maxHealth);
    expect(judge.experience.defeats).toBe(1);
    expect(judge.experience.behaviorWeights.zigZag).toBeGreaterThan(previousZigZag);
    expect(state.message).toContain('learned');
  });
});
