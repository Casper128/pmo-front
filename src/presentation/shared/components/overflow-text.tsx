import { useRef, useState } from 'react';
import { cn } from 'cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

export interface OverflowTextProps {
  readonly children: string;
  /** 1 (por defecto): una línea con elipsis; 2 o 3: `line-clamp`. */
  readonly lines?: 1 | 2 | 3;
  /** Texto del tooltip si difiere del visible (por defecto, el propio texto). */
  readonly tooltip?: string;
  readonly className?: string;
}

const clampClasses = { 1: 'block truncate', 2: 'line-clamp-2 break-words', 3: 'line-clamp-3 break-words' } as const;

/** Mismo criterio que `overflow-tooltip.directive`: el contenido supera la caja en más de 1 px. */
function isOverflowing(element: HTMLElement | null): boolean {
  return (
    !!element &&
    (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
  );
}

/**
 * Texto truncado con Shadcn `Tooltip` que solo se abre si el texto está cortado (equivale a
 * `overflow-tooltip.directive`). Como la directiva, mide al pasar el puntero o recibir el foco, así que no
 * necesita observar cambios de tamaño.
 */
export function OverflowText({ children, lines = 1, tooltip, className }: OverflowTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const text = tooltip?.trim() || children.trim();

  return (
    <Tooltip open={open} onOpenChange={(next) => setOpen(next && !!text && isOverflowing(ref.current))}>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn('min-w-0', clampClasses[lines], className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[min(30rem,calc(100vw-2rem))] break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
