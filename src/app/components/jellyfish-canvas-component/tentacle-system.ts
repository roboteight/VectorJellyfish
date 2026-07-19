import { Point, TentacleNode } from './jellyfish.models';

/*The trailing tentacle bundle: each strand is a chain of nodes that follows
its predecessor at a fixed distance with a small per-node wave, which is
what makes the bundle curl and spiral as the body moves.*/
export class TentacleSystem {
  private tentacles: TentacleNode[][] = [];

/*  Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  count/nodesPerTentacle are structural: call init() again after changing them.*/
  waveAmplitude = 1.5;

/*  Falling state: when the body pops, the root un-anchors and the whole chain
  becomes a verlet rope -- every node free-falls under gravity, held together
  only by a fixed-distance constraint to its neighbors (relaxed a few times a
  frame), which is what gives a dropped rope its whip/drape motion instead of
  sliding down as a rigid shape. Floor contact reflects each node's implicit
  velocity, scaled by that node's point on the shared wave cycle (offset by
  tIndex + node index, same phase relationship as the normal swimming wave),
  so bounces ripple along and across tentacles independently and are
  wave-driven rather than one synchronized physics bounce.*/
  private isFalling = false;
  private fallPrev: Point[][] = [];
  private fallCycle = 0;
  private floorY = 0;

  constructor(
    public count = 24,
    public nodesPerTentacle = 30,
    private readonly nodeDistance = 25
  ) {}

  init(pos: Point): void {
    this.tentacles = [];
    for (let i = 0; i < this.count; i++) {
      const tentacle: TentacleNode[] = [];
      for (let j = 0; j < this.nodesPerTentacle; j++) {
        tentacle.push({ x: pos.x, y: pos.y + j * this.nodeDistance });
      }
      this.tentacles.push(tentacle);
    }
    this.isFalling = false;
  }

/*  Detaches the bundle from its root: from here on updateFalling() drives it
  as a free-hanging verlet rope rather than chasing the body, until it drapes
  onto the floor and settles.*/
  startFalling(floorY: number): void {
    this.isFalling = true;
    this.floorY = floorY;
    this.fallCycle = 0;
    // Zero implicit velocity to start: prev position == current position.
    this.fallPrev = this.tentacles.map(tentacle => tentacle.map(node => ({ x: node.x, y: node.y })));
  }

  stopFalling(): void {
    this.isFalling = false;
  }

  updateFalling(gravity = 0.7): void {
    this.fallCycle += 0.12;
    const airDamping = 0.985;
    const constraintIterations = 1;
    const constraintStiffness = 0.5;

    this.tentacles.forEach((tentacle, tIndex) => {
      const prevPoints = this.fallPrev[tIndex];

      // Verlet-integrate each node: implicit velocity is (current - previous),
      // carried forward with slight air damping, plus gravity.
      tentacle.forEach((node, i) => {
        const prev = prevPoints[i];
        const vx = (node.x - prev.x) * airDamping;
        const vy = (node.y - prev.y) * airDamping;

        const startX = node.x;
        const startY = node.y;
        node.x += vx;
        node.y += vy + gravity;
        prev.x = startX;
        prev.y = startY;
      });

      // A node resting on the floor gets a lot more inertia in the constraint
      // solve, so airborne segments above it drape and pile up messily rather
      // than dragging it sideways into a perfectly straight resting line.
      const grounded = tentacle.map(node => node.y >= this.floorY - 0.5);

      // Distance constraint between neighbors keeps segments at nodeDistance,
      // which turns free-falling points into a coherent rope that whips and
      // drapes rather than stretching apart.
      for (let iter = 0; iter < constraintIterations; iter++) {
        for (let i = 0; i < tentacle.length - 1; i++) {
          const a = tentacle[i];
          const b = tentacle[i + 1];
          const invMassA = grounded[i] ? 0.4 : 1;
          const invMassB = grounded[i + 1] ? 0.4 : 1;
          const totalInvMass = invMassA + invMassB;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const diff = (dist - this.nodeDistance) / dist * constraintStiffness;
          const offsetX = dx * diff;
          const offsetY = dy * diff;
          a.x += offsetX * (invMassA / totalInvMass);
          a.y += offsetY * (invMassA / totalInvMass);
          b.x -= offsetX * (invMassB / totalInvMass);
          b.y -= offsetY * (invMassB / totalInvMass);
        }
      }

      // Floor contact: clamp to the floor and reflect the implicit velocity,
      // scaled by this node's point on the wave cycle -- near a trough it
      // just stops dead, near a peak it kicks back up, giving every node an
      // independent, wave-timed micro-bounce as the rope settles into a heap.
      tentacle.forEach((node, i) => {
        if (node.y > this.floorY) {
          const prev = prevPoints[i];
          const impactVy = node.y - prev.y;
          node.y = this.floorY;

          const wave = Math.sin(this.fallCycle + tIndex * 0.85 + i * 0.12);
          const restitution = Math.max(0, wave) * 0.6;
          prev.y = node.y + impactVy * restitution;
        }
      });
    });
  }

  update(pos: Point, rotation: number, pulseCycle: number, r: number): void {
    const ellipseYRadius = r * 0.25;
    const spacing = (r * 1.4) / (this.count - 1);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    this.tentacles.forEach((tentacle, tIndex) => {
      const offsetX = -r * 0.7 + tIndex * spacing;
      const pct = offsetX / r;
      const offsetZ = Math.sqrt(Math.max(0, 1 - pct * pct));
      const offsetY = offsetZ * ellipseYRadius * 0.3;

      const rootX = pos.x + (offsetX * cos - offsetY * sin);
      const rootY = pos.y + (offsetX * sin + offsetY * cos);

      tentacle[0].x = rootX;
      tentacle[0].y = rootY;

      for (let i = 1; i < tentacle.length; i++) {
        const prev = tentacle[i - 1];
        const curr = tentacle[i];

        const nodeDx = curr.x - prev.x;
        const nodeDy = curr.y - prev.y;
        const distance = Math.sqrt(nodeDx * nodeDx + nodeDy * nodeDy);
        const wave = Math.sin(pulseCycle - i * 0.3 + tIndex) * this.waveAmplitude;

        if (distance > 0) {
          curr.x = prev.x + (nodeDx / distance) * this.nodeDistance + wave;
          curr.y = prev.y + (nodeDy / distance) * this.nodeDistance;
        }
      }
    });
  }

  /*Draws in world space (not the jellyfish's translated/rotated context),
  since tentacle node positions are already computed as world coordinates.*/
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(236, 72, 153, 0.6)';

    this.tentacles.forEach((tentacle, index) => {
      ctx.beginPath();
      ctx.moveTo(tentacle[0].x, tentacle[0].y);

      for (let i = 1; i < tentacle.length - 1; i++) {
        const xc = (tentacle[i].x + tentacle[i + 1].x) / 2;
        const yc = (tentacle[i].y + tentacle[i + 1].y) / 2;
        ctx.quadraticCurveTo(tentacle[i].x, tentacle[i].y, xc, yc);
      }

      const isInner = index % 2 === 0;
      ctx.strokeStyle = isInner ? 'rgba(0, 240, 255, 0.65)' : 'rgba(236, 72, 153, 0.5)';
      ctx.lineWidth = isInner ? 2.5 : 1.5;
      ctx.stroke();
    });

    ctx.restore();
  }
}
