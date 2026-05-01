LoopForge is a playable AI game-design lab for Vibe Jam 2026.

The goal is a fast-loading browser game where the player feels like they are inside an AI-run arcade lab. The frontend must be instantly playable, free, no login, and include the Vibe Jam widget script.

Core game direction:
- lightweight 2.5D Vibe Jam arena
- collect AI-code/vibe shards
- avoid, then eventually fight, silly judge chasers with shard blasts
- survive short waves and earn score from collection, close calls, and judge defeats
- judges have health, die/reset, and eventually retain tiny local per-match learned experience between lives before any global learning exists
- receive mutations/upgrades
- Hermes/agent lab generates JSON configs, not huge code rewrites

Current strategy:
- keep mechanics just deep enough for clarity, flow, and replay
- put most near-term effort into professional-feeling visuals, juice, arena polish, and judge references
- avoid complex systems until the existing loop feels excellent

Agent roles:
- Creative Director: focus, cuts, submission quality
- Game Designer: mechanics, upgrades, enemies, pacing
- Psychological Researcher: ethical engagement, SDT, flow, feedback, reward loops
- Balance Agent: tuning and difficulty
- Critic/Playtest Agent: clarity, fun, fairness
- Build Agent: simple working web code

Hard rule:
The game must be fun before it is impressive.

Avoid for the jam MVP:
- mandatory accounts
- heavy assets
- complex inventory
- autonomous rewrite/deploy loop
- gambling-like reward systems

Allowed later, after the single-player loop is fun:
- optional display names
- lightweight leaderboard
- asynchronous public arena scoring
- real-time multiplayer/open arena as the target, with local/bot fallback required and no dependency on network success

Required widget:
<script async src="https://vibej.am/2026/widget.js"></script>
