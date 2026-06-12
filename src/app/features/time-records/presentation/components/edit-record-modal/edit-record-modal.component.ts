import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeRecord } from '../../../domain/models/time-record.model';
import { TimeRecordDomainService } from '../../../domain/services/time-record-domain.service';
import { LoadSelectOptionsUseCase } from '../../../application/use-cases/load-select-options.use-case';

@Component({
  selector: 'app-edit-record-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-record-modal.component.html',
})
export class EditRecordModalComponent implements OnChanges {
  @Input() record: TimeRecord | null = null;
  @Input() visible = false;
  @Output() save = new EventEmitter<TimeRecord>();
  @Output() cancel = new EventEmitter<void>();

  private domain = inject(TimeRecordDomainService);
  private options = inject(LoadSelectOptionsUseCase);

  draft: TimeRecord | null = null;
  horasReal = '';

  clientes: string[] = [];
  proyectos: string[] = [];
  solicitudes: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['record'] && this.record) {
      this.draft = { ...this.record };
      this.fillTestDatesFromRecordDate();
      this.horasReal = this.domain.calcHoras(this.draft.horaIni, this.draft.horaFin);
    }
    if (changes['visible'] && this.visible) {
      this.loadClientes();
    }
  }

  loadClientes() {
    this.options.clientes().subscribe(c => {
      this.clientes = c;
      if (!this.draft) return;
      if (!this.draft.cliente) this.draft.cliente = c[0] ?? '';
      if (this.draft.cliente) this.onClienteChange(this.draft.cliente, false);
    });
  }

  onClienteChange(cliente: string, resetFields = true) {
    if (resetFields && this.draft) {
      this.draft.proyecto = '';
      this.draft.solicitud = '';
    }
    if (!cliente) { this.proyectos = []; this.solicitudes = []; return; }
    this.options.proyectos(cliente).subscribe(p => {
      this.proyectos = p;
      if (this.draft && !this.draft.proyecto) this.draft.proyecto = p[0] ?? '';
      this.options
        .solicitudes(cliente, this.draft?.proyecto ?? '')
        .subscribe(s => {
          this.solicitudes = s;
          if (this.draft && !this.draft.solicitud) this.draft.solicitud = s[0] ?? '';
        });
    });
  }

  onProyectoChange(proyecto: string) {
    if (!this.draft?.cliente) return;
    this.draft.solicitud = '';
    this.options.solicitudes(this.draft.cliente, proyecto).subscribe(s => {
      this.solicitudes = s;
      if (this.draft) this.draft.solicitud = s[0] ?? '';
    });
  }

  calcHoras() {
    if (this.draft) {
      this.horasReal = this.domain.calcHoras(this.draft.horaIni, this.draft.horaFin);
      this.draft.horas = this.horasReal || '0';
    }
  }

  onFechaChange() {
    this.fillTestDatesFromRecordDate();
  }

  onSave() {
    if (this.draft) this.save.emit({ ...this.draft });
  }

  private fillTestDatesFromRecordDate() {
    if (!this.draft?.fecha) return;
    if (!this.draft.fechaEstimada) this.draft.fechaEstimada = this.draft.fecha;
    if (!this.draft.fechaReal) this.draft.fechaReal = this.draft.fecha;
  }

  // ── Select options ──────────────────────────────────────────────
  tiposActividad = [
    'ActividadDesarrollo', 'Control De Cambio', 'Debug',
    'Analisis Funcional', 'Soporte', 'Reunion', 'Estimacion', 'Despliegue',
  ];
  causas = [
    'Garantia', 'Data Maestra', 'Configuración', 'Escenario No Probado',
    'Escenario No Contemplado', 'Nueva Funcionalidad', 'Administrativo', 'Reunion',
  ];
  complejidades = ['Alta', 'Media', 'Baja'];
  impactos = ['Alta', 'Media', 'Baja'];
  equipos = ['Financiero', 'Comercial', 'Logístico', 'PlaneacionDemanda', 'Analitica', 'Portales', 'Infraestructura'];
  modos = ['Basado-Datos-Integraciones', 'Basado-Datos-Automatizacion', 'Basado-Datos-Analitica', 'OXDE', 'Transaccional'];
  lenguajes = ['JavaScript', 'Java', 'PHP', 'PullOvers', 'ABAP', 'NODEjs', 'PO', 'OData', 'DataService', 'Strling', 'Python', 'UiPath', 'Agility'];
  tiposHora = ['Laboral', 'Fabrica'];
  prefijos = ['CH', 'SR', 'IN', 'Proyecto'];
  objetosRicef = ['interfases', 'Reportes', 'Conversiones', 'Enhacement', 'Formularios'];
  categorias = ['Everest', 'Operacion', 'Proyecto', 'Coordinacion'];
}
