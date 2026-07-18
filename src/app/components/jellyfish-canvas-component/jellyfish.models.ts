export interface Point {
  x: number;
  y: number;
}

export interface TentacleNode {
  x: number;
  y: number;
}

export interface GlowOrb {
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

export interface BokehParticle {
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

export interface BokehLayerConfig {
  count: number;
  radiusRange: [number, number];
  opacityRange: [number, number];
  parallaxRange: number;
  bobAmount: number;
  driftSpeedScale: number;
  outline?: boolean;
}
