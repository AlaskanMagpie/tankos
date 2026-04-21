import * as THREE from 'three';

export class AdaptivePerformance {
  private frameTimes: number[] = [];
  private readonly maxSamples = 45;
  private readonly mobileTargetMs = 1000 / 120;

  public constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly hud: HTMLElement,
  ) {}

  public update(
    dtMs: number,
    dynamicUnits: number,
    quality: string,
    enemiesAlive: number,
    playerHp: number,
    enemiesInPursuit: number,
    weaponHeat: number,
    missileReadyIn: number,
    scrap: number,
    allies: number,
    buildMode: string,
  ): void {
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length > this.maxSamples) this.frameTimes.shift();

    const avgMs = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / Math.max(avgMs, 0.001);

    const currentDpr = this.renderer.getPixelRatio();
    if (quality === 'auto') {
      if (avgMs > this.mobileTargetMs * 1.22 && currentDpr > 0.65) {
        this.renderer.setPixelRatio(Math.max(0.65, currentDpr - 0.05));
      } else if (avgMs < this.mobileTargetMs * 0.82 && currentDpr < 1.5) {
        this.renderer.setPixelRatio(Math.min(1.5, currentDpr + 0.025));
      }
    }

    this.hud.textContent = [
      `FPS: ${fps.toFixed(1)}`,
      `Frame: ${avgMs.toFixed(2)} ms`,
      `DPR: ${this.renderer.getPixelRatio().toFixed(2)}`,
      `Units: ${dynamicUnits}`,
      `Enemies: ${enemiesAlive}`,
      `Allies: ${allies}`,
      `Pursuing: ${enemiesInPursuit}`,
      `Hull: ${playerHp.toFixed(0)}%`,
      `Scrap: ${Math.floor(scrap)}`,
      `Build: ${buildMode}`,
      `Heat: ${weaponHeat.toFixed(0)}%`,
      `Missile: ${missileReadyIn <= 0 ? 'READY' : `${missileReadyIn.toFixed(1)}s`}`,
      `Quality: ${quality.toUpperCase()}`,
      'WASD move · Space fire · Shift missile · B build · R rally · Q ping'
    ].join('\n');
  }
}
