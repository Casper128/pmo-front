import { zodResolver } from '@hookform/resolvers/zod';
import { Info, Loader2, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { AdvancedFieldsSection } from '@presentation/configuration/advanced-fields-section';
import { configurationSchema, toFormValues, toParameters, type ConfigurationFormValues } from '@presentation/configuration/configuration-form';
import { WorkRulesSection } from '@presentation/configuration/work-rules-section';
import { useContainer } from '@presentation/providers/container-context';
import { ConfirmDialog } from '@presentation/shared/components/confirm-dialog';
import { PageHeader } from '@presentation/shared/components/page-header';
import { errorMessage } from '@presentation/shared/error-message';
import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';

const pageClassName = 'mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8';

function ConfigurationEditor() {
  const { parameters } = useContainer();
  const canManage = useAppParameters((p) => p.canManage());
  const saving = useAppParameters((p) => p.saving());
  const source = useAppParameters((p) => p.source());
  const configured = useAppParameters((p) => p.configured());
  const [restoring, setRestoring] = useState(false);
  const form = useForm<ConfigurationFormValues>({
    resolver: zodResolver(configurationSchema),
    defaultValues: toFormValues(parameters.fields(), parameters.workSettings()),
  });
  const syncFromParameters = () => form.reset(toFormValues(parameters.fields(), parameters.workSettings()));

  const submit = form.handleSubmit(
    async (values) => {
      const { fields, settings } = toParameters(values);
      try {
        await parameters.save(fields, settings, parameters.deletionSettings());
        syncFromParameters();
        toast.success(parameters.source() === 'supabase' ? 'Configuración global guardada.' : 'Configuración global guardada localmente.');
      } catch (error) {
        toast.error(errorMessage(error) || 'No fue posible guardar la configuración.');
      }
    },
    () => toast.error('Revisa los campos marcados antes de guardar.'),
  );

  const restoreDefaults = () => {
    parameters.resetLocal();
    syncFromParameters();
    setRestoring(false);
    toast.success('Se restauraron los valores originales. Pulsa “Guardar configuración global” para conservarlos.');
  };

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Configuración global de tiempos"
        description="Administra listas, valores predeterminados y reglas operativas usadas por todos los consultores."
        meta={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{source === 'supabase' ? 'Sincronizado' : 'Respaldo local'}</Badge>
            <Badge variant="outline">{configured ? 'Configuración disponible' : 'Sin sincronización externa'}</Badge>
            {canManage ? <Badge variant="secondary">Administrador · jornada editable</Badge> : null}
          </div>
        }
      />
      {!canManage ? (
        <Alert role="status">
          <Info aria-hidden="true" />
          <AlertTitle>Configuración global de solo lectura</AlertTitle>
          <AlertDescription>Solo el administrador puede modificar listas globales. Tus plantillas por gestión viven en Mis plantillas.</AlertDescription>
        </Alert>
      ) : null}
      <FormProvider {...form}>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <WorkRulesSection disabled={!canManage} />
          <AdvancedFieldsSection disabled={!canManage} />
          {canManage ? (
            <div className="flex flex-wrap justify-end gap-2 sm:sticky sm:bottom-0 sm:rounded-lg sm:border sm:bg-background/95 sm:p-3 sm:backdrop-blur">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setRestoring(true)}>
                <RotateCcw aria-hidden="true" /> Restaurar originales
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                {saving ? 'Guardando...' : 'Guardar configuración global'}
              </Button>
            </div>
          ) : null}
        </form>
      </FormProvider>
      <ConfirmDialog
        open={restoring}
        title="Restaurar valores originales"
        description="Se reemplazarán la jornada, los límites y las listas por los valores originales. Revisa los cambios antes de guardar la configuración global."
        confirmLabel="Restaurar originales"
        onConfirm={restoreDefaults}
        onClose={() => setRestoring(false)}
      />
    </>
  );
}

/** Configuración global de tiempos (F14): jornada, límites y listas de campos avanzados. Solo administradores. */
export function ConfigurationPage() {
  const loading = useAppParameters((p) => p.loading());
  return (
    <div className={pageClassName}>
      {loading ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Cargando configuración...">
          <Skeleton className="h-16 w-full max-w-xl" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <ConfigurationEditor />
      )}
    </div>
  );
}
