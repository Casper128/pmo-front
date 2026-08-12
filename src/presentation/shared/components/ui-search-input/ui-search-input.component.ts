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
  template: `
    <label class="block min-w-0" [attr.for]="controlId">
      @if (label) {
        <span class="mb-1.5 block text-xs font-bold text-slate-600">{{ label }}</span>
      }
      <span
        class="group relative flex min-h-12 min-w-0 items-center rounded-xl border border-slate-300 bg-white shadow-sm transition hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100"
      >
        <svg
          class="pointer-events-none absolute left-3.5 size-4 fill-none stroke-slate-400"
          viewBox="0 0 24 24"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" stroke-linecap="round" />
        </svg>
        <input
          class="min-w-0 flex-1 bg-transparent py-2.5 pl-10 pr-10 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
          type="search"
          autocomplete="off"
          [id]="controlId"
          [value]="value"
          [placeholder]="placeholder"
          [disabled]="disabled"
          (input)="onInput($event)"
          (blur)="onTouched()"
        />
        @if (value) {
          <button
            class="absolute right-2 grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            aria-label="Limpiar búsqueda"
            (click)="clear()"
          >
            ×
          </button>
        }
      </span>
    </label>
  `,
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
  clear(): void {
    this.value = '';
    this.onValueChange('');
    this.onTouched();
  }
}
