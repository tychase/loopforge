import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import { JUDGE_CHASERS, selectJudgeSprite, type CharacterAnimation } from './characters';
import {
  DEFAULT_VARIANT,
  applyUpgradeAndStartNextWave,
  chooseUpgradeOptions,
  createInitialState,
  distance,
  fireShardBlast,
  isNavigationKey,
  tickGame,
  turnPlayerView,
  type Enemy,
  type GameState,
  type Shard,
  type ShardBlast,
  type Vec,
} from './game';

const keys = new Set<string>();
const CANVAS = { width: 960, height: 600 };
const loadedSprites = new Map<string, HTMLImageElement>();
const brokenSprites = new Set<string>();

type Projected = {
  kind: 'shard' | 'judge' | 'blast';
  x: number;
  y: number;
  scale: number;
  depth: number;
  entity: Shard | Enemy | ShardBlast;
};

function inputVector(): Vec {
  return {
    x: (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0),
    y: (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0),
  };
}

function projectPoint(state: GameState, point: Vec, kind: Projected['kind'], entity: Shard | Enemy | ShardBlast): Projected | null {
  const dx = point.x - state.player.x;
  const dy = point.y - state.player.y;
  const sin = Math.sin(state.player.heading);
  const cos = Math.cos(state.player.heading);
  const forward = cos * dx + sin * dy;
  const right = -sin * dx + cos * dy;
  if (forward < 18) return null;
  const fovScale = 470;
  const x = CANVAS.width / 2 + (right / forward) * fovScale;
  const scale = Math.min(2.7, Math.max(0.18, 210 / forward));
  const floorY = CANVAS.height * 0.74 - scale * 18;
  if (x < -160 || x > CANVAS.width + 160) return null;
  return { kind, x, y: floorY, scale, depth: forward, entity };
}

function drawSkyAndFloor(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = CANVAS;
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.48);
  sky.addColorStop(0, '#0d1230');
  sky.addColorStop(0.55, '#241040');
  sky.addColorStop(1, '#ff4dca');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.52);

  const floor = ctx.createLinearGradient(0, height * 0.48, 0, height);
  floor.addColorStop(0, '#13071b');
  floor.addColorStop(1, '#03040a');
  ctx.fillStyle = floor;
  ctx.fillRect(0, height * 0.48, width, height * 0.52);

  ctx.strokeStyle = 'rgba(125, 249, 255, 0.16)';
  ctx.lineWidth = 1;
  const horizon = height * 0.52;
  for (let i = 0; i < 18; i += 1) {
    const y = horizon + i * i * 1.9;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let i = -10; i <= 10; i += 1) {
    const wobble = Math.sin(state.elapsed * 1.7 + i) * 14;
    ctx.beginPath();
    ctx.moveTo(width / 2 + i * 26 + wobble, horizon);
    ctx.lineTo(width / 2 + i * 116, height);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 207, 92, 0.9)';
  ctx.font = '700 20px ui-sans-serif, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('THE VIBE TUNNEL', width / 2, 58);
  ctx.fillStyle = 'rgba(247, 242, 220, 0.68)';
  ctx.font = '14px ui-sans-serif, system-ui';
  ctx.fillText('Collect shards before the jury catches the prototype', width / 2, 82);
}

function drawShard(ctx: CanvasRenderingContext2D, item: Projected): void {
  const shard = item.entity as Shard;
  const size = 22 * item.scale;
  ctx.save();
  ctx.translate(item.x, item.y - size * 0.9);
  ctx.shadowColor = '#7df9ff';
  ctx.shadowBlur = 22 * item.scale;
  ctx.fillStyle = '#7df9ff';
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.72, 0);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#031018';
  ctx.font = `${Math.max(10, 12 * item.scale)}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText(String(shard.value), 0, 4 * item.scale);
  ctx.restore();
}

function drawBlast(ctx: CanvasRenderingContext2D, item: Projected): void {
  const size = 12 * item.scale;
  ctx.save();
  ctx.translate(item.x, item.y - size * 1.7);
  ctx.shadowColor = '#7df9ff';
  ctx.shadowBlur = 28 * item.scale;
  ctx.fillStyle = '#f7f2dc';
  ctx.strokeStyle = '#7df9ff';
  ctx.lineWidth = Math.max(2, 3 * item.scale);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(5, size), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function judgeAnimation(enemy: Enemy): CharacterAnimation {
  if (enemy.status === 'defeated') return 'defeated';
  if (enemy.status === 'respawning') return 'respawn';
  if (enemy.health < enemy.maxHealth * 0.45) return 'hurt';
  return 'chase';
}

function getLoadedSprite(src: string): HTMLImageElement | undefined {
  if (brokenSprites.has(src)) return undefined;
  const existing = loadedSprites.get(src);
  if (existing) return existing.complete && existing.naturalWidth > 0 ? existing : undefined;
  const image = new Image();
  image.onload = () => loadedSprites.set(src, image);
  image.onerror = () => {
    loadedSprites.delete(src);
    brokenSprites.add(src);
  };
  image.src = src;
  loadedSprites.set(src, image);
  return undefined;
}

function drawJudgeCard(ctx: CanvasRenderingContext2D, item: Projected): void {
  const enemy = item.entity as Enemy;
  const judge = enemy.judge;
  const w = 92 * item.scale;
  const h = 124 * item.scale;
  const x = item.x - w / 2;
  const y = item.y - h;
  ctx.save();
  ctx.shadowColor = judge.color;
  ctx.shadowBlur = 24 * item.scale;
  ctx.fillStyle = enemy.status === 'chasing' ? 'rgba(5, 7, 17, 0.92)' : 'rgba(30, 20, 42, 0.62)';
  ctx.strokeStyle = judge.color;
  ctx.lineWidth = Math.max(2, 3 * item.scale);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18 * item.scale);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.max(24, 42 * item.scale)}px serif`;
  ctx.fillText(judge.emoji, item.x, y + 45 * item.scale);
  ctx.fillStyle = judge.color;
  ctx.font = `900 ${Math.max(12, 15 * item.scale)}px ui-sans-serif, system-ui`;
  ctx.fillText(judge.handle, item.x, y + 73 * item.scale);
  ctx.fillStyle = '#f7f2dc';
  ctx.font = `700 ${Math.max(10, 12 * item.scale)}px ui-sans-serif, system-ui`;
  ctx.fillText(enemy.status === 'chasing' ? judge.role.toUpperCase() : 'RESPAWNING', item.x, y + 94 * item.scale);

  const healthRatio = Math.max(0, enemy.health / enemy.maxHealth);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(x + 12 * item.scale, y + 101 * item.scale, w - 24 * item.scale, 6 * item.scale);
  ctx.fillStyle = healthRatio > 0.35 ? '#9cff8f' : '#ff4dca';
  ctx.fillRect(x + 12 * item.scale, y + 101 * item.scale, (w - 24 * item.scale) * healthRatio, 6 * item.scale);

  if (item.scale > 0.8) {
    ctx.fillStyle = 'rgba(247, 242, 220, 0.78)';
    ctx.font = `${Math.max(9, 10 * item.scale)}px ui-sans-serif, system-ui`;
    ctx.fillText('“' + judge.bark.slice(0, 24) + '”', item.x, y + 113 * item.scale);
  }
  ctx.restore();
}

function drawJudgeSprite(ctx: CanvasRenderingContext2D, item: Projected, image: HTMLImageElement): void {
  const enemy = item.entity as Enemy;
  const judge = enemy.judge;
  const healthRatio = Math.max(0, enemy.health / enemy.maxHealth);
  const w = 112 * item.scale;
  const h = 142 * item.scale;
  const x = item.x - w / 2;
  const y = item.y - h;
  ctx.save();
  ctx.globalAlpha = enemy.status === 'chasing' ? 1 : 0.55;
  ctx.shadowColor = judge.color;
  ctx.shadowBlur = 30 * item.scale;
  ctx.drawImage(image, x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(3, 4, 10, 0.7)';
  ctx.strokeStyle = judge.color;
  ctx.lineWidth = Math.max(1, 2 * item.scale);
  ctx.beginPath();
  ctx.roundRect(x + 10 * item.scale, y + h - 24 * item.scale, w - 20 * item.scale, 18 * item.scale, 9 * item.scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(x + 18 * item.scale, y + h - 17 * item.scale, w - 36 * item.scale, 5 * item.scale);
  ctx.fillStyle = healthRatio > 0.35 ? '#9cff8f' : '#ff4dca';
  ctx.fillRect(x + 18 * item.scale, y + h - 17 * item.scale, (w - 36 * item.scale) * healthRatio, 5 * item.scale);
  ctx.fillStyle = '#f7f2dc';
  ctx.font = `900 ${Math.max(10, 13 * item.scale)}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.fillText(judge.handle, item.x, y + h - 29 * item.scale);
  ctx.restore();
}

function drawJudge(ctx: CanvasRenderingContext2D, item: Projected): void {
  const enemy = item.entity as Enemy;
  const sprite = selectJudgeSprite(enemy.judge, judgeAnimation(enemy));
  const image = sprite ? getLoadedSprite(sprite) : undefined;
  if (image) drawJudgeSprite(ctx, item, image);
  else drawJudgeCard(ctx, item);
}

function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState): void {
  const size = 116;
  const x = CANVAS.width - size - 18;
  const y = 18;
  const sx = size / state.variant.arena.width;
  const sy = size / state.variant.arena.height;
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 10, 0.7)';
  ctx.strokeStyle = 'rgba(125,249,255,.28)';
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 16);
  ctx.fill();
  ctx.stroke();
  for (const shard of state.shards) {
    ctx.fillStyle = '#7df9ff';
    ctx.fillRect(x + shard.x * sx - 2, y + shard.y * sy - 2, 4, 4);
  }
  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.status === 'chasing' ? enemy.judge.color : 'rgba(185,195,223,.45)';
    ctx.beginPath();
    ctx.arc(x + enemy.x * sx, y + enemy.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const blast of state.blasts) {
    ctx.fillStyle = '#f7f2dc';
    ctx.beginPath();
    ctx.arc(x + blast.x * sx, y + blast.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(x + state.player.x * sx, y + state.player.y * sy);
  ctx.rotate(state.player.heading);
  ctx.fillStyle = '#f5f2d0';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRearWarning(ctx: CanvasRenderingContext2D, state: GameState): void {
  const nearest = state.enemies.reduce<Enemy | null>((best, enemy) => {
    if (enemy.status !== 'chasing') return best;
    return !best || distance(state.player, enemy) < distance(state.player, best) ? enemy : best;
  }, null);
  if (!nearest) return;
  const d = Math.round(distance(state.player, nearest));
  ctx.save();
  ctx.fillStyle = d < 140 ? 'rgba(255, 77, 202, 0.94)' : 'rgba(3, 4, 10, 0.62)';
  ctx.strokeStyle = nearest.judge.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(18, 18, 300, 70, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7f2dc';
  ctx.font = '800 15px ui-sans-serif, system-ui';
  ctx.fillText(`${nearest.judge.emoji} ${nearest.judge.handle} closing in`, 36, 44);
  ctx.fillStyle = '#b9c3df';
  ctx.font = '13px ui-sans-serif, system-ui';
  ctx.fillText(`${d}m away: “${nearest.judge.bark}”`, 36, 68);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);
  drawSkyAndFloor(ctx, state);

  const projected: Projected[] = [
    ...state.shards.map((shard) => projectPoint(state, shard, 'shard', shard)),
    ...state.blasts.map((blast) => projectPoint(state, blast, 'blast', blast)),
    ...state.enemies.map((enemy) => projectPoint(state, enemy, 'judge', enemy)),
  ].filter((item): item is Projected => Boolean(item)).sort((a, b) => b.depth - a.depth);

  for (const item of projected) {
    if (item.kind === 'shard') drawShard(ctx, item);
    else if (item.kind === 'blast') drawBlast(ctx, item);
    else drawJudge(ctx, item);
  }

  drawRearWarning(ctx, state);
  drawMinimap(ctx, state);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(DEFAULT_VARIANT));
  const [snapshot, setSnapshot] = useState<GameState>(stateRef.current);
  const upgrades = useMemo(() => chooseUpgradeOptions(snapshot, DEFAULT_VARIANT), [snapshot.status, snapshot.wave]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isNavigationKey(event.key)) event.preventDefault();
      if (event.key === ' ') fireShardBlast(stateRef.current);
      if (event.key.toLowerCase() === 'q') turnPlayerView(stateRef.current, -18);
      if (event.key.toLowerCase() === 'e') turnPlayerView(stateRef.current, 18);
      keys.add(event.key.toLowerCase());
    };
    const up = (event: KeyboardEvent) => {
      if (isNavigationKey(event.key)) event.preventDefault();
      keys.delete(event.key.toLowerCase());
    };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up, { passive: false });
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (document.pointerLockElement === canvasRef.current) turnPlayerView(stateRef.current, event.movementX);
    };
    document.addEventListener('mousemove', move);
    return () => document.removeEventListener('mousemove', move);
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const state = stateRef.current;
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      tickGame(state, inputVector(), dt);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx, state);
      setSnapshot({ ...state, player: { ...state.player }, shards: [...state.shards], enemies: [...state.enemies], blasts: [...state.blasts] });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const restart = () => {
    keys.clear();
    stateRef.current = createInitialState(DEFAULT_VARIANT);
    setSnapshot(stateRef.current);
  };

  const handlePointerDown = () => {
    const canvas = canvasRef.current;
    canvas?.focus();
    canvas?.requestPointerLock?.();
    fireShardBlast(stateRef.current);
  };

  const activeJudges = snapshot.enemies.filter((enemy) => enemy.status === 'chasing').length;
  const defeatedJudges = snapshot.enemies.length - activeJudges;
  const blastReady = snapshot.player.blastCooldown <= 0;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Hermes Game Lab / Vibe Jam 2026</p>
          <h1>LoopForge</h1>
        </div>
        <p>First-person shard heist. Fire shard blasts, drop judge health bars, and watch defeated judges respawn a little smarter.</p>
      </section>

      <section className="hud" aria-label="game stats">
        <div><span>Score</span><strong>{snapshot.score}</strong></div>
        <div><span>Wave</span><strong>{snapshot.wave}</strong></div>
        <div><span>Clock</span><strong>{Math.max(0, Math.ceil(snapshot.waveTimeRemaining))}</strong></div>
        <div><span>Blast</span><strong>{blastReady ? 'READY' : Math.ceil(snapshot.player.blastCooldown * 10) / 10}</strong></div>
        <div><span>Judges</span><strong>{activeJudges}/{snapshot.enemies.length}</strong></div>
      </section>

      <div className="gameWrap">
        <canvas
          ref={canvasRef}
          width={CANVAS.width}
          height={CANVAS.height}
          aria-label="LoopForge FPV playable arena"
          tabIndex={0}
          onPointerDown={handlePointerDown}
        />
        {snapshot.status !== 'playing' && (
          <div className="overlay">
            <h2>{snapshot.status === 'upgrade' ? 'Mutation choice' : 'Prototype roasted'}</h2>
            <p>{snapshot.message}</p>
            {snapshot.status === 'upgrade' ? (
              <div className="upgradeGrid">
                {upgrades.map((upgrade) => (
                  <button key={upgrade.id} onClick={() => { applyUpgradeAndStartNextWave(stateRef.current, upgrade); setSnapshot({ ...stateRef.current }); }}>
                    <strong>{upgrade.title}</strong>
                    <span>{upgrade.description}</span>
                  </button>
                ))}
              </div>
            ) : <button onClick={restart}>Restart the pitch</button>}
          </div>
        )}
      </div>

      <section className="labPanel">
        <div>
          <h2>{DEFAULT_VARIANT.name}</h2>
          <p>{DEFAULT_VARIANT.hypothesis}</p>
        </div>
        <div className="controls">Click the arena to capture mouse look. Move the mouse to aim, W/↑ moves forward, S/↓ backs up, A/D or ←/→ strafe, Q/E are keyboard-look fallback, and Space/click fires shard blasts. Defeat judges for points; defeated judges respawn with local per-match learning. Active: {activeJudges}, reloading: {defeatedJudges}. Chasers: {JUDGE_CHASERS.map((judge) => judge.handle).join(', ')}.</div>
      </section>
    </main>
  );
}
