import { Point, TentacleNode } from './jellyfish.models';

// The trailing tentacle bundle: each strand is a chain of nodes that follows
// its predecessor at a fixed distance with a small per-node wave, which is
// what makes the bundle curl and spiral as the body moves.
export class TentacleSystem {
  private tentacles: TentacleNode[][] = [];

  // Tunable knobs -- live-editable via JellyfishConfigService/the control panel.
  // count/nodesPerTentacle are structural: call init() again after changing them.
  waveAmplitude = 1.5;

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

  // Draws in world space (not the jellyfish's translated/rotated context),
  // since tentacle node positions are already computed as world coordinates.
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
