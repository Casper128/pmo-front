import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { useContainer } from '@presentation/providers/container-context';
import { apiErrorMessage } from '@presentation/shared/error-message';
import { queryKeys } from '@presentation/shared/query-keys';
import { upsertTemplate } from '../drafts/template-rules';

/**
 * Acciones de la página Plantillas que no abre el diálogo de configuración: marcar como pendiente y eliminar
 * (`markSelectedTemplate(false)` y `deleteSelectedTemplate` de Angular). Mantienen la caché `['templates']`.
 */
export function useTemplateActions() {
  const { templates } = useContainer();
  const queryClient = useQueryClient();

  const markPending = useMutation({
    mutationFn: (template: ManagementAdvancedTemplate) => templates.save({ ...template, completed: false }),
    onSuccess: (saved) => {
      queryClient.setQueryData<ManagementAdvancedTemplate[]>(queryKeys.templates.all, (current) => upsertTemplate(current, saved));
      queryClient.setQueryData(queryKeys.templates.detail(saved.gestionId), saved);
      toast.success('Plantilla marcada como pendiente.');
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'No fue posible guardar la plantilla.')),
  });

  const remove = useMutation({
    mutationFn: (template: ManagementAdvancedTemplate) => templates.remove(template.gestionId),
    onSuccess: (_, template) => {
      queryClient.setQueryData<ManagementAdvancedTemplate[]>(queryKeys.templates.all, (current) =>
        (current ?? []).filter((item) => item.gestionId !== template.gestionId),
      );
      queryClient.removeQueries({ queryKey: queryKeys.templates.detail(template.gestionId) });
      toast.success('Plantilla eliminada. Puedes crearla de nuevo con el cliente actualizado.');
    },
    onError: (error) => toast.error(apiErrorMessage(error, 'No fue posible eliminar la plantilla.')),
  });

  return {
    busy: markPending.isPending || remove.isPending,
    deleting: remove.isPending,
    markPending: markPending.mutate,
    /** Resuelve `true` si se eliminó (el diálogo se cierra solo entonces). */
    remove: (template: ManagementAdvancedTemplate) => remove.mutateAsync(template).then(() => true, () => false),
  };
}
