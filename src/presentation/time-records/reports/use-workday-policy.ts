import { useMemo } from 'react';
import { WorkdayHoursPolicy } from '@domain/time-records/services/workday-hours.policy';
import { useContainer } from '@presentation/providers/container-context';
import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';

/** Jornada esperada por día; se recalcula cuando cambia la configuración de jornada. */
export function useWorkdayPolicy(): WorkdayHoursPolicy {
  const { parameters } = useContainer();
  const workSettings = useAppParameters((p) => p.workSettings());
  // `workSettings` no se lee dentro: es la señal que invalida la política cuando cambia la jornada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new WorkdayHoursPolicy(parameters), [parameters, workSettings]);
}
