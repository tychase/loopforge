import { describe, expect, it } from 'vitest';
import {
  MONSTER_ANIMATION_ROWS,
  MONSTER_FRAME_SIZE,
  MONSTER_FRAMES_PER_ANIMATION,
  MONSTER_SHEET_SIZE,
  monsterSpriteSheetPath,
  publicAssetPath,
  resolveMonsterAtlas,
  resolveMonsterSpriteAsset,
} from './assets/monsterAtlas';
import { applyDamageToMonster, tryMonsterAttack } from './systems/monsterCombatSystem';
import { spawnMonsterWave, totalMonsterSpawnWeight } from './systems/monsterSpawnSystem';
import { createMonsterInstance, getMonsterDefinition } from './monsters/monsterFactory';
import { MONSTER_DEFINITIONS, type MonsterAnimationKey } from './monsters/monsterTypes';
import { getMonsterAnimationFrames, MONSTER_ANIMATION_KEYS } from './monsters/monsterAnimations';

describe('monster asset pipeline', () => {
  it('defines the full Vibe Jam parody monster roster', () => {
    expect(MONSTER_DEFINITIONS.map((monster) => monster.id)).toEqual([
      'the-shipper',
      'the-silent-reviewer',
      'the-perfectionist',
      'the-optimizer',
      'the-autocoder',
    ]);

    for (const monster of MONSTER_DEFINITIONS) {
      expect(monster.displayName).toMatch(/^The /);
      expect(monster.spriteSheetPath).toBe(monsterSpriteSheetPath(monster.id));
      expect(monster.speed).toBeGreaterThan(0);
      expect(monster.hp).toBeGreaterThan(0);
      expect(monster.damage).toBeGreaterThan(0);
      expect(monster.attackCooldownMs).toBeGreaterThan(0);
      expect(monster.spawnWeight).toBeGreaterThan(0);
      expect(monster.abilityName.length).toBeGreaterThan(0);
      expect(monster.abilityDescription.length).toBeGreaterThan(0);
      expect(monster.voiceLines.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('resolves every sprite path or falls back to placeholder frames safely', () => {
    const simulatedExistingAssets = new Set(['/assets/monsters/the-shipper.png']);
    const atlas = resolveMonsterAtlas((spriteSheetPath) => simulatedExistingAssets.has(spriteSheetPath));

    for (const monster of MONSTER_DEFINITIONS) {
      const asset = atlas[monster.id];
      expect(asset.path).toBe(monster.spriteSheetPath);
      expect(asset.frameSize).toBe(MONSTER_FRAME_SIZE);
      expect(asset.sheetSize).toBe(MONSTER_SHEET_SIZE);
      expect(publicAssetPath(monster.spriteSheetPath)).toBe(`public/assets/monsters/${monster.id}.png`);

      if (simulatedExistingAssets.has(monster.spriteSheetPath)) {
        expect(asset.kind).toBe('spriteSheet');
      } else {
        expect(asset.kind).toBe('placeholder');
        if (asset.kind === 'placeholder') {
          expect(asset.reason).toBe('missing-sprite-sheet');
          for (const animation of MONSTER_ANIMATION_KEYS) {
            expect(asset.frames[animation]).toHaveLength(MONSTER_FRAMES_PER_ANIMATION);
            expect(asset.frames[animation][0].label).toContain(animation);
          }
        }
      }
    }
  });

  it('can force placeholder resolution for missing final PNGs', () => {
    const monster = getMonsterDefinition('the-shipper');
    const asset = resolveMonsterSpriteAsset(monster, () => false);

    expect(asset.kind).toBe('placeholder');
    if (asset.kind === 'placeholder') {
      expect(asset.frames.idle[0]).toMatchObject({
        x: 0,
        y: 0,
        width: 128,
        height: 128,
        primaryColor: monster.placeholder.primaryColor,
      });
    }
  });

  it('keeps animation frame ranges inside the 512x512 sheet', () => {
    for (const animation of MONSTER_ANIMATION_KEYS) {
      const frames = getMonsterAnimationFrames(animation);
      expect(frames).toHaveLength(MONSTER_FRAMES_PER_ANIMATION);

      frames.forEach((frame, frameIndex) => {
        expect(frame.animation).toBe(animation);
        expect(frame.frameIndex).toBe(frameIndex);
        expect(frame.column).toBe(frameIndex);
        expect(frame.row).toBe(MONSTER_ANIMATION_ROWS[animation as MonsterAnimationKey]);
        expect(frame.x).toBe(frameIndex * MONSTER_FRAME_SIZE);
        expect(frame.y).toBe(MONSTER_ANIMATION_ROWS[animation] * MONSTER_FRAME_SIZE);
        expect(frame.x + frame.width).toBeLessThanOrEqual(MONSTER_SHEET_SIZE);
        expect(frame.y + frame.height).toBeLessThanOrEqual(MONSTER_SHEET_SIZE);
      });
    }
  });

  it('requires positive spawn weights and can create deterministic waves', () => {
    expect(totalMonsterSpawnWeight()).toBeGreaterThan(0);
    expect(MONSTER_DEFINITIONS.every((monster) => monster.spawnWeight > 0)).toBe(true);

    const wave = spawnMonsterWave({
      count: 7,
      wave: 3,
      seed: 2026,
      arena: { width: 1280, height: 1280 },
      nowMs: 1234,
    });

    expect(wave).toHaveLength(7);
    expect(wave.every((monster) => monster.state === 'chase')).toBe(true);
    expect(wave.every((monster) => MONSTER_DEFINITIONS.some((definition) => definition.id === monster.definitionId))).toBe(true);
  });

  it('creates combat-ready monster instances', () => {
    const monster = createMonsterInstance('the-autocoder', { x: 100, y: 100 }, { nowMs: 500 });
    const damaged = applyDamageToMonster(monster, monster.maxHp + 5);
    const attack = tryMonsterAttack(monster, { x: 110, y: 110 }, 1500);

    expect(monster.displayName).toBe('The Autocoder');
    expect(damaged.defeated).toBe(true);
    expect(damaged.monster.state).toBe('death');
    expect(attack.didAttack).toBe(true);
    expect(attack.damage).toBe(monster.damage);
    expect(attack.monster.lastAttackAtMs).toBe(1500);
  });
});
