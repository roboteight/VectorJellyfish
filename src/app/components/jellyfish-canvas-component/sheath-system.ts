import { Point } from './jellyfish.models';

// The long, narrow sheath that runs from the rim down over the tentacle
// bases and flares open like a trumpet bell at its tip. Rendered as a bundle
// of individual glowing strands (like the tentacles) rather than a filled
// membrane, and each point chases a current-driven target position with lag
// so the strands trail and ripple with inertia instead of snapping instantly.
export class SheathSystem {
  private jitter: number[] = [];
  private driftCycle = 0;
  private points: Point[][] = [];

  // Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  // strandCount is structural: call init() again after changing it.
  lengthFactor = 1.2; // ~1.5x the skirt's ~0.8r depth
  flareFactor = 1.8;

  constructor(
    private readonly segments = 30,
    public strandCount = 14
  ) {}

  init(baseRadius: number, pulseCycle: number): void {
    this.jitter = [];
    for (let i = 0; i <= this.segments; i++) {
      this.jitter.push(Math.random() * Math.PI * 2);
    }

    this.points = [];
    for (let k = 0; k < this.strandCount; k++) {
      const strand: Point[] = [];
      for (let i = 0; i <= this.segments; i++) {
        strand.push(this.target(baseRadius, pulseCycle, k, i));
      }
      this.points.push(strand);
    }
  }

  update(r: number, pulseCycle: number): void {
    this.driftCycle += 0.011;

    for (let k = 0; k < this.strandCount; k++) {
      const strand = this.points[k];
      for (let i = 0; i <= this.segments; i++) {
        const s = i / this.segments;
        const target = this.target(r, pulseCycle, k, i);

        // Points near the rim attachment snap to their target quickly; points
        // further down the flare lag more, like a tentacle tip trailing behind
        // its root. That increasing lag with depth is what gives the strands
        // floaty, fluid follow-through instead of an instantaneously computed curve.
        const springRate = 0.32 - 0.22 * s;
        const point = strand[i];
        point.x += (target.x - point.x) * springRate;
        point.y += (target.y - point.y) * springRate;
      }
    }
  }

  // Must be called within the jellyfish's translated+rotated ctx context.
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';

    this.points.forEach((strand, k) => {
      ctx.beginPath();
      ctx.moveTo(strand[0].x, strand[0].y);
      SheathSystem.tracePathSmooth(ctx, strand);

      const isInner = k % 2 === 0;
      ctx.strokeStyle = isInner ? 'rgba(0, 240, 255, 0.5)' : 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = isInner ? 1.6 : 1.1;
      ctx.stroke();
    });

    ctx.restore();
  }

  // The ideal, current-driven position for a sheath point -- what it's being
  // pulled toward. update() has each point chase this with lag rather than
  // snapping straight to it, which is what gives the strands inertia.
  private target(r: number, pulseCycle: number, k: number, i: number): Point {
    const ry = r * 0.25;
    const halfWidthTop = r * 0.4;
    const length = r * this.lengthFactor;
    const flareAmount = halfWidthTop * this.flareFactor;
    const maxSway = r * 0.3;
    const topAttachY = ry * 0.85;

    const widthFrac = this.strandCount === 1 ? 0 : -1 + (2 * k) / (this.strandCount - 1);
    const s = i / this.segments;
    const depthFactor = Math.pow(s, 1.3);

    // Layered, multi-frequency motion like a net drifting underwater: one wave
    // synced to the tentacle pulse so it still reads as "moving with" them, plus
    // two slower/faster independent currents at different wavelengths riding on
    // top, so the whole bundle ripples rather than swinging as one rigid whip.
    const swayPulse = Math.sin(pulseCycle - s * 3.2) * maxSway * 0.45;
    const swayCurrentA = Math.sin(this.driftCycle * 0.55 + s * 4.2) * maxSway * 0.4;
    const swayCurrentB = Math.sin(this.driftCycle * 1.35 - s * 7.5 + this.jitter[i] * 0.4) * maxSway * 0.25;
    const sway = (swayPulse + swayCurrentA + swayCurrentB) * depthFactor;

    // Gentle vertical billow, so it breathes lengthwise like a net swaying in a current
    const billow = Math.sin(this.driftCycle * 0.85 + s * 5.5 + widthFrac) * length * 0.02 * depthFactor;
    const y = topAttachY + s * length + billow;

    const widthBreath = 1 + Math.sin(this.driftCycle * 0.7 + s * 3.1) * 0.1;
    const taper = halfWidthTop * (1 - 0.3 * s);
    const flareT = Math.max(0, Math.min(1, (s - 0.72) / 0.28));
    const flare = flareAmount * flareT * flareT * (3 - 2 * flareT);
    const halfWidth = (taper + flare) * widthBreath;

    // Small per-strand wobble, like individual fibers rather than a rigid fan
    const strandWobble = Math.sin(pulseCycle * 1.4 - s * 4 + k * 1.7) * 1.2 * depthFactor;

    return { x: sway + widthFrac * halfWidth + strandWobble, y };
  }

  // Appends a smooth quadratic curve through points to the current path.
  // Assumes the path's current position is already at points[0] (via a prior
  // moveTo), and ends exactly at the last point.
  private static tracePathSmooth(ctx: CanvasRenderingContext2D, points: Point[]): void {
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
}
