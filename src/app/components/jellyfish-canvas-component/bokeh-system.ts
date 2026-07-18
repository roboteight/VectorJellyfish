import { BokehLayerConfig, BokehParticle, Point } from './jellyfish.models';

// The background depth-of-field field: several back-to-front layers of soft
// glowing circles that drift, parallax against the cursor, and occasionally
// pop (on click, or once every ~30s at random) before respawning elsewhere.
export class BokehSystem {
  // Back-to-front depth layers: farther layers have smaller/dimmer/more numerous
  // particles and shift less with the mouse; nearer layers shift more, which is
  // what sells the parallax depth illusion. The closest layer gets a subtle
  // outline, like the rim definition real out-of-focus bokeh circles show
  // when they're nearer the focal plane than the deep background blur.
  private readonly layers: BokehLayerConfig[] = [
    { count: 42, radiusRange: [4, 9], opacityRange: [0.02, 0.04], parallaxRange: 4, bobAmount: 3, driftSpeedScale: 0.35 },
    { count: 30, radiusRange: [8, 16], opacityRange: [0.04, 0.08], parallaxRange: 10, bobAmount: 5, driftSpeedScale: 0.5 },
    { count: 20, radiusRange: [14, 26], opacityRange: [0.06, 0.11], parallaxRange: 26, bobAmount: 9, driftSpeedScale: 0.75 },
    { count: 12, radiusRange: [22, 40], opacityRange: [0.08, 0.15], parallaxRange: 48, bobAmount: 15, driftSpeedScale: 1 },
    { count: 8, radiusRange: [32, 58], opacityRange: [0.1, 0.18], parallaxRange: 75, bobAmount: 22, driftSpeedScale: 1.3, outline: true }
  ];
  private readonly colors = ['0, 240, 255', '168, 85, 247', '236, 72, 153'];

  private particles: BokehParticle[] = [];
  private cycle = 0;
  private parallax: Point = { x: 0, y: 0 };
  private ambientPopTimer = 0;

  // Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  // particleDensity is structural: call init() again after changing it.
  parallaxStrength = 1;
  particleDensity = 1;
  ambientPopIntervalFrames = 1800; // ~30s at 60fps: one random ambient pop

  init(): void {
    this.particles = [];
    this.layers.forEach((layer, layerIndex) => {
      const count = Math.max(0, Math.round(layer.count * this.particleDensity));
      for (let i = 0; i < count; i++) {
        this.particles.push(this.spawnParticle(layerIndex));
      }
    });
  }

  // Pops the particle closest to (x, y), if the click landed on one.
  handleClick(x: number, y: number): void {
    let closest: BokehParticle | null = null;
    let closestDist = Infinity;

    this.particles.forEach(p => {
      if (p.popping) return;
      const dx = p.screenX - x;
      const dy = p.screenY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = Math.max(p.screenRadius * 0.9, 10);

      if (dist <= hitRadius && dist < closestDist) {
        closest = p;
        closestDist = dist;
      }
    });

    if (closest !== null) {
      const p: BokehParticle = closest;
      p.popping = true;
      p.popProgress = 0;
    }
  }

  update(canvasWidth: number, canvasHeight: number, mouseTarget: Point): void {
    this.cycle += 0.006;

    // Smoothed rather than snapped straight to the cursor, so the depth
    // layers drift softly instead of jittering with every mouse tick
    const targetX = (mouseTarget.x - canvasWidth / 2) / (canvasWidth / 2);
    const targetY = (mouseTarget.y - canvasHeight / 2) / (canvasHeight / 2);
    this.parallax.x += (targetX - this.parallax.x) * 0.04;
    this.parallax.y += (targetY - this.parallax.y) * 0.04;

    const popSpeed = 0.07;

    // Ambient popping: once every ~30s, pop a single random particle rather
    // than each particle having its own independent lifespan -- keeps the
    // random pops rare and system-wide instead of a constant flurry.
    this.ambientPopTimer++;
    if (this.ambientPopTimer >= this.ambientPopIntervalFrames) {
      this.ambientPopTimer = 0;
      const candidates = this.particles.filter(p => !p.popping);
      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        chosen.popping = true;
        chosen.popProgress = 0;
      }
    }

    this.particles.forEach(p => {
      if (p.popping) {
        p.popProgress += popSpeed;
        if (p.popProgress >= 1) {
          Object.assign(p, this.spawnParticle(p.layer));
        }
      }

      const layer = this.layers[p.layer];
      const bob = Math.sin(this.cycle * layer.driftSpeedScale + p.driftPhase) * layer.bobAmount;
      const parallaxRange = layer.parallaxRange * this.parallaxStrength;
      p.screenX = p.xFrac * canvasWidth + this.parallax.x * parallaxRange;
      p.screenY = p.yFrac * canvasHeight + bob + this.parallax.y * parallaxRange * 0.6;
      p.screenRadius = p.radius;
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    this.particles.forEach(p => {
      const layer = this.layers[p.layer];
      const x = p.screenX;
      const y = p.screenY;

      let radius = p.screenRadius;
      let opacity = p.opacity;

      if (p.popping) {
        // Quick ease-out expansion paired with a fade, like a bubble popping
        const easeOut = 1 - Math.pow(1 - p.popProgress, 2);
        radius = p.screenRadius * (1 + easeOut * 0.8);
        opacity = p.opacity * (1 - p.popProgress);
      }

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${p.color}, ${opacity})`);
      gradient.addColorStop(0.6, `rgba(${p.color}, ${opacity * 0.35})`);
      gradient.addColorStop(1, `rgba(${p.color}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Closest layer gets a subtle rim, like the crisper edge definition
      // real bokeh circles show when nearer the focal plane
      if (layer.outline && !p.popping) {
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.84, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${p.color}, ${Math.min(0.3, p.opacity * 2.2)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      if (p.popping) {
        // Expanding shockwave ring that fades out as it grows -- the "pop"
        const ringRadius = p.screenRadius * (1 + p.popProgress * 2.2);
        const ringAlpha = (1 - p.popProgress) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${p.color}, ${ringAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  // Builds a fresh particle for a layer -- used both for the initial fill
  // and to replace one that just finished popping.
  private spawnParticle(layerIndex: number): BokehParticle {
    const layer = this.layers[layerIndex];
    return {
      xFrac: Math.random(),
      yFrac: Math.random(),
      radius: layer.radiusRange[0] + Math.random() * (layer.radiusRange[1] - layer.radiusRange[0]),
      opacity: layer.opacityRange[0] + Math.random() * (layer.opacityRange[1] - layer.opacityRange[0]),
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      layer: layerIndex,
      driftPhase: Math.random() * Math.PI * 2,
      popping: false,
      popProgress: 0,
      screenX: 0,
      screenY: 0,
      screenRadius: 0
    };
  }
}
