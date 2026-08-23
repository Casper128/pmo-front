import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type UiFieldType = 'text' | 'number' | 'textarea' | 'email' | 'password';
type UiFieldTone = 'default' | 'emphasis' | 'muted';
type UiFieldValueType = 'string' | 'number';

let fieldSequence = 0;

@Component({
  selector: 'app-ui-field',
  standalone: true,
  templateUrl: './ui-field.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiFieldComponent),
      multi: true,
    },
  ],
})
export class UiFieldComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() name = '';
  @Input() placeholder = '';
  @Input() type: UiFieldType = 'text';
  @Input() valueType: UiFieldValueType = 'string';
  @Input() readonly = false;
  @Input() disabled = false;
  @Input() required = false;
  @Input() error = '';
  @Input() hint = '';
  @Input() rows = 3;
  @Input() min: number | string | null = null;
  @Input() max: number | string | null = null;
  @Input() step: number | string | null = null;
  @Input() autocomplete = '';
  @Input() tone: UiFieldTone = 'default';
  @Input() monospace = false;

  @Output() valueChange = new EventEmitter<string | number | null>();

  readonly controlId = `ui-field-${++fieldSequence}`;
  readonly descriptionId = `${this.controlId}-description`;
  value = '';

  private onChange: (value: string | number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get isTextarea(): boolean {
    return this.type === 'textarea';
  }

  get showDescription(): boolean {
    return Boolean(this.error || this.hint);
  }

  get displayValue(): string {
    return this.value || 'Sin valor';
  }

  writeValue(value: string | number | null | undefined): void {
    this.value = value === null || value === undefined ? '' : String(value);
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const nextValue = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.value = nextValue;
    const emittedValue = this.valueType === 'number' ? this.toNumberValue(nextValue) : nextValue;
    this.onChange(emittedValue);
    this.valueChange.emit(emittedValue);
  }

  markTouched(): void {
    this.onTouched();
  }

  private toNumberValue(value: string): number | null {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
