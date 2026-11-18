import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { resolveStatisticsChartTheme } from '../statistics-chart/statistics-chart-config.factory';

export interface GroupedBarSeries {
  label: string;
  /** Un valor por etiqueta; null deja el hueco vacío. */
  values: (number | null)[];
  /** Color único o uno por barra. */
  color: string | string[];
}

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

/** Barras con varias series (agrupadas o apiladas) con la paleta de `statistics-chart`. */
@Component({
  selector: 'app-grouped-bar-chart',
  standalone: true,
  template: `
    <div class="relative w-full min-w-0" [style.height.px]="chartHeight()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel"></canvas>
    </div>
  `,
  styles: ':host { display: block; min-width: 0; max-width: 100%; }',
})
export class GroupedBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) labels: string[] = [];
  @Input({ required: true }) series: GroupedBarSeries[] = [];
  @Input() ariaLabel = 'Gráfico de barras';
  @Input() stacked = false;
  @Input() horizontal = false;
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart<'bar', (number | null)[], string>;
  private themeObserver?: MutationObserver;

  ngAfterViewInit(): void {
    this.render();
    this.themeObserver = new MutationObserver(() => this.render());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  ngOnChanges(): void {
    this.render();
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
    this.chart?.destroy();
  }

  chartHeight(): number {
    if (!this.horizontal) return 340;
    const perLabel = this.stacked ? 40 : 18 + this.series.length * 16;
    return Math.min(640, Math.max(280, this.labels.length * perLabel + 90));
  }

  private render(): void {
    if (!this.canvas) return;
    this.chart?.destroy();
    const theme = resolveStatisticsChartTheme();
    const format = (value: number) =>
      new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
    const valueAxis = {
      beginAtZero: true,
      stacked: this.stacked,
      grid: { color: theme.grid },
      ticks: { color: theme.axis, callback: (value: string | number) => `${value} h` },
    };
    const categoryAxis = {
      stacked: this.stacked,
      grid: { display: false },
      ticks: {
        color: theme.axisStrong,
        autoSkip: !this.horizontal,
        font: { size: 12, weight: 'bold' as const },
        callback: (_: string | number, index: number) =>
          this.wrap(this.labels[index] || '', this.horizontal ? 24 : 14),
      },
    };
    const config: ChartConfiguration<'bar', (number | null)[], string> = {
      type: 'bar',
      data: {
        labels: this.labels,
        datasets: this.series.map((serie) => ({
          label: serie.label,
          data: serie.values,
          backgroundColor: serie.color,
          borderColor: serie.color,
          borderWidth: 1,
          borderRadius: this.stacked ? 4 : 6,
          maxBarThickness: 44,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 2,
        animation: { duration: 250 },
        indexAxis: this.horizontal ? 'y' : 'x',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              boxWidth: 11,
              boxHeight: 11,
              usePointStyle: true,
              padding: 16,
              color: theme.axisStrong,
              font: { size: 13, weight: 'bold' as const },
            },
          },
          tooltip: {
            backgroundColor: theme.tooltipBackground,
            titleColor: theme.tooltipTitle,
            bodyColor: theme.tooltipBody,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              title: (items) => this.labels[items[0]?.dataIndex ?? 0] || '',
              label: (item) =>
                item.raw === null || item.raw === undefined
                  ? `${item.dataset.label}: —`
                  : `${item.dataset.label}: ${format(Number(item.raw))} h`,
            },
          },
        },
        scales: this.horizontal
          ? { x: valueAxis, y: categoryAxis }
          : { x: categoryAxis, y: valueAxis },
      },
    };
    this.chart = new Chart(this.canvas.nativeElement, config);
  }

  private wrap(label: string, maxLength: number): string[] {
    const lines: string[] = [];
    let current = '';
    label
      .split(/\s+/)
      .filter(Boolean)
      .forEach((word) => {
        if (current && `${current} ${word}`.length > maxLength) {
          lines.push(current);
          current = word;
        } else {
          current = current ? `${current} ${word}` : word;
        }
      });
    if (current) lines.push(current);
    return lines
      .slice(0, 2)
      .map((line, index) => (index === 1 && lines.length > 2 ? `${line}…` : line));
  }
}
