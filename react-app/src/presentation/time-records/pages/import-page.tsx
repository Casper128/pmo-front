import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { PageHeader } from '@presentation/shared/components/page-header';
import { StateMessage } from '@presentation/shared/components/state-message';
import { EditRecordDialog } from '../components/edit-record-dialog';
import { ImportTextInput } from '../components/import-text-input';
import { ManagementTemplateDialog } from '../components/management-template-dialog';
import { RecordsPreviewTable } from '../components/records-preview-table';
import { SendConfirmDialog } from '../components/send-confirm-dialog';
import { SendProgressDialog } from '../components/send-progress-dialog';
import {
  DEFAULT_ALERT_TITLE,
  ValidationAlertDialog,
  type ValidationAlert,
} from '../components/validation-alert-dialog';
import { useDrafts } from '../drafts/drafts-context';
import { useManagementTemplates } from '../hooks/use-management-templates';
import { useDefaultSelection } from '../hooks/use-select-options';

interface EditingRecord {
  readonly index: number;
  readonly record: TimeRecord;
}

/**
 * Reportar y revisar tiempos (vista `import` de `MultipleImportPageComponent`): pegar texto, revisar los
 * borradores del shell, editarlos, configurar la plantilla obligatoria de cada gestión y registrarlos todos.
 */
export function ImportPage() {
  const drafts = useDrafts();
  const { updateRecord, saveEdit, deleteRecord, duplicateRecord, clearRecords, sendAll } = drafts;
  const { defaultProyecto, solicitudOptions } = useDefaultSelection();
  const [alert, setAlert] = useState<ValidationAlert | null>(null);
  const [editing, setEditing] = useState<EditingRecord | null>(null);
  const [excessConfirm, setExcessConfirm] = useState<ValidationAlert | null>(null);

  const showError = useCallback((text: string, title = DEFAULT_ALERT_TITLE) => setAlert({ title, text }), []);
  const templates = useManagementTemplates({ defaultProyecto, onError: showError });
  const { ensureForOption, openEdit: openTemplateEdit } = templates;

  // Los cambios automáticos (selección de gestión tras cargar opciones) llegan de forma asíncrona: leen la
  // selección por defecto y la función vigentes, no las del render en que se programaron.
  const latest = useRef<{ solicitudOptions?: ManagementDemandOption[]; ensure: typeof ensureForOption }>({
    ensure: ensureForOption,
  });
  useEffect(() => {
    latest.current = { solicitudOptions, ensure: ensureForOption };
  }, [solicitudOptions, ensureForOption]);

  /**
   * `onPreviewRecordChange`: actualiza el borrador y, si la gestión elegida está entre las de la selección por
   * defecto, asegura su plantilla (igual que Angular, que solo mira las gestiones del cliente por defecto).
   */
  const handleRecordChange = useCallback(
    (index: number, change: (current: TimeRecord) => TimeRecord) => {
      const updated = updateRecord(index, change);
      if (updated) {
        const option = latest.current.solicitudOptions?.find((item) => item.id === updated.gestionId);
        if (option) void latest.current.ensure(option);
      }
      return updated;
    },
    [updateRecord],
  );

  const openEdit = useCallback(
    (index: number) => {
      const record = drafts.records[index];
      if (record) setEditing({ index, record: { ...record } });
    },
    [drafts.records],
  );

  const handleDuplicate = useCallback(
    (index: number) => {
      const copy = duplicateRecord(index);
      if (!copy) return;
      setEditing({ index: copy.index, record: { ...copy.record } });
      toast.success('Registro duplicado en borradores.');
    },
    [duplicateRecord],
  );

  const handleDelete = useCallback(
    (index: number) => {
      // Igual que Angular: al eliminar el último borrador se avisa "No hay registros".
      if (deleteRecord(index) === 0) showError('No hay registros');
    },
    [deleteRecord, showError],
  );

  /** `onSendAll`: el provider valida y envía; aquí se muestra lo que detiene el envío. */
  const handleSendAll = useCallback(
    async (confirmExcess = false) => {
      const outcome = await sendAll({ confirmExcess });
      if (outcome.status === 'blocked') {
        showError(outcome.text, outcome.title);
      } else if (outcome.status === 'template') {
        if (outcome.template) openTemplateEdit(outcome.template);
        else void ensureForOption(outcome.option);
        toast.error(outcome.text);
      } else if (outcome.status === 'confirm') {
        setExcessConfirm({ title: outcome.title, text: outcome.text });
      }
    },
    [sendAll, showError, openTemplateEdit, ensureForOption],
  );

  const handleSaveEdit = (edited: TimeRecord) => {
    if (!editing) return;
    const result = saveEdit(editing.index, edited);
    if (result.status === 'invalid') {
      showError(`No se puede guardar el registro: ${result.errors.join(', ')}`);
    } else if (result.status === 'saved') {
      setEditing(null);
      toast.success('Registro actualizado');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Tiempos"
        title="Reportar y revisar tiempos"
        description="Pega tus actividades, completa lo pendiente y registra con confianza."
      />

      <ImportTextInput />

      <div className="min-w-0">
        {drafts.records.length > 0 ? (
          <RecordsPreviewTable
            onRecordChange={handleRecordChange}
            onEditRecord={openEdit}
            onDuplicateRecord={handleDuplicate}
            onDeleteRecord={handleDelete}
            onSendAll={() => void handleSendAll()}
            onCancelImport={clearRecords}
          />
        ) : (
          <StateMessage
            className="min-h-[18rem]"
            title="Pega y procesa tus tiempos"
            description="La vista previa aparecerá aquí para completar y registrar tus actividades."
          />
        )}
      </div>

      <EditRecordDialog record={editing?.record ?? null} onSave={handleSaveEdit} onCancel={() => setEditing(null)} />
      <ManagementTemplateDialog
        template={templates.dialog}
        mode={templates.dialogMode}
        saving={templates.saving}
        onSave={templates.save}
        onInvalid={(missing) => showError(`Faltan campos obligatorios: ${missing.join(', ')}.`)}
        onClose={templates.closeDialog}
      />
      <ValidationAlertDialog alert={alert} onClose={() => setAlert(null)} />
      <SendConfirmDialog
        confirm={excessConfirm}
        onCancel={() => setExcessConfirm(null)}
        onConfirm={() => {
          setExcessConfirm(null);
          void handleSendAll(true);
        }}
      />
      <SendProgressDialog />
    </div>
  );
}
