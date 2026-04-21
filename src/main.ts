import './styles.css';
import * as THREE from 'three';
import { terrainFragmentShader, terrainVertexShader } from './shaders/terrain';
import { skyFragmentShader, skyVertexShader } from './shaders/sky';
import { AdaptivePerformance } from './systems/perf';
import { ProjectilePool } from './systems/projectiles';

const hudEl = document.getElementById('hud');
const statusEl = document.getElementById('status');
const minimapEl = document.getElementById('minimap') as HTMLCanvasElement | null;
if (!hudEl || !statusEl || !minimapEl) throw new Error('Missing HUD elements');
const minimapCtx = minimapEl.getContext('2d');
if (!minimapCtx) throw new Error('Missing minimap context');

const quality = new URLSearchParams(window.location.search).get('quality') ?? 'auto';

type EnemyState = 'patrol' | 'pursue' | 'retreat';
type MatchState = 'running' | 'victory' | 'defeat';
type BuildMode = 'off' | 'refinery' | 'factory';
type Missile = { mesh: THREE.Mesh; velocity: THREE.Vector3; active: boolean; life: number; target: number };
type Structure = { type: 'refinery' | 'factory'; position: THREE.Vector3; timer: number; mesh: THREE.Mesh };
type Ally = { mesh: THREE.Mesh; active: boolean; velocity: THREE.Vector3; attackCooldown: number };
type Ping = { position: THREE.Vector3; ttl: number };

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2a1006, 0.01);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 9, 13);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
if (quality === 'low') renderer.setPixelRatio(0.8);
else if (quality === 'high') renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
else renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
document.body.appendChild(renderer.domElement);

const perf = new AdaptivePerformance(renderer, hudEl);
scene.add(new THREE.AmbientLight(0x5d3423, 0.55));
const sun = new THREE.DirectionalLight(0xffd4a5, 1.1);
sun.position.set(-28, 22, -18);
scene.add(sun);

scene.add(new THREE.Mesh(new THREE.SphereGeometry(280, 24, 20), new THREE.ShaderMaterial({
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  side: THREE.BackSide,
  depthWrite: false,
})));

const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360, 1, 1), new THREE.ShaderMaterial({
  vertexShader: terrainVertexShader,
  fragmentShader: terrainFragmentShader,
}));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const commandCore = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0x7a2e28 }));
commandCore.position.set(0, 0.9, 0);
scene.add(commandCore);
const objectiveRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.08, 12, 24), new THREE.MeshBasicMaterial({ color: 0xffca7a }));
objectiveRing.rotation.x = Math.PI / 2;
objectiveRing.position.set(0, 0.25, 0);
scene.add(objectiveRing);

const tank = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd7d7d2, roughness: 0.68, metalness: 0.24 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0xce3d1b, roughness: 0.55, metalness: 0.16 });
const glowMat = new THREE.MeshStandardMaterial({ color: 0xff9a2d, emissive: 0xff6a00, emissiveIntensity: 0.5, roughness: 0.2 });
const core = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 3.4), bodyMat);
core.position.y = 0.4;
const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.4, 4), accentMat);
nose.rotation.x = Math.PI / 2; nose.rotation.z = Math.PI / 4; nose.position.set(0, 0.26, -2.35);
const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 2.2), bodyMat);
leftWing.position.set(-1.35, 0.2, -0.4); leftWing.rotation.z = 0.22;
const rightWing = leftWing.clone(); rightWing.position.x = 1.35; rightWing.rotation.z = -0.22;
const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 1.25), new THREE.MeshStandardMaterial({ color: 0x3d5a6a, roughness: 0.25, metalness: 0.35 }));
canopy.position.set(0, 0.65, -0.45);
const turretBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.52), bodyMat); turretBase.position.set(0, 0.8, -0.1);
const cannon = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 1.4), accentMat); cannon.position.set(0, 0.8, -0.95);
const thrusterL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.55), glowMat); thrusterL.position.set(-0.45, 0.08, 1.45);
const thrusterR = thrusterL.clone(); thrusterR.position.x = 0.45;
tank.add(core, nose, leftWing, rightWing, canopy, turretBase, cannon, thrusterL, thrusterR);
tank.position.y = 0.65;
scene.add(tank);

const enemyCount = 32;
const enemies = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.55, 1.6), new THREE.MeshStandardMaterial({ color: 0x72403e, roughness: 0.86 }), enemyCount);
scene.add(enemies);

const enemyPos = Array.from({ length: enemyCount }, () => new THREE.Vector3());
const enemyBasePos = Array.from({ length: enemyCount }, () => new THREE.Vector3());
const enemyAlive = Array.from({ length: enemyCount }, () => false);
const enemyHealth = Array.from({ length: enemyCount }, () => 3);
const enemyState: EnemyState[] = Array.from({ length: enemyCount }, () => 'patrol');
const enemyEnabled = Array.from({ length: enemyCount }, () => false);

const match = { wave: 1, maxWaves: 4, state: 'running' as MatchState, betweenWaveTimer: 0 };
let playerHull = 100;
let damageCooldown = 0;
let weaponHeat = 0;
let scrap = 220;
let buildMode: BuildMode = 'off';
const rallyPoint = new THREE.Vector3(8, 0.55, 8);
const pings: Ping[] = [];

const tmp = new THREE.Object3D();
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const toPlayer = new THREE.Vector3();
for (let i = 0; i < enemyCount; i += 1) {
  const ring = 10 + Math.floor(i / 8) * 3.5;
  const ang = (i / enemyCount) * Math.PI * 2;
  enemyBasePos[i].set(Math.cos(ang) * ring, 0.55, Math.sin(ang) * ring);
  enemyPos[i].copy(enemyBasePos[i]);
  enemies.setMatrixAt(i, hiddenMatrix);
}
enemies.instanceMatrix.needsUpdate = true;

const structures: Structure[] = [];
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x3cff8f, transparent: true, opacity: 0.35 });
const buildGhost = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), ghostMat);
buildGhost.visible = false;
scene.add(buildGhost);

function getBuildPlacement(): THREE.Vector3 {
  const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(tank.quaternion);
  return tank.position.clone().addScaledVector(ahead, 5.5).setY(0.6);
}

function canPlaceStructure(type: 'refinery' | 'factory', pos: THREE.Vector3): boolean {
  const cost = type === 'refinery' ? 80 : 140;
  if (scrap < cost) return false;
  if (pos.length() > 70) return false;
  if (pos.distanceTo(tank.position) < 3.2) return false;
  if (pos.distanceTo(commandCore.position) < 6.5) return false;
  for (const s of structures) if (s.position.distanceTo(pos) < 3.8) return false;
  return true;
}

function placeStructure(type: 'refinery' | 'factory'): void {
  const pos = getBuildPlacement();
  if (!canPlaceStructure(type, pos)) return;
  const cost = type === 'refinery' ? 80 : 140;
  const mesh = type === 'refinery'
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x4a7378 }))
    : new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), new THREE.MeshStandardMaterial({ color: 0x736b5a }));
  mesh.position.copy(pos);
  scene.add(mesh);
  structures.push({ type, position: pos, timer: 0, mesh });
  scrap -= cost;
}

const allies: Ally[] = [];
for (let i = 0; i < 12; i += 1) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 1.4), new THREE.MeshStandardMaterial({ color: 0x6ac6d8, roughness: 0.7 }));
  mesh.visible = false;
  scene.add(mesh);
  allies.push({ mesh, active: false, velocity: new THREE.Vector3(), attackCooldown: 0 });
}
function spawnAlly(position: THREE.Vector3): void {
  const slot = allies.find((a) => !a.active);
  if (!slot) return;
  slot.active = true;
  slot.mesh.visible = true;
  slot.mesh.position.copy(position).setY(0.55);
  slot.velocity.set(0, 0, 0);
  slot.attackCooldown = 0;
}

const projectiles = new ProjectilePool(scene, 80);
let fireCooldown = 0;

const missileGeo = new THREE.ConeGeometry(0.12, 0.5, 8);
const missileMat = new THREE.MeshStandardMaterial({ color: 0xffd786, emissive: 0xff8c2b, emissiveIntensity: 0.45, roughness: 0.2 });
const missiles: Missile[] = [];
for (let i = 0; i < 12; i += 1) {
  const m = new THREE.Mesh(missileGeo, missileMat);
  m.visible = false;
  scene.add(m);
  missiles.push({ mesh: m, velocity: new THREE.Vector3(), active: false, life: 0, target: -1 });
}
let missileCooldown = 0;

function findLockTarget(origin: THREE.Vector3, maxDistSq: number): number {
  let best = -1; let bestDist = maxDistSq;
  for (let i = 0; i < enemyCount; i += 1) {
    if (!enemyEnabled[i] || !enemyAlive[i]) continue;
    const d = enemyPos[i].distanceToSquared(origin);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}
function fireMissile(): void {
  const target = findLockTarget(tank.position, 24 * 24);
  if (target < 0) return;
  const slot = missiles.find((m) => !m.active);
  if (!slot) return;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(tank.quaternion);
  const spawn = tank.position.clone().add(new THREE.Vector3(0.45, 0.55, -1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), tank.rotation.y));
  slot.active = true; slot.life = 2.8; slot.target = target; slot.mesh.visible = true; slot.mesh.position.copy(spawn); slot.velocity.copy(forward).multiplyScalar(14);
}

function startWave(wave: number): void {
  const waveSize = Math.min(enemyCount, 8 + wave * 6);
  for (let i = 0; i < enemyCount; i += 1) {
    if (i < waveSize) {
      enemyEnabled[i] = true; enemyAlive[i] = true; enemyHealth[i] = 2 + Math.floor(wave / 2); enemyState[i] = 'patrol'; enemyPos[i].copy(enemyBasePos[i]);
      tmp.position.copy(enemyPos[i]); tmp.rotation.y = Math.random() * Math.PI * 2; tmp.updateMatrix(); enemies.setMatrixAt(i, tmp.matrix);
    } else { enemyEnabled[i] = false; enemyAlive[i] = false; enemies.setMatrixAt(i, hiddenMatrix); }
  }
  enemies.instanceMatrix.needsUpdate = true;
}
startWave(match.wave);

const input = { forward: 0, turn: 0, fire: false, missile: false };
const onKey = (code: string, down: boolean): void => {
  if (match.state !== 'running') return;
  if (code === 'KeyW' || code === 'ArrowUp') input.forward = down ? 1 : 0;
  if (code === 'KeyS' || code === 'ArrowDown') input.forward = down ? -1 : 0;
  if (code === 'KeyA' || code === 'ArrowLeft') input.turn = down ? 1 : 0;
  if (code === 'KeyD' || code === 'ArrowRight') input.turn = down ? -1 : 0;
  if (code === 'Space') input.fire = down;
  if (code === 'ShiftLeft' || code === 'ShiftRight') input.missile = down;
  if (down && code === 'KeyB') buildMode = buildMode === 'off' ? 'refinery' : buildMode === 'refinery' ? 'factory' : 'off';
  if (down && code === 'KeyE' && buildMode !== 'off') placeStructure(buildMode);
  if (down && code === 'KeyR') rallyPoint.copy(tank.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(tank.quaternion).multiplyScalar(10));
  if (down && code === 'KeyQ') pings.push({ position: tank.position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(tank.quaternion).multiplyScalar(18)).setY(0.55), ttl: 8 });
};
window.addEventListener('keydown', (e) => onKey(e.code, true));
window.addEventListener('keyup', (e) => onKey(e.code, false));
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerdown', (e) => {
  if (match.state !== 'running') return;
  if (e.button === 2) { input.missile = true; return; }
  if (e.clientX > window.innerWidth * 0.5) input.fire = true;
});
window.addEventListener('pointerup', () => { input.fire = false; input.missile = false; input.forward = 0; input.turn = 0; });
window.addEventListener('pointermove', (e) => {
  if ((e.buttons & 1) === 0 || match.state !== 'running') return;
  if (e.clientX < window.innerWidth * 0.5) {
    const nx = (e.clientX / (window.innerWidth * 0.5)) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    input.turn = THREE.MathUtils.clamp(-nx, -1, 1); input.forward = THREE.MathUtils.clamp(-ny, -1, 1);
  }
});

const clock = new THREE.Clock();
const cameraOffset = new THREE.Vector3(0, 7, 10);
const tankForward = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);
const projectileSpawnOffset = new THREE.Vector3(0, 0.52, -1.95);
const worldRadius = 120;

function drawMinimap(aliveEnemies: number): void {
  minimapCtx.clearRect(0, 0, minimapEl.width, minimapEl.height);
  minimapCtx.fillStyle = 'rgba(17,22,30,0.88)';
  minimapCtx.fillRect(0, 0, minimapEl.width, minimapEl.height);
  minimapCtx.strokeStyle = 'rgba(180,220,255,0.4)';
  minimapCtx.strokeRect(1, 1, minimapEl.width - 2, minimapEl.height - 2);
  const toMap = (v: THREE.Vector3): [number, number] => [minimapEl.width * 0.5 + (v.x / worldRadius) * minimapEl.width * 0.45, minimapEl.height * 0.5 + (v.z / worldRadius) * minimapEl.height * 0.45];
  const dot = (v: THREE.Vector3, color: string, size = 3): void => {
    const [x, y] = toMap(v); minimapCtx.fillStyle = color; minimapCtx.beginPath(); minimapCtx.arc(x, y, size, 0, Math.PI * 2); minimapCtx.fill();
  };

  // fog-of-war mask
  minimapCtx.save();
  minimapCtx.fillStyle = 'rgba(0,0,0,0.55)';
  minimapCtx.fillRect(0, 0, minimapEl.width, minimapEl.height);
  minimapCtx.globalCompositeOperation = 'destination-out';
  const reveal = (v: THREE.Vector3, radius: number): void => {
    const [x, y] = toMap(v);
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, radius, 0, Math.PI * 2);
    minimapCtx.fill();
  };
  reveal(tank.position, 36);
  for (const ally of allies) if (ally.active) reveal(ally.mesh.position, 24);
  for (const ping of pings) reveal(ping.position, 20 + ping.ttl * 0.8);
  minimapCtx.restore();

  dot(new THREE.Vector3(), '#ffb06e', 4);
  dot(rallyPoint, '#ffe069', 3);
  dot(tank.position, '#83e6ff', 4);
  for (const ping of pings) {
    dot(ping.position, '#ffd45a', 4);
    const [x, y] = toMap(ping.position);
    minimapCtx.strokeStyle = 'rgba(255,212,90,0.8)';
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, 6 + Math.sin(performance.now() * 0.01) * 1.8, 0, Math.PI * 2);
    minimapCtx.stroke();
  }
  for (const ally of allies) if (ally.active) dot(ally.mesh.position, '#69ffda', 2.5);
  for (let i = 0; i < enemyCount; i += 1) if (enemyEnabled[i] && enemyAlive[i]) dot(enemyPos[i], '#ff6868', 2.5);
  minimapCtx.fillStyle = '#cde9ff';
  minimapCtx.font = '11px sans-serif';
  minimapCtx.fillText(`W${match.wave}/${match.maxWaves}  E:${aliveEnemies}  P:${pings.length}`, 8, 14);
}

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  fireCooldown -= dt; missileCooldown -= dt; damageCooldown -= dt; weaponHeat = Math.max(0, weaponHeat - dt * 13);
  for (let i = pings.length - 1; i >= 0; i -= 1) {
    pings[i].ttl -= dt;
    if (pings[i].ttl <= 0) pings.splice(i, 1);
  }

  if (match.state === 'running') {
    tank.rotation.y += input.turn * dt * 1.9;
    tankForward.set(0, 0, -1).applyQuaternion(tank.quaternion);
    tank.position.addScaledVector(tankForward, input.forward * dt * 7.8);
  }
  tank.position.y = 0.65 + Math.sin(performance.now() * 0.004) * 0.04;
  glowMat.emissiveIntensity = match.state === 'running' ? 0.35 + Math.max(0, input.forward) * 0.55 + Math.sin(performance.now() * 0.025) * 0.1 : 0.16;

  if (buildMode !== 'off') {
    const pos = getBuildPlacement();
    const valid = canPlaceStructure(buildMode, pos);
    buildGhost.visible = true;
    buildGhost.position.copy(pos);
    buildGhost.scale.setScalar(buildMode === 'refinery' ? 0.8 : 1.0);
    ghostMat.color.set(valid ? 0x3cff8f : 0xff4e4e);
  } else buildGhost.visible = false;

  for (const s of structures) {
    if (s.type === 'refinery') scrap += dt * 6;
    if (s.type === 'factory') {
      s.timer += dt;
      if (s.timer >= 8) { s.timer = 0; spawnAlly(s.position.clone().add(new THREE.Vector3(0, 0, 2.4))); }
    }
  }

  if (match.state === 'running' && input.fire && fireCooldown <= 0 && weaponHeat < 100) {
    projectiles.fire(tank.position.clone().add(projectileSpawnOffset.clone().applyAxisAngle(upAxis, tank.rotation.y)), tankForward, 35);
    fireCooldown = 0.12; weaponHeat = Math.min(100, weaponHeat + 11);
  }
  if (match.state === 'running' && input.missile && missileCooldown <= 0) { fireMissile(); missileCooldown = 2.8; input.missile = false; }

  const phase = performance.now() * 0.00045;
  let pursuingNow = 0;
  for (let i = 0; i < enemyCount; i += 1) {
    if (!enemyEnabled[i] || !enemyAlive[i]) continue;
    toPlayer.copy(tank.position).sub(enemyPos[i]);
    const distSq = toPlayer.lengthSq();
    if (enemyHealth[i] <= 1) enemyState[i] = 'retreat'; else if (distSq < 115) enemyState[i] = 'pursue'; else enemyState[i] = 'patrol';

    if (enemyState[i] === 'patrol') {
      const ring = 2.8 + (i % 6) * 0.28;
      const a = phase + i * 0.23;
      enemyPos[i].set(enemyBasePos[i].x + Math.cos(a) * ring, 0.55, enemyBasePos[i].z + Math.sin(a) * ring);
    } else if (enemyState[i] === 'pursue') {
      pursuingNow += 1;
      toPlayer.normalize(); enemyPos[i].addScaledVector(toPlayer, dt * 2.4);
    } else {
      const retreatDir = enemyPos[i].clone().sub(tank.position).normalize();
      enemyPos[i].addScaledVector(retreatDir, dt * 2.8); enemyPos[i].lerp(enemyBasePos[i], dt * 0.6);
    }
    tmp.position.copy(enemyPos[i]); tmp.rotation.y = Math.atan2(enemyPos[i].x - tank.position.x, enemyPos[i].z - tank.position.z); tmp.updateMatrix(); enemies.setMatrixAt(i, tmp.matrix);

    if (match.state === 'running' && distSq < 2.3 && damageCooldown <= 0) {
      playerHull = Math.max(0, playerHull - 3); damageCooldown = 0.4;
      if (playerHull <= 0) { match.state = 'defeat'; input.forward = 0; input.turn = 0; input.fire = false; }
    }
  }

  for (const ally of allies) {
    if (!ally.active) continue;
    ally.attackCooldown -= dt;
    const target = findLockTarget(ally.mesh.position, 22 * 22);
    const goal = target >= 0 ? enemyPos[target] : rallyPoint;
    const dir = goal.clone().sub(ally.mesh.position);
    const distSq = dir.lengthSq();
    if (distSq > 4) {
      dir.normalize();
      ally.velocity.lerp(dir.multiplyScalar(4.5), dt * 2.5);
      ally.mesh.position.addScaledVector(ally.velocity, dt);
      ally.mesh.position.y = 0.55 + Math.sin(performance.now() * 0.004 + ally.mesh.id) * 0.03;
      ally.mesh.lookAt(ally.mesh.position.clone().add(ally.velocity));
    }
    if (target >= 0 && distSq < 64 && ally.attackCooldown <= 0) {
      enemyHealth[target] -= 1;
      ally.attackCooldown = 0.55;
      if (enemyHealth[target] <= 0 && enemyAlive[target]) {
        enemyAlive[target] = false;
        enemies.setMatrixAt(target, hiddenMatrix);
        scrap += 18;
      }
    }
  }

  projectiles.update(dt);
  projectiles.forEachActive((p) => {
    for (let i = 0; i < enemyCount; i += 1) {
      if (!enemyEnabled[i] || !enemyAlive[i]) continue;
      if (p.mesh.position.distanceToSquared(enemyPos[i]) < 1.1) {
        enemyHealth[i] -= 1;
        projectiles.deactivate(p);
        if (enemyHealth[i] <= 0) { enemyAlive[i] = false; enemies.setMatrixAt(i, hiddenMatrix); scrap += 16; }
        break;
      }
    }
  });

  for (const missile of missiles) {
    if (!missile.active) continue;
    missile.life -= dt;
    if (missile.life <= 0 || missile.target < 0 || !enemyAlive[missile.target]) { missile.active = false; missile.mesh.visible = false; continue; }
    const desired = enemyPos[missile.target].clone().sub(missile.mesh.position).normalize().multiplyScalar(20);
    missile.velocity.lerp(desired, dt * 2.8);
    missile.mesh.position.addScaledVector(missile.velocity, dt);
    missile.mesh.lookAt(missile.mesh.position.clone().add(missile.velocity));
    if (missile.mesh.position.distanceToSquared(enemyPos[missile.target]) < 1.7) {
      enemyHealth[missile.target] -= 3;
      if (enemyHealth[missile.target] <= 0) { enemyAlive[missile.target] = false; enemies.setMatrixAt(missile.target, hiddenMatrix); scrap += 18; }
      missile.active = false; missile.mesh.visible = false;
    }
  }

  enemies.instanceMatrix.needsUpdate = true;
  const alive = enemyAlive.reduce((sum, v, i) => sum + (v && enemyEnabled[i] ? 1 : 0), 0);

  if (match.state === 'running' && alive === 0) {
    if (match.wave >= match.maxWaves) match.state = 'victory';
    else if (match.betweenWaveTimer <= 0) match.betweenWaveTimer = 2.5;
  }
  if (match.state === 'running' && match.betweenWaveTimer > 0) {
    match.betweenWaveTimer -= dt;
    if (match.betweenWaveTimer <= 0) { match.wave += 1; startWave(match.wave); }
  }

  const desiredCam = tank.position.clone().add(cameraOffset.clone().applyAxisAngle(upAxis, tank.rotation.y));
  camera.position.lerp(desiredCam, 1 - Math.pow(0.0001, dt));
  camera.lookAt(tank.position.x, tank.position.y + 1, tank.position.z);

  const objDist = tank.position.distanceTo(new THREE.Vector3());
  if (match.state === 'running') {
    statusEl.textContent = `Wave: ${match.wave}/${match.maxWaves}\nObjective: Hold zone + destroy hostiles\nCore Dist: ${objDist.toFixed(1)}m\nPing: Q to mark target${match.betweenWaveTimer > 0 ? `\nNext wave in: ${match.betweenWaveTimer.toFixed(1)}s` : ''}`;
  } else if (match.state === 'victory') statusEl.textContent = `Mission Complete\nAll ${match.maxWaves} waves neutralized`;
  else statusEl.textContent = 'Mission Failed\nHover tank destroyed';

  drawMinimap(alive);
  renderer.render(scene, camera);
  const allyActive = allies.reduce((sum, a) => sum + (a.active ? 1 : 0), 0);
  perf.update(dt * 1000, alive + allyActive + 1, quality, alive, playerHull, pursuingNow, weaponHeat, Math.max(0, missileCooldown), scrap, allyActive, buildMode);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
