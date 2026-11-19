import { act, screen } from '@testing-library/react';
import { FakeAppParameters, type FakeParametersState } from '@/test/fakes/fake-app-parameters';
import { FakeAuthGateway, testUser } from '@/test/fakes/fake-auth';
import { renderApp } from '@/test/fakes/render-app';
import { createTestContainer } from '@/test/fakes/test-container';

function setup(path: string, { user = testUser, parameters = {} as Partial<FakeParametersState> } = {}) {
  const auth = new FakeAuthGateway({ user });
  const fakeParameters = new FakeAppParameters(parameters, auth);
  const view = renderApp(createTestContainer({ auth, parameters: fakeParameters }), path);
  return { ...view, auth, parameters: fakeParameters };
}

const dashboard = () => screen.findByRole('heading', { name: 'Dashboard de tiempos' });

describe('guards de ruta', () => {
  afterEach(() => localStorage.clear());

  describe('RequireAdmin (/configuracion)', () => {
    it('redirige al dashboard con replace si no puede administrar', async () => {
      const { router } = setup('/configuracion');

      expect(await dashboard()).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/registros/dashboard');
      expect(router.state.historyAction).toBe('REPLACE');
    });

    it('espera mientras cargan los parámetros y deja pasar si resulta administrador', async () => {
      const { router, parameters } = setup('/configuracion', { parameters: { loading: true } });

      expect(await screen.findByText('Verificando permisos…')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/configuracion');

      act(() => parameters.set({ loading: false, canManage: true }));

      expect(
        await screen.findByRole('heading', { name: 'Configuración global de tiempos' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/configuracion');
    });

    it('redirige cuando termina la carga sin permiso', async () => {
      const { router, parameters } = setup('/configuracion', { parameters: { loading: true } });
      await screen.findByText('Verificando permisos…');

      act(() => parameters.set({ loading: false }));

      expect(await dashboard()).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/registros/dashboard');
    });

    it('deja pasar al administrador', async () => {
      setup('/configuracion', { parameters: { canManage: true } });

      expect(
        await screen.findByRole('heading', { name: 'Configuración global de tiempos' }),
      ).toBeInTheDocument();
    });
  });

  describe('RequireAudit (/auditoria/eliminaciones)', () => {
    it('deja pasar al auditor configurado', async () => {
      setup('/auditoria/eliminaciones', {
        user: { name: 'Auditora', email: 'AUDITOR@example.test' },
      });

      expect(await screen.findByRole('heading', { name: 'Solicitudes de eliminación' })).toBeInTheDocument();
    });

    it('deja pasar por rol auditor o por eliminación técnica', async () => {
      setup('/auditoria/eliminaciones', {
        user: { ...testUser, role: 'Auditor interno' },
      });
      expect(await screen.findByRole('heading', { name: 'Solicitudes de eliminación' })).toBeInTheDocument();
    });

    it('espera la carga y redirige si no tiene permiso', async () => {
      const { router, parameters } = setup('/auditoria/eliminaciones', { parameters: { loading: true } });
      expect(await screen.findByText('Verificando permisos…')).toBeInTheDocument();

      act(() => parameters.set({ loading: false }));

      expect(await dashboard()).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/registros/dashboard');
    });
  });

  it.each(['/administracion/ubicaciones', '/registros/logs'])(
    'la ruta retirada %s ya no existe y muestra el 404',
    async (path) => {
      setup(path);
      expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
    },
  );

  it('la raíz redirige al dashboard y una ruta desconocida muestra 404', async () => {
    const { router } = setup('/');
    expect(await dashboard()).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/registros/dashboard');

    await act(() => router.navigate('/no-existe'));
    expect(await screen.findByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument();
  });
});
