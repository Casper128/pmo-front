import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  Plugin,
  PointElement,
  Tooltip,
} from 'chart.js';

export interface StatisticsChartItem {
  label: string;
  hours: number;
  count?: number;
}

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip
);

@Component({
  selector: 'app-statistics-chart',
  standalone: true,
  template: `
    <div class="h-72 w-full"><canvas #canvas role="img" [attr.aria-label]="ariaLabel"></canvas></div>
    @if (type === 'line') {
      <div class="mt-3 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-blue-50 px-2 py-2"><p class="text-[10px] font-black uppercase text-blue-500">Total</p><p class="mt-1 text-xs font-black text-blue-900">{{ format(totalValue()) }} h</p></div>
        <div class="rounded-lg bg-emerald-50 px-2 py-2"><p class="text-[10px] font-black uppercase text-emerald-500">Promedio</p><p class="mt-1 text-xs font-black text-emerald-900">{{ format(averageValue()) }} h</p></div>
        <div class="rounded-lg bg-violet-50 px-2 py-2"><p class="text-[10px] font-black uppercase text-violet-500">Pico</p><p class="mt-1 truncate text-xs font-black text-violet-900">{{ peakText() }}</p></div>
      </div>
    } @else {
      <div class="mt-3 grid gap-1.5 sm:grid-cols-2">
        @for (item of data; track item.label; let index = $index) {
          <div class="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
            <span class="size-2.5 shrink-0 rounded-full" [style.background-color]="colorAt(index)"></span>
            <span class="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-600">{{ item.label }}</span>
            <span class="shrink-0 text-[11px] font-black text-slate-900">{{ format(item.hours) }} h · {{ percentage(item.hours) }}%</span>
          </div>
        }
      </div>
    }
  `,
})
export class StatisticsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) data: StatisticsChartItem[] = [];
  @Input() type: 'doughnut' | 'pie' | 'bar' | 'line' = 'doughnut';
  @Input() ariaLabel = 'Gráfico estadístico';
  @Input() horizontal = false;
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private readonly colors = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#64748b', '#ec4899'];

  ngAfterViewInit(): void { this.render(); }
  ngOnChanges(): void { this.render(); }
  ngOnDestroy(): void { this.chart?.destroy(); }

  totalValue(): number { return this.data.reduce((sum, item) => sum + item.hours, 0); }
  averageValue(): number { return this.data.length ? this.totalValue() / this.data.length : 0; }
  percentage(value: number): number { return this.totalValue() ? Math.round(value / this.totalValue() * 100) : 0; }
  colorAt(index: number): string { return this.colors[index % this.colors.length]; }
  peakText(): string {
    if (!this.data.length) return 'Sin datos';
    const peak = [...this.data].sort((a, b) => b.hours - a.hours)[0];
    return `${peak.label} · ${this.format(peak.hours)} h`;
  }
  format(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
  }

  private render(): void {
    if (!this.canvas) return;
    this.chart?.destroy();

    const isCircular = this.type === 'doughnut' || this.type === 'pie';
    const isLine = this.type === 'line';
    const xTicks = this.horizontal
      ? { color: '#64748b', callback: (value: unknown) => `${value} h` }
      : { color: '#64748b', maxRotation: 45, minRotation: 0 };
    const yTicks = this.horizontal
      ? {
          color: '#475569',
          font: { weight: 'bold' },
          callback: (value: unknown) => {
            const label = String(this.data[Number(value)]?.label || '');
            return label.length > 24 ? `${label.slice(0, 24)}…` : label;
          },
        }
      : { color: '#475569', callback: (value: unknown) => `${value} h` };
    const visibleLabels: Plugin = {
      id: 'visible-statistics-labels',
      afterDatasetsDraw: chart => {
        const context = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        context.save();
        context.font = '700 10px sans-serif';
        meta.data.forEach((element, index) => {
          const item = this.data[index];
          if (!item || !item.hours) return;
          const position = element.tooltipPosition(false);
          if (position.x === null || position.y === null) return;
          const reports = item.count ? ` · ${item.count} reg.` : '';
          const text = isCircular
            ? `${this.format(item.hours)} h · ${this.percentage(item.hours)}%`
            : `${this.format(item.hours)} h${reports}`;

          if (isCircular) {
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.lineWidth = 3;
            context.strokeStyle = 'rgba(15, 23, 42, .65)';
            context.fillStyle = '#ffffff';
            context.strokeText(text, position.x, position.y);
            context.fillText(text, position.x, position.y);
          } else if (this.horizontal) {
            context.textAlign = 'left';
            context.textBaseline = 'middle';
            context.fillStyle = '#1e3a8a';
            context.fillText(text, position.x + 6, position.y);
          } else {
            context.textAlign = 'center';
            context.textBaseline = 'bottom';
            context.fillStyle = '#1e3a8a';
            context.fillText(text, position.x, position.y - 7);
          }
        });
        context.restore();
      },
    };
    const config: any = {
      type: this.type,
      data: {
        labels: this.data.map(item => item.label),
        datasets: [{
          data: this.data.map(item => item.hours),
          backgroundColor: isCircular ? this.data.map((_, index) => this.colors[index % this.colors.length]) : isLine ? '#2563eb22' : '#2563eb',
          borderColor: isCircular ? '#ffffff' : '#2563eb',
          borderWidth: isCircular ? 3 : 2,
          borderRadius: this.type === 'bar' ? 7 : 0,
          fill: isLine,
          tension: isLine ? 0.35 : 0,
          pointBackgroundColor: '#2563eb',
          pointRadius: isLine ? 4 : 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: isCircular ? 0 : 22, right: this.horizontal ? 72 : 8 } },
        indexAxis: this.type === 'bar' && this.horizontal ? 'y' : 'x',
        cutout: this.type === 'doughnut' ? '62%' : undefined,
        plugins: {
          legend: {
            display: isCircular,
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 14, color: '#475569', font: { size: 11, weight: 'bold' } },
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const index = context.dataIndex;
                const item = this.data[index];
                const total = this.data.reduce((sum, value) => sum + value.hours, 0);
                const percentage = total ? Math.round((item.hours / total) * 100) : 0;
                const count = item.count ? ` · ${item.count} registros` : '';
                return `${item.label}: ${this.format(item.hours)} h (${percentage}%)${count}`;
              },
            },
          },
        },
        scales: isCircular ? undefined : {
          x: {
            beginAtZero: true,
            grid: { color: '#e2e8f0' },
            ticks: xTicks,
          },
          y: {
            beginAtZero: true,
            grid: { display: !this.horizontal, color: '#e2e8f0' },
            ticks: yTicks,
          },
        },
      },
      plugins: [visibleLabels],
    };
    this.chart = new Chart(this.canvas.nativeElement, config);
  }

}
