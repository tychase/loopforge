import { createMonsterInstance } from '../monsters/monsterFactory';
import { MONSTER_DEFINITIONS, type MonsterDefinition, type MonsterInstance, type Point } from '../monsters/monsterTypes';

export type MonsterSpawnArena = {
  width: number;
  height: number;
};

export type MonsterSpawnWaveOptions = {
  count: number;
  arena: MonsterSpawnArena;
  wave: number;
  seed?: number;
  nowMs?: number;
  definitions?: MonsterDefinition[];
};

export function totalMonsterSpawnWeight(definitions: MonsterDefinition[] = MONSTER_DEFINITIONS): number {
  return definitions.reduce((total, definition) => total + definition.spawnWeight, 0);
}

export function selectWeightedMonster(
  roll: number,
  definitions: MonsterDefinition[] = MONSTER_DEFINITIONS,
): MonsterDefinition {
  if (definitions.length === 0) throw new Error('Cannot select a monster from an empty roster.');
  const totalWeight = totalMonsterSpawnWeight(definitions);
  if (totalWeight <= 0) throw new Error('Monster spawn weights must sum to a positive value.');

  let cursor = Math.max(0, Math.min(0.999999, roll)) * totalWeight;
  for (const definition of definitions) {
    cursor -= definition.spawnWeight;
    if (cursor <= 0) return definition;
  }
  return definitions[definitions.length - 1];
}

export function spawnMonsterWave(options: MonsterSpawnWaveOptions): MonsterInstance[] {
  const definitions = options.definitions ?? MONSTER_DEFINITIONS;
  return Array.from({ length: options.count }, (_, index) => {
    const seed = (options.seed ?? 2026) + options.wave * 101 + index * 37;
    const monster = selectWeightedMonster(seededUnit(seed), definitions);
    return createMonsterInstance(monster, spawnPointOnArenaEdge(options.arena, seed), {
      nowMs: options.nowMs ?? 0,
      state: 'chase',
      instanceId: `${monster.id}-wave-${options.wave}-${index}`,
    });
  });
}

export function spawnPointOnArenaEdge(arena: MonsterSpawnArena, seed: number, margin = 32): Point {
  const edge = Math.floor(seededUnit(seed) * 4);
  const t = seededUnit(seed + 17);
  if (edge === 0) return { x: margin, y: t * arena.height };
  if (edge === 1) return { x: arena.width - margin, y: t * arena.height };
  if (edge === 2) return { x: t * arena.width, y: margin };
  return { x: t * arena.width, y: arena.height - margin };
}

export function seededUnit(seed: number): number {
  const x = Math.sin(seed * 928.21) * 10000;
  return x - Math.floor(x);
}
