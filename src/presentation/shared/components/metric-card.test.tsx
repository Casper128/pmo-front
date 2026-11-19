import { render, screen } from '@testing-library/react';
import { Clock } from 'lucide-react';
import { MetricCard } from './metric-card';

describe('MetricCard', () => {
  it('muestra etiqueta, valor y descripción sin delta ni icono', () => {
    render(<MetricCard label="Clientes" value={3} description="En el periodo" />);
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('En el periodo')).toBeInTheDocument();
  });

  it('delta positivo en success, negativo en destructive, con texto para lectores', () => {
    const { rerender } = render(
      <MetricCard label="Horas" value="10 h" delta={{ label: '+12,5 %', trend: 'up', description: 'frente al periodo anterior' }} />,
    );
    expect(screen.getByText('+12,5 %').closest('span')).toHaveClass('text-success');
    expect(screen.getByText('frente al periodo anterior')).toHaveClass('sr-only');
    rerender(<MetricCard label="Horas" value="10 h" delta={{ label: '-4 %', trend: 'down' }} />);
    expect(screen.getByText('-4 %').closest('span')).toHaveClass('text-destructive');
  });

  it('renderiza icono en chip y el slot de gráfica', () => {
    const { container } = render(
      <MetricCard label="Horas" value="10 h" icon={Clock} accent={2} chart={<div data-testid="spark" />} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByTestId('spark')).toBeInTheDocument();
  });
});
