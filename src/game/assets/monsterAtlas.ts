import { MONSTER_DEFINITIONS, type MonsterAnimationKey, type MonsterDefinition } from '../monsters/monsterTypes';

export const MONSTER_FRAME_SIZE = 128;
export const MONSTER_SHEET_COLUMNS = 4;
export const MONSTER_SHEET_ROWS = 4;
export const MONSTER_SHEET_SIZE = MONSTER_FRAME_SIZE * MONSTER_SHEET_COLUMNS;
export const MONSTER_FRAMES_PER_ANIMATION = 4;

export const MONSTER_ANIMATION_ROWS: Record<MonsterAnimationKey, number> = {
  idle: 0,
  chase: 1,
  attack: 2,
  death: 3,
};

export type MonsterFrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  row: number;
};

export type MonsterPlaceholderFrame = MonsterFrameRect & {
  label: string;
  primaryColor: string;
  secondaryColor: string;
};

export type MonsterSpriteAsset =
  | {
      kind: 'spriteSheet';
      path: string;
      frameSize: number;
      sheetSize: number;
    }
  | {
      kind: 'placeholder';
      path: string;
      reason: 'missing-sprite-sheet';
      frameSize: number;
      sheetSize: number;
      frames: Record<MonsterAnimationKey, MonsterPlaceholderFrame[]>;
    };

export type AssetExists = (spriteSheetPath: string) => boolean;

export function publicAssetPath(spriteSheetPath: string, publicRoot = 'public'): string {
  const normalized = spriteSheetPath.startsWith('/') ? spriteSheetPath.slice(1) : spriteSheetPath;
  return `${publicRoot}/${normalized}`;
}

export function monsterSpriteSheetPath(monsterId: MonsterDefinition['id']): string {
  return `/assets/monsters/${monsterId}.png`;
}

export function createMonsterPlaceholderFrames(
  monster: MonsterDefinition,
): Record<MonsterAnimationKey, MonsterPlaceholderFrame[]> {
  return {
    idle: createPlaceholderAnimationFrames(monster, 'idle'),
    chase: createPlaceholderAnimationFrames(monster, 'chase'),
    attack: createPlaceholderAnimationFrames(monster, 'attack'),
    death: createPlaceholderAnimationFrames(monster, 'death'),
  };
}

export function resolveMonsterSpriteAsset(monster: MonsterDefinition, assetExists?: AssetExists): MonsterSpriteAsset {
  if (!assetExists || assetExists(monster.spriteSheetPath)) {
    return {
      kind: 'spriteSheet',
      path: monster.spriteSheetPath,
      frameSize: MONSTER_FRAME_SIZE,
      sheetSize: MONSTER_SHEET_SIZE,
    };
  }

  return {
    kind: 'placeholder',
    path: monster.spriteSheetPath,
    reason: 'missing-sprite-sheet',
    frameSize: MONSTER_FRAME_SIZE,
    sheetSize: MONSTER_SHEET_SIZE,
    frames: createMonsterPlaceholderFrames(monster),
  };
}

export function resolveMonsterAtlas(assetExists?: AssetExists): Record<MonsterDefinition['id'], MonsterSpriteAsset> {
  return Object.fromEntries(
    MONSTER_DEFINITIONS.map((monster) => [monster.id, resolveMonsterSpriteAsset(monster, assetExists)]),
  ) as Record<MonsterDefinition['id'], MonsterSpriteAsset>;
}

function createPlaceholderAnimationFrames(
  monster: MonsterDefinition,
  animation: MonsterAnimationKey,
): MonsterPlaceholderFrame[] {
  const row = MONSTER_ANIMATION_ROWS[animation];
  return Array.from({ length: MONSTER_FRAMES_PER_ANIMATION }, (_, index) => ({
    x: index * MONSTER_FRAME_SIZE,
    y: row * MONSTER_FRAME_SIZE,
    width: MONSTER_FRAME_SIZE,
    height: MONSTER_FRAME_SIZE,
    column: index,
    row,
    label: `${monster.placeholder.glyph}-${animation}-${index}`,
    primaryColor: monster.placeholder.primaryColor,
    secondaryColor: monster.placeholder.secondaryColor,
  }));
}
