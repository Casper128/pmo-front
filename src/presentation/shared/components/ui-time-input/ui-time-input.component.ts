import {
  Component,
  ElementRef,
  HostListener,
  Input,
  ViewChild,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let timeSequence = 0;

@Component({
  selector: 'app-ui-time-input',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiTimeInputComponent),
      multi: true,
    },
  ],
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        width: 100%;
      }
    `,
  ],
  template: `
    <div class="block w-full min-w-0">
      @if (label) {
        <label class="mb-1.5 block text-xs font-bold text-slate-600" [attr.for]="controlId">
          {{ label }}
        </label>
      }
      <button
        #trigger
        class="group flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl border bg-white py-2 pl-3.5 pr-2.5 text-left text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        type="button"
        role="combobox"
        aria-haspopup="dialog"
        [id]="controlId"
        [disabled]="isDisabled"
        [attr.aria-expanded]="open"
        [attr.aria-controls]="popoverId"
        [attr.aria-invalid]="error ? true : null"
        [attr.aria-describedby]="descriptionId"
        [class.border-red-400]="error"
        [class.border-blue-500]="open && !error"
        [class.border-slate-300]="!open && !error"
        [class.ring-4]="open"
        [class.ring-blue-100]="open"
        [class.hover:border-blue-400]="!isDisabled"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
        (blur)="onTouched()"
      >
        <span class="min-w-0 flex-1" [class.text-slate-400]="!value" [class.text-slate-800]="value">
          {{ displayValue }}
        </span>
        <span
          class="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700 transition"
          [class.bg-blue-100]="open"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" class="size-4 fill-none stroke-current" stroke-width="2">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>

      @if (open) {
        <section
          #popover
          class="fixed z-[250] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-950/20"
          role="dialog"
          aria-modal="false"
          [id]="popoverId"
          [attr.aria-label]="'Seleccionar ' + (label || 'hora')"
          [style.top.px]="popoverTop"
          [style.left.px]="popoverLeft"
          [style.width.px]="popoverWidth"
        >
          <div class="mb-3 flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2.5">
            <div>
              <p class="text-[10px] font-black uppercase tracking-widest text-blue-500">
                Hora seleccionada
              </p>
              <p class="mt-0.5 text-lg font-black text-blue-950">{{ draftDisplay }}</p>
            </div>
            <button
              class="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-black text-blue-700"
              type="button"
              (click)="selectNow()"
            >
              Ahora
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <p
                class="mb-1.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Hora
              </p>
              <div
                #hourList
                class="max-h-52 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-1"
                role="listbox"
                aria-label="Hora"
              >
                @for (hour of hours; track hour) {
                  <button
                    class="w-full rounded-lg px-2 py-2 text-sm font-black transition"
                    type="button"
                    role="option"
                    [attr.aria-selected]="hour === selectedHour"
                    [attr.aria-pressed]="hour === selectedHour"
                    [class.bg-blue-600]="hour === selectedHour"
                    [class.text-white]="hour === selectedHour"
                    [class.text-slate-600]="hour !== selectedHour"
                    [class.hover:bg-blue-100]="hour !== selectedHour"
                    (click)="selectHour(hour)"
                  >
                    {{ hour }}
                  </button>
                }
              </div>
            </div>
            <div>
              <p
                class="mb-1.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Minutos
              </p>
              <div
                #minuteList
                class="max-h-52 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-1"
                role="listbox"
                aria-label="Minutos"
              >
                @for (minute of minutes; track minute) {
                  <button
                    class="w-full rounded-lg px-2 py-2 text-sm font-black transition"
                    type="button"
                    role="option"
                    [attr.aria-selected]="minute === selectedMinute"
                    [attr.aria-pressed]="minute === selectedMinute"
                    [class.bg-blue-600]="minute === selectedMinute"
                    [class.text-white]="minute === selectedMinute"
                    [class.text-slate-600]="minute !== selectedMinute"
                    [class.hover:bg-blue-100]="minute !== selectedMinute"
                    (click)="selectMinute(minute)"
                  >
                    {{ minute }}
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <button
              class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              type="button"
              (click)="clear()"
            >
              Limpiar
            </button>
            <button
              class="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700"
              type="button"
              (click)="confirm()"
            >
              Listo
            </button>
          </div>
        </section>
      }

      @if (error || hint) {
        <span
          class="mt-1.5 block text-xs font-semibold"
          [id]="descriptionId"
          [class.text-red-600]="error"
          [class.text-slate-400]="!error"
          >{{ error || hint }}</span
        >
      }
    </div>
  `,
})
export class UiTimeInputComponent implements ControlValueAccessor {
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('popover') private popover?: ElementRef<HTMLElement>;
  @ViewChild('hourList') private hourList?: ElementRef<HTMLElement>;
  @ViewChild('minuteList') private minuteList?: ElementRef<HTMLElement>;
  @Input() label = '';
  @Input() placeholder = 'Seleccionar hora';
  @Input() hint = '';
  @Input() error = '';
  @Input() disabled = false;

  readonly controlId = `ui-time-${++timeSequence}`;
  readonly popoverId = `${this.controlId}-popover`;
  readonly descriptionId = `${this.controlId}-description`;
  readonly hours = Array.from({ length: 24 }, (_, index) => `${index}`.padStart(2, '0'));
  readonly minutes = Array.from({ length: 60 }, (_, index) => `${index}`.padStart(2, '0'));
  value = '';
  open = false;
  selectedHour = '08';
  selectedMinute = '00';
  popoverTop = 0;
  popoverLeft = 0;
  popoverWidth = 300;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private formDisabled = false;
  private onValueChange: (value: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  get displayValue(): string {
    return this.value ? this.formatDisplay(this.value) : this.placeholder;
  }

  get draftDisplay(): string {
    return this.formatDisplay(`${this.selectedHour}:${this.selectedMinute}`);
  }

  writeValue(value: string | null | undefined): void {
    this.value = this.normalize(value ?? '');
    this.syncDraft();
  }

  registerOnChange(callback: (value: string) => void): void {
    this.onValueChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled = disabled;
    if (disabled) this.close();
  }

  toggle(): void {
    if (this.isDisabled) return;
    if (this.open) return this.close();
    this.syncDraft(true);
    this.positionPopover(390);
    this.open = true;
    setTimeout(() => {
      this.positionPopover();
      this.scrollSelectionIntoView();
    }, 0);
  }

  selectHour(hour: string): void {
    this.selectedHour = hour;
  }

  selectMinute(minute: string): void {
    this.selectedMinute = minute;
  }

  selectNow(): void {
    const now = new Date();
    this.selectedHour = `${now.getHours()}`.padStart(2, '0');
    this.selectedMinute = `${now.getMinutes()}`.padStart(2, '0');
    setTimeout(() => this.scrollSelectionIntoView(), 0);
  }

  confirm(): void {
    this.commit(`${this.selectedHour}:${this.selectedMinute}`);
  }

  clear(): void {
    this.commit('');
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.open) this.toggle();
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentPointer(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (
      this.open &&
      target &&
      !this.host.nativeElement.contains(target) &&
      !this.popover?.nativeElement.contains(target)
    )
      this.close();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  close(): void {
    this.open = false;
  }

  private commit(value: string): void {
    this.value = value;
    this.onValueChange(value);
    this.onTouched();
    this.close();
    this.trigger?.nativeElement.focus();
  }

  private syncDraft(useNowWhenEmpty = false): void {
    const normalized = this.normalize(this.value);
    if (normalized) {
      [this.selectedHour, this.selectedMinute] = normalized.split(':');
    } else if (useNowWhenEmpty) {
      const now = new Date();
      this.selectedHour = `${now.getHours()}`.padStart(2, '0');
      this.selectedMinute = `${now.getMinutes()}`.padStart(2, '0');
    }
  }

  private normalize(value: string): string {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return '';
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour >= 0 && hour < 24 && minute >= 0 && minute < 60
      ? `${hour}`.padStart(2, '0') + ':' + `${minute}`.padStart(2, '0')
      : '';
  }

  private formatDisplay(value: string): string {
    const normalized = this.normalize(value);
    if (!normalized) return this.placeholder;
    const [hour, minute] = normalized.split(':').map(Number);
    return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(2000, 0, 1, hour, minute),
    );
  }

  private scrollSelectionIntoView(): void {
    this.hourList?.nativeElement
      .querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'center' });
    this.minuteList?.nativeElement
      .querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'center' });
  }

  private positionPopover(estimatedHeight = 390): void {
    const trigger = this.trigger?.nativeElement.getBoundingClientRect();
    const popover = this.popover?.nativeElement;
    if (!trigger) return;
    const margin = 8;
    this.popoverWidth = Math.min(300, window.innerWidth - margin * 2);
    const height = popover?.scrollHeight ?? estimatedHeight;
    const below = trigger.bottom + margin;
    this.popoverTop =
      below + height <= window.innerHeight - margin
        ? below
        : Math.max(margin, trigger.top - height - margin);
    this.popoverLeft = Math.min(
      Math.max(margin, trigger.left),
      window.innerWidth - this.popoverWidth - margin,
    );
  }
}
