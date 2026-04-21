# Game Design Draft — Tankos (Three.js / WebGL / GLSL)

## 1) High concept
A 3rd-person low-poly hovertank shooter where players fight enemy armor while constructing battlefield structures that unlock AI tank reinforcements. Visual direction leans into a Battlezone-like orange alien battlefield mood while keeping original gameplay systems.

## 2) Non-negotiable technical constraints
1. Must run on **Three.js** in the browser.
2. Must render via **WebGL** (WebGL2 preferred).
3. Must use **GLSL shaders** for core visual style and performance control.
4. Must target **120 FPS on mobile devices that can sustain it**, with adaptive fallback.
5. Must remain playable on PC browsers with scalable quality settings.

## 3) Pillars
1. **Arcade hover combat**: responsive movement, readable projectiles, impactful explosions.
2. **Battlefield economy**: secure and spend resources under pressure.
3. **Force multiplication**: build structures that unlock stronger AI tank waves.
4. **Short, replayable matches**: 10–20 minute skirmishes with varied map objectives.

## 4) Core loop
1. Scout and engage enemy patrols.
2. Capture/hold resource nodes.
3. Spend resources to place structures.
4. Unlock and spawn allied AI tanks.
5. Push enemy base and destroy command core.

## 5) Player tank (hover)
- **Movement**: strafe, boost dash, drift turn, terrain hover smoothing.
- **Weapons**:
  - Primary cannon (medium cooldown, direct fire)
  - Secondary missiles (lock-on burst)
  - Utility slot (EMP pulse, smoke, repair drone)
- **Stats**: armor, shield regen, speed, energy.

## 6) Enemy factions
- **Raider armor**: fast, fragile flanker tanks.
- **Siege armor**: slow, high-damage artillery tanks.
- **Command tanks**: elite units with aura buffs.

## 7) Building system
### Placeable structures
- **Refinery**: passive income near resource nodes.
- **Factory**: produces basic AI tanks.
- **Advanced factory**: produces heavy/support AI tanks.
- **Repair bay**: heals player and nearby allies.
- **Turret node**: static area defense.

### Rules
- Build radius tied to owned zones.
- Energy cap limits number of structures.
- Structures can be upgraded once.

## 8) AI tank production
- Queue-based spawning at factories.
- Simple compositions (e.g., 2 scouts + 1 bruiser).
- Rally point system for attack/defend behavior.
- Population cap to preserve performance and readability.

## 9) Match flow
- **Early game**: light skirmishes, capture nodes, first refinery.
- **Mid game**: multi-front engagements, factory unlocks.
- **Late game**: heavy armor pushes and base sieges.

## 10) Performance budget for 120 FPS mobile
### Frame-time targets
- 120 FPS budget: **8.33 ms** total frame time.
- Suggested split:
  - CPU simulation + game logic: 2.5–3.0 ms
  - Render submission + culling: 1.5–2.0 ms
  - GPU shading + postprocess: 2.5–3.0 ms
  - Margin/spikes: 0.5–1.0 ms

### Scene budget (starting targets)
- Visible dynamic tanks: 20–40
- Triangles on screen: 150k–300k mobile; higher on PC preset
- Draw calls: <150 mobile target (instancing strongly preferred)
- Shadow casters: tightly limited; one main directional shadow map
- Texture memory: compressed textures (KTX2/Basis), capped atlas sizes

### Required optimization strategy
- Aggressive **LOD** and distance-based update throttling
- **InstancedMesh** for repeated props/projectiles
- Object pooling for bullets, VFX, and transient entities
- Fixed timestep simulation with interpolation
- Frustum + distance culling for units and effects
- Adaptive quality scaling (resolution scale, shadow quality, VFX density)

## 11) Three.js/WebGL architecture
### Core stack
- Three.js scene graph and renderer
- WebGL2 feature path, graceful fallback path where needed
- GLSL shader modules for:
  - Terrain material with simple stylized lighting
  - Tank hull shader (team color masks + damage glow)
  - Projectile/trail shader
  - Shield hit and EMP distortion effects

### Rendering approach
- Forward rendering baseline with minimal post FX
- Optional lightweight post pass (tone mapping + subtle bloom on high tier)
- Shader variants kept minimal to reduce compilation stalls
- Runtime material switches avoided during combat

### Gameplay systems (browser-first)
- ECS-style or data-oriented update loops for predictable performance
- Navigation simplified for tank AI (grid/flow field over heavy navmesh where possible)
- Deterministic-ish match manager for reliable replays and sync potential

## 12) MVP scope (first playable)
### Must-have
- One map
- Player hovertank movement and shooting
- Two enemy tank types
- Resource node capture
- Refinery + factory structures
- AI tank spawn from player factory
- Win/loss conditions
- Mobile quality tiers with auto-scaling enabled

### Nice-to-have
- Co-op mode
- Procedural map variants
- Tech tree with specialized doctrines
- Weather or hazard events

## 13) Milestone roadmap
1. **Prototype (2–4 weeks)**
   - Three.js bootstrap, input, camera rig
   - Hovertank controller + one weapon
   - Basic enemy AI chase/attack
2. **Vertical slice (4–8 weeks)**
   - Economy + node capture
   - Building placement
   - Allied AI spawn loop
   - First mobile performance pass
3. **Pre-alpha (8–12 weeks)**
   - Expanded unit roster
   - UI/UX pass
   - Shader polish + optimization pass
   - Device matrix validation (mobile + PC browsers)

## 14) Immediate next tasks
1. Scaffold Three.js project (Vite + TypeScript recommended).
2. Implement hovertank controller in a test map with touch + keyboard/gamepad support.
3. Add projectile combat, hit detection, and pooled VFX.
4. Prototype one structure (factory) with timed AI tank spawn.
5. Build an adaptive graphics settings system targeting 120 FPS capable devices.
6. Add telemetry HUD (FPS, frame time, draw calls, visible units) for ongoing optimization.
