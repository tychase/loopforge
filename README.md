# LoopForge

LoopForge is a ThreeJS camera-follow Vibe Jam arena for Vibe Jam 2026: collect AI-code shards while monster judges chase, roast, learn, and respawn.

## Current loop

- Lightweight ThreeJS camera-follow arcade survival
- Collect cyan AI-code/vibe shards
- Move with WASD/arrow-key arena controls while the angled 3D camera follows the player
- Aim with the mouse cursor and fire shard blasts to damage and defeat judge chasers
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
6. Build toward optional room-based multiplayer while preserving local/bot fallback.

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

## Deployment direction

The production target is a static Vite/React/ThreeJS frontend with optional room-based multiplayer behind a Node.js backend later. The submitted game must remain playable in solo mode if the multiplayer backend is unavailable.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the VPS, PM2, reverse proxy, and backend expectations.

## Controls

No mouse capture is required.

- W or Up: move up
- S or Down: move down
- A/D or Left/Right: move left/right
- Move mouse: aim
- Space or click: fire a shard blast toward the cursor
