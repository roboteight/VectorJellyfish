import { GlowOrb, Point } from './jellyfish.models';

/*Bioluminescent orbs floating inside the bell. They drift and pulse on their
own, and scatter away from (and glow brighter near) the cursor.*/
export class OrbSystem {
  private orbs: GlowOrb[] = [];

/*  Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  count is structural: call init() again after changing it.*/
  influenceRadiusFactor = 3;

  constructor(public count = 7) {}

  init(): void {
    const colors = ['0, 240, 255', '168, 85, 247', '236, 72, 153', '255, 255, 255'];
    this.orbs = [];
    for (let i = 0; i < this.count; i++) {
      this.orbs.push({
        xFactor: (Math.random() * 2 - 1) * 0.55,
        yFactor: -0.15 + (Math.random() * 2 - 1) * 0.55,
        pushXFactor: 0,
        pushYFactor: 0,
        proximity: 0,
        driftPhase: Math.random() * Math.PI * 2,
        driftSpeed: 0.006 + Math.random() * 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.025,
        size: 2.5 + Math.random() * 3.5,
        color: colors[i % colors.length]
      });
    }
  }

/*  mouseTarget/pos/rotation are in world space; proximity is measured in the
  jellyfish's local (unrotated) coordinate frame since that's where the orbs live.*/
  update(pos: Point, rotation: number, mouseTarget: Point, r: number): void {
    const dxWorld = mouseTarget.x - pos.x;
    const dyWorld = mouseTarget.y - pos.y;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const localMouseX = dxWorld * cos + dyWorld * sin;
    const localMouseY = -dxWorld * sin + dyWorld * cos;

    const influenceRadius = r * this.influenceRadiusFactor;
    const maxPush = 0.9;

    this.orbs.forEach(orb => {
      orb.driftPhase += orb.driftSpeed;
      orb.pulsePhase += orb.pulseSpeed;

      const homeX = orb.xFactor * r * 0.75;
      const homeY = orb.yFactor * r;
      const dx = homeX - localMouseX;
      const dy = homeY - localMouseY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

      if (dist < influenceRadius) {
        const strength = 1 - dist / influenceRadius;
        const pushTargetX = (dx / dist) * strength * maxPush;
        const pushTargetY = (dy / dist) * strength * maxPush;

        orb.pushXFactor += (pushTargetX - orb.pushXFactor) * 0.2;
        orb.pushYFactor += (pushTargetY - orb.pushYFactor) * 0.2;
        orb.proximity += (strength - orb.proximity) * 0.2;
      } else {
        orb.pushXFactor *= 0.9;
        orb.pushYFactor *= 0.9;
        orb.proximity *= 0.9;
      }
    });
  }

/*  Must be called within the jellyfish's translated+rotated ctx context; clips
  to the bell interior so orbs never poke outside the shell.*/
  draw(ctx: CanvasRenderingContext2D, r: number, ry: number): void {
    ctx.save();

    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0, false);
    ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.clip();

    this.orbs.forEach(orb => {
      const driftX = Math.sin(orb.driftPhase) * r * 0.1;
      const driftY = Math.cos(orb.driftPhase * 1.3) * ry * 0.35;

      const x = (orb.xFactor + orb.pushXFactor) * r * 0.75 + driftX;
      const y = (orb.yFactor + orb.pushYFactor) * r + driftY;

      const pulse = 0.5 + Math.sin(orb.pulsePhase) * 0.5;
      const excite = 1 + orb.proximity * 1.2;
      const radius = orb.size * (0.6 + pulse * 0.7) * excite;

      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, `rgba(${orb.color}, ${Math.min(1, 0.9 + orb.proximity * 0.3)})`);
      glow.addColorStop(0.4, `rgba(${orb.color}, ${Math.min(1, 0.2 + pulse * 0.3 + orb.proximity * 0.4)})`);
      glow.addColorStop(1, `rgba(${orb.color}, 0)`);

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, 0.6 + pulse * 0.4 + orb.proximity * 0.4)})`;
      ctx.fill();
    });

    ctx.restore();
  }
}
