import { AuthGateway } from '@application/auth/auth.gateway';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { SendAllRecordsUseCase } from '@application/time-records/use-cases/send-all-records.use-case';
import { FakeAuthGateway } from '@/test/fakes/fake-auth';
import { testEnvironment } from '@/test/http';
import { createContainer } from './container';

describe('createContainer', () => {
  afterEach(() => localStorage.clear());

  it('crea el grafo completo de puertos y casos de uso sin llamar a la red', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const container = createContainer(testEnvironment);

    expect(container.environment).toBe(testEnvironment);
    expect(container.auth).toBeInstanceOf(AuthGateway);
    expect(container.parameters).toBeInstanceOf(AppParametersFacade);
    expect(container.sendAllRecords).toBeInstanceOf(SendAllRecordsUseCase);
    for (const value of Object.values(container)) expect(value).toBeTruthy();
    // Sin token, AppParametersService no sincroniza con Supabase al construirse.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('usa los overrides y los inyecta en las dependencias', () => {
    const auth = new FakeAuthGateway();
    const container = createContainer(testEnvironment, { auth });

    expect(container.auth).toBe(auth);
    expect(container.parameters.canManage()).toBe(false);
    auth.setUser({ name: 'Admin', email: 'admin@example.test' });
    expect(container.parameters.canManage()).toBe(true);
  });
});
