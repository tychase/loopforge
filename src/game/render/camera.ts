export type Vec2 = { x: number; y: number };

export type CameraFrame = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type WorldView = {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cameraX: number;
  cameraY: number;
};

export const DEFAULT_MAP_FRAME: CameraFrame = {
  left: 44,
  right: 44,
  top: 42,
  bottom: 34,
};

export const WORLD_CAMERA_SCALE = 0.76;

export function createWorldView(
  canvas: { width: number; height: number },
  arena: { width: number; height: number },
  player: Vec2,
  frame: CameraFrame = DEFAULT_MAP_FRAME,
  minScale = WORLD_CAMERA_SCALE,
): WorldView {
  const availableWidth = canvas.width - frame.left - frame.right;
  const availableHeight = canvas.height - frame.top - frame.bottom;
  const scale = Math.max(
    Math.min(availableWidth / arena.width, availableHeight / arena.height),
    minScale,
  );
  const visibleWorldWidth = availableWidth / scale;
  const visibleWorldHeight = availableHeight / scale;
  const maxCameraX = Math.max(0, arena.width - visibleWorldWidth);
  const maxCameraY = Math.max(0, arena.height - visibleWorldHeight);
  const cameraX = Math.max(0, Math.min(maxCameraX, player.x - visibleWorldWidth / 2));
  const cameraY = Math.max(0, Math.min(maxCameraY, player.y - visibleWorldHeight / 2));

  return {
    scale,
    width: availableWidth,
    height: availableHeight,
    x: frame.left,
    y: frame.top,
    cameraX,
    cameraY,
  };
}
