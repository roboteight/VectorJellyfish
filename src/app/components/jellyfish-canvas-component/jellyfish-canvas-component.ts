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
import { Subscription } from 'rxjs';
import { JellyfishMovement } from './jellyfish-movement';
import { TentacleSystem } from './tentacle-system';
import { JellyfishBody } from './jellyfish-body';
import { SkirtSystem } from './skirt-system';
import { SheathSystem } from './sheath-system';
import { BokehSystem } from './bokeh-system';
import { SeaweedSystem } from './seaweed-system';
import { JellyfishConfig, JellyfishConfigService } from '../../services/jellyfish-config.service';

/*Orchestrates the jellyfish scene: owns the canvas/animation loop and DOM
events, and delegates all state and rendering to the focused systems below.
  - JellyfishMovement: chasing the cursor, heading, pulse, idle darts
  - TentacleSystem: the trailing tentacle bundle
  - JellyfishBody: the bell shell (composes OrbSystem for the inner orbs)
  - SkirtSystem: the short rippling frill at the rim
  - SheathSystem: the long trumpet-flared sheath over the tentacle bases
  - BokehSystem: the background depth-of-field/parallax particle field
  - SeaweedSystem: the fractally-branching seaweed bed at the floor*/
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
  private animationFrameId = 0;
  private isBrowser: boolean;

  private readonly baseRadius = 50;

  private readonly movement = new JellyfishMovement(this.baseRadius);
  private readonly tentacles = new TentacleSystem();
  private readonly body = new JellyfishBody();
  private readonly skirt = new SkirtSystem();
  private readonly sheath = new SheathSystem();
  private readonly bokeh = new BokehSystem();
  private readonly seaweed = new SeaweedSystem();

  private configSub?: Subscription;
  private lastConfig: JellyfishConfig | null = null;

  /*Popped state: clicking the body bursts it and drops the tentacles until
  regenerate() rebuilds everything a few seconds later.*/
  private isPopped = false;
  private regenerateTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly regenerateDelayMs = 5000;

  constructor(
      private ngZone: NgZone,
      private configService: JellyfishConfigService,
      @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.movement.init(window.innerWidth / 2, window.innerHeight / 2);

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onClick);

    this.tentacles.init(this.movement.pos);
    this.body.init();
    this.sheath.init(this.baseRadius, this.movement.pulseCycle);
    this.bokeh.init();
    this.seaweed.init();

/*    Applies once immediately (with defaults matching the above init calls),
    then live on every change pushed from the control panel.*/
    this.configSub = this.configService.config$.subscribe(cfg => this.applyConfig(cfg));

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
    this.movement.dispose();
    this.configSub?.unsubscribe();
    if (this.regenerateTimeoutId !== null) {
      clearTimeout(this.regenerateTimeoutId);
    }
  }

/*  Pushes every config value onto its owning system. Most knobs are read
  directly by that system's update()/draw() each frame, so a plain field
  assignment is enough; a few are structural (they size an array built at
  init time), so those additionally trigger a re-init when they change.*/
  private applyConfig(cfg: JellyfishConfig): void {
    const prev = this.lastConfig;
    this.lastConfig = cfg;

    this.movement.baseRadius = cfg.bellRadius;
    this.movement.normalChaseSpeed = cfg.chaseSpeed;
    this.movement.pulseSpeed = cfg.pulseSpeed;
    this.movement.idleDartDelayMs = cfg.idleDartDelaySeconds * 1000;

    this.tentacles.waveAmplitude = cfg.tentacleWaveAmplitude;
    const tentaclesChanged = !prev
        || prev.tentacleCount !== cfg.tentacleCount
        || prev.tentacleLength !== cfg.tentacleLength;
    this.tentacles.count = cfg.tentacleCount;
    this.tentacles.nodesPerTentacle = cfg.tentacleLength;
    if (tentaclesChanged) {
      this.tentacles.init(this.movement.pos);
    }

    this.body.orbs.influenceRadiusFactor = cfg.orbInfluenceRadius;
    const orbsChanged = !prev || prev.orbCount !== cfg.orbCount;
    this.body.orbs.count = cfg.orbCount;
    if (orbsChanged) {
      this.body.orbs.init();
    }

    this.skirt.rippleAmpFactor = cfg.skirtRippleAmplitude;
    this.skirt.swayAmpFactor = cfg.skirtSwayAmplitude;

    this.sheath.lengthFactor = cfg.sheathLength;
    this.sheath.flareFactor = cfg.sheathFlareAmount;
    const sheathChanged = !prev || prev.sheathStrandCount !== cfg.sheathStrandCount;
    this.sheath.strandCount = cfg.sheathStrandCount;
    if (sheathChanged) {
      this.sheath.init(this.movement.baseRadius, this.movement.pulseCycle);
    }

    this.bokeh.parallaxStrength = cfg.bokehParallaxStrength;
    this.bokeh.ambientPopIntervalFrames = cfg.bokehPopIntervalSeconds * 60;
    const bokehChanged = !prev || prev.bokehParticleDensity !== cfg.bokehParticleDensity;
    this.bokeh.particleDensity = cfg.bokehParticleDensity;
    if (bokehChanged) {
      this.bokeh.init();
    }

    this.seaweed.branchDepth = cfg?.seaweedBranchDepth;
    this.seaweed.baseLength = cfg?.seaweedLength;
    this.seaweed.swayAmplitude = cfg?.seaweedSwayAmplitude;
    this.seaweed.swaySpeed = cfg?.seaweedSwaySpeed;
    this.seaweed.mouseInfluence = cfg?.seaweedMouseInfluence;
    const seaweedChanged = !prev || prev?.seaweedCount !== cfg?.seaweedCount;
    this.seaweed.plantCount = cfg?.seaweedCount;
    if (seaweedChanged) {
      this.seaweed.init();
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
    this.movement.onMouseMove(e.clientX, e.clientY);
  };

  private onClick = (e: MouseEvent): void => {
    if (this.isPopped) return;

    const dx = e.clientX - this.movement.pos.x;
    const dy = e.clientY - this.movement.pos.y;
    const hitRadius = this.movement.radius * 1.15;

    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      this.triggerBodyPop();
      return;
    }

    this.bokeh.handleClick(e.clientX, e.clientY);
  };

/*  Bursts the bell and sends the tentacle bundle falling to the bottom of
  the screen; regenerate() rebuilds everything after regenerateDelayMs.*/
  private triggerBodyPop(): void {
    this.isPopped = true;
    this.body.pop();

    const canvas = this.canvasRef.nativeElement;
    this.tentacles.startFalling(canvas.height - 40);

    this.regenerateTimeoutId = setTimeout(() => {
      this.regenerate();
    }, this.regenerateDelayMs);
  }

  private regenerate(): void {
    this.isPopped = false;
    this.regenerateTimeoutId = null;

    this.movement.refreshActivity();
    this.tentacles.stopFalling();
    this.tentacles.init(this.movement.pos);
    this.body.init();
  }

  private animate = (): void => {
    this.updatePhysics();
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  private updatePhysics(): void {
    const canvas = this.canvasRef.nativeElement;

/*    Frozen in place while popped -- the bell stays put and the tentacles
    fall from wherever they were when it burst.*/
    if (!this.isPopped) {
      this.movement.update(canvas.width, canvas.height);
    }
    this.body.updatePop();

    this.bokeh.update(canvas.width, canvas.height, this.movement.target);
    this.seaweed.update(this.movement.target.x, canvas.width);

    const r = this.movement.radius;

    if (this.isPopped) {
      this.tentacles.updateFalling();
      return;
    }

    this.body.orbs.update(this.movement.pos, this.movement.rotation, this.movement.target, r);
    this.sheath.update(r, this.movement.pulseCycle);
    this.skirt.update();
    this.tentacles.update(this.movement.pos, this.movement.rotation, this.movement.pulseCycle, r);
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    const r = this.movement.radius;

/*
    LAYER 0: Background bokeh, drifting depth-of-field particles with parallax
*/
    this.bokeh.draw(this.ctx);

/*
    LAYER 0b: Fractal seaweed bed rooted along the floor
*/
    this.seaweed.draw(this.ctx, canvas.width, canvas.height);

    this.ctx.save();
    this.ctx.translate(this.movement.pos.x, this.movement.pos.y);
    this.ctx.rotate(this.movement.rotation);

/*
    LAYER 1: Inside/back rim of opening
*/
    if (!this.body.isHidden) {
      this.body.drawOpeningBack(this.ctx, r);
    }

    this.ctx.restore();

/*
    LAYER 2: Trailing tentacles (falling and pooling at the floor while popped)
*/
    this.tentacles.draw(this.ctx);

    this.ctx.save();
    this.ctx.translate(this.movement.pos.x, this.movement.pos.y);
    this.ctx.rotate(this.movement.rotation);

    if (!this.body.isHidden) {
/*
      LAYER 3: Long narrow sheath containing the tentacle bases, flaring like a trumpet
*/
      this.sheath.draw(this.ctx);

/*
      LAYER 4: Rippling skirt/frill hanging under the bell, over the tentacle roots
*/
      this.skirt.draw(this.ctx, r);

/*
      LAYER 5: Outer shell with horizontal AND vertical grid ribs
*/
      this.body.drawShellFront(this.ctx, r, this.movement.pulseCycle);
    }

/*
    Pop burst -- plays briefly over/instead of the shell right as it bursts
*/
    this.body.drawPopBurst(this.ctx, r);

    this.ctx.restore();
  }
}
