import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('muestra solo el título cuando no hay nada más', () => {
    render(<PageHeader title="Registros" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Registros' })).toBeInTheDocument();
    expect(screen.queryByText('Mi eyebrow')).not.toBeInTheDocument();
  });

  it('muestra eyebrow sobre el título, descripción, meta y aside', () => {
    render(
      <PageHeader
        eyebrow="Seguimiento"
        title="Dashboard"
        description="Resumen de horas"
        aside={<button type="button">Actualizar</button>}
        meta={<p>Última carga hoy</p>}
      />,
    );
    const eyebrow = screen.getByText('Seguimiento');
    const heading = screen.getByRole('heading', { level: 1, name: 'Dashboard' });
    expect(eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Resumen de horas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    const description = screen.getByText('Resumen de horas');
    const meta = screen.getByText('Última carga hoy');
    expect(description.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
