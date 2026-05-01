export type CharacterAnimation = 'idle' | 'chase' | 'attack' | 'hurt' | 'defeated' | 'respawn';

export type CharacterSprites = Partial<Record<CharacterAnimation, string>>;

export type JudgeChaser = {
  handle: string;
  name: string;
  role: string;
  color: string;
  secondaryColor: string;
  emoji: string;
  signal: string;
  bossTitle: string;
  prop: string;
  bark: string;
  sprites?: CharacterSprites;
};

export function selectJudgeSprite(judge: JudgeChaser, animation: CharacterAnimation): string | undefined {
  if (!judge.sprites) return undefined;
  return judge.sprites[animation] ?? judge.sprites.idle;
}

export const JUDGE_CHASERS: JudgeChaser[] = [
  {
    handle: '@levelsio',
    name: 'Pieter',
    role: 'Organizer',
    color: '#ffcf5c',
    secondaryColor: '#ff6f59',
    emoji: 'LVL',
    signal: 'LVL',
    bossTitle: 'Instant-Ship Warden',
    prop: 'launch timer halo',
    bark: 'No loading screens. Instant fun or instant doom!',
    sprites: {
      idle: '/assets/judges/levelsio/boss.png',
      chase: '/assets/judges/levelsio/boss.png',
      hurt: '/assets/judges/levelsio/boss.png',
      defeated: '/assets/judges/levelsio/boss.png',
      respawn: '/assets/judges/levelsio/boss.png',
    },
  },
  {
    handle: '@S13K_',
    name: 'S13K',
    role: 'Lead Judge',
    color: '#ff4dca',
    secondaryColor: '#7df9ff',
    emoji: 'S13',
    signal: 'S13',
    bossTitle: 'Verdict Blade',
    prop: 'scorecard saber',
    bark: 'ship it, but make the loop tighter!',
  },
  {
    handle: '@TIMSORET',
    name: 'TIMSORET',
    role: 'Game Dev',
    color: '#7df9ff',
    secondaryColor: '#9cff8f',
    emoji: 'TIM',
    signal: 'TIM',
    bossTitle: 'Juice Auditor',
    prop: 'feel meter gauntlet',
    bark: 'Your juice budget is under review!',
  },
  {
    handle: '@NICOLAMANZINI',
    name: 'Nicola',
    role: 'Judge',
    color: '#9cff8f',
    secondaryColor: '#ffcf5c',
    emoji: 'NIC',
    signal: 'NIC',
    bossTitle: 'Art Detector',
    prop: 'placeholder scanner',
    bark: 'I can smell placeholder art from here!',
  },
  {
    handle: '@EDWINARBUS',
    name: 'Edwin',
    role: 'Judge',
    color: '#b08cff',
    secondaryColor: '#ff4dca',
    emoji: 'EDW',
    signal: 'EDW',
    bossTitle: 'Vibe Containment',
    prop: 'voltage crown',
    bark: 'The vibes are escaping. Contain them!',
  },
];
