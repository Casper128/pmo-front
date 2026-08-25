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
  LinearScale,
  Plugin,
  Tooltip,
} from 'chart.js';

interface DailyHours {
  shortLabel: string;
  label: string;
  hours: number;
  count: number;
}

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

@Component({
  selector: 'app-weekly-hours-chart',
  standalone: true,
  styleUrl: './weekly-hours-chart.component.css',
  templateUrl: './weekly-hours-chart.component.html',
})
export class WeeklyHoursChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) data: DailyHours[] = [];
  @ViewChild('chartCanvas') private chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart<'bar'>;
  private themeObserver?: MutationObserver;

  ngAfterViewInit(): void {
    this.renderChart();
    this.themeObserver = new MutationObserver(() => this.renderChart());
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  ngOnChanges(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.themeObserver?.disconnect();
    this.chart?.destroy();
  }

  formatHours(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
  }

  private renderChart(): void {
    if (!this.chartCanvas) return;

    const labels = this.data.map((day) => day.shortLabel);
    const hours = this.data.map((day) => day.hours);
    const fullLabels = this.data.map((day) => day.label);
    const counts = this.data.map((day) => day.count);
    const theme = this.currentTheme();
    const valueLabels: Plugin<'bar'> = {
      id: 'visible-hour-labels',
      afterDatasetsDraw: (chart) => {
        if (this.data.length > 14) return;
        const currentData = this.data;
        const context = chart.ctx;
        const compact = chart.width < 560;
        context.save();
        context.fillStyle = theme.valueLabel;
        context.font = `700 ${compact ? 9 : 11}px sans-serif`;
        context.textAlign = 'center';
        chart.getDatasetMeta(0).data.forEach((element, index) => {
          const value = currentData[index]?.hours || 0;
          if (!value) return;
          const count = currentData[index]?.count || 0;
          const reports = count === 1 ? '1 reg.' : `${count} reg.`;
          if (compact) {
            context.fillText(`${this.formatHours(value)} h`, element.x, element.y - 14);
            context.fillText(reports, element.x, element.y - 3);
          } else {
            context.fillText(`${this.formatHours(value)} h · ${reports}`, element.x, element.y - 7);
          }
        });
        context.restore();
      },
    };

    const config: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: hours,
            backgroundColor: theme.bar,
            borderColor: theme.barBorder,
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 52,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 2,
        animation: { duration: 250 },
        layout: { padding: { top: 30, right: 4, left: 2 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBackground,
            titleColor: theme.tooltipTitle,
            bodyColor: theme.tooltipBody,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              title: (items) => fullLabels[items[0]?.dataIndex ?? 0] || '',
              label: (item) => {
                const index = item.dataIndex;
                const value = Number(item.raw || 0);
                const suffix = counts[index] === 1 ? 'reporte' : 'reportes';
                return `${value.toFixed(value % 1 === 0 ? 0 : 1)} h · ${counts[index]} ${suffix}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.axisStrong, font: { weight: 'bold' } },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.grid },
            ticks: {
              color: theme.axis,
              callback: (value) => `${value} h`,
            },
          },
        },
      },
      plugins: [valueLabels],
    };

    this.chart?.destroy();
    this.chart = new Chart(this.chartCanvas.nativeElement, config);
  }

  private currentTheme(): {
    axis: string;
    axisStrong: string;
    bar: string;
    barBorder: string;
    grid: string;
    tooltipBackground: string;
    tooltipTitle: string;
    tooltipBody: string;
    tooltipBorder: string;
    valueLabel: string;
  } {
    const isDark = document.documentElement.dataset['theme'] === 'dark';
    return isDark
      ? {
          axis: '#a1a1a6',
          axisStrong: '#c7c7cc',
          bar: '#7db7ff',
          barBorder: '#9dccff',
          grid: 'rgba(229, 231, 235, .24)',
          tooltipBackground: '#f5f5f7',
          tooltipTitle: '#111827',
          tooltipBody: '#374151',
          tooltipBorder: 'rgba(255, 255, 255, .18)',
          valueLabel: '#b9dcff',
        }
      : {
          axis: '#64748b',
          axisStrong: '#475569',
          bar: '#2563eb',
          barBorder: '#1d4ed8',
          grid: '#e2e8f0',
          tooltipBackground: '#0f172a',
          tooltipTitle: '#ffffff',
          tooltipBody: '#e2e8f0',
          tooltipBorder: 'rgba(15, 23, 42, .12)',
          valueLabel: '#1e3a8a',
        };
  }
}
