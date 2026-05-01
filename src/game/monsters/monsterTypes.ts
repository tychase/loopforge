export type MonsterAnimationKey = 'idle' | 'chase' | 'attack' | 'death';

export type MonsterId =
  | 'the-shipper'
  | 'the-silent-reviewer'
  | 'the-perfectionist'
  | 'the-optimizer'
  | 'the-autocoder';

export type Point = {
  x: number;
  y: number;
};

export type MonsterDefinition = {
  id: MonsterId;
  displayName: string;
  spriteSheetPath: string;
  speed: number;
  hp: number;
  damage: number;
  attackCooldownMs: number;
  spawnWeight: number;
  abilityName: string;
  abilityDescription: string;
  voiceLines: string[];
  placeholder: {
    primaryColor: string;
    secondaryColor: string;
    glyph: string;
  };
};

export type MonsterRuntimeState = MonsterAnimationKey;

export type MonsterInstance = {
  instanceId: string;
  definitionId: MonsterId;
  displayName: string;
  position: Point;
  velocity: Point;
  state: MonsterRuntimeState;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackCooldownMs: number;
  lastAttackAtMs: number;
  spawnedAtMs: number;
};

export const MONSTER_DEFINITIONS: MonsterDefinition[] = [
  {
    id: 'the-shipper',
    displayName: 'The Shipper',
    spriteSheetPath: '/assets/monsters/the-shipper.png',
    speed: 80,
    hp: 120,
    damage: 12,
    attackCooldownMs: 1800,
    spawnWeight: 20,
    abilityName: 'Ship It',
    abilityDescription: 'Spawns a small extra enemy or projectile burst.',
    voiceLines: [
      'Ship before the timer ships you.',
      'No loading screens, no excuses.',
      'Your prototype needs a deploy button.',
    ],
    placeholder: {
      primaryColor: '#ffcf5c',
      secondaryColor: '#ff6f59',
      glyph: 'SHP',
    },
  },
  {
    id: 'the-silent-reviewer',
    displayName: 'The Silent Reviewer',
    spriteSheetPath: '/assets/monsters/the-silent-reviewer.png',
    speed: 115,
    hp: 80,
    damage: 10,
    attackCooldownMs: 2200,
    spawnWeight: 18,
    abilityName: 'Code Injection',
    abilityDescription: 'Briefly scrambles player movement or creates a hazard zone.',
    voiceLines: [
      '...',
      'A single note appears in the margin.',
      'The silence is the review.',
    ],
    placeholder: {
      primaryColor: '#ff4dca',
      secondaryColor: '#7df9ff',
      glyph: 'REV',
    },
  },
  {
    id: 'the-perfectionist',
    displayName: 'The Perfectionist',
    spriteSheetPath: '/assets/monsters/the-perfectionist.png',
    speed: 60,
    hp: 180,
    damage: 18,
    attackCooldownMs: 2600,
    spawnWeight: 10,
    abilityName: 'Critique',
    abilityDescription: 'Fires a slow sweeping laser or arc that punishes standing still.',
    voiceLines: [
      'Your hit stop needs hit stop.',
      'I can still see the placeholder timing.',
      'More feel, less spreadsheet.',
    ],
    placeholder: {
      primaryColor: '#7df9ff',
      secondaryColor: '#9cff8f',
      glyph: 'PIX',
    },
  },
  {
    id: 'the-optimizer',
    displayName: 'The Optimizer',
    spriteSheetPath: '/assets/monsters/the-optimizer.png',
    speed: 70,
    hp: 140,
    damage: 10,
    attackCooldownMs: 3000,
    spawnWeight: 14,
    abilityName: 'Scale Up',
    abilityDescription: "Buffs nearby monsters' speed or size.",
    voiceLines: [
      'Your frame budget is leaking.',
      'Too many particles, not enough plan.',
      'This loop needs cache locality.',
    ],
    placeholder: {
      primaryColor: '#9cff8f',
      secondaryColor: '#ffcf5c',
      glyph: 'OPT',
    },
  },
  {
    id: 'the-autocoder',
    displayName: 'The Autocoder',
    spriteSheetPath: '/assets/monsters/the-autocoder.png',
    speed: 95,
    hp: 100,
    damage: 14,
    attackCooldownMs: 1700,
    spawnWeight: 16,
    abilityName: 'Autocomplete',
    abilityDescription: 'Predicts player direction and fires ahead of them.',
    voiceLines: [
      'I generated three bugs and one feature.',
      'Accept all suggestions?',
      'The vibes compiled on my machine.',
    ],
    placeholder: {
      primaryColor: '#b08cff',
      secondaryColor: '#ff4dca',
      glyph: 'AI',
    },
  },
];
