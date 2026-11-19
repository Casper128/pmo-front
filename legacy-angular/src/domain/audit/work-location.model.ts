export type LocationStatus = 'granted' | 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export interface WorkLocation {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationStatus: LocationStatus;
}

export interface LocationRequest {
  highAccuracy: boolean;
  maximumAgeMs: number;
  timeoutMs: number;
}
