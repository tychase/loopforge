import type { Vec2, WorldView } from './camera';

export type ScreenPoint = Vec2 & {
  scale: number;
  depth: number;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function worldToScreen(view: WorldView, point: Vec2): ScreenPoint {
  const rawX = view.x + (point.x - view.cameraX) * view.scale;
  const rawY = view.y + (point.y - view.cameraY) * view.scale;
  const centerX = view.x + view.width / 2;
  const normalizedDepth = (rawY - view.y) / view.height;
  const depth = clamp01(normalizedDepth);
  const compressedDepth = Math.pow(depth, 1.16);
  const floorTop = view.y + view.height * 0.075;
  const floorHeight = view.height * 0.89;
  const lateralScale = 0.78 + depth * 0.28;
  const drift = (depth - 0.5) * view.width * 0.036;

  return {
    x: centerX + (rawX - centerX) * lateralScale + drift,
    y: floorTop + compressedDepth * floorHeight,
    scale: 0.72 + depth * 0.5,
    depth,
  };
}

export function screenDepth(view: WorldView, point: Vec2): number {
  return worldToScreen(view, point).y;
}
