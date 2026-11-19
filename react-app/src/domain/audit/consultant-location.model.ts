export type LocationVerificationStatus =
  | 'within_home_radius'
  | 'outside_home_radius'
  | 'reference_auto_created'
  | 'low_accuracy'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

export interface ConsultantLocation {
  userKey: string;
  email: string;
  fullName: string;
  username: string;
  homeLatitude: number | null;
  homeLongitude: number | null;
  homeRadiusM: number;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyM: number | null;
  lastLocationStatus: string;
  lastDistanceToHomeM: number | null;
  lastWithinHomeRadius: boolean | null;
  lastVerificationStatus: LocationVerificationStatus | null;
  lastLocationSource: 'login' | 'time_report' | null;
  lastLocationAt: string | null;
}

export interface ConsultantLocationEvent {
  id: number;
  userKey: string;
  reportReference: string;
  customer: string;
  reportDate: string | null;
  successful: boolean;
  occurredAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  locationStatus: string;
  distanceToHomeM: number | null;
  withinHomeRadius: boolean | null;
  verificationStatus: LocationVerificationStatus;
}

export interface ConsultantLocationCollection {
  consultants: ConsultantLocation[];
  events: ConsultantLocationEvent[];
}

export interface ConsultantLocationFilter {
  dateFrom: string;
  dateTo: string;
}
