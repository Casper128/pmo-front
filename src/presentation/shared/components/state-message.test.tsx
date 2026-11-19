import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StateMessage } from './state-message';

describe('StateMessage', () => {
  it('por defecto muestra "Sin datos" como estado, sin botón', () => {
    render(<StateMessage />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin datos');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('error: se anuncia como alerta y el botón reintentar llama a onAction', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <StateMessage
        tone="error"
        title="No se pudieron cargar los reportes"
        description="Revisa tu conexión e inténtalo de nuevo."
        actionLabel="Reintentar"
        onAction={onAction}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No se pudieron cargar los reportes');
    expect(alert).toHaveTextContent('Revisa tu conexión e inténtalo de nuevo.');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('vacío con acción', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<StateMessage title="No hay registros" actionLabel="Importar" onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
