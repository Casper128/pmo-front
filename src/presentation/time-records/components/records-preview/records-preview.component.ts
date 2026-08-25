import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DayGroup, TimeRecord } from '@domain/time-records/models/time-record.model';
import { FechaEspPipe } from '../../pipes/fecha-esp.pipe';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';

@Component({
  selector: 'app-records-preview',
  standalone: true,
  imports: [CommonModule, FechaEspPipe, OverflowTooltipDirective],
  templateUrl: './records-preview.component.html',
  styleUrl: './records-preview.component.css',
})
export class RecordsPreviewComponent {
  @Input() groups: DayGroup[] = [];
  @Input() totalGeneral = 0;
  @Input() sending = false;
  @Output() editRecord = new EventEmitter<number>();
  @Output() deleteRecord = new EventEmitter<number>();
  @Output() sendAll = new EventEmitter<void>();
  @Output() cancelImport = new EventEmitter<void>();

  constructor(public domain: TimeRecordDomainService) {}

  get recordCount(): number {
    return this.groups.reduce((total, group) => total + group.records.length, 0);
  }

  get recordsToReview(): number {
    return this.groups.reduce(
      (total, group) =>
        total + group.records.filter((item) => this.getErrors(item.record).length > 0).length,
      0,
    );
  }

  get readyCount(): number {
    return Math.max(0, this.recordCount - this.recordsToReview);
  }

  getMissing(record: TimeRecord): string[] {
    return this.domain.getMissingFields(record);
  }

  getErrors(record: TimeRecord): string[] {
    return [...this.domain.getMissingFields(record), ...this.domain.getInvalidFields(record)];
  }
}
