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
  templateUrl: './jellyfish-canvas-component.html',
  styleUrls: ['./jellyfish-canvas-component.scss'],
  standalone: true
})
export class JellyfishCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('jellyfishCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId: number = 0;
  private isBrowser: boolean;

  // Safe initial fallbacks for SSR environment
  private target: Point = { x: 400, y: 300 };
  private pos: Point = { x: 400, y: 300 };
  private rotation: number = 0;
  private pulseCycle: number = 0;

  private tentacleCount = 24;
  private nodesPerTentacle = 100;
  private nodeDistance = 75;
  private tentacles: TentacleNode[][] = [];

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    /* Safely set window positions once mounted in browser. */
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

    const bellRadius = 45;
    const spacing = (bellRadius * 1.5) / (this.tentacleCount - 1);

    this.tentacles.forEach((tentacle, tIndex) => {
      const offsetX = -bellRadius * 0.75 + tIndex * spacing;
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);

      const rootX = this.pos.x + (offsetX * cos - 10 * sin);
      const rootY = this.pos.y + (offsetX * sin + 10 * cos);

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

    this.drawTentacles();
    this.drawBell(pulseScale);
  }

  private drawBell(pulseScale: number): void {
    this.ctx.save();
    this.ctx.translate(this.pos.x, this.pos.y);
    this.ctx.rotate(this.rotation);

    this.ctx.shadowBlur = 25;
    this.ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';

    const gradient = this.ctx.createLinearGradient(0, -60, 0, 20);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(168, 85, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(236, 72, 153, 0.1)');

    this.ctx.fillStyle = gradient;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2.5;

    this.ctx.beginPath();
    this.ctx.moveTo(-45 * pulseScale, 10);
    this.ctx.bezierCurveTo(
      -50 * pulseScale, -60 / pulseScale,
      50 * pulseScale, -60 / pulseScale,
      45 * pulseScale, 10
    );
    this.ctx.quadraticCurveTo(22.5 * pulseScale, 0, 0, 10 / pulseScale);
    this.ctx.quadraticCurveTo(-22.5 * pulseScale, 0, -45 * pulseScale, 10);

    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0, -20, 18 * pulseScale, Math.PI, 0);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1.5;
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
      this.ctx.strokeStyle = isInner ? 'rgba(0, 240, 255, 0.6)' : 'rgba(236, 72, 153, 0.5)';
      this.ctx.lineWidth = isInner ? 2.5 : 1.5;
      this.ctx.stroke();
    });

    this.ctx.restore();
  }
}
