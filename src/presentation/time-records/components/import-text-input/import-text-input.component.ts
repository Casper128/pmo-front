import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';

@Component({
  selector: 'app-import-text-input',
  standalone: true,
  imports: [CommonModule, FormsModule, UiFieldComponent],
  templateUrl: './import-text-input.component.html',
})
export class ImportTextInputComponent {
  @Output() process = new EventEmitter<string>();
  rawText = '';

  onProcess() {
    if (this.rawText.trim()) this.process.emit(this.rawText);
  }

  clear() {
    this.rawText = '';
  }
}
