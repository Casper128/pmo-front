import {
  ChartConfiguration,
  ChartType,
  Plugin,
  TooltipItem,
} from 'chart.js';
import { StatisticsChartItem } from './statistics-chart.model';

export interface StatisticsChartConfigInput {
  data: StatisticsChartItem[];
  type: 'doughnut' | 'pie' | 'bar' | 'line';
  horizontal: boolean;
  showAxisLabels: boolean;
  showLegend: boolean;
  showValues: boolean;
  colorAt: (index: number) => string;
  format: (value: number) => string;
  percentage: (value: number) => number;
  wrapLabel: (label: string, maxLength: number) => string[];
  theme: StatisticsChartTheme;
}

export interface StatisticsChartTheme {
  axis: string;
  axisStrong: string;
  grid: string;
  line: string;
  lineFill: string;
  label: string;
  circularLabelStroke: string;
  circularLabelText: string;
  tooltipBackground: string;
  tooltipTitle: string;
  tooltipBody: string;
  circularBorder: string;
}

export class StatisticsChartConfigFactory {
  build(input: StatisticsChartConfigInput): ChartConfiguration<ChartType, number[], string> {
    const isCircular = input.type === 'doughnut' || input.type === 'pie';
    const isLine = input.type === 'line';
    const xTicks = input.horizontal
      ? { color: input.theme.axis, callback: (value: unknown) => `${value} h` }
      : input.type === 'bar'
        ? {
            color: input.theme.axisStrong,
            display: input.showAxisLabels,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            font: { size: 12, weight: 'bold' as const },
            callback: (value: unknown) =>
              input.wrapLabel(String(input.data[Number(value)]?.label || ''), 14),
          }
        : { color: input.theme.axis, maxRotation: 0, minRotation: 0 };
    const yTicks = input.horizontal
      ? {
          color: input.theme.axisStrong,
          display: input.showAxisLabels,
          font: { size: 12, weight: 'bold' as const },
          callback: (value: unknown) => {
            const label = String(input.data[Number(value)]?.label || '');
            return input.wrapLabel(label, 18);
          },
        }
      : { color: input.theme.axisStrong, callback: (value: unknown) => `${value} h` };

    return {
      type: input.type,
      data: {
        labels: input.data.map((item) => item.label),
        datasets: [
          {
            data: input.data.map((item) => item.hours),
            backgroundColor: isCircular
              ? input.data.map((_, index) => input.colorAt(index))
              : isLine
                ? input.theme.lineFill
                : input.data.map((_, index) => input.colorAt(index)),
            borderColor: isCircular
              ? input.theme.circularBorder
              : isLine
                ? input.theme.line
                : input.data.map((_, index) => input.colorAt(index)),
            borderWidth: isCircular ? 3 : 2,
            borderRadius: input.type === 'bar' ? 7 : 0,
            fill: isLine,
            tension: isLine ? 0.35 : 0,
            pointBackgroundColor: input.theme.line,
            pointRadius: isLine ? 4 : 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 3,
        layout: {
          padding: {
            top: isCircular ? 4 : 24,
            right: input.horizontal ? 102 : 10,
            left: 4,
            bottom: 4,
          },
        },
        indexAxis: input.type === 'bar' && input.horizontal ? 'y' : 'x',
        ...(input.type === 'doughnut' ? { cutout: '62%' } : {}),
        plugins: {
          legend: {
            display: isCircular && input.showLegend,
            position: 'bottom',
            labels: {
              boxWidth: 11,
              boxHeight: 11,
              usePointStyle: true,
              padding: 16,
              color: input.theme.axisStrong,
              font: { size: 13, weight: 'bold' as const },
            },
          },
          tooltip: {
            backgroundColor: input.theme.tooltipBackground,
            titleColor: input.theme.tooltipTitle,
            bodyColor: input.theme.tooltipBody,
            padding: 12,
            cornerRadius: 10,
            displayColors: true,
            callbacks: {
              title: (items) => {
                const index = items[0]?.dataIndex;
                return index === undefined ? '' : input.data[index]?.label || '';
              },
              label: (context: TooltipItem<ChartType>) => {
                const item = input.data[context.dataIndex];
                const total = input.data.reduce((sum, value) => sum + value.hours, 0);
                const percentage = total ? Math.round((item.hours / total) * 100) : 0;
                const count = item.count ? ` · ${item.count} registros` : '';
                return `${input.format(item.hours)} h · ${percentage}% del total${count}`;
              },
            },
          },
        },
        scales: isCircular
          ? undefined
          : {
              x: {
                beginAtZero: true,
                grid: { color: input.theme.grid },
                ticks: xTicks,
              },
              y: {
                beginAtZero: true,
                grid: { display: !input.horizontal, color: input.theme.grid },
                ticks: yTicks,
              },
            },
      },
      plugins: [this.visibleLabels(input)],
    };
  }

  private visibleLabels(input: StatisticsChartConfigInput): Plugin {
    return {
      id: 'visible-statistics-labels',
      afterDatasetsDraw: (chart) => {
        if (!input.showValues) return;
        const isCircular = input.type === 'doughnut' || input.type === 'pie';
        const context = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        const compact = chart.width < 520;
        context.save();
        context.font = `700 ${compact ? 11 : 12}px sans-serif`;
        meta.data.forEach((element, index) => {
          const item = input.data[index];
          if (!item || !item.hours) return;
          const position = element.tooltipPosition(false);
          if (position.x === null || position.y === null) return;
          const reports = item.count ? ` · ${item.count} reg.` : '';
          const text = isCircular
            ? compact
              ? `${input.percentage(item.hours)}%`
              : `${input.format(item.hours)} h · ${input.percentage(item.hours)}%`
            : compact
              ? `${input.format(item.hours)} h`
              : `${input.format(item.hours)} h${reports}`;

          if (isCircular) {
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.lineWidth = 3;
            context.strokeStyle = input.theme.circularLabelStroke;
            context.fillStyle = input.theme.circularLabelText;
            context.strokeText(text, position.x, position.y);
            context.fillText(text, position.x, position.y);
          } else if (input.horizontal) {
            context.textAlign = 'left';
            context.textBaseline = 'middle';
            context.fillStyle = input.theme.label;
            context.fillText(text, position.x + 5, position.y, compact ? 54 : 92);
          } else {
            context.textAlign = 'center';
            context.textBaseline = 'bottom';
            context.fillStyle = input.theme.label;
            context.fillText(text, position.x, position.y - 7);
          }
        });
        context.restore();
      },
    };
  }
}
