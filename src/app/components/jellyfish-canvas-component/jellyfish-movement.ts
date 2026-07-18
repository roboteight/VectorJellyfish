import { Point } from './jellyfish.models';

// Owns the jellyfish's core motion: chasing the cursor, facing its heading,
// the breathing pulse cycle, and the idle-dart burst. Every other visual
// system (tentacles, body, sheath) reads pos/rotation/pulseCycle from here.
export class JellyfishMovement {
  target: Point = { x: 400, y: 300 };
  pos: Point = { x: 400, y: 300 };
  rotation = 0;
  pulseCycle = 0;

  // Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  baseRadius: number;
  normalChaseSpeed = 0.03;
  pulseSpeed = 0.04;
  idleDartDelayMs = 5000;

  private chaseSpeed = this.normalChaseSpeed;

  private lastActivityTime = 0;
  private isDarting = false;
  private dartTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(baseRadius: number) {
    this.baseRadius = baseRadius;
  }

  init(centerX: number, centerY: number): void {
    this.target = { x: centerX, y: centerY };
    this.pos = { x: centerX, y: centerY };
    this.lastActivityTime = Date.now();
  }

  dispose(): void {
    if (this.dartTimeoutId !== null) {
      clearTimeout(this.dartTimeoutId);
    }
  }

  onMouseMove(x: number, y: number): void {
    this.target.x = x;
    this.target.y = y;
    this.lastActivityTime = Date.now();

    if (this.isDarting) {
      this.isDarting = false;
      this.chaseSpeed = this.normalChaseSpeed;
      if (this.dartTimeoutId !== null) {
        clearTimeout(this.dartTimeoutId);
        this.dartTimeoutId = null;
      }
    }
  }

  // The jellyfish's current bell radius, pulsing with its breathing cycle.
  get radius(): number {
    const pulseScale = 1 + Math.sin(this.pulseCycle) * 0.12;
    return this.baseRadius * pulseScale;
  }

  update(): void {
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

    this.pulseCycle += this.pulseSpeed;
  }

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
      this.chaseSpeed = this.normalChaseSpeed;
      this.isDarting = false;
      this.dartTimeoutId = null;
    }, 1400);
  }
}
