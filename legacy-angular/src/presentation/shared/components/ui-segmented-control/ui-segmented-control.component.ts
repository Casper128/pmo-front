import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface UiSegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

let segmentedSequence = 0;

@Component({
  selector: 'app-ui-segmented-control',
  standalone: true,
  templateUrl: './ui-segmented-control.component.html',
})
export class UiSegmentedControlComponent {
  @Input() label = 'Opciones';
  @Input() options: readonly UiSegmentedOption[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  readonly groupId = `ui-segmented-${++segmentedSequence}`;

  select(value: string): void {
    if (value === this.value) return;
    this.valueChange.emit(value);
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = this.options
      .map((option, optionIndex) => ({ option, optionIndex }))
      .filter(({ option }) => !option.disabled);
    if (!enabled.length) return;
    const currentEnabledIndex = enabled.findIndex(({ optionIndex }) => optionIndex === index);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? enabled.length - 1
          : event.key === 'ArrowRight'
            ? (currentEnabledIndex + 1) % enabled.length
            : (currentEnabledIndex - 1 + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    this.select(next.option.value);
    queueMicrotask(() => document.getElementById(this.optionId(next.option.value))?.focus());
  }

  hasSelectedValue(): boolean {
    return this.options.some((option) => option.value === this.value);
  }

  optionId(value: string): string {
    return `${this.groupId}-${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  }
}
