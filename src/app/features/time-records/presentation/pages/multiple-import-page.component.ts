import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeRecord, DayGroup } from '../../domain/models/time-record.model';
import { TimeRecordDomainService } from '../../domain/services/time-record-domain.service';
import { SendAllRecordsUseCase } from '../../application/use-cases/send-all-records.use-case';
import { LoadSelectOptionsUseCase } from '../../application/use-cases/load-select-options.use-case';
import { ImportTextInputComponent } from '../components/import-text-input/import-text-input.component';
import { RecordsPreviewComponent } from '../components/records-preview/records-preview.component';
import { EditRecordModalComponent } from '../components/edit-record-modal/edit-record-modal.component';
import { AuthService } from '../../../../core/auth/auth.service';

const BASE = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';

@Component({
  selector: 'app-multiple-import-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImportTextInputComponent,
    RecordsPreviewComponent,
    EditRecordModalComponent,
  ],
  templateUrl: './multiple-import-page.component.html',
})
export class MultipleImportPageComponent implements OnInit {
  private domain = inject(TimeRecordDomainService);
  private sendAll = inject(SendAllRecordsUseCase);
  private options = inject(LoadSelectOptionsUseCase);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  currentView = signal<'import' | 'report'>('import');
  records = signal<TimeRecord[]>([]);
  groups = signal<DayGroup[]>([]);
  totalGeneral = signal(0);

  sending = signal(false);
  showPreview = signal(false);

  // Alert message
  alert = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit modal
  editingIndex = signal<number | null>(null);
  editingRecord = signal<TimeRecord | null>(null);
  modalVisible = signal(false);

  clientes = signal<string[]>([]);
  proyectos = signal<string[]>([]);
  solicitudes = signal<string[]>([]);
  defaultCliente = signal('');
  defaultProyecto = signal('');
  defaultSolicitud = signal('');
  loadingDemand = signal(false);

  reportCliente = '';
  reportFechaIni = '';
  reportFechaFin = '';
  downloadingReport = signal(false);
  reportResult = signal<{ type: 'success' | 'empty'; title: string; detail: string } | null>(null);

  ngOnInit(): void {
    this.loadDefaultSelection();
  }

  onProcess(rawText: string) {
    const parsed = this.domain.parseText(rawText).map(record => this.applyDefaults(record));
    if (parsed.length === 0) {
      this.showAlert('No se encontraron registros válidos. Verifica el formato.', 'error');
      return;
    }
    this.records.set(parsed);
    this.refreshGroups();
    this.syncReportDatesFromRecords(parsed);
    this.showPreview.set(true);
    this.showAlert(`✓ Se encontraron ${parsed.length} registros`, 'success');
  }

  refreshGroups() {
    const recs = this.records();
    this.groups.set(this.domain.groupByDate(recs));
    this.totalGeneral.set(recs.reduce((s, r) => s + parseFloat(r.horas || '0'), 0));
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
    updated.horas = this.domain.calcHoras(updated.horaIni, updated.horaFin) || '0';
    recs[idx] = updated;
    this.records.set(recs);
    this.refreshGroups();
    this.modalVisible.set(false);
    this.showAlert('✓ Registro actualizado', 'success');
  }

  onUpdateRecord(index: number, updated: TimeRecord) {
    const recs = [...this.records()];
    recs[index] = {
      ...updated,
      fechaEstimada: updated.fechaEstimada || updated.fecha,
      fechaReal: updated.fechaReal || updated.fecha,
    };
    this.records.set(recs);
    this.refreshGroups();
  }

  onDelete(index: number) {
    const recs = this.records().filter((_, i) => i !== index);
    this.records.set(recs);
    if (recs.length === 0) {
      this.showPreview.set(false);
      this.showAlert('No hay registros', 'error');
    } else {
      this.refreshGroups();
    }
  }

  onSendAll() {
    const invalidos = this.records()
      .map((reg, idx) => ({ idx, missing: this.domain.getMissingFields(reg) }))
      .filter(item => item.missing.length > 0);

    if (invalidos.length) {
      const ejemplos = invalidos
        .slice(0, 3)
        .map(item => `#${item.idx + 1} (${item.missing.join(', ')})`)
        .join('; ');
      this.showAlert(
        `Corrige ${invalidos.length} registros incompletos antes de enviar. Ejemplos: ${ejemplos}`,
        'error'
      );
      return;
    }

    this.sending.set(true);
    this.sendAll.execute(this.records()).subscribe({
      next: ({ enviados, errores }) => {
        this.sending.set(false);
        if (errores === 0) {
          this.showAlert(`✓ ${enviados} registros enviados correctamente`, 'success');
          this.records.set([]);
          this.showPreview.set(false);
        } else {
          this.showAlert(`✓ ${enviados} enviados, ${errores} con error`, 'error');
        }
      },
      error: () => {
        this.sending.set(false);
        this.showAlert('Error al enviar registros', 'error');
      },
    });
  }

  onCancelImport() {
    this.records.set([]);
    this.groups.set([]);
    this.totalGeneral.set(0);
    this.showPreview.set(false);
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
    this.options.proyectos(cliente).subscribe(proyectos => {
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

  onReportFechaIniChange(value: string) {
    this.reportFechaIni = value;
    if (!this.reportFechaFin) this.reportFechaFin = value;
  }

  onReportFechaFinChange(value: string) {
    this.reportFechaFin = value;
    if (!this.reportFechaIni) this.reportFechaIni = value;
  }

  downloadReport() {
    this.alert.set(null);
    this.reportResult.set(null);
    if (!this.reportFechaIni || !this.reportFechaFin) {
      this.showAlert('Selecciona fecha inicio y fecha fin', 'error');
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
      cliente: this.reportCliente ? (Number.isNaN(numericCliente) ? this.reportCliente : numericCliente) : null,
      idConsultor: null,
      proyecto: null,
      solicitud: null,
    };

    this.downloadingReport.set(true);
    this.http
      .post<any>(`${BASE}/tiemposConsultores/filtroDownload`, body, {
        headers: { Authorization: `Bearer ${this.auth.token}` },
      })
      .subscribe({
        next: data => {
          this.downloadingReport.set(false);
          if (data?.excel) {
            this.saveExcel(data.excel, `reporte_tiempos_${this.reportFechaIni}_${this.reportFechaFin}.xlsx`);
            this.reportResult.set({
              type: 'success',
              title: 'Reporte descargado',
              detail: `reporte_tiempos_${this.reportFechaIni}_${this.reportFechaFin}.xlsx`,
            });
            this.showAlert('✓ Reporte descargado correctamente', 'success');
            return;
          }
          this.reportResult.set({
            type: 'empty',
            title: 'Sin datos',
            detail: data?.mensaje || 'No hay registros para los filtros seleccionados.',
          });
        },
        error: error => {
          this.downloadingReport.set(false);
          this.showAlert(`Error al descargar el reporte: ${error?.message || 'intenta nuevamente'}`, 'error');
        },
      });
  }

  clearReport() {
    this.reportCliente = '';
    this.reportFechaIni = '';
    this.reportFechaFin = '';
    this.reportResult.set(null);
    this.alert.set(null);
  }

  showAlert(text: string, type: 'success' | 'error') {
    this.alert.set({ text, type });
    if (type !== 'error') setTimeout(() => this.alert.set(null), 5000);
  }

  private loadDefaultSelection() {
    this.options.clientes().subscribe(clientes => {
      this.clientes.set(clientes);
      const cliente = clientes[0] ?? '';
      if (!cliente) return;
      this.onDefaultClienteChange(cliente);
    });
  }

  private applyDefaults(record: TimeRecord): TimeRecord {
    return {
      ...record,
      cliente: record.cliente || this.defaultCliente(),
      proyecto: record.proyecto || this.defaultProyecto(),
      solicitud: record.solicitud || this.defaultSolicitud(),
      fechaEstimada: record.fechaEstimada || record.fecha,
      fechaReal: record.fechaReal || record.fecha,
    };
  }

  private loadSolicitudes(cliente: string, proyecto: string) {
    if (!cliente) {
      this.solicitudes.set([]);
      this.loadingDemand.set(false);
      return;
    }

    this.options.solicitudes(cliente, proyecto).subscribe(solicitudes => {
      this.solicitudes.set(solicitudes);
      this.defaultSolicitud.set(solicitudes[0] ?? '');
      this.loadingDemand.set(false);
    });
  }

  private syncReportDatesFromRecords(records: TimeRecord[]) {
    const fechas = records.map(record => record.fecha).filter(Boolean).sort();
    if (!fechas.length) return;
    this.reportFechaIni = fechas[0];
    this.reportFechaFin = fechas[fechas.length - 1];
  }

  private saveExcel(base64: string, filename: string) {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
