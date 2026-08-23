import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface UiToolbarCommand {
  label: string;
  route: string;
}

@Component({
  selector: 'app-ui-toolbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './ui-toolbar.component.html',
})
export class UiToolbarComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() commands: readonly UiToolbarCommand[] = [];
  @Input() initials = '';
  @Input() userName = '';
  @Output() logout = new EventEmitter<void>();

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
}
