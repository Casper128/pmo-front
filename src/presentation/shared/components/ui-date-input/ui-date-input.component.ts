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

interface CalendarDay {
  value: string;
  day: number;
  currentMonth: boolean;
  today: boolean;
  disabled: boolean;
}

let dateSequence = 0;

@Component({
  selector: 'app-ui-date-input',
  standalone: true,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        width: 100%;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiDateInputComponent),
      multi: true,
    },
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
        [id]="controlId"
        [disabled]="isDisabled"
        [attr.aria-expanded]="open"
        [attr.aria-haspopup]="'dialog'"
        [attr.aria-controls]="calendarId"
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
          class="grid size-7 shrink-0 place-items-center rounded-lg transition"
          [class.bg-blue-100]="open"
          [class.text-blue-700]="open"
          [class.bg-blue-50]="!open"
          [class.text-blue-700]="!open"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" class="size-4 fill-none stroke-current" stroke-width="2">
            <path
              d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </button>

      @if (open) {
        <section
          #calendar
          class="fixed z-[200] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/20"
          role="dialog"
          aria-modal="false"
          [id]="calendarId"
          [attr.aria-label]="'Calendario ' + monthLabel"
          [style.top.px]="popoverTop"
          [style.left.px]="popoverLeft"
          [style.width.px]="popoverWidth"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <button
              class="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              type="button"
              aria-label="Mes anterior"
              (click)="changeMonth(-1)"
            >
              <svg viewBox="0 0 20 20" class="size-4 fill-none stroke-current" stroke-width="2">
                <path d="m12 5-5 5 5 5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div class="text-center">
              <p class="text-[10px] font-black uppercase tracking-widest text-blue-600">
                Seleccionar fecha
              </p>
              <p class="mt-0.5 text-sm font-black capitalize text-slate-900">{{ monthLabel }}</p>
            </div>
            <button
              class="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              type="button"
              aria-label="Mes siguiente"
              (click)="changeMonth(1)"
            >
              <svg viewBox="0 0 20 20" class="size-4 fill-none stroke-current" stroke-width="2">
                <path d="m8 5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <div
            class="mb-1 grid grid-cols-7 text-center text-[10px] font-black uppercase text-slate-400"
          >
            @for (weekday of weekdays; track weekday) {
              <span class="py-1.5">{{ weekday }}</span>
            }
          </div>
          <div class="grid grid-cols-7 gap-1">
            @for (day of calendarDays; track day.value) {
              <button
                class="grid aspect-square min-h-9 place-items-center rounded-xl text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-25"
                type="button"
                [disabled]="day.disabled"
                [attr.aria-label]="formatAccessible(day.value)"
                [attr.aria-pressed]="day.value === value"
                [class.bg-blue-600]="day.value === value"
                [class.text-white]="day.value === value"
                [class.ring-2]="day.today && day.value !== value"
                [class.ring-blue-200]="day.today && day.value !== value"
                [class.text-blue-700]="day.today && day.value !== value"
                [class.text-slate-800]="day.currentMonth && !day.today && day.value !== value"
                [class.text-slate-300]="!day.currentMonth && day.value !== value"
                [class.hover:bg-blue-50]="day.value !== value && !day.disabled"
                (click)="selectDay(day)"
              >
                {{ day.day }}
              </button>
            }
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <button
              class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              type="button"
              [disabled]="!isAllowed(todayValue)"
              (click)="selectValue(todayValue)"
            >
              Hoy
            </button>
            <button
              class="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700"
              type="button"
              (click)="selectValue('')"
            >
              Limpiar
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
export class UiDateInputComponent implements ControlValueAccessor {
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('calendar') private calendar?: ElementRef<HTMLElement>;
  @Input() label = '';
  @Input() min = '2000-01-01';
  @Input() max = '2100-12-31';
  @Input() placeholder = 'Seleccionar fecha';
  @Input() hint = '';
  @Input() error = '';
  @Input() disabled = false;

  readonly controlId = `ui-date-${++dateSequence}`;
  readonly calendarId = `${this.controlId}-calendar`;
  readonly descriptionId = `${this.controlId}-description`;
  readonly weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  readonly todayValue = this.toValue(new Date());
  value = '';
  open = false;
  visibleMonth = this.firstOfMonth(new Date());
  popoverTop = 0;
  popoverLeft = 0;
  popoverWidth = 320;

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

  get monthLabel(): string {
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(
      this.visibleMonth,
    );
  }

  get calendarDays(): CalendarDay[] {
    const year = this.visibleMonth.getFullYear();
    const month = this.visibleMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
    const start = new Date(year, month, 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const value = this.toValue(date);
      return {
        value,
        day: date.getDate(),
        currentMonth: date.getMonth() === month,
        today: value === this.todayValue,
        disabled: !this.isAllowed(value),
      };
    });
  }

  writeValue(value: string | null | undefined): void {
    this.value = value ?? '';
    if (this.value) this.visibleMonth = this.firstOfMonth(this.parseValue(this.value));
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
    if (this.open) {
      this.close();
      return;
    }
    this.visibleMonth = this.firstOfMonth(this.value ? this.parseValue(this.value) : new Date());
    this.positionPopover(410);
    this.open = true;
    setTimeout(() => this.positionPopover(), 0);
  }

  changeMonth(offset: number): void {
    this.visibleMonth = new Date(
      this.visibleMonth.getFullYear(),
      this.visibleMonth.getMonth() + offset,
      1,
    );
  }

  selectDay(day: CalendarDay): void {
    if (!day.disabled) this.selectValue(day.value);
  }

  selectValue(value: string): void {
    if (value && !this.isAllowed(value)) return;
    this.value = value;
    this.onValueChange(value);
    this.onTouched();
    this.close();
    this.trigger?.nativeElement.focus();
  }

  isAllowed(value: string): boolean {
    return (!this.min || value >= this.min) && (!this.max || value <= this.max);
  }

  formatAccessible(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(this.parseValue(value));
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
      !this.calendar?.nativeElement.contains(target)
    ) {
      this.close();
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  close(): void {
    this.open = false;
  }

  private positionPopover(estimatedHeight = 410): void {
    const trigger = this.trigger?.nativeElement.getBoundingClientRect();
    const calendar = this.calendar?.nativeElement;
    if (!trigger) return;

    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    this.popoverWidth = Math.min(320, viewportWidth - margin * 2);
    const height = calendar?.scrollHeight ?? estimatedHeight;
    const below = trigger.bottom + margin;
    this.popoverTop =
      below + height <= viewportHeight - margin
        ? below
        : Math.max(margin, trigger.top - height - margin);
    this.popoverLeft = Math.min(
      Math.max(margin, trigger.left),
      viewportWidth - this.popoverWidth - margin,
    );
  }

  private formatDisplay(value: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(this.parseValue(value));
  }

  private parseValue(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private firstOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private toValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
