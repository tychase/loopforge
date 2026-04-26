import { useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import {
  DEFAULT_VARIANT,
  applyUpgradeAndStartNextWave,
  chooseUpgradeOptions,
  createInitialState,
  tickGame,
  type GameState,
  type Vec,
} from './game';

const keys = new Set<string>();

function inputVector(): Vec {
  return {
    x: (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0),
    y: (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0),
  };
}

function draw(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state.variant.arena;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#07111f');
  gradient.addColorStop(1, '#18091f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(125, 249, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y < height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

  for (const shard of state.shards) {
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath();
    ctx.moveTo(shard.x, shard.y - shard.radius);
    ctx.lineTo(shard.x + shard.radius, shard.y);
    ctx.lineTo(shard.x, shard.y + shard.radius);
    ctx.lineTo(shard.x - shard.radius, shard.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  for (const enemy of state.enemies) {
    ctx.strokeStyle = `hsl(${enemy.hue} 90% 65%)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(125, 249, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.magnetRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowColor = '#f5f2d0';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#f5f2d0';
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (state.player.shield > 0) {
    ctx.strokeStyle = '#9cff8f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState(DEFAULT_VARIANT));
  const [snapshot, setSnapshot] = useState<GameState>(stateRef.current);
  const upgrades = useMemo(() => chooseUpgradeOptions(snapshot, DEFAULT_VARIANT), [snapshot.status, snapshot.wave]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => keys.add(event.key.toLowerCase());
    const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
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
      setSnapshot({ ...state, player: { ...state.player }, shards: [...state.shards], enemies: [...state.enemies] });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const restart = () => {
    stateRef.current = createInitialState(DEFAULT_VARIANT);
    setSnapshot(stateRef.current);
  };

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Hermes Game Lab / Vibe Jam 2026</p>
        <h1>LoopForge</h1>
        <p>Hermes generates the mutations. You survive them.</p>
      </section>

      <section className="hud" aria-label="game stats">
        <div><span>Score</span><strong>{snapshot.score}</strong></div>
        <div><span>Wave</span><strong>{snapshot.wave}</strong></div>
        <div><span>Time</span><strong>{Math.max(0, Math.ceil(snapshot.waveTimeRemaining))}</strong></div>
        <div><span>Shield</span><strong>{snapshot.player.shield}</strong></div>
      </section>

      <div className="gameWrap">
        <canvas ref={canvasRef} width={DEFAULT_VARIANT.arena.width} height={DEFAULT_VARIANT.arena.height} aria-label="LoopForge playable arena" />
        {snapshot.status !== 'playing' && (
          <div className="overlay">
            <h2>{snapshot.status === 'upgrade' ? 'Mutation choice' : 'Game over'}</h2>
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
            ) : <button onClick={restart}>Restart loop</button>}
          </div>
        )}
      </div>

      <section className="labPanel">
        <div>
          <h2>{DEFAULT_VARIANT.name}</h2>
          <p>{DEFAULT_VARIANT.hypothesis}</p>
        </div>
        <div className="controls">Move with WASD or arrow keys. Collect cyan shards. Avoid pink loops. No login, no account, just play.</div>
      </section>
    </main>
  );
}
