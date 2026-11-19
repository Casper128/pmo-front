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

  it('coincide por correo o nombre normalizados cuando el id no coincide', () => {
    expect(isManagementReportOwnedBy({ idConsultor: 1, correo: 'PERSONA@example.com' }, user)).toBe(
      true,
    );
    expect(isManagementReportOwnedBy({ nombreConsultor: 'Persona Prueba' }, user)).toBe(true);
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
