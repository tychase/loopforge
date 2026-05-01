import { describe, expect, it } from 'vitest';
import { JUDGE_CHASERS, selectJudgeSprite, type CharacterAnimation } from './characters';
import {
  DEFAULT_VARIANT,
  aimPlayerAtCursor,
  applyUpgradeAndStartNextWave,
  checkCollisions,
  checkPortalCollisions,
  clampPlayerToArena,
  collectShard,
  consumePortalTrigger,
  createInitialState,
  chooseUpgradeOptions,
  distance,
  fireShardBlast,
  getPortalSafetyZone,
  isNavigationKey,
  isInsidePortalEnemyExclusionZone,
  isInsidePortalSafetyZone,
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

  it('creates pickup feedback and chains fast shard combos', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    state.player.x = 100;
    state.player.y = 100;
    state.shards = [{ id: 10, x: 104, y: 102, radius: 8, value: 2 }];

    expect(collectShard(state)).toBe(true);

    expect(state.score).toBe(2);
    expect(state.pickupCombo.count).toBe(1);
    expect(state.pickupCombo.best).toBe(1);
    expect(state.pickupTrails).toHaveLength(1);
    expect(state.scorePopups).toHaveLength(1);
    expect(state.pickupParticles.length).toBeGreaterThan(0);

    state.shards = [{ id: 11, x: 106, y: 100, radius: 8, value: 2 }];

    expect(collectShard(state)).toBe(true);

    expect(state.score).toBe(4);
    expect(state.pickupCombo.count).toBe(2);
    expect(state.pickupCombo.best).toBe(2);
    expect(state.scorePopups.at(-1)?.combo).toBe(2);

    tickGame(state, { x: 0, y: 0 }, 1.2);

    expect(state.pickupCombo.count).toBe(0);
    expect(state.pickupCombo.timer).toBe(0);
    expect(state.pickupTrails).toHaveLength(0);
    expect(state.scorePopups).toHaveLength(0);
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
    expect(options.every((option) => option.icon && option.tag && option.nextWave && option.color)).toBe(true);
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

  it('triggers the Vibe Jam exit portal when the player enters it', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    startGame(state);
    const portal = state.portals.find((candidate) => candidate.kind === 'exit');
    expect(portal).toBeDefined();
    state.player.x = portal!.x;
    state.player.y = portal!.y;

    checkPortalCollisions(state);

    expect(consumePortalTrigger(state)).toBe('exit');
    expect(consumePortalTrigger(state)).toBeUndefined();
    expect(state.message).toContain('Vibe Jam Portal');
  });

  it('starts portal arrivals in play with a nearby return portal', () => {
    const state = createInitialState(DEFAULT_VARIANT, { portalArrival: true, returnPortal: true });
    const portal = state.portals.find((candidate) => candidate.kind === 'return');
    const safeZone = getPortalSafetyZone(DEFAULT_VARIANT);

    expect(state.status).toBe('playing');
    expect(portal).toBeDefined();
    expect(isInsidePortalSafetyZone(DEFAULT_VARIANT, portal!)).toBe(true);
    expect(state.player.x).toBeGreaterThan(safeZone.x);
    expect(state.player.x).toBeLessThan(safeZone.door.x);
    expect(distance(state.player, portal!)).toBeGreaterThan(state.player.radius + portal!.radius);

    state.portalCooldown = 0;
    state.player.x = portal!.x;
    state.player.y = portal!.y;
    checkPortalCollisions(state);

    expect(consumePortalTrigger(state)).toBe('return');
  });

  it('protects portal arrivals from judge collisions inside the entry corridor', () => {
    const state = createInitialState(DEFAULT_VARIANT, { portalArrival: true, returnPortal: true });
    const judge = state.enemies[0];
    state.graceRemaining = 0;
    judge.x = state.player.x;
    judge.y = state.player.y;

    tickGame(state, { x: 0, y: 0 }, 0.1);

    expect(state.status).toBe('playing');
    expect(isInsidePortalSafetyZone(DEFAULT_VARIANT, state.player)).toBe(true);
  });

  it('keeps judges out of the protected portal corridor', () => {
    const state = createInitialState(DEFAULT_VARIANT, { portalArrival: true, returnPortal: true });
    const judge = state.enemies[0];
    const safeZone = getPortalSafetyZone(DEFAULT_VARIANT);
    state.graceRemaining = 0;
    judge.x = safeZone.door.x + 12;
    judge.y = state.player.y;

    tickGame(state, { x: 0, y: 0 }, 0.25);

    expect(isInsidePortalSafetyZone(DEFAULT_VARIANT, judge, judge.radius)).toBe(false);
    expect(isInsidePortalEnemyExclusionZone(DEFAULT_VARIANT, judge, judge.radius)).toBe(false);
    expect(judge.x).toBeGreaterThan(safeZone.egress.x + safeZone.egress.width);
  });

  it('keeps the portal launch lane protected after the one-way door', () => {
    const state = createInitialState(DEFAULT_VARIANT, { portalArrival: true, returnPortal: true });
    const safeZone = getPortalSafetyZone(DEFAULT_VARIANT);
    const judge = state.enemies[0];
    state.graceRemaining = 0;
    state.player.x = safeZone.egress.x + safeZone.egress.width / 2;
    state.player.y = safeZone.egress.y + safeZone.egress.height / 2;
    judge.x = state.player.x;
    judge.y = state.player.y;

    tickGame(state, { x: 0, y: 0 }, 0.1);

    expect(state.status).toBe('playing');
    expect(isInsidePortalEnemyExclusionZone(DEFAULT_VARIANT, state.player)).toBe(true);
    expect(state.portalSafetyActive).toBe(true);
  });

  it('turns off portal safety after the player exits the launch lane', () => {
    const state = createInitialState(DEFAULT_VARIANT, { portalArrival: true, returnPortal: true });
    const safeZone = getPortalSafetyZone(DEFAULT_VARIANT);
    state.enemies = [];
    state.player.x = safeZone.egress.x + safeZone.egress.width - 8;
    state.player.y = safeZone.egress.y + safeZone.egress.height / 2;

    tickGame(state, { x: 1, y: 0 }, 0.2);

    expect(isInsidePortalEnemyExclusionZone(DEFAULT_VARIANT, state.player)).toBe(false);
    expect(state.portalSafetyActive).toBe(false);
  });

  it('blocks arena players from entering the protected portal corridor', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const safeZone = getPortalSafetyZone(DEFAULT_VARIANT);
    startGame(state);
    state.enemies = [];
    state.player.x = safeZone.egress.x + safeZone.egress.width + state.player.radius + 4;
    state.player.y = safeZone.egress.y + safeZone.egress.height / 2;

    tickGame(state, { x: -1, y: 0 }, 0.2);

    expect(state.portalSafetyActive).toBe(false);
    expect(isInsidePortalEnemyExclusionZone(DEFAULT_VARIANT, state.player)).toBe(false);
    expect(state.player.x).toBeGreaterThan(safeZone.egress.x + safeZone.egress.width);
  });

  it('does not give camping protection to players who are not portal arrivals', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    const safeZone = getPortalSafetyZone(DEFAULT_VARIANT);
    const judge = state.enemies[0];
    startGame(state);
    state.graceRemaining = 0;
    state.player.x = safeZone.egress.x + safeZone.egress.width / 2;
    state.player.y = safeZone.egress.y + safeZone.egress.height / 2;
    judge.x = state.player.x;
    judge.y = state.player.y;

    checkCollisions(state);

    expect(state.status).toBe('gameover');
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

  it('moves with cursor keys across arena space without stealing mouse aim', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    startGame(state);
    state.graceRemaining = 0;
    const startX = state.player.x;
    const startY = state.player.y;
    const heading = state.player.heading;

    tickGame(state, { x: 1, y: -1 }, 0.25);

    expect(state.player.x).toBeGreaterThan(startX);
    expect(state.player.y).toBeLessThan(startY);
    expect(state.player.heading).toBe(heading);
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

  it('finds the nearest active judge for threat tracking', () => {
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

  it('aims the player toward the cursor around the followed camera center', () => {
    const state = createInitialState(DEFAULT_VARIANT);

    aimPlayerAtCursor(state, { x: 800, y: 300 }, { width: 1000, height: 600 });

    expect(state.player.heading).toBeCloseTo(0, 5);

    aimPlayerAtCursor(state, { x: 500, y: 100 }, { width: 1000, height: 600 });

    expect(state.player.heading).toBeCloseTo(-Math.PI / 2, 5);
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

  it('does not auto-lock shard blasts onto nearby judges', () => {
    const state = createInitialState(DEFAULT_VARIANT);
    startGame(state);
    state.player.x = 200;
    state.player.y = 200;
    state.player.heading = 0;
    state.enemies[0].x = 200;
    state.enemies[0].y = 60;
    state.enemies[1].x = 600;
    state.enemies[1].y = 200;

    expect(fireShardBlast(state)).toBe(true);

    expect(state.player.heading).toBe(0);
    expect(state.blasts[0].vx).toBeGreaterThan(0);
    expect(Math.abs(state.blasts[0].vy)).toBeLessThan(1);
    expect(state.message).not.toContain(state.enemies[0].judge.handle);
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
