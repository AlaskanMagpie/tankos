# Tankos

A third-person, low-poly **hover tank combat** game inspired by *Warzone*, *BattleTanx*, and the sci-fi battlefield mood of *Battlezone*.

You pilot a hovertank across contested zones, destroy enemy armor, capture resource points, and build a forward operating base that can produce AI-controlled support tanks.

## Target platform + rendering stack
- **Engine/runtime**: Browser game built with **Three.js**
- **Graphics API**: **WebGL 2** first, WebGL 1 fallback where possible
- **Shaders**: Custom **GLSL** materials for terrain, sky, and effects
- **Performance target**:
  - **120 FPS on capable mobile devices** (adaptive quality required)
  - Stable 60+ FPS minimum on mid-tier mobile
  - Playable on PC browsers with higher quality presets

## Local development
```bash
npm install
npm run dev
```

## Prototype controls
- Keyboard: `WASD` / Arrow keys move, `Space` cannon, `Shift` missile
- Build/command: `B` cycle build mode, `E` place building, `R` set ally rally point, `Q` ping objective
- Pointer/touch:
  - Hold/drag on the **left half** for movement + turning
  - Press on the **right half** to fire

## Implemented prototype features
- Battlezone-style orange desert atmosphere via custom GLSL terrain + sky gradients
- Angular hovercraft silhouette with glowing thrusters and hovering idle motion
- Instanced enemy tanks for low draw-call pressure
- State-driven enemy AI (patrol, pursue, retreat)
- Projectile cannon + lock-on homing missile weapon
- **Upgrade 1:** Build mode with placeable refinery/factory structures
- **Upgrade 2:** Resource economy (`scrap`) with refinery income and combat rewards
- **Upgrade 3:** Factory-spawned allied AI tanks with rally point command and ranged firing
- **Upgrade 4:** Minimap with player/allies/enemies/rally/objective markers
- **Upgrade 5:** Minimap fog-of-war + tactical objective pings
- Mission status panel with wave progression + victory/defeat states
- Adaptive pixel ratio scaling and detailed HUD telemetry
- Quality overrides with query string: `?quality=low|auto|high`

## Next upgrades
1. Add terrain-aware build placement (slope checks + surface tagging).
2. Add compressed textures (KTX2) and mesh LOD pipeline.
3. Add mission scripting with objective variants (escort/defense/assault).
4. Add co-op sync prototype for 2-player skirmish tests.
5. Add saveable loadouts and commander tech upgrades.
6. Add AI commander personalities for enemy factions.

## Current state
The repository includes a runnable Three.js prototype and a broader game design roadmap.

See [`docs/game-design.md`](docs/game-design.md) for full design details.
