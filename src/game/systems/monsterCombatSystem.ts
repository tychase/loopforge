import type { MonsterInstance, Point } from '../monsters/monsterTypes';

export type MonsterDamageResult = {
  monster: MonsterInstance;
  defeated: boolean;
  damageApplied: number;
};

export type MonsterAttackResult = {
  monster: MonsterInstance;
  didAttack: boolean;
  damage: number;
  distance: number;
};

export function applyDamageToMonster(monster: MonsterInstance, amount: number): MonsterDamageResult {
  const damageApplied = Math.max(0, amount);
  const nextHp = Math.max(0, monster.hp - damageApplied);
  return {
    monster: {
      ...monster,
      hp: nextHp,
      state: nextHp <= 0 ? 'death' : monster.state,
    },
    defeated: nextHp <= 0,
    damageApplied,
  };
}

export function canMonsterAttack(monster: MonsterInstance, nowMs: number): boolean {
  return monster.hp > 0 && nowMs - monster.lastAttackAtMs >= monster.attackCooldownMs;
}

export function tryMonsterAttack(
  monster: MonsterInstance,
  target: Point,
  nowMs: number,
  attackRange = 42,
): MonsterAttackResult {
  const distanceToTarget = distance(monster.position, target);
  if (!canMonsterAttack(monster, nowMs) || distanceToTarget > attackRange) {
    return { monster, didAttack: false, damage: 0, distance: distanceToTarget };
  }

  return {
    monster: {
      ...monster,
      state: 'attack',
      lastAttackAtMs: nowMs,
    },
    didAttack: true,
    damage: monster.damage,
    distance: distanceToTarget,
  };
}

export function steerMonsterToward(monster: MonsterInstance, target: Point, dtSeconds: number): MonsterInstance {
  const dx = target.x - monster.position.x;
  const dy = target.y - monster.position.y;
  const length = Math.hypot(dx, dy) || 1;
  const velocity = {
    x: (dx / length) * monster.speed,
    y: (dy / length) * monster.speed,
  };
  return {
    ...monster,
    velocity,
    position: {
      x: monster.position.x + velocity.x * dtSeconds,
      y: monster.position.y + velocity.y * dtSeconds,
    },
    state: monster.hp > 0 ? 'chase' : 'death',
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
