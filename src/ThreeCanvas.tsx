import { useEffect, useRef, type PointerEvent } from 'react';
import * as THREE from 'three';
import { selectJudgeSprite, type CharacterAnimation } from './characters';
import { getPortalSafetyZone } from './game';
import type {
  Enemy,
  GamePortal,
  GameState,
  PickupParticle,
  PickupTrail,
  Shard,
  ShardBlast,
  Vec,
} from './game';

type ThreeCanvasProps = {
  state: GameState;
  onPointerDown: () => void;
  onPointerAim: (cursor: Vec, viewport: { width: number; height: number }) => void;
};

const WORLD_SCALE = 1 / 50;
const SHADOW_Y = 0.012;
const PLAYER_SPRITE_SRC = '/assets/player/over-shoulder-builder.png';

type EntityObject = THREE.Object3D & {
  userData: {
    material?: THREE.Material;
    materials?: THREE.Material[];
    textureKey?: string;
  };
};

type RenderPools = {
  shards: Map<number, EntityObject>;
  judges: Map<number, EntityObject>;
  blasts: Map<number, EntityObject>;
  portals: Map<string, EntityObject>;
  particles: Map<number, EntityObject>;
  trails: Map<number, EntityObject>;
  scorePopups: Map<number, EntityObject>;
};

function toWorld(point: Vec, state: GameState, y = 0): THREE.Vector3 {
  return new THREE.Vector3(
    (point.x - state.variant.arena.width / 2) * WORLD_SCALE,
    y,
    (point.y - state.variant.arena.height / 2) * WORLD_SCALE,
  );
}

function colorFromCss(color: string): THREE.Color {
  return new THREE.Color(color);
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }
  material.dispose();
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) disposeMaterial(mesh.material);
  });
}

function makeGlowMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function makeShadow(radius = 0.5): THREE.Mesh {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 32),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = SHADOW_Y;
  return shadow;
}

function makeCanvasTexture(key: string, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(`Unable to create texture canvas for ${key}`);
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createLabelTexture(key: string, title: string, subtitle: string, color: string, secondaryColor = '#7df9ff'): THREE.CanvasTexture {
  return makeCanvasTexture(key, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    const glow = ctx.createRadialGradient(size / 2, size / 2, 12, size / 2, size / 2, 126);
    glow.addColorStop(0, color);
    glow.addColorStop(0.52, 'rgba(255,255,255,0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(5, 7, 17, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(36, 40, 184, 172, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(58, 60, 140, 92, 18);
    ctx.fill();

    ctx.fillStyle = '#03040a';
    ctx.font = '900 54px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, size / 2, 106);

    ctx.fillStyle = '#f7f2dc';
    ctx.font = '900 24px ui-sans-serif, system-ui';
    ctx.fillText(subtitle, size / 2, 178);

    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(70, 214);
    ctx.lineTo(186, 214);
    ctx.stroke();
  });
}

function createScoreTexture(key: string, text: string, combo: number): THREE.CanvasTexture {
  return makeCanvasTexture(key, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.shadowColor = combo >= 3 ? '#ffcf5c' : '#7df9ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = combo >= 3 ? '#ffcf5c' : '#f7f2dc';
    ctx.font = '950 58px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2 - 6);
    if (combo >= 2) {
      ctx.fillStyle = '#7df9ff';
      ctx.font = '900 30px ui-sans-serif, system-ui';
      ctx.fillText(`x${combo}`, size / 2, size / 2 + 48);
    }
  });
}

function textureForPath(
  loader: THREE.TextureLoader,
  cache: Map<string, THREE.Texture>,
  path: string,
): THREE.Texture {
  const cached = cache.get(path);
  if (cached) return cached;
  const texture = loader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(path, texture);
  return texture;
}

function textureFromCache(cache: Map<string, THREE.Texture>, key: string, create: () => THREE.Texture): THREE.Texture {
  const cached = cache.get(key);
  if (cached) return cached;
  const texture = create();
  cache.set(key, texture);
  return texture;
}

function setObjectPosition(object: THREE.Object3D, point: Vec, state: GameState, y = 0): void {
  object.position.copy(toWorld(point, state, y));
}

function judgeAnimation(enemy: Enemy): CharacterAnimation {
  if (enemy.status === 'defeated') return 'defeated';
  if (enemy.status === 'respawning') return 'respawn';
  if (enemy.health < enemy.maxHealth) return 'hurt';
  return 'chase';
}

function syncPool<T, K extends string | number>(
  group: THREE.Group,
  pool: Map<K, EntityObject>,
  items: T[],
  keyFor: (item: T) => K,
  create: (item: T) => EntityObject,
  update: (object: EntityObject, item: T) => void,
): void {
  const liveKeys = new Set<K>();
  items.forEach((item) => {
    const key = keyFor(item);
    liveKeys.add(key);
    let object = pool.get(key);
    if (!object) {
      object = create(item);
      pool.set(key, object);
      group.add(object);
    }
    update(object, item);
  });

  pool.forEach((object, key) => {
    if (liveKeys.has(key)) return;
    group.remove(object);
    disposeObject(object);
    pool.delete(key);
  });
}

function createArena(state: GameState): THREE.Group {
  const arena = new THREE.Group();
  arena.name = 'threejs-arena';
  const width = state.variant.arena.width * WORLD_SCALE;
  const height = state.variant.arena.height * WORLD_SCALE;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      color: 0x071523,
      roughness: 0.74,
      metalness: 0.12,
      emissive: 0x06162c,
      emissiveIntensity: 0.55,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  arena.add(floor);

  const grid = new THREE.GridHelper(width, 44, 0x7df9ff, 0x233a55);
  grid.scale.z = height / width;
  grid.position.y = 0.018;
  arena.add(grid);

  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 1.72, 96),
    makeGlowMaterial('#ffcf5c', 0.34),
  );
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.03;
  arena.add(centerRing);

  const boundaryMaterial = new THREE.MeshStandardMaterial({
    color: 0x071523,
    emissive: 0x7df9ff,
    emissiveIntensity: 1.35,
    roughness: 0.38,
  });
  const railDepth = 0.08;
  const railHeight = 0.22;
  const rails = [
    { x: 0, z: -height / 2, sx: width, sz: railDepth },
    { x: 0, z: height / 2, sx: width, sz: railDepth },
    { x: -width / 2, z: 0, sx: railDepth, sz: height },
    { x: width / 2, z: 0, sx: railDepth, sz: height },
  ];
  rails.forEach((rail) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rail.sx, railHeight, rail.sz), boundaryMaterial.clone());
    mesh.position.set(rail.x, railHeight / 2, rail.z);
    mesh.castShadow = true;
    arena.add(mesh);
  });

  const railLightMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1d2c,
    emissive: 0x7df9ff,
    emissiveIntensity: 1.2,
    roughness: 0.28,
  });
  for (let i = 0; i < 18; i += 1) {
    const t = i / 17 - 0.5;
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.035, 0.08), railLightMaterial.clone());
    front.position.set(t * width * 0.86, railHeight + 0.035, -height / 2 + 0.14);
    front.userData.phase = i * 0.25;
    arena.add(front);

    const back = front.clone();
    back.material = railLightMaterial.clone();
    back.position.z = height / 2 - 0.14;
    back.userData.phase = i * 0.25 + 1.4;
    arena.add(back);
  }

  const safeZone = getPortalSafetyZone(state.variant);
  const safeWidth = safeZone.width * WORLD_SCALE;
  const safeHeight = safeZone.height * WORLD_SCALE;
  const safeCenter = toWorld({ x: safeZone.x + safeZone.width / 2, y: safeZone.y + safeZone.height / 2 }, state, 0.034);
  const safeFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(safeWidth, safeHeight),
    new THREE.MeshStandardMaterial({
      color: 0x102135,
      roughness: 0.62,
      metalness: 0.08,
      emissive: 0x143744,
      emissiveIntensity: 0.72,
    }),
  );
  safeFloor.name = 'entry-corridor-floor';
  safeFloor.rotation.x = -Math.PI / 2;
  safeFloor.position.copy(safeCenter);
  arena.add(safeFloor);

  const corridorWallMaterial = new THREE.MeshStandardMaterial({
    color: 0x10142a,
    emissive: 0xff4dca,
    emissiveIntensity: 0.62,
    roughness: 0.36,
  });
  const wallHeight = 0.52;
  const wallDepth = 0.14;
  const wallCenter = toWorld({ x: safeZone.x + safeZone.width / 2, y: safeZone.y }, state, wallHeight / 2);
  const topWall = new THREE.Mesh(new THREE.BoxGeometry(safeWidth, wallHeight, wallDepth), corridorWallMaterial.clone());
  topWall.position.copy(wallCenter);
  topWall.castShadow = true;
  arena.add(topWall);
  const bottomWall = topWall.clone();
  bottomWall.material = corridorWallMaterial.clone();
  bottomWall.position.copy(toWorld({ x: safeZone.x + safeZone.width / 2, y: safeZone.y + safeZone.height }, state, wallHeight / 2));
  arena.add(bottomWall);
  const endWall = new THREE.Mesh(new THREE.BoxGeometry(wallDepth, wallHeight, safeHeight), corridorWallMaterial.clone());
  endWall.position.copy(toWorld({ x: safeZone.x, y: safeZone.y + safeZone.height / 2 }, state, wallHeight / 2));
  endWall.castShadow = true;
  arena.add(endWall);

  const doorTopLength = Math.max(0.4, (safeZone.door.y - safeZone.y) * WORLD_SCALE);
  const doorBottomLength = Math.max(0.4, (safeZone.y + safeZone.height - (safeZone.door.y + safeZone.door.height)) * WORLD_SCALE);
  const doorTop = new THREE.Mesh(new THREE.BoxGeometry(wallDepth, wallHeight, doorTopLength), corridorWallMaterial.clone());
  doorTop.position.copy(toWorld({ x: safeZone.door.x, y: safeZone.y + (safeZone.door.y - safeZone.y) / 2 }, state, wallHeight / 2));
  arena.add(doorTop);
  const doorBottom = new THREE.Mesh(new THREE.BoxGeometry(wallDepth, wallHeight, doorBottomLength), corridorWallMaterial.clone());
  doorBottom.position.copy(toWorld({ x: safeZone.door.x, y: safeZone.door.y + safeZone.door.height + (safeZone.y + safeZone.height - (safeZone.door.y + safeZone.door.height)) / 2 }, state, wallHeight / 2));
  arena.add(doorBottom);

  const fieldMaterial = makeGlowMaterial('#9cff8f', 0.38);
  fieldMaterial.side = THREE.DoubleSide;
  const forceField = new THREE.Mesh(new THREE.PlaneGeometry(safeZone.door.height * WORLD_SCALE, 1.72), fieldMaterial);
  forceField.name = 'entry-force-field';
  forceField.position.copy(toWorld({ x: safeZone.door.x + safeZone.door.width / 2, y: safeZone.door.y + safeZone.door.height / 2 }, state, 0.96));
  forceField.rotation.y = Math.PI / 2;
  forceField.userData.phase = 2.2;
  arena.add(forceField);

  const egressFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(safeZone.egress.width * WORLD_SCALE, safeZone.egress.height * WORLD_SCALE),
    makeGlowMaterial('#9cff8f', 0.07),
  );
  egressFloor.name = 'entry-egress-field';
  egressFloor.rotation.x = -Math.PI / 2;
  egressFloor.position.copy(toWorld({ x: safeZone.egress.x + safeZone.egress.width / 2, y: safeZone.egress.y + safeZone.egress.height / 2 }, state, 0.041));
  egressFloor.userData.phase = 3.1;
  arena.add(egressFloor);

  const pylonMaterial = new THREE.MeshStandardMaterial({
    color: 0x160b28,
    emissive: 0xff4dca,
    emissiveIntensity: 0.8,
    roughness: 0.45,
  });
  [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [-width / 2, height / 2],
    [width / 2, height / 2],
  ].forEach(([x, z], index) => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.4, 0.42), pylonMaterial.clone());
    pylon.position.set(x, 0.7, z);
    pylon.castShadow = true;
    pylon.userData.phase = index * 0.7;
    arena.add(pylon);
  });

  return arena;
}

function updateArenaPulse(arena: THREE.Group, elapsed: number): void {
  arena.traverse((child) => {
    const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!material || typeof child.userData.phase !== 'number') return;
    if ('emissiveIntensity' in material) {
      material.emissiveIntensity = 0.86 + Math.sin(elapsed * 2.8 + child.userData.phase) * 0.32;
    }
    if ('opacity' in material && material.transparent) {
      material.opacity = 0.28 + Math.sin(elapsed * 5.2 + child.userData.phase) * 0.1;
    }
  });
}

function createPlayer(textureCache: Map<string, THREE.Texture>, loader: THREE.TextureLoader): EntityObject {
  const group = new THREE.Group() as EntityObject;
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7f2dc,
    emissive: 0x7df9ff,
    emissiveIntensity: 0.34,
    roughness: 0.4,
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 6, 12), bodyMaterial);
  body.position.y = 0.48;
  body.castShadow = true;
  body.name = 'player-body';
  group.add(makeShadow(0.48));
  group.add(body);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.36, 4),
    new THREE.MeshStandardMaterial({
      color: 0x7df9ff,
      emissive: 0x7df9ff,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    }),
  );
  nose.name = 'player-nose';
  nose.position.set(0.34, 0.52, 0);
  nose.rotation.z = -Math.PI / 2;
  group.add(nose);

  const spriteTexture = textureForPath(loader, textureCache, PLAYER_SPRITE_SRC);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: spriteTexture,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  }));
  sprite.name = 'player-billboard';
  sprite.position.y = 1.02;
  sprite.scale.set(1.28, 1.28, 1);
  group.add(sprite);

  const graceRing = new THREE.Mesh(
    new THREE.RingGeometry(0.74, 0.82, 72),
    makeGlowMaterial('#9cff8f', 0.42),
  );
  graceRing.name = 'player-grace-ring';
  graceRing.rotation.x = -Math.PI / 2;
  graceRing.position.y = 0.045;
  group.add(graceRing);
  return group;
}

function updatePlayer(object: EntityObject, state: GameState): void {
  setObjectPosition(object, state.player, state, 0);
  object.rotation.y = -state.player.heading;
  const body = object.getObjectByName('player-body') as THREE.Mesh;
  const nose = object.getObjectByName('player-nose') as THREE.Mesh;
  const graceRing = object.getObjectByName('player-grace-ring') as THREE.Mesh;
  const pulse = 1 + Math.sin(state.elapsed * 9) * 0.04;
  body.scale.setScalar(pulse);
  nose.visible = state.status === 'playing';
  graceRing.visible = state.graceRemaining > 0 && state.status === 'playing';
  if (graceRing.visible) {
    const scale = 1 + Math.sin(state.elapsed * 7) * 0.08;
    graceRing.scale.setScalar(scale);
    (graceRing.material as THREE.MeshBasicMaterial).opacity = 0.24 + Math.min(0.45, state.graceRemaining / 8);
  }
}

function createShard(): EntityObject {
  const group = new THREE.Group() as EntityObject;
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.22, 0),
    new THREE.MeshStandardMaterial({
      color: 0x7df9ff,
      emissive: 0x7df9ff,
      emissiveIntensity: 1.8,
      roughness: 0.18,
      metalness: 0.18,
    }),
  );
  shard.position.y = 0.42;
  shard.castShadow = true;
  shard.name = 'shard-core';
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), makeGlowMaterial('#7df9ff', 0.16));
  glow.position.y = 0.42;
  glow.name = 'shard-glow';
  group.add(makeShadow(0.28));
  group.add(glow);
  group.add(shard);
  return group;
}

function updateShard(object: EntityObject, shard: Shard, state: GameState): void {
  setObjectPosition(object, shard, state, 0);
  const core = object.getObjectByName('shard-core');
  const glow = object.getObjectByName('shard-glow');
  const spin = state.elapsed * 2.8 + shard.id;
  if (core) {
    core.rotation.set(spin * 0.4, spin, spin * 0.25);
    const bob = 0.42 + Math.sin(state.elapsed * 4 + shard.id) * 0.07;
    core.position.y = bob;
    if (glow) glow.position.y = bob;
  }
  const magnetDistance = Math.hypot(state.player.x - shard.x, state.player.y - shard.y);
  const magneting = magnetDistance < state.player.magnetRadius + 36;
  if (glow) glow.scale.setScalar(magneting ? 1.35 : 1);
}

function createJudge(
  enemy: Enemy,
  textureCache: Map<string, THREE.Texture>,
  loader: THREE.TextureLoader,
): EntityObject {
  const group = new THREE.Group() as EntityObject;
  const color = colorFromCss(enemy.judge.color);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 0.56, 8),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.62,
      roughness: 0.35,
      metalness: 0.08,
    }),
  );
  body.position.y = 0.33;
  body.castShadow = true;
  body.name = 'judge-body';
  group.add(makeShadow(0.52));
  group.add(body);

  const spritePath = selectJudgeSprite(enemy.judge, judgeAnimation(enemy));
  const textureKey = spritePath ?? `judge-label-${enemy.judge.handle}`;
  const texture = spritePath
    ? textureForPath(loader, textureCache, spritePath)
    : textureFromCache(
      textureCache,
      textureKey,
      () => createLabelTexture(textureKey, enemy.judge.signal, enemy.judge.handle, enemy.judge.color, enemy.judge.secondaryColor),
    );
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
  }));
  sprite.name = 'judge-billboard';
  sprite.position.y = 1.22;
  sprite.scale.set(1.45, 1.45, 1);
  group.add(sprite);

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.82, 64),
    makeGlowMaterial(enemy.judge.color, 0.28),
  );
  aura.name = 'judge-aura';
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.052;
  group.add(aura);

  const healthBack = new THREE.Mesh(
    new THREE.PlaneGeometry(1.04, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x03040a, transparent: true, opacity: 0.78, depthWrite: false }),
  );
  healthBack.name = 'judge-health-back';
  healthBack.position.y = 2.12;
  group.add(healthBack);

  const healthFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.052),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }),
  );
  healthFill.name = 'judge-health-fill';
  healthFill.position.y = 2.121;
  group.add(healthFill);
  return group;
}

function updateJudge(
  object: EntityObject,
  enemy: Enemy,
  state: GameState,
  textureCache: Map<string, THREE.Texture>,
  loader: THREE.TextureLoader,
): void {
  setObjectPosition(object, enemy, state, 0);
  const body = object.getObjectByName('judge-body') as THREE.Mesh;
  const sprite = object.getObjectByName('judge-billboard') as THREE.Sprite;
  const aura = object.getObjectByName('judge-aura') as THREE.Mesh;
  const healthBack = object.getObjectByName('judge-health-back') as THREE.Mesh;
  const healthFill = object.getObjectByName('judge-health-fill') as THREE.Mesh;
  const ratio = Math.max(0, Math.min(1, enemy.health / enemy.maxHealth));
  const playerDistance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
  const threat = state.status === 'playing' && state.graceRemaining <= 0 && enemy.status === 'chasing'
    ? Math.max(0, Math.min(1, 1 - playerDistance / 330))
    : 0;

  const spritePath = selectJudgeSprite(enemy.judge, judgeAnimation(enemy));
  const textureKey = spritePath ?? `judge-label-${enemy.judge.handle}`;
  if (object.userData.textureKey !== textureKey) {
    sprite.material.map = spritePath
      ? textureForPath(loader, textureCache, spritePath)
      : textureFromCache(
        textureCache,
        textureKey,
        () => createLabelTexture(textureKey, enemy.judge.signal, enemy.judge.handle, enemy.judge.color, enemy.judge.secondaryColor),
      );
    sprite.material.needsUpdate = true;
    object.userData.textureKey = textureKey;
  }

  const defeated = enemy.status !== 'chasing';
  object.visible = enemy.status === 'chasing' || enemy.status === 'defeated' || enemy.status === 'respawning';
  body.rotation.y = state.elapsed * (defeated ? 0.6 : 1.5) + enemy.id;
  body.scale.setScalar(defeated ? 0.72 : 1 + threat * 0.16);
  sprite.material.opacity = defeated ? 0.42 : 0.95;
  sprite.scale.setScalar(defeated ? 1.18 : 1.45 + threat * 0.28);
  aura.visible = !defeated;
  aura.scale.setScalar(1 + threat * 1.2 + Math.sin(state.elapsed * 8 + enemy.id) * 0.08);
  (aura.material as THREE.MeshBasicMaterial).opacity = 0.16 + threat * 0.34;
  healthBack.visible = !defeated;
  healthFill.visible = !defeated;
  healthFill.scale.x = ratio;
  healthFill.position.x = -0.5 * (1 - ratio);
}

function createBlast(): EntityObject {
  const group = new THREE.Group() as EntityObject;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffcf5c,
      blending: THREE.AdditiveBlending,
    }),
  );
  core.name = 'blast-core';
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), makeGlowMaterial('#ffcf5c', 0.24));
  glow.name = 'blast-glow';
  group.add(core);
  group.add(glow);
  return group;
}

function updateBlast(object: EntityObject, blast: ShardBlast, state: GameState): void {
  setObjectPosition(object, blast, state, 0.5);
  const scale = 1 + Math.sin(state.elapsed * 18 + blast.id) * 0.12;
  object.scale.setScalar(scale);
}

function createPortal(portal: GamePortal): EntityObject {
  const group = new THREE.Group() as EntityObject;
  const groundGlow = new THREE.Mesh(
    new THREE.CircleGeometry(portal.radius * WORLD_SCALE * 1.65, 64),
    makeGlowMaterial(portal.secondaryColor, 0.16),
  );
  groundGlow.name = 'portal-ground-glow';
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.035;
  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(portal.radius * WORLD_SCALE, 0.045, 12, 72),
    makeGlowMaterial(portal.color, 0.8),
  );
  outer.name = 'portal-outer';
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.12;
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(portal.radius * WORLD_SCALE * 0.62, 0.035, 12, 72),
    makeGlowMaterial(portal.secondaryColor, 0.66),
  );
  inner.name = 'portal-inner';
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.15;
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(portal.radius * WORLD_SCALE * 0.32, portal.radius * WORLD_SCALE * 0.7, 1.9, 32, 1, true),
    makeGlowMaterial(portal.color, 0.2),
  );
  column.name = 'portal-column';
  column.position.y = 0.95;
  const light = new THREE.PointLight(colorFromCss(portal.color), 8, 6, 2);
  light.name = 'portal-light';
  light.position.y = 1.35;
  group.add(groundGlow);
  group.add(outer);
  group.add(inner);
  group.add(column);
  group.add(light);
  return group;
}

function updatePortal(object: EntityObject, portal: GamePortal, state: GameState): void {
  setObjectPosition(object, portal, state, 0);
  const groundGlow = object.getObjectByName('portal-ground-glow');
  const outer = object.getObjectByName('portal-outer');
  const inner = object.getObjectByName('portal-inner');
  const column = object.getObjectByName('portal-column');
  const light = object.getObjectByName('portal-light') as THREE.PointLight | undefined;
  if (groundGlow) groundGlow.scale.setScalar(1 + Math.sin(state.elapsed * 3 + portal.radius) * 0.08);
  if (outer) outer.rotation.z = state.elapsed * 0.9;
  if (inner) inner.rotation.z = -state.elapsed * 1.25;
  if (column) column.scale.y = 1 + Math.sin(state.elapsed * 4 + portal.radius) * 0.08;
  if (light) light.intensity = 7 + Math.sin(state.elapsed * 4.4 + portal.radius) * 1.4;
}

function createParticle(particle: PickupParticle): EntityObject {
  const color = colorFromCss(particle.color);
  const particleMesh = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.04, particle.radius * WORLD_SCALE * 2.2), 8, 6),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  ) as EntityObject;
  return particleMesh;
}

function updateParticle(object: EntityObject, particle: PickupParticle, state: GameState): void {
  setObjectPosition(object, particle, state, 0.34 + (1 - particle.age / particle.ttl) * 0.34);
  const material = (object as THREE.Mesh).material as THREE.MeshBasicMaterial;
  material.opacity = Math.max(0, 1 - particle.age / particle.ttl);
}

function createTrail(): EntityObject {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({
      color: 0x7df9ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    }),
  ) as EntityObject;
  return line;
}

function updateTrail(object: EntityObject, trail: PickupTrail, state: GameState): void {
  const line = object as THREE.Line;
  const from = toWorld(trail.from, state, 0.42);
  const to = toWorld(trail.to, state, 0.72);
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
  const material = line.material as THREE.LineBasicMaterial;
  material.opacity = Math.max(0, 1 - trail.age / trail.ttl) * 0.75;
}

function createScorePopup(
  popup: { id: number; value: number; combo: number },
  textureCache: Map<string, THREE.Texture>,
): EntityObject {
  const key = `score-${popup.id}-${popup.value}-${popup.combo}`;
  const texture = textureFromCache(textureCache, key, () => createScoreTexture(key, `+${popup.value}`, popup.combo));
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })) as EntityObject;
  sprite.userData.textureKey = key;
  return sprite;
}

function updateScorePopup(object: EntityObject, popup: { x: number; y: number; age: number; ttl: number }, state: GameState): void {
  setObjectPosition(object, popup, state, 1.2 + popup.age * 0.9);
  const sprite = object as THREE.Sprite;
  sprite.scale.set(1.2, 0.58, 1);
  sprite.material.opacity = Math.max(0, 1 - popup.age / popup.ttl);
}

function syncDynamicObjects(
  dynamicGroup: THREE.Group,
  pools: RenderPools,
  state: GameState,
  textureCache: Map<string, THREE.Texture>,
  loader: THREE.TextureLoader,
): void {
  syncPool(dynamicGroup, pools.shards, state.shards, (shard) => shard.id, createShard, (object, shard) => updateShard(object, shard, state));
  syncPool(
    dynamicGroup,
    pools.judges,
    state.enemies,
    (enemy) => enemy.id,
    (enemy) => createJudge(enemy, textureCache, loader),
    (object, enemy) => updateJudge(object, enemy, state, textureCache, loader),
  );
  syncPool(dynamicGroup, pools.blasts, state.blasts, (blast) => blast.id, createBlast, (object, blast) => updateBlast(object, blast, state));
  syncPool(dynamicGroup, pools.portals, state.portals, (portal) => portal.id, createPortal, (object, portal) => updatePortal(object, portal, state));
  syncPool(dynamicGroup, pools.particles, state.pickupParticles, (particle) => particle.id, createParticle, (object, particle) => updateParticle(object, particle, state));
  syncPool(dynamicGroup, pools.trails, state.pickupTrails, (trail) => trail.id, createTrail, (object, trail) => updateTrail(object, trail, state));
  syncPool(
    dynamicGroup,
    pools.scorePopups,
    state.scorePopups,
    (popup) => popup.id,
    (popup) => createScorePopup(popup, textureCache),
    (object, popup) => updateScorePopup(object, popup, state),
  );
}

function updateCamera(camera: THREE.PerspectiveCamera, state: GameState, targetRef: THREE.Vector3): void {
  const player = toWorld(state.player, state, 0);
  const forward = new THREE.Vector3(Math.cos(state.player.heading), 0, Math.sin(state.player.heading));
  const desired = player.clone().add(new THREE.Vector3(0, 10.4, 7.2));
  const target = player.clone().add(forward.multiplyScalar(0.7)).add(new THREE.Vector3(0, 0.28, 0));
  const shake = state.screenShake > 0
    ? new THREE.Vector3(
      Math.sin(state.elapsed * 91) * state.screenShake * 0.006,
      Math.cos(state.elapsed * 79) * state.screenShake * 0.004,
      Math.cos(state.elapsed * 73) * state.screenShake * 0.006,
    )
    : new THREE.Vector3();
  camera.position.lerp(desired.add(shake), 0.16);
  targetRef.lerp(target, 0.2);
  camera.lookAt(targetRef);
}

export function ThreeCanvas({ state, onPointerDown, onPointerAim }: ThreeCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setClearColor(0x081022, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x081022);
    scene.fog = new THREE.FogExp2(0x081022, 0.022);

    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 140);
    const lookTarget = new THREE.Vector3();
    camera.position.set(0, 8, 9);

    const hemi = new THREE.HemisphereLight(0x7df9ff, 0x12081f, 1.4);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xf7f2dc, 2.2);
    keyLight.position.set(-5, 10, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 40;
    scene.add(keyLight);

    const magentaLight = new THREE.PointLight(0xff4dca, 18, 18, 2);
    magentaLight.position.set(-8, 4, -6);
    scene.add(magentaLight);

    const cyanLight = new THREE.PointLight(0x7df9ff, 16, 18, 2);
    cyanLight.position.set(8, 4, 7);
    scene.add(cyanLight);

    const loader = new THREE.TextureLoader();
    const textureCache = new Map<string, THREE.Texture>();
    const arena = createArena(stateRef.current);
    const dynamicGroup = new THREE.Group();
    const player = createPlayer(textureCache, loader);
    const pools: RenderPools = {
      shards: new Map(),
      judges: new Map(),
      blasts: new Map(),
      portals: new Map(),
      particles: new Map(),
      trails: new Map(),
      scorePopups: new Map(),
    };
    scene.add(arena);
    scene.add(dynamicGroup);
    scene.add(player);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const render = () => {
      const current = stateRef.current;
      updateArenaPulse(arena, current.elapsed);
      updatePlayer(player, current);
      syncDynamicObjects(dynamicGroup, pools, current, textureCache, loader);
      updateCamera(camera, current, lookTarget);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.removeChild(renderer.domElement);
      disposeObject(scene);
      textureCache.forEach((texture) => texture.dispose());
      renderer.dispose();
    };
  }, []);

  const aimFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onPointerAim(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      { width: rect.width, height: rect.height },
    );
  };

  return (
    <div
      ref={mountRef}
      className="threeStage"
      role="application"
      tabIndex={0}
      aria-label="LoopForge ThreeJS arena"
      data-engine="ThreeJS"
      data-player-heading={state.player.heading.toFixed(3)}
      data-player-x={state.player.x.toFixed(1)}
      data-player-y={state.player.y.toFixed(1)}
      onPointerMove={aimFromPointer}
      onPointerDown={(event) => {
        mountRef.current?.focus();
        aimFromPointer(event);
        onPointerDown();
      }}
    />
  );
}
