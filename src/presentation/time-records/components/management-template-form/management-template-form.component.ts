import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdvancedFieldKey } from '@domain/configuration/app-parameters.model';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import {
  ADVANCED_TEMPLATE_FIELDS,
  AdvancedTemplateFieldKey,
  ManagementAdvancedTemplate,
  isMissingAdvancedTemplateValue,
} from '@domain/time-records/models/management-template.model';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiDateInputComponent } from '@presentation/shared/components/ui-date-input/ui-date-input.component';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';

@Component({
  selector: 'app-management-template-form',
  standalone: true,
  imports: [CommonModule, FormsModule, UiSelectComponent, UiDateInputComponent, UiFieldComponent],
  templateUrl: './management-template-form.component.html',
})
export class ManagementTemplateFormComponent {
  @Input() template: ManagementAdvancedTemplate | null = null;
  @Input() readonly = false;
  @Output() templateChange = new EventEmitter<ManagementAdvancedTemplate>();

  private parameters = inject(AppParametersFacade);
  readonly templateFields = ADVANCED_TEMPLATE_FIELDS;
  readonly visibleTemplateFields = this.templateFields.filter((field) => field.key !== 'unity');

  get requiredFields() {
    return this.templateFields.filter((field) => field.required);
  }

  get optionalFields() {
    return this.templateFields.filter((field) => !field.required);
  }

  get requiredCompleted(): number {
    return this.requiredFields.filter((field) => !this.isRequiredMissing(field.key)).length;
  }

  get requiredTotal(): number {
    return this.requiredFields.length;
  }

  templateValue(key: AdvancedTemplateFieldKey): string {
    return this.template?.values[key] || '';
  }

  onTemplateValueChange(key: AdvancedTemplateFieldKey, value: string): void {
    if (!this.template || this.readonly) return;
    const values = { ...this.template.values, [key]: value };
    this.templateChange.emit({
      ...this.template,
      values,
    });
  }

  templateOptions(key: AdvancedTemplateFieldKey): UiSelectOption[] {
    if (!this.isAdvancedParameterKey(key)) return [];
    const options = this.parameters.optionsFor(key).map((option) => ({
      value: option.value,
      label: option.label,
      disabled: !option.active,
    }));
    return this.isRequiredField(key) ? options : [{ value: '', label: 'Sin valor' }, ...options];
  }

  private isAdvancedParameterKey(key: AdvancedTemplateFieldKey): key is AdvancedFieldKey {
    return [
      'tipoActividad',
      'causa',
      'complejidad',
      'impacto',
      'equipo',
      'modoActuacion',
      'lenguaje',
      'prefijo',
      'objetoRicef',
      'categoria',
    ].includes(key);
  }

  private isRequiredField(key: AdvancedTemplateFieldKey): boolean {
    return this.templateFields.some((field) => field.key === key && field.required);
  }

  isRequiredMissing(key: AdvancedTemplateFieldKey): boolean {
    return this.isRequiredField(key) && isMissingAdvancedTemplateValue(this.templateValue(key));
  }
}
