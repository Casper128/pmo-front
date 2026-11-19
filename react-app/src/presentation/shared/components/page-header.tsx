import type { ReactNode } from 'react';

export interface PageHeaderProps {
  readonly title: string;
  /** Texto pequeño atenuado sobre el título (`eyebrow` de `ui-page-header`). */
  readonly eyebrow?: string;
  readonly description?: string;
  /** Contenido a la derecha del título (acciones), como `[pageHeaderAside]`. */
  readonly aside?: ReactNode;
  /** Contenido debajo de la descripción, como `[pageHeaderMeta]`. */
  readonly meta?: ReactNode;
}

/**
 * Encabezado de página (equivale a `ui-page-header`): `eyebrow`, título `h1`, descripción, `meta` debajo y
 * `aside` a la derecha en pantallas anchas.
 */
export function PageHeader({ title, eyebrow, description, aside, meta }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight break-words text-balance">{title}</h1>
          {description ? (
            <p className="max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {aside ? <div className="flex shrink-0 flex-wrap gap-2">{aside}</div> : null}
      </div>
      {meta ? <div className="min-w-0">{meta}</div> : null}
    </header>
  );
}
