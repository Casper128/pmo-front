import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/auth/auth.service';
import { StatisticsChartComponent } from '../components/statistics-chart/statistics-chart.component';

const BASE = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';

interface ConsultantRecord {
  idConsultor?: string | number;
  idUsuario?: string | number;
  consultor?: string;
  nombreConsultor?: string;
  usuario?: string;
  email?: string;
  correo?: string;
  cliente?: string;
  identificador?: string;
  prefijo?: string;
  tipoHora?: string;
  tipoActividad?: string;
  causa?: string;
  descripcionActividad?: string;
  observacion?: string;
  fechaInicio?: string;
  categoria?: string;
  modulo?: string;
  tecnologia?: string;
  proyecto?: string;
  gestionDemanda?: string;
  lenguaje?: string;
  equipo?: string;
  modoActuacion?: string;
  complejidad?: string;
  impacto?: string;
  funcional?: string;
  tiempoRealHoras?: string | number;
  solicitud?: string;
  solicitud_tiemposConsultores?: {
    nombreGestion?: string;
    tipoSolicitud?: string;
    prioridad?: string;
    solicitud_cliente?: { nombre?: string };
  };
  usuario_tiemposConsultores?: {
    id?: string | number;
    nombre?: string;
    email?: string;
    correo?: string;
    usuario?: string;
  };
  [key: string]: unknown;
}

interface BreakdownItem {
  label: string;
  hours: number;
  count: number;
  percentage: number;
  share: number;
}

@Component({
  selector: 'app-consultant-statistics-page',
  standalone: true,
  imports: [CommonModule, FormsModule, StatisticsChartComponent],
  templateUrl: './consultant-statistics-page.component.html',
})
export class ConsultantStatisticsPageComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  records = signal<ConsultantRecord[]>([]);
  loading = signal(false);
  loaded = signal(false);
  error = signal('');
  dateFrom = signal('');
  dateTo = signal('');
  client = signal('');
  module = signal('');
  activity = signal('');
  prefix = signal('');
  search = signal('');

  dateError = computed(() =>
    this.dateFrom() && this.dateTo() && this.dateFrom() > this.dateTo()
      ? 'La fecha inicial no puede ser posterior a la fecha final.'
      : ''
  );

  ownRecords = computed(() => this.records().filter(record => this.isCurrentUserRecord(record)));
  clients = computed(() => this.unique(this.ownRecords().map(record => this.clientName(record))));
  modules = computed(() => this.unique(this.ownRecords().map(record => this.moduleName(record))));
  activities = computed(() => this.unique(this.ownRecords().map(record => record.tipoActividad || 'Sin actividad')));

  filteredRecords = computed(() => {
    if (this.dateError()) return [];
    const term = this.normalize(this.search());
    return this.ownRecords()
      .filter(record => {
        const date = this.recordDate(record);
        if (this.dateFrom() && date < this.dateFrom()) return false;
        if (this.dateTo() && date > this.dateTo()) return false;
        if (this.client() && this.clientName(record) !== this.client()) return false;
        if (this.module() && this.moduleName(record) !== this.module()) return false;
        if (this.activity() && (record.tipoActividad || 'Sin actividad') !== this.activity()) return false;
        if (this.prefix() && this.prefixCode(record) !== this.prefix()) return false;
        if (!term) return true;
        return [record.identificador, record.prefijo, this.prefixLabel(record), record.descripcionActividad, record.observacion, record.solicitud,
          record.tecnologia, record.tipoActividad, record.tipoHora, record.categoria, record.causa,
          record.complejidad, record.impacto, this.clientName(record), this.moduleName(record), this.managementName(record)]
          .some(value => this.normalize(value).includes(term));
      })
      .sort((a, b) => this.recordDate(b).localeCompare(this.recordDate(a)));
  });

  totalHours = computed(() => this.filteredRecords().reduce((total, record) => total + this.hours(record), 0));
  uniqueClients = computed(() => new Set(this.filteredRecords().map(record => this.clientName(record))).size);
  activeDays = computed(() => new Set(this.filteredRecords().map(record => this.recordDate(record)).filter(Boolean)).size);
  averageDailyHours = computed(() => this.activeDays() ? this.totalHours() / this.activeDays() : 0);
  laborPercentage = computed(() => {
    const total = this.totalHours();
    if (!total) return 0;
    const labor = this.filteredRecords()
      .filter(record => this.normalize(record.tipoHora) === 'laboral')
      .reduce((sum, record) => sum + this.hours(record), 0);
    return Math.round((labor / total) * 100);
  });

  clientBreakdown = computed(() => this.breakdownBy(record => this.clientName(record)));
  moduleBreakdown = computed(() => this.breakdownBy(record => this.moduleName(record)));
  activityBreakdown = computed(() => this.breakdownBy(record => this.cleanDimension(record.tipoActividad, 'Sin actividad')));
  activityTable = computed(() => this.breakdownBy(record => this.cleanDimension(record.tipoActividad, 'Sin actividad'), 12));
  functionalBreakdown = computed(() => this.breakdownBy(record => this.cleanDimension(record.funcional, 'Sin funcional')));
  functionalTable = computed(() => this.breakdownBy(record => this.cleanDimension(record.funcional, 'Sin funcional'), 12));
  prefixBreakdown = computed(() => this.breakdownBy(record => this.prefixLabel(record), 8));
  prefixTable = computed(() => this.breakdownBy(record => this.prefixLabel(record), 12));
  complexityBreakdown = computed(() => this.breakdownBy(record => this.cleanDimension(record.complejidad, 'Sin complejidad'), 8));
  weekdayBreakdown = computed(() => {
    const order = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    return this.breakdownBy(record => this.weekdayName(record), 7)
      .sort((a, b) => {
        const aIndex = order.indexOf(a.label.toLowerCase());
        const bIndex = order.indexOf(b.label.toLowerCase());
        return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
      });
  });
  managementBreakdown = computed(() => this.breakdownBy(record => this.managementName(record)));
  hourTypeBreakdown = computed(() => this.breakdownBy(record => this.cleanDimension(record.tipoHora, 'Sin tipo de hora')));
  technologyBreakdown = computed(() => this.breakdownBy(record => this.cleanDimension(record.tecnologia, 'Sin tecnología')));
  categoryBreakdown = computed(() => this.breakdownBy(record => this.cleanDimension(record.categoria, 'Sin categoría')));
  causeBreakdown = computed(() => this.breakdownBy(record => this.cleanDimension(record.causa, 'Sin causa')));
  moduleCount = computed(() => new Set(this.filteredRecords().map(record => this.moduleName(record))).size);
  technologyCount = computed(() => new Set(this.filteredRecords().map(record => record.tecnologia).filter(Boolean)).size);
  requestCount = computed(() => new Set(this.filteredRecords().map(record => record.solicitud || record.identificador).filter(Boolean)).size);
  averageRecordHours = computed(() => this.filteredRecords().length ? this.totalHours() / this.filteredRecords().length : 0);
  nonLaborHours = computed(() => this.filteredRecords()
    .filter(record => this.normalize(record.tipoHora) !== 'laboral')
    .reduce((sum, record) => sum + this.hours(record), 0));
  mainModule = computed(() => this.moduleBreakdown()[0]?.label || 'Sin datos');
  mainActivity = computed(() => this.activityBreakdown()[0]?.label || 'Sin datos');
  mainTechnology = computed(() => this.technologyBreakdown()[0]?.label || 'Sin datos');
  mainFunctional = computed(() => this.functionalBreakdown()[0]?.label || 'Sin datos');
  highestEffortRecords = computed(() => [...this.filteredRecords()].sort((a, b) => this.hours(b) - this.hours(a)).slice(0, 5));
  dominantPrefix = computed(() => this.prefixBreakdown()[0]?.label || 'Sin datos');
  dominantPrefixShare = computed(() => this.prefixBreakdown()[0]?.share || 0);
  incidentHours = computed(() => this.prefixHours('IN'));
  incidentShare = computed(() => this.totalHours() ? this.incidentHours() / this.totalHours() * 100 : 0);
  projectHours = computed(() => this.prefixHours('PRY'));
  demandHours = computed(() => this.prefixHours('CH') + this.prefixHours('SR'));
  classifiedPercentage = computed(() => {
    const total = this.filteredRecords().length;
    if (!total) return 0;
    const classified = this.filteredRecords().filter(record => this.prefixCode(record) !== 'OTRO').length;
    return classified / total * 100;
  });
  functionalConcentration = computed(() => this.functionalBreakdown()[0]?.share || 0);
  unassignedFunctionalHours = computed(() => this.filteredRecords()
    .filter(record => this.cleanDimension(record.funcional, 'Sin funcional') === 'Sin funcional')
    .reduce((sum, record) => sum + this.hours(record), 0));
  unassignedFunctionalShare = computed(() => this.totalHours() ? this.unassignedFunctionalHours() / this.totalHours() * 100 : 0);
  homogeneousDimensionCount = computed(() => [this.activityBreakdown(), this.categoryBreakdown(),
    this.causeBreakdown(), this.complexityBreakdown(), this.prefixBreakdown()].filter(items => items.length <= 1).length);
  dailyChart = computed(() => {
    const totals = new Map<string, { hours: number; count: number }>();
    this.filteredRecords().forEach(record => {
      const date = this.recordDate(record);
      if (!date) return;
      const current = totals.get(date) || { hours: 0, count: 0 };
      totals.set(date, { hours: current.hours + this.hours(record), count: current.count + 1 });
    });
    const availableDates = [...totals.keys()].sort();
    const startValue = this.dateFrom() || availableDates[0];
    const endValue = this.dateTo() || availableDates.at(-1);
    if (!startValue || !endValue) return [];
    const start = this.parseDate(startValue);
    const end = this.parseDate(endValue);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

    if (days <= 14) {
      return Array.from({ length: Math.max(0, days) }, (_, index) => {
        const current = new Date(start);
        current.setDate(current.getDate() + index);
        const date = this.toInputDate(current);
        const value = totals.get(date) || { hours: 0, count: 0 };
        return { date, label: this.formatDate(date, true), shortLabel: this.formatDate(date, false), ...value };
      });
    }

    const weeks: { date: string; label: string; shortLabel: string; hours: number; count: number }[] = [];
    let cursor = new Date(start);
    while (cursor <= end) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());
      const from = this.toInputDate(weekStart);
      const to = this.toInputDate(weekEnd);
      const values = [...totals.entries()].filter(([date]) => date >= from && date <= to);
      weeks.push({
        date: from,
        label: `${this.formatDate(from, true)} - ${this.formatDate(to, true)}`,
        shortLabel: `${this.formatDate(from, false)} - ${this.formatDate(to, false)}`,
        hours: values.reduce((sum, [, value]) => sum + value.hours, 0),
        count: values.reduce((sum, [, value]) => sum + value.count, 0),
      });
      cursor = new Date(weekEnd);
      cursor.setDate(cursor.getDate() + 1);
    }
    return weeks;
  });
  dailyTrend = computed(() => this.dailyChart().map(day => ({ label: day.shortLabel, hours: day.hours, count: day.count })));

  ngOnInit(): void { this.loadRecords(); }

  loadRecords(): void {
    this.loading.set(true);
    this.error.set('');
    const userId = this.auth.user()?.id;
    const numericId = Number(userId);
    const body = { idConsultor: userId && !Number.isNaN(numericId) ? numericId : userId || null };
    this.http.post<any>(`${BASE}/tiemposConsultores/gestion`, body, {
      headers: { Authorization: `Bearer ${this.auth.token}` },
    }).subscribe({
      next: response => {
        const rows = this.extractRows(response);
        this.records.set(rows);
        if (!this.loaded()) this.setDefaultPeriod(rows.filter(record => this.isCurrentUserRecord(record)));
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        if (error?.status === 401 || error?.status === 403) {
          this.auth.clearTokens();
          return;
        }
        this.error.set(error?.error?.message || error?.message || 'No fue posible consultar los registros del consultor.');
      },
    });
  }

  setPeriod(days: number): void {
    const latest = this.latestRecordDate() || this.toInputDate(new Date());
    const start = this.parseDate(latest);
    start.setDate(start.getDate() - (days - 1));
    this.dateFrom.set(this.toInputDate(start));
    this.dateTo.set(latest);
  }

  setCurrentMonth(): void {
    const latest = this.parseDate(this.latestRecordDate() || this.toInputDate(new Date()));
    this.dateFrom.set(this.toInputDate(new Date(latest.getFullYear(), latest.getMonth(), 1)));
    this.dateTo.set(this.toInputDate(new Date(latest.getFullYear(), latest.getMonth() + 1, 0)));
  }

  setLastMonths(months: number): void {
    const latestValue = this.latestRecordDate() || this.toInputDate(new Date());
    const end = this.parseDate(latestValue);
    const start = new Date(end);
    start.setMonth(start.getMonth() - months);
    start.setDate(start.getDate() + 1);
    this.dateFrom.set(this.toInputDate(start));
    this.dateTo.set(latestValue);
  }

  clearFilters(): void {
    this.client.set('');
    this.module.set('');
    this.activity.set('');
    this.prefix.set('');
    this.search.set('');
    this.setDefaultPeriod(this.ownRecords());
  }

  hours(record: ConsultantRecord): number {
    const value = Number(record.tiempoRealHoras || 0);
    return Number.isFinite(value) ? value : 0;
  }

  clientName(record: ConsultantRecord): string {
    return this.cleanDimension(record.solicitud_tiemposConsultores?.solicitud_cliente?.nombre || record.cliente, 'Sin cliente');
  }

  moduleName(record: ConsultantRecord): string {
    return this.cleanDimension(record.modulo || record.tecnologia, 'Sin módulo');
  }

  managementName(record: ConsultantRecord): string {
    return this.cleanDimension(record.solicitud_tiemposConsultores?.nombreGestion || record.gestionDemanda || record.solicitud, 'Sin gestión');
  }

  downloadBreakdownTablePng(title: string, firstHeader: string, rows: BreakdownItem[]): void {
    const scale = 3;
    const width = 1600;
    const rowHeight = 72;
    const headerHeight = 178;
    const footerHeight = 56;
    const visibleRows = rows.slice(0, 20);
    const height = headerHeight + 54 + visibleRows.length * rowHeight + footerHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#0f172a';
    context.font = '700 34px sans-serif';
    context.fillText(title, 48, 58);
    context.fillStyle = '#475569';
    context.font = '500 18px sans-serif';
    context.fillText(`Periodo: ${this.dateFrom() || 'inicio'} a ${this.dateTo() || 'fin'} · Cliente: ${this.client() || 'Todos'} · Módulo: ${this.module() || 'Todos'} · Prefijo: ${this.prefix() || 'Todos'}`, 48, 98, width - 96);
    context.fillStyle = '#64748b';
    context.font = '500 16px sans-serif';
    context.fillText(`${this.filteredRecords().length} registros · ${this.formatHours(this.totalHours())} horas incluidas`, 48, 132);

    const columns = [48, 748, 960, 1162, 1390];
    const headers = [firstHeader, 'Horas', 'Registros', 'Participación', 'Promedio'];
    context.fillStyle = '#eff6ff';
    context.fillRect(32, headerHeight, width - 64, 54);
    context.fillStyle = '#1e3a8a';
    context.font = '700 17px sans-serif';
    headers.forEach((header, index) => context.fillText(header, columns[index], headerHeight + 34));

    visibleRows.forEach((item, index) => {
      const y = headerHeight + 54 + index * rowHeight;
      context.fillStyle = index % 2 ? '#f8fafc' : '#ffffff';
      context.fillRect(32, y, width - 64, rowHeight);
      context.strokeStyle = '#e2e8f0';
      context.beginPath();
      context.moveTo(32, y + rowHeight);
      context.lineTo(width - 32, y + rowHeight);
      context.stroke();
      context.fillStyle = '#1e293b';
      context.font = '700 17px sans-serif';
      this.drawWrappedText(context, item.label, columns[0], y + 24, 620, 22, 2);
      context.font = '700 17px sans-serif';
      context.fillStyle = '#1d4ed8';
      context.fillText(`${this.formatHours(item.hours)} h`, columns[1], y + 40);
      context.fillStyle = '#475569';
      context.fillText(String(item.count), columns[2], y + 40);
      context.fillStyle = '#7c3aed';
      context.fillText(`${this.formatHours(item.share)}%`, columns[3], y + 40);
      context.fillStyle = '#047857';
      context.fillText(`${this.formatHours(item.hours / item.count)} h`, columns[4], y + 40);
    });

    context.fillStyle = '#64748b';
    context.font = '500 14px sans-serif';
    context.fillText('Fuente: Reportes de tiempos PMO · Imagen generada en alta resolución', 48, height - 22);
    const link = document.createElement('a');
    link.download = `${title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  prefixCode(record: ConsultantRecord): 'CH' | 'SR' | 'IN' | 'PRY' | 'OTRO' {
    const source = `${record.prefijo || ''} ${record.identificador || ''} ${record.solicitud || ''}`.toUpperCase().trim();
    const match = source.match(/(?:^|[\s\-_])(PRY|CH|SR|IN)(?=[\s\-_\d]|$)/);
    return (match?.[1] as 'CH' | 'SR' | 'IN' | 'PRY') || 'OTRO';
  }

  prefixLabel(record: ConsultantRecord): string {
    const labels = {
      CH: 'CH · Necesidad',
      SR: 'SR · Solicitud de servicio',
      IN: 'IN · Incidente',
      PRY: 'PRY · Proyecto',
      OTRO: 'Sin clasificación',
    };
    return labels[this.prefixCode(record)];
  }

  weekdayName(record: ConsultantRecord): string {
    const date = this.recordDate(record);
    if (!date) return 'Sin fecha';
    const label = new Intl.DateTimeFormat('es-CO', { weekday: 'long' }).format(this.parseDate(date));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  formatHours(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
  }

  formatRecordDate(record: ConsultantRecord): string {
    const date = this.recordDate(record);
    return date ? this.formatDate(date, true) : 'Sin fecha';
  }

  private breakdownBy(getLabel: (record: ConsultantRecord) => string, limit = 6): BreakdownItem[] {
    const groups = new Map<string, { hours: number; count: number }>();
    this.filteredRecords().forEach(record => {
      const label = getLabel(record);
      const current = groups.get(label) || { hours: 0, count: 0 };
      groups.set(label, { hours: current.hours + this.hours(record), count: current.count + 1 });
    });
    const maximum = Math.max(...[...groups.values()].map(item => item.hours), 0);
    const total = [...groups.values()].reduce((sum, item) => sum + item.hours, 0);
    return [...groups.entries()]
      .map(([label, value]) => ({
        ...value,
        label,
        percentage: maximum ? (value.hours / maximum) * 100 : 0,
        share: total ? (value.hours / total) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours).slice(0, limit);
  }

  private prefixHours(code: 'CH' | 'SR' | 'IN' | 'PRY'): number {
    return this.filteredRecords()
      .filter(record => this.prefixCode(record) === code)
      .reduce((sum, record) => sum + this.hours(record), 0);
  }

  private extractRows(response: any): ConsultantRecord[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data?.rows)) return response.data.rows;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.rows)) return response.rows;
    return [];
  }

  private setDefaultPeriod(rows: ConsultantRecord[]): void {
    const dates = rows.map(record => this.recordDate(record)).filter(Boolean).sort();
    if (!dates.length) { this.setPeriod(30); return; }
    const latest = dates.at(-1)!;
    const monday = this.parseDate(latest);
    const daysFromMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    this.dateFrom.set(this.toInputDate(monday));
    this.dateTo.set(this.toInputDate(sunday));
  }

  private latestRecordDate(): string {
    return this.ownRecords().map(record => this.recordDate(record)).filter(Boolean).sort().at(-1) || '';
  }

  private recordDate(record: ConsultantRecord): string {
    return String(record.fechaInicio || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
  }

  private isCurrentUserRecord(record: ConsultantRecord): boolean {
    const user = this.auth.user();
    if (!user) return false;
    const userIds = [user.id, this.valueFromRawUser('id'), this.valueFromRawUser('idUsuario'), this.valueFromRawUser('userId')]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => String(value).trim());
    const recordIds = [record.idConsultor, record.idUsuario, record.usuario_tiemposConsultores?.id,
      this.valueFromObject(record, 'idConsultor'), this.valueFromObject(record, 'idUsuario'), this.valueFromObject(record, 'userId')]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => String(value).trim());
    if (recordIds.length && userIds.some(id => recordIds.includes(id))) return true;

    const userNames = [user.email, user.username, user.name, this.valueFromRawUser('correo'),
      this.valueFromRawUser('mail'), this.valueFromRawUser('usuario'), this.valueFromRawUser('nombre'),
      this.valueFromRawUser('nombreCompleto')]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => this.normalize(value));
    const recordNames = [record.email, record.correo, record.usuario, record.consultor, record.nombreConsultor,
      record.funcional, record.usuario_tiemposConsultores?.email, record.usuario_tiemposConsultores?.correo,
      record.usuario_tiemposConsultores?.usuario, record.usuario_tiemposConsultores?.nombre,
      ...this.collectIdentityText(record)]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => this.normalize(value));
    if (!recordIds.length && !recordNames.length) return true;
    return userNames.some(name => recordNames.some(candidate => candidate === name || candidate.includes(name) || name.includes(candidate)));
  }

  private valueFromRawUser(key: string): unknown {
    const raw = this.auth.user()?.raw;
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
  }

  private valueFromObject(value: unknown, key: string): unknown {
    if (!value || typeof value !== 'object') return undefined;
    const object = value as Record<string, unknown>;
    if (key in object) return object[key];
    for (const child of Object.values(object)) {
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
      if (identityKey.test(key) && (typeof child === 'string' || typeof child === 'number')) result.push(child);
      if (child && typeof child === 'object') result.push(...this.collectIdentityText(child));
    });
    return result;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  private normalize(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private cleanDimension(value: unknown, fallback: string): string {
    const text = String(value || '')
      .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || ['n/a', 'na', 'null', 'undefined', 'sin dato'].includes(this.normalize(text))) return fallback;
    return text.toLocaleLowerCase('es-CO').replace(/(^|\s)\p{L}/gu, letter => letter.toLocaleUpperCase('es-CO'));
  }

  private drawWrappedText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number
  ): void {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    words.forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) line = candidate;
      else { if (line) lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((value, index) => {
      const hasMore = index === maxLines - 1 && lines.length > maxLines;
      context.fillText(hasMore ? `${value}…` : value, x, y + index * lineHeight, maxWidth);
    });
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toInputDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private formatDate(value: string, full: boolean): string {
    return new Intl.DateTimeFormat('es-CO', full
      ? { day: '2-digit', month: 'short', year: 'numeric' }
      : { day: '2-digit', month: 'short' }).format(this.parseDate(value));
  }
}
