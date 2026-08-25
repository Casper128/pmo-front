import { HorasAlert } from '../models/time-record.model';
import type {
  HourBillingCategory,
  HourBillingFilter,
  TimeRecordParameters,
} from './time-record-domain.service';

export class WorkdayHoursPolicy {
  constructor(private readonly parameters: TimeRecordParameters) {}

  alert(total: number, fecha: string): HorasAlert {
    const day = new Date(fecha + 'T12:00:00').getDay();
    const settings = this.parameters.workSettings();
    const meta =
      settings.dailyHours?.[day] ??
      (day === 0 || day === 6
        ? 0
        : day === 5
          ? settings.fridayHours
          : settings.mondayThursdayHours);
    if (total > meta)
      return {
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        icon: 'alert',
        label: `Excede ${meta}h`,
      };
    if (total === meta)
      return {
        color: '#059669',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        icon: 'check',
        label: `Exacto ${meta}h`,
      };
    return {
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      icon: 'pending',
      label: `Faltan ${(meta - total).toFixed(1)}h`,
    };
  }

  isLabor(tipoHora: string): boolean {
    return this.normalize(tipoHora) === 'laboral';
  }

  isFactory(tipoHora: string): boolean {
    const normalized = this.normalize(tipoHora);
    return normalized.includes('fabrica') || normalized.includes('factory');
  }

  isCountable(tipoHora: string): boolean {
    return !this.isFactory(tipoHora);
  }

  billingCategory(tipoHora: string): HourBillingCategory {
    const normalized = this.normalize(tipoHora).replace(/[-_]+/g, ' ');
    if (normalized.includes('fabrica') || normalized.includes('factory')) return 'factory';
    if (
      normalized.includes('no facturable') ||
      normalized.includes('no facturacion') ||
      normalized.includes('nofacturable')
    )
      return 'non_billable';
    return 'billable';
  }

  matchesBillingFilter(tipoHora: string, filter: HourBillingFilter): boolean {
    return filter === 'all' || this.billingCategory(tipoHora) === filter;
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
