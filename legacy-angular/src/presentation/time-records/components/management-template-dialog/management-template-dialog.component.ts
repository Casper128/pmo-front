import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { UiModalComponent } from '@presentation/shared/components/ui-modal/ui-modal.component';
import { ManagementTemplateFormComponent } from '../management-template-form/management-template-form.component';

@Component({
  selector: 'app-management-template-dialog',
  standalone: true,
  imports: [UiModalComponent, ManagementTemplateFormComponent],
  templateUrl: './management-template-dialog.component.html',
})
export class ManagementTemplateDialogComponent {
  @Input() template: ManagementAdvancedTemplate | null = null;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() saving = false;
  @Output() templateChange = new EventEmitter<ManagementAdvancedTemplate>();
  @Output() save = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
}
