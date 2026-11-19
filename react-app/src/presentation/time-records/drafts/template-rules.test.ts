import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { applyTemplateValues } from '@application/time-records/template-values';
import { completeTemplate, createFakeRepository, createFakeTemplates, makeDraft } from '@/test/fakes/drafts-fixtures';
import { createTestContainer } from '@/test/fakes/test-container';
import {
  buildManagementTemplateMap,
  defaultTemplateValues,
  mergeManagementTemplate,
  missingRequiredTemplateFields,
  payloadFields,
  templateForManagement,
  upsertTemplate,
  withManagementControlData,
} from './template-rules';

const template = completeTemplate('G-1', 'Gestión Uno');

describe('plantilla obligatoria por gestión (funciones puras)', () => {
  it('encuentra la plantilla por id, nombre o nombre normalizado', () => {
    const map = buildManagementTemplateMap([template]);
    expect(templateForManagement({ id: 'G-1', name: 'otro' }, map)).toBe(template);
    expect(templateForManagement({ id: 'x', name: 'Gestión Uno' }, map)).toBe(template);
    expect(templateForManagement({ id: 'x', name: '  GESTION   uno ' }, map)).toBe(template);
    expect(templateForManagement({ id: 'G-2', name: 'Gestión Dos' }, map)).toBeNull();
  });

  it('mergeManagementTemplate no muta el mapa original', () => {
    const empty = new Map<string, ManagementAdvancedTemplate>();
    expect(mergeManagementTemplate(empty, template).size).toBeGreaterThan(0);
    expect(empty.size).toBe(0);
  });

  it('missingRequiredTemplateFields lista las etiquetas vacías o N/A', () => {
    expect(missingRequiredTemplateFields(template)).toEqual([]);
    const incomplete = { ...template, values: { ...template.values, funcional: '', causa: 'N/A', lenguaje: 'Sin valor' } };
    expect(missingRequiredTemplateFields(incomplete)).toEqual(['Funcional', 'Causa', 'Lenguaje']);
  });

  it('defaultTemplateValues usa el proyecto de la gestión o el por defecto y los valores configurados', () => {
    const defaults: Record<string, string> = { causa: 'Error', categoria: 'Proyecto' };
    const values = defaultTemplateValues({ id: 'G-1', name: 'Uno', project: 'Proyecto A' }, 'Proyecto X', (key) => defaults[key] ?? '');
    expect(values).toMatchObject({ proyecto: 'Proyecto A', funcional: '', causa: 'Error', categoria: 'Proyecto', lenguaje: '' });
    expect(defaultTemplateValues({ id: 'G-1', name: 'Uno' }, 'Proyecto X', () => '').proyecto).toBe('Proyecto X');
  });

  it('withManagementControlData completa cliente y proyecto solo cuando faltan', () => {
    const bare = { ...template, client: undefined, project: undefined };
    const completed = withManagementControlData(bare, { id: 'G-1', name: 'Uno', client: 'Cliente Alfa', project: 'Proyecto A' });
    expect(completed).not.toBe(bare);
    expect(completed).toMatchObject({ client: 'Cliente Alfa', project: 'Proyecto A' });
    expect(withManagementControlData(template, { id: 'G-1', name: 'Uno', client: 'Otro', project: 'Otro' })).toBe(template);
  });

  it('upsertTemplate reemplaza por gestionId o agrega', () => {
    const updated = { ...template, gestionName: 'Renombrada' };
    expect(upsertTemplate([template], updated)).toEqual([updated]);
    expect(upsertTemplate(undefined, template)).toEqual([template]);
    expect(upsertTemplate([template], completeTemplate('G-2', 'Dos'))).toHaveLength(2);
  });

  it('payloadFields rellena "Sin valor"', () => {
    const fields = payloadFields({ ricef: '', proyecto: 'P', fechaEstimadaPruebas: null } as never);
    expect(fields.find((f) => f.label === 'RICEF')?.value).toBe('Sin valor');
    expect(fields.find((f) => f.label === 'Proyecto')?.value).toBe('P');
  });
});

describe('paridad entre vista previa y envío', () => {
  it('el payload mostrado por el diálogo es el que recibe repository.register', async () => {
    const repository = createFakeRepository();
    repository.register.mockResolvedValue({ status: 200 });
    const stored = { ...template, values: { ...template.values, funcional: 'De plantilla', ricef: 'R-T' } };
    const container = createTestContainer({
      timeRecordRepository: repository,
      templates: createFakeTemplates([stored]),
    });
    const record = makeDraft({ funcional: 'Propio', ricef: '' });

    const previewed = container.apiBodyBuilder.build(applyTemplateValues(record, stored.values));
    await container.registerTimeRecord.execute(record);

    expect(repository.register).toHaveBeenCalledWith(previewed);
    expect(payloadFields(previewed).find((f) => f.label === 'Funcional')?.value).toBe('Propio');
    expect(payloadFields(previewed).find((f) => f.label === 'RICEF')?.value).toBe('R-T');
  });
});
