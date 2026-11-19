import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthUser } from '@domain/auth/auth-user.model';
import { FakeAppParameters, type FakeParametersState } from '@/test/fakes/fake-app-parameters';
import { FakeAuthGateway, testUser } from '@/test/fakes/fake-auth';
import { renderApp } from '@/test/fakes/render-app';
import { createTestContainer } from '@/test/fakes/test-container';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from './app-layout';
import { THEME_STORAGE_KEY } from './theme-context';

async function renderShell({ user = testUser as AuthUser, parameters = {} as Partial<FakeParametersState> } = {}) {
  const auth = new FakeAuthGateway({ user });
  const view = renderApp(createTestContainer({ auth, parameters: new FakeAppParameters(parameters, auth) }));
  await screen.findByRole('heading', { name: 'Dashboard de tiempos' });
  return { ...view, auth };
}

const linkNames = (navName: string) =>
  within(screen.getByRole('navigation', { name: navName }))
    .getAllByRole('link')
    .map((link) => link.textContent?.trim());

describe('layout del shell', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  describe('menú filtrado por permisos', () => {
    it('sin permisos oculta Auditoría, Configuración y la sección Administración', async () => {
      await renderShell();

      expect(linkNames('Navegación principal')).toEqual([
        'Reportar',
        'Consolidado',
        'Reportes',
        'Dashboard',
        'Datos',
        'Plantillas',
      ]);
      expect(screen.queryByText('Administración')).not.toBeInTheDocument();
      expect(linkNames('Navegación móvil')).toEqual([
        'Dashboard',
        'Reportar',
        'Reportes',
        'Datos',
        'Ajustes',
      ]);
    });

    it('el administrador ve Auditoría y Configuración (y Admin en móvil)', async () => {
      await renderShell({ parameters: { canManage: true } });

      expect(screen.getByText('Administración')).toBeInTheDocument();
      expect(linkNames('Navegación principal')).toEqual(
        expect.arrayContaining(['Auditoría', 'Configuración']),
      );
      // Más de 5 accesos: 4 en la barra y el resto en "Más".
      expect(linkNames('Navegación móvil')).toEqual(['Dashboard', 'Reportar', 'Reportes', 'Datos']);
      expect(screen.getByRole('button', { name: 'Más' })).toBeInTheDocument();
    });

    it('"Más" abre un Sheet con los accesos restantes', async () => {
      const user = userEvent.setup();
      await renderShell({ parameters: { canManage: true } });

      await user.click(screen.getByRole('button', { name: 'Más' }));

      const sheet = await screen.findByRole('dialog', { name: 'Más' });
      expect(within(sheet).getAllByRole('link').map((l) => l.textContent?.trim())).toEqual(['Ajustes', 'Admin', 'Auditoría']);
    });

    it('el auditor ve Auditoría pero no Configuración', async () => {
      await renderShell({ user: { name: 'Auditora', email: 'auditor@example.test' } });

      const items = linkNames('Navegación principal');
      expect(items).toContain('Auditoría');
      expect(items).not.toContain('Configuración');
      expect(linkNames('Navegación móvil')).toEqual(['Dashboard', 'Reportar', 'Reportes', 'Datos']);
      expect(screen.getByRole('button', { name: 'Más' })).toBeInTheDocument();
    });

    it('el menú reacciona cuando cambian los permisos', async () => {
      const auth = new FakeAuthGateway({ user: testUser });
      const parameters = new FakeAppParameters({}, auth);
      renderApp(createTestContainer({ auth, parameters }));
      await screen.findByRole('heading', { name: 'Dashboard de tiempos' });
      expect(linkNames('Navegación principal')).not.toContain('Configuración');

      parameters.set({ canManage: true });

      expect(await screen.findAllByRole('link', { name: 'Configuración' })).not.toHaveLength(0);
    });
  });

  it('marca la ruta activa', async () => {
    await renderShell();
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  it('persiste el colapso de la barra lateral en pmo_sidebar_collapsed (contraída por defecto)', async () => {
    const user = userEvent.setup();
    await renderShell();

    await user.click(screen.getByRole('button', { name: 'Expandir navegación' }));
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Contraer navegación' }));
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');
  });

  it('respeta el estado expandido guardado', async () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, 'false');
    await renderShell();
    expect(screen.getByRole('button', { name: 'Contraer navegación' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('cambia y persiste el tema en sessionStorage (pmo_theme) aplicando la clase .dark', async () => {
    const user = userEvent.setup();
    const { unmount } = await renderShell();
    expect(screen.getByRole('button', { name: 'Tema claro' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Tema oscuro' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(sessionStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    unmount();

    await renderShell();
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Tema oscuro' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Tema claro' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(sessionStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('muestra las iniciales del usuario y cierra sesión desde el menú', async () => {
    const user = userEvent.setup();
    const { auth } = await renderShell();
    const trigger = screen.getByRole('button', { name: 'Menú de usuario de Ana Prueba' });
    expect(within(trigger).getByText('AP')).toBeInTheDocument();
    // El nombre accesible contiene el texto visible (WCAG 2.5.3).
    expect(trigger).toHaveAccessibleName(expect.stringContaining('Ana Prueba'));

    await user.click(trigger);
    expect(await screen.findByText('Sesión activa')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Salir' }));

    expect(auth.isLoggedIn()).toBe(false);
    expect(await screen.findByRole('heading', { name: 'Registro de tiempos' })).toBeInTheDocument();
  });

  it('sin nombre de usuario el menú se llama "Menú de usuario"', async () => {
    await renderShell({ user: { name: '', email: 'sin-nombre@example.test' } });
    expect(screen.getByRole('button', { name: 'Menú de usuario' })).toBeInTheDocument();
  });

  it('al cerrar sesión vacía la caché de TanStack Query (sin datos del usuario anterior)', async () => {
    const user = userEvent.setup();
    const { queryClient } = await renderShell();
    queryClient.setQueryData(['reportes', 'usuario-anterior'], [{ id: 1 }]);
    const clear = vi.spyOn(queryClient, 'clear');

    await user.click(screen.getByRole('button', { name: 'Menú de usuario de Ana Prueba' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Salir' }));

    await screen.findByRole('heading', { name: 'Registro de tiempos' });
    expect(clear).toHaveBeenCalled();
    expect(queryClient.getQueryData(['reportes', 'usuario-anterior'])).toBeUndefined();
  });

  it('en móvil la navegación se abre en un Sheet con título y descripción en español', async () => {
    const width = window.innerWidth;
    window.innerWidth = 500;
    try {
      const user = userEvent.setup();
      await renderShell();
      await user.click(screen.getByRole('button', { name: 'Abrir navegación' }));

      const sheet = await screen.findByRole('dialog', { name: 'Navegación' });
      expect(sheet).toHaveAccessibleDescription('Muestra la navegación principal.');
    } finally {
      window.innerWidth = width;
    }
  });

  it('los textos de la barra lateral generada por Shadcn están en español', async () => {
    await renderShell();
    const rail = screen.getByTitle('Contraer o expandir navegación');
    expect(rail).toHaveAccessibleName('Contraer o expandir navegación');
    expect(screen.queryByTitle(/toggle sidebar/i)).not.toBeInTheDocument();
    // SidebarTrigger conserva un <span sr-only> en inglés, pero su nombre accesible es el aria-label.
    expect(screen.getByRole('button', { name: 'Abrir navegación' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /toggle sidebar/i })).not.toBeInTheDocument();
  });
});
