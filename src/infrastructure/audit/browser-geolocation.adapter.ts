import { Injectable } from '@angular/core';
import { LocationGateway } from '@application/audit/audit.gateways';
import { LocationRequest, WorkLocation } from '@domain/audit/work-location.model';

@Injectable()
export class BrowserGeolocationAdapter implements LocationGateway {
  capture(request: LocationRequest): Promise<WorkLocation> {
    if (!navigator.geolocation) {
      return Promise.resolve({
        latitude: null,
        longitude: null,
        accuracy: null,
        locationStatus: 'unsupported',
      });
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            locationStatus: 'granted',
          }),
        (error) =>
          resolve({
            latitude: null,
            longitude: null,
            accuracy: null,
            locationStatus:
              error.code === error.PERMISSION_DENIED
                ? 'denied'
                : error.code === error.TIMEOUT
                  ? 'timeout'
                  : 'unavailable',
          }),
        {
          enableHighAccuracy: request.highAccuracy,
          maximumAge: request.maximumAgeMs,
          timeout: request.timeoutMs,
        },
      );
    });
  }
}
