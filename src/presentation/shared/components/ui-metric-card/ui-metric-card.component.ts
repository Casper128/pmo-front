import { Component, Input } from '@angular/core';

export type UiMetricTone = 'slate' | 'blue' | 'amber' | 'red';

@Component({
  selector: 'app-ui-metric-card',
  standalone: true,
  templateUrl: './ui-metric-card.component.html',
})
export class UiMetricCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() description = '';
  @Input() tone: UiMetricTone = 'slate';
}
