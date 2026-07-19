import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/*The full set of live-tunable knobs for the jellyfish and its particle
systems. Values here mirror the defaults baked into each system class --
this service is just the shared, reactive channel the control panel writes
to and the canvas component reads from.*/
export interface JellyfishConfig {
  bellRadius: number;
  chaseSpeed: number;
  pulseSpeed: number;
  idleDartDelaySeconds: number;

  tentacleCount: number;
  tentacleLength: number;
  tentacleWaveAmplitude: number;

  orbCount: number;
  orbInfluenceRadius: number;

  skirtRippleAmplitude: number;
  skirtSwayAmplitude: number;

  sheathStrandCount: number;
  sheathLength: number;
  sheathFlareAmount: number;

  bokehParallaxStrength: number;
  bokehParticleDensity: number;
  bokehPopIntervalSeconds: number;

  seaweedCount: number;
  seaweedBranchDepth: number;
  seaweedLength: number;
  seaweedSwayAmplitude: number;
  seaweedSwaySpeed: number;
  seaweedMouseInfluence: number;
}

export const DEFAULT_JELLYFISH_CONFIG: JellyfishConfig = {
  bellRadius: 50,
  chaseSpeed: 0.03,
  pulseSpeed: 0.04,
  idleDartDelaySeconds: 5,

  tentacleCount: 24,
  tentacleLength: 30,
  tentacleWaveAmplitude: 1.5,

  orbCount: 7,
  orbInfluenceRadius: 3,

  skirtRippleAmplitude: 0.12,
  skirtSwayAmplitude: 0.04,

  sheathStrandCount: 14,
  sheathLength: 1.2,
  sheathFlareAmount: 1.8,

  bokehParallaxStrength: 1,
  bokehParticleDensity: 1,
  bokehPopIntervalSeconds: 30,

  seaweedCount: 9,
  seaweedBranchDepth: 6,
  seaweedLength: 60,
  seaweedSwayAmplitude: 0.35,
  seaweedSwaySpeed: 0.02,
  seaweedMouseInfluence: 140
};

@Injectable({ providedIn: 'root' })
export class JellyfishConfigService {
  private readonly configSubject = new BehaviorSubject<JellyfishConfig>({ ...DEFAULT_JELLYFISH_CONFIG });

  readonly config$: Observable<JellyfishConfig> = this.configSubject.asObservable();

  get snapshot(): JellyfishConfig {
    return this.configSubject.value;
  }

  update(patch: Partial<JellyfishConfig>): void {
    this.configSubject.next({ ...this.configSubject.value, ...patch });
  }

  reset(): void {
    this.configSubject.next({ ...DEFAULT_JELLYFISH_CONFIG });
  }
}
