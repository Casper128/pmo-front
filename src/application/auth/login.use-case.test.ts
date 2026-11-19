import { describe, expect, it, vi } from 'vitest';
import type { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import type { AuthUser } from '@domain/auth/auth-user.model';
import type { WorkLocation } from '@domain/audit/work-location.model';
import type { AuthGateway } from './auth.gateway';
import { LOGIN_LOCATION_REQUEST, LoginUseCase } from './login.use-case';

const user: AuthUser = { name: 'Ana Prueba', email: 'consultor@example.test' };
const workLocation: WorkLocation = { latitude: 4.6, longitude: -74.1, accuracy: 10, locationStatus: 'granted' };

function setup(overrides: { login?: () => Promise<AuthUser>; capture?: () => Promise<WorkLocation>; recordLogin?: () => Promise<void> } = {}) {
  const auth = { login: vi.fn(overrides.login ?? (async () => user)), setUser: vi.fn() };
  const location = { capture: vi.fn(overrides.capture ?? (async () => workLocation)) };
  const audit = { recordLogin: vi.fn(overrides.recordLogin ?? (async () => undefined)) };
  const useCase = new LoginUseCase(
    auth as unknown as AuthGateway,
    location as unknown as LocationGateway,
    audit as unknown as UserAuditGateway,
  );
  return { auth, location, audit, useCase };
}

describe('LoginUseCase', () => {
  it('inicia sesión, publica el usuario y audita con la ubicación (opciones de Angular)', async () => {
    const { auth, location, audit, useCase } = setup();

    await expect(useCase.execute('consultor@example.test', 'secreta')).resolves.toBe(user);

    expect(auth.login).toHaveBeenCalledWith('consultor@example.test', 'secreta');
    expect(auth.setUser).toHaveBeenCalledWith(user);
    expect(location.capture).toHaveBeenCalledWith(LOGIN_LOCATION_REQUEST);
    expect(LOGIN_LOCATION_REQUEST).toEqual({ highAccuracy: false, maximumAgeMs: 300000, timeoutMs: 10000 });
    await vi.waitFor(() => expect(audit.recordLogin).toHaveBeenCalledWith(workLocation));
  });

  it('no espera la ubicación para devolver el usuario', async () => {
    const { audit, useCase } = setup({ capture: () => new Promise<WorkLocation>(() => undefined) });
    await expect(useCase.execute('a@b.test', 'x')).resolves.toBe(user);
    expect(audit.recordLogin).not.toHaveBeenCalled();
  });

  it.each([
    ['la captura', { capture: () => Promise.reject(new Error('sin permiso')) }],
    ['la auditoría', { recordLogin: () => Promise.reject(new Error('caída')) }],
  ])('un fallo de %s se ignora', async (_name, overrides) => {
    const { useCase } = setup(overrides);
    await expect(useCase.execute('a@b.test', 'x')).resolves.toBe(user);
  });

  it('si el login falla propaga el error y no publica usuario ni audita', async () => {
    const error = new Error('Credenciales incorrectas');
    const { auth, location, useCase } = setup({ login: () => Promise.reject(error) });
    await expect(useCase.execute('a@b.test', 'x')).rejects.toBe(error);
    expect(auth.setUser).not.toHaveBeenCalled();
    expect(location.capture).not.toHaveBeenCalled();
  });
});
