import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import {
  DEFAULT_JELLYFISH_CONFIG,
  JellyfishConfig,
  JellyfishConfigService
} from '../../services/jellyfish-config.service';

interface SliderSpec {
  key: keyof JellyfishConfig;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface SliderSection {
  title: string;
  controls: SliderSpec[];
}

// A live control panel for every tunable knob exposed by the jellyfish and
// its particle systems. There is no submit button -- the form pushes its
// full value onto JellyfishConfigService on every change, and the canvas
// component (subscribed to that service) applies it the same frame.
@Component({
  selector: 'app-jellyfish-controls',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatSliderModule, MatButtonModule, MatDividerModule],
  template: `
    <mat-card class="panel" (click)="$event.stopPropagation()">
      <mat-card-header>
        <mat-card-title>Jellyfish Controls</mat-card-title>
      </mat-card-header>

      <mat-card-content [formGroup]="form">
        @for (section of sections; track section.title) {
          <h3 class="section-title">{{ section.title }}</h3>

          @for (control of section.controls; track control.key) {
            <div class="control-row">
              <div class="control-label">
                <span>{{ control.label }}</span>
                <span class="control-value">{{ form.get(control.key)?.value }}</span>
              </div>
              <mat-slider
                  [min]="control.min"
                  [max]="control.max"
                  [step]="control.step"
                  discrete>
                <input matSliderThumb [formControlName]="control.key">
              </mat-slider>
            </div>
          }

          <mat-divider></mat-divider>
        }
      </mat-card-content>

      <mat-card-actions>
        <button mat-stroked-button (click)="resetToDefaults()">Reset to Defaults</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    :host {
      position: fixed;
      top: 16px;
      right: 16px;
      bottom: 16px;
      width: 320px;
      z-index: 10;
    }

    .panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: rgba(5, 15, 35, 0.82);
      backdrop-filter: blur(10px);
      color: rgba(255, 255, 255, 0.92);
    }

    mat-card-content {
      flex: 1;
      overflow-y: auto;
      padding-top: 4px;
    }

    .section-title {
      margin: 16px 0 4px;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgba(0, 240, 255, 0.85);
    }

    .control-row {
      margin-bottom: 4px;
    }

    .control-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      opacity: 0.9;
    }

    .control-value {
      font-variant-numeric: tabular-nums;
      opacity: 0.7;
    }

    mat-slider {
      width: 100%;
    }

    mat-divider {
      margin: 8px 0;
      border-color: rgba(255, 255, 255, 0.12);
    }

    mat-card-actions {
      padding: 8px 16px 16px;
    }
  `]
})
export class JellyfishControls {
  readonly form: FormGroup;

  readonly sections: SliderSection[] = [
    {
      title: 'Movement',
      controls: [
        { key: 'bellRadius', label: 'Bell Size', min: 20, max: 100, step: 1 },
        { key: 'chaseSpeed', label: 'Chase Speed', min: 0.01, max: 0.15, step: 0.005 },
        { key: 'pulseSpeed', label: 'Pulse Speed', min: 0.01, max: 0.1, step: 0.005 },
        { key: 'idleDartDelaySeconds', label: 'Idle Dart Delay (s)', min: 1, max: 30, step: 1 }
      ]
    },
    {
      title: 'Tentacles',
      controls: [
        { key: 'tentacleCount', label: 'Tentacle Count', min: 4, max: 40, step: 1 },
        { key: 'tentacleLength', label: 'Tentacle Length', min: 10, max: 50, step: 1 },
        { key: 'tentacleWaveAmplitude', label: 'Wave Amplitude', min: 0, max: 5, step: 0.1 }
      ]
    },
    {
      title: 'Orbs',
      controls: [
        { key: 'orbCount', label: 'Orb Count', min: 0, max: 20, step: 1 },
        { key: 'orbInfluenceRadius', label: 'Influence Radius', min: 1, max: 6, step: 0.1 }
      ]
    },
    {
      title: 'Skirt',
      controls: [
        { key: 'skirtRippleAmplitude', label: 'Ripple Amplitude', min: 0, max: 0.3, step: 0.01 },
        { key: 'skirtSwayAmplitude', label: 'Sway Amplitude', min: 0, max: 0.1, step: 0.005 }
      ]
    },
    {
      title: 'Sheath',
      controls: [
        { key: 'sheathStrandCount', label: 'Strand Count', min: 4, max: 30, step: 1 },
        { key: 'sheathLength', label: 'Length', min: 0.5, max: 3, step: 0.05 },
        { key: 'sheathFlareAmount', label: 'Flare Amount', min: 0.5, max: 3, step: 0.05 }
      ]
    },
    {
      title: 'Bokeh',
      controls: [
        { key: 'bokehParallaxStrength', label: 'Parallax Strength', min: 0, max: 3, step: 0.1 },
        { key: 'bokehParticleDensity', label: 'Particle Density', min: 0.2, max: 3, step: 0.1 },
        { key: 'bokehPopIntervalSeconds', label: 'Pop Interval (s)', min: 5, max: 60, step: 1 }
      ]
    }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly configService: JellyfishConfigService
  ) {
    this.form = this.fb.group(DEFAULT_JELLYFISH_CONFIG);

    this.form.valueChanges.subscribe(value => {
      this.configService.update(value as Partial<JellyfishConfig>);
    });
  }

  resetToDefaults(): void {
    this.form.reset(DEFAULT_JELLYFISH_CONFIG);
  }
}
