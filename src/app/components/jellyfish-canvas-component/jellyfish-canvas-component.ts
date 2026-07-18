import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface Point {
  x: number;
  y: number;
}

interface TentacleNode {
  x: number;
  y: number;
}

interface BokehParticle {
  xFrac: number;
  yFrac: number;
  radius: number;
  opacity: number;
  color: string;
  layer: number;
  driftPhase: number;
  popping: boolean;
  popProgress: number;
  screenX: number;
  screenY: number;
  screenRadius: number;
}

interface BokehLayerConfig {
  count: number;
  radiusRange: [number, number];
  opacityRange: [number, number];
  parallaxRange: number;
  bobAmount: number;
  driftSpeedScale: number;
  outline?: boolean;
}

interface GlowOrb {
  xFactor: number;
  yFactor: number;
  pushXFactor: number;
  pushYFactor: number;
  proximity: number;
  driftPhase: number;
  driftSpeed: number;
  pulsePhase: number;
  pulseSpeed: number;
  size: number;
  color: string;
}

@Component({
  selector: 'app-jellyfish-canvas',
  standalone: true,
  template: `
    <div class="canvas-container">
      <canvas #jellyfishCanvas></canvas>
    </div>
  `,
  styles: [`
    .canvas-container {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: radial-gradient(circle at center, #0a192f 0%, #020c1b 100%);
      margin: 0;
    }
    canvas {
      display: block;
    }
  `]
})
export class JellyfishCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('jellyfishCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private isBrowser: boolean;

  private target: Point = { x: 400, y: 300 };
  private pos: Point = { x: 400, y: 300 };
  private rotation: number = 0;
  private pulseCycle: number = 0;
  private chaseSpeed = 0.03;

  private readonly idleDartDelayMs = 5000;
  private lastActivityTime = 0;
  private isDarting = false;
  private dartTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private baseRadius = 50;
  private tentacleCount = 24;
  private nodesPerTentacle = 30;
  private nodeDistance = 25;
  private tentacles: TentacleNode[][] = [];

  private orbCount = 7;
  private orbs: GlowOrb[] = [];

  private skirtSegments = 36;
  private skirtPhaseOffsets: number[] = [];
  private skirtCycle = 0;

  private sheathSegments = 30;
  private sheathStrandCount = 14;
  private sheathJitter: number[] = [];
  private sheathDriftCycle = 0;
  private sheathPoints: Point[][] = [];

  // Back-to-front depth layers: farther layers have smaller/dimmer/more numerous
  // particles and shift less with the mouse; nearer layers shift more, which is
  // what sells the parallax depth illusion. The closest layer gets a subtle
  // outline, like the rim definition real out-of-focus bokeh circles show
  // when they're nearer the focal plane than the deep background blur.
  private readonly bokehLayers: BokehLayerConfig[] = [
    { count: 42, radiusRange: [4, 9], opacityRange: [0.02, 0.04], parallaxRange: 4, bobAmount: 3, driftSpeedScale: 0.35 },
    { count: 30, radiusRange: [8, 16], opacityRange: [0.04, 0.08], parallaxRange: 10, bobAmount: 5, driftSpeedScale: 0.5 },
    { count: 20, radiusRange: [14, 26], opacityRange: [0.06, 0.11], parallaxRange: 26, bobAmount: 9, driftSpeedScale: 0.75 },
    { count: 12, radiusRange: [22, 40], opacityRange: [0.08, 0.15], parallaxRange: 48, bobAmount: 15, driftSpeedScale: 1 },
    { count: 8, radiusRange: [32, 58], opacityRange: [0.1, 0.18], parallaxRange: 75, bobAmount: 22, driftSpeedScale: 1.3, outline: true }
  ];
  private readonly bokehColors = ['0, 240, 255', '168, 85, 247', '236, 72, 153'];
  private bokehParticles: BokehParticle[] = [];
  private bokehCycle = 0;
  private parallax: Point = { x: 0, y: 0 };
  private ambientPopTimer = 0;
  private readonly ambientPopIntervalFrames = 1800; // ~30s at 60fps: one random ambient pop

  constructor(
      private ngZone: NgZone,
      @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.lastActivityTime = Date.now();

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onClick);

    this.initTentacles();
    this.initOrbs();
    this.initSkirt();
    this.initSheath();
    this.initBokeh();

    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    cancelAnimationFrame(this.animationFrameId);
    if (this.dartTimeoutId !== null) {
      clearTimeout(this.dartTimeoutId);
    }
  }

  private onResize = (): void => {
    this.resizeCanvas();
  };

  private resizeCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasRef.nativeElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.target.x = e.clientX;
    this.target.y = e.clientY;
    this.lastActivityTime = Date.now();

    if (this.isDarting) {
      this.isDarting = false;
      this.chaseSpeed = 0.03;
      if (this.dartTimeoutId !== null) {
        clearTimeout(this.dartTimeoutId);
        this.dartTimeoutId = null;
      }
    }
  };

  // Pops the bokeh particle closest to the click, if the click landed on one.
  private onClick = (e: MouseEvent): void => {
    let closest: BokehParticle | null = null;
    let closestDist = Infinity;

    this.bokehParticles.forEach(p => {
      if (p.popping) return;
      const dx = p.screenX - e.clientX;
      const dy = p.screenY - e.clientY;
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
  };

  // Fires after idleDartDelayMs of no mouse movement: sends the jellyfish
  // shooting off toward a random point, then eases back to its normal,
  // mouse-following cruise speed once the burst is done.
  private triggerIdleDart(): void {
    this.isDarting = true;
    this.lastActivityTime = Date.now();

    const angle = Math.random() * Math.PI * 2;
    const distance = 500 + Math.random() * 500;
    this.target = {
      x: this.pos.x + Math.cos(angle) * distance,
      y: this.pos.y + Math.sin(angle) * distance
    };
    this.chaseSpeed = 0.12;

    this.dartTimeoutId = setTimeout(() => {
      this.chaseSpeed = 0.03;
      this.isDarting = false;
      this.dartTimeoutId = null;
    }, 1400);
  }

  private initTentacles(): void {
    this.tentacles = [];
    for (let i = 0; i < this.tentacleCount; i++) {
      const tentacle: TentacleNode[] = [];
      for (let j = 0; j < this.nodesPerTentacle; j++) {
        tentacle.push({ x: this.pos.x, y: this.pos.y + j * this.nodeDistance });
      }
      this.tentacles.push(tentacle);
    }
  }

  private initOrbs(): void {
    const colors = ['0, 240, 255', '168, 85, 247', '236, 72, 153', '255, 255, 255'];
    this.orbs = [];
    for (let i = 0; i < this.orbCount; i++) {
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

  private initBokeh(): void {
    this.bokehParticles = [];
    this.bokehLayers.forEach((layer, layerIndex) => {
      for (let i = 0; i < layer.count; i++) {
        this.bokehParticles.push(this.spawnBokehParticle(layerIndex));
      }
    });
  }

  // Builds a fresh particle for a layer -- used both for the initial fill
  // and to replace one that just finished popping.
  private spawnBokehParticle(layerIndex: number): BokehParticle {
    const layer = this.bokehLayers[layerIndex];
    return {
      xFrac: Math.random(),
      yFrac: Math.random(),
      radius: layer.radiusRange[0] + Math.random() * (layer.radiusRange[1] - layer.radiusRange[0]),
      opacity: layer.opacityRange[0] + Math.random() * (layer.opacityRange[1] - layer.opacityRange[0]),
      color: this.bokehColors[Math.floor(Math.random() * this.bokehColors.length)],
      layer: layerIndex,
      driftPhase: Math.random() * Math.PI * 2,
      popping: false,
      popProgress: 0,
      screenX: 0,
      screenY: 0,
      screenRadius: 0
    };
  }

  private initSkirt(): void {
    this.skirtPhaseOffsets = [];
    for (let i = 0; i <= this.skirtSegments; i++) {
      this.skirtPhaseOffsets.push(Math.random() * Math.PI * 2);
    }
  }

  private initSheath(): void {
    this.sheathJitter = [];
    for (let i = 0; i <= this.sheathSegments; i++) {
      this.sheathJitter.push(Math.random() * Math.PI * 2);
    }

    this.sheathPoints = [];
    for (let k = 0; k < this.sheathStrandCount; k++) {
      const strand: Point[] = [];
      for (let i = 0; i <= this.sheathSegments; i++) {
        strand.push(this.sheathTarget(this.baseRadius, k, i));
      }
      this.sheathPoints.push(strand);
    }
  }

  // The ideal, current-driven position for a sheath point -- what it's being
  // pulled toward. updateSheath() has each point chase this with lag rather
  // than snapping straight to it, which is what gives the strands inertia.
  private sheathTarget(r: number, k: number, i: number): Point {
    const ry = r * 0.25;
    const segments = this.sheathSegments;
    const halfWidthTop = r * 0.4;
    const length = r * 1.2; // ~1.5x the skirt's ~0.8r depth
    const flareAmount = halfWidthTop * 1.8;
    const maxSway = r * 0.3;
    const topAttachY = ry * 0.85;
    const strandCount = this.sheathStrandCount;

    const widthFrac = strandCount === 1 ? 0 : -1 + (2 * k) / (strandCount - 1);
    const s = i / segments;
    const depthFactor = Math.pow(s, 1.3);

    // Layered, multi-frequency motion like a net drifting underwater: one wave
    // synced to the tentacle pulse so it still reads as "moving with" them, plus
    // two slower/faster independent currents at different wavelengths riding on
    // top, so the whole bundle ripples rather than swinging as one rigid whip.
    const swayPulse = Math.sin(this.pulseCycle - s * 3.2) * maxSway * 0.45;
    const swayCurrentA = Math.sin(this.sheathDriftCycle * 0.55 + s * 4.2) * maxSway * 0.4;
    const swayCurrentB = Math.sin(this.sheathDriftCycle * 1.35 - s * 7.5 + this.sheathJitter[i] * 0.4) * maxSway * 0.25;
    const sway = (swayPulse + swayCurrentA + swayCurrentB) * depthFactor;

    // Gentle vertical billow, so it breathes lengthwise like a net swaying in a current
    const billow = Math.sin(this.sheathDriftCycle * 0.85 + s * 5.5 + widthFrac) * length * 0.02 * depthFactor;
    const y = topAttachY + s * length + billow;

    const widthBreath = 1 + Math.sin(this.sheathDriftCycle * 0.7 + s * 3.1) * 0.1;
    const taper = halfWidthTop * (1 - 0.3 * s);
    const flareT = Math.max(0, Math.min(1, (s - 0.72) / 0.28));
    const flare = flareAmount * flareT * flareT * (3 - 2 * flareT);
    const halfWidth = (taper + flare) * widthBreath;

    // Small per-strand wobble, like individual fibers rather than a rigid fan
    const strandWobble = Math.sin(this.pulseCycle * 1.4 - s * 4 + k * 1.7) * 1.2 * depthFactor;

    return { x: sway + widthFrac * halfWidth + strandWobble, y };
  }

  private updateSheath(r: number): void {
    const segments = this.sheathSegments;
    for (let k = 0; k < this.sheathStrandCount; k++) {
      const strand = this.sheathPoints[k];
      for (let i = 0; i <= segments; i++) {
        const s = i / segments;
        const target = this.sheathTarget(r, k, i);

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

  private updateParallax(): void {
    const canvas = this.canvasRef.nativeElement;
    const targetX = (this.target.x - canvas.width / 2) / (canvas.width / 2);
    const targetY = (this.target.y - canvas.height / 2) / (canvas.height / 2);

    // Smoothed rather than snapped straight to the cursor, so the depth
    // layers drift softly instead of jittering with every mouse tick
    this.parallax.x += (targetX - this.parallax.x) * 0.04;
    this.parallax.y += (targetY - this.parallax.y) * 0.04;
  }

  private updateBokeh(canvasWidth: number, canvasHeight: number): void {
    const popSpeed = 0.07;

    // Ambient popping: once every ~30s, pop a single random particle rather
    // than each particle having its own independent lifespan -- keeps the
    // random pops rare and system-wide instead of a constant flurry.
    this.ambientPopTimer++;
    if (this.ambientPopTimer >= this.ambientPopIntervalFrames) {
      this.ambientPopTimer = 0;
      const candidates = this.bokehParticles.filter(p => !p.popping);
      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        chosen.popping = true;
        chosen.popProgress = 0;
      }
    }

    this.bokehParticles.forEach(p => {
      if (p.popping) {
        p.popProgress += popSpeed;
        if (p.popProgress >= 1) {
          Object.assign(p, this.spawnBokehParticle(p.layer));
        }
      }

      const layer = this.bokehLayers[p.layer];
      const bob = Math.sin(this.bokehCycle * layer.driftSpeedScale + p.driftPhase) * layer.bobAmount;
      p.screenX = p.xFrac * canvasWidth + this.parallax.x * layer.parallaxRange;
      p.screenY = p.yFrac * canvasHeight + bob + this.parallax.y * layer.parallaxRange * 0.6;
      p.screenRadius = p.radius;
    });
  }

  private updateOrbs(r: number): void {
    // Mouse position in the jellyfish's local (unrotated) coordinate frame
    const dxWorld = this.target.x - this.pos.x;
    const dyWorld = this.target.y - this.pos.y;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const localMouseX = dxWorld * cos + dyWorld * sin;
    const localMouseY = -dxWorld * sin + dyWorld * cos;

    const influenceRadius = r * 3;
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

  private animate = (): void => {
    this.updatePhysics();
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private updatePhysics(): void {
    if (!this.isDarting && Date.now() - this.lastActivityTime > this.idleDartDelayMs) {
      this.triggerIdleDart();
    }

    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    this.pos.x += dx * this.chaseSpeed;
    this.pos.y += dy * this.chaseSpeed;

    const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
    let angleDiff = targetAngle - this.rotation;

    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.rotation += angleDiff * 0.05;

    this.pulseCycle += 0.04;
    this.skirtCycle += 0.015;
    this.sheathDriftCycle += 0.011;
    this.bokehCycle += 0.006;
    this.updateParallax();

    const canvas = this.canvasRef.nativeElement;
    this.updateBokeh(canvas.width, canvas.height);

    const pulseScale = 1 + Math.sin(this.pulseCycle) * 0.12;
    const r = this.baseRadius * pulseScale;
    const ellipseYRadius = r * 0.25;

    this.updateOrbs(r);
    this.updateSheath(r);

    const spacing = (r * 1.4) / (this.tentacleCount - 1);

    this.tentacles.forEach((tentacle, tIndex) => {
      const offsetX = -r * 0.7 + tIndex * spacing;
      const pct = offsetX / r;
      const offsetZ = Math.sqrt(Math.max(0, 1 - pct * pct));
      const offsetY = (offsetZ * ellipseYRadius * 0.3);

      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);

      const rootX = this.pos.x + (offsetX * cos - offsetY * sin);
      const rootY = this.pos.y + (offsetX * sin + offsetY * cos);

      tentacle[0].x = rootX;
      tentacle[0].y = rootY;

      for (let i = 1; i < tentacle.length; i++) {
        const prev = tentacle[i - 1];
        const curr = tentacle[i];

        const nodeDx = curr.x - prev.x;
        const nodeDy = curr.y - prev.y;
        const distance = Math.sqrt(nodeDx * nodeDx + nodeDy * nodeDy);
        const wave = Math.sin(this.pulseCycle - i * 0.3 + tIndex) * 1.5;

        if (distance > 0) {
          curr.x = prev.x + (nodeDx / distance) * this.nodeDistance + wave;
          curr.y = prev.y + (nodeDy / distance) * this.nodeDistance;
        }
      }
    });
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pulseScale = 1 + Math.sin(this.pulseCycle) * 0.12;
    const r = this.baseRadius * pulseScale;

    // LAYER 0: Background bokeh, drifting depth-of-field particles with parallax
    this.drawBokeh();

    this.ctx.save();
    this.ctx.translate(this.pos.x, this.pos.y);
    this.ctx.rotate(this.rotation);

    // LAYER 1: Inside/back rim of opening
    this.drawHollowOpeningBack(r);

    this.ctx.restore();

    // LAYER 2: Trailing tentacles
    this.drawTentacles();

    this.ctx.save();
    this.ctx.translate(this.pos.x, this.pos.y);
    this.ctx.rotate(this.rotation);

    // LAYER 3: Long narrow sheath containing the tentacle bases, flaring like a trumpet
    this.drawSheath();

    // LAYER 4: Rippling skirt/frill hanging under the bell, over the tentacle roots
    this.drawSkirt(r);

    // LAYER 5: Outer shell with horizontal AND vertical grid ribs
    this.drawHollowShellFront(r);

    this.ctx.restore();
  }

  private drawBokeh(): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';

    this.bokehParticles.forEach(p => {
      const layer = this.bokehLayers[p.layer];
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

      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${p.color}, ${opacity})`);
      gradient.addColorStop(0.6, `rgba(${p.color}, ${opacity * 0.35})`);
      gradient.addColorStop(1, `rgba(${p.color}, 0)`);

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Closest layer gets a subtle rim, like the crisper edge definition
      // real bokeh circles show when nearer the focal plane
      if (layer.outline && !p.popping) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 0.84, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${p.color}, ${Math.min(0.3, p.opacity * 2.2)})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();
      }

      if (p.popping) {
        // Expanding shockwave ring that fades out as it grows -- the "pop"
        const ringRadius = p.screenRadius * (1 + p.popProgress * 2.2);
        const ringAlpha = (1 - p.popProgress) * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(${p.color}, ${ringAlpha})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      }
    });

    this.ctx.restore();
  }

  private drawHollowOpeningBack(r: number): void {
    const ry = r * 0.25;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, r, ry, 0, Math.PI, 0, false);
    this.ctx.fillStyle = 'rgba(5, 15, 35, 0.85)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
  }

  // Appends a smooth quadratic curve through points to the current path.
  // Assumes the path's current position is already at points[0] (via a prior
  // moveTo/lineTo), and ends exactly at the last point.
  private tracePathSmooth(points: Point[]): void {
    for (let i = 0; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    const last = points[points.length - 1];
    this.ctx.lineTo(last.x, last.y);
  }

  private drawSheath(): void {
    this.ctx.save();
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';

    this.sheathPoints.forEach((points, k) => {
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      this.tracePathSmooth(points);

      const isInner = k % 2 === 0;
      this.ctx.strokeStyle = isInner ? 'rgba(0, 240, 255, 0.5)' : 'rgba(236, 72, 153, 0.4)';
      this.ctx.lineWidth = isInner ? 1.6 : 1.1;
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  private drawSkirt(r: number): void {
    const ry = r * 0.25;
    const segments = this.skirtSegments;
    const spanX = r * 0.78;
    const hangDepth = r * 0.55;
    const rippleAmp = r * 0.12;
    const swayAmp = r * 0.04;

    const topPoints: Point[] = [];
    const bottomPoints: Point[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const baseX = -spanX + t * spanX * 2;
      const pct = baseX / r;
      const depthZ = Math.sqrt(Math.max(0, 1 - pct * pct));
      const topY = depthZ * ry * 0.9;

      // Smooth traveling waves across the width, like a current moving through water
      const wave = Math.sin(this.skirtCycle + t * Math.PI * 2.4) * rippleAmp
          + Math.sin(this.skirtCycle * 1.5 - t * Math.PI * 3.6) * rippleAmp * 0.5;
      // subtle per-vertex jitter so it reads as organic rather than mechanical
      const jitter = Math.sin(this.skirtCycle * 2 + this.skirtPhaseOffsets[i]) * rippleAmp * 0.15;
      const sway = Math.sin(this.skirtCycle * 0.8 + t * Math.PI * 2 + this.skirtPhaseOffsets[i]) * swayAmp;

      const bottomY = topY + hangDepth * (0.55 + depthZ * 0.45) + wave + jitter;

      topPoints.push({ x: baseX, y: topY });
      bottomPoints.push({ x: baseX + sway, y: bottomY });
    }

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = 'rgba(0, 240, 255, 0.4)';

    const gradient = this.ctx.createLinearGradient(0, 0, 0, hangDepth + rippleAmp);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.18)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.04)');

    this.ctx.beginPath();
    this.ctx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < topPoints.length; i++) {
      this.ctx.lineTo(topPoints[i].x, topPoints[i].y);
    }
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      this.ctx.lineTo(bottomPoints[i].x, bottomPoints[i].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Fine tightly-grouped ripple strands tracing the rippling hem, like water
    this.ctx.lineWidth = 0.8;
    for (let strand = 0; strand < 3; strand++) {
      const depthLerp = 0.4 + strand * 0.3;
      this.ctx.beginPath();
      for (let i = 0; i < bottomPoints.length; i++) {
        const x = topPoints[i].x + (bottomPoints[i].x - topPoints[i].x) * depthLerp;
        const y = topPoints[i].y + (bottomPoints[i].y - topPoints[i].y) * depthLerp;
        if (i === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.strokeStyle = strand % 2 === 0
          ? 'rgba(0, 240, 255, 0.3)'
          : 'rgba(255, 255, 255, 0.2)';
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawHollowShellFront(r: number): void {
    const ry = r * 0.25;

    // --- BASE TRANSLUCENT SHELL ---
    this.ctx.save();
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';

    const gradient = this.ctx.createLinearGradient(0, -r, 0, ry);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.7)');
    gradient.addColorStop(0.6, 'rgba(168, 85, 247, 0.3)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.1)');

    this.ctx.fillStyle = gradient;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.lineWidth = 3;

    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, Math.PI, 0, false);
    this.ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI, false);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();

    // --- ISOMETRIC MESH: RINGS & MERIDIAN RIBS ---
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';

    // 1. Horizontal Isometric Rings (Parallel Lines)
    const ringLevels = [-0.4, -0.7];
    ringLevels.forEach((level, i) => {
      const ringY = r * level;
      const rx = Math.sqrt(r * r - ringY * ringY);
      const rRatio = rx * 0.25;

      this.ctx.beginPath();
      this.ctx.ellipse(0, ringY, rx, rRatio, 0, 0, Math.PI, false);
      this.ctx.strokeStyle = i === 0 ? 'rgba(168, 85, 247, 0.7)' : 'rgba(0, 240, 255, 0.5)';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();
    });

    // 2. NEW: Vertical Meridian Ribs (Longitudinal Arcs)
    // We space 5 longitudinal curves across the front face (-0.8 to +0.8 of radius X)
    const meridianOffsets = [-0.75, -0.4, 0, 0.4, 0.75];

    meridianOffsets.forEach((offsetXFactor) => {
      const bottomX = r * offsetXFactor;

      // Calculate depth offset to map onto the bottom rim's 3D isometric perspective
      const pct = bottomX / r;
      const depthZ = Math.sqrt(Math.max(0, 1 - pct * pct));
      const bottomY = depthZ * ry;

      this.ctx.beginPath();
      // Start at top dome apex (0, -r)
      this.ctx.moveTo(0, -r);

      // Quadratic curve bending out toward spherical surface margin
      // Control point scales dynamically to preserve rounded 3D volume profile
      const controlX = bottomX * 1.25;
      const controlY = -r * 0.45;

      this.ctx.quadraticCurveTo(controlX, controlY, bottomX, bottomY);

      this.ctx.strokeStyle = Math.abs(offsetXFactor) === 0
          ? 'rgba(255, 255, 255, 0.7)'   // Center meridian line highlighted bright white
          : 'rgba(0, 240, 255, 0.45)';  // Side meridians cyan
      this.ctx.lineWidth = Math.abs(offsetXFactor) === 0 ? 1.5 : 1.0;
      this.ctx.stroke();
    });

    // 3. Floating Internal Organ / Core
    const corePulse = Math.sin(this.pulseCycle * 1.5) * 3;
    const coreXRadius = r * 0.28 + corePulse * 0.3;
    const coreYRadius = r * 0.45 + corePulse;

    const coreGradient = this.ctx.createRadialGradient(0, -r * 0.2, 2, 0, -r * 0.2, coreYRadius);
    coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    coreGradient.addColorStop(0.3, 'rgba(0, 240, 255, 0.7)');
    coreGradient.addColorStop(0.8, 'rgba(236, 72, 153, 0.2)');
    coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    this.ctx.fillStyle = coreGradient;
    this.ctx.beginPath();
    this.ctx.ellipse(0, -r * 0.2, coreXRadius, coreYRadius, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // 3b. Floating Glowing Orbs (bioluminescent particles inside the bell)
    this.drawOrbs(r, ry);

    // 4. Outer Bottom Rim Highlight Line
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI, false);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  private drawOrbs(r: number, ry: number): void {
    this.ctx.save();

    // Clip to the bell interior so orbs never poke outside the shell
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, Math.PI, 0, false);
    this.ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI, false);
    this.ctx.closePath();
    this.ctx.clip();

    this.orbs.forEach(orb => {
      const driftX = Math.sin(orb.driftPhase) * r * 0.1;
      const driftY = Math.cos(orb.driftPhase * 1.3) * ry * 0.35;

      const x = (orb.xFactor + orb.pushXFactor) * r * 0.75 + driftX;
      const y = (orb.yFactor + orb.pushYFactor) * r + driftY;

      const pulse = 0.5 + Math.sin(orb.pulsePhase) * 0.5;
      const excite = 1 + orb.proximity * 1.2;
      const radius = orb.size * (0.6 + pulse * 0.7) * excite;

      const glow = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, `rgba(${orb.color}, ${Math.min(1, 0.9 + orb.proximity * 0.3)})`);
      glow.addColorStop(0.4, `rgba(${orb.color}, ${Math.min(1, 0.2 + pulse * 0.3 + orb.proximity * 0.4)})`);
      glow.addColorStop(1, `rgba(${orb.color}, 0)`);

      this.ctx.fillStyle = glow;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, 0.6 + pulse * 0.4 + orb.proximity * 0.4)})`;
      this.ctx.fill();
    });

    this.ctx.restore();
  }

  private drawTentacles(): void {
    this.ctx.save();
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = 'rgba(236, 72, 153, 0.6)';

    this.tentacles.forEach((tentacle, index) => {
      this.ctx.beginPath();
      this.ctx.moveTo(tentacle[0].x, tentacle[0].y);

      for (let i = 1; i < tentacle.length - 1; i++) {
        const xc = (tentacle[i].x + tentacle[i + 1].x) / 2;
        const yc = (tentacle[i].y + tentacle[i + 1].y) / 2;
        this.ctx.quadraticCurveTo(tentacle[i].x, tentacle[i].y, xc, yc);
      }

      const isInner = index % 2 === 0;
      this.ctx.strokeStyle = isInner ? 'rgba(0, 240, 255, 0.65)' : 'rgba(236, 72, 153, 0.5)';
      this.ctx.lineWidth = isInner ? 2.5 : 1.5;
      this.ctx.stroke();
    });

    this.ctx.restore();
  }
}