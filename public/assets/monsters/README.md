# Monster Sprite Sheets

Drop final monster sprite sheets in this folder.

## Required Files

- `the-shipper.png`
- `the-silent-reviewer.png`
- `the-perfectionist.png`
- `the-optimizer.png`
- `the-autocoder.png`

## Sheet Format

- PNG with transparent background
- 512x512 sheet
- 128x128 frame size
- 4 columns x 4 rows

## Row Layout

| Row | Animation | Frames |
| --- | --- | --- |
| 0 | idle | 4 |
| 1 | chase | 4 |
| 2 | attack | 4 |
| 3 | death | 4 |

## Art Direction

Use pixel, low-poly, glitch arcade monster designs. The monsters should be exaggerated parody archetypes inspired by public judge roles and game jam energy, not photorealistic likenesses.

The game code resolves safe placeholder frame metadata when these PNGs are missing, so final art can be added later without changing TypeScript.

## Global Style Prompt

```text
2D arcade monster sprite sheet, transparent background, 4 columns by 4 rows, 16 frames total, 128x128 per frame, full sheet 512x512, readable silhouette, exaggerated parody monster, neon glitch game jam aesthetic, browser game asset, consistent character scale, no text, no watermark, no photorealism
```

## Monster Prompts

### The Shipper

```text
2D arcade monster sprite sheet, transparent background, 4 columns by 4 rows, 16 frames, parody indie hacker monster floating on a laptop throne, hoodie, glowing tired eyes, cable tentacle arms, tiny browser windows orbiting body, chaotic startup energy, neon glitch aesthetic, funny but threatening, no text, no watermark
```

- Row 0 idle: floating, laptop throne bobbing, cable arms twitching
- Row 1 chase: laptop throne lunging forward, cables dragging aggressively
- Row 2 attack: throws glowing tweet-shaped energy bolts and deploys tiny startup windows
- Row 3 death: explodes into browser tabs, code fragments, and broken UI panels
- Ability: Ship It, spawns a small extra enemy or projectile burst

### The Silent Reviewer

```text
2D arcade monster sprite sheet, transparent background, 4 columns by 4 rows, 16 frames, mysterious glitch silhouette judge monster, hooded hacker figure, face hidden by flickering terminal glow, shadow body with scanline distortion, eerie minimal shape, readable silhouette, no text, no watermark
```

- Row 0 idle: flickers in and out, body opacity shifts
- Row 1 chase: phases forward with ghost-like smear
- Row 2 attack: releases corrupt glitch wave from hidden hands
- Row 3 death: collapses into static pixels and vanishes
- Ability: Code Injection, briefly scrambles player movement or creates a hazard zone

### The Perfectionist

```text
2D arcade monster sprite sheet, transparent background, 4 columns by 4 rows, 16 frames, elegant terrifying art director monster, cinematic glowing brush weapon, beautiful grotesque creature, polished visual effects aura, dramatic lighting, game developer boss energy, no text, no watermark
```

- Row 0 idle: elegant breathing pose, brush weapon glowing
- Row 1 chase: smooth floating pursuit, cape and paint trails behind
- Row 2 attack: dramatic brush slash with bright critique arc
- Row 3 death: shatters into paint particles and golden light
- Ability: Critique, fires a slow sweeping laser or arc that punishes standing still

### The Optimizer

```text
2D arcade monster sprite sheet, transparent background, 4 columns by 4 rows, 16 frames, corporate cyborg monster in exaggerated suit, KPI bars embedded in chest, floating graphs orbiting shoulders, robotic limbs, business horror comedy, neon dashboard aesthetic, no text, no watermark
```

- Row 0 idle: KPI bars pulse, graph panels rotate
- Row 1 chase: stiff robotic sprint with chart trails
- Row 2 attack: grows larger and projects buff aura
- Row 3 death: collapses into broken graphs and falling arrows
- Ability: Scale Up, buffs nearby monsters' speed or size

### The Autocoder

```text
2D arcade monster sprite sheet, transparent background, 4 columns by 4 rows, 16 frames, AI code entity monster, humanoid made of flowing code streams, blinking cursor eye, autocomplete hands, neon blue digital body, glitch arcade style, no readable text, no watermark
```

- Row 0 idle: code body scrolls, cursor eye blinks
- Row 1 chase: body re-forms while sliding forward
- Row 2 attack: fires predictive code beams from hands
- Row 3 death: disintegrates into code dust and fading cursor
- Ability: Autocomplete, predicts player direction and fires ahead of them

## Player Weapons And Progression Backlog

Jam-friendly weapon plan:

- Vibe Blaster: default fast projectile, low damage
- Prompt Bomb: area explosion, medium cooldown
- Refactor Beam: piercing beam, damages lines of enemies
- Merge Conflict Shield: temporary orbiting shield, damages monsters on contact

XP loop:

- Monsters drop vibe orbs
- Collect orbs to level up
- Every level, choose 1 of 3 upgrades

Upgrade pool:

- Fire rate
- Move speed
- Max health
- Projectile size
- Pierce
- Bomb radius
- Shield duration

## Phaser Note

This project currently uses React plus HTML canvas, not Phaser. If the project later moves to Phaser, use the same frame ranges:

- idle: frames 0-3
- chase: frames 4-7
- attack: frames 8-11
- death: frames 12-15

Keep gameplay web-accessible with no login and no heavy loading screens. The Vibe Jam widget is loaded from `index.html`.
