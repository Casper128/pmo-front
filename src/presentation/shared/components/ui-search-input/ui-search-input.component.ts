import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let searchSequence = 0;

@Component({
  selector: 'app-ui-search-input',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSearchInputComponent),
      multi: true,
    },
  ],
  templateUrl: './ui-search-input.component.html',
})
export class UiSearchInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = 'Buscar...';
  @Input() disabled = false;
  readonly controlId = `ui-search-${++searchSequence}`;
  value = '';
  private onValueChange: (value: string) => void = () => undefined;
  onTouched: () => void = () => undefined;
  writeValue(value: string | null | undefined): void {
    this.value = value ?? '';
  }
  registerOnChange(callback: (value: string) => void): void {
    this.onValueChange = callback;
  }
  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }
  onInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.onValueChange(this.value);
  }
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.value) return;
    event.preventDefault();
    this.clear();
  }
  clear(): void {
    this.value = '';
    this.onValueChange('');
    this.onTouched();
  }
}
