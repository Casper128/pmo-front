import { Component, Input } from '@angular/core';

export type UiMetricTone = 'slate' | 'blue' | 'emerald' | 'violet' | 'amber' | 'red';

@Component({
  selector: 'app-ui-metric-card',
  standalone: true,
  template: `
    <article
      class="h-full rounded-2xl border p-4 shadow-sm"
      [class.border-slate-200]="tone === 'slate'"
      [class.bg-white]="tone === 'slate'"
      [class.border-blue-200]="tone === 'blue'"
      [class.bg-blue-50]="tone === 'blue'"
      [class.border-emerald-200]="tone === 'emerald'"
      [class.bg-emerald-50]="tone === 'emerald'"
      [class.border-violet-200]="tone === 'violet'"
      [class.bg-violet-50]="tone === 'violet'"
      [class.border-amber-200]="tone === 'amber'"
      [class.bg-amber-50]="tone === 'amber'"
      [class.border-red-200]="tone === 'red'"
      [class.bg-red-50]="tone === 'red'"
    >
      <p
        class="text-[11px] font-black uppercase tracking-widest"
        [class.text-slate-400]="tone === 'slate'"
        [class.text-blue-600]="tone === 'blue'"
        [class.text-emerald-600]="tone === 'emerald'"
        [class.text-violet-600]="tone === 'violet'"
        [class.text-amber-600]="tone === 'amber'"
        [class.text-red-600]="tone === 'red'"
      >{{ label }}</p>
      <p
        class="mt-2 break-words text-3xl font-black"
        [class.text-slate-950]="tone === 'slate'"
        [class.text-blue-900]="tone === 'blue'"
        [class.text-emerald-800]="tone === 'emerald'"
        [class.text-violet-800]="tone === 'violet'"
        [class.text-amber-800]="tone === 'amber'"
        [class.text-red-800]="tone === 'red'"
      >{{ value }}</p>
      @if (description) {
        <p
          class="mt-1 text-xs font-bold"
          [class.text-slate-400]="tone === 'slate'"
          [class.text-blue-600]="tone === 'blue'"
          [class.text-emerald-600]="tone === 'emerald'"
          [class.text-violet-600]="tone === 'violet'"
          [class.text-amber-600]="tone === 'amber'"
          [class.text-red-600]="tone === 'red'"
        >{{ description }}</p>
      }
    </article>
  `,
})
export class UiMetricCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() description = '';
  @Input() tone: UiMetricTone = 'slate';
}
