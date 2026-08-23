import { Component, Input } from '@angular/core';

type UiFormSectionColumns = 1 | 2 | 3 | 4;
type UiFormSectionDensity = 'comfortable' | 'compact';

@Component({
  selector: 'app-ui-form-section',
  standalone: true,
  templateUrl: './ui-form-section.component.html',
  host: {
    class: 'block',
  },
})
export class UiFormSectionComponent {
  @Input() title = '';
  @Input() eyebrow = '';
  @Input() description = '';
  @Input() columns: UiFormSectionColumns = 2;
  @Input() density: UiFormSectionDensity = 'comfortable';
  @Input() surface = true;

  get gridClass(): string {
    const columnClass =
      this.columns === 1
        ? 'grid-cols-1'
        : this.columns === 2
          ? 'grid-cols-1 md:grid-cols-2'
          : this.columns === 3
            ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
    const gapClass = this.density === 'compact' ? 'gap-2.5' : 'gap-3';
    return `grid ${columnClass} ${gapClass}`;
  }
}
