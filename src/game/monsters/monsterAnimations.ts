import {
  MONSTER_ANIMATION_ROWS,
  MONSTER_FRAME_SIZE,
  MONSTER_FRAMES_PER_ANIMATION,
  type MonsterFrameRect,
} from '../assets/monsterAtlas';
import type { MonsterAnimationKey } from './monsterTypes';

export const MONSTER_ANIMATION_KEYS: MonsterAnimationKey[] = ['idle', 'chase', 'attack', 'death'];

export type MonsterAnimationFrame = MonsterFrameRect & {
  animation: MonsterAnimationKey;
  frameIndex: number;
};

export function getMonsterAnimationFrames(animation: MonsterAnimationKey): MonsterAnimationFrame[] {
  const row = MONSTER_ANIMATION_ROWS[animation];
  return Array.from({ length: MONSTER_FRAMES_PER_ANIMATION }, (_, frameIndex) => ({
    animation,
    frameIndex,
    column: frameIndex,
    row,
    x: frameIndex * MONSTER_FRAME_SIZE,
    y: row * MONSTER_FRAME_SIZE,
    width: MONSTER_FRAME_SIZE,
    height: MONSTER_FRAME_SIZE,
  }));
}

export function getMonsterAnimationFrame(animation: MonsterAnimationKey, frameIndex: number): MonsterAnimationFrame {
  const normalizedFrame = ((Math.floor(frameIndex) % MONSTER_FRAMES_PER_ANIMATION) + MONSTER_FRAMES_PER_ANIMATION) % MONSTER_FRAMES_PER_ANIMATION;
  return getMonsterAnimationFrames(animation)[normalizedFrame];
}

export function getMonsterAnimationFrameAtTime(
  animation: MonsterAnimationKey,
  elapsedMs: number,
  framesPerSecond = 8,
): MonsterAnimationFrame {
  const frameDurationMs = 1000 / framesPerSecond;
  return getMonsterAnimationFrame(animation, Math.floor(elapsedMs / frameDurationMs));
}
