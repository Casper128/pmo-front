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
      useExisting: forwardRef(() => UiSelectComponent),
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
        role="combobox"
        aria-haspopup="listbox"
        [id]="controlId"
        [disabled]="isDisabled"
        [attr.aria-expanded]="open"
        [attr.aria-controls]="listboxId"
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
        <span
          class="min-w-0 flex-1 truncate"
          [class.text-slate-400]="!value"
          [class.text-slate-800]="value"
          [appOverflowTooltip]="selectedLabel"
          >{{ selectedLabel || placeholder }}</span
        >
        <span
          class="grid size-7 shrink-0 place-items-center rounded-lg transition"
          [class.rotate-180]="open"
          [class.bg-blue-100]="open"
          [class.text-blue-700]="open"
          [class.bg-slate-100]="!open"
          [class.text-slate-500]="!open"
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" class="size-4 fill-none stroke-current" stroke-width="2">
            <path d="m6 8 4 4 4-4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </button>

      @if (open) {
        <div
          #popover
          class="fixed z-[200] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/20"
          [style.top.px]="popoverTop"
          [style.left.px]="popoverLeft"
          [style.width.px]="popoverWidth"
        >
          @if (options.length > searchThreshold) {
            <div class="relative mb-2">
              <svg
                class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-slate-400"
                viewBox="0 0 24 24"
                stroke-width="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" stroke-linecap="round" />
              </svg>
              <input
                #searchInput
                class="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                type="search"
                autocomplete="off"
                placeholder="Buscar opción..."
                [value]="query"
                (input)="onSearch($event)"
                (keydown)="onSearchKeydown($event)"
              />
            </div>
          }
          <div [id]="listboxId" class="max-h-64 space-y-1 overflow-y-auto" role="listbox">
            @for (option of filteredOptions; track option.value; let index = $index) {
              <button
                class="group/option flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                role="option"
                [disabled]="option.disabled ?? false"
                [attr.aria-selected]="option.value === value"
                [class.bg-blue-600]="option.value === value"
                [class.text-white]="option.value === value"
                [class.bg-blue-50]="index === activeIndex && option.value !== value"
                [class.text-blue-900]="index === activeIndex && option.value !== value"
                [class.text-slate-700]="index !== activeIndex && option.value !== value"
                [class.hover:bg-slate-100]="option.value !== value"
                (mouseenter)="activeIndex = index"
                (click)="select(option)"
              >
                <span class="min-w-0 flex-1 break-words font-semibold">{{ option.label }}</span>
                @if (option.value === value) {
                  <svg
                    class="size-4 shrink-0 fill-none stroke-current"
                    viewBox="0 0 20 20"
                    stroke-width="2.5"
                  >
                    <path d="m4 10 4 4 8-8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                }
              </button>
            } @empty {
              <div class="px-3 py-8 text-center text-sm font-semibold text-slate-400">
                No hay opciones que coincidan.
              </div>
            }
          </div>
        </div>
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
