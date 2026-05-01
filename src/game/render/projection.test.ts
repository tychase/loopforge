import { describe, expect, it } from 'vitest';
import { createWorldView } from './camera';
import { worldToScreen } from './projection';

const canvas = { width: 960, height: 600 };
const arena = { width: 1280, height: 1280 };

describe('2.5D render projection', () => {
  it('keeps the player near the center of the camera-follow view', () => {
    const player = { x: 640, y: 640 };
    const view = createWorldView(canvas, arena, player);
    const projected = worldToScreen(view, player);

    expect(projected.x).toBeGreaterThan(430);
    expect(projected.x).toBeLessThan(530);
    expect(projected.y).toBeGreaterThan(270);
    expect(projected.y).toBeLessThan(390);
  });

  it('scales lower-screen entities larger than upper-screen entities', () => {
    const view = createWorldView(canvas, arena, { x: 640, y: 640 });
    const upper = worldToScreen(view, { x: 640, y: 360 });
    const lower = worldToScreen(view, { x: 640, y: 920 });

    expect(lower.y).toBeGreaterThan(upper.y);
    expect(lower.scale).toBeGreaterThan(upper.scale);
  });
});
