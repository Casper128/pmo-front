import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ManagementReport } from '@domain/time-records/models/management-report.model';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';
import { UiFormSectionComponent } from '@presentation/shared/components/ui-form-section/ui-form-section.component';
import { UiModalComponent } from '@presentation/shared/components/ui-modal/ui-modal.component';
import { ManagementReportDetailPresenter } from '../../presenters/management-report-detail.presenter';

@Component({
  selector: 'app-management-report-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, UiModalComponent, UiFieldComponent, UiFormSectionComponent],
  templateUrl: './management-report-detail-modal.component.html',
})
export class ManagementReportDetailModalComponent {
  @Input() report: ManagementReport | null = null;
  @Output() close = new EventEmitter<void>();
  private readonly presenter = new ManagementReportDetailPresenter();

  title(report: ManagementReport): string {
    return this.presenter.title(report);
  }

  managementName(report: ManagementReport): string {
    return this.presenter.managementName(report);
  }

  clientName(report: ManagementReport): string {
    return this.presenter.clientName(report);
  }

  formatHours(report: ManagementReport): string {
    return this.presenter.formatHours(report);
  }

  reportDate(report: ManagementReport): string {
    return this.presenter.reportDate(report);
  }

  secondarySections(report: ManagementReport) {
    return this.presenter.secondarySections(report);
  }

  backendFields(report: ManagementReport) {
    return this.presenter.backendFields(report);
  }

  primaryBackendFields(report: ManagementReport) {
    return this.presenter.primaryBackendFields(report);
  }

  advancedBackendFields(report: ManagementReport) {
    return this.presenter.advancedBackendFields(report);
  }

  display(value: unknown): string {
    return this.presenter.display(value);
  }
}
