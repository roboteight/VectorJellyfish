import { Point } from './jellyfish.models';

// The short, rippling frill hanging from the bell rim, over the tentacle roots.
export class SkirtSystem {
  private phaseOffsets: number[] = [];
  private cycle = 0;

  // Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  rippleAmpFactor = 0.12;
  swayAmpFactor = 0.04;

  constructor(private readonly segments = 36) {
    this.phaseOffsets = [];
    for (let i = 0; i <= this.segments; i++) {
      this.phaseOffsets.push(Math.random() * Math.PI * 2);
    }
  }

  update(): void {
    this.cycle += 0.015;
  }

  // Must be called within the jellyfish's translated+rotated ctx context.
  draw(ctx: CanvasRenderingContext2D, r: number): void {
    const ry = r * 0.25;
    const spanX = r * 0.78;
    const hangDepth = r * 0.55;
    const rippleAmp = r * this.rippleAmpFactor;
    const swayAmp = r * this.swayAmpFactor;

    const topPoints: Point[] = [];
    const bottomPoints: Point[] = [];

    for (let i = 0; i <= this.segments; i++) {
      const t = i / this.segments;
      const baseX = -spanX + t * spanX * 2;
      const pct = baseX / r;
      const depthZ = Math.sqrt(Math.max(0, 1 - pct * pct));
      const topY = depthZ * ry * 0.9;

      // Smooth traveling waves across the width, like a current moving through water
      const wave = Math.sin(this.cycle + t * Math.PI * 2.4) * rippleAmp
          + Math.sin(this.cycle * 1.5 - t * Math.PI * 3.6) * rippleAmp * 0.5;
      // subtle per-vertex jitter so it reads as organic rather than mechanical
      const jitter = Math.sin(this.cycle * 2 + this.phaseOffsets[i]) * rippleAmp * 0.15;
      const sway = Math.sin(this.cycle * 0.8 + t * Math.PI * 2 + this.phaseOffsets[i]) * swayAmp;

      const bottomY = topY + hangDepth * (0.55 + depthZ * 0.45) + wave + jitter;

      topPoints.push({ x: baseX, y: topY });
      bottomPoints.push({ x: baseX + sway, y: bottomY });
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';

    const gradient = ctx.createLinearGradient(0, 0, 0, hangDepth + rippleAmp);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.18)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.04)');

    ctx.beginPath();
    ctx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < topPoints.length; i++) {
      ctx.lineTo(topPoints[i].x, topPoints[i].y);
    }
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Fine tightly-grouped ripple strands tracing the rippling hem, like water
    ctx.lineWidth = 0.8;
    for (let strand = 0; strand < 3; strand++) {
      const depthLerp = 0.4 + strand * 0.3;
      ctx.beginPath();
      for (let i = 0; i < bottomPoints.length; i++) {
        const x = topPoints[i].x + (bottomPoints[i].x - topPoints[i].x) * depthLerp;
        const y = topPoints[i].y + (bottomPoints[i].y - topPoints[i].y) * depthLerp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = strand % 2 === 0
          ? 'rgba(0, 240, 255, 0.3)'
          : 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();
    }

    ctx.restore();
  }
}
