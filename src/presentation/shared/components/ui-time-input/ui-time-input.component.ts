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
  styleUrl: './ui-time-input.component.css',
  templateUrl: './ui-time-input.component.html',
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
