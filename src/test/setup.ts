import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Las rutas son lazy: la primera carga de una página con Recharts tarda más que el 1 s por defecto.
configure({ asyncUtilTimeout: 4000 })

// jsdom no implementa matchMedia ni ResizeObserver; los usan Radix, Recharts y el tema.
// Las pruebas de scripts usan `@vitest-environment node`, donde no existe window.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub
}

// Radix Select y cmdk usan APIs de puntero y scroll que jsdom no implementa.
if (typeof window !== 'undefined') {
  const proto = window.HTMLElement.prototype
  proto.scrollIntoView ??= function scrollIntoView() {}
  proto.hasPointerCapture ??= function hasPointerCapture() {
    return false
  }
  proto.releasePointerCapture ??= function releasePointerCapture() {}
}
