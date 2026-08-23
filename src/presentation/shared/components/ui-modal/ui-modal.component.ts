import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

type UiModalSize = 'sm' | 'md' | 'lg' | 'xl';
type UiModalVariant = 'dialog' | 'sheet' | 'confirmation' | 'destructive';

@Component({
  selector: 'app-ui-modal',
  standalone: true,
  templateUrl: './ui-modal.component.html',
})
export class UiModalComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  @Input() open = false;
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() description = '';
  @Input() size: UiModalSize = 'lg';
  @Input() variant: UiModalVariant = 'dialog';
  @Output() close = new EventEmitter<void>();

  private wasOpen = false;
  private previousFocus: HTMLElement | null = null;

  get titleId(): string {
    return `ui-modal-title-${this.slug(this.title)}`;
  }

  get descriptionId(): string {
    return `ui-modal-description-${this.slug(this.title)}`;
  }

  ngAfterViewChecked(): void {
    if (this.open && !this.wasOpen) {
      this.wasOpen = true;
      this.previousFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      queueMicrotask(() => this.focusFirstElement());
    } else if (!this.open && this.wasOpen) {
      this.wasOpen = false;
      this.previousFocus?.focus();
      this.previousFocus = null;
    }
  }

  ngOnDestroy(): void {
    if (this.wasOpen) this.previousFocus?.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close.emit();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = this.focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      this.dialog?.nativeElement.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1)!;
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusFirstElement(): void {
    const first = this.focusableElements()[0] || this.dialog?.nativeElement;
    first?.focus();
  }

  private focusableElements(): HTMLElement[] {
    const root = this.dialog?.nativeElement;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
  }

  private slug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }
}
