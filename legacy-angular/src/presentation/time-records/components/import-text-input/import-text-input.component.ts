import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';

interface StoredTextDraft {
  rawText: string;
}

@Component({
  selector: 'app-import-text-input',
  standalone: true,
  imports: [CommonModule, FormsModule, UiFieldComponent],
  templateUrl: './import-text-input.component.html',
})
export class ImportTextInputComponent implements OnInit {
  @Input() existingRecords: TimeRecord[] = [];
  @Output() recordsChange = new EventEmitter<TimeRecord[]>();

  private readonly domain = inject(TimeRecordDomainService);
  private readonly storageKey = 'pmo_text_time_draft';

  rawText = '';
  draftMessage = '';
  parseErrors: string[] = [];

  ngOnInit(): void {
    this.restoreDraft();
  }

  processText(): void {
    this.parseErrors = this.domain.validateImportText(this.rawText);
    this.draftMessage = '';
    if (this.parseErrors.length) {
      this.persistDraft();
      return;
    }

    const parsed = this.domain.parseText(this.rawText);
    if (!parsed.length) {
      this.parseErrors = ['No se encontraron registros validos para agregar a la vista previa.'];
      this.persistDraft();
      return;
    }

    this.recordsChange.emit([...this.existingRecords, ...parsed]);
    this.rawText = '';
    this.parseErrors = [];
    this.draftMessage = 'Borrador agregado a la vista previa.';
    this.persistDraft();
  }

  onRawTextChange(): void {
    this.parseErrors = [];
    this.draftMessage = '';
    this.persistDraft();
  }

  clear(): void {
    this.rawText = '';
    this.parseErrors = [];
    this.draftMessage = '';
    this.persistDraft();
  }

  private restoreDraft(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<StoredTextDraft>;
      this.rawText = parsed.rawText || '';
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  private persistDraft(): void {
    if (!this.rawText.trim()) {
      localStorage.removeItem(this.storageKey);
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify({ rawText: this.rawText }));
  }
}
