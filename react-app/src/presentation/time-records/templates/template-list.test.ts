import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { completeTemplate } from '@/test/fakes/drafts-fixtures';
import { filterTemplates, templateClients, type TemplateFilters } from './template-list';

const all: TemplateFilters = { search: '', client: '', status: 'all', sort: 'name' };
const pending = (id: string, name: string, client: string): ManagementAdvancedTemplate => ({ gestionId: id, gestionName: name, client, values: {}, completed: false });

const templates = [
  { ...completeTemplate('G-2', 'Soporte Ñandú', 'Cliente Beta'), updatedAt: '2026-05-01' },
  { ...completeTemplate('G-10', 'Alfa', 'Cliente Alfa'), updatedAt: '2026-03-01' },
  pending('A-3', 'Zeta', 'Cliente Alfa'),
];
const ids = (list: ManagementAdvancedTemplate[]) => list.map((item) => item.gestionId);

describe('filterTemplates', () => {
  it('filtra por estado y cliente', () => {
    expect(ids(filterTemplates(templates, { ...all, status: 'incomplete' }))).toEqual(['A-3']);
    expect(ids(filterTemplates(templates, { ...all, status: 'complete', client: 'Cliente Alfa' }))).toEqual(['G-10']);
  });

  it('busca sin tildes ni mayúsculas en nombre, id, cliente y valores', () => {
    expect(ids(filterTemplates(templates, { ...all, search: 'nandu' }))).toEqual(['G-2']);
    expect(ids(filterTemplates(templates, { ...all, search: 'a-3' }))).toEqual(['A-3']);
    expect(ids(filterTemplates(templates, { ...all, search: 'funcional de prueba' }))).toEqual(['G-10', 'G-2']);
  });

  it('ordena por nombre, por id y por actualización reciente', () => {
    expect(ids(filterTemplates(templates, all))).toEqual(['G-10', 'G-2', 'A-3']);
    expect(ids(filterTemplates(templates, { ...all, sort: 'id' }))).toEqual(['A-3', 'G-10', 'G-2']);
    expect(ids(filterTemplates(templates, { ...all, sort: 'recent' }))).toEqual(['G-2', 'G-10', 'A-3']);
  });

  it('no modifica la lista original', () => {
    const before = ids(templates);
    filterTemplates(templates, { ...all, sort: 'name' });
    expect(ids(templates)).toEqual(before);
  });
});

describe('templateClients', () => {
  it('devuelve clientes únicos ordenados y sin vacíos', () => {
    expect(templateClients([...templates, pending('G-4', 'X', '')])).toEqual(['Cliente Alfa', 'Cliente Beta']);
  });
});
