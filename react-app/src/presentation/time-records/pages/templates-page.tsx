import { CircleCheck, Clock, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { AppSelect } from '@presentation/shared/components/app-select';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { PageHeader } from '@presentation/shared/components/page-header';
import { SearchInput } from '@presentation/shared/components/search-input';
import { StateMessage } from '@presentation/shared/components/state-message';
import { apiErrorMessage } from '@presentation/shared/error-message';
import { ManagementTemplateDialog } from '../components/management-template-dialog';
import { useManagementTemplates } from '../hooks/use-management-templates';
import { TemplateDeleteDialog } from '../templates/template-delete-dialog';
import {
  TEMPLATE_SORT_OPTIONS,
  filterTemplates,
  isComplete,
  templateClients,
  type TemplateSort,
  type TemplateStatusFilter,
} from '../templates/template-list';
import { useTemplateActions } from '../templates/use-template-actions';

const STATUS_FILTERS: readonly { value: TemplateStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'complete', label: 'Configuradas' },
  { value: 'incomplete', label: 'Pendientes' },
];

interface TemplateCardProps {
  readonly template: ManagementAdvancedTemplate;
  readonly busy: boolean;
  readonly onEdit: (template: ManagementAdvancedTemplate) => void;
  readonly onMarkPending: (template: ManagementAdvancedTemplate) => void;
  readonly onDelete: (template: ManagementAdvancedTemplate) => void;
}

function TemplateCard({ template, busy, onEdit, onMarkPending, onDelete }: TemplateCardProps) {
  const complete = isComplete(template);
  const project = String(template.values.proyecto || '').trim();
  return (
    <Card role="article" aria-label={`Plantilla ${template.gestionName}`} size="sm">
      <CardHeader>
        <CardTitle className="min-w-0 break-words">{template.gestionName}</CardTitle>
        <CardDescription>ID {template.gestionId}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        <Badge variant={complete ? 'default' : 'secondary'}>
          {complete ? <CircleCheck aria-hidden="true" /> : <Clock aria-hidden="true" />}
          {complete ? 'Configurada' : 'Pendiente'}
        </Badge>
        {project ? (
          <Badge variant="outline" className="max-w-full">
            <OverflowText>{project}</OverflowText>
          </Badge>
        ) : null}
        {template.client ? (
          <Badge variant="outline" className="max-w-full">
            <OverflowText>{template.client}</OverflowText>
          </Badge>
        ) : null}
      </CardContent>
      <CardFooter className="mt-auto justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onEdit(template)}>
          <Pencil aria-hidden="true" /> {complete ? 'Editar' : 'Configurar'}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" aria-label={`Más acciones de ${template.gestionName}`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {complete ? (
              <>
                <DropdownMenuItem disabled={busy} onSelect={() => onMarkPending(template)}>
                  <RotateCcw aria-hidden="true" /> Marcar como pendiente
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem variant="destructive" disabled={busy} onSelect={() => onDelete(template)}>
              <Trash2 aria-hidden="true" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
}

/** Mis plantillas por gestión (F12): administra los campos avanzados que se aplican al registrar o editar tiempos. */
export function TemplatesPage() {
  const manager = useManagementTemplates({
    defaultProyecto: '',
    onError: (text) => toast.error(text),
  });
  const actions = useTemplateActions();
  const { list } = manager;
  const [search, setSearch] = useState('');
  const [client, setClient] = useState('');
  const [status, setStatus] = useState<TemplateStatusFilter>('all');
  const [sort, setSort] = useState<TemplateSort>('recent');
  const [deleteTarget, setDeleteTarget] = useState<ManagementAdvancedTemplate | null>(null);

  const all = useMemo(() => list.data ?? [], [list.data]);
  const visible = useMemo(() => filterTemplates(all, { search, client, status, sort }), [all, search, client, status, sort]);
  const clientOptions = useMemo(
    () => [{ value: '', label: 'Todos los clientes' }, ...templateClients(all).map((value) => ({ value, label: value }))],
    [all],
  );
  const completeCount = all.filter(isComplete).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        eyebrow="Preferencias"
        title="Mis plantillas por gestión"
        description="Configura los campos avanzados que se aplican automáticamente al registrar o editar tiempos."
        meta={
          <div className="flex flex-wrap gap-2" aria-live="polite">
            <Badge variant="secondary">{all.length} plantillas</Badge>
            <Badge variant="secondary">{completeCount} configuradas</Badge>
          </div>
        }
      />

      <section aria-label="Filtros de plantillas" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_auto_14rem]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="templates-search">Buscar gestión</Label>
          <SearchInput id="templates-search" value={search} onChange={setSearch} placeholder="Nombre, ID, proyecto, funcional..." />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="templates-client">Cliente</Label>
          <AppSelect id="templates-client" options={clientOptions} value={client} onValueChange={setClient} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label id="templates-status-label">Estado</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="templates-status-label"
            className="w-full"
            value={status}
            onValueChange={(value) => value && setStatus(value as TemplateStatusFilter)}
          >
            {STATUS_FILTERS.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value} className="h-9 max-sm:grow">
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="templates-sort">Ordenar</Label>
          <AppSelect id="templates-sort" options={TEMPLATE_SORT_OPTIONS} value={sort} onValueChange={(value) => setSort(value as TemplateSort)} searchable={false} />
        </div>
      </section>

      {list.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Cargando plantillas...">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : list.isError ? (
        <StateMessage
          tone="error"
          title="No fue posible cargar tus plantillas"
          description={apiErrorMessage(list.error, 'No fue posible cargar tus plantillas.')}
          actionLabel="Reintentar"
          onAction={() => void list.refetch()}
        />
      ) : !visible.length ? (
        <StateMessage
          tone="warning"
          title={all.length ? 'No encontramos plantillas con esos filtros' : 'Aún no tienes plantillas por gestión'}
          description={
            all.length
              ? 'Ajusta la búsqueda, cambia el estado o vuelve a cargar la lista para confirmar si hay datos nuevos.'
              : 'Las plantillas se crean cuando seleccionas una gestión sin configuración al registrar o editar tiempos.'
          }
          actionLabel="Recargar plantillas"
          onAction={() => void list.refetch()}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((template) => (
            <TemplateCard
              key={template.gestionId}
              template={template}
              busy={actions.busy || manager.saving}
              onEdit={manager.openEdit}
              onMarkPending={actions.markPending}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ManagementTemplateDialog
        template={manager.dialog}
        mode={manager.dialogMode}
        saving={manager.saving}
        onSave={manager.save}
        onInvalid={(missing) => toast.error(`Llena los campos obligatorios antes de guardar la plantilla: ${missing.join(', ')}.`)}
        onClose={manager.closeDialog}
      />
      <TemplateDeleteDialog
        template={deleteTarget}
        deleting={actions.deleting}
        onConfirm={(template) => void actions.remove(template).then((removed) => removed && setDeleteTarget(null))}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
