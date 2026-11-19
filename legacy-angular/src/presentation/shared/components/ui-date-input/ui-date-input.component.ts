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
  styleUrl: './ui-date-input.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiDateInputComponent),
      multi: true,
    },
  ],
  templateUrl: './ui-date-input.component.html',
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
