import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthGateway } from '@application/auth/auth.gateway';
import { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import { ManagementReport } from '@domain/time-records/models/management-report.model';
import {
  DASHBOARD_BILLING_LABELS,
  DashboardRequestSummary,
  TimeDashboardPeriodPreset,
} from '@domain/time-records/models/time-dashboard.model';
import { isManagementReportOwnedBy } from '@domain/time-records/services/management-report-ownership.policy';
import { TimeDashboardCalculator } from '@domain/time-records/services/time-dashboard.calculator';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import { UiDateInputComponent } from '@presentation/shared/components/ui-date-input/ui-date-input.component';
import { UiMetricCardComponent } from '@presentation/shared/components/ui-metric-card/ui-metric-card.component';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';
import {
  UiSegmentedControlComponent,
  UiSegmentedOption,
} from '@presentation/shared/components/ui-segmented-control/ui-segmented-control.component';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiStateMessageComponent } from '@presentation/shared/components/ui-state-message/ui-state-message.component';
import { AnalyticsChartCardComponent } from '../components/analytics-chart-card/analytics-chart-card.component';
import {
  GroupedBarChartComponent,
  GroupedBarSeries,
} from '../components/grouped-bar-chart/grouped-bar-chart.component';
import { WeeklyHoursChartComponent } from '../components/weekly-hours-chart/weekly-hours-chart.component';

const DEFAULT_PRESET: TimeDashboardPeriodPreset = '3m';
/** Tonos de la paleta de `statistics-chart`. */
const SERIES_COLORS = {
  billable: '#2563eb',
  factory: '#f59e0b',
  nonBillable: '#64748b',
};

@Component({
  selector: 'app-time-dashboard-page',
  standalone: true,
  imports: [
    FormsModule,
    OverflowTooltipDirective,
    UiDateInputComponent,
    UiMetricCardComponent,
    UiPageHeaderComponent,
    UiSegmentedControlComponent,
    UiSelectComponent,
    UiStateMessageComponent,
    AnalyticsChartCardComponent,
    GroupedBarChartComponent,
    WeeklyHoursChartComponent,
  ],
  templateUrl: './time-dashboard-page.component.html',
})
export class TimeDashboardPageComponent implements OnInit {
  private management = inject(TimeManagementGateway);
  private auth = inject(AuthGateway);
  private calculator = inject(TimeDashboardCalculator);

  private readonly initialRange = this.calculator.presetRange(DEFAULT_PRESET, this.today());

  records = signal<ManagementReport[]>([]);
  loading = signal(false);
  loaded = signal(false);
  error = signal('');
  dateFrom = signal(this.initialRange.from);
  dateTo = signal(this.initialRange.to);
  client = signal('');
  hourType = signal('');
  periodPreset = signal<string>(DEFAULT_PRESET);

  readonly periodPresetOptions: readonly UiSegmentedOption[] = [
    { value: '7', label: '7 días' },
    { value: '30', label: '30 días' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
  ];

  dateError = computed(() =>
    !this.dateFrom() || !this.dateTo()
      ? 'Selecciona la fecha inicial y la fecha final.'
      : this.dateFrom() > this.dateTo()
        ? 'La fecha inicial no puede ser posterior a la fecha final.'
        : '',
  );

  ownRecords = computed(() => {
    const user = this.auth.user();
    return this.records().filter((record) => isManagementReportOwnedBy(record, user));
  });
  filterOptions = computed(() => this.calculator.filterOptions(this.ownRecords()));
  clientOptions = computed<UiSelectOption[]>(() =>
    this.asOptions(this.filterOptions().clients, 'Todos los clientes'),
  );
  hourTypeOptions = computed<UiSelectOption[]>(() =>
    this.asOptions(this.filterOptions().hourTypes, 'Todos los tipos de hora'),
  );

  snapshot = computed(() =>
    this.calculator.build(this.ownRecords(), {
      from: this.dateFrom(),
      to: this.dateTo(),
      client: this.client(),
      hourType: this.hourType(),
    }),
  );
  kpis = computed(() => this.snapshot().kpis);

  monthLabels = computed(() =>
    this.snapshot().months.map((month) =>
      month.variationPct === null
        ? month.label
        : `${month.label} · ${this.formatSigned(month.variationPct)} %`,
    ),
  );
  monthSeries = computed<GroupedBarSeries[]>(() => {
    const months = this.snapshot().months;
    return [
      {
        label: 'Facturable',
        values: months.map((m) => m.billable),
        color: SERIES_COLORS.billable,
      },
      { label: 'Fábrica', values: months.map((m) => m.factory), color: SERIES_COLORS.factory },
      {
        label: 'No facturable',
        values: months.map((m) => m.nonBillable),
        color: SERIES_COLORS.nonBillable,
      },
    ];
  });

  /** Clave elegida por el usuario; si deja de existir con los filtros, se usa la más reciente. */
  selectedRequestKey = signal('');
  requestOptions = computed<UiSelectOption[]>(() =>
    this.snapshot().requests.map((item) => ({
      value: item.key,
      label: `${item.request} · ${item.client}`,
    })),
  );
  selectedRequest = computed<DashboardRequestSummary | null>(() => {
    const requests = this.snapshot().requests;
    return requests.find((item) => item.key === this.selectedRequestKey()) ?? requests[0] ?? null;
  });

  ngOnInit(): void {
    this.loadRecords();
  }

  loadRecords(): void {
    this.loading.set(true);
    this.error.set('');
    const userId = this.auth.user()?.id;
    const numericId = Number(userId);
    const consultantId = userId && !Number.isNaN(numericId) ? numericId : userId || null;
    this.management.list(consultantId).subscribe({
      next: (rows) => {
        this.records.set(rows);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        if (error?.status === 401 || error?.status === 403) {
          this.auth.clearTokens();
          return;
        }
        this.error.set(
          error?.error?.message ||
            error?.message ||
            'No fue posible consultar los registros del consultor.',
        );
      },
    });
  }

  applyPeriodPreset(value: string): void {
    const preset = this.periodPresetOptions.find((option) => option.value === value)?.value;
    if (!preset) return;
    const range = this.calculator.presetRange(preset as TimeDashboardPeriodPreset, this.today());
    this.periodPreset.set(preset);
    this.dateFrom.set(range.from);
    this.dateTo.set(range.to);
  }

  setDateFrom(value: string): void {
    this.dateFrom.set(value);
    this.periodPreset.set('');
  }

  setDateTo(value: string): void {
    this.dateTo.set(value);
    this.periodPreset.set('');
  }

  clearFilters(): void {
    this.client.set('');
    this.hourType.set('');
    this.applyPeriodPreset(DEFAULT_PRESET);
  }

  variationText(): string {
    const variation = this.kpis().variationPct;
    return variation === null
      ? 'Sin horas en el periodo anterior'
      : `${this.formatSigned(variation)} % vs. periodo anterior`;
  }

  formatHours(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
  }

  formatDateTime(value: string): string {
    const [date, time = ''] = value.split('T');
    const formatted = new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00`));
    return time && time !== '00:00:00' ? `${formatted} · ${time.slice(0, 5)}` : formatted;
  }

  sharePct(part: number, total: number): number {
    return total > 0 ? (part / total) * 100 : 0;
  }

  billingColor(label: string): string {
    if (label === DASHBOARD_BILLING_LABELS.factory) return SERIES_COLORS.factory;
    if (label === DASHBOARD_BILLING_LABELS.non_billable) return SERIES_COLORS.nonBillable;
    return SERIES_COLORS.billable;
  }

  private formatSigned(value: number): string {
    return `${value > 0 ? '+' : ''}${this.formatHours(value)}`;
  }

  private asOptions(values: readonly string[], emptyLabel: string): UiSelectOption[] {
    return [{ value: '', label: emptyLabel }, ...values.map((value) => ({ value, label: value }))];
  }

  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
