# Game Design Principles

## Core Rule

The game must be fun before it is impressive.

A simple game with satisfying movement, clear goals, and strong feedback is better than a complex agentic system that is confusing or slow.

## First 5 Seconds

The player should immediately understand:

- where they are
- what they control
- what to collect
- what to avoid
- why they should keep playing

No long intro. No login. No tutorial wall.

## Core Loop

Current short-session loop:

1. Move through a first-person / pseudo-3D arena
2. Collect AI-code/vibe shards
3. Avoid judge chasers
4. Get reward feedback
5. Choose upgrade
6. Difficulty increases
7. Survive longer
8. See score/progress
9. Want to retry

Future combat loop:

1. Collect shards to charge shard blasts
2. Fire shard blasts at judge chasers
3. Damage judge health bars
4. Defeat a judge for points and breathing room
5. Judge respawns with a tiny local per-match learned adaptation
6. Player adapts strategy and pushes the leaderboard

## Player Feel

Movement should feel:

- responsive
- smooth
- slightly juicy
- easy to control
- hard to master

Feedback should include:

- particles
- sound
- score popups
- enemy flashes
- pickup animations
- upgrade effects
- screen shake used lightly

## Difficulty

Difficulty should:

- start easy
- become dangerous quickly
- create close calls
- make failure feel fair
- encourage “one more run”

Avoid:

- instant unfair deaths
- invisible hazards
- confusing enemy behavior
- difficulty spikes with no warning

## Upgrades

Upgrades should create noticeable changes.

Good upgrades:

- faster movement
- larger pickup radius
- dash
- shield
- score multiplier
- enemy slow
- chain pickups
- temporary invulnerability
- clone / decoy
- magnet field

Bad upgrades:

- tiny invisible stat boosts
- unclear effects
- upgrades that do not change behavior
- upgrades that are always mathematically obvious

## Character Design Guidelines

Judge characters should be simple, silly, and readable at a glance.

Best path:

- Use silly arcade mascot sprite billboards first: 2D characters placed in the pseudo-3D arena.
- Avoid realistic likenesses; use affectionate mascot parody and strong archetypes.
- Give each judge one dominant color, one readable prop, one movement personality, and one attack style.
- Keep sprite dimensions small, e.g. 128x128 or 256x256 sheets, to preserve instant loading.
- Start with 5 animation states: idle, chase, attack, hurt, defeated/respawn.
- Make barks short enough to read while moving.

Character data should live in a typed config rather than being hard-coded inside rendering logic.

## Lightweight Judge Learning

The judge-learning system should be tiny and explainable, not a heavy ML system. Start with local per-match learning so every run can produce visible adaptation without accounts or backend dependencies. Add global learning later after local behavior is fun and fair.

Recommended first algorithm:

- Each judge has per-match `experience`, `defeats`, and weighted behavior preferences.
- On defeat, record what happened: distance, player weapon/upgrade, time alive, damage source.
- On respawn, adjust one or two weights by a tiny amount.
- Cap all values so judges remain fair and readable.

Example adaptation rules:

- If defeated from far away, slightly increase zig-zag movement or projectile resistance.
- If defeated by close-range attack, slightly increase retreat distance or attack wind-up speed.
- If kited for too long, slightly increase pathing aggression.
- If the player keeps collecting safely, one judge learns to guard shards.

The goal is for players to say “oh no, they learned,” without needing opaque AI or expensive computation.

## Replayability

Each run should have slight variation:

- different upgrade choices
- different enemy patterns
- different arena modifiers
- different research hypothesis
- different scoring opportunities

## Agentic Layer

The agent should generate:

- run title
- research hypothesis
- upgrade set
- enemy mix
- difficulty curve
- scoring rule
- arena modifier
- post-run analysis

Example:

Hypothesis:
"Players will replay more when early rewards are frequent but danger ramps sharply after 45 seconds."

Generated Config:

- shard spawn rate: high
- enemy speed: low early, high late
- upgrade frequency: every 25 seconds
- score multiplier: increases near enemies

## Avoid Scope Creep

Do not build:

- accounts
- multiplayer
- complex inventory
- marketplace
- large procedural worlds
- fully autonomous game deployment
- mobile app version
- blockchain/NFT layer
- leaderboard unless very easy
