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

- playable game canvas
- score display
- timer
- upgrade selection
- agent lab panel
- current research hypothesis
- post-run summary
- Vibe Jam widget

## Backend

The backend should include:

- endpoint to generate game variant
- endpoint to save playtest result
- endpoint to retrieve current best variant
- simple storage for generated configs

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
