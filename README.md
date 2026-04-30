# LoopForge

LoopForge is a first-person Vibe Jam arena for Vibe Jam 2026: collect AI-code shards while the contest judges chase, roast, learn, and respawn.

## Current loop

- Lightweight pseudo-FPV arcade survival
- Collect cyan AI-code/vibe shards
- Move with mouse-look plus WASD/arrow forward/back/strafe controls
- Fire shard blasts to damage and defeat judge chasers
- Survive short waves
- Choose a mutation/upgrade between waves
- No login, no account, no multiplayer required for the MVP

## North-star direction

LoopForge should become a funny open arena where players can eventually fight back against judge characters, score points, climb a leaderboard, and face judges that learn a little from each defeat.

Planned progression:

1. Make core movement, collection, and chase mechanics fun.
2. Add silly arcade mascot sprite billboards and arena graphics.
3. Add shard-blast attacks and judge health.
4. Add lightweight local per-match judge learning on respawn.
5. Add leaderboard/global learning later.
6. Build toward real-time multiplayer/open-arena features while preserving local/bot fallback.

See the roadmap:

`docs/plans/2026-04-30-arena-characters-combat-roadmap.md`

## Local commands

```bash
npm install
npm run dev
npm test
npm run build
```

The Vibe Jam widget is included in `index.html`:

```html
<script async src="https://vibej.am/2026/widget.js"></script>
```

## Controls

Click the arena once to capture mouse-look. Move the mouse to aim.

- W or ↑: move forward
- S or ↓: back up
- A/D or ←/→: strafe left/right
- Q/E: keyboard-look fallback
- Space or click: fire a shard blast
- Esc: release mouse capture
