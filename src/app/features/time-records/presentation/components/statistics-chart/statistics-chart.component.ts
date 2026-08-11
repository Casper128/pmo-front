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
  styles: [`:host { display: block; min-width: 0; max-width: 100%; }`],
  template: `
    <div class="relative w-full min-w-0" [style.height.px]="chartHeight()"><canvas #canvas role="img" [attr.aria-label]="ariaLabel"></canvas></div>
    @if (type === 'line') {
      <div class="mt-3 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-blue-50 px-2 py-2"><p class="text-[10px] font-black uppercase text-blue-500">Total</p><p class="mt-1 text-xs font-black text-blue-900">{{ format(totalValue()) }} h</p></div>
        <div class="rounded-lg bg-emerald-50 px-2 py-2"><p class="text-[10px] font-black uppercase text-emerald-500">Promedio</p><p class="mt-1 text-xs font-black text-emerald-900">{{ format(averageValue()) }} h</p></div>
        <div class="rounded-lg bg-violet-50 px-2 py-2"><p class="text-[10px] font-black uppercase text-violet-500">Pico</p><p class="mt-1 break-words text-xs font-black text-violet-900">{{ peakText() }}</p></div>
      </div>
    } @else {
      <div class="mt-3 grid gap-1.5 sm:grid-cols-2">
        @for (item of data; track item.label; let index = $index) {
          <div class="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
            <span class="size-2.5 shrink-0 rounded-full" [style.background-color]="colorAt(index)"></span>
            <span class="min-w-0 flex-1 break-words text-[11px] font-bold leading-snug text-slate-600">{{ item.label }}</span>
            <span class="shrink-0 text-[11px] font-black text-slate-900">{{ format(item.hours) }} h · {{ percentage(item.hours) }}%</span>
          </div>
        }
      </div>
    }
    <div class="mt-3 flex justify-end">
      <button class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-50" type="button" (click)="downloadPng()">
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" /></svg>
        Descargar PNG
      </button>
    </div>
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
  chartHeight(): number {
    if (this.horizontal) return Math.min(580, Math.max(300, this.data.length * 66 + 90));
    if (this.type === 'doughnut' || this.type === 'pie') return 320;
    if (this.type === 'bar') return 380;
    return 300;
  }
  peakText(): string {
    if (!this.data.length) return 'Sin datos';
    const peak = [...this.data].sort((a, b) => b.hours - a.hours)[0];
    return `${peak.label} · ${this.format(peak.hours)} h`;
  }
  format(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
  }

  downloadPng(): void {
    const source = this.canvas?.nativeElement;
    if (!source) return;
    const pixelRatio = Math.max(2, window.devicePixelRatio || 1);
    const isLine = this.type === 'line';
    const exportItems = isLine ? [] : this.data.slice(0, 12);
    const width = Math.max(source.width, Math.round(1200 * pixelRatio));
    const chartHeight = Math.round(source.height * (width / source.width));
    const headerHeight = Math.round(126 * pixelRatio);
    const legendRowHeight = Math.round(76 * pixelRatio);
    const detailsHeight = isLine
      ? Math.round(190 * pixelRatio)
      : Math.round((exportItems.length * 76 + 70) * pixelRatio);
    const footerHeight = Math.round(52 * pixelRatio);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = headerHeight + chartHeight + detailsHeight + footerHeight;
    const context = exportCanvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = Math.max(2, Math.round(pixelRatio));
    context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, exportCanvas.width - context.lineWidth, exportCanvas.height - context.lineWidth);

    context.fillStyle = '#0f172a';
    context.font = `700 ${Math.round(30 * pixelRatio)}px sans-serif`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(this.ariaLabel, Math.round(32 * pixelRatio), Math.round(48 * pixelRatio), exportCanvas.width - Math.round(64 * pixelRatio));
    context.fillStyle = '#64748b';
    context.font = `600 ${Math.round(18 * pixelRatio)}px sans-serif`;
    const totalRecords = this.data.reduce((sum, item) => sum + (item.count || 0), 0);
    context.fillText(
      `${this.format(this.totalValue())} horas · ${totalRecords ? `${totalRecords} registros` : `${this.data.length} puntos analizados`}`,
      Math.round(32 * pixelRatio),
      Math.round(91 * pixelRatio)
    );
    context.strokeStyle = '#e2e8f0';
    context.beginPath();
    context.moveTo(Math.round(32 * pixelRatio), headerHeight - Math.round(10 * pixelRatio));
    context.lineTo(exportCanvas.width - Math.round(32 * pixelRatio), headerHeight - Math.round(10 * pixelRatio));
    context.stroke();
    context.drawImage(source, 0, headerHeight, width, chartHeight);

    const detailsTop = headerHeight + chartHeight;
    context.fillStyle = '#f8fafc';
    context.fillRect(0, detailsTop, width, detailsHeight);
    context.textBaseline = 'middle';
    context.fillStyle = '#334155';
    context.font = `700 ${Math.round(20 * pixelRatio)}px sans-serif`;
    context.fillText(isLine ? 'Resumen del periodo' : 'Leyenda y detalle de categorías', Math.round(32 * pixelRatio), detailsTop + Math.round(35 * pixelRatio));

    if (isLine) {
      const cards = [
        { label: 'TOTAL', value: `${this.format(this.totalValue())} h`, color: '#1d4ed8', background: '#eff6ff' },
        { label: 'PROMEDIO', value: `${this.format(this.averageValue())} h`, color: '#047857', background: '#ecfdf5' },
        { label: 'PICO', value: this.peakText(), color: '#6d28d9', background: '#f5f3ff' },
      ];
      const gap = Math.round(18 * pixelRatio);
      const margin = Math.round(32 * pixelRatio);
      const cardWidth = (width - margin * 2 - gap * 2) / 3;
      cards.forEach((card, index) => {
        const x = margin + index * (cardWidth + gap);
        const y = detailsTop + Math.round(65 * pixelRatio);
        context.fillStyle = card.background;
        context.fillRect(x, y, cardWidth, Math.round(92 * pixelRatio));
        context.fillStyle = card.color;
        context.font = `700 ${Math.round(14 * pixelRatio)}px sans-serif`;
        context.fillText(card.label, x + Math.round(18 * pixelRatio), y + Math.round(27 * pixelRatio));
        context.font = `700 ${Math.round(21 * pixelRatio)}px sans-serif`;
        context.fillText(card.value, x + Math.round(18 * pixelRatio), y + Math.round(62 * pixelRatio), cardWidth - Math.round(36 * pixelRatio));
      });
    } else {
      exportItems.forEach((item, index) => {
        const rowTop = detailsTop + Math.round(62 * pixelRatio) + index * legendRowHeight;
        const centerY = rowTop + Math.round(27 * pixelRatio);
        context.fillStyle = index % 2 ? '#ffffff' : '#f8fafc';
        context.fillRect(Math.round(22 * pixelRatio), rowTop, width - Math.round(44 * pixelRatio), legendRowHeight);
        context.fillStyle = this.colorAt(index);
        context.beginPath();
        context.arc(Math.round(44 * pixelRatio), centerY, Math.round(9 * pixelRatio), 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#1e293b';
        context.font = `700 ${Math.round(20 * pixelRatio)}px sans-serif`;
        context.fillText(item.label, Math.round(66 * pixelRatio), centerY, width - Math.round(98 * pixelRatio));
        context.fillStyle = '#475569';
        context.font = `600 ${Math.round(16 * pixelRatio)}px sans-serif`;
        const count = item.count ? ` · ${item.count} registros` : '';
        context.fillText(
          `${this.format(item.hours)} horas · ${this.percentage(item.hours)}% del total${count}`,
          Math.round(66 * pixelRatio),
          centerY + Math.round(28 * pixelRatio),
          width - Math.round(98 * pixelRatio)
        );
      });
    }

    const footerTop = exportCanvas.height - footerHeight;
    context.fillStyle = '#ffffff';
    context.fillRect(0, footerTop, width, footerHeight);
    context.fillStyle = '#64748b';
    context.font = `600 ${Math.round(14 * pixelRatio)}px sans-serif`;
    context.fillText('Fuente: reportes de tiempos PMO · Imagen generada en alta resolución', Math.round(32 * pixelRatio), footerTop + footerHeight / 2);
    const link = document.createElement('a');
    link.download = `${this.ariaLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  private render(): void {
    if (!this.canvas) return;
    this.chart?.destroy();

    const isCircular = this.type === 'doughnut' || this.type === 'pie';
    const isLine = this.type === 'line';
    const xTicks = this.horizontal
      ? { color: '#64748b', callback: (value: unknown) => `${value} h` }
      : this.type === 'bar'
        ? {
            color: '#475569',
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            font: { size: 12, weight: 'bold' },
            callback: (value: unknown) => this.wrapLabel(String(this.data[Number(value)]?.label || ''), 14),
          }
        : { color: '#64748b', maxRotation: 0, minRotation: 0 };
    const yTicks = this.horizontal
      ? {
          color: '#475569',
          font: { size: 12, weight: 'bold' },
          callback: (value: unknown) => {
            const label = String(this.data[Number(value)]?.label || '');
            return this.wrapLabel(label, 18);
          },
        }
      : { color: '#475569', callback: (value: unknown) => `${value} h` };
    const visibleLabels: Plugin = {
      id: 'visible-statistics-labels',
      afterDatasetsDraw: chart => {
        const context = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        const compact = chart.width < 520;
        context.save();
        context.font = `700 ${compact ? 11 : 12}px sans-serif`;
        meta.data.forEach((element, index) => {
          const item = this.data[index];
          if (!item || !item.hours) return;
          const position = element.tooltipPosition(false);
          if (position.x === null || position.y === null) return;
          const reports = item.count ? ` · ${item.count} reg.` : '';
          const text = isCircular
            ? compact ? `${this.percentage(item.hours)}%` : `${this.format(item.hours)} h · ${this.percentage(item.hours)}%`
            : compact ? `${this.format(item.hours)} h` : `${this.format(item.hours)} h${reports}`;

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
            context.fillText(text, position.x + 5, position.y, compact ? 54 : 92);
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
          backgroundColor: isCircular
            ? this.data.map((_, index) => this.colorAt(index))
            : isLine
              ? '#2563eb22'
              : this.data.map((_, index) => this.colorAt(index)),
          borderColor: isCircular
            ? '#ffffff'
            : isLine
              ? '#2563eb'
              : this.data.map((_, index) => this.colorAt(index)),
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
        devicePixelRatio: 3,
        layout: { padding: { top: isCircular ? 4 : 24, right: this.horizontal ? 102 : 10, left: 4, bottom: 4 } },
        indexAxis: this.type === 'bar' && this.horizontal ? 'y' : 'x',
        cutout: this.type === 'doughnut' ? '62%' : undefined,
        plugins: {
          legend: {
            display: isCircular,
            position: 'bottom',
            labels: { boxWidth: 11, boxHeight: 11, usePointStyle: true, padding: 16, color: '#475569', font: { size: 13, weight: 'bold' } },
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

  private wrapLabel(label: string, maxLength: number): string[] {
    const words = label.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    words.forEach(word => {
      if (word.length > maxLength) {
        if (current) lines.push(current);
        for (let index = 0; index < word.length; index += maxLength) lines.push(word.slice(index, index + maxLength));
        current = '';
      } else if (!current || `${current} ${word}`.length <= maxLength) {
        current = current ? `${current} ${word}` : word;
      } else {
        lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

}
