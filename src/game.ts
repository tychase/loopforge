import { JUDGE_CHASERS, type JudgeChaser } from './characters';
export { JUDGE_CHASERS } from './characters';
export type { CharacterAnimation, CharacterSprites, JudgeChaser } from './characters';

export type Vec = { x: number; y: number };
export type Status = 'playing' | 'upgrade' | 'gameover';
export type EnemyStatus = 'chasing' | 'defeated' | 'respawning';

export type JudgeExperience = {
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
    damageSource: 'shard_blast' | 'collision' | 'unknown';
    distance: number;
    timeAliveSeconds: number;
  };
};

export type Player = Vec & {
  radius: number;
  speed: number;
  turnSpeed: number;
  heading: number;
  magnetRadius: number;
  shield: number;
  blastCooldown: number;
};

export type Shard = Vec & { id: number; radius: number; value: number };
export type ShardBlast = Vec & {
  id: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  age: number;
  maxAge: number;
};
export type Enemy = Vec & {
  id: number;
  radius: number;
  speed: number;
  hue: number;
  judge: JudgeChaser;
  status: EnemyStatus;
  health: number;
  maxHealth: number;
  respawnTimer: number;
  aliveTime: number;
  lastDamageDistance: number;
  experience: JudgeExperience;
};
export type Upgrade = {
  id: string;
  title: string;
  description: string;
  apply: (state: GameState) => void;
};

export type GameVariant = {
  id: string;
  name: string;
  hypothesis: string;
  arena: { width: number; height: number };
  waveSeconds: number;
  shardsPerWave: number;
  baseEnemySpeed: number;
  enemySpeedPerWave: number;
  seed: number;
};

export type GameState = {
  variant: GameVariant;
  player: Player;
  shards: Shard[];
  enemies: Enemy[];
  blasts: ShardBlast[];
  score: number;
  wave: number;
  elapsed: number;
  waveTimeRemaining: number;
  status: Status;
  message: string;
  nextId: number;
};

export const DEFAULT_VARIANT: GameVariant = {
  id: 'judge-rush-fpv',
  name: 'Judge Rush FPV',
  hypothesis: 'A tiny FPV panic maze with real Vibe Jam judges as comic chasers is more memorable than a plain top-down loop.',
  arena: { width: 1280, height: 1280 },
  waveSeconds: 28,
  shardsPerWave: 10,
  baseEnemySpeed: 70,
  enemySpeedPerWave: 11,
  seed: 1337,
};

const BLAST_COOLDOWN = 0.42;
const BLAST_SPEED = 720;
const BLAST_DAMAGE = 34;
const BLAST_MAX_AGE = 0.9;
const JUDGE_RESPAWN_SECONDS = 2.4;

const UPGRADES: Upgrade[] = [
  { id: 'swift-boots', title: 'Vibe Sneakers', description: '+12% sprint speed', apply: (state) => { state.player.speed *= 1.12; } },
  { id: 'wider-magnet', title: 'Clout Magnet', description: '+32 shard pickup radius', apply: (state) => { state.player.magnetRadius += 32; } },
  { id: 'soft-shield', title: 'PR Spin', description: 'Absorb one judge collision', apply: (state) => { state.player.shield += 1; } },
  { id: 'brighter-shards', title: 'Shinier Demo', description: '+1 point per visible shard', apply: (state) => { state.shards.forEach((shard) => shard.value += 1); } },
  { id: 'calmer-loop', title: 'Deadline Extension', description: '+4 seconds next wave', apply: (state) => { state.waveTimeRemaining += 4; } },
];

export function isNavigationKey(key: string): boolean {
  return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' || key === ' ';
}

export function seededUnit(seed: number): number {
  const x = Math.sin(seed * 999.123) * 10000;
  return x - Math.floor(x);
}

function seededPoint(variant: GameVariant, index: number, margin = 80): Vec {
  const x = margin + seededUnit(variant.seed + index * 17) * (variant.arena.width - margin * 2);
  const y = margin + seededUnit(variant.seed + index * 31) * (variant.arena.height - margin * 2);
  return { x, y };
}

function createExperience(): JudgeExperience {
  return {
    level: 1,
    experience: 0,
    defeats: 0,
    behaviorWeights: { chase: 1, guardShards: 0, zigZag: 0, retreatWhenHurt: 0 },
  };
}

export function createInitialState(variant: GameVariant = DEFAULT_VARIANT): GameState {
  const state: GameState = {
    variant,
    player: {
      x: variant.arena.width / 2,
      y: variant.arena.height / 2,
      radius: 18,
      speed: 255,
      turnSpeed: 3.15,
      heading: 0,
      magnetRadius: 72,
      shield: 0,
      blastCooldown: 0,
    },
    shards: [],
    enemies: [],
    blasts: [],
    score: 0,
    wave: 1,
    elapsed: 0,
    waveTimeRemaining: variant.waveSeconds,
    status: 'playing',
    message: 'Collect vibe shards. Space/click fires shard blasts. Judges learn when they respawn.',
    nextId: 1,
  };
  refillWave(state);
  return state;
}

export function refillWave(state: GameState): void {
  state.shards = Array.from({ length: state.variant.shardsPerWave }, (_, i) => {
    const point = seededPoint(state.variant, state.wave * 100 + i);
    return { id: state.nextId++, x: point.x, y: point.y, radius: 10, value: 1 };
  });
  const previous = new Map(state.enemies.map((enemy) => [enemy.judge.handle, enemy.experience]));
  const enemyCount = Math.min(2 + state.wave, JUDGE_CHASERS.length + 3);
  state.enemies = Array.from({ length: enemyCount }, (_, i) => {
    const enemy = spawnEnemyForWave(state.variant, state.wave, i);
    const saved = previous.get(enemy.judge.handle);
    if (saved) enemy.experience = saved;
    return enemy;
  });
  state.blasts = [];
  state.waveTimeRemaining = state.variant.waveSeconds;
}

export function clampPlayerToArena(state: GameState): void {
  const { width, height } = state.variant.arena;
  const r = state.player.radius;
  state.player.x = Math.max(r, Math.min(width - r, state.player.x));
  state.player.y = Math.max(r, Math.min(height - r, state.player.y));
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function collectShard(state: GameState): boolean {
  const before = state.shards.length;
  state.shards = state.shards.filter((shard) => {
    const d = distance(state.player, shard);
    if (d <= state.player.radius + shard.radius || d <= state.player.magnetRadius) {
      state.score += shard.value;
      state.message = `Vibe shard banked. ${state.shards.length - 1} left before the judges refresh their scorecards.`;
      return false;
    }
    return true;
  });
  return state.shards.length !== before;
}

export function spawnEnemyForWave(variant: GameVariant, wave: number, index: number): Enemy {
  const edge = index % 4;
  const t = seededUnit(variant.seed + wave * 11 + index * 47);
  const x = edge === 0 ? 32 : edge === 1 ? variant.arena.width - 32 : t * variant.arena.width;
  const y = edge === 2 ? 32 : edge === 3 ? variant.arena.height - 32 : t * variant.arena.height;
  const maxHealth = 82 + wave * 12 + index * 5;
  return {
    id: wave * 1000 + index,
    x,
    y,
    radius: 22,
    speed: variant.baseEnemySpeed + (wave - 1) * variant.enemySpeedPerWave + index * 3,
    hue: 310 + ((wave + index) * 19) % 70,
    judge: JUDGE_CHASERS[index % JUDGE_CHASERS.length],
    status: 'chasing',
    health: maxHealth,
    maxHealth,
    respawnTimer: 0,
    aliveTime: 0,
    lastDamageDistance: 0,
    experience: createExperience(),
  };
}

const MOUSE_LOOK_SENSITIVITY = 0.0042;

export function turnPlayerView(state: GameState, movementX: number): void {
  state.player.heading = normalizeAngle(state.player.heading + movementX * MOUSE_LOOK_SENSITIVITY);
}

export function fireShardBlast(state: GameState): boolean {
  if (state.status !== 'playing' || state.player.blastCooldown > 0) return false;
  const vx = Math.cos(state.player.heading) * BLAST_SPEED;
  const vy = Math.sin(state.player.heading) * BLAST_SPEED;
  state.blasts.push({
    id: state.nextId++,
    x: state.player.x + Math.cos(state.player.heading) * (state.player.radius + 12),
    y: state.player.y + Math.sin(state.player.heading) * (state.player.radius + 12),
    vx,
    vy,
    radius: 9,
    damage: BLAST_DAMAGE,
    age: 0,
    maxAge: BLAST_MAX_AGE,
  });
  state.player.blastCooldown = BLAST_COOLDOWN;
  state.message = 'Shard blast fired. Give the scorecards something to dodge.';
  return true;
}

export function moveEnemiesTowardPlayer(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    if (enemy.status !== 'chasing') continue;
    enemy.aliveTime += dt;
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const aggression = enemy.experience.behaviorWeights.chase;
    const zig = Math.sin(state.elapsed * (4 + enemy.experience.behaviorWeights.zigZag * 6) + enemy.id) * enemy.experience.behaviorWeights.zigZag;
    const nx = dx / len;
    const ny = dy / len;
    enemy.x += (nx + -ny * zig * 0.35) * enemy.speed * aggression * dt;
    enemy.y += (ny + nx * zig * 0.35) * enemy.speed * aggression * dt;
  }
}

function distancePointToSegment(point: Vec, start: Vec, end: Vec): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq));
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

export function updateShardBlasts(state: GameState, dt: number): void {
  const remaining: ShardBlast[] = [];
  for (const blast of state.blasts) {
    const previous = { x: blast.x, y: blast.y };
    blast.age += dt;
    blast.x += blast.vx * dt;
    blast.y += blast.vy * dt;
    let hit = false;
    for (const enemy of state.enemies) {
      if (enemy.status !== 'chasing') continue;
      if (distancePointToSegment(enemy, previous, blast) <= blast.radius + enemy.radius) {
        damageJudge(state, enemy, blast.damage, 'shard_blast');
        hit = true;
        break;
      }
    }
    const inArena = blast.x >= 0 && blast.x <= state.variant.arena.width && blast.y >= 0 && blast.y <= state.variant.arena.height;
    if (!hit && inArena && blast.age < blast.maxAge) remaining.push(blast);
  }
  state.blasts = remaining;
}

export function damageJudge(state: GameState, enemy: Enemy, amount: number, source: 'shard_blast' | 'collision' | 'unknown'): void {
  if (enemy.status !== 'chasing') return;
  enemy.health = Math.max(0, enemy.health - amount);
  enemy.lastDamageDistance = distance(state.player, enemy);
  state.score += Math.max(1, Math.floor(amount / 8));
  if (enemy.health <= 0) {
    enemy.status = 'defeated';
    enemy.respawnTimer = JUDGE_RESPAWN_SECONDS;
    enemy.experience.lastDefeat = { damageSource: source, distance: enemy.lastDamageDistance, timeAliveSeconds: enemy.aliveTime };
    state.score += 25 + enemy.experience.level * 5;
    state.message = `${enemy.judge.handle} defeated by shard blast. The judge is taking notes...`;
  } else {
    state.message = `${enemy.judge.handle} took a shard blast. ${enemy.health}/${enemy.maxHealth} HP.`;
  }
}

function clampWeight(value: number): number {
  return Math.max(0, Math.min(1.6, value));
}

function applyJudgeLearning(enemy: Enemy): string {
  const xp = enemy.experience;
  xp.defeats += 1;
  xp.experience += 10;
  xp.level = 1 + Math.floor(xp.experience / 30);
  const last = xp.lastDefeat;
  const defeatDistance = last?.distance ?? enemy.lastDamageDistance;
  if (defeatDistance > 300) {
    xp.behaviorWeights.zigZag = clampWeight(xp.behaviorWeights.zigZag + 0.18);
    return 'zig-zag';
  }
  if (last && last.timeAliveSeconds > 20) {
    xp.behaviorWeights.chase = clampWeight(xp.behaviorWeights.chase + 0.08);
    return 'aggression';
  }
  xp.behaviorWeights.retreatWhenHurt = clampWeight(xp.behaviorWeights.retreatWhenHurt + 0.12);
  return 'survival instincts';
}

export function respawnDefeatedJudges(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    if (enemy.status !== 'defeated' && enemy.status !== 'respawning') continue;
    enemy.respawnTimer -= dt;
    if (enemy.respawnTimer <= 0) {
      const learned = applyJudgeLearning(enemy);
      const point = seededPoint(state.variant, enemy.id + enemy.experience.defeats * 97, 48);
      enemy.x = point.x;
      enemy.y = point.y;
      enemy.maxHealth = Math.round(enemy.maxHealth + 8 + enemy.experience.level * 2);
      enemy.health = enemy.maxHealth;
      enemy.status = 'chasing';
      enemy.aliveTime = 0;
      enemy.respawnTimer = 0;
      state.message = `${enemy.judge.handle} respawned and learned ${learned}.`;
    }
  }
}

export function checkCollisions(state: GameState): void {
  for (const enemy of state.enemies) {
    if (enemy.status !== 'chasing') continue;
    if (distance(state.player, enemy) <= state.player.radius + enemy.radius) {
      if (state.player.shield > 0) {
        state.player.shield -= 1;
        enemy.x = 32;
        enemy.y = 32;
        state.message = `${enemy.judge.handle} got PR-spun into the corner. Shield spent.`;
      } else {
        state.status = 'gameover';
        state.message = `${enemy.judge.handle} caught your prototype and yelled “${enemy.judge.bark}” Final score: ${state.score}.`;
      }
      return;
    }
  }
}

function normalizeAngle(angle: number): number {
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

export function tickGame(state: GameState, input: Vec, dt: number): void {
  if (state.status !== 'playing') return;
  state.elapsed += dt;
  state.waveTimeRemaining -= dt;
  state.player.blastCooldown = Math.max(0, state.player.blastCooldown - dt);

  const forward = -input.y;
  const strafe = input.x;
  const moveLength = Math.hypot(forward, strafe) || 1;
  const forwardX = Math.cos(state.player.heading);
  const forwardY = Math.sin(state.player.heading);
  const rightX = -Math.sin(state.player.heading);
  const rightY = Math.cos(state.player.heading);
  state.player.x += ((forwardX * forward + rightX * strafe) / moveLength) * state.player.speed * dt;
  state.player.y += ((forwardY * forward + rightY * strafe) / moveLength) * state.player.speed * dt;

  clampPlayerToArena(state);
  collectShard(state);
  updateShardBlasts(state, dt);
  moveEnemiesTowardPlayer(state, dt);
  respawnDefeatedJudges(state, dt);
  checkCollisions(state);
  if (state.status === 'playing' && (state.waveTimeRemaining <= 0 || state.shards.length === 0)) {
    state.status = 'upgrade';
    state.message = `Wave ${state.wave} survived. Choose a mutation before the judges reload.`;
  }
}

export function chooseUpgradeOptions(state: GameState, variant: GameVariant): Upgrade[] {
  const start = Math.floor(seededUnit(variant.seed + state.wave * 71) * UPGRADES.length);
  const options: Upgrade[] = [];
  for (let i = 0; options.length < 3; i += 1) {
    const upgrade = UPGRADES[(start + i) % UPGRADES.length];
    if (!options.some((existing) => existing.id === upgrade.id)) options.push(upgrade);
  }
  return options;
}

export function applyUpgradeAndStartNextWave(state: GameState, upgrade: Upgrade): void {
  upgrade.apply(state);
  state.wave += 1;
  state.status = 'playing';
  state.message = `${upgrade.title} installed. Survive wave ${state.wave}.`;
  refillWave(state);
}
