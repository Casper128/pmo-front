import { Component, Input } from '@angular/core';
import {
  StatisticsChartComponent,
  StatisticsChartItem,
} from '../statistics-chart/statistics-chart.component';

export type AnalyticsAccent =
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'cyan'
  | 'rose'
  | 'orange'
  | 'red'
  | 'fuchsia'
  | 'indigo';

@Component({
  selector: 'app-analytics-chart-card',
  standalone: true,
  imports: [StatisticsChartComponent],
  template: `
    <article
      class="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div class="min-w-0">
        <p
          class="text-[11px] font-black uppercase tracking-widest"
          [class.text-blue-600]="accent === 'blue'"
          [class.text-violet-600]="accent === 'violet'"
          [class.text-emerald-600]="accent === 'emerald'"
          [class.text-amber-600]="accent === 'amber'"
          [class.text-cyan-600]="accent === 'cyan'"
          [class.text-rose-600]="accent === 'rose'"
          [class.text-orange-600]="accent === 'orange'"
          [class.text-red-600]="accent === 'red'"
          [class.text-fuchsia-600]="accent === 'fuchsia'"
          [class.text-indigo-600]="accent === 'indigo'"
        >
          {{ eyebrow }}
        </p>
        <h2 class="mt-1 break-words text-lg font-black text-slate-900">{{ title }}</h2>
        @if (description) {
          <p class="mt-1 break-words text-sm text-slate-500">{{ description }}</p>
        }
      </div>

      <div class="mt-4 min-w-0 flex-1">
        @if (data.length) {
          <app-statistics-chart
            [type]="type"
            [data]="data"
            [ariaLabel]="ariaLabel || title"
            [horizontal]="horizontal"
            [configurable]="configurable"
          />
        } @else {
          <div
            class="grid h-72 place-items-center px-4 text-center text-sm font-bold text-slate-400"
          >
            {{ emptyMessage }}
          </div>
        }
      </div>
      <ng-content select="[chartCardFooter]" />
    </article>
  `,
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
