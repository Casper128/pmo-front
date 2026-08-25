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
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartType,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import {
  StatisticsChartConfigFactory,
  StatisticsChartTheme,
} from './statistics-chart-config.factory';
import { StatisticsChartItem } from './statistics-chart.model';

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
  Tooltip,
);

@Component({
  selector: 'app-statistics-chart',
  standalone: true,
  imports: [OverflowTooltipDirective],
  styleUrl: './statistics-chart.component.css',
  templateUrl: './statistics-chart.component.html',
})
export class StatisticsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) data: StatisticsChartItem[] = [];
  @Input() type: 'doughnut' | 'pie' | 'bar' | 'line' = 'doughnut';
  @Input() ariaLabel = 'Gráfico estadístico';
  @Input() horizontal = false;
  @Input() configurable = false;
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private readonly configFactory = new StatisticsChartConfigFactory();
  private themeObserver?: MutationObserver;
  private horizontalOverride: boolean | null = null;
  private axisLabelsOverride: boolean | null = null;
  showValues = true;
  showLegend = true;
  private readonly colors = [
    '#2563eb',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#06b6d4',
    '#ef4444',
    '#64748b',
    '#ec4899',
  ];

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

  totalValue(): number {
    return this.data.reduce((sum, item) => sum + item.hours, 0);
  }
  averageValue(): number {
    return this.data.length ? this.totalValue() / this.data.length : 0;
  }
  percentage(value: number): number {
    return this.totalValue() ? Math.round((value / this.totalValue()) * 100) : 0;
  }
  colorAt(index: number): string {
    return this.colors[index % this.colors.length];
  }
  isCircular(): boolean {
    return this.type === 'doughnut' || this.type === 'pie';
  }
  effectiveHorizontal(): boolean {
    return this.horizontalOverride ?? this.horizontal;
  }
  effectiveShowAxisLabels(): boolean {
    if (this.axisLabelsOverride !== null) return this.axisLabelsOverride;
    return !(this.type === 'bar' && !this.effectiveHorizontal() && this.data.length >= 5);
  }
  chartHeight(): number {
    if (this.effectiveHorizontal()) return Math.min(580, Math.max(300, this.data.length * 66 + 90));
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

  toggleOrientation(): void {
    this.horizontalOverride = !this.effectiveHorizontal();
    this.render();
  }

  toggleAxisLabels(): void {
    this.axisLabelsOverride = !this.effectiveShowAxisLabels();
    this.render();
  }

  toggleValues(): void {
    this.showValues = !this.showValues;
    this.render();
  }

  toggleLegend(): void {
    this.showLegend = !this.showLegend;
    this.render();
  }

  resetView(): void {
    this.horizontalOverride = null;
    this.axisLabelsOverride = null;
    this.showValues = true;
    this.showLegend = true;
    this.render();
  }

  downloadPng(): void {
    const source = this.canvas?.nativeElement;
    if (!source) return;
    const pixelRatio = Math.max(2, window.devicePixelRatio || 1);
    const isLine = this.type === 'line';
    const exportItems = isLine || !this.showLegend ? [] : this.data.slice(0, 12);
    const width = Math.max(source.width, Math.round(1200 * pixelRatio));
    const chartHeight = Math.round(source.height * (width / source.width));
    const headerHeight = Math.round(126 * pixelRatio);
    const legendRowHeight = Math.round(76 * pixelRatio);
    const detailsHeight = isLine
      ? Math.round(190 * pixelRatio)
      : this.showLegend
        ? Math.round((exportItems.length * 76 + 70) * pixelRatio)
        : 0;
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
    context.strokeRect(
      context.lineWidth / 2,
      context.lineWidth / 2,
      exportCanvas.width - context.lineWidth,
      exportCanvas.height - context.lineWidth,
    );

    context.fillStyle = '#0f172a';
    context.font = `700 ${Math.round(30 * pixelRatio)}px sans-serif`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(
      this.ariaLabel,
      Math.round(32 * pixelRatio),
      Math.round(48 * pixelRatio),
      exportCanvas.width - Math.round(64 * pixelRatio),
    );
    context.fillStyle = '#64748b';
    context.font = `600 ${Math.round(18 * pixelRatio)}px sans-serif`;
    const totalRecords = this.data.reduce((sum, item) => sum + (item.count || 0), 0);
    context.fillText(
      `${this.format(this.totalValue())} horas · ${totalRecords ? `${totalRecords} registros` : `${this.data.length} puntos analizados`}`,
      Math.round(32 * pixelRatio),
      Math.round(91 * pixelRatio),
    );
    context.strokeStyle = '#e2e8f0';
    context.beginPath();
    context.moveTo(Math.round(32 * pixelRatio), headerHeight - Math.round(10 * pixelRatio));
    context.lineTo(
      exportCanvas.width - Math.round(32 * pixelRatio),
      headerHeight - Math.round(10 * pixelRatio),
    );
    context.stroke();
    context.drawImage(source, 0, headerHeight, width, chartHeight);

    const detailsTop = headerHeight + chartHeight;
    if (detailsHeight) {
      context.fillStyle = '#f8fafc';
      context.fillRect(0, detailsTop, width, detailsHeight);
      context.textBaseline = 'middle';
      context.fillStyle = '#334155';
      context.font = `700 ${Math.round(20 * pixelRatio)}px sans-serif`;
      context.fillText(
        isLine ? 'Resumen del periodo' : 'Leyenda y detalle de categorías',
        Math.round(32 * pixelRatio),
        detailsTop + Math.round(35 * pixelRatio),
      );
    }

    if (isLine) {
      const cards = [
        {
          label: 'TOTAL',
          value: `${this.format(this.totalValue())} h`,
          color: '#1d4ed8',
          background: '#eff6ff',
        },
        {
          label: 'PROMEDIO',
          value: `${this.format(this.averageValue())} h`,
          color: '#047857',
          background: '#ecfdf5',
        },
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
        context.fillText(
          card.label,
          x + Math.round(18 * pixelRatio),
          y + Math.round(27 * pixelRatio),
        );
        context.font = `700 ${Math.round(21 * pixelRatio)}px sans-serif`;
        context.fillText(
          card.value,
          x + Math.round(18 * pixelRatio),
          y + Math.round(62 * pixelRatio),
          cardWidth - Math.round(36 * pixelRatio),
        );
      });
    } else {
      exportItems.forEach((item, index) => {
        const rowTop = detailsTop + Math.round(62 * pixelRatio) + index * legendRowHeight;
        const centerY = rowTop + Math.round(27 * pixelRatio);
        context.fillStyle = index % 2 ? '#ffffff' : '#f8fafc';
        context.fillRect(
          Math.round(22 * pixelRatio),
          rowTop,
          width - Math.round(44 * pixelRatio),
          legendRowHeight,
        );
        context.fillStyle = this.colorAt(index);
        context.beginPath();
        context.arc(
          Math.round(44 * pixelRatio),
          centerY,
          Math.round(9 * pixelRatio),
          0,
          Math.PI * 2,
        );
        context.fill();
        context.fillStyle = '#1e293b';
        context.font = `700 ${Math.round(20 * pixelRatio)}px sans-serif`;
        context.fillText(
          item.label,
          Math.round(66 * pixelRatio),
          centerY,
          width - Math.round(98 * pixelRatio),
        );
        context.fillStyle = '#475569';
        context.font = `600 ${Math.round(16 * pixelRatio)}px sans-serif`;
        const count = item.count ? ` · ${item.count} registros` : '';
        context.fillText(
          `${this.format(item.hours)} horas · ${this.percentage(item.hours)}% del total${count}`,
          Math.round(66 * pixelRatio),
          centerY + Math.round(28 * pixelRatio),
          width - Math.round(98 * pixelRatio),
        );
      });
    }

    const footerTop = exportCanvas.height - footerHeight;
    context.fillStyle = '#ffffff';
    context.fillRect(0, footerTop, width, footerHeight);
    context.fillStyle = '#64748b';
    context.font = `600 ${Math.round(14 * pixelRatio)}px sans-serif`;
    context.fillText(
      'Fuente: reportes de tiempos PMO · Imagen generada en alta resolución',
      Math.round(32 * pixelRatio),
      footerTop + footerHeight / 2,
    );
    const link = document.createElement('a');
    link.download = `${this.ariaLabel
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '_')
      .toLowerCase()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  private render(): void {
    if (!this.canvas) return;
    this.chart?.destroy();

    const config = this.configFactory.build({
      data: this.data,
      type: this.type,
      horizontal: this.effectiveHorizontal(),
      showAxisLabels: this.effectiveShowAxisLabels(),
      showLegend: this.showLegend,
      showValues: this.showValues,
      colorAt: (index) => this.colorAt(index),
      format: (value) => this.format(value),
      percentage: (value) => this.percentage(value),
      wrapLabel: (label, maxLength) => this.wrapLabel(label, maxLength),
      theme: this.currentTheme(),
    });
    this.chart = new Chart(this.canvas.nativeElement, config);
  }

  private currentTheme(): StatisticsChartTheme {
    const isDark = document.documentElement.dataset['theme'] === 'dark';
    return isDark
      ? {
          axis: '#a1a1a6',
          axisStrong: '#c7c7cc',
          grid: 'rgba(229, 231, 235, .24)',
          line: '#8fc7ff',
          lineFill: 'rgba(143, 199, 255, .18)',
          label: '#b9dcff',
          circularLabelStroke: 'rgba(10, 10, 12, .72)',
          circularLabelText: '#f5f5f7',
          tooltipBackground: '#f5f5f7',
          tooltipTitle: '#111827',
          tooltipBody: '#374151',
          circularBorder: '#1c1c1e',
        }
      : {
          axis: '#64748b',
          axisStrong: '#475569',
          grid: '#e2e8f0',
          line: '#2563eb',
          lineFill: '#2563eb22',
          label: '#1e3a8a',
          circularLabelStroke: 'rgba(15, 23, 42, .65)',
          circularLabelText: '#ffffff',
          tooltipBackground: '#0f172a',
          tooltipTitle: '#ffffff',
          tooltipBody: '#e2e8f0',
          circularBorder: '#ffffff',
        };
  }

  private wrapLabel(label: string, maxLength: number): string[] {
    const words = label.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    words.forEach((word) => {
      if (word.length > maxLength) {
        if (current) lines.push(current);
        for (let index = 0; index < word.length; index += maxLength)
          lines.push(word.slice(index, index + maxLength));
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
