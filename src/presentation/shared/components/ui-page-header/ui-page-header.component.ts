import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ui-page-header',
  standalone: true,
  template: `
    <header
      class="overflow-hidden rounded-2xl border border-blue-900 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-800 p-5 text-white shadow-xl shadow-blue-950/10 sm:p-6"
    >
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-black uppercase tracking-[0.22em] text-blue-200">
            {{ eyebrow }}
          </p>
          <h1 class="mt-1 break-words text-2xl font-black sm:text-3xl">
            {{ title }}
          </h1>
          @if (description) {
            <p class="mt-1 max-w-3xl text-sm text-blue-100">
              {{ description }}
            </p>
          }
        </div>

        <div class="min-w-0"><ng-content select="[pageHeaderAside]" /></div>
      </div>
      <div class="empty:hidden"><ng-content select="[pageHeaderMeta]" /></div>
    </header>
  `,
})
export class UiPageHeaderComponent {
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input() description = '';
}
