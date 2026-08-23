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
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';

export interface UiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

let selectSequence = 0;

@Component({
  selector: 'app-ui-select',
  standalone: true,
  imports: [OverflowTooltipDirective],
  styleUrl: './ui-select.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './ui-select.component.html',
})
export class UiSelectComponent implements ControlValueAccessor {
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('popover') private popover?: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @Input() label = '';
  @Input() options: readonly UiSelectOption[] = [];
  @Input() placeholder = 'Seleccione una opción';
  @Input() hint = '';
  @Input() error = '';
  @Input() disabled = false;
  @Input() searchThreshold = 8;
  @Input() searchPlaceholder = 'Buscar opción...';

  readonly controlId = `ui-select-${++selectSequence}`;
  readonly listboxId = `${this.controlId}-listbox`;
  readonly descriptionId = `${this.controlId}-description`;
  value = '';
  open = false;
  query = '';
  activeIndex = 0;
  popoverTop = 0;
  popoverLeft = 0;
  popoverWidth = 280;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private formDisabled = false;
  private onValueChange: (value: string) => void = () => undefined;
  onTouched: () => void = () => undefined;

  get isDisabled(): boolean {
    return this.disabled || this.formDisabled;
  }

  get selectedLabel(): string {
    return this.options.find((option) => option.value === this.value)?.label ?? '';
  }

  get filteredOptions(): readonly UiSelectOption[] {
    const term = this.normalize(this.query);
    return term
      ? this.options.filter((option) => this.normalize(option.label).includes(term))
      : this.options;
  }

  get activeOptionId(): string | null {
    return this.open && this.filteredOptions[this.activeIndex]
      ? this.optionId(this.activeIndex)
      : null;
  }

  optionId(index: number): string {
    return `${this.controlId}-option-${index}`;
  }

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
    this.formDisabled = disabled;
    if (disabled) this.close();
  }

  toggle(): void {
    if (this.isDisabled) return;
    this.open ? this.close() : this.openDropdown();
  }

  select(option: UiSelectOption): void {
    if (option.disabled) return;
    this.value = option.value;
    this.onValueChange(option.value);
    this.onTouched();
    this.close();
    this.trigger?.nativeElement.focus();
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
    this.activeIndex = 0;
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      if (!this.open) this.openDropdown();
      else if (event.key === 'ArrowDown') this.moveActive(1);
      else if (event.key === 'ArrowUp') this.moveActive(-1);
      else this.selectActive();
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActive(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.selectActive();
    } else if (event.key === 'Escape') {
      this.close();
      this.trigger?.nativeElement.focus();
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
    ) {
      this.close();
    }
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  close(): void {
    this.open = false;
    this.query = '';
  }

  private openDropdown(): void {
    this.positionPopover(344);
    this.open = true;
    this.activeIndex = Math.max(
      0,
      this.options.findIndex((option) => option.value === this.value),
    );
    setTimeout(() => {
      this.positionPopover();
      this.searchInput?.nativeElement.focus();
    }, 0);
  }

  private positionPopover(estimatedHeight = 344): void {
    const trigger = this.trigger?.nativeElement.getBoundingClientRect();
    const popover = this.popover?.nativeElement;
    if (!trigger) return;

    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    this.popoverWidth = Math.min(Math.max(trigger.width, 280), viewportWidth - margin * 2);
    const height = popover ? Math.min(popover.scrollHeight, 344) : estimatedHeight;
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

  private moveActive(direction: number): void {
    const options = this.filteredOptions;
    if (!options.length) return;
    let next = this.activeIndex;
    do {
      next = (next + direction + options.length) % options.length;
    } while (options[next]?.disabled && next !== this.activeIndex);
    this.activeIndex = next;
  }

  private selectActive(): void {
    const option = this.filteredOptions[this.activeIndex];
    if (option) this.select(option);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
