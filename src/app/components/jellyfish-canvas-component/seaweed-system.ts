interface SeaweedPlant {
  rootXFrac: number;
  phase: number;
  color: string;
  pushOffset: number;
}

/*A bed of fractally-branching seaweed rooted along the bottom of the
screen. Each plant is drawn by recursive self-similar branching (the
"fractal pattern"), grows in from nothing once on init, sways
continuously, and bends away from the cursor when it passes near.*/
export class SeaweedSystem {
  private plants: SeaweedPlant[] = [];
  private cycle = 0;
  private growth = 0;

 /* Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  plantCount is structural: call init() again after changing it.*/
  plantCount = 9;
  branchDepth = 6;
  baseLength = 60;
  swayAmplitude = 0.35;
  swaySpeed = 0.02;
  mouseInfluence = 140;

  private readonly colors = ['46, 204, 154', '32, 178, 170', '72, 220, 180'];

  init(): void {
    this.plants = [];
    for (let i = 0; i < this.plantCount; i++) {
      this.plants.push({
        rootXFrac: (i + 0.5) / this.plantCount + (Math.random() * 0.06 - 0.03),
        phase: Math.random() * Math.PI * 2,
        color: this.colors[i % this.colors.length],
        pushOffset: 0
      });
    }
    this.growth = 0;
  }

  update(mouseX: number, canvasWidth: number): void {
    this.cycle += this.swaySpeed;
    this.growth += (1 - this.growth) * 0.008;

    this.plants.forEach(plant => {
      const rootX = plant.rootXFrac * canvasWidth;
      const dx = rootX - mouseX;
      const targetPush = Math.abs(dx) < this.mouseInfluence
          ? Math.sign(dx || 1) * (1 - Math.abs(dx) / this.mouseInfluence)
          : 0;
      plant.pushOffset += (targetPush - plant.pushOffset) * 0.06;
    });
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    ctx.save();
    ctx.lineCap = 'round';

    this.plants.forEach(plant => {
      const rootX = plant.rootXFrac * canvasWidth;
      this.drawBranch(ctx, rootX, canvasHeight, 0, this.baseLength * this.growth, this.branchDepth, plant);
    });

    ctx.restore();
  }

  private drawBranch(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      length: number,
      depth: number,
      plant: SeaweedPlant
  ): void {
    if (depth <= 0 || length < 3) return;

    const depthFromRoot = this.branchDepth - depth;
    const swayAmp = this.swayAmplitude * (0.3 + depthFromRoot * 0.18);
    const sway = Math.sin(this.cycle + plant.phase + depthFromRoot * 0.6) * swayAmp;
    const bend = plant.pushOffset * 0.5 * (0.3 + depthFromRoot * 0.2);

    const branchAngle = angle + sway + bend;
    const endX = x + Math.sin(branchAngle) * length;
    const endY = y - Math.cos(branchAngle) * length;

    const alpha = 0.2 + (depthFromRoot / this.branchDepth) * 0.55;
    ctx.strokeStyle = `rgba(${plant.color}, ${alpha})`;
    ctx.lineWidth = Math.max(0.6, depth * 0.6);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

/*
    Main continuation, tapering as it climbs
*/
    this.drawBranch(ctx, endX, endY, branchAngle, length * 0.8, depth - 1, plant);

/*
    Paired side leaflets every other level, for a fern/kelp-frond silhouette
*/
    if (depth % 2 === 0 && depth < this.branchDepth) {
      this.drawBranch(ctx, endX, endY, branchAngle + 0.5, length * 0.5, depth - 2, plant);
      this.drawBranch(ctx, endX, endY, branchAngle - 0.5, length * 0.5, depth - 2, plant);
    }
  }
}
