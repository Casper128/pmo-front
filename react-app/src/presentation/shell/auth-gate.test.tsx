import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeAppParameters } from '@/test/fakes/fake-app-parameters';
import { FakeAuthGateway, testUser } from '@/test/fakes/fake-auth';
import { renderApp } from '@/test/fakes/render-app';
import { createTestContainer } from '@/test/fakes/test-container';
import { LOGIN_LOCATION_REQUEST, SESSION_REFRESH_INTERVAL_MS } from './session-config';

const loginHeading = () => screen.findByRole('heading', { name: 'Registro de tiempos' });
const dashboardHeading = () => screen.findByRole('heading', { name: 'Dashboard de tiempos' });

async function submitLogin(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('AuthGate', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('muestra el login cuando no hay sesión', async () => {
    renderApp(createTestContainer());

    expect(await loginHeading()).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('muestra un skeleton mientras restaura la sesión y luego el shell, una sola vez pese a StrictMode', async () => {
    const auth = new FakeAuthGateway({ user: testUser });
    let finishRestore: (user: typeof testUser) => void = () => undefined;
    const restore = vi
      .spyOn(auth, 'restoreSession')
      .mockReturnValue(new Promise((resolve) => (finishRestore = resolve)));
    const parameters = new FakeAppParameters({}, auth);
    const load = vi.spyOn(parameters, 'load');
    renderApp(createTestContainer({ auth, parameters }));

    expect(screen.getByText('Validando sesion...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Registro de tiempos' })).not.toBeInTheDocument();

    await act(async () => finishRestore(testUser));

    expect(await dashboardHeading()).toBeInTheDocument();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('si la restauración falla limpia la sesión y muestra el login', async () => {
    const auth = new FakeAuthGateway({ user: testUser });
    vi.spyOn(auth, 'restoreSession').mockRejectedValue(new Error('fallo'));
    const clear = vi.spyOn(auth, 'clearTokens');
    renderApp(createTestContainer({ auth }));

    expect(await loginHeading()).toBeInTheDocument();
    expect(clear).toHaveBeenCalled();
  });

  it('valida email y contraseña con el mensaje de Angular sin llamar al login', async () => {
    const auth = new FakeAuthGateway();
    const login = vi.spyOn(auth, 'login');
    renderApp(createTestContainer({ auth }));
    await loginHeading();

    await submitLogin('   ', '');

    expect(await screen.findByText('Ingresa email y contraseña')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('muestra el mensaje de error del login', async () => {
    const auth = new FakeAuthGateway();
    vi.spyOn(auth, 'login').mockRejectedValue(new Error('Credenciales incorrectas'));
    renderApp(createTestContainer({ auth }));
    await loginHeading();

    await submitLogin('consultor@example.test', 'clave-incorrecta');

    expect(await screen.findByText('Credenciales incorrectas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('usa el mensaje por defecto si el error no trae mensaje', async () => {
    const auth = new FakeAuthGateway();
    vi.spyOn(auth, 'login').mockRejectedValue({ status: 500 });
    renderApp(createTestContainer({ auth }));
    await loginHeading();

    await submitLogin('consultor@example.test', 'clave');

    expect(await screen.findByText('No se pudo iniciar sesión')).toBeInTheDocument();
  });

  it('tras el login audita con geolocalización (opciones de Angular), carga parámetros y muestra el shell', async () => {
    const auth = new FakeAuthGateway();
    const login = vi.spyOn(auth, 'login');
    const parameters = new FakeAppParameters({}, auth);
    const load = vi.spyOn(parameters, 'load');
    const container = createTestContainer({ auth, parameters });
    renderApp(container);
    await loginHeading();

    await submitLogin('  consultor@example.test ', 'secreta');

    expect(await dashboardHeading()).toBeInTheDocument();
    expect(login).toHaveBeenCalledWith('consultor@example.test', 'secreta');
    expect(load).toHaveBeenCalledTimes(1);
    expect(container.location.capture).toHaveBeenCalledWith(LOGIN_LOCATION_REQUEST);
    expect(LOGIN_LOCATION_REQUEST).toEqual({ highAccuracy: false, maximumAgeMs: 300000, timeoutMs: 10000 });
    await vi.waitFor(() => expect(container.userAudit.recordLogin).toHaveBeenCalledTimes(1));
  });

  it('un fallo de la auditoría de login se ignora', async () => {
    const auth = new FakeAuthGateway();
    const container = createTestContainer({
      auth,
      userAudit: {
        recordLogin: vi.fn(() => Promise.reject(new Error('auditoría caída'))),
        recordTimeReport: vi.fn(async () => undefined),
      },
    });
    renderApp(container);
    await loginHeading();

    await submitLogin('consultor@example.test', 'secreta');

    expect(await dashboardHeading()).toBeInTheDocument();
    expect(screen.queryByText('auditoría caída')).not.toBeInTheDocument();
  });

  it('renueva la sesión cada 4 minutos y cierra sesión si la renovación devuelve sesión expirada', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const auth = new FakeAuthGateway({ user: testUser });
    const refresh = vi.spyOn(auth, 'refreshSession').mockResolvedValue('nuevo-token');
    renderApp(createTestContainer({ auth }));
    expect(await dashboardHeading()).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(SESSION_REFRESH_INTERVAL_MS - 1));
    expect(refresh).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(auth.isLoggedIn()).toBe(true);

    refresh.mockRejectedValue({ status: 401 });
    await act(() => vi.advanceTimersByTimeAsync(SESSION_REFRESH_INTERVAL_MS));

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(auth.isLoggedIn()).toBe(false);
    expect(await loginHeading()).toBeInTheDocument();

    // Sin sesión no se programan más renovaciones.
    await act(() => vi.advanceTimersByTimeAsync(SESSION_REFRESH_INTERVAL_MS * 2));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('mantiene la sesión si la renovación falla por otro motivo', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const auth = new FakeAuthGateway({ user: testUser });
    vi.spyOn(auth, 'refreshSession').mockRejectedValue({ status: 0 });
    renderApp(createTestContainer({ auth }));
    expect(await dashboardHeading()).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(SESSION_REFRESH_INTERVAL_MS));

    expect(auth.isLoggedIn()).toBe(true);
    expect(screen.getByRole('heading', { name: 'Dashboard de tiempos' })).toBeInTheDocument();
  });
});
