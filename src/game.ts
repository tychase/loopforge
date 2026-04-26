export type Vec = { x: number; y: number };
export type Status = 'playing' | 'upgrade' | 'gameover';

export type Player = Vec & {
  radius: number;
  speed: number;
  magnetRadius: number;
  shield: number;
};

export type Shard = Vec & { id: number; radius: number; value: number };
export type Enemy = Vec & { id: number; radius: number; speed: number; hue: number };
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
  score: number;
  wave: number;
  elapsed: number;
  waveTimeRemaining: number;
  status: Status;
  message: string;
  nextId: number;
};

export const DEFAULT_VARIANT: GameVariant = {
  id: 'close-call-magnetism',
  name: 'Close Call Magnetism',
  hypothesis: 'Small magnetism and short waves create fair tension without manipulative reward loops.',
  arena: { width: 960, height: 600 },
  waveSeconds: 24,
  shardsPerWave: 8,
  baseEnemySpeed: 84,
  enemySpeedPerWave: 13,
  seed: 1337,
};

const UPGRADES: Upgrade[] = [
  { id: 'swift-boots', title: 'Swift Boots', description: '+12% movement speed', apply: (state) => { state.player.speed *= 1.12; } },
  { id: 'wider-magnet', title: 'Wider Magnet', description: '+32 shard magnet radius', apply: (state) => { state.player.magnetRadius += 32; } },
  { id: 'soft-shield', title: 'Soft Shield', description: 'Absorb one enemy collision', apply: (state) => { state.player.shield += 1; } },
  { id: 'brighter-shards', title: 'Brighter Shards', description: '+1 point per future shard', apply: (state) => { state.shards.forEach((shard) => shard.value += 1); } },
  { id: 'calmer-loop', title: 'Calmer Loop', description: '+4 seconds next wave', apply: (state) => { state.waveTimeRemaining += 4; } },
];

export function seededUnit(seed: number): number {
  const x = Math.sin(seed * 999.123) * 10000;
  return x - Math.floor(x);
}

function seededPoint(variant: GameVariant, index: number, margin = 36): Vec {
  const x = margin + seededUnit(variant.seed + index * 17) * (variant.arena.width - margin * 2);
  const y = margin + seededUnit(variant.seed + index * 31) * (variant.arena.height - margin * 2);
  return { x, y };
}

export function createInitialState(variant: GameVariant = DEFAULT_VARIANT): GameState {
  const state: GameState = {
    variant,
    player: {
      x: variant.arena.width / 2,
      y: variant.arena.height / 2,
      radius: 15,
      speed: 235,
      magnetRadius: 64,
      shield: 0,
    },
    shards: [],
    enemies: [],
    score: 0,
    wave: 1,
    elapsed: 0,
    waveTimeRemaining: variant.waveSeconds,
    status: 'playing',
    message: 'Collect shards. Dodge the loops. Survive the wave.',
    nextId: 1,
  };
  refillWave(state);
  return state;
}

export function refillWave(state: GameState): void {
  state.shards = Array.from({ length: state.variant.shardsPerWave }, (_, i) => {
    const point = seededPoint(state.variant, state.wave * 100 + i);
    return { id: state.nextId++, x: point.x, y: point.y, radius: 8, value: 1 };
  });
  const enemyCount = Math.min(2 + state.wave, 8);
  state.enemies = Array.from({ length: enemyCount }, (_, i) => spawnEnemyForWave(state.variant, state.wave, i));
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
    const pickupDistance = state.player.radius + shard.radius;
    const magnetDistance = state.player.magnetRadius;
    const d = distance(state.player, shard);
    if (d <= pickupDistance || d <= magnetDistance) {
      state.score += shard.value;
      return false;
    }
    return true;
  });
  return state.shards.length !== before;
}

export function spawnEnemyForWave(variant: GameVariant, wave: number, index: number): Enemy {
  const edge = index % 4;
  const t = seededUnit(variant.seed + index * 47);
  const x = edge === 0 ? 20 : edge === 1 ? variant.arena.width - 20 : t * variant.arena.width;
  const y = edge === 2 ? 20 : edge === 3 ? variant.arena.height - 20 : t * variant.arena.height;
  return {
    id: wave * 1000 + index,
    x,
    y,
    radius: 13,
    speed: variant.baseEnemySpeed + (wave - 1) * variant.enemySpeedPerWave,
    hue: 320 + ((wave + index) * 19) % 40,
  };
}

export function moveEnemiesTowardPlayer(state: GameState, dt: number): void {
  for (const enemy of state.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / len) * enemy.speed * dt;
    enemy.y += (dy / len) * enemy.speed * dt;
  }
}

export function checkCollisions(state: GameState): void {
  for (const enemy of state.enemies) {
    if (distance(state.player, enemy) <= state.player.radius + enemy.radius) {
      if (state.player.shield > 0) {
        state.player.shield -= 1;
        enemy.x = 24;
        enemy.y = 24;
        state.message = 'Shield spent. Keep moving.';
      } else {
        state.status = 'gameover';
        state.message = `Loop collapsed at wave ${state.wave}. Final score: ${state.score}.`;
      }
      return;
    }
  }
}

export function tickGame(state: GameState, input: Vec, dt: number): void {
  if (state.status !== 'playing') return;
  state.elapsed += dt;
  state.waveTimeRemaining -= dt;
  const length = Math.hypot(input.x, input.y) || 1;
  state.player.x += (input.x / length) * state.player.speed * dt;
  state.player.y += (input.y / length) * state.player.speed * dt;
  clampPlayerToArena(state);
  collectShard(state);
  moveEnemiesTowardPlayer(state, dt);
  checkCollisions(state);
  if (state.status === 'playing' && (state.waveTimeRemaining <= 0 || state.shards.length === 0)) {
    state.status = 'upgrade';
    state.message = `Wave ${state.wave} stabilized. Choose a mutation.`;
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
