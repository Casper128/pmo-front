import { Component, Input } from '@angular/core';
import { StatisticsChartComponent } from '../statistics-chart/statistics-chart.component';
import { StatisticsChartItem } from '../statistics-chart/statistics-chart.model';

export type AnalyticsAccent = 'blue';

@Component({
  selector: 'app-analytics-chart-card',
  standalone: true,
  imports: [StatisticsChartComponent],
  templateUrl: './analytics-chart-card.component.html',
})
export class AnalyticsChartCardComponent {
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() data: StatisticsChartItem[] = [];
  @Input() type: 'doughnut' | 'pie' | 'bar' | 'line' = 'doughnut';
  @Input() ariaLabel = '';
  @Input() emptyMessage = 'Sin información para mostrar.';
  @Input() accent: AnalyticsAccent = 'blue';
  @Input() horizontal = false;
  @Input() configurable = false;
}
