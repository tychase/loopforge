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

A good short-session loop:

1. Move
2. Collect
3. Avoid danger
4. Get reward
5. Choose upgrade
6. Difficulty increases
7. Survive longer
8. See score/progress
9. Want to retry

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
