import {Component, signal} from '@angular/core';
import {JellyfishCanvasComponent} from './components/jellyfish-canvas-component/jellyfish-canvas-component';
import {JellyfishControls} from './components/jellyfish-controls/jellyfish-controls';

@Component({
  selector: 'app-root',
  standalone: true,
  styleUrls: ['./app.scss'],
  imports: [JellyfishCanvasComponent, JellyfishControls],
  template: `
    <app-jellyfish-canvas></app-jellyfish-canvas>
    <app-jellyfish-controls></app-jellyfish-controls>
  `
})
export class App {
  protected readonly title = signal('vector-jellyfish');
}
