export type CharacterAnimation = 'idle' | 'chase' | 'attack' | 'hurt' | 'defeated' | 'respawn';

export type CharacterSprites = Partial<Record<CharacterAnimation, string>>;

export type JudgeChaser = {
  handle: string;
  name: string;
  role: string;
  color: string;
  emoji: string;
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
    emoji: '🧢',
    bark: 'No loading screens. Instant fun or instant doom!',
  },
  {
    handle: '@S13K_',
    name: 'S13K',
    role: 'Lead Judge',
    color: '#ff4dca',
    emoji: '🧑‍⚖️',
    bark: 'ship it, but make the loop tighter!',
  },
  {
    handle: '@TIMSORET',
    name: 'TIMSORET',
    role: 'Game Dev',
    color: '#7df9ff',
    emoji: '🎮',
    bark: 'Your juice budget is under review!',
  },
  {
    handle: '@NICOLAMANZINI',
    name: 'Nicola',
    role: 'Judge',
    color: '#9cff8f',
    emoji: '🕹️',
    bark: 'I can smell placeholder art from here!',
  },
  {
    handle: '@EDWINARBUS',
    name: 'Edwin',
    role: 'Judge',
    color: '#b08cff',
    emoji: '⚡',
    bark: 'The vibes are escaping. Contain them!',
  },
];
