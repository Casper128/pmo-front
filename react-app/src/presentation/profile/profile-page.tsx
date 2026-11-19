import { CalendarClock, ClipboardList, Clock, LogOut, Moon, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { WorkdayHoursPolicy } from '@domain/time-records/services/workday-hours.policy';
import { useContainer } from '@presentation/providers/container-context';
import { errorMessage } from '@presentation/shared/error-message';
import { formatFechaEsp, todayDateValue } from '@presentation/shared/format';
import { MetricCard } from '@presentation/shared/components/metric-card';
import { PageHeader } from '@presentation/shared/components/page-header';
import { StateMessage } from '@presentation/shared/components/state-message';
import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import { userInitials } from '@presentation/shell/permissions';
import { useTheme, type AppTheme } from '@presentation/shell/theme-context';
import { ComplianceCard } from '@presentation/time-records/dashboard/compliance-card';
import { formatHours } from '@presentation/time-records/dashboard/dashboard-format';
import { complianceSummary, lastDays } from '@presentation/time-records/dashboard/dashboard-insights';
import { useMyReports } from '@presentation/time-records/reports/use-my-reports';
import { latestReport, monthToDateRange } from './profile-summary';

const themeOptions: readonly { value: AppTheme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
];

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Consultando tu resumen...">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/** Perfil del usuario: identidad de la sesión, resumen personal del mes y preferencias. */
export function ProfilePage() {
  const { dashboardCalculator: calculator, parameters } = useContainer();
  const { auth, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const reports = useMyReports();
  const workSettings = useAppParameters((p) => p.workSettings());
  const rows = reports.data;
  const today = todayDateValue();

  const summary = useMemo(() => {
    if (!rows) return null;
    const snapshot = calculator.build(rows, { ...monthToDateRange(today), client: '', hourType: '' });
    const expectedFor = (date: string) => new WorkdayHoursPolicy(parameters).expectedHoursForDate(date);
    return {
      hours: snapshot.kpis.totalHours,
      records: snapshot.rowCount,
      compliance: complianceSummary(snapshot.daily, expectedFor),
      trend: lastDays(snapshot.daily, 7),
      last: latestReport(rows),
    };
    // `workSettings` no se lee aquí: invalida el cálculo cuando cambia la jornada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculator, parameters, rows, today, workSettings]);

  const name = user?.name || 'Usuario PMO';
  const identity = [user?.email, user?.username && user.username !== user.email ? user.username : ''].filter(Boolean);
  const subtitle = [user?.position, user?.area].filter(Boolean).join(' · ');

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <PageHeader title="Mi perfil" description="Tu sesión, el resumen del mes y tus preferencias." />

      <Card aria-label="Datos de la sesión" role="region">
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-16" aria-hidden="true">
            <AvatarFallback className="text-xl font-semibold">{userInitials(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold break-words">{name}</h2>
              {user?.role ? <Badge variant="secondary">{user.role}</Badge> : null}
            </div>
            {identity.map((value) => (
              <p key={value} className="text-sm break-all text-muted-foreground">
                {value}
              </p>
            ))}
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <Button type="button" variant="outline" onClick={() => auth.clearTokens()}>
            <LogOut aria-hidden="true" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>

      {reports.isPending ? (
        <ProfileSkeleton />
      ) : reports.isError ? (
        <StateMessage
          tone="error"
          title="No fue posible consultar tu resumen"
          description={errorMessage(reports.error) || 'No fue posible consultar los registros del consultor.'}
          actionLabel="Reintentar"
          onAction={() => void reports.refetch()}
        />
      ) : summary && rows?.length ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4" aria-label="Resumen del mes">
            <MetricCard label="Horas del mes" value={`${formatHours(summary.hours)} h`} icon={Clock} accent={1} description="Del 1.º del mes a hoy" />
            <MetricCard label="Registros del mes" value={summary.records} icon={ClipboardList} accent={2} description="Actividades reportadas" />
            <MetricCard
              label="Último reporte"
              value={summary.last ? formatFechaEsp(summary.last.date) : 'Sin reportes'}
              icon={CalendarClock}
              accent={4}
              description={summary.last ? `${summary.last.request} · ${summary.last.client}` : undefined}
            />
          </section>
          <ComplianceCard summary={summary.compliance} trend={summary.trend} description="Horas reportadas frente a las esperadas en lo que va del mes." />
        </>
      ) : (
        <StateMessage title="Aún no tienes reportes" description="Cuando envíes tus primeros tiempos verás aquí el resumen del mes." />
      )}

      <Card aria-labelledby="preferences-title" role="region">
        <CardHeader>
          <CardTitle id="preferences-title">Preferencias</CardTitle>
          <CardDescription>Cómo se ve la aplicación y tu jornada de referencia.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="theme-label" className="text-sm font-medium">
              Tema
            </p>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-labelledby="theme-label"
              value={theme}
              onValueChange={(value) => value && setTheme(value as AppTheme)}
            >
              {themeOptions.map(({ value, label, Icon }) => (
                <ToggleGroupItem key={value} value={value}>
                  <Icon aria-hidden="true" />
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Meta de horas diarias</p>
              <p className="text-xs text-muted-foreground">Definida en Configuración; solo lectura.</p>
            </div>
            <p className="text-sm tabular-nums">
              Lun-jue {formatHours(workSettings.mondayThursdayHours)} h · Vie {formatHours(workSettings.fridayHours)} h
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
