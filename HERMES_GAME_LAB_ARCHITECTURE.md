# Hermes Game Lab Architecture

## Goal

Create a server-backed agentic game lab that generates playable game variants for a browser game.

## System Overview

```text
Player Browser
↓
Web Game Frontend
↓
Game Config Loader
↓
Agent Lab API
↓
Hermes Agent System
↓
Docs + Research + Game Design Memory
↓
Generated Game Variant JSON
```

## Frontend

The frontend should include:

- lightweight ThreeJS arena renderer with React UI overlays and sprite billboard support
- score display
- timer
- upgrade selection
- judge chaser roster and barks
- judge health/combat UI for shard-blast fighting
- lightweight minimap/radar if it improves clarity
- local/bot fallback mode that works without network access
- agent lab panel
- current research hypothesis
- post-run summary
- no contest tracking widget unless explicitly requested

## Backend

The backend should include:

- endpoint to generate game variant
- endpoint to save playtest result
- endpoint to retrieve current best variant
- simple storage for generated configs
- later: lightweight leaderboard with optional display names, score validation, and rate limits
- later: global judge-learning state, scoped per arena season or per global boss cycle
- later: real-time multiplayer/open-arena server, while preserving local/bot fallback

## Judge Learning Data Model

Keep this deterministic and cheap. Store small JSON blobs, not model weights. First implement this as local per-match state; later persist and merge global state carefully.

```json
{
  "judge_id": "levelsio",
  "level": 3,
  "experience": 42,
  "defeats": 5,
  "behavior_weights": {
    "chase": 1.1,
    "guard_shards": 0.25,
    "zig_zag": 0.15,
    "retreat_when_hurt": 0.1
  },
  "last_defeat": {
    "damage_source": "shard_blast",
    "distance": 420,
    "time_alive_seconds": 36
  }
}
```

On respawn, update at most one or two weights by a small bounded delta. This gives the feeling of learning without risking unfair or incomprehensible AI.

## Hermes Agent Workflow

1. Psychological Researcher Agent reviews engagement principle.
2. Game Designer Agent proposes a mechanic.
3. Balance Agent turns mechanic into parameters.
4. Critic Agent checks for clarity and ethics.
5. Build Agent outputs JSON config.
6. Game frontend loads config.

## Example Variant JSON

```json
{
  "variant_name": "Close Call Magnetism",
  "research_hypothesis": "Players enjoy risk-reward decisions when rewards increase near danger.",
  "session_length_seconds": 90,
  "player": {
    "speed": 280,
    "pickup_radius": 64
  },
  "rewards": {
    "shard_spawn_rate": 1.25,
    "near_enemy_multiplier": 2.0,
    "upgrade_interval_seconds": 25
  },
  "enemies": {
    "base_speed": 90,
    "speed_growth_per_second": 0.8,
    "spawn_interval_seconds": 2.2
  },
  "upgrades": [
    "dash",
    "magnet_field",
    "shield",
    "score_multiplier"
  ],
  "ethical_review": "Healthy engagement. Uses risk-reward tension without monetization or compulsion."
}
```

## Important Build Rule

The agent should not generate huge custom code every run.

Prefer:

- JSON configs
- small patches
- parameter changes
- upgrade definitions
- level modifiers

This keeps the game stable and shippable.
