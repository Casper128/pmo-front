import { DOCUMENT } from '@angular/common';
import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';

let tooltipSequence = 0;

@Directive({
  selector: '[appOverflowTooltip]',
  standalone: true,
})
export class OverflowTooltipDirective implements OnDestroy {
  @Input('appOverflowTooltip') tooltipText = '';
  @Input() appOverflowTooltipLines: 0 | 1 | 2 | 3 = 0;

  @HostBinding('class.ui-overflow-clamp')
  get clampsText(): boolean {
    return this.appOverflowTooltipLines > 0;
  }

  @HostBinding('class.ui-overflow-clamp--1')
  get clampsOneLine(): boolean {
    return this.appOverflowTooltipLines === 1;
  }

  @HostBinding('class.ui-overflow-clamp--2')
  get clampsTwoLines(): boolean {
    return this.appOverflowTooltipLines === 2;
  }

  @HostBinding('class.ui-overflow-clamp--3')
  get clampsThreeLines(): boolean {
    return this.appOverflowTooltipLines === 3;
  }

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private tooltip: HTMLDivElement | null = null;
  private previousDescribedBy: string | null = null;

  @HostListener('mouseenter')
  @HostListener('focusin')
  show(): void {
    if (this.tooltip || !this.isOverflowing()) return;

    const text = this.tooltipText.trim() || this.element.nativeElement.textContent?.trim() || '';
    if (!text) return;

    const tooltip = this.document.createElement('div');
    tooltip.id = `overflow-tooltip-${++tooltipSequence}`;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = text;
    Object.assign(tooltip.style, {
      position: 'fixed',
      zIndex: '9999',
      maxWidth: 'min(30rem, calc(100vw - 2rem))',
      padding: '0.625rem 0.75rem',
      borderRadius: '0.625rem',
      background: '#0f172a',
      color: '#ffffff',
      fontSize: '0.75rem',
      fontWeight: '600',
      lineHeight: '1.35rem',
      whiteSpace: 'normal',
      overflowWrap: 'anywhere',
      boxShadow: '0 12px 30px rgba(15, 23, 42, 0.3)',
      pointerEvents: 'none',
      opacity: '0',
    });

    this.document.body.appendChild(tooltip);
    this.tooltip = tooltip;
    this.positionTooltip();
    tooltip.style.opacity = '1';

    this.previousDescribedBy = this.element.nativeElement.getAttribute('aria-describedby');
    this.element.nativeElement.setAttribute('aria-describedby', tooltip.id);
  }

  @HostListener('mouseleave')
  @HostListener('focusout')
  hide(): void {
    this.tooltip?.remove();
    this.tooltip = null;

    if (this.previousDescribedBy) {
      this.element.nativeElement.setAttribute('aria-describedby', this.previousDescribedBy);
    } else {
      this.element.nativeElement.removeAttribute('aria-describedby');
    }
    this.previousDescribedBy = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private isOverflowing(): boolean {
    const element = this.element.nativeElement;
    return (
      element.scrollWidth > element.clientWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1
    );
  }

  private positionTooltip(): void {
    if (!this.tooltip) return;

    const anchor = this.element.nativeElement.getBoundingClientRect();
    const tooltip = this.tooltip.getBoundingClientRect();
    const viewportWidth = this.document.defaultView?.innerWidth ?? anchor.right;
    const viewportHeight = this.document.defaultView?.innerHeight ?? anchor.bottom;
    const margin = 8;
    const preferredTop = anchor.bottom + margin;
    const top =
      preferredTop + tooltip.height <= viewportHeight - margin
        ? preferredTop
        : Math.max(margin, anchor.top - tooltip.height - margin);
    const centeredLeft = anchor.left + anchor.width / 2 - tooltip.width / 2;
    const left = Math.min(
      Math.max(margin, centeredLeft),
      Math.max(margin, viewportWidth - tooltip.width - margin),
    );

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }
}
