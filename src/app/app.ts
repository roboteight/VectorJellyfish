import {Component, signal} from '@angular/core';
import {JellyfishCanvasComponent} from './components/jellyfish-canvas-component/jellyfish-canvas-component';

@Component({
  selector: 'app-root',
  standalone: true,
  styleUrls: ['./app.scss'],
  imports: [JellyfishCanvasComponent],
  template: `<app-jellyfish-canvas></app-jellyfish-canvas>`
})
export class App {
  protected readonly title = signal('vector-jellyfish');
}
