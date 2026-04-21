import * as THREE from 'three';

type Projectile = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  active: boolean;
  life: number;
};

export class ProjectilePool {
  private readonly projectiles: Projectile[] = [];

  public constructor(private readonly scene: THREE.Scene, size: number) {
    const geo = new THREE.SphereGeometry(0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe29a });
    for (let i = 0; i < size; i += 1) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        mesh,
        velocity: new THREE.Vector3(),
        active: false,
        life: 0,
      });
    }
  }

  public fire(origin: THREE.Vector3, dir: THREE.Vector3, speed: number): void {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    slot.active = true;
    slot.life = 1.6;
    slot.mesh.visible = true;
    slot.mesh.position.copy(origin);
    slot.velocity.copy(dir).multiplyScalar(speed);
  }

  public update(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.addScaledVector(p.velocity, dt);
    }
  }

  public forEachActive(fn: (p: Projectile) => void): void {
    for (const p of this.projectiles) {
      if (p.active) fn(p);
    }
  }

  public deactivate(projectile: Projectile): void {
    projectile.active = false;
    projectile.mesh.visible = false;
  }
}
