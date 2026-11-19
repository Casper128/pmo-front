import { AuthUser } from '../../auth/auth-user.model';
import { isManagementReportOwnedBy } from './management-report-ownership.policy';

const user: AuthUser = { id: 84, name: 'Persona Prueba', email: 'persona@example.com' };

describe('isManagementReportOwnedBy', () => {
  it('rechaza cuando no hay usuario', () => {
    expect(isManagementReportOwnedBy({ idConsultor: 84 }, null)).toBe(false);
  });

  it('coincide por id directo o anidado', () => {
    expect(isManagementReportOwnedBy({ idConsultor: '84' }, user)).toBe(true);
    expect(isManagementReportOwnedBy({ detalle: { idConsultor: 84 } }, user)).toBe(true);
  });

  it('coincide por id del usuario crudo', () => {
    const rawUser: AuthUser = { ...user, id: undefined, raw: { idUsuario: 7 } };
    expect(isManagementReportOwnedBy({ idUsuario: 7 }, rawUser)).toBe(true);
  });

  it('con ids distintos acepta solo si el correo o usuario coincide exactamente', () => {
    expect(isManagementReportOwnedBy({ idConsultor: 1, correo: 'PERSONA@example.com' }, user)).toBe(
      true,
    );
    expect(isManagementReportOwnedBy({ idConsultor: 1, correo: 'otra@example.com' }, user)).toBe(
      false,
    );
    expect(isManagementReportOwnedBy({ idConsultor: 1 }, user)).toBe(false);
  });

  it('sin id en el usuario o en el reporte exige igualdad exacta de correo o usuario', () => {
    const withoutId: AuthUser = { ...user, id: undefined };
    expect(isManagementReportOwnedBy({ correo: 'PERSONA@example.com' }, withoutId)).toBe(true);
    expect(isManagementReportOwnedBy({ usuario_tiemposConsultores: { email: 'persona@example.com' } }, withoutId)).toBe(true);
    expect(isManagementReportOwnedBy({ correo: 'persona@example.com' }, user)).toBe(true);
    expect(isManagementReportOwnedBy({ idConsultor: 1 }, withoutId)).toBe(false);
  });

  it('no usa subcadenas como identidad', () => {
    expect(isManagementReportOwnedBy({ correo: 'otra.persona@example.com' }, user)).toBe(false);
    expect(isManagementReportOwnedBy({ correo: 'persona@example.com.co' }, user)).toBe(false);
    expect(isManagementReportOwnedBy({ nombreConsultor: 'Persona Prueba Segundo' }, user)).toBe(false);
  });

  it('sin id ni correo compara el nombre del consultor por igualdad exacta', () => {
    expect(isManagementReportOwnedBy({ nombreConsultor: 'persona prueba' }, user)).toBe(true);
    expect(isManagementReportOwnedBy({ consultor: 'Otra Persona' }, user)).toBe(false);
  });

  it('funcional no es identidad', () => {
    expect(isManagementReportOwnedBy({ idConsultor: 1, funcional: 'persona@example.com' }, user)).toBe(false);
    expect(isManagementReportOwnedBy({ funcional: 'Otra Persona' }, user)).toBe(true);
  });

  it('rechaza registros de otra persona', () => {
    expect(
      isManagementReportOwnedBy({ idConsultor: 1, nombreConsultor: 'Otra Persona' }, user),
    ).toBe(false);
  });

  it('acepta registros sin datos de identidad', () => {
    expect(isManagementReportOwnedBy({ tiempoRealHoras: '1' }, user)).toBe(true);
  });
});
