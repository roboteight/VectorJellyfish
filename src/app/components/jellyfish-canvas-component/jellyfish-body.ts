import { OrbSystem } from './orb-system';

// The bell shell itself: the back rim of the opening, and the translucent
// front shell with its isometric mesh, core glow, and (composed in) the
// bioluminescent orbs floating inside.
export class JellyfishBody {
  readonly orbs = new OrbSystem();

  init(): void {
    this.orbs.init();
  }

  // Must be called within the jellyfish's translated+rotated ctx context.
  drawOpeningBack(ctx: CanvasRenderingContext2D, r: number): void {
    const ry = r * 0.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, ry, 0, Math.PI, 0, false);
    ctx.fillStyle = 'rgba(5, 15, 35, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Must be called within the jellyfish's translated+rotated ctx context.
  drawShellFront(ctx: CanvasRenderingContext2D, r: number, pulseCycle: number): void {
    const ry = r * 0.25;

    // --- BASE TRANSLUCENT SHELL ---
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';

    const gradient = ctx.createLinearGradient(0, -r, 0, ry);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
    gradient.addColorStop(0.6, 'rgba(168, 85, 247, 0.3)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.1)');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0, false);
    ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // --- ISOMETRIC MESH: RINGS & MERIDIAN RIBS ---
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';

    // 1. Horizontal Isometric Rings (Parallel Lines)
    const ringLevels = [-0.4, -0.7];
    ringLevels.forEach((level, i) => {
      const ringY = r * level;
      const rx = Math.sqrt(r * r - ringY * ringY);
      const rRatio = rx * 0.25;

      ctx.beginPath();
      ctx.ellipse(0, ringY, rx, rRatio, 0, 0, Math.PI, false);
      ctx.strokeStyle = i === 0 ? 'rgba(168, 85, 247, 0.7)' : 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // 2. Vertical Meridian Ribs (Longitudinal Arcs)
    // We space 5 longitudinal curves across the front face (-0.8 to +0.8 of radius X)
    const meridianOffsets = [-0.75, -0.4, 0, 0.4, 0.75];

    meridianOffsets.forEach((offsetXFactor) => {
      const bottomX = r * offsetXFactor;

      // Calculate depth offset to map onto the bottom rim's 3D isometric perspective
      const pct = bottomX / r;
      const depthZ = Math.sqrt(Math.max(0, 1 - pct * pct));
      const bottomY = depthZ * ry;

      ctx.beginPath();
      // Start at top dome apex (0, -r)
      ctx.moveTo(0, -r);

      // Quadratic curve bending out toward spherical surface margin
      // Control point scales dynamically to preserve rounded 3D volume profile
      const controlX = bottomX * 1.25;
      const controlY = -r * 0.45;

      ctx.quadraticCurveTo(controlX, controlY, bottomX, bottomY);

      ctx.strokeStyle = Math.abs(offsetXFactor) === 0
          ? 'rgba(255, 255, 255, 0.7)'   // Center meridian line highlighted bright white
          : 'rgba(0, 240, 255, 0.45)';  // Side meridians cyan
      ctx.lineWidth = Math.abs(offsetXFactor) === 0 ? 1.5 : 1.0;
      ctx.stroke();
    });

    // 3. Floating Internal Organ / Core
    const corePulse = Math.sin(pulseCycle * 1.5) * 3;
    const coreXRadius = r * 0.28 + corePulse * 0.3;
    const coreYRadius = r * 0.45 + corePulse;

    const coreGradient = ctx.createRadialGradient(0, -r * 0.2, 2, 0, -r * 0.2, coreYRadius);
    coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    coreGradient.addColorStop(0.3, 'rgba(0, 240, 255, 0.7)');
    coreGradient.addColorStop(0.8, 'rgba(236, 72, 153, 0.2)');
    coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.2, coreXRadius, coreYRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3b. Floating Glowing Orbs (bioluminescent particles inside the bell)
    this.orbs.draw(ctx, r, ry);

    // 4. Outer Bottom Rim Highlight Line
    ctx.beginPath();
    ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI, false);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}
