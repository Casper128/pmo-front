import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdvancedFieldConfiguration,
  AdvancedFieldKey,
  WorkSettings,
} from '@domain/configuration/app-parameters.model';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiPageHeaderComponent } from '@presentation/shared/components/ui-page-header/ui-page-header.component';

@Component({
  selector: 'app-configuration-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiPageHeaderComponent],
  templateUrl: './configuration-page.component.html',
})
export class ConfigurationPageComponent implements OnInit {
  parameters = inject(AppParametersFacade);
  draftFields: AdvancedFieldConfiguration[] = [];
  selectedFieldKey: AdvancedFieldKey = 'tipoActividad';
  draftSettings: WorkSettings = {
    mondayThursdayHours: 9,
    fridayHours: 8,
    maxDailyLaborHours: 10,
    maxHoursPerRecord: 16,
  };
  message = signal<{ type: 'success' | 'error'; text: string } | null>(null);

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
    try {
      await this.parameters.save(this.draftFields, this.draftSettings);
      this.syncDraft();
      this.message.set({
        type: 'success',
        text:
          this.parameters.source() === 'supabase'
            ? 'Tu configuración personal se guardó en Supabase.'
            : 'Configuración guardada localmente. Se sincronizará cuando configures Supabase.',
      });
    } catch (error) {
      this.message.set({
        type: 'error',
        text: error instanceof Error ? error.message : 'No fue posible guardar la configuración.',
      });
    }
  }

  restoreDefaults(): void {
    this.parameters.resetLocal();
    this.syncDraft();
    this.message.set({
      type: 'success',
      text: 'Se restauraron los valores originales. Pulsa “Guardar mi configuración” para conservarlos.',
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
    this.draftSettings = { ...this.parameters.workSettings() };
  }
}
