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
const LAB_PARTICLE_COUNT = 84;
const PORTAL_PARTICLE_COUNT = 28;

type PortalParticleMeta = {
  angles: Float32Array;
  radii: Float32Array;
  heights: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
};

type LabParticleMeta = {
  base: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  drift: Float32Array;
};

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

function proceduralUnit(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
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

function createAvatarFrameTexture(key: string, color: string, secondaryColor: string): THREE.CanvasTexture {
  return makeCanvasTexture(key, (ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    const center = size / 2;
    const glow = ctx.createRadialGradient(center, center, 36, center, center, 124);
    glow.addColorStop(0, 'rgba(255,255,255,0.05)');
    glow.addColorStop(0.54, color);
    glow.addColorStop(0.72, secondaryColor);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(center, center, 124, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(center, center, 108, Math.PI * 0.04, Math.PI * 1.42);
    ctx.stroke();

    ctx.strokeStyle = secondaryColor;
    ctx.shadowColor = secondaryColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(center, center, 90, Math.PI * 1.12, Math.PI * 1.92);
    ctx.stroke();

    ctx.shadowBlur = 10;
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI * 0.25;
      const x = center + Math.cos(angle) * 108;
      const y = center + Math.sin(angle) * 108;
      ctx.fillStyle = i % 2 === 0 ? color : secondaryColor;
      ctx.fillRect(x - 5, y - 5, 10, 10);
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

function isAvatarJudgeSprite(enemy: Enemy, spritePath: string | undefined): boolean {
  return Boolean(spritePath && enemy.judge.avatar && spritePath === enemy.judge.avatar);
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

function addBoundaryLightBar(
  arena: THREE.Group,
  position: THREE.Vector3,
  size: THREE.Vector3,
  color: string,
  phase: number,
): void {
  const material = new THREE.MeshStandardMaterial({
    color: 0x0b1d2c,
    emissive: colorFromCss(color),
    emissiveIntensity: 0.82,
    roughness: 0.3,
    transparent: true,
    opacity: 0.76,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.name = 'boundary-pulse-light';
  mesh.position.copy(position);
  mesh.userData.phase = phase;
  mesh.userData.pulseBase = 0.82;
  mesh.userData.pulseAmp = 0.22;
  mesh.userData.pulseSpeed = 2.05;
  mesh.userData.opacityBase = 0.7;
  mesh.userData.opacityAmp = 0.08;
  arena.add(mesh);
}

function addBoundaryLights(arena: THREE.Group, width: number, height: number, railHeight: number): void {
  const colors = ['#7df9ff', '#ff4dca', '#ffcf5c', '#9cff8f'];
  const longCount = 26;
  const sideCount = 22;
  for (let i = 0; i < longCount; i += 1) {
    const t = i / (longCount - 1) - 0.5;
    const x = t * width * 0.9;
    const color = colors[i % colors.length];
    addBoundaryLightBar(
      arena,
      new THREE.Vector3(x, railHeight + 0.038, -height / 2 + 0.145),
      new THREE.Vector3(0.52, 0.035, 0.075),
      color,
      i * 0.24,
    );
    addBoundaryLightBar(
      arena,
      new THREE.Vector3(x, railHeight + 0.038, height / 2 - 0.145),
      new THREE.Vector3(0.52, 0.035, 0.075),
      colors[(i + 2) % colors.length],
      i * 0.24 + 1.4,
    );
  }

  for (let i = 0; i < sideCount; i += 1) {
    const t = i / (sideCount - 1) - 0.5;
    const z = t * height * 0.88;
    const color = colors[(i + 1) % colors.length];
    addBoundaryLightBar(
      arena,
      new THREE.Vector3(-width / 2 + 0.145, railHeight + 0.038, z),
      new THREE.Vector3(0.075, 0.035, 0.48),
      color,
      i * 0.27 + 0.8,
    );
    addBoundaryLightBar(
      arena,
      new THREE.Vector3(width / 2 - 0.145, railHeight + 0.038, z),
      new THREE.Vector3(0.075, 0.035, 0.48),
      colors[(i + 3) % colors.length],
      i * 0.27 + 2.2,
    );
  }
}

function addCornerMachinery(arena: THREE.Group, width: number, height: number): void {
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x060812,
    emissive: 0x071523,
    emissiveIntensity: 0.28,
    roughness: 0.6,
    metalness: 0.18,
  });
  const accentColors = ['#7df9ff', '#ff4dca', '#ffcf5c', '#9cff8f'];
  const corners = [
    { sx: -1, sz: -1, rotation: Math.PI * 0.25 },
    { sx: 1, sz: -1, rotation: -Math.PI * 0.25 },
    { sx: -1, sz: 1, rotation: Math.PI * 0.75 },
    { sx: 1, sz: 1, rotation: -Math.PI * 0.75 },
  ];

  corners.forEach((corner, index) => {
    const group = new THREE.Group();
    group.name = 'corner-lab-machinery';
    group.position.set(corner.sx * (width / 2 + 0.84), 0, corner.sz * (height / 2 + 0.76));
    group.rotation.y = corner.rotation;

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.42, 0.86), darkMaterial.clone());
    base.position.y = 0.21;
    base.castShadow = true;
    group.add(base);

    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.86, 0.58), darkMaterial.clone());
    cabinet.position.set(-0.28, 0.82, -0.06);
    cabinet.castShadow = true;
    group.add(cabinet);

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 1.05, 14), darkMaterial.clone());
    tank.position.set(0.46, 0.82, 0.12);
    tank.castShadow = true;
    group.add(tank);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8),
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        emissive: colorFromCss(accentColors[index]),
        emissiveIntensity: 0.42,
        roughness: 0.34,
      }),
    );
    antenna.position.set(0.02, 1.64, -0.18);
    group.add(antenna);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), makeGlowMaterial(accentColors[index], 0.7));
    beacon.position.set(0.02, 2.32, -0.18);
    beacon.userData.phase = index * 0.9;
    beacon.userData.opacityBase = 0.52;
    beacon.userData.opacityAmp = 0.13;
    beacon.userData.pulseSpeed = 1.9;
    group.add(beacon);

    for (let i = 0; i < 3; i += 1) {
      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.035, 0.045),
        makeGlowMaterial(accentColors[(index + i) % accentColors.length], 0.58),
      );
      accent.position.set(-0.46 + i * 0.18, 0.66, -0.37);
      accent.userData.phase = index + i * 0.45;
      accent.userData.opacityBase = 0.44;
      accent.userData.opacityAmp = 0.12;
      accent.userData.pulseSpeed = 2.4;
      group.add(accent);
    }

    arena.add(group);
  });
}

function createLabParticles(state: GameState): THREE.Points {
  const width = state.variant.arena.width * WORLD_SCALE;
  const height = state.variant.arena.height * WORLD_SCALE;
  const positions = new Float32Array(LAB_PARTICLE_COUNT * 3);
  const phases = new Float32Array(LAB_PARTICLE_COUNT);
  const speeds = new Float32Array(LAB_PARTICLE_COUNT);
  const drift = new Float32Array(LAB_PARTICLE_COUNT);

  for (let i = 0; i < LAB_PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    positions[offset] = (proceduralUnit(i, 1) - 0.5) * width * 1.25;
    positions[offset + 1] = 1.25 + proceduralUnit(i, 2) * 5.8;
    positions[offset + 2] = (proceduralUnit(i, 3) - 0.5) * height * 1.25;
    phases[i] = proceduralUnit(i, 4) * Math.PI * 2;
    speeds[i] = 0.1 + proceduralUnit(i, 5) * 0.18;
    drift[i] = 0.18 + proceduralUnit(i, 6) * 0.46;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x7df9ff,
    size: 0.055,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'lab-parallax-particles';
  points.userData.labParticleMeta = { base: positions.slice(), phases, speeds, drift } satisfies LabParticleMeta;
  return points;
}

function updateLabParticles(points: THREE.Points, elapsed: number): void {
  const meta = points.userData.labParticleMeta as LabParticleMeta | undefined;
  if (!meta) return;
  const attribute = points.geometry.getAttribute('position') as THREE.BufferAttribute;
  const positions = attribute.array as Float32Array;
  for (let i = 0; i < LAB_PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const wave = elapsed * meta.speeds[i] + meta.phases[i];
    positions[offset] = meta.base[offset] + Math.sin(wave) * meta.drift[i];
    positions[offset + 1] = meta.base[offset + 1] + Math.sin(wave * 1.7) * 0.16;
    positions[offset + 2] = meta.base[offset + 2] + Math.cos(wave * 0.86) * meta.drift[i] * 0.7;
  }
  attribute.needsUpdate = true;
  points.rotation.y = Math.sin(elapsed * 0.06) * 0.018;
  const material = points.material as THREE.PointsMaterial;
  material.opacity = 0.2 + Math.sin(elapsed * 0.35) * 0.035;
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

  addBoundaryLights(arena, width, height, railHeight);

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
  forceField.userData.opacityBase = 0.36;
  forceField.userData.opacityAmp = 0.08;
  forceField.userData.pulseSpeed = 4.4;
  arena.add(forceField);

  const egressFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(safeZone.egress.width * WORLD_SCALE, safeZone.egress.height * WORLD_SCALE),
    makeGlowMaterial('#9cff8f', 0.07),
  );
  egressFloor.name = 'entry-egress-field';
  egressFloor.rotation.x = -Math.PI / 2;
  egressFloor.position.copy(toWorld({ x: safeZone.egress.x + safeZone.egress.width / 2, y: safeZone.egress.y + safeZone.egress.height / 2 }, state, 0.041));
  egressFloor.userData.phase = 3.1;
  egressFloor.userData.opacityBase = 0.055;
  egressFloor.userData.opacityAmp = 0.025;
  egressFloor.userData.pulseSpeed = 2.7;
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
    pylon.userData.pulseBase = 0.72;
    pylon.userData.pulseAmp = 0.18;
    pylon.userData.pulseSpeed = 2.1;
    arena.add(pylon);
  });

  addCornerMachinery(arena, width, height);

  return arena;
}

function updateArenaPulse(arena: THREE.Group, elapsed: number): void {
  arena.traverse((child) => {
    const material = (child as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!material || Array.isArray(material) || typeof child.userData.phase !== 'number') return;
    const pulseSpeed = typeof child.userData.pulseSpeed === 'number' ? child.userData.pulseSpeed : 2.8;
    const wave = Math.sin(elapsed * pulseSpeed + child.userData.phase);
    if ('emissiveIntensity' in material) {
      const standardMaterial = material as THREE.MeshStandardMaterial;
      const base = typeof child.userData.pulseBase === 'number' ? child.userData.pulseBase : 0.86;
      const amp = typeof child.userData.pulseAmp === 'number' ? child.userData.pulseAmp : 0.32;
      standardMaterial.emissiveIntensity = base + wave * amp;
    }
    if (material.transparent) {
      const base = typeof child.userData.opacityBase === 'number' ? child.userData.opacityBase : material.opacity;
      const amp = typeof child.userData.opacityAmp === 'number' ? child.userData.opacityAmp : 0.1;
      material.opacity = Math.max(0, base + wave * amp);
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
  const shadow = makeShadow(0.52);
  shadow.name = 'judge-shadow';
  group.add(shadow);
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
  sprite.renderOrder = 2;
  const glitchSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.03,
    depthWrite: false,
    color: colorFromCss(enemy.judge.secondaryColor),
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
  }));
  glitchSprite.name = 'judge-glitch-billboard';
  glitchSprite.position.y = 1.22;
  glitchSprite.scale.set(1.5, 1.5, 1);
  glitchSprite.renderOrder = 1;
  group.add(glitchSprite);
  group.add(sprite);

  const avatarFrame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: textureFromCache(
      textureCache,
      `judge-avatar-frame-${enemy.judge.handle}`,
      () => createAvatarFrameTexture(`judge-avatar-frame-${enemy.judge.handle}`, enemy.judge.color, enemy.judge.secondaryColor),
    ),
    transparent: true,
    alphaTest: 0.02,
    depthWrite: false,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
  }));
  avatarFrame.name = 'judge-avatar-frame';
  avatarFrame.position.y = 1.22;
  avatarFrame.scale.set(1.68, 1.68, 1);
  avatarFrame.renderOrder = 0;
  group.add(avatarFrame);

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
  const shadow = object.getObjectByName('judge-shadow') as THREE.Mesh;
  const sprite = object.getObjectByName('judge-billboard') as THREE.Sprite;
  const glitchSprite = object.getObjectByName('judge-glitch-billboard') as THREE.Sprite;
  const avatarFrame = object.getObjectByName('judge-avatar-frame') as THREE.Sprite;
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
    glitchSprite.material.map = sprite.material.map;
    sprite.material.needsUpdate = true;
    glitchSprite.material.needsUpdate = true;
    object.userData.textureKey = textureKey;
  }

  const defeated = enemy.status !== 'chasing';
  const avatarSprite = isAvatarJudgeSprite(enemy, spritePath);
  const pulse = Math.sin(state.elapsed * 3.25 + enemy.id);
  const twitch = Math.sin(state.elapsed * 17 + enemy.id * 0.7);
  const baseSpriteScale = avatarSprite
    ? defeated ? 1.08 : 1.62 + threat * 0.32
    : defeated ? 1.18 : 1.45 + threat * 0.28;
  const lean = defeated ? 0 : Math.sin(state.elapsed * 2.15 + enemy.id) * 0.035 + threat * 0.045;
  object.visible = enemy.status === 'chasing' || enemy.status === 'defeated' || enemy.status === 'respawning';
  shadow.scale.setScalar(avatarSprite ? 1.18 + threat * 0.18 : 1);
  body.rotation.y = state.elapsed * (defeated ? 0.6 : 1.5) + enemy.id;
  body.visible = !avatarSprite;
  body.scale.setScalar(defeated ? 0.72 : 1 + threat * 0.16);
  sprite.material.opacity = defeated ? 0.42 : 0.95;
  sprite.material.rotation = lean;
  sprite.position.x = defeated ? 0 : Math.sin(state.elapsed * 4.1 + enemy.id) * 0.018;
  sprite.position.y = avatarSprite
    ? defeated ? 0.96 : 1.16 + pulse * 0.065 + threat * 0.08
    : defeated ? 1.06 : 1.22 + pulse * 0.055 + threat * 0.06;
  sprite.scale.setScalar(baseSpriteScale);
  glitchSprite.visible = !defeated;
  glitchSprite.position.x = sprite.position.x + twitch * (0.018 + threat * 0.03);
  glitchSprite.position.y = sprite.position.y + Math.cos(state.elapsed * 13 + enemy.id) * 0.026;
  glitchSprite.material.opacity = defeated ? 0 : 0.05 + threat * 0.2 + Math.max(0, pulse) * 0.05;
  glitchSprite.material.rotation = lean + Math.sin(state.elapsed * 7.4 + enemy.id) * 0.08;
  glitchSprite.scale.setScalar(baseSpriteScale * (1.03 + threat * 0.08));
  avatarFrame.visible = avatarSprite && !defeated;
  avatarFrame.position.x = sprite.position.x;
  avatarFrame.position.y = sprite.position.y;
  avatarFrame.material.rotation = -lean * 0.75 + state.elapsed * 0.08;
  avatarFrame.material.opacity = 0.42 + threat * 0.22 + Math.max(0, pulse) * 0.08;
  avatarFrame.scale.setScalar(baseSpriteScale * (1.18 + threat * 0.06));
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

function createPortalParticles(portal: GamePortal): THREE.Points {
  const positions = new Float32Array(PORTAL_PARTICLE_COUNT * 3);
  const angles = new Float32Array(PORTAL_PARTICLE_COUNT);
  const radii = new Float32Array(PORTAL_PARTICLE_COUNT);
  const heights = new Float32Array(PORTAL_PARTICLE_COUNT);
  const phases = new Float32Array(PORTAL_PARTICLE_COUNT);
  const speeds = new Float32Array(PORTAL_PARTICLE_COUNT);
  const portalRadius = portal.radius * WORLD_SCALE;

  for (let i = 0; i < PORTAL_PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    angles[i] = (i / PORTAL_PARTICLE_COUNT) * Math.PI * 2 + proceduralUnit(i, portal.radius) * 0.34;
    radii[i] = portalRadius * (0.42 + proceduralUnit(i, portal.radius + 1) * 0.74);
    heights[i] = 0.18 + proceduralUnit(i, portal.radius + 2) * 1.46;
    phases[i] = proceduralUnit(i, portal.radius + 3) * Math.PI * 2;
    speeds[i] = 0.52 + proceduralUnit(i, portal.radius + 4) * 0.72;
    positions[offset] = Math.cos(angles[i]) * radii[i];
    positions[offset + 1] = heights[i];
    positions[offset + 2] = Math.sin(angles[i]) * radii[i];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: colorFromCss(portal.secondaryColor),
    size: portal.kind === 'return' ? 0.065 : 0.075,
    transparent: true,
    opacity: portal.kind === 'return' ? 0.46 : 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(geometry, material);
  particles.name = 'portal-particles';
  particles.userData.portalParticleMeta = { angles, radii, heights, phases, speeds } satisfies PortalParticleMeta;
  return particles;
}

function updatePortalParticles(particles: THREE.Points | undefined, elapsed: number, direction: number): void {
  if (!particles) return;
  const meta = particles.userData.portalParticleMeta as PortalParticleMeta | undefined;
  if (!meta) return;
  const attribute = particles.geometry.getAttribute('position') as THREE.BufferAttribute;
  const positions = attribute.array as Float32Array;
  for (let i = 0; i < PORTAL_PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const angle = meta.angles[i] + elapsed * meta.speeds[i] * direction;
    positions[offset] = Math.cos(angle) * meta.radii[i];
    positions[offset + 1] = meta.heights[i] + Math.sin(elapsed * 1.6 + meta.phases[i]) * 0.14;
    positions[offset + 2] = Math.sin(angle) * meta.radii[i];
  }
  attribute.needsUpdate = true;
  const material = particles.material as THREE.PointsMaterial;
  material.opacity = 0.44 + Math.sin(elapsed * 2.2) * 0.08;
}

function createPortal(portal: GamePortal): EntityObject {
  const group = new THREE.Group() as EntityObject;
  const portalRadius = portal.radius * WORLD_SCALE;
  const groundGlow = new THREE.Mesh(
    new THREE.CircleGeometry(portalRadius * 2.25, 64),
    makeGlowMaterial(portal.secondaryColor, portal.kind === 'return' ? 0.14 : 0.2),
  );
  groundGlow.name = 'portal-ground-glow';
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.y = 0.035;
  const outerHalo = new THREE.Mesh(
    new THREE.CircleGeometry(portalRadius * 3.05, 64),
    makeGlowMaterial(portal.color, portal.kind === 'return' ? 0.055 : 0.08),
  );
  outerHalo.name = 'portal-outer-halo';
  outerHalo.rotation.x = -Math.PI / 2;
  outerHalo.position.y = 0.028;
  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(portalRadius * 1.03, 0.052, 12, 80),
    makeGlowMaterial(portal.color, 0.88),
  );
  outer.name = 'portal-outer';
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.12;
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(portalRadius * 0.6, 0.036, 12, 72),
    makeGlowMaterial(portal.secondaryColor, 0.74),
  );
  inner.name = 'portal-inner';
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.15;
  const verticalRing = new THREE.Mesh(
    new THREE.TorusGeometry(portalRadius * 0.9, 0.035, 12, 72),
    makeGlowMaterial(portal.color, portal.kind === 'return' ? 0.34 : 0.44),
  );
  verticalRing.name = 'portal-vertical-ring';
  verticalRing.position.y = 0.98;
  const crossRing = new THREE.Mesh(
    new THREE.TorusGeometry(portalRadius * 0.68, 0.026, 12, 64),
    makeGlowMaterial(portal.secondaryColor, portal.kind === 'return' ? 0.28 : 0.36),
  );
  crossRing.name = 'portal-cross-ring';
  crossRing.position.y = 0.98;
  crossRing.rotation.y = Math.PI / 2;
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(portalRadius * 0.3, portalRadius * 0.72, 2.05, 32, 1, true),
    makeGlowMaterial(portal.color, portal.kind === 'return' ? 0.16 : 0.24),
  );
  column.name = 'portal-column';
  column.position.y = 1.02;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(portalRadius * 0.18, 16, 10),
    makeGlowMaterial(portal.secondaryColor, 0.72),
  );
  core.name = 'portal-core';
  core.position.y = 0.98;
  const particles = createPortalParticles(portal);
  const light = new THREE.PointLight(colorFromCss(portal.color), portal.kind === 'return' ? 8 : 11, 7.5, 2);
  light.name = 'portal-light';
  light.position.y = 1.3;
  group.add(outerHalo);
  group.add(groundGlow);
  group.add(outer);
  group.add(inner);
  group.add(verticalRing);
  group.add(crossRing);
  group.add(column);
  group.add(core);
  group.add(particles);
  group.add(light);
  return group;
}

function updatePortal(object: EntityObject, portal: GamePortal, state: GameState): void {
  setObjectPosition(object, portal, state, 0);
  const outerHalo = object.getObjectByName('portal-outer-halo');
  const groundGlow = object.getObjectByName('portal-ground-glow');
  const outer = object.getObjectByName('portal-outer');
  const inner = object.getObjectByName('portal-inner');
  const verticalRing = object.getObjectByName('portal-vertical-ring');
  const crossRing = object.getObjectByName('portal-cross-ring');
  const column = object.getObjectByName('portal-column');
  const core = object.getObjectByName('portal-core');
  const particles = object.getObjectByName('portal-particles') as THREE.Points | undefined;
  const light = object.getObjectByName('portal-light') as THREE.PointLight | undefined;
  const direction = portal.kind === 'return' ? -1 : 1;
  const wave = Math.sin(state.elapsed * 3 + portal.radius);
  if (outerHalo) outerHalo.scale.setScalar(1 + Math.sin(state.elapsed * 1.4 + portal.radius) * 0.09);
  if (groundGlow) groundGlow.scale.setScalar(1 + wave * 0.08);
  if (outer) outer.rotation.z = state.elapsed * 0.85 * direction;
  if (inner) inner.rotation.z = -state.elapsed * 1.28 * direction;
  if (verticalRing) {
    verticalRing.rotation.y = Math.sin(state.elapsed * 0.8 + portal.radius) * 0.16;
    verticalRing.rotation.z = state.elapsed * 0.46 * direction;
  }
  if (crossRing) {
    crossRing.rotation.y = Math.PI / 2 + Math.sin(state.elapsed * 0.7) * 0.12;
    crossRing.rotation.z = -state.elapsed * 0.58 * direction;
  }
  if (column) column.scale.y = 1 + Math.sin(state.elapsed * 4 + portal.radius) * 0.08;
  if (core) core.scale.setScalar(1 + Math.sin(state.elapsed * 4.8 + portal.radius) * 0.1);
  updatePortalParticles(particles, state.elapsed, direction);
  if (light) light.intensity = (portal.kind === 'return' ? 8 : 10.5) + Math.sin(state.elapsed * 4.4 + portal.radius) * 1.7;
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
    const labParticles = createLabParticles(stateRef.current);
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
    scene.add(labParticles);
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
      updateLabParticles(labParticles, current.elapsed);
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
