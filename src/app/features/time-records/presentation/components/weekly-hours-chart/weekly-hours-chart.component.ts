import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { BarController, BarElement, CategoryScale, Chart, ChartConfiguration, LinearScale, Plugin, Tooltip } from 'chart.js';

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
  styles: [`:host { display: block; min-width: 0; max-width: 100%; }`],
  template: `
    <div class="h-64 w-full min-w-0 sm:h-72 lg:h-80">
      <canvas #chartCanvas aria-label="Horas reportadas por día de la semana" role="img"></canvas>
    </div>
  `,
})
export class WeeklyHoursChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) data: DailyHours[] = [];
  @ViewChild('chartCanvas') private chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart<'bar'>;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(): void {
    this.renderChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  formatHours(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
  }

  private renderChart(): void {
    if (!this.chartCanvas) return;

    const labels = this.data.map(day => day.shortLabel);
    const hours = this.data.map(day => day.hours);
    const fullLabels = this.data.map(day => day.label);
    const counts = this.data.map(day => day.count);
    const valueLabels: Plugin<'bar'> = {
      id: 'visible-hour-labels',
      afterDatasetsDraw: chart => {
        if (this.data.length > 14) return;
        const context = chart.ctx;
        const compact = chart.width < 560;
        context.save();
        context.fillStyle = '#1e3a8a';
        context.font = `700 ${compact ? 9 : 11}px sans-serif`;
        context.textAlign = 'center';
        chart.getDatasetMeta(0).data.forEach((element, index) => {
          const value = hours[index];
          if (!value) return;
          const reports = counts[index] === 1 ? '1 reg.' : `${counts[index]} reg.`;
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
            backgroundColor: '#2563eb',
            borderColor: '#1d4ed8',
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
            callbacks: {
              title: items => fullLabels[items[0]?.dataIndex ?? 0] || '',
              label: item => {
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
            ticks: { color: '#475569', font: { weight: 'bold' } },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#e2e8f0' },
            ticks: {
              color: '#64748b',
              callback: value => `${value} h`,
            },
          },
        },
      },
      plugins: [valueLabels],
    };

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = hours;
      this.chart.options.plugins!.tooltip = config.options!.plugins!.tooltip;
      this.chart.update();
      return;
    }

    this.chart = new Chart(this.chartCanvas.nativeElement, config);
  }
}
