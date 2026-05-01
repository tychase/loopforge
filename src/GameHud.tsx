import type { CSSProperties } from 'react';
import { distance, nearestChasingEnemy, type CombatNotice, type Enemy, type GameState } from './game';

type GameHudProps = {
  state: GameState;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function healthRatio(enemy: Enemy): number {
  return clamp(enemy.health / enemy.maxHealth, 0, 1);
}

function learnedLabel(enemy: Enemy): string {
  if (enemy.experience.defeats === 0) return enemy.judge.prop;
  const weights = enemy.experience.behaviorWeights;
  if (weights.zigZag >= weights.retreatWhenHurt && weights.zigZag > 0) return 'learned zig-zag routes';
  if (weights.chase > 1.02) return 'learned hard chase';
  if (weights.retreatWhenHurt > 0) return 'learned survival resets';
  return 'taking notes';
}

function clockLabel(state: GameState): string {
  if (state.status === 'ready') return 'START';
  if (state.graceRemaining > 0) return 'SAFE';
  return 'CLOCK';
}

function clockValue(state: GameState): string {
  if (state.status === 'ready') return 'READY';
  return String(Math.max(0, Math.ceil(state.graceRemaining > 0 ? state.graceRemaining : state.waveTimeRemaining)));
}

function Notice({ notice }: { notice: CombatNotice }) {
  return (
    <div className={`hudNotice hudNotice-${notice.kind}`} style={{ '--notice-color': notice.color } as CSSProperties}>
      <strong>{notice.title}</strong>
      <span>{notice.detail}</span>
    </div>
  );
}

function MiniMap({ state }: GameHudProps) {
  const sx = 100 / state.variant.arena.width;
  const sy = 100 / state.variant.arena.height;
  return (
    <div className="miniMap" aria-hidden="true">
      {state.shards.map((shard) => (
        <span
          key={shard.id}
          className="miniShard"
          style={{ left: `${shard.x * sx}%`, top: `${shard.y * sy}%` }}
        />
      ))}
      {state.portals.map((portal) => (
        <span
          key={portal.id}
          className={`miniPortal miniPortal-${portal.kind}`}
          style={{ left: `${portal.x * sx}%`, top: `${portal.y * sy}%`, '--portal-color': portal.color } as CSSProperties}
        />
      ))}
      {state.enemies.map((enemy) => (
        <span
          key={enemy.id}
          className={`miniJudge miniJudge-${enemy.status}`}
          style={{ left: `${enemy.x * sx}%`, top: `${enemy.y * sy}%`, '--judge-color': enemy.judge.color } as CSSProperties}
        />
      ))}
      <span
        className="miniPlayer"
        style={{
          left: `${state.player.x * sx}%`,
          top: `${state.player.y * sy}%`,
          transform: `translate(-50%, -50%) rotate(${state.player.heading}rad)`,
        }}
      />
    </div>
  );
}

function BossPanel({ enemy }: { enemy: Enemy }) {
  const ratio = healthRatio(enemy);
  return (
    <div className="bossPanel" style={{ '--judge-color': enemy.judge.color } as CSSProperties}>
      {enemy.judge.avatar && (
        <div className="bossPortrait" aria-hidden="true">
          <img src={enemy.judge.avatar} alt="" />
          <span />
        </div>
      )}
      <div className="bossPanelBody">
        <div>
          <strong>{enemy.judge.handle}</strong>
          <span>{enemy.judge.bossTitle}</span>
        </div>
        <small>{learnedLabel(enemy)}</small>
        <div className="bossHealth" aria-label={`${enemy.judge.handle} health`}>
          <span style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export function GameHud({ state }: GameHudProps) {
  const target = nearestChasingEnemy(state);
  const comboValue = state.pickupCombo.count >= 2
    ? `x${state.pickupCombo.count}`
    : state.pickupCombo.best > 0
      ? `B${state.pickupCombo.best}`
      : '-';
  const blastValue = state.player.blastCooldown <= 0 ? 'RDY' : `${Math.ceil(state.player.blastCooldown * 10) / 10}`;
  const notices = state.notices
    .filter((notice) => notice.kind !== 'hit' || notice.age < 0.5)
    .slice(0, 2);
  const threatDistance = target ? Math.round(distance(state.player, target)) : 0;
  const danger = target && state.graceRemaining <= 0 && threatDistance < 170;

  return (
    <div className="gameHud">
      <div className="runStats" aria-label="Run status">
        <strong>LOOPFORGE</strong>
        <dl>
          <div><dt>SCORE</dt><dd>{state.score}</dd></div>
          <div><dt>WAVE</dt><dd>{state.wave}</dd></div>
          <div><dt>{clockLabel(state)}</dt><dd>{clockValue(state)}</dd></div>
          <div><dt>BLAST</dt><dd>{blastValue}</dd></div>
          <div><dt>COMBO</dt><dd>{comboValue}</dd></div>
        </dl>
      </div>

      {target && <BossPanel enemy={target} />}

      {target && (
        <div className={`threatPanel${danger ? ' threatPanel-danger' : ''}`} style={{ '--judge-color': target.judge.color } as CSSProperties}>
          <strong>{target.judge.handle} closing in</strong>
          <span>{threatDistance}m // {target.judge.bossTitle}</span>
        </div>
      )}

      <MiniMap state={state} />

      {notices.length > 0 && (
        <div className="noticeStack">
          {notices.map((notice) => <Notice key={notice.id} notice={notice} />)}
        </div>
      )}
    </div>
  );
}
