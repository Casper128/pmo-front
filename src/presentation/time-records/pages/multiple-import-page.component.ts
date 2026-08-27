import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TimeRecord, DayGroup } from '@domain/time-records/models/time-record.model';
import {
  HourBillingFilter,
  TimeRecordDomainService,
} from '@domain/time-records/services/time-record-domain.service';
import {
  SendAllRecordsUseCase,
  SendRecordLog,
  SendResult,
} from '@application/time-records/use-cases/send-all-records.use-case';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { ImportTextInputComponent } from '../components/import-text-input/import-text-input.component';
import { RecordsPreviewComponent } from '../components/records-preview/records-preview.component';
import { EditRecordModalComponent } from '../components/edit-record-modal/edit-record-modal.component';
import { WeeklyHoursChartComponent } from '../components/weekly-hours-chart/weekly-hours-chart.component';
import { AuthGateway } from '@application/auth/auth.gateway';
import readXlsxFile from 'read-excel-file/browser';
import { ManagementReport } from '@domain/time-records/models/management-report.model';
import { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiDateInputComponent } from '@presentation/shared/components/ui-date-input/ui-date-input.component';
import { UiMetricCardComponent } from '@presentation/shared/components/ui-metric-card/ui-metric-card.component';
import { UiSearchInputComponent } from '@presentation/shared/components/ui-search-input/ui-search-input.component';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';
import { UiTimeInputComponent } from '@presentation/shared/components/ui-time-input/ui-time-input.component';
import { UiModalComponent } from '@presentation/shared/components/ui-modal/ui-modal.component';
import { UiStateMessageComponent } from '@presentation/shared/components/ui-state-message/ui-state-message.component';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';
import {
  UiSegmentedControlComponent,
  UiSegmentedOption,
} from '@presentation/shared/components/ui-segmented-control/ui-segmented-control.component';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { AdvancedFieldKey } from '@domain/configuration/app-parameters.model';
import { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import {
  AdvancedTemplateValues,
  ManagementAdvancedTemplate,
  ManagementDemandOption,
  REQUIRED_ADVANCED_TEMPLATE_FIELDS,
  isMissingAdvancedTemplateValue,
} from '@domain/time-records/models/management-template.model';
import { ManagementReportDetailModalComponent } from '../components/management-report-detail-modal/management-report-detail-modal.component';
import { ManagementTemplateDialogComponent } from '../components/management-template-dialog/management-template-dialog.component';

interface ManagementEditDraft {
  identificador: string;
  fecha: string;
  horaIni: string;
  horaFin: string;
  horas: string;
  tipoHora: string;
  descripcion: string;
}

interface DailyHours {
  date: string;
  label: string;
  shortLabel: string;
  hours: number;
  count: number;
}

interface ExcelTimeReport {
  identificador: string;
  solicitud: string;
  categoria: string;
  cliente: string;
  consultor: string;
  descripcion: string;
  horas: number;
  tipoHora: string;
  fecha: string;
  funcional: string;
  gestion: string;
  modulo: string;
  tecnologia: string;
  tipoActividad: string;
  proyecto: string;
  horaInicio: string;
  horaFin: string;
}

interface ExcelDailySummary {
  fecha: string;
  consultor: string;
  cliente: string;
  horas: number;
  registros: number;
  solicitudes: number;
}

interface AlertDialog {
  title: string;
  text: string;
  context?: 'validation' | 'audit';
}

type ReportPeriodPreset = 'day' | '1m' | '3m' | '6m' | 'custom';
type SendPhase = 'idle' | 'sending' | 'saving-logs' | 'completed' | 'log-error' | 'failed';

@Component({
  selector: 'app-multiple-import-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImportTextInputComponent,
    RecordsPreviewComponent,
    EditRecordModalComponent,
    WeeklyHoursChartComponent,
    OverflowTooltipDirective,
    UiSelectComponent,
    UiDateInputComponent,
    UiMetricCardComponent,
    UiSearchInputComponent,
    UiPageHeaderComponent,
    UiTimeInputComponent,
    UiModalComponent,
    UiStateMessageComponent,
    UiFieldComponent,
    UiSegmentedControlComponent,
    ManagementReportDetailModalComponent,
    ManagementTemplateDialogComponent,
  ],
  templateUrl: './multiple-import-page.component.html',
})
export class MultipleImportPageComponent implements OnInit {
  private readonly pendingRecordsStorageKey = 'pmo_pending_time_records';
  private domain = inject(TimeRecordDomainService);
  private sendAll = inject(SendAllRecordsUseCase);
  private options = inject(LoadSelectOptionsUseCase);
  private management = inject(TimeManagementGateway);
  private sendLogGateway = inject(SendLogGateway);
  auth = inject(AuthGateway);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  parameters = inject(AppParametersFacade);
  private templates = inject(ManagementTemplateGateway);

  currentView = signal<'import' | 'download' | 'management'>('import');
  readonly reportPeriodOptions: readonly UiSegmentedOption[] = [
    { value: 'day', label: '1 día' },
    { value: '1m', label: '1 mes' },
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
  ];
  records = signal<TimeRecord[]>([]);
  groups = signal<DayGroup[]>([]);
  totalGeneral = signal(0);

  sending = signal(false);
  showPreview = signal(false);
  sendTotal = signal(0);
  sendProcessed = signal(0);
  sendPhase = signal<SendPhase>('idle');
  sendSuccessCount = signal(0);
  sendErrorCount = signal(0);
  sendFailureMessage = signal('');
  private pendingSendResult: SendResult | null = null;

  sendProgressPercent = computed(() => {
    const total = this.sendTotal();
    if (!total) return 0;
    return Math.round((this.sendProcessed() / total) * 100);
  });

  // Alert message
  alert = signal<{ text: string; type: 'success' | 'error' } | null>(null);
  alertDialog = signal<AlertDialog | null>(null);

  // Edit modal
  editingIndex = signal<number | null>(null);
  editingRecord = signal<TimeRecord | null>(null);
  modalVisible = signal(false);

  clientes = signal<string[]>([]);
  proyectos = signal<string[]>([]);
  solicitudes = signal<string[]>([]);
  solicitudOptions = signal<ManagementDemandOption[]>([]);
  defaultCliente = signal('');
  defaultProyecto = signal('');
  defaultSolicitud = signal('');
  defaultGestionId = signal('');
  loadingClients = signal(false);
  loadingDemand = signal(false);
  configuredManagementIds = signal<Set<string>>(new Set());
  configuredManagementTemplates = signal<Map<string, ManagementAdvancedTemplate>>(new Map());
  templateDialogVisible = signal(false);
  templateDialogSaving = signal(false);
  templateDialogMode = signal<'create' | 'edit'>('create');
  templateDraft = signal<ManagementAdvancedTemplate | null>(null);

  reportCliente = '';
  reportFechaIni = '';
  reportFechaFin = '';
  reportPeriodPreset = signal<ReportPeriodPreset>('custom');
  downloadingReport = signal(false);
  reportResult = signal<{ type: 'success' | 'empty'; title: string; detail: string } | null>(null);
  excelReports = signal<ExcelTimeReport[]>([]);
  reportTableConsultant = signal('');
  reportTableClient = signal('');
  reportTableDate = signal('');
  reportTableHourFilter = signal<HourBillingFilter>('all');
  reportTableSearch = signal('');
  readonly hourBillingOptions: readonly UiSelectOption[] = [
    { value: 'all', label: 'Todos los tipos de hora' },
    { value: 'billable', label: 'Facturables' },
    { value: 'factory', label: 'Fábrica' },
    { value: 'non_billable', label: 'No facturables' },
  ];
  readonly tipoHoraOptions = computed<UiSelectOption[]>(() =>
    this.parameters
      .optionsFor('tipoHora')
      .map((option) => ({ value: option.value, label: option.label, disabled: !option.active })),
  );

  excelConsultants = computed(() =>
    this.uniqueText(this.excelReports().map((row) => row.consultor)),
  );
  excelClients = computed(() => this.uniqueText(this.excelReports().map((row) => row.cliente)));
  excelDates = computed(() =>
    this.uniqueText(this.excelReports().map((row) => row.fecha))
      .sort()
      .reverse(),
  );
  reportClientOptions = computed(() => this.asSelectOptions(this.clientes(), 'Todos los clientes'));
  reportConsultantOptions = computed(() =>
    this.asSelectOptions(this.excelConsultants(), 'Todos los consultores'),
  );
  reportTableClientOptions = computed(() =>
    this.asSelectOptions(this.excelClients(), 'Todos los clientes'),
  );
  reportDateOptions = computed(() => [
    { value: '', label: 'Todos los días' },
    ...this.excelDates().map((value) => ({ value, label: this.formatFullDate(value) })),
  ]);
  filteredExcelReports = computed(() => {
    const search = this.normalizeText(this.reportTableSearch());
    return this.excelReports()
      .filter((row) => {
        if (this.reportTableConsultant() && row.consultor !== this.reportTableConsultant())
          return false;
        if (this.reportTableClient() && row.cliente !== this.reportTableClient()) return false;
        if (this.reportTableDate() && row.fecha !== this.reportTableDate()) return false;
        if (!this.domain.matchesHourBillingFilter(row.tipoHora, this.reportTableHourFilter()))
          return false;
        if (!search) return true;
        return [
          row.identificador,
          row.solicitud,
          row.gestion,
          row.descripcion,
          row.funcional,
          row.modulo,
          row.tecnologia,
        ].some((value) => this.normalizeText(value).includes(search));
      })
      .sort((a, b) => `${b.fecha} ${b.horaInicio}`.localeCompare(`${a.fecha} ${a.horaInicio}`));
  });
  excelDailySummary = computed<ExcelDailySummary[]>(() => {
    const groups = new Map<
      string,
      {
        fecha: string;
        consultor: string;
        clientes: Set<string>;
        horas: number;
        registros: number;
        solicitudes: Set<string>;
      }
    >();
    this.filteredExcelReports().forEach((row) => {
      const key = `${row.fecha}|${this.personNameKey(row.consultor)}`;
      const current = groups.get(key) || {
        fecha: row.fecha,
        consultor: row.consultor,
        clientes: new Set<string>(),
        horas: 0,
        registros: 0,
        solicitudes: new Set<string>(),
      };
      current.horas += row.horas;
      current.registros += 1;
      current.clientes.add(row.cliente);
      if (row.solicitud || row.gestion) current.solicitudes.add(row.solicitud || row.gestion);
      groups.set(key, current);
    });
    return [...groups.values()]
      .map((group) => ({
        fecha: group.fecha,
        consultor: group.consultor,
        cliente: [...group.clientes].sort((a, b) => a.localeCompare(b, 'es')).join(' · '),
        horas: group.horas,
        registros: group.registros,
        solicitudes: group.solicitudes.size,
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.horas - a.horas);
  });
  excelTotalHours = computed(() =>
    this.filteredExcelReports().reduce((sum, row) => sum + row.horas, 0),
  );
  excelActiveDays = computed(
    () => new Set(this.filteredExcelReports().map((row) => row.fecha)).size,
  );
  excelClientCount = computed(
    () => new Set(this.filteredExcelReports().map((row) => row.cliente)).size,
  );
  excelEmptyTitle = computed(() =>
    this.excelReports().length
      ? 'No hay actividades con esos filtros'
      : 'Genera un reporte para ver actividades',
  );
  excelEmptyDescription = computed(() =>
    this.excelReports().length
      ? 'Limpia la búsqueda, cambia cliente, consultor, fecha o clasificación de hora para recuperar registros visibles.'
      : 'Selecciona cliente y rango de fechas. La app cargará el Excel recibido y lo convertirá en tablas verificables.',
  );
  excelEmptyActionLabel = computed(() =>
    this.excelReports().length ? 'Limpiar filtros' : 'Generar reporte',
  );

  managementReports = signal<ManagementReport[]>([]);
  managementLoading = signal(false);
  managementLoaded = signal(false);
  managementError = signal('');
  managementFechaIni = signal('');
  managementFechaFin = signal('');
  managementHourFilter = signal<HourBillingFilter>('all');
  managementSearch = '';
  managementEditVisible = signal(false);
  managementEditSaving = signal(false);
  managementEditDraft = signal<ManagementEditDraft | null>(null);
  managementEditOriginal = signal<ManagementReport | null>(null);
  managementEditErrors = signal<string[]>([]);
  managementDetailReport = signal<ManagementReport | null>(null);
  managementDeleteReport = signal<ManagementReport | null>(null);
  managementDeleteSaving = signal(false);
  managementTechnicalKey = '';

  managementDateError = computed(() => {
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();
    if (start && !this.domain.isValidDateValue(start)) return 'La fecha inicio no es valida';
    if (end && !this.domain.isValidDateValue(end)) return 'La fecha fin no es valida';
    if (start && end && start > end) return 'La fecha inicio no puede ser mayor a la fecha fin';
    return '';
  });

  dateFilteredManagementReports = computed(() => {
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();
    if (this.managementDateError()) return [];

    return this.filterManagementReportsByDate(this.managementReports(), start, end);
  });

  filteredManagementReports = computed(() => {
    return this.searchManagementReports(
      this.dateFilteredManagementReports(),
      this.managementSearch,
    );
  });
  managementEmptyTitle = computed(() =>
    this.managementReports().length
      ? 'No hay reportes con esos filtros'
      : 'Aún no hay reportes cargados',
  );
  managementEmptyDescription = computed(() =>
    this.managementReports().length
      ? 'Ajusta el rango, cambia la clasificación de hora o limpia la búsqueda para ver más registros.'
      : 'Usa Actualizar para consultar los reportes enviados al backend y verificar sus campos cargados.',
  );
  managementEmptyActionLabel = computed(() =>
    this.managementReports().length ? 'Limpiar filtros' : 'Actualizar reportes',
  );

  managementWeekChart = computed<DailyHours[]>(() => {
    const rows = this.filteredManagementReports();
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();

    if (!start || !end) {
      const latestDate = rows
        .map((report) => this.managementReportDate(report))
        .filter((date): date is string => !!date)
        .sort()
        .at(-1);
      const base = latestDate ? this.parseLocalDate(latestDate) : new Date();
      const monday = this.startOfWeek(base);
      return this.buildDailyHours(rows, monday, 7);
    }

    const startDate = this.parseLocalDate(start);
    const endDate = this.parseLocalDate(end);
    const days = Math.max(1, this.daysBetween(startDate, endDate) + 1);
    return this.buildDailyHours(rows, startDate, Math.min(days, 31));
  });

  managementRangeLabel = computed(() => {
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();
    if (!start && !end) return 'Sin rango aplicado';
    if (start && end) return `${this.formatFullDate(start)} - ${this.formatFullDate(end)}`;
    return start ? `Desde ${this.formatFullDate(start)}` : `Hasta ${this.formatFullDate(end)}`;
  });

  private buildDailyHours(rows: ManagementReport[], startDate: Date, days: number): DailyHours[] {
    return Array.from({ length: days }, (_, index) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + index);
      const date = this.toDateInputValue(day);
      const dayRows = rows.filter((report) => this.managementReportDate(report) === date);
      return {
        date,
        label: this.formatFullDate(date),
        shortLabel: this.formatShortDate(date),
        hours: dayRows.reduce((sum, report) => sum + this.reportHours(report), 0),
        count: dayRows.length,
      };
    });
  }

  ngOnInit(): void {
    const view = this.route.snapshot.data['view'];
    if (view === 'import' || view === 'download' || view === 'management')
      this.currentView.set(view);
    this.restorePendingRecords();
    this.loadDefaultSelection();
    this.loadManagementTemplates();
    if (view === 'download' && !this.reportFechaIni && !this.reportFechaFin) {
      this.setReportPeriod('1m');
    }
    if (view === 'management') this.loadManagementReports();
  }

  onDraftRecordsChange(records: TimeRecord[]) {
    const prepared = this.sortedRecords(records.map((record) => this.applyImportDefaults(record)));
    if (prepared.length === 0) {
      this.records.set([]);
      this.persistPendingRecords();
      this.groups.set([]);
      this.totalGeneral.set(0);
      this.showPreview.set(false);
      this.resetSendTracking();
      return;
    }
    this.records.set(prepared);
    this.persistPendingRecords();
    this.refreshGroups();
    this.syncReportDatesFromRecords(prepared);
    this.resetSendTracking();
    this.showPreview.set(true);
  }

  refreshGroups() {
    const recs = this.sortedRecords(this.records());
    if (JSON.stringify(recs) !== JSON.stringify(this.records())) {
      this.records.set(recs);
      this.persistPendingRecords();
    }
    this.groups.set(this.domain.groupByDate(recs));
    this.totalGeneral.set(
      recs.reduce(
        (sum, record) =>
          this.domain.isCountableHour(record.tipoHora)
            ? sum + parseFloat(record.horas || '0')
            : sum,
        0,
      ),
    );
  }

  onEdit(index: number) {
    this.editingIndex.set(index);
    this.editingRecord.set({ ...this.records()[index] });
    this.modalVisible.set(true);
  }

  onSaveEdit(updated: TimeRecord) {
    const recs = [...this.records()];
    const idx = this.editingIndex()!;
    // recalc horas
    updated.horas = this.domain.calcHoras(updated.horaIni, updated.horaFin);
    const errors = [
      ...this.domain.getMissingFields(updated),
      ...this.domain.getInvalidFields(updated),
    ];
    if (
      this.domain.isCountableHour(updated.tipoHora) &&
      Number(updated.horas || 0) > this.domain.getMaxDailyLaborHours()
    ) {
      errors.push(
        `Un registro computable no puede superar ${this.domain.getMaxDailyLaborHours()} horas`,
      );
    }
    if (errors.length > 0) {
      this.showAlert(`No se puede guardar el registro: ${errors.join(', ')}`, 'error');
      return;
    }
    recs[idx] = updated;
    this.records.set(this.sortedRecords(recs));
    this.persistPendingRecords();
    this.refreshGroups();
    this.modalVisible.set(false);
    this.showAlert('✓ Registro actualizado', 'success');
  }

  onPreviewRecordChange(change: { index: number; record: TimeRecord }): void {
    const recs = [...this.records()];
    const current = recs[change.index];
    if (!current) return;
    const updated = {
      ...change.record,
      horas: this.domain.calcHoras(change.record.horaIni, change.record.horaFin),
    };
    recs[change.index] = updated;
    this.records.set(this.sortedRecords(recs));
    this.persistPendingRecords();
    this.refreshGroups();
    this.resetSendTracking();

    const option = this.solicitudOptions().find((item) => item.id === updated.gestionId);
    if (option) this.ensureManagementTemplate(option);
  }

  onDelete(index: number) {
    const recs = this.records().filter((_, i) => i !== index);
    this.records.set(this.sortedRecords(recs));
    this.persistPendingRecords();
    if (recs.length === 0) {
      this.showPreview.set(false);
      this.showAlert('No hay registros', 'error');
    } else {
      this.refreshGroups();
    }
  }

  onSendAll() {
    if (this.sending()) return;

    if (this.records().length === 0) {
      this.showAlert('No hay registros listos para enviar.', 'error', 'Envío bloqueado');
      return;
    }

    const blockedTemplate = this.firstBlockedManagementTemplate();
    if (blockedTemplate) {
      if (blockedTemplate.template) {
        this.openTemplateEdit(blockedTemplate.template);
      } else {
        this.ensureManagementTemplate(blockedTemplate.option);
      }
      const missingText = blockedTemplate.missing.length
        ? ` Faltan: ${blockedTemplate.missing.join(', ')}.`
        : '';
      this.alert.set({
        type: 'error',
        text: `Llena la configuración avanzada de la gestión antes de enviar.${missingText}`,
      });
      return;
    }

    this.alert.set(null);
    this.alertDialog.set(null);

    const invalidos = this.records()
      .map((reg, idx) => ({
        idx,
        errors: [...this.domain.getMissingFields(reg), ...this.domain.getInvalidFields(reg)],
      }))
      .filter((item) => item.errors.length > 0);

    if (invalidos.length) {
      const ejemplos = invalidos
        .slice(0, 3)
        .map((item) => `#${item.idx + 1} (${item.errors.join(', ')})`)
        .join('; ');
      this.showAlert(
        `Corrige ${invalidos.length} registros con datos invalidos antes de enviar. Ejemplos: ${ejemplos}`,
        'error',
        'Envío bloqueado por datos incompletos',
      );
      return;
    }

    const registrosExcedidos = this.domain.getLaborRecordsHoursExceeded(this.records());
    if (registrosExcedidos.length) {
      const ejemplos = registrosExcedidos
        .slice(0, 3)
        .map(
          (item) =>
            `#${item.index + 1} ${this.formatFullDate(item.fecha)}: ${item.horas.toFixed(1)}h/${item.limiteHoras}h`,
        )
        .join('; ');
      const suffix =
        registrosExcedidos.length > 3 ? `; y ${registrosExcedidos.length - 3} registro(s) mas` : '';
      this.showAlert(
        `No se pueden enviar registros computables de más de ${this.domain.getMaxDailyLaborHours()} horas. Ajusta: ${ejemplos}${suffix}`,
        'error',
        'Envío bloqueado por duración inválida',
      );
      return;
    }

    const diasExcedidos = this.domain.getDailyLaborHoursExceeded(this.records());
    if (diasExcedidos.length) {
      const ejemplos = diasExcedidos
        .slice(0, 3)
        .map(
          (item) =>
            `${this.formatFullDate(item.fecha)}: ${item.totalHoras.toFixed(1)}h/${item.limiteHoras}h ${item.tipoHora}`,
        )
        .join('; ');
      const suffix = diasExcedidos.length > 3 ? `; y ${diasExcedidos.length - 3} dia(s) mas` : '';
      this.showAlert(
        `No se pueden enviar registros con más de ${this.domain.getMaxDailyLaborHours()} horas computables por día. Ajusta: ${ejemplos}${suffix}`,
        'error',
        'Envío bloqueado por exceso diario',
      );
      return;
    }

    this.sending.set(true);
    this.sendPhase.set('sending');
    this.sendTotal.set(this.records().length);
    this.sendProcessed.set(0);
    this.sendSuccessCount.set(0);
    this.sendErrorCount.set(0);
    this.sendFailureMessage.set('');
    this.pendingSendResult = null;
    this.sendAll
      .execute(this.records(), (log) => this.onSendProgress(log))
      .subscribe({
        next: (result) => {
          this.pendingSendResult = result;
          this.persistSendLogs(result);
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.sendPhase.set('failed');
          this.sendFailureMessage.set(this.getErrorMessage(error));
        },
      });
  }

  retrySendLogs(): void {
    if (!this.pendingSendResult) return;
    this.sending.set(true);
    this.persistSendLogs(this.pendingSendResult);
  }

  continueAfterSend(): void {
    this.resetSendTracking();
  }

  goToSendLogs(): void {
    this.resetSendTracking();
    this.router.navigate(['/registros/logs']);
  }

  onCancelImport() {
    this.records.set([]);
    this.persistPendingRecords();
    this.groups.set([]);
    this.totalGeneral.set(0);
    this.showPreview.set(false);
    this.resetSendTracking();
    this.alert.set(null);
  }

  onDefaultClienteChange(cliente: string) {
    this.defaultCliente.set(cliente);
    this.defaultProyecto.set('');
    this.defaultSolicitud.set('');
    this.proyectos.set([]);
    this.solicitudes.set([]);

    if (!cliente) return;

    this.loadingDemand.set(true);
    this.options.proyectos(cliente).subscribe((proyectos) => {
      this.proyectos.set(proyectos);
      const proyecto = proyectos[0] ?? '';
      this.defaultProyecto.set(proyecto);
      this.loadSolicitudes(cliente, proyecto);
    });
  }

  onDefaultProyectoChange(proyecto: string) {
    this.defaultProyecto.set(proyecto);
    this.defaultSolicitud.set('');
    this.solicitudes.set([]);
    this.loadSolicitudes(this.defaultCliente(), proyecto);
  }

  onDefaultSolicitudChange(solicitud: string) {
    this.defaultSolicitud.set(solicitud);
  }

  onDefaultGestionChange(gestionId: string) {
    const option = this.solicitudOptions().find((item) => item.id === gestionId);
    this.defaultGestionId.set(gestionId);
    this.defaultSolicitud.set(option?.requestValue || option?.name || gestionId);
    if (option) this.ensureManagementTemplate(option);
  }

  openTemplateEdit(template: ManagementAdvancedTemplate): void {
    this.templateDialogMode.set('edit');
    this.templateDraft.set({ ...template, values: { ...template.values } });
    this.templateDialogVisible.set(true);
  }

  closeTemplateDialog(): void {
    if (this.templateDialogSaving()) return;
    this.templateDialogVisible.set(false);
    this.templateDraft.set(null);
  }

  saveTemplateDialog(): void {
    const draft = this.templateDraft();
    if (!draft?.gestionId) return;
    const missing = this.missingRequiredTemplateFields(draft);
    if (missing.length) {
      this.showAlert(`Faltan campos obligatorios: ${missing.join(', ')}.`, 'error');
      return;
    }
    const templateToSave: ManagementAdvancedTemplate = {
      ...draft,
      values: { ...draft.values },
      completed: true,
    };
    this.templateDialogSaving.set(true);
    this.templates.save(templateToSave).subscribe({
      next: (saved) => {
        this.templateDialogSaving.set(false);
        this.configuredManagementIds.update((ids) => new Set(ids).add(saved.gestionId));
        this.configuredManagementTemplates.update((items) =>
          this.mergeManagementTemplate(items, saved),
        );
        this.templateDialogVisible.set(false);
        this.templateDraft.set(null);
        this.showAlert('Configuración avanzada guardada para la gestión.', 'success');
      },
      error: (error) => {
        this.templateDialogSaving.set(false);
        this.showAlert(
          `No se pudo guardar la configuración: ${error?.message || 'intenta nuevamente'}`,
          'error',
        );
      },
    });
  }

  onTemplateDraftChange(template: ManagementAdvancedTemplate): void {
    this.templateDraft.set(template);
  }

  onReportFechaIniChange(value: string) {
    this.reportFechaIni = value;
    if (!this.reportFechaFin) this.reportFechaFin = value;
    this.reportPeriodPreset.set('custom');
  }

  onReportFechaFinChange(value: string) {
    this.reportFechaFin = value;
    if (!this.reportFechaIni) this.reportFechaIni = value;
    this.reportPeriodPreset.set('custom');
  }

  setReportPeriod(period: Exclude<ReportPeriodPreset, 'custom'>) {
    const end = new Date();
    const start = new Date(end);

    if (period !== 'day') {
      const months = period === '1m' ? 1 : period === '3m' ? 3 : 6;
      const targetMonth = new Date(end.getFullYear(), end.getMonth() - months, 1);
      const lastTargetDay = new Date(
        targetMonth.getFullYear(),
        targetMonth.getMonth() + 1,
        0,
      ).getDate();
      start.setFullYear(
        targetMonth.getFullYear(),
        targetMonth.getMonth(),
        Math.min(end.getDate(), lastTargetDay),
      );
      start.setDate(start.getDate() + 1);
    }

    this.reportFechaIni = this.toDateInputValue(start);
    this.reportFechaFin = this.toDateInputValue(end);
    this.reportPeriodPreset.set(period);
    this.reportResult.set(null);
    this.alert.set(null);
    this.alertDialog.set(null);
  }

  applyReportPeriodSegment(period: string): void {
    if (period === 'day' || period === '1m' || period === '3m' || period === '6m') {
      this.setReportPeriod(period);
    }
  }

  loadManagementReports() {
    this.managementLoading.set(true);
    this.managementError.set('');
    const userId = this.auth.user()?.id;
    const numericUserId = Number(userId);
    const consultantId = userId && !Number.isNaN(numericUserId) ? numericUserId : userId || null;
    this.management.list(consultantId).subscribe({
      next: (rows) => {
        const ownRows = rows.filter((report: ManagementReport) => this.isCurrentUserReport(report));
        this.managementReports.set(ownRows);
        this.syncManagementDatesFromReports(ownRows);
        this.managementLoaded.set(true);
        this.managementLoading.set(false);
      },
      error: (error) => {
        this.managementLoading.set(false);
        if (error?.status === 401 || error?.status === 403) {
          this.auth.clearTokens();
          return;
        }
        this.managementError.set(error?.message || 'No se pudieron cargar los reportes de tiempos');
      },
    });
  }

  onManagementSearchChange(value: string) {
    this.managementSearch = value;
    this.managementReports.update((rows) => [...rows]);
  }

  onManagementFechaIniChange(value: string) {
    this.managementFechaIni.set(value);
  }

  onManagementFechaFinChange(value: string) {
    this.managementFechaFin.set(value);
  }

  openManagementEdit(report: ManagementReport) {
    const fecha =
      this.managementReportDate(report) || this.domain.normalizeDateValue(report.HoraInicio || '');
    const draft: ManagementEditDraft = {
      identificador: report.identificador || '',
      fecha,
      horaIni: this.extractTimeValue(report.HoraInicio || ''),
      horaFin: this.extractTimeValue(report.HoraFin || ''),
      horas: String(report.tiempoRealHoras || ''),
      tipoHora: report.tipoHora || 'Laboral',
      descripcion: report.descripcionActividad || report.observacion || '',
    };

    if (!draft.horas && draft.horaIni && draft.horaFin) {
      draft.horas = this.domain.calcHoras(draft.horaIni, draft.horaFin);
    }

    this.managementEditOriginal.set(report);
    this.managementEditDraft.set(draft);
    this.managementEditVisible.set(true);
    this.refreshManagementEditValidation();
  }

  openManagementDelete(report: ManagementReport): void {
    if (!report.identificador || this.managementDeleteSaving()) return;
    this.managementTechnicalKey = '';
    this.managementDeleteReport.set(report);
  }

  closeManagementDelete(): void {
    if (this.managementDeleteSaving()) return;
    this.managementDeleteReport.set(null);
    this.managementTechnicalKey = '';
  }

  confirmManagementDelete(): void {
    const report = this.managementDeleteReport();
    const identifier = String(report?.identificador || '').trim();
    if (!report || !identifier || this.managementDeleteSaving()) return;
    const technicalKey = this.managementTechnicalKey.trim();
    const requesterEmail = this.auth.user()?.email || '';
    const usesTechnicalDelete =
      !!technicalKey && this.parameters.canUseTechnicalDelete(requesterEmail);
    this.managementDeleteSaving.set(true);
    const request$ = usesTechnicalDelete
      ? this.management.technicalDelete({ identifier, technicalKey, requesterEmail })
      : this.management.requestDelete({
          identifier,
          auditorEmail: this.parameters.deletionSettings().auditorEmail,
          report,
        });

    request$.subscribe({
      next: () => {
        this.managementDeleteSaving.set(false);
        if (usesTechnicalDelete) {
          this.managementReports.update((rows) =>
            rows.filter((item) => String(item.identificador || '') !== identifier),
          );
          this.loadManagementReports();
        }
        this.managementDeleteReport.set(null);
        this.managementTechnicalKey = '';
        this.showAlert(
          usesTechnicalDelete
            ? 'Reporte eliminado correctamente'
            : 'Solicitud de eliminación enviada a auditoría',
          'success',
        );
      },
      error: (error) => {
        this.managementDeleteSaving.set(false);
        const message = this.managementDeleteErrorMessage(error, usesTechnicalDelete);
        if (usesTechnicalDelete) {
          this.showAlert(message, 'error', 'No se pudo eliminar');
        } else {
          this.showAuditAlert(message);
        }
      },
    });
  }

  private managementDeleteErrorMessage(error: unknown, technicalDelete: boolean): string {
    const response = error as { error?: unknown; status?: number };
    const body = response?.error as { error?: unknown; message?: unknown } | string | undefined;
    const backendMessage =
      typeof body === 'string'
        ? body
        : typeof body?.error === 'string'
          ? body.error
          : typeof body?.message === 'string'
            ? body.message
            : '';

    if (backendMessage && !/failed to fetch/i.test(backendMessage)) {
      return technicalDelete
        ? `No se pudo eliminar el reporte: ${backendMessage}`
        : `No se pudo enviar la solicitud a auditoría: ${backendMessage}`;
    }
    if (response?.status === 0) {
      return technicalDelete
        ? 'No se pudo contactar el servicio de eliminación técnica. Verifica que la función esté desplegada y vuelve a intentarlo.'
        : 'No se pudo contactar el servicio de solicitudes a auditoría. Verifica que la función esté desplegada y vuelve a intentarlo.';
    }
    if (/failed to fetch/i.test(backendMessage)) {
      return technicalDelete
        ? 'No se pudo contactar el backend PMO desde el servicio de eliminación técnica. Revisa el despliegue y las variables de la función.'
        : 'No se pudo contactar el servicio de auditoría. Revisa el despliegue y las variables de la función.';
    }
    return technicalDelete
      ? 'No se pudo eliminar el reporte. Intenta nuevamente.'
      : 'No se pudo enviar la solicitud a auditoría. Intenta nuevamente.';
  }

  closeManagementEdit() {
    if (this.managementEditSaving()) return;
    this.managementEditVisible.set(false);
    this.managementEditDraft.set(null);
    this.managementEditOriginal.set(null);
    this.managementEditErrors.set([]);
  }

  openManagementDetail(report: ManagementReport): void {
    this.managementDetailReport.set(report);
  }

  closeManagementDetail(): void {
    this.managementDetailReport.set(null);
  }

  onManagementEditTimeChange() {
    const draft = this.managementEditDraft();
    if (!draft) return;
    const horas = this.domain.calcHoras(draft.horaIni, draft.horaFin);
    this.managementEditDraft.set({ ...draft, horas: horas || draft.horas || '0' });
    this.refreshManagementEditValidation();
  }

  onManagementEditChange() {
    const draft = this.managementEditDraft();
    if (!draft) return;
    this.managementEditDraft.set({ ...draft });
    this.refreshManagementEditValidation();
  }

  managementEditOptions(key: AdvancedFieldKey, currentValue: string): readonly UiSelectOption[] {
    const configured = this.parameters.optionsFor(key).map((option) => ({
      value: option.value,
      label: option.label,
      disabled: !option.active,
    }));
    if (currentValue && !configured.some((option) => option.value === currentValue)) {
      return [{ value: currentValue, label: currentValue }, ...configured];
    }
    return configured;
  }

  saveManagementEdit() {
    this.refreshManagementEditValidation();
    const draft = this.managementEditDraft();
    if (!draft || this.managementEditErrors().length) return;

    const report = this.managementEditOriginal();
    const management = report ? this.managementOptionFromReport(report) : null;
    if (management && !this.templateForManagement(management)) {
      this.templates.get(management.id).subscribe((template) => {
        if (template) {
          this.configuredManagementIds.update((ids) => new Set(ids).add(management.id));
          this.configuredManagementTemplates.update((items) =>
            this.mergeManagementTemplate(items, template),
          );
          this.persistManagementEdit(draft);
          return;
        }
        this.ensureManagementTemplate(management);
        this.alert.set({
          type: 'error',
          text: 'Crea la configuración avanzada de esta gestión antes de actualizar el reporte.',
        });
      });
      return;
    }

    this.persistManagementEdit(draft);
  }

  private persistManagementEdit(draft: ManagementEditDraft): void {
    this.managementEditSaving.set(true);
    this.management.update(draft.identificador, this.buildManagementEditBody(draft)).subscribe({
      next: () => {
        this.managementEditSaving.set(false);
        this.applyManagementEditLocally(draft);
        this.closeManagementEdit();
        this.showAlert('Reporte actualizado correctamente', 'success');
      },
      error: (error) => {
        this.managementEditSaving.set(false);
        this.showAlert(
          `No se pudo actualizar el reporte: ${error?.message || 'intenta nuevamente'}`,
          'error',
        );
      },
    });
  }

  clearManagementFilters() {
    this.managementFechaIni.set('');
    this.managementFechaFin.set('');
    this.managementHourFilter.set('all');
    this.onManagementSearchChange('');
  }

  clearReportTableFilters() {
    this.reportTableConsultant.set('');
    this.reportTableClient.set('');
    this.reportTableDate.set('');
    this.reportTableHourFilter.set('all');
    this.reportTableSearch.set('');
  }

  resolveExcelEmptyAction() {
    if (this.excelReports().length) {
      this.clearReportTableFilters();
      return;
    }
    this.downloadReport();
  }

  resolveManagementEmptyAction() {
    if (this.managementReports().length) {
      this.clearManagementFilters();
      return;
    }
    this.loadManagementReports();
  }

  downloadReport() {
    this.alert.set(null);
    this.reportResult.set(null);
    if (!this.reportFechaIni || !this.reportFechaFin) {
      this.showAlert('Selecciona fecha inicio y fecha fin', 'error');
      return;
    }
    if (
      !this.domain.isValidDateValue(this.reportFechaIni) ||
      !this.domain.isValidDateValue(this.reportFechaFin)
    ) {
      this.showAlert(
        'Revisa las fechas del reporte. Usa fechas reales en formato valido.',
        'error',
      );
      return;
    }
    if (this.reportFechaIni > this.reportFechaFin) {
      this.showAlert('La fecha inicio no puede ser mayor a la fecha fin', 'error');
      return;
    }

    const numericCliente = Number(this.reportCliente);
    const body = {
      fechaInicio: `${this.reportFechaIni}T05:00:00.000Z`,
      fechaFin: `${this.reportFechaFin}T05:00:00.000Z`,
      cliente: this.reportCliente
        ? Number.isNaN(numericCliente)
          ? this.reportCliente
          : numericCliente
        : null,
      idConsultor: null,
      proyecto: null,
      solicitud: null,
    };

    this.downloadingReport.set(true);
    this.management.download(body).subscribe({
      next: async (data) => {
        if (data?.excel) {
          try {
            await this.loadExcelReport(data.excel);
            this.reportResult.set({
              type: 'success',
              title: 'Reporte generado',
              detail: `${this.excelReports().length} registros procesados directamente en pantalla. Puedes segmentarlos por facturación.`,
            });
            this.showAlert('Reporte generado correctamente', 'success');
          } catch (error) {
            this.excelReports.set([]);
            this.showAlert(
              `No se pudo leer el reporte recibido: ${error instanceof Error ? error.message : 'formato no válido'}`,
              'error',
            );
          } finally {
            this.downloadingReport.set(false);
          }
          return;
        }
        this.downloadingReport.set(false);
        this.excelReports.set([]);
        this.reportResult.set({
          type: 'empty',
          title: 'Sin datos',
          detail: data?.mensaje || 'No hay registros para los filtros seleccionados.',
        });
      },
      error: (error) => {
        this.downloadingReport.set(false);
        if (error?.status === 401 || error?.status === 403) {
          this.auth.clearTokens();
          return;
        }
        this.showAlert(
          `Error al generar el reporte: ${error?.message || 'intenta nuevamente'}`,
          'error',
        );
      },
    });
  }

  clearReport() {
    this.reportCliente = '';
    this.reportFechaIni = '';
    this.reportFechaFin = '';
    this.reportPeriodPreset.set('custom');
    this.reportResult.set(null);
    this.excelReports.set([]);
    this.clearReportTableFilters();
    this.alert.set(null);
  }

  reportHours(report: ManagementReport): number {
    const value = Number(report.tiempoRealHoras || 0);
    return Number.isFinite(value) ? value : 0;
  }

  isCurrentUserReport(report: ManagementReport): boolean {
    const user = this.auth.user();
    if (!user) return false;

    const userIds = [
      user.id,
      this.valueFromRawUser('id'),
      this.valueFromRawUser('idUsuario'),
      this.valueFromRawUser('userId'),
    ]
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
      .map((value) => String(value).trim());
    const userTexts = [
      user.email,
      user.username,
      user.name,
      this.valueFromRawUser('correo'),
      this.valueFromRawUser('mail'),
      this.valueFromRawUser('usuario'),
      this.valueFromRawUser('nombre'),
      this.valueFromRawUser('nombreCompleto'),
    ]
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
      .map((value) => this.normalizeText(value));

    const reportIds = [
      report.idConsultor,
      report.idUsuario,
      report.usuario_tiemposConsultores?.id,
      this.valueFromObject(report, 'idConsultor'),
      this.valueFromObject(report, 'idUsuario'),
      this.valueFromObject(report, 'userId'),
    ]
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
      .map((value) => String(value).trim());

    if (reportIds.length && userIds.some((userId) => reportIds.includes(userId))) return true;

    const reportTexts = [
      report.consultor,
      report.nombreConsultor,
      report.usuario,
      report.email,
      report.correo,
      report.funcional,
      report.usuario_tiemposConsultores?.nombre,
      report.usuario_tiemposConsultores?.email,
      report.usuario_tiemposConsultores?.correo,
      report.usuario_tiemposConsultores?.usuario,
      ...this.collectIdentityText(report),
    ]
      .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
      .map((value) => this.normalizeText(value));

    if (!reportIds.length && !reportTexts.length) return true;

    return userTexts.some((userText) =>
      reportTexts.some(
        (reportText) =>
          reportText === userText || reportText.includes(userText) || userText.includes(reportText),
      ),
    );
  }

  managementDailyLaborHoursWithDraft(): number {
    const draft = this.managementEditDraft();
    if (!draft || !this.domain.isCountableHour(draft.tipoHora)) return 0;
    const original = this.managementEditOriginal();
    return this.managementReports().reduce(
      (sum, report) => {
        if ((report.identificador || '') === (original?.identificador || '')) return sum;
        if (this.managementReportDate(report) !== draft.fecha) return sum;
        if (!this.domain.isCountableHour(report.tipoHora || '')) return sum;
        return sum + this.reportHours(report);
      },
      Number(draft.horas || 0),
    );
  }

  clientName(report: ManagementReport): string {
    return report.solicitud_tiemposConsultores?.solicitud_cliente?.nombre || 'Sin cliente';
  }

  managementName(report: ManagementReport): string {
    return (
      report.solicitud_tiemposConsultores?.nombreGestion ||
      report.solicitud ||
      report.identificador ||
      'Sin gestion'
    );
  }

  private filterManagementReportsByDate(
    reports: readonly ManagementReport[],
    start: string,
    end: string,
  ): ManagementReport[] {
    return reports.filter((report) => {
      if (!this.isCurrentUserReport(report)) return false;
      const date = this.managementReportDate(report);
      if (!date) return false;
      if (start && date < start) return false;
      if (end && date > end) return false;
      if (!this.domain.matchesHourBillingFilter(report.tipoHora || '', this.managementHourFilter()))
        return false;
      return true;
    });
  }

  private searchManagementReports(
    reports: readonly ManagementReport[],
    search: string,
  ): ManagementReport[] {
    const term = this.normalizeText(search);
    const rows = [...reports].sort((a, b) =>
      this.managementSortKey(b).localeCompare(this.managementSortKey(a)),
    );
    if (!term) return rows;

    return rows.filter((report) =>
      [
        report.identificador,
        report.descripcionActividad,
        report.solicitud,
        report.funcional,
        report.tecnologia,
        this.moduleFromReport(report),
        this.clientName(report),
      ].some((value) => this.normalizeText(value).includes(term)),
    );
  }

  moduleFromReport(report: ManagementReport): string {
    return String(report.modulo || '').trim();
  }

  private managementSortKey(report: ManagementReport): string {
    return `${this.managementReportDate(report)} ${this.managementReportStartTime(report)}`;
  }

  managementOptionFromReport(report: ManagementReport): ManagementDemandOption | null {
    const id = this.managementReportText(report, [
      'gestionId',
      'idGestion',
      'idSolicitud',
      'solicitudId',
      'id_solicitud',
      'id_gestion',
      'solicitud',
      'gestionDemanda',
    ]);
    const name = this.managementName(report);
    const value = (id || name).trim();
    if (!value || value === 'Sin gestion') return null;
    return {
      id: value,
      name: name === 'Sin gestion' ? value : name,
      client: this.clientName(report),
      project: report.proyecto ? String(report.proyecto) : undefined,
      module: report.modulo ? String(report.modulo) : undefined,
      raw: report,
    };
  }

  formatHours(value: number): string {
    return value.toFixed(value % 1 === 0 ? 0 : 1);
  }

  formatFullDate(date: string): string {
    if (!date) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(this.parseLocalDate(date));
  }

  formatShortDate(date: string): string {
    if (!date) return '--';
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: '2-digit',
    }).format(this.parseLocalDate(date));
  }

  showAlert(text: string, type: 'success' | 'error', title = 'No se puede continuar') {
    this.alert.set({ text, type });
    if (type === 'error') {
      this.alertDialog.set({ title, text, context: 'validation' });
      return;
    }
    setTimeout(() => this.alert.set(null), 5000);
  }

  showAuditAlert(text: string, title = 'No se pudo enviar a auditoría') {
    this.alert.set({ text, type: 'error' });
    this.alertDialog.set({ title, text, context: 'audit' });
  }

  closeAlertDialog() {
    this.alertDialog.set(null);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (!error || typeof error !== 'object') return 'Intenta nuevamente.';

    const response = error as Record<string, unknown>;
    const nested = response['error'];
    if (nested && typeof nested === 'object') {
      const nestedMessage = (nested as Record<string, unknown>)['message'];
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
    }

    const message = response['message'];
    return typeof message === 'string' && message.trim() ? message : 'Intenta nuevamente.';
  }

  private onSendProgress(log: SendRecordLog) {
    this.sendProcessed.update((value) => value + 1);
  }

  private persistSendLogs(result: SendResult): void {
    this.sendPhase.set('saving-logs');
    this.sendFailureMessage.set('');
    this.sendLogGateway
      .createMany(
        result.logs.map((log) => ({
          itemIndex: log.index,
          successful: log.ok,
          reference: log.identificador,
          errorMessage: log.errorMessage,
        })),
      )
      .subscribe({
        next: () => this.completeSend(result),
        error: (error: unknown) => {
          this.sending.set(false);
          this.sendPhase.set('log-error');
          this.sendFailureMessage.set(this.getErrorMessage(error));
        },
      });
  }

  private completeSend(result: SendResult): void {
    this.sending.set(false);
    this.sendSuccessCount.set(result.enviados);
    this.sendErrorCount.set(result.errores);
    if (result.errores === 0) {
      this.records.set([]);
      this.persistPendingRecords();
      this.groups.set([]);
      this.totalGeneral.set(0);
      this.showPreview.set(false);
    } else {
      this.records.set(
        this.records().filter((_, index) => !result.enviadosIndices.includes(index)),
      );
      this.persistPendingRecords();
      this.refreshGroups();
      this.showPreview.set(this.records().length > 0);
    }
    this.sendPhase.set('completed');
  }

  private resetSendTracking() {
    this.sending.set(false);
    this.sendTotal.set(0);
    this.sendProcessed.set(0);
    this.sendSuccessCount.set(0);
    this.sendErrorCount.set(0);
    this.sendFailureMessage.set('');
    this.pendingSendResult = null;
    this.sendPhase.set('idle');
  }

  private loadDefaultSelection() {
    this.loadingClients.set(true);
    this.options.clientes().subscribe((clientes) => {
      this.clientes.set(clientes);
      this.loadingClients.set(false);
      const cliente = clientes[0] ?? '';
      if (!cliente) return;
      this.onDefaultClienteChange(cliente);
    });
  }

  private restorePendingRecords(): void {
    try {
      const stored = localStorage.getItem(this.pendingRecordsStorageKey);
      const parsed = stored ? (JSON.parse(stored) as TimeRecord[]) : [];
      if (!Array.isArray(parsed) || !parsed.length) return;
      this.records.set(this.sortedRecords(parsed));
      this.refreshGroups();
      this.syncReportDatesFromRecords(parsed);
      this.showPreview.set(true);
      this.showAlert(`Se restauraron ${parsed.length} registros pendientes.`, 'success');
    } catch {
      localStorage.removeItem(this.pendingRecordsStorageKey);
    }
  }

  private persistPendingRecords(): void {
    const records = this.records();
    if (!records.length) {
      localStorage.removeItem(this.pendingRecordsStorageKey);
      return;
    }
    localStorage.setItem(this.pendingRecordsStorageKey, JSON.stringify(records));
  }

  private sortedRecords(records: TimeRecord[]): TimeRecord[] {
    return [...records].sort((a, b) => {
      const dateComparison = String(a.fecha || '').localeCompare(String(b.fecha || ''));
      if (dateComparison !== 0) return dateComparison;
      const startComparison = this.minutesOf(a.horaIni) - this.minutesOf(b.horaIni);
      if (startComparison !== 0) return startComparison;
      return this.minutesOf(a.horaFin) - this.minutesOf(b.horaFin);
    });
  }

  private minutesOf(value: string): number {
    const [hour, minute] = String(value || '')
      .split(':')
      .map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
    return hour * 60 + minute;
  }

  private applyImportDefaults(record: TimeRecord): TimeRecord {
    return {
      ...record,
      tipoHora: record.tipoHora || this.parameters.defaultFor('tipoHora') || 'Laboral',
    };
  }

  private loadSolicitudes(cliente: string, proyecto: string) {
    if (!cliente) {
      this.solicitudes.set([]);
      this.solicitudOptions.set([]);
      this.loadingDemand.set(false);
      return;
    }

    this.options.solicitudOptions(cliente, proyecto).subscribe((solicitudes) => {
      const options = solicitudes.map((solicitud) => ({
        ...solicitud,
        client: solicitud.client || cliente,
        project: solicitud.project || proyecto,
      }));
      this.solicitudOptions.set(options);
      this.solicitudes.set(options.map((item) => item.name));
      const selected = options[0] ?? null;
      this.defaultSolicitud.set(selected?.requestValue || selected?.name || '');
      this.defaultGestionId.set(selected?.id || '');
      this.loadingDemand.set(false);
    });
  }

  private loadManagementTemplates(): void {
    this.templates.list().subscribe((templates) => {
      this.configuredManagementIds.set(new Set(templates.map((item) => item.gestionId)));
      this.configuredManagementTemplates.set(this.buildManagementTemplateMap(templates));
    });
  }

  private ensureManagementTemplate(option: ManagementDemandOption): void {
    this.templates.registerKnownManagement(option);
    if (!option.id || this.templateDialogVisible() || this.templateForManagement(option)) {
      return;
    }
    this.templates.get(option.id).subscribe((template) => {
      if (template) {
        const templateWithControlData = this.withManagementControlData(template, option);
        this.configuredManagementIds.update((ids) => new Set(ids).add(option.id));
        this.configuredManagementTemplates.update((items) =>
          this.mergeManagementTemplate(items, templateWithControlData),
        );
        if (templateWithControlData !== template)
          this.templates.save(templateWithControlData).subscribe();
        return;
      }
      this.templateDialogMode.set('create');
      this.templateDraft.set({
        gestionId: option.id,
        gestionName: option.name,
        client: option.client,
        project: option.project,
        values: this.defaultTemplateValues(option),
        completed: false,
      });
      this.templateDialogVisible.set(true);
    });
  }

  private firstBlockedManagementTemplate(): {
    option: ManagementDemandOption;
    template: ManagementAdvancedTemplate | null;
    missing: string[];
  } | null {
    const configuredTemplates = this.configuredManagementTemplates();
    for (const record of this.records()) {
      const gestionId = (record.gestionId || record.solicitud || '').trim();
      if (!gestionId) continue;
      const option = this.templates.knownManagement(gestionId) || {
        id: gestionId,
        name: record.solicitud || gestionId,
        client: record.cliente,
        project: record.proyecto,
      };
      const matchedTemplate = this.templateForManagement(option, configuredTemplates);
      if (matchedTemplate) {
        const missing = this.missingRequiredTemplateFields(matchedTemplate);
        if (matchedTemplate.completed !== true || missing.length) {
          return { option, template: matchedTemplate, missing };
        }
        continue;
      }
      return { option, template: null, missing: [] };
    }
    return null;
  }

  private defaultTemplateValues(option?: ManagementDemandOption): AdvancedTemplateValues {
    return {
      proyecto: option?.project || this.defaultProyecto(),
      funcional: '',
      tipoActividad: this.parameters.defaultFor('tipoActividad'),
      causa: this.parameters.defaultFor('causa'),
      complejidad: this.parameters.defaultFor('complejidad'),
      impacto: this.parameters.defaultFor('impacto'),
      equipo: this.parameters.defaultFor('equipo'),
      modoActuacion: this.parameters.defaultFor('modoActuacion'),
      lenguaje: this.parameters.defaultFor('lenguaje'),
      prefijo: this.parameters.defaultFor('prefijo'),
      objetoRicef: this.parameters.defaultFor('objetoRicef'),
      categoria: this.parameters.defaultFor('categoria'),
    };
  }

  private withManagementControlData(
    template: ManagementAdvancedTemplate,
    option: ManagementDemandOption,
  ): ManagementAdvancedTemplate {
    const values = { ...template.values };
    let changed = false;
    if (option.client && !template.client) changed = true;
    if (option.project && !template.project) changed = true;
    return changed
      ? {
          ...template,
          client: template.client || option.client,
          project: template.project || option.project,
          values,
        }
      : template;
  }

  private missingRequiredTemplateFields(template: ManagementAdvancedTemplate): string[] {
    return REQUIRED_ADVANCED_TEMPLATE_FIELDS.filter((field) =>
      isMissingAdvancedTemplateValue(template.values[field.key]),
    ).map((field) => field.label);
  }

  private buildManagementTemplateMap(
    templates: readonly ManagementAdvancedTemplate[],
  ): Map<string, ManagementAdvancedTemplate> {
    return templates.reduce(
      (map, template) => this.mergeManagementTemplate(map, template),
      new Map<string, ManagementAdvancedTemplate>(),
    );
  }

  private mergeManagementTemplate(
    map: Map<string, ManagementAdvancedTemplate>,
    template: ManagementAdvancedTemplate,
  ): Map<string, ManagementAdvancedTemplate> {
    const next = new Map(map);
    this.managementTemplateKeys(template).forEach((key) => next.set(key, template));
    return next;
  }

  private templateForManagement(
    option: ManagementDemandOption,
    templates = this.configuredManagementTemplates(),
  ): ManagementAdvancedTemplate | null {
    return (
      this.managementOptionKeys(option)
        .map((key) => templates.get(key))
        .find((template): template is ManagementAdvancedTemplate => !!template) || null
    );
  }

  private managementTemplateKeys(template: ManagementAdvancedTemplate): string[] {
    return this.uniqueText([
      template.gestionId,
      template.gestionName,
      this.normalizeManagementName(template.gestionName),
    ]);
  }

  private managementOptionKeys(option: ManagementDemandOption): string[] {
    return this.uniqueText([
      option.id,
      option.name,
      option.requestValue || '',
      this.normalizeManagementName(option.name),
      this.normalizeManagementName(option.id),
      this.normalizeManagementName(option.requestValue),
    ]);
  }

  private normalizeManagementName(value: unknown): string {
    return this.normalizeText(value).replace(/\s+/g, ' ');
  }

  private syncReportDatesFromRecords(records: TimeRecord[]) {
    const fechas = records
      .map((record) => record.fecha)
      .filter(Boolean)
      .sort();
    if (!fechas.length) return;
    this.reportFechaIni = fechas[0];
    this.reportFechaFin = fechas[fechas.length - 1];
  }

  private syncManagementDatesFromReports(reports: ManagementReport[]) {
    if (this.managementFechaIni() || this.managementFechaFin()) return;
    const latestDate = reports
      .map((report) => this.managementReportDate(report))
      .filter((date): date is string => !!date)
      .sort()
      .at(-1);
    if (!latestDate) return;

    const monday = this.startOfWeek(this.parseLocalDate(latestDate));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    this.managementFechaIni.set(this.toDateInputValue(monday));
    this.managementFechaFin.set(this.toDateInputValue(sunday));
  }

  private async loadExcelReport(base64: string): Promise<void> {
    const bytes = this.base64ToBytes(base64);
    const workbook = await readXlsxFile(
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    const sheet =
      workbook.find((item) => this.normalizeText(item.sheet).includes('tiempo consultores')) ||
      workbook[0];
    if (!sheet?.data?.length) throw new Error('el archivo no contiene datos');

    const [headerRow, ...rows] = sheet.data as unknown[][];
    const indexes = new Map<string, number>();
    headerRow.forEach((value, index) => indexes.set(this.normalizeHeader(value), index));
    const column = (...aliases: string[]): number => {
      for (const alias of aliases) {
        const index = indexes.get(this.normalizeHeader(alias));
        if (index !== undefined) return index;
      }
      return -1;
    };
    const valueAt = (row: unknown[], index: number): unknown => (index >= 0 ? row[index] : '');
    const columns = {
      identificador: column('Identificador'),
      solicitud: column('Solicitud'),
      categoria: column('Categoria'),
      cliente: column('Cliente'),
      consultor: column('Consultor'),
      descripcion: column('Descripcion actividad'),
      horas: column('Tiempo Real en Horas'),
      tipoHora: column('Tipo de Hora'),
      fecha: column('fecha inicio'),
      funcional: column('Funcional'),
      gestion: column('Gestion de demanda'),
      modulo: column('Modulo'),
      tecnologia: column('Tecnologia'),
      tipoActividad: column('Tipo de actividad'),
      proyecto: column('Proyecto'),
      horaInicio: column('Hora de Inicio'),
      horaFin: column('Hora de Fin'),
    };
    if (columns.fecha < 0 || columns.horas < 0) {
      throw new Error('faltan las columnas Fecha inicio o Tiempo Real en Horas');
    }

    const reports = rows
      .map((row) => ({
        identificador: this.excelText(valueAt(row, columns.identificador)),
        solicitud: this.excelText(valueAt(row, columns.solicitud)),
        categoria: this.excelText(valueAt(row, columns.categoria)),
        cliente: this.excelText(valueAt(row, columns.cliente)) || 'Sin cliente',
        consultor: this.excelText(valueAt(row, columns.consultor)) || 'Sin consultor',
        descripcion: this.excelText(valueAt(row, columns.descripcion)),
        horas: this.excelNumber(valueAt(row, columns.horas)),
        tipoHora: this.excelText(valueAt(row, columns.tipoHora)),
        fecha: this.excelDate(valueAt(row, columns.fecha)),
        funcional: this.excelText(valueAt(row, columns.funcional)),
        gestion: this.excelText(valueAt(row, columns.gestion)),
        modulo: this.excelText(valueAt(row, columns.modulo)),
        tecnologia: this.excelText(valueAt(row, columns.tecnologia)),
        tipoActividad: this.excelText(valueAt(row, columns.tipoActividad)),
        proyecto: this.excelText(valueAt(row, columns.proyecto)),
        horaInicio: this.excelTime(valueAt(row, columns.horaInicio)),
        horaFin: this.excelTime(valueAt(row, columns.horaFin)),
      }))
      .filter((row) => row.fecha && Number.isFinite(row.horas));

    if (!reports.length) throw new Error('no se encontraron registros de tiempo válidos');
    const preferredNames = new Map<string, { label: string; score: number }>();
    reports.forEach((report) => {
      const key = this.personNameKey(report.consultor);
      const candidate = {
        label: this.formatPersonName(report.consultor),
        score: this.personNameScore(report.consultor),
      };
      const current = preferredNames.get(key);
      if (!current || candidate.score > current.score) preferredNames.set(key, candidate);
    });
    this.excelReports.set(
      reports.map((report) => ({
        ...report,
        consultor:
          preferredNames.get(this.personNameKey(report.consultor))?.label ||
          this.formatPersonName(report.consultor),
      })),
    );
    const consultants = this.excelConsultants();
    this.reportTableConsultant.set(consultants.length === 1 ? consultants[0] : '');
    this.reportTableClient.set('');
    this.reportTableDate.set('');
    this.reportTableHourFilter.set('all');
    this.reportTableSearch.set('');
  }

  private base64ToBytes(base64: string): ArrayBuffer {
    const content = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    const decoded = atob(content.replace(/\s/g, ''));
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
    return bytes.buffer;
  }

  private uniqueText(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  private personNameKey(value: unknown): string {
    return this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatPersonName(value: unknown): string {
    const connectors = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
    return this.excelText(value)
      .toLocaleLowerCase('es-CO')
      .split(/\s+/)
      .filter(Boolean)
      .map((word, index) => {
        if (index > 0 && connectors.has(this.normalizeText(word))) return word;
        return word.charAt(0).toLocaleUpperCase('es-CO') + word.slice(1);
      })
      .join(' ');
  }

  private personNameScore(value: unknown): number {
    const text = this.excelText(value);
    const accents = (text.match(/[áéíóúñÁÉÍÓÚÑ]/g) || []).length;
    const mixedCase =
      text !== text.toLocaleUpperCase('es-CO') && text !== text.toLocaleLowerCase('es-CO');
    return accents * 10 + (mixedCase ? 2 : 0);
  }

  private normalizeHeader(value: unknown): string {
    return this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private excelText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  }

  private excelNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    const parsed = Number(this.excelText(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private excelDate(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime()))
      return this.toDateInputValue(value);
    const text = this.excelText(value);
    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const local = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (!local) return '';
    return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
  }

  private excelTime(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    }
    const match = this.excelText(value).match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
  }

  private refreshManagementEditValidation() {
    const draft = this.managementEditDraft();
    if (!draft) {
      this.managementEditErrors.set([]);
      return;
    }

    const errors: string[] = [];
    if (!draft.identificador) errors.push('Identificador requerido');
    if (!this.domain.isValidDateValue(draft.fecha)) errors.push('Fecha invalida');
    if (!this.domain.isValidTimeValue(draft.horaIni)) errors.push('Hora inicio invalida');
    if (!this.domain.isValidTimeValue(draft.horaFin)) errors.push('Hora fin invalida');
    if (!draft.descripcion.trim()) errors.push('Descripcion requerida');

    const calculatedHours = this.domain.calcHoras(draft.horaIni, draft.horaFin);
    const hours = Number(draft.horas || calculatedHours || 0);
    if (!Number.isFinite(hours) || hours <= 0) errors.push('Horas debe ser mayor a 0');
    if (!calculatedHours) errors.push('Hora fin debe ser mayor a hora inicio');

    if (this.domain.isCountableHour(draft.tipoHora)) {
      const limit = this.domain.getMaxDailyLaborHours();
      if (hours > limit) errors.push(`Un registro computable no puede superar ${limit} horas`);
      const dailyTotal = this.managementDailyLaborHoursWithDraft();
      if (dailyTotal > limit)
        errors.push(`El total computable del día queda en ${dailyTotal.toFixed(1)}h/${limit}h`);
    }

    this.managementEditErrors.set(errors);
  }

  private buildManagementEditBody(draft: ManagementEditDraft): Record<string, unknown> {
    const [y, mo, d] = draft.fecha.split('-');
    const [ih, im] = draft.horaIni.split(':');
    const [fh, fm] = draft.horaFin.split(':');

    return {
      HoraInicio: `${y}-${mo}-${d}T${ih}:${im}:00.000Z`,
      HoraFin: `${y}-${mo}-${d}T${fh}:${fm}:00.000Z`,
      tiempoRealHoras: draft.horas,
      fechaInicio: this.buildColombiaDateLabel(draft.fecha, draft.horaIni),
      tipoHora: draft.tipoHora || 'Laboral',
      descripcionActividad: draft.descripcion.trim(),
      observacion: draft.descripcion.trim(),
    };
  }

  private applyManagementEditLocally(draft: ManagementEditDraft) {
    this.managementReports.update((rows) =>
      rows.map((report) => {
        if ((report.identificador || '') !== draft.identificador) return report;
        return {
          ...report,
          fechaInicio: this.buildColombiaDateLabel(draft.fecha, draft.horaIni),
          HoraInicio: this.buildIsoDateTime(draft.fecha, draft.horaIni),
          HoraFin: this.buildIsoDateTime(draft.fecha, draft.horaFin),
          tiempoRealHoras: draft.horas,
          tipoHora: draft.tipoHora,
          descripcionActividad: draft.descripcion,
          observacion: draft.descripcion,
        };
      }),
    );
  }

  private buildIsoDateTime(date: string, time: string): string {
    return `${date}T${time}:00.000Z`;
  }

  managementReportDate(report: ManagementReport): string {
    return (
      this.domain.normalizeDateValue(report.fechaInicio || '') ||
      this.domain.normalizeDateValue(report.HoraInicio || '') ||
      this.extractDateValue(report.fechaInicio || '') ||
      this.extractDateValue(report.HoraInicio || '')
    );
  }

  private managementReportStartTime(report: ManagementReport): string {
    return (
      this.extractTimeValue(report.HoraInicio || '') ||
      this.extractTimeValue(report.fechaInicio || '')
    );
  }

  private managementReportText(report: ManagementReport, keys: string[]): string {
    for (const key of keys) {
      const value = report[key];
      if (value !== null && value !== undefined && String(value).trim())
        return String(value).trim();
    }
    return '';
  }

  private extractTimeValue(value: string): string {
    if (!value) return '';
    const isoMatch = value.match(/T(\d{2}:\d{2})/);
    if (isoMatch) return isoMatch[1];
    const textualMatch = value.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
    if (textualMatch) return `${textualMatch[1].padStart(2, '0')}:${textualMatch[2]}`;
    const plainMatch = value.match(/^(\d{2}:\d{2})/);
    return plainMatch ? plainMatch[1] : '';
  }

  private extractDateValue(value: string): string {
    if (!value) return '';
    const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const textual = value.match(
      /\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/i,
    );
    if (!textual) return '';
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    return `${textual[3]}-${months[textual[1].toLowerCase()] || '01'}-${textual[2].padStart(2, '0')}`;
  }

  private buildColombiaDateLabel(date: string, time: string): string {
    const [y, mo, d] = date.split('-');
    const [ih, im] = time.split(':');
    const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const meses = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const dateObj = new Date(`${date}T12:00:00`);
    return `${dias[dateObj.getDay()]} ${meses[Number(mo) - 1]} ${d} ${y} ${ih}:${im}:00 GMT-0500 (hora estandar de Colombia)`;
  }

  private valueFromRawUser(key: string): unknown {
    const raw = this.auth.user()?.raw;
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
  }

  private valueFromObject(value: unknown, key: string): unknown {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    if (key in record) return record[key];

    for (const child of Object.values(record)) {
      const found = this.valueFromObject(child, key);
      if (found !== undefined && found !== null && String(found).trim() !== '') return found;
    }

    return undefined;
  }

  private collectIdentityText(value: unknown): unknown[] {
    if (!value || typeof value !== 'object') return [];
    const identityKey = /(consultor|usuario|user|email|correo|mail|funcional|nombre)/i;
    const result: unknown[] = [];

    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      if (identityKey.test(key) && (typeof child === 'string' || typeof child === 'number')) {
        result.push(child);
      }
      if (child && typeof child === 'object') {
        result.push(...this.collectIdentityText(child));
      }
    });

    return result;
  }

  private normalizeText(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private asSelectOptions(values: readonly string[], emptyLabel: string): UiSelectOption[] {
    return [{ value: '', label: emptyLabel }, ...values.map((value) => ({ value, label: value }))];
  }

  private parseLocalDate(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay() || 7;
    result.setDate(result.getDate() - day + 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end.getTime() - start.getTime()) / msPerDay);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
