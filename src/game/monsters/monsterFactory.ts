import { MONSTER_DEFINITIONS, type MonsterDefinition, type MonsterId, type MonsterInstance, type Point } from './monsterTypes';

export type CreateMonsterOptions = {
  instanceId?: string;
  nowMs?: number;
  state?: MonsterInstance['state'];
};

export function listMonsterDefinitions(): MonsterDefinition[] {
  return MONSTER_DEFINITIONS.map((monster) => ({ ...monster, voiceLines: [...monster.voiceLines], placeholder: { ...monster.placeholder } }));
}

export function getMonsterDefinition(id: MonsterId): MonsterDefinition {
  const definition = MONSTER_DEFINITIONS.find((monster) => monster.id === id);
  if (!definition) throw new Error(`Unknown monster definition: ${id}`);
  return definition;
}

export function createMonsterInstance(
  definitionOrId: MonsterDefinition | MonsterId,
  position: Point,
  options: CreateMonsterOptions = {},
): MonsterInstance {
  const definition = typeof definitionOrId === 'string' ? getMonsterDefinition(definitionOrId) : definitionOrId;
  const nowMs = options.nowMs ?? 0;
  return {
    instanceId: options.instanceId ?? `${definition.id}-${nowMs}-${Math.round(position.x)}-${Math.round(position.y)}`,
    definitionId: definition.id,
    displayName: definition.displayName,
    position: { ...position },
    velocity: { x: 0, y: 0 },
    state: options.state ?? 'idle',
    hp: definition.hp,
    maxHp: definition.hp,
    damage: definition.damage,
    speed: definition.speed,
    attackCooldownMs: definition.attackCooldownMs,
    lastAttackAtMs: Number.NEGATIVE_INFINITY,
    spawnedAtMs: nowMs,
  };
}

export function createMonsterRoster(positions: Point[], nowMs = 0): MonsterInstance[] {
  return MONSTER_DEFINITIONS.map((definition, index) => createMonsterInstance(
    definition,
    positions[index] ?? { x: 0, y: 0 },
    { nowMs, instanceId: `${definition.id}-${index}` },
  ));
}
