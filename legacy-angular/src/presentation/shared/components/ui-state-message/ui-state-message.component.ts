import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

type StateTone = 'info' | 'warning' | 'error' | 'success';

@Component({
  selector: 'app-ui-state-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-state-message.component.html',
})
export class UiStateMessageComponent {
  @Input() title = 'Sin datos';
  @Input() description = '';
  @Input() actionLabel = '';
  @Input() tone: StateTone = 'info';
  @Output() action = new EventEmitter<void>();

  readonly toneClasses: Record<StateTone, string> = {
    info: 'border-blue-200 bg-blue-50/60',
    warning: 'border-amber-200 bg-amber-50/70',
    error: 'border-red-200 bg-red-50/70',
    success: 'border-blue-200 bg-blue-50/70',
  };

  readonly iconClasses: Record<StateTone, string> = {
    info: 'border-blue-100 text-blue-700',
    warning: 'border-amber-100 text-amber-700',
    error: 'border-red-100 text-red-700',
    success: 'border-blue-100 text-blue-700',
  };
}
