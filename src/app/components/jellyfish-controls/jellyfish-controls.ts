import {Component} from '@angular/core';
import {ReactiveFormsModule, FormBuilder, FormGroup} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatSliderModule} from '@angular/material/slider';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatSidenavModule} from '@angular/material/sidenav';
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

/*A live control panel for every tunable knob exposed by the jellyfish and
its particle systems. There is no submit button -- the form pushes its
full value onto JellyfishConfigService on every change, and the canvas
component (subscribed to that service) applies it the same frame.*/
@Component({
    selector: 'app-jellyfish-controls',
    standalone: true,
    imports: [ReactiveFormsModule, MatCardModule, MatSliderModule, MatButtonModule, MatDividerModule, MatSidenavModule],
    templateUrl: './jellyfish-controls.html',
    styleUrl: './jellyfish-controls.scss',
})
export class JellyfishControls {
    readonly form: FormGroup;

/*    Drawer starts closed; the toggle button (shown when hidden) and the
    close button in the panel header (shown when open) both flip this.*/
    isOpen = false;

    readonly sections: SliderSection[] = [
        {
            title: 'Movement',
            controls: [
                {key: 'bellRadius', label: 'Bell Size', min: 20, max: 100, step: 1},
                {key: 'chaseSpeed', label: 'Chase Speed', min: 0.01, max: 0.15, step: 0.005},
                {key: 'pulseSpeed', label: 'Pulse Speed', min: 0.01, max: 0.1, step: 0.005},
                {key: 'idleDartDelaySeconds', label: 'Idle Dart Delay (s)', min: 1, max: 30, step: 1}
            ]
        },
        {
            title: 'Tentacles',
            controls: [
                {key: 'tentacleCount', label: 'Tentacle Count', min: 4, max: 40, step: 1},
                {key: 'tentacleLength', label: 'Tentacle Length', min: 10, max: 50, step: 1},
                {key: 'tentacleWaveAmplitude', label: 'Wave Amplitude', min: 0, max: 5, step: 0.1}
            ]
        },
        {
            title: 'Orbs',
            controls: [
                {key: 'orbCount', label: 'Orb Count', min: 0, max: 20, step: 1},
                {key: 'orbInfluenceRadius', label: 'Influence Radius', min: 1, max: 6, step: 0.1}
            ]
        },
        {
            title: 'Skirt',
            controls: [
                {key: 'skirtRippleAmplitude', label: 'Ripple Amplitude', min: 0, max: 0.3, step: 0.01},
                {key: 'skirtSwayAmplitude', label: 'Sway Amplitude', min: 0, max: 0.1, step: 0.005}
            ]
        },
        {
            title: 'Sheath',
            controls: [
                {key: 'sheathStrandCount', label: 'Strand Count', min: 4, max: 30, step: 1},
                {key: 'sheathLength', label: 'Length', min: 0.5, max: 3, step: 0.05},
                {key: 'sheathFlareAmount', label: 'Flare Amount', min: 0.5, max: 3, step: 0.05}
            ]
        },
        {
            title: 'Bokeh',
            controls: [
                {key: 'bokehParallaxStrength', label: 'Parallax Strength', min: 0, max: 3, step: 0.1},
                {key: 'bokehParticleDensity', label: 'Particle Density', min: 0.2, max: 3, step: 0.1},
                {key: 'bokehPopIntervalSeconds', label: 'Pop Interval (s)', min: 5, max: 60, step: 1}
            ]
        },
        {
            title: 'Seaweed',
            controls: [
                {key: 'seaweedCount', label: 'Plant Count', min: 3, max: 20, step: 1},
                {key: 'seaweedBranchDepth', label: 'Branch Depth', min: 3, max: 8, step: 1},
                {key: 'seaweedLength', label: 'Length', min: 20, max: 120, step: 5},
                {key: 'seaweedSwayAmplitude', label: 'Sway Amplitude', min: 0, max: 1, step: 0.05},
                {key: 'seaweedSwaySpeed', label: 'Sway Speed', min: 0.005, max: 0.05, step: 0.005},
                {key: 'seaweedMouseInfluence', label: 'Mouse Influence', min: 40, max: 300, step: 10}
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
