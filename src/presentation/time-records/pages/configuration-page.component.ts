import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdvancedFieldConfiguration,
  AdvancedFieldKey,
  DeletionSettings,
  WorkSettings,
} from '@domain/configuration/app-parameters.model';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';

@Component({
  selector: 'app-configuration-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiPageHeaderComponent, UiFieldComponent],
  templateUrl: './configuration-page.component.html',
})
export class ConfigurationPageComponent implements OnInit {
  parameters = inject(AppParametersFacade);
  draftFields: AdvancedFieldConfiguration[] = [];
  selectedFieldKey: AdvancedFieldKey = 'tipoActividad';
  draftSettings: WorkSettings = {
    mondayThursdayHours: 9,
    fridayHours: 8,
    dailyHours: {
      0: 0,
      1: 9,
      2: 9,
      3: 9,
      4: 9,
      5: 8,
      6: 0,
    },
    maxDailyLaborHours: 10,
    maxHoursPerRecord: 16,
  };
  draftDeletionSettings: DeletionSettings = {
    auditorEmail: '',
    technicalDeleteEmails: [],
  };
  technicalEmailDraft = '';
  message = signal<{ type: 'success' | 'error'; text: string } | null>(null);
  readonly weekdaySettings = [
    { index: 1, short: 'Lun', label: 'Lunes' },
    { index: 2, short: 'Mar', label: 'Martes' },
    { index: 3, short: 'Mié', label: 'Miércoles' },
    { index: 4, short: 'Jue', label: 'Jueves' },
    { index: 5, short: 'Vie', label: 'Viernes' },
    { index: 6, short: 'Sáb', label: 'Sábado' },
    { index: 0, short: 'Dom', label: 'Domingo' },
  ];

  async ngOnInit(): Promise<void> {
    this.syncDraft();
    try {
      await this.parameters.load();
    } finally {
      this.syncDraft();
    }
  }

  get selectedField(): AdvancedFieldConfiguration | undefined {
    return (
      this.draftFields.find((field) => field.key === this.selectedFieldKey) || this.draftFields[0]
    );
  }

  get fieldSelectorOptions(): UiSelectOption[] {
    return this.draftFields.map((field) => ({
      value: field.key,
      label: `${field.label} · ${field.options.length} opciones`,
    }));
  }

  defaultOptions(field: AdvancedFieldConfiguration): UiSelectOption[] {
    return [
      { value: '', label: 'Sin valor predeterminado' },
      ...field.options
        .filter((item) => item.active && item.value)
        .map((item) => ({ value: item.value, label: item.label || item.value })),
    ];
  }

  onSelectedFieldChange(value: string): void {
    this.selectField(value as AdvancedFieldKey);
  }

  selectField(key: AdvancedFieldKey): void {
    this.selectedFieldKey = key;
    this.message.set(null);
  }

  addOption(field: AdvancedFieldConfiguration): void {
    field.options.push({ value: '', label: '', active: true, sortOrder: field.options.length });
  }

  removeOption(field: AdvancedFieldConfiguration, index: number): void {
    const removed = field.options[index];
    const label = removed?.label || removed?.value || 'esta opción';
    if (
      !window.confirm(`Eliminar ${label}? Este cambio afectará los valores disponibles al guardar.`)
    )
      return;
    field.options.splice(index, 1);
    if (field.defaultValue === removed?.value)
      field.defaultValue = field.options.find((item) => item.active)?.value || '';
  }

  moveOption(field: AdvancedFieldConfiguration, index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= field.options.length) return;
    [field.options[index], field.options[target]] = [field.options[target], field.options[index]];
  }

  async save(): Promise<void> {
    this.message.set(null);
    if (!this.parameters.canManage()) {
      this.message.set({
        type: 'error',
        text: 'Solo el administrador puede modificar la configuración global.',
      });
      return;
    }
    const validationErrors = this.validateWorkSettings();
    if (validationErrors.length) {
      this.message.set({
        type: 'error',
        text: validationErrors.join(' '),
      });
      return;
    }
    try {
      await this.parameters.save(this.draftFields, this.draftSettings, this.draftDeletionSettings);
      this.syncDraft();
      this.message.set({
        type: 'success',
        text:
          this.parameters.source() === 'supabase'
            ? 'Configuración global guardada.'
            : 'Configuración global guardada localmente.',
      });
    } catch (error) {
      this.message.set({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible guardar la configuración.',
      });
    }
  }

  restoreDefaults(): void {
    if (!this.parameters.canManage()) {
      this.message.set({
        type: 'error',
        text: 'Solo el administrador puede restaurar la configuración global.',
      });
      return;
    }
    if (
      !window.confirm(
        'Restaurar los valores originales? Revisa los cambios antes de guardar la configuración global.',
      )
    )
      return;
    this.parameters.resetLocal();
    this.syncDraft();
    this.message.set({
      type: 'success',
      text: 'Se restauraron los valores originales. Pulsa “Guardar configuración global” para conservarlos.',
    });
  }

  trackField(_: number, field: AdvancedFieldConfiguration): string {
    return field.key;
  }

  private syncDraft(): void {
    this.draftFields = this.parameters
      .fields()
      .map((field) => ({ ...field, options: field.options.map((item) => ({ ...item })) }));
    if (!this.draftFields.some((field) => field.key === this.selectedFieldKey)) {
      this.selectedFieldKey = this.draftFields[0]?.key || 'tipoActividad';
    }
    this.draftSettings = {
      ...this.parameters.workSettings(),
      dailyHours: { ...this.parameters.workSettings().dailyHours },
    };
    this.draftDeletionSettings = {
      auditorEmail: this.parameters.deletionSettings().auditorEmail,
      technicalDeleteEmails: [...this.parameters.deletionSettings().technicalDeleteEmails],
    };
    this.technicalEmailDraft = '';
  }

  private validateWorkSettings(): string[] {
    const errors: string[] = [];
    const invalidDays = this.weekdaySettings
      .filter((day) => !this.isValidHourValue(this.draftSettings.dailyHours[day.index], true))
      .map((day) => day.label);
    if (invalidDays.length) {
      errors.push(
        `Revisa las horas esperadas de: ${invalidDays.join(', ')}. Usa valores entre 0 y 24.`,
      );
    }
    if (!this.isValidHourValue(this.draftSettings.maxDailyLaborHours, false)) {
      errors.push('El máximo computable por día debe estar entre 1 y 24 horas.');
    }
    if (!this.isValidHourValue(this.draftSettings.maxHoursPerRecord, false)) {
      errors.push('El máximo por registro debe estar entre 1 y 24 horas.');
    }
    return errors;
  }

  private isValidHourValue(value: unknown, allowZero: boolean): boolean {
    const numericValue = Number(value);
    return (
      Number.isFinite(numericValue) &&
      numericValue <= 24 &&
      (allowZero ? numericValue >= 0 : numericValue > 0)
    );
  }

  addTechnicalEmail(): void {
    const email = this.technicalEmailDraft.trim().toLowerCase();
    if (!email || this.draftDeletionSettings.technicalDeleteEmails.includes(email)) return;
    this.draftDeletionSettings = {
      ...this.draftDeletionSettings,
      technicalDeleteEmails: [...this.draftDeletionSettings.technicalDeleteEmails, email],
    };
    this.technicalEmailDraft = '';
  }

  removeTechnicalEmail(email: string): void {
    this.draftDeletionSettings = {
      ...this.draftDeletionSettings,
      technicalDeleteEmails: this.draftDeletionSettings.technicalDeleteEmails.filter(
        (item) => item !== email,
      ),
    };
  }
}
