import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useColombiaToday } from './use-colombia-today';

describe('useColombiaToday', () => {
  afterEach(() => vi.useRealTimers());

  it('se recalcula al volver el foco tras la medianoche de Colombia', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-19T04:30:00Z') }); // 23:30 del 18 en Bogotá
    const { result } = renderHook(() => useColombiaToday());
    expect(result.current).toBe('2026-09-18');

    vi.setSystemTime(new Date('2026-09-19T05:30:00Z')); // 00:30 del 19
    expect(result.current).toBe('2026-09-18');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe('2026-09-19');
  });

  it('también al volver la visibilidad de la pestaña', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-19T04:30:00Z') });
    const { result } = renderHook(() => useColombiaToday());
    vi.setSystemTime(new Date('2026-09-19T05:30:00Z'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-09-19');
  });
});
