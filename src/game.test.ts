import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VARIANT,
  clampPlayerToArena,
  collectShard,
  createInitialState,
  chooseUpgradeOptions,
  spawnEnemyForWave,
  type GameState,
} from './game';

describe('LoopForge game logic', () => {
  it('starts the player centered with zero score and first wave active', () => {
    const state = createInitialState(DEFAULT_VARIANT);

    expect(state.player.x).toBe(DEFAULT_VARIANT.arena.width / 2);
    expect(state.player.y).toBe(DEFAULT_VARIANT.arena.height / 2);
    expect(state.score).toBe(0);
    expect(state.wave).toBe(1);
    expect(state.status).toBe('playing');
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
});
