import { afterEach, vi } from 'vitest';

/**
 * Simula el ancho del viewport para `matchMedia('(min-width: N px)')`. jsdom no calcula media queries:
 * `useMediaQuery` consulta `window.matchMedia`, así que basta con sustituirlo. Se restaura tras cada test.
 */
export function setViewportWidth(width: number): void {
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const max = /\(max-width:\s*(\d+)px\)/.exec(query);
    const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true);
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

afterEach(() => vi.unstubAllGlobals());
