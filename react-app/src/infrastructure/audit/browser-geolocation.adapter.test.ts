import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserGeolocationAdapter } from './browser-geolocation.adapter';

const REQUEST = { highAccuracy: true, maximumAgeMs: 0, timeoutMs: 15000 };

function stubGeolocation(getCurrentPosition: Geolocation['getCurrentPosition'] | undefined) {
  vi.stubGlobal('navigator', {
    geolocation: getCurrentPosition ? { getCurrentPosition } : undefined,
  });
}

describe('BrowserGeolocationAdapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('traduce las opciones y devuelve la posición concedida', async () => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success) =>
      success({ coords: { latitude: 4.6, longitude: -74.1, accuracy: 25 } } as GeolocationPosition),
    );
    stubGeolocation(getCurrentPosition);

    await expect(new BrowserGeolocationAdapter().capture(REQUEST)).resolves.toEqual({
      latitude: 4.6,
      longitude: -74.1,
      accuracy: 25,
      locationStatus: 'granted',
    });
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });

  it.each([
    [1, 'denied'],
    [3, 'timeout'],
    [2, 'unavailable'],
  ] as const)('error con código %i → %s (nunca rechaza)', async (code, status) => {
    stubGeolocation((_success, failure) =>
      failure?.({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError),
    );
    await expect(new BrowserGeolocationAdapter().capture(REQUEST)).resolves.toMatchObject({
      latitude: null,
      locationStatus: status,
    });
  });

  it('sin API de geolocalización devuelve unsupported', async () => {
    stubGeolocation(undefined);
    await expect(new BrowserGeolocationAdapter().capture(REQUEST)).resolves.toMatchObject({
      locationStatus: 'unsupported',
    });
  });
});
