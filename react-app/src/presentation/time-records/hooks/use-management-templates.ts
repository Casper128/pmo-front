import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  ManagementAdvancedTemplate,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';
import { useContainer } from '@presentation/providers/container-context';
import { queryKeys } from '@presentation/shared/query-keys';
import {
  buildManagementTemplateMap,
  defaultTemplateValues,
  templateForManagement,
  upsertTemplate,
  withManagementControlData,
} from '../drafts/template-rules';

const errorMessage = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';

export interface UseManagementTemplatesOptions {
  /** Proyecto del cliente por defecto: valor inicial del proyecto en una plantilla nueva. */
  readonly defaultProyecto: string;
  /** Muestra un error de validación al usuario (AlertDialog de la página). */
  readonly onError: (text: string) => void;
}

/**
 * Plantilla de campos avanzados obligatoria por gestión (`ensureManagementTemplate`, `saveTemplateDialog` y
 * `loadManagementTemplates` de Angular). La lista vive en TanStack Query (`['templates']`); el diálogo de
 * configuración es estado de la página, como en Angular.
 */
export function useManagementTemplates({ defaultProyecto, onError }: UseManagementTemplatesOptions) {
  const { templates, parameters } = useContainer();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<ManagementAdvancedTemplate | null>(null);
  // Referencia síncrona: dos selecciones seguidas no deben abrir dos diálogos.
  const dialogOpenRef = useRef(false);

  // Carga la lista al montar (`loadManagementTemplates`); `ensureForOption` la lee de la caché.
  useQuery({ queryKey: queryKeys.templates.all, queryFn: () => templates.list() });

  const storeTemplate = useCallback(
    (template: ManagementAdvancedTemplate) => {
      queryClient.setQueryData<ManagementAdvancedTemplate[]>(queryKeys.templates.all, (current) =>
        upsertTemplate(current, template),
      );
      // La vista previa del modal de edición lee la plantilla por gestión.
      queryClient.setQueryData(queryKeys.templates.detail(template.gestionId), template);
    },
    [queryClient],
  );

  const openDialog = useCallback((template: ManagementAdvancedTemplate | null) => {
    dialogOpenRef.current = !!template;
    setDialog(template);
  }, []);

  /** Registra la gestión y, si no tiene plantilla, la trae o abre el diálogo para configurarla. */
  const ensureForOption = useCallback(
    async (option: ManagementDemandOption) => {
      templates.registerKnownManagement(option);
      const known = queryClient.getQueryData<ManagementAdvancedTemplate[]>(queryKeys.templates.all);
      if (
        !option.id ||
        dialogOpenRef.current ||
        templateForManagement(option, buildManagementTemplateMap(known ?? []))
      ) {
        return;
      }
      try {
        const template = await templates.get(option.id);
        if (template) {
          const withControlData = withManagementControlData(template, option);
          storeTemplate(withControlData);
          if (withControlData !== template) void templates.save(withControlData).catch(() => undefined);
          return;
        }
        if (dialogOpenRef.current) return;
        openDialog({
          gestionId: option.id,
          gestionName: option.name,
          client: option.client,
          project: option.project,
          values: defaultTemplateValues(option, defaultProyecto, (key) => parameters.defaultFor(key)),
          completed: false,
        });
      } catch {
        // Igual que Angular: si no se puede consultar la plantilla no se interrumpe la edición;
        // el envío (F8) vuelve a exigirla.
      }
    },
    [templates, queryClient, storeTemplate, openDialog, defaultProyecto, parameters],
  );

  const saveMutation = useMutation({
    mutationFn: (template: ManagementAdvancedTemplate) => templates.save(template),
    onSuccess: (saved) => {
      storeTemplate(saved);
      openDialog(null);
      toast.success('Configuración avanzada guardada para la gestión.');
    },
    onError: (error) =>
      onError(`No se pudo guardar la configuración: ${errorMessage(error) || 'intenta nuevamente'}`),
  });

  const saving = saveMutation.isPending;
  const { mutate } = saveMutation;

  const save = useCallback(
    (template: ManagementAdvancedTemplate) => {
      if (!template.gestionId) return;
      mutate({ ...template, values: { ...template.values }, completed: true });
    },
    [mutate],
  );

  const closeDialog = useCallback(() => {
    if (saving) return;
    openDialog(null);
  }, [saving, openDialog]);

  return { dialog, saving, ensureForOption, save, closeDialog };
}
