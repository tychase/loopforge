import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './styles.css';
import { GameHud } from './GameHud';
import { ThreeCanvas } from './ThreeCanvas';
import { JUDGE_CHASERS, selectJudgeSprite, type CharacterAnimation } from './characters';
import {
  DEFAULT_VARIANT,
  aimPlayerAtCursor,
  applyUpgradeAndStartNextWave,
  chooseUpgradeOptions,
  createInitialState,
  distance,
  fireShardBlast,
  isNavigationKey,
  nearestChasingEnemy,
  startGame,
  tickGame,
  type CombatNotice,
  type Enemy,
  type GamePortal,
  type GameState,
  type JudgeExperience,
  type Shard,
  type ShardBlast,
  type Upgrade,
  type Vec,
} from './game';
import { createWorldView, type WorldView } from './game/render/camera';
import { screenDepth, worldToScreen, type ScreenPoint } from './game/render/projection';

const keys = new Set<string>();
const CANVAS = { width: 960, height: 600 };
const PLAYER_SPRITE_SRC = '/assets/player/over-shoulder-builder.png';
const VFX_SHEET_SRC = '/assets/effects/vfx-sheet.png';
const loadedSprites = new Map<string, HTMLImageElement>();
const brokenSprites = new Set<string>();
const THREAT_WARNING_DISTANCE = 330;
const THREAT_DANGER_DISTANCE = 170;
const THREAT_LUNGE_DISTANCE = 110;

const CAMERA = {
  backOffset: 178,
  horizon: 166,
  floorBottom: 604,
  focalLength: 540,
  depthLimit: 1250,
  nearClip: 36,
};

type Projected = {
  kind: 'shard' | 'judge' | 'blast';
  x: number;
  y: number;
  scale: number;
  depth: number;
  lateral: number;
  entity: Shard | Enemy | ShardBlast;
};

type CameraBasis = {
  forward: Vec;
  right: Vec;
  camera: Vec;
};

type JudgeVars = CSSProperties & {
  '--judge-color': string;
  '--judge-alt': string;
};

type UpgradeVars = CSSProperties & {
  '--upgrade-color': string;
};

function inputVector(): Vec {
  return {
    x: (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0),
    y: (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0),
  };
}

function cloneExperience(experience: JudgeExperience): JudgeExperience {
  return {
    ...experience,
    behaviorWeights: { ...experience.behaviorWeights },
    lastDefeat: experience.lastDefeat ? { ...experience.lastDefeat } : undefined,
  };
}

function snapshotState(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player },
    shards: state.shards.map((shard) => ({ ...shard })),
    enemies: state.enemies.map((enemy) => ({ ...enemy, experience: cloneExperience(enemy.experience) })),
    blasts: state.blasts.map((blast) => ({ ...blast })),
    notices: state.notices.map((notice) => ({ ...notice })),
    pickupTrails: state.pickupTrails.map((trail) => ({ ...trail, from: { ...trail.from }, to: { ...trail.to } })),
    pickupParticles: state.pickupParticles.map((particle) => ({ ...particle })),
    scorePopups: state.scorePopups.map((popup) => ({ ...popup })),
    pickupCombo: { ...state.pickupCombo },
    portals: state.portals.map((portal) => ({ ...portal })),
  };
}

function healthRatio(enemy: Enemy): number {
  return Math.max(0, Math.min(1, enemy.health / enemy.maxHealth));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function threatIntensity(state: GameState, enemy: Enemy): number {
  if (state.status !== 'playing' || state.graceRemaining > 0 || enemy.status !== 'chasing') return 0;
  return clamp(1 - distance(state.player, enemy) / THREAT_WARNING_DISTANCE, 0, 1);
}

function learnedLabel(enemy: Enemy): string {
  if (enemy.experience.defeats === 0) return enemy.judge.prop;
  const weights = enemy.experience.behaviorWeights;
  if (weights.zigZag >= weights.retreatWhenHurt && weights.zigZag > 0) return 'learned zig-zag routes';
  if (weights.chase > 1.02) return 'learned hard chase';
  if (weights.retreatWhenHurt > 0) return 'learned survival resets';
  return 'taking notes';
}

function upgradeStyle(upgrade: Upgrade): UpgradeVars {
  return {
    '--upgrade-color': upgrade.color ?? '#7df9ff',
  };
}

function clipToWorldView(ctx: CanvasRenderingContext2D, view: WorldView): void {
  ctx.beginPath();
  ctx.roundRect(view.x, view.y, view.width, view.height, 14);
  ctx.clip();
}

function cameraBasis(state: GameState): CameraBasis {
  const forward = { x: Math.cos(state.player.heading), y: Math.sin(state.player.heading) };
  const right = { x: -forward.y, y: forward.x };
  return {
    forward,
    right,
    camera: {
      x: state.player.x - forward.x * CAMERA.backOffset,
      y: state.player.y - forward.y * CAMERA.backOffset,
    },
  };
}

function projectWorldPoint(state: GameState, point: Vec): { x: number; y: number; scale: number; depth: number; lateral: number } | null {
  const basis = cameraBasis(state);
  const dx = point.x - basis.camera.x;
  const dy = point.y - basis.camera.y;
  const depth = basis.forward.x * dx + basis.forward.y * dy;
  const lateral = basis.right.x * dx + basis.right.y * dy;
  if (depth < CAMERA.nearClip) return null;

  const x = CANVAS.width / 2 + (lateral / depth) * CAMERA.focalLength;
  const depthRatio = Math.max(0, Math.min(1, depth / CAMERA.depthLimit));
  const y = CAMERA.horizon + (1 - Math.pow(depthRatio, 0.55)) * (CAMERA.floorBottom - CAMERA.horizon);
  const scale = Math.min(2.6, Math.max(0.18, 260 / Math.max(72, depth)));
  if (x < -260 || x > CANVAS.width + 260 || y < CAMERA.horizon - 130 || y > CANVAS.height + 180) return null;
  return { x, y, scale, depth, lateral };
}

function projectEntity(state: GameState, point: Vec, kind: Projected['kind'], entity: Projected['entity']): Projected | null {
  const projected = projectWorldPoint(state, point);
  return projected ? { kind, ...projected, entity } : null;
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

function drawPerspectiveArena(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = CANVAS;
  const sky = ctx.createLinearGradient(0, 0, 0, CAMERA.horizon);
  sky.addColorStop(0, '#081022');
  sky.addColorStop(0.48, '#111a36');
  sky.addColorStop(1, '#28113b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, CAMERA.horizon);

  const floor = ctx.createLinearGradient(0, CAMERA.horizon, 0, height);
  floor.addColorStop(0, '#24103a');
  floor.addColorStop(0.46, '#071523');
  floor.addColorStop(1, '#03040a');
  ctx.fillStyle = floor;
  ctx.fillRect(0, CAMERA.horizon, width, height - CAMERA.horizon);

  ctx.save();
  const vanishingX = width / 2 + Math.sin(state.player.heading * 2) * 18;
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.18)';
  ctx.lineWidth = 1;
  for (let i = -12; i <= 12; i += 1) {
    const bottomX = width / 2 + i * 96 - ((state.player.x + state.player.y) % 96) * 0.32;
    const horizonX = vanishingX + i * 8;
    ctx.beginPath();
    ctx.moveTo(horizonX, CAMERA.horizon);
    ctx.lineTo(bottomX, height);
    ctx.stroke();
  }

  for (let i = 1; i <= 18; i += 1) {
    const t = i / 18;
    const y = CAMERA.horizon + Math.pow(t, 2.15) * (height - CAMERA.horizon);
    const alpha = 0.11 + t * 0.17;
    ctx.strokeStyle = `rgba(125, 249, 255, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 207, 92, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i += 1) {
    const y = CAMERA.horizon + 54 + i * 72;
    ctx.beginPath();
    ctx.ellipse(width / 2, y, 120 + i * 84, 18 + i * 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(width / 2, CAMERA.horizon + 138, 0, width / 2, CAMERA.horizon + 138, 360);
  glow.addColorStop(0, 'rgba(125, 249, 255, 0.18)');
  glow.addColorStop(0.38, 'rgba(255, 77, 202, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, CAMERA.horizon, width, height - CAMERA.horizon);

  ctx.strokeStyle = 'rgba(255, 77, 202, 0.46)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(62, CAMERA.horizon + 6);
  ctx.lineTo(86, height);
  ctx.moveTo(width - 62, CAMERA.horizon + 6);
  ctx.lineTo(width - 86, height);
  ctx.stroke();

  ctx.fillStyle = 'rgba(247, 242, 220, 0.08)';
  ctx.fillRect(0, CAMERA.horizon - 6, width, 6);
  ctx.restore();
}

function drawVfxCell(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  col: number,
  row: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0,
): void {
  const cols = 4;
  const rows = 4;
  const cellW = image.naturalWidth / cols;
  const cellH = image.naturalHeight / rows;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function strokeProjectedLine(
  ctx: CanvasRenderingContext2D,
  view: WorldView,
  from: Vec,
  to: Vec,
  steps = 18,
): void {
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = worldToScreen(view, {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  point: ScreenPoint,
  width: number,
  height: number,
  alpha = 0.36,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(point.x, point.y + 7 * point.scale, width * point.scale, height * point.scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawThreatProximityField(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  const nearest = nearestChasingEnemy(state);
  if (!nearest || state.status !== 'playing' || state.graceRemaining > 0) return;

  const player = worldToScreen(view, state.player);
  const d = distance(state.player, nearest);
  const intensity = clamp(1 - d / THREAT_WARNING_DISTANCE, 0, 1);
  if (intensity <= 0) return;

  const pulse = 0.5 + Math.sin(state.elapsed * (8 + intensity * 7)) * 0.5;
  const warningRadius = THREAT_DANGER_DISTANCE * view.scale * player.scale * (1 + pulse * 0.08);
  const outerRadius = THREAT_WARNING_DISTANCE * view.scale * player.scale * 0.72;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255, 77, 202, ${0.2 + intensity * 0.44})`;
  ctx.shadowColor = nearest.judge.color;
  ctx.shadowBlur = 16 + intensity * 28;
  ctx.lineWidth = 2 + intensity * 3;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.ellipse(player.x, player.y, outerRadius, outerRadius * 0.44, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = d < THREAT_DANGER_DISTANCE
    ? `rgba(255, 207, 92, ${0.4 + pulse * 0.35})`
    : `rgba(255, 77, 202, ${0.28 + pulse * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(player.x, player.y, warningRadius, warningRadius * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawJudgeThreatAura(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  state: GameState,
  view: WorldView,
  isTarget: boolean,
): void {
  const intensity = threatIntensity(state, enemy);
  if (intensity <= 0) return;

  const point = worldToScreen(view, enemy);
  const player = worldToScreen(view, state.player);
  const d = distance(state.player, enemy);
  const lunge = d < THREAT_LUNGE_DISTANCE;
  const pulse = 0.5 + Math.sin(state.elapsed * (10 + intensity * 8) + enemy.id) * 0.5;
  const radius = (46 + intensity * 36 + (lunge ? pulse * 24 : 0)) * point.scale;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255, 77, 202, ${0.18 + intensity * 0.46})`;
  ctx.fillStyle = `rgba(255, 77, 202, ${0.035 + intensity * 0.08})`;
  ctx.shadowColor = enemy.judge.color;
  ctx.shadowBlur = isTarget ? 28 : 18;
  ctx.lineWidth = lunge ? 4 : 2.5;
  ctx.beginPath();
  ctx.ellipse(point.x, point.y + 8 * point.scale, radius, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const angle = Math.atan2(player.y - point.y, player.x - point.x);
  const bite = 24 + intensity * 22;
  ctx.fillStyle = lunge ? `rgba(255, 207, 92, ${0.36 + pulse * 0.28})` : `rgba(255, 77, 202, ${0.22 + pulse * 0.16})`;
  ctx.beginPath();
  ctx.moveTo(point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius * 0.36);
  ctx.lineTo(point.x + Math.cos(angle + 0.34) * (radius + bite), point.y + Math.sin(angle + 0.34) * (radius * 0.36 + bite * 0.25));
  ctx.lineTo(point.x + Math.cos(angle - 0.34) * (radius + bite), point.y + Math.sin(angle - 0.34) * (radius * 0.36 + bite * 0.25));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawThreatEdgeArrows(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  if (state.status !== 'playing' || state.graceRemaining > 0) return;

  const margin = 28;
  const left = view.x + margin;
  const right = view.x + view.width - margin;
  const top = view.y + margin;
  const bottom = view.y + view.height - margin;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  state.enemies
    .filter((enemy) => enemy.status === 'chasing')
    .forEach((enemy) => {
      const point = worldToScreen(view, enemy);
      const inside = point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
      const d = distance(state.player, enemy);
      if (inside) return;

      const x = clamp(point.x, left, right);
      const y = clamp(point.y, top, bottom);
      const from = worldToScreen(view, state.player);
      const angle = Math.atan2(point.y - from.y, point.x - from.x);
      const intensity = clamp(1 - d / (THREAT_WARNING_DISTANCE * 1.35), 0.2, 1);
      const pulse = 0.5 + Math.sin(state.elapsed * 9 + enemy.id) * 0.5;
      const size = 13 + intensity * 14 + pulse * intensity * 4;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = d < THREAT_DANGER_DISTANCE
        ? `rgba(255, 207, 92, ${0.62 + pulse * 0.28})`
        : `rgba(255, 77, 202, ${0.52 + intensity * 0.28})`;
      ctx.strokeStyle = enemy.judge.color;
      ctx.shadowColor = enemy.judge.color;
      ctx.shadowBlur = 18 + intensity * 18;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.62, -size * 0.58);
      ctx.lineTo(-size * 0.32, 0);
      ctx.lineTo(-size * 0.62, size * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (!inside) {
        ctx.fillStyle = enemy.judge.color;
        ctx.font = '900 11px ui-sans-serif, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(enemy.judge.signal, x, y + 25);
      }
    });
  ctx.restore();
}

function drawThreatVignette(ctx: CanvasRenderingContext2D, state: GameState): void {
  const nearest = nearestChasingEnemy(state);
  if (!nearest || state.status !== 'playing' || state.graceRemaining > 0) return;

  const d = distance(state.player, nearest);
  const intensity = clamp(1 - d / THREAT_WARNING_DISTANCE, 0, 1);
  if (intensity <= 0) return;

  const pulse = 0.5 + Math.sin(state.elapsed * (7 + intensity * 8)) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.14 + intensity * 0.28 + pulse * intensity * 0.12;
  ctx.strokeStyle = d < THREAT_DANGER_DISTANCE ? '#ffcf5c' : nearest.judge.color;
  ctx.lineWidth = 10 + intensity * 18;
  ctx.shadowColor = nearest.judge.color;
  ctx.shadowBlur = 28 + intensity * 26;
  ctx.strokeRect(8, 8, CANVAS.width - 16, CANVAS.height - 16);
  ctx.restore();
}

function drawMapArena(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  const { width, height } = CANVAS;
  const arena = state.variant.arena;
  ctx.save();

  const backdrop = ctx.createLinearGradient(0, 0, width, height);
  backdrop.addColorStop(0, '#081022');
  backdrop.addColorStop(0.5, '#03040a');
  backdrop.addColorStop(1, '#15081f');
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);

  ctx.shadowColor = '#7df9ff';
  ctx.shadowBlur = 22;
  ctx.fillStyle = 'rgba(7, 17, 31, 0.96)';
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(view.x, view.y, view.width, view.height, 14);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  clipToWorldView(ctx, view);

  const floor = ctx.createLinearGradient(view.x, view.y, view.x + view.width, view.y + view.height);
  floor.addColorStop(0, '#101a36');
  floor.addColorStop(0.52, '#071523');
  floor.addColorStop(1, '#28113b');
  ctx.fillStyle = floor;
  ctx.fillRect(view.x, view.y, view.width, view.height);

  ctx.lineWidth = 1;
  const gridSize = 96;
  const startX = Math.max(0, Math.floor(view.cameraX / gridSize) * gridSize);
  const endX = Math.min(arena.width, view.cameraX + view.width / view.scale + gridSize);
  const startY = Math.max(0, Math.floor(view.cameraY / gridSize) * gridSize);
  const endY = Math.min(arena.height, view.cameraY + view.height / view.scale + gridSize);

  for (let x = startX; x <= endX; x += gridSize) {
    const major = x % 384 === 0;
    ctx.strokeStyle = major ? 'rgba(125, 249, 255, 0.32)' : 'rgba(125, 249, 255, 0.13)';
    ctx.lineWidth = major ? 1.6 : 1;
    strokeProjectedLine(ctx, view, { x, y: startY }, { x, y: endY }, 22);
  }
  for (let y = startY; y <= endY; y += gridSize) {
    const major = y % 384 === 0;
    const depth = worldToScreen(view, { x: view.cameraX, y }).depth;
    ctx.strokeStyle = major ? `rgba(255, 77, 202, ${0.18 + depth * 0.2})` : `rgba(255, 77, 202, ${0.08 + depth * 0.1})`;
    ctx.lineWidth = major ? 1.6 : 1;
    strokeProjectedLine(ctx, view, { x: startX, y }, { x: endX, y }, 22);
  }

  const center = worldToScreen(view, { x: arena.width / 2, y: arena.height / 2 });
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 207, 92, 0.42)';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, i * 104 * view.scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  const pulse = 0.5 + Math.sin(state.elapsed * 3) * 0.5;
  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 460 * view.scale);
  glow.addColorStop(0, `rgba(125, 249, 255, ${0.16 + pulse * 0.05})`);
  glow.addColorStop(0.45, 'rgba(255, 77, 202, 0.06)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(view.x, view.y, view.width, view.height);
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = 'rgba(255, 207, 92, 0.4)';
  ctx.shadowColor = '#ffcf5c';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 4;
  strokeProjectedLine(ctx, view, { x: 0, y: 0 }, { x: arena.width, y: 0 }, 28);
  strokeProjectedLine(ctx, view, { x: arena.width, y: 0 }, { x: arena.width, y: arena.height }, 28);
  strokeProjectedLine(ctx, view, { x: arena.width, y: arena.height }, { x: 0, y: arena.height }, 28);
  strokeProjectedLine(ctx, view, { x: 0, y: arena.height }, { x: 0, y: 0 }, 28);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(247, 242, 220, 0.28)';
  ctx.lineWidth = 6;
  ctx.strokeRect(view.x + 3, view.y + 3, view.width - 6, view.height - 6);

  const edgeGlow = ctx.createLinearGradient(view.x, view.y, view.x + view.width, view.y + view.height);
  edgeGlow.addColorStop(0, 'rgba(125, 249, 255, 0.12)');
  edgeGlow.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  edgeGlow.addColorStop(1, 'rgba(255, 77, 202, 0.1)');
  ctx.fillStyle = edgeGlow;
  ctx.fillRect(view.x, view.y, view.width, view.height);

  ctx.restore();
  ctx.restore();
}

function drawMapTargeting(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  const target = nearestChasingEnemy(state);
  if (!target || state.status !== 'playing') return;

  const player = worldToScreen(view, state.player);
  const targetPoint = worldToScreen(view, target);
  const ready = state.player.blastCooldown <= 0;
  const pulse = 0.5 + Math.sin(state.elapsed * 8) * 0.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = ready ? `rgba(125, 249, 255, ${0.36 + pulse * 0.26})` : 'rgba(185, 195, 223, 0.24)';
  ctx.lineWidth = ready ? 3 : 2;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(targetPoint.x, targetPoint.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = target.judge.color;
  ctx.shadowColor = target.judge.color;
  ctx.shadowBlur = ready ? 18 : 8;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(
    targetPoint.x,
    targetPoint.y,
    Math.max(17, target.radius * view.scale * 2.4 * targetPoint.scale),
    Math.max(8, target.radius * view.scale * 1.1 * targetPoint.scale),
    0,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function drawMapPortal(ctx: CanvasRenderingContext2D, portal: GamePortal, state: GameState, view: WorldView): void {
  const point = worldToScreen(view, portal);
  const pulse = 0.5 + Math.sin(state.elapsed * 4.8 + (portal.kind === 'return' ? 1.5 : 0)) * 0.5;
  const radius = portal.radius * view.scale * point.scale;
  const inner = radius * (0.58 + pulse * 0.08);
  const outer = radius * (1.18 + pulse * 0.18);
  ctx.save();
  drawGroundShadow(ctx, point, portal.radius * 0.95, portal.radius * 0.18, 0.34);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(247, 242, 220, ${0.3 + pulse * 0.22})`;
  ctx.fillStyle = portal.kind === 'return' ? 'rgba(255, 207, 92, 0.1)' : 'rgba(255, 77, 202, 0.1)';
  ctx.shadowColor = portal.color;
  ctx.shadowBlur = 24 + pulse * 18;
  ctx.lineWidth = Math.max(2, 4 * point.scale);
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, outer, outer * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = portal.secondaryColor;
  ctx.lineWidth = Math.max(2, 3 * point.scale);
  ctx.beginPath();
  ctx.ellipse(point.x, point.y - 6 * point.scale, inner, inner * 0.38, 0, Math.PI * 2 * pulse, Math.PI * 2 * (pulse + 0.72));
  ctx.stroke();

  ctx.fillStyle = portal.color;
  ctx.font = `950 ${Math.max(11, 13 * point.scale)}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(portal.kind === 'return' ? 'BACK' : 'VIBE', point.x, point.y - 7 * point.scale);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(3, 4, 10, 0.78)';
  ctx.strokeStyle = portal.color;
  ctx.shadowBlur = 14;
  const labelWidth = portal.kind === 'return' ? 104 : 126;
  const labelHeight = 24;
  const labelY = point.y - outer * 0.82 - labelHeight;
  ctx.beginPath();
  ctx.roundRect(point.x - labelWidth / 2, labelY, labelWidth, labelHeight, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7f2dc';
  ctx.font = '900 11px ui-sans-serif, system-ui';
  ctx.fillText(portal.label.toUpperCase(), point.x, labelY + labelHeight / 2 + 1);
  ctx.restore();
}

function drawMapShard(ctx: CanvasRenderingContext2D, shard: Shard, state: GameState, view: WorldView): void {
  const point = worldToScreen(view, shard);
  const image = getLoadedSprite(VFX_SHEET_SRC);
  const pulse = 1 + Math.sin(state.elapsed * 5 + shard.id) * 0.08;
  const size = 38 * point.scale * pulse;
  const magnetPreviewRadius = state.player.magnetRadius + 96;
  const magnetDistance = distance(state.player, shard);
  const magnetStrength = state.status === 'playing'
    ? clamp(1 - Math.max(0, magnetDistance - state.player.magnetRadius) / (magnetPreviewRadius - state.player.magnetRadius), 0, 1)
    : 0;
  ctx.save();
  drawGroundShadow(ctx, point, 15, 5, 0.22);

  if (magnetStrength > 0) {
    const player = worldToScreen(view, state.player);
    const shimmer = 0.5 + Math.sin(state.elapsed * 13 + shard.id) * 0.5;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(125, 249, 255, ${0.1 + magnetStrength * (0.38 + shimmer * 0.12)})`;
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 10 + magnetStrength * 16;
    ctx.lineWidth = Math.max(1, 1.5 + magnetStrength * 2.5);
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - 8 * point.scale);
    ctx.lineTo(player.x, player.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255, 207, 92, ${0.2 + magnetStrength * 0.46})`;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, (18 + magnetStrength * 18) * point.scale, (8 + magnetStrength * 9) * point.scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalCompositeOperation = 'lighter';
  if (image) {
    drawVfxCell(ctx, image, shard.id % 4, 0, point.x, point.y - 10 * point.scale, size, size);
  } else {
    ctx.translate(point.x, point.y - 10 * point.scale);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#7df9ff';
    ctx.fillRect(-size * 0.22, -size * 0.22, size * 0.44, size * 0.44);
  }
  ctx.restore();
}

function drawPickupTrails(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  if (state.pickupTrails.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const trail of state.pickupTrails) {
    const progress = clamp(trail.age / trail.ttl, 0, 1);
    const alpha = 1 - progress;
    const from = worldToScreen(view, trail.from);
    const to = worldToScreen(view, trail.to);
    const headT = clamp(progress * 1.24, 0, 1);
    const tailT = clamp(headT - 0.42, 0, 1);
    const tailX = from.x + (to.x - from.x) * tailT;
    const tailY = from.y + (to.y - from.y) * tailT - 8 * from.scale;
    const headX = from.x + (to.x - from.x) * headT;
    const headY = from.y + (to.y - from.y) * headT - 8 * to.scale;
    const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY);
    gradient.addColorStop(0, `rgba(125, 249, 255, 0)`);
    gradient.addColorStop(0.5, `rgba(125, 249, 255, ${alpha * 0.62})`);
    gradient.addColorStop(1, `rgba(255, 207, 92, ${alpha * 0.9})`);
    ctx.strokeStyle = gradient;
    ctx.shadowColor = trail.combo >= 4 ? '#ffcf5c' : '#7df9ff';
    ctx.shadowBlur = 16 + Math.min(trail.combo, 6) * 3;
    ctx.lineWidth = Math.max(2, 4 * to.scale + Math.min(trail.combo, 6) * 0.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    ctx.fillStyle = `rgba(247, 242, 220, ${alpha})`;
    ctx.beginPath();
    ctx.arc(headX, headY, Math.max(3, 7 * to.scale), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPickupParticles(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  if (state.pickupParticles.length === 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const particle of state.pickupParticles) {
    const progress = clamp(particle.age / particle.ttl, 0, 1);
    const alpha = 1 - progress;
    const point = worldToScreen(view, particle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 12 * alpha;
    ctx.beginPath();
    ctx.arc(point.x, point.y - 6 * point.scale, Math.max(1.5, particle.radius * point.scale * (1 - progress * 0.25)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawScorePopups(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  if (state.scorePopups.length === 0) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const popup of state.scorePopups) {
    const progress = clamp(popup.age / popup.ttl, 0, 1);
    const alpha = progress > 0.72 ? clamp((1 - progress) / 0.28, 0, 1) : 1;
    const point = worldToScreen(view, popup);
    const y = point.y - 42 * progress - 28 * point.scale;
    const fontSize = Math.max(14, 19 * point.scale + Math.min(popup.combo, 8));
    ctx.globalAlpha = alpha;
    ctx.shadowColor = popup.combo >= 4 ? '#ffcf5c' : '#7df9ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = popup.combo >= 4 ? '#ffcf5c' : '#f7f2dc';
    ctx.font = `950 ${fontSize}px ui-sans-serif, system-ui`;
    ctx.fillText(`+${popup.value}`, point.x, y);
    if (popup.combo >= 2) {
      ctx.fillStyle = '#7df9ff';
      ctx.font = `900 ${Math.max(11, fontSize * 0.58)}px ui-sans-serif, system-ui`;
      ctx.fillText(`COMBO x${popup.combo}`, point.x, y + fontSize * 0.75);
    }
  }
  ctx.restore();
}

function drawComboBadge(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  if (state.pickupCombo.count < 2 || state.pickupCombo.timer <= 0) return;

  const point = worldToScreen(view, state.player);
  const pulse = 1 + state.pickupCombo.pulse * 0.18;
  const alpha = clamp(state.pickupCombo.timer / 0.32, 0, 1);
  const width = 104 * pulse;
  const height = 32 * pulse;
  const x = point.x - width / 2;
  const y = point.y - 82 * point.scale - height / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = '#ffcf5c';
  ctx.shadowBlur = 24;
  ctx.fillStyle = 'rgba(3, 4, 10, 0.78)';
  ctx.strokeStyle = '#ffcf5c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffcf5c';
  ctx.font = `950 ${15 * pulse}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`COMBO x${state.pickupCombo.count}`, point.x, y + height / 2);
  ctx.restore();
}

function drawMapBlast(ctx: CanvasRenderingContext2D, blast: ShardBlast, state: GameState, view: WorldView): void {
  const point = worldToScreen(view, blast);
  const previous = worldToScreen(view, { x: blast.x - blast.vx * 0.07, y: blast.y - blast.vy * 0.07 });
  const image = getLoadedSprite(VFX_SHEET_SRC);
  const angle = Math.atan2(blast.vy, blast.vx);
  const size = 42 * point.scale;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 207, 92, 0.76)';
  ctx.shadowColor = '#ffcf5c';
  ctx.shadowBlur = 18;
  ctx.lineWidth = Math.max(3, 5 * point.scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(previous.x, previous.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  if (image) {
    drawVfxCell(ctx, image, blast.id % 4, 1, point.x, point.y - 4 * point.scale, size * 1.35, size * 0.72, angle);
  } else {
    ctx.fillStyle = '#f7f2dc';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 7 * point.scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMapNameplate(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, width: number): void {
  const ratio = healthRatio(enemy);
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 10, 0.86)';
  ctx.strokeStyle = enemy.judge.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y, width, 31, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enemy.judge.color;
  ctx.font = '900 12px ui-sans-serif, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(enemy.judge.handle, x, y + 13);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(x - width / 2 + 9, y + 20, width - 18, 5);
  ctx.fillStyle = ratio > 0.35 ? '#9cff8f' : '#ff4dca';
  ctx.fillRect(x - width / 2 + 9, y + 20, (width - 18) * ratio, 5);
  ctx.restore();
}

function drawMapJudgeFallback(ctx: CanvasRenderingContext2D, enemy: Enemy, state: GameState, view: WorldView, isTarget: boolean): void {
  const point = worldToScreen(view, enemy);
  const scale = point.scale * (isTarget ? 1.12 : 1);
  const height = Math.max(72, enemy.radius * view.scale * 5.7 * scale);
  const width = height * 0.45;
  const bottomY = point.y + 10 * scale;
  const bob = Math.sin(state.elapsed * 7 + enemy.id) * 3 * scale;
  ctx.save();
  ctx.globalAlpha = enemy.status === 'chasing' ? 1 : 0.52;
  drawGroundShadow(ctx, point, width * 0.56, height * 0.07, isTarget ? 0.44 : 0.34);
  ctx.shadowColor = enemy.judge.color;
  ctx.shadowBlur = isTarget ? 34 : 19;
  ctx.fillStyle = enemy.judge.color;
  ctx.beginPath();
  ctx.roundRect(point.x - width / 2, bottomY - height * 0.74 + bob, width, height * 0.62, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(5, 7, 17, 0.92)';
  ctx.strokeStyle = enemy.judge.secondaryColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(point.x - width * 0.36, bottomY - height * 0.62 + bob, width * 0.72, height * 0.34, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#03040a';
  ctx.strokeStyle = enemy.judge.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(point.x, bottomY - height * 0.86 + bob, width * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enemy.judge.color;
  ctx.font = `900 ${Math.max(11, width * 0.23)}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(enemy.judge.signal, point.x, bottomY - height * 0.86 + bob);
  ctx.restore();
  drawMapNameplate(ctx, enemy, point.x, bottomY - height - 32, Math.max(112, width * 2.6));
}

function drawMapJudgeSprite(ctx: CanvasRenderingContext2D, enemy: Enemy, image: HTMLImageElement, view: WorldView, isTarget: boolean): void {
  const point = worldToScreen(view, enemy);
  const h = (isTarget ? 128 : 112) * point.scale;
  const w = h * (image.naturalWidth / image.naturalHeight);
  const bottomY = point.y + 24 * point.scale;
  ctx.save();
  ctx.globalAlpha = enemy.status === 'chasing' ? 1 : 0.54;
  drawGroundShadow(ctx, point, w * 0.28 / point.scale, h * 0.06 / point.scale, 0.42);
  ctx.shadowColor = enemy.judge.color;
  ctx.shadowBlur = isTarget ? 42 : 24;
  ctx.drawImage(image, point.x - w / 2, bottomY - h, w, h);
  ctx.restore();
  drawMapNameplate(ctx, enemy, point.x, bottomY - h - 33, Math.min(178, Math.max(128, w * 0.86)));
}

function drawMapJudge(ctx: CanvasRenderingContext2D, enemy: Enemy, state: GameState, view: WorldView, targetId?: number): void {
  const isTarget = targetId === enemy.id;
  const sprite = selectJudgeSprite(enemy.judge, judgeAnimation(enemy));
  const image = sprite ? getLoadedSprite(sprite) : undefined;
  drawJudgeThreatAura(ctx, enemy, state, view, isTarget);
  if (image) drawMapJudgeSprite(ctx, enemy, image, view, isTarget);
  else drawMapJudgeFallback(ctx, enemy, state, view, isTarget);
}

function drawMapPlayer(ctx: CanvasRenderingContext2D, state: GameState, view: WorldView): void {
  const point = worldToScreen(view, state.player);
  const image = getLoadedSprite(PLAYER_SPRITE_SRC);
  const vfx = getLoadedSprite(VFX_SHEET_SRC);
  const heading = state.player.heading;
  const radius = Math.max(16, state.player.radius * view.scale * 2.2 * point.scale);
  ctx.save();

  if (state.status === 'playing') {
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.24)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(
      point.x,
      point.y,
      state.player.magnetRadius * view.scale * point.scale,
      state.player.magnetRadius * view.scale * point.scale * 0.48,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  if (state.graceRemaining > 0 && state.status === 'playing') {
    const shieldAlpha = Math.min(0.92, state.graceRemaining / 4);
    ctx.globalAlpha = shieldAlpha;
    if (vfx) {
      drawVfxCell(ctx, vfx, 3, 3, point.x, point.y + 5 * point.scale, 128 * point.scale, 82 * point.scale);
    } else {
      ctx.strokeStyle = 'rgba(156, 255, 143, 0.88)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius * 2.1, radius * 0.95, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const aimLength = 58 * point.scale;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = state.player.blastCooldown <= 0 ? '#ffcf5c' : 'rgba(185, 195, 223, 0.7)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.lineTo(point.x + Math.cos(heading) * aimLength, point.y + Math.sin(heading) * aimLength);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';

  drawGroundShadow(ctx, point, 34, 9, 0.46);

  if (image) {
    const h = 118 * point.scale;
    const w = h * (image.naturalWidth / image.naturalHeight);
    const flip = Math.cos(heading) < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(point.x, point.y + 27 * point.scale);
    ctx.scale(flip, 1);
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 24;
    ctx.drawImage(image, -w / 2, -h + 8, w, h);
    ctx.restore();
  } else {
    const bodyHeight = radius * 2.9;
    const bodyWidth = radius * 1.15;
    const bottomY = point.y + 22 * point.scale;
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#f7f2dc';
    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(point.x - bodyWidth / 2, bottomY - bodyHeight * 0.72, bodyWidth, bodyHeight * 0.58, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#03040a';
    ctx.beginPath();
    ctx.arc(point.x, bottomY - bodyHeight * 0.83, bodyWidth * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#f7f2dc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radius * 0.86, radius * 0.36, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawShard(ctx: CanvasRenderingContext2D, item: Projected, state: GameState): void {
  const shard = item.entity as Shard;
  const image = getLoadedSprite(VFX_SHEET_SRC);
  const pulse = 1 + Math.sin(state.elapsed * 5 + shard.id) * 0.08;
  const size = Math.min(104, Math.max(30, 70 * item.scale * pulse));
  ctx.save();
  ctx.globalAlpha = Math.max(0.55, Math.min(1, item.scale * 1.4));
  if (image) {
    drawVfxCell(ctx, image, shard.id % 3, 0, item.x, item.y - size * 0.55, size, size);
  } else {
    ctx.translate(item.x, item.y - size * 0.4);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 24 * item.scale;
    ctx.fillStyle = '#7df9ff';
    ctx.fillRect(-size * 0.28, -size * 0.28, size * 0.56, size * 0.56);
  }
  ctx.restore();
}

function drawBlast(ctx: CanvasRenderingContext2D, item: Projected, state: GameState): void {
  const blast = item.entity as ShardBlast;
  const previous = { x: blast.x - blast.vx * 0.055, y: blast.y - blast.vy * 0.055 };
  const previousProjected = projectWorldPoint(state, previous);
  const image = getLoadedSprite(VFX_SHEET_SRC);
  const size = Math.min(86, Math.max(26, 48 * item.scale));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (previousProjected) {
    ctx.strokeStyle = 'rgba(255, 207, 92, 0.72)';
    ctx.shadowColor = '#ffcf5c';
    ctx.shadowBlur = 18;
    ctx.lineWidth = Math.max(3, 7 * item.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(previousProjected.x, previousProjected.y - size * 0.2);
    ctx.lineTo(item.x, item.y - size * 0.2);
    ctx.stroke();
  }
  if (image) {
    drawVfxCell(ctx, image, blast.id % 4, 1, item.x, item.y - size * 0.3, size * 1.35, size);
  } else {
    ctx.fillStyle = '#f7f2dc';
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 28 * item.scale;
    ctx.beginPath();
    ctx.arc(item.x, item.y - size * 0.2, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function judgeAnimation(enemy: Enemy): CharacterAnimation {
  if (enemy.status === 'defeated') return 'defeated';
  if (enemy.status === 'respawning') return 'respawn';
  if (enemy.health < enemy.maxHealth * 0.45) return 'hurt';
  return 'chase';
}

function drawJudgeNameplate(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number, width: number): void {
  const ratio = healthRatio(enemy);
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 10, 0.84)';
  ctx.strokeStyle = enemy.judge.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y, width, 34, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enemy.judge.color;
  ctx.font = '900 13px ui-sans-serif, system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(enemy.judge.handle, x, y + 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(x - width / 2 + 10, y + 22, width - 20, 5);
  ctx.fillStyle = ratio > 0.35 ? '#9cff8f' : '#ff4dca';
  ctx.fillRect(x - width / 2 + 10, y + 22, (width - 20) * ratio, 5);
  ctx.restore();
}

function drawJudgeFallback(ctx: CanvasRenderingContext2D, item: Projected, state: GameState, isTarget: boolean): void {
  const enemy = item.entity as Enemy;
  const scale = item.scale * (isTarget ? 1.18 : 1);
  const height = Math.min(270, Math.max(82, 150 * scale));
  const width = height * 0.58;
  const bottomY = item.y + 8 * scale;
  ctx.save();
  ctx.globalAlpha = enemy.status === 'chasing' ? 1 : 0.55;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(item.x, bottomY + 6, width * 0.65, height * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = enemy.judge.color;
  ctx.shadowBlur = isTarget ? 38 : 22;
  ctx.fillStyle = enemy.judge.color;
  ctx.beginPath();
  ctx.moveTo(item.x, bottomY - height);
  ctx.lineTo(item.x + width, bottomY);
  ctx.lineTo(item.x - width, bottomY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(5, 7, 17, 0.94)';
  ctx.strokeStyle = enemy.judge.secondaryColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(item.x - width * 0.42, bottomY - height * 0.78, width * 0.84, height * 0.68, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#03040a';
  ctx.strokeStyle = enemy.judge.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(item.x, bottomY - height * 0.88, width * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = enemy.judge.color;
  ctx.font = `900 ${Math.max(14, width * 0.2)}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(enemy.judge.signal, item.x, bottomY - height * 0.88);
  ctx.fillStyle = enemy.judge.secondaryColor;
  ctx.font = `900 ${Math.max(10, width * 0.12)}px ui-sans-serif, system-ui`;
  ctx.fillText(enemy.judge.bossTitle.toUpperCase(), item.x, bottomY - height * 0.35);
  ctx.restore();
  drawJudgeNameplate(ctx, enemy, item.x, bottomY - height - 38, Math.min(176, Math.max(116, width * 1.7)));
}

function drawJudgeSprite(ctx: CanvasRenderingContext2D, item: Projected, image: HTMLImageElement, isTarget: boolean): void {
  const enemy = item.entity as Enemy;
  const scale = item.scale * (isTarget ? 1.15 : 1);
  const h = Math.min(isTarget ? 390 : 330, Math.max(120, 250 * scale));
  const w = h * (image.naturalWidth / image.naturalHeight);
  const bottomY = item.y + 10 * scale;
  ctx.save();
  ctx.globalAlpha = enemy.status === 'chasing' ? 1 : 0.56;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(item.x, bottomY + 5, w * 0.24, h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = enemy.judge.color;
  ctx.shadowBlur = isTarget ? 42 : 26;
  ctx.drawImage(image, item.x - w / 2, bottomY - h, w, h);
  ctx.restore();
  drawJudgeNameplate(ctx, enemy, item.x, bottomY - h - 34, Math.min(210, Math.max(136, w * 0.66)));
}

function drawJudge(ctx: CanvasRenderingContext2D, item: Projected, state: GameState, targetId?: number): void {
  const enemy = item.entity as Enemy;
  const isTarget = targetId === enemy.id;
  const sprite = selectJudgeSprite(enemy.judge, judgeAnimation(enemy));
  const image = sprite ? getLoadedSprite(sprite) : undefined;
  if (image) drawJudgeSprite(ctx, item, image, isTarget);
  else drawJudgeFallback(ctx, item, state, isTarget);
}

function drawTargeting(ctx: CanvasRenderingContext2D, state: GameState): void {
  const target = nearestChasingEnemy(state);
  if (!target || state.status !== 'playing') return;
  const projected = projectWorldPoint(state, target);
  const muzzle = { x: CANVAS.width / 2 + 76, y: CANVAS.height - 210 };
  ctx.save();
  if (projected) {
    const pulse = 0.5 + Math.sin(state.elapsed * 8) * 0.5;
    ctx.strokeStyle = state.player.blastCooldown <= 0 ? `rgba(125, 249, 255, ${0.4 + pulse * 0.25})` : 'rgba(185, 195, 223, 0.22)';
    ctx.lineWidth = state.player.blastCooldown <= 0 ? 3 : 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(muzzle.x, muzzle.y);
    ctx.lineTo(projected.x, projected.y - 86 * projected.scale);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = target.judge.color;
    ctx.shadowColor = target.judge.color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y - 82 * projected.scale, Math.min(74, Math.max(28, 42 * projected.scale)), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const side = target.x < state.player.x ? 36 : CANVAS.width - 36;
    ctx.fillStyle = target.judge.color;
    ctx.beginPath();
    ctx.moveTo(side, CANVAS.height / 2);
    ctx.lineTo(side < CANVAS.width / 2 ? side + 22 : side - 22, CANVAS.height / 2 - 14);
    ctx.lineTo(side < CANVAS.width / 2 ? side + 22 : side - 22, CANVAS.height / 2 + 14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = state.player.blastCooldown <= 0 ? '#f7f2dc' : 'rgba(185, 195, 223, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CANVAS.width / 2, CANVAS.height * 0.44, 18, 0, Math.PI * 2);
  ctx.moveTo(CANVAS.width / 2 - 34, CANVAS.height * 0.44);
  ctx.lineTo(CANVAS.width / 2 - 10, CANVAS.height * 0.44);
  ctx.moveTo(CANVAS.width / 2 + 10, CANVAS.height * 0.44);
  ctx.lineTo(CANVAS.width / 2 + 34, CANVAS.height * 0.44);
  ctx.stroke();
  ctx.restore();
}

function drawPlayerShoulder(ctx: CanvasRenderingContext2D, state: GameState): void {
  const image = getLoadedSprite(PLAYER_SPRITE_SRC);
  const vfx = getLoadedSprite(VFX_SHEET_SRC);
  ctx.save();
  if (state.graceRemaining > 0 && state.status === 'playing') {
    const alpha = Math.min(0.9, state.graceRemaining / 4);
    ctx.globalAlpha = alpha;
    if (vfx) {
      drawVfxCell(ctx, vfx, 3, 3, CANVAS.width / 2 - 8, CANVAS.height - 142, 250, 150);
    } else {
      ctx.strokeStyle = 'rgba(156, 255, 143, 0.88)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(CANVAS.width / 2, CANVAS.height - 120, 78, Math.PI, 0);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (image) {
    const h = 430;
    const w = h * (image.naturalWidth / image.naturalHeight);
    const x = CANVAS.width * 0.38 - w * 0.5;
    const y = CANVAS.height - h + 58;
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 24;
    ctx.drawImage(image, x, y, w, h);
  } else {
    ctx.shadowColor = '#7df9ff';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#f7f2dc';
    ctx.strokeStyle = '#7df9ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(CANVAS.width / 2 - 40, CANVAS.height - 190, 80, 132, 18);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState): void {
  const size = 118;
  const x = CANVAS.width - size - 18;
  const y = 18;
  const sx = size / state.variant.arena.width;
  const sy = size / state.variant.arena.height;
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 10, 0.76)';
  ctx.strokeStyle = 'rgba(125,249,255,.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(125,249,255,.08)';
  ctx.fillRect(x + size * 0.25, y + size * 0.25, size * 0.5, size * 0.5);

  for (const shard of state.shards) {
    ctx.fillStyle = '#7df9ff';
    ctx.fillRect(x + shard.x * sx - 2, y + shard.y * sy - 2, 4, 4);
  }
  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.status === 'chasing' ? enemy.judge.color : 'rgba(185,195,223,.45)';
    ctx.beginPath();
    ctx.arc(x + enemy.x * sx, y + enemy.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const portal of state.portals) {
    ctx.strokeStyle = portal.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + portal.x * sx, y + portal.y * sy, portal.kind === 'return' ? 5 : 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.translate(x + state.player.x * sx, y + state.player.y * sy);
  ctx.rotate(state.player.heading);
  ctx.fillStyle = '#f7f2dc';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRunHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const x = 18;
  const y = 18;
  const w = 226;
  const h = 70;
  const clockLabel = state.status === 'ready' ? 'START' : state.graceRemaining > 0 ? 'SAFE' : 'CLOCK';
  const clockValue = state.status === 'ready'
    ? 'READY'
    : String(Math.max(0, Math.ceil(state.graceRemaining > 0 ? state.graceRemaining : state.waveTimeRemaining)));
  const comboValue = state.pickupCombo.count >= 2 ? `x${state.pickupCombo.count}` : state.pickupCombo.best > 0 ? `B${state.pickupCombo.best}` : '-';
  const blastValue = state.player.blastCooldown <= 0 ? 'RDY' : `${Math.ceil(state.player.blastCooldown * 10) / 10}`;

  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 10, 0.72)';
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#7df9ff';
  ctx.font = '900 11px ui-sans-serif, system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('LOOPFORGE', x + 14, y + 18);

  const stats = [
    ['SCORE', String(state.score)],
    ['WAVE', String(state.wave)],
    [clockLabel, clockValue],
    ['BLAST', blastValue],
    ['COMBO', comboValue],
  ];
  stats.forEach(([label, value], index) => {
    const colX = x + 14 + index * 41;
    ctx.fillStyle = '#92a0bf';
    ctx.font = '800 8px ui-sans-serif, system-ui';
    ctx.fillText(label, colX, y + 39);
    ctx.fillStyle = label === 'COMBO' && comboValue !== '-' ? '#ffcf5c' : '#f7f2dc';
    ctx.font = '950 15px ui-sans-serif, system-ui';
    ctx.fillText(value, colX, y + 57);
  });
  ctx.restore();
}

function drawThreatPanel(ctx: CanvasRenderingContext2D, state: GameState): void {
  const nearest = nearestChasingEnemy(state);
  if (!nearest || state.status !== 'playing') return;
  const d = Math.round(distance(state.player, nearest));
  const danger = d < 150;
  ctx.save();
  ctx.fillStyle = danger ? 'rgba(255, 77, 202, 0.9)' : 'rgba(3, 4, 10, 0.72)';
  ctx.strokeStyle = nearest.judge.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(18, 92, 318, 72, 8);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f7f2dc';
  ctx.font = '900 15px ui-sans-serif, system-ui';
  ctx.fillText(`${nearest.judge.handle} closing in`, 36, 118);
  ctx.fillStyle = danger ? '#03040a' : '#b9c3df';
  ctx.font = '13px ui-sans-serif, system-ui';
  ctx.fillText(`${d}m // ${nearest.judge.bossTitle}`, 36, 142);
  ctx.restore();
}

function drawBossHealthPanel(ctx: CanvasRenderingContext2D, state: GameState): void {
  const target = nearestChasingEnemy(state);
  if (!target || state.status !== 'playing') return;
  const ratio = healthRatio(target);
  const w = 430;
  const h = 58;
  const x = CANVAS.width / 2 - w / 2;
  const y = 18;
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 10, 0.78)';
  ctx.strokeStyle = target.judge.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = target.judge.color;
  ctx.font = '900 15px ui-sans-serif, system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(`${target.judge.handle} // ${target.judge.bossTitle}`, x + 18, y + 24);
  ctx.fillStyle = '#b9c3df';
  ctx.font = '12px ui-sans-serif, system-ui';
  ctx.fillText(learnedLabel(target), x + 18, y + 43);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(x + 188, y + 25, w - 210, 12);
  ctx.fillStyle = ratio > 0.35 ? '#9cff8f' : '#ff4dca';
  ctx.fillRect(x + 188, y + 25, (w - 210) * ratio, 12);
  ctx.restore();
}

function drawNoticeBanner(ctx: CanvasRenderingContext2D, notice: CombatNotice, index: number): void {
  const progress = notice.age / notice.ttl;
  const fadeIn = Math.min(1, progress / 0.12);
  const fadeOut = progress > 0.82 ? Math.max(0, (1 - progress) / 0.18) : 1;
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0) return;

  const isMajor = notice.kind === 'respawn' || notice.kind === 'defeat';
  const w = isMajor ? 500 : 386;
  const h = isMajor ? 68 : 52;
  const x = 24 - (1 - fadeIn) * 18;
  const y = CANVAS.height - 24 - h - index * 78;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = notice.color;
  ctx.shadowBlur = isMajor ? 26 : 14;
  ctx.fillStyle = 'rgba(3, 4, 10, 0.84)';
  ctx.strokeStyle = notice.color;
  ctx.lineWidth = isMajor ? 3 : 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = notice.color;
  ctx.fillRect(x, y, 9, h);
  ctx.fillStyle = '#f7f2dc';
  ctx.font = `900 ${isMajor ? 18 : 15}px ui-sans-serif, system-ui`;
  ctx.textAlign = 'left';
  ctx.fillText(notice.title.toUpperCase(), x + 24, y + (isMajor ? 28 : 21));
  ctx.fillStyle = '#b9c3df';
  ctx.font = `${isMajor ? 13 : 12}px ui-sans-serif, system-ui`;
  ctx.fillText(notice.detail, x + 24, y + (isMajor ? 50 : 38), w - 44);
  ctx.restore();
}

function drawNotices(ctx: CanvasRenderingContext2D, state: GameState): void {
  state.notices
    .filter((notice) => notice.kind !== 'hit' || notice.age < 0.5)
    .slice(0, 2)
    .forEach((notice, index) => drawNoticeBanner(ctx, notice, index));
}

function drawScreenFlash(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (state.hitFlash <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.34, state.hitFlash * 0.22);
  ctx.fillStyle = '#f7f2dc';
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.globalAlpha = Math.min(0.38, state.hitFlash * 0.28);
  ctx.strokeStyle = '#ff4dca';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, CANVAS.width - 18, CANVAS.height - 18);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS.width, CANVAS.height);
  const shake = state.screenShake;
  const target = nearestChasingEnemy(state);
  const view = createWorldView(CANVAS, state.variant.arena, state.player);
  ctx.save();
  if (shake > 0) {
    ctx.translate(
      Math.sin(state.elapsed * 91) * shake,
      Math.cos(state.elapsed * 73) * shake * 0.72,
    );
  }

  drawMapArena(ctx, state, view);
  ctx.save();
  clipToWorldView(ctx, view);
  drawMapTargeting(ctx, state, view);
  drawThreatProximityField(ctx, state, view);
  drawPickupTrails(ctx, state, view);

  const renderables: Array<{ y: number; order: number; draw: () => void }> = [
    {
      y: screenDepth(view, state.player),
      order: 3,
      draw: () => drawMapPlayer(ctx, state, view),
    },
  ];
  state.portals.forEach((portal) => {
    renderables.push({
      y: screenDepth(view, portal),
      order: -1,
      draw: () => drawMapPortal(ctx, portal, state, view),
    });
  });
  state.shards.forEach((shard) => {
    renderables.push({
      y: screenDepth(view, shard),
      order: 0,
      draw: () => drawMapShard(ctx, shard, state, view),
    });
  });
  state.blasts.forEach((blast) => {
    renderables.push({
      y: screenDepth(view, blast),
      order: 1,
      draw: () => drawMapBlast(ctx, blast, state, view),
    });
  });
  state.enemies.forEach((enemy) => {
    renderables.push({
      y: screenDepth(view, enemy),
      order: 2,
      draw: () => drawMapJudge(ctx, enemy, state, view, target?.id),
    });
  });
  renderables
    .sort((a, b) => a.y - b.y || a.order - b.order)
    .forEach((item) => item.draw());
  drawPickupParticles(ctx, state, view);
  drawScorePopups(ctx, state, view);
  drawComboBadge(ctx, state, view);

  ctx.restore();
  drawThreatEdgeArrows(ctx, state, view);
  ctx.restore();

  drawScreenFlash(ctx, state);
  drawThreatVignette(ctx, state);
  drawRunHud(ctx, state);
  drawBossHealthPanel(ctx, state);
  drawThreatPanel(ctx, state);
  drawMinimap(ctx, state);
  drawNotices(ctx, state);
}

export default function App() {
  const initialState = useMemo(() => createInitialState(DEFAULT_VARIANT), []);
  const stateRef = useRef<GameState>(initialState);
  const [snapshot, setSnapshot] = useState<GameState>(() => snapshotState(stateRef.current));
  const upgrades = useMemo(() => chooseUpgradeOptions(snapshot, DEFAULT_VARIANT), [snapshot.status, snapshot.wave]);

  const syncSnapshot = () => {
    setSnapshot(snapshotState(stateRef.current));
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (isNavigationKey(event.key)) event.preventDefault();
      if (event.key === ' ') fireShardBlast(stateRef.current);
      keys.add(event.key.toLowerCase());
    };
    const up = (event: KeyboardEvent) => {
      if (isNavigationKey(event.key)) event.preventDefault();
      keys.delete(event.key.toLowerCase());
    };
    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up, { passive: false });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const state = stateRef.current;
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      tickGame(state, inputVector(), dt);
      setSnapshot(snapshotState(state));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const restart = () => {
    keys.clear();
    stateRef.current = createInitialState(DEFAULT_VARIANT);
    syncSnapshot();
  };

  const beginRun = () => {
    keys.clear();
    startGame(stateRef.current);
    syncSnapshot();
  };

  const handlePointerDown = () => {
    if (stateRef.current.status === 'ready') {
      startGame(stateRef.current);
      syncSnapshot();
      return;
    }
    fireShardBlast(stateRef.current);
    syncSnapshot();
  };

  const handlePointerAim = (cursor: Vec, viewport: { width: number; height: number }) => {
    aimPlayerAtCursor(stateRef.current, cursor, viewport);
  };

  const latestNotice = snapshot.notices[0];

  return (
    <main className="shell">
      <div className="gameWrap">
        <ThreeCanvas state={snapshot} onPointerDown={handlePointerDown} onPointerAim={handlePointerAim} />
        {snapshot.status === 'playing' && <GameHud state={snapshot} />}
        {latestNotice && <div className="srOnly" aria-live="polite">{latestNotice.title}. {latestNotice.detail}</div>}
        {snapshot.status !== 'playing' && (
          <div className={`overlay overlay-${snapshot.status}`}>
            {snapshot.status === 'upgrade' ? (
              <div className="mutationHeader">
                <span>Wave {snapshot.wave} clear</span>
                <h2>Choose Mutation</h2>
                <p>{snapshot.message}</p>
              </div>
            ) : (
              <>
                <h2>{snapshot.status === 'ready' ? 'Enter Arena' : 'Prototype roasted'}</h2>
                <p>{snapshot.message}</p>
              </>
            )}
            {snapshot.status === 'ready' && (
              <div className="bossIntroGrid" aria-label="Vibe Jam judge bosses">
                {JUDGE_CHASERS.map((judge) => (
                  <div key={judge.handle} className="introBoss" style={{ '--judge-color': judge.color, '--judge-alt': judge.secondaryColor } as JudgeVars}>
                    <div className="introBossPortrait" aria-hidden="true">
                      {judge.avatar && <img src={judge.avatar} alt="" />}
                      <strong>{judge.signal}</strong>
                    </div>
                    <span>{judge.handle}</span>
                    <small>{judge.bossTitle}</small>
                  </div>
                ))}
              </div>
            )}
            {snapshot.status === 'ready' ? (
              <button onClick={beginRun}>Enter Arena</button>
            ) : snapshot.status === 'upgrade' ? (
              <div className="upgradeGrid">
                {upgrades.map((upgrade) => (
                  <button key={upgrade.id} style={upgradeStyle(upgrade)} onClick={() => { applyUpgradeAndStartNextWave(stateRef.current, upgrade); syncSnapshot(); }}>
                    <span className="upgradeIcon">{upgrade.icon ?? 'UP'}</span>
                    <small>{upgrade.tag ?? 'mutation'}</small>
                    <strong>{upgrade.title}</strong>
                    <span>{upgrade.description}</span>
                    <em>Next wave: {upgrade.nextWave ?? 'prototype altered'}</em>
                  </button>
                ))}
              </div>
            ) : <button onClick={restart}>Restart Pitch</button>}
          </div>
        )}
      </div>
    </main>
  );
}
