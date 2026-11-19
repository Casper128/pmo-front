import { FakeAppParameters } from '@/test/fakes/fake-app-parameters';
import { canReviewDeleteRequests, isLocationAdmin, userInitials } from './permissions';
import { NAV_SECTIONS, visibleNavSections } from './nav-items';

describe('permisos del shell', () => {
  const user = { name: 'Ana Prueba', email: 'consultor@example.test' };

  it('canReviewDeleteRequests sigue la lógica de Angular', () => {
    const parameters = new FakeAppParameters({
      deletionSettings: { auditorEmail: 'Auditor@Example.test', technicalDeleteEmails: ['tecnico@example.test'] },
    });
    expect(canReviewDeleteRequests(user, parameters)).toBe(false);
    expect(canReviewDeleteRequests(null, parameters)).toBe(false);
    expect(canReviewDeleteRequests({ ...user, email: ' auditor@example.test ' }, parameters)).toBe(true);
    expect(canReviewDeleteRequests({ ...user, username: 'AUDITOR@example.test' }, parameters)).toBe(true);
    expect(canReviewDeleteRequests({ ...user, email: 'tecnico@example.test' }, parameters)).toBe(true);
    expect(canReviewDeleteRequests({ ...user, role: 'ADMIN' }, parameters)).toBe(true);
    expect(canReviewDeleteRequests({ ...user, role: 'administrador' }, parameters)).toBe(false);
    expect(canReviewDeleteRequests({ ...user, role: 'Auditor externo' }, parameters)).toBe(true);
    parameters.set({ canManage: true });
    expect(canReviewDeleteRequests(user, parameters)).toBe(true);
  });

  it('sin auditor configurado no concede acceso por identidad vacía', () => {
    const parameters = new FakeAppParameters({ deletionSettings: { auditorEmail: '', technicalDeleteEmails: [] } });
    expect(canReviewDeleteRequests({ name: 'x', email: '' }, parameters)).toBe(false);
  });

  it('isLocationAdmin compara el email normalizado con la lista del entorno', () => {
    expect(isLocationAdmin({ name: 'x', email: ' Admin@Example.test' }, ['admin@example.test'])).toBe(true);
    expect(isLocationAdmin(user, ['admin@example.test'])).toBe(false);
    expect(isLocationAdmin(null, [])).toBe(false);
  });

  it('userInitials usa nombre, email o PMO', () => {
    expect(userInitials(user)).toBe('AP');
    expect(userInitials({ name: '', email: 'consultor@example.test' })).toBe('C');
    // Igual que Angular: 'PMO' es una sola palabra.
    expect(userInitials(null)).toBe('P');
  });

  it('visibleNavSections filtra adminOnly/auditOnly y omite secciones vacías', () => {
    const labels = (canManage: boolean, canReview: boolean) =>
      visibleNavSections(NAV_SECTIONS, { canManage, canReview }).map((section) => [
        section.label,
        section.items.map((item) => item.label),
      ]);
    expect(labels(false, false)).toEqual([
      ['Trabajo', ['Reportar', 'Consolidado', 'Reportes']],
      ['Análisis', ['Dashboard', 'Datos']],
      ['Preferencias', ['Plantillas']],
    ]);
    expect(labels(false, true).at(-1)).toEqual(['Administración', ['Auditoría']]);
    expect(labels(true, true).at(-1)).toEqual(['Administración', ['Auditoría', 'Configuración']]);
  });
});
