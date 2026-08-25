import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';

export type UiToolbarTheme = 'light' | 'dark';

@Component({
  selector: 'app-ui-toolbar',
  standalone: true,
  imports: [NgIcon],
  templateUrl: './ui-toolbar.component.html',
})
export class UiToolbarComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() initials = '';
  @Input() userName = '';
  @Input() theme: UiToolbarTheme = 'light';
  @Output() logout = new EventEmitter<void>();
  @Output() themeChange = new EventEmitter<UiToolbarTheme>();

  readonly lightThemeIcon = lucideSun;
  readonly darkThemeIcon = lucideMoon;
  menuOpen = signal(false);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.menuOpen.set(false);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.menuOpen.set(false);
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  emitLogout(): void {
    this.menuOpen.set(false);
    this.logout.emit();
  }

  selectTheme(theme: UiToolbarTheme): void {
    this.themeChange.emit(theme);
  }
}
