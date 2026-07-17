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

  private baseRadius = 50;
  private tentacleCount = 24;
  private nodesPerTentacle = 30;
  private nodeDistance = 25;
  private tentacles: TentacleNode[][] = [];

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

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);

    this.initTentacles();

    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mousemove', this.onMouseMove);
    cancelAnimationFrame(this.animationFrameId);
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
  };

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

  private animate = (): void => {
    this.updatePhysics();
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private updatePhysics(): void {
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    this.pos.x += dx * 0.03;
    this.pos.y += dy * 0.03;

    const targetAngle = Math.atan2(dy, dx) - Math.PI / 2;
    let angleDiff = targetAngle - this.rotation;

    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.rotation += angleDiff * 0.05;

    this.pulseCycle += 0.04;

    const pulseScale = 1 + Math.sin(this.pulseCycle) * 0.12;
    const r = this.baseRadius * pulseScale;
    const ellipseYRadius = r * 0.25;

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

    // LAYER 3: Outer shell with horizontal AND vertical grid ribs
    this.drawHollowShellFront(r);

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

    // 4. Outer Bottom Rim Highlight Line
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, r, ry, 0, 0, Math.PI, false);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

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