import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MetricCard } from './metric-card';
import { PageHeader } from './page-header';
import { SearchInput } from './search-input';
import { TimeInput } from './time-input';

function ControlledSearch({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <SearchInput
      aria-label="Buscar reportes"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('SearchInput', () => {
  it('emite el texto, limpia con el botón y con Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledSearch onChange={onChange} />);
    const input = screen.getByRole('searchbox', { name: 'Buscar reportes' });
    expect(input).toHaveAttribute('placeholder', 'Buscar...');
    expect(screen.queryByRole('button', { name: 'Limpiar búsqueda' })).not.toBeInTheDocument();

    await user.type(input, 'sap');
    expect(onChange).toHaveBeenLastCalledWith('sap');

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input).toHaveValue('');

    await user.type(input, 'abap{Escape}');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input).toHaveValue('');
  });
});

describe('TimeInput', () => {
  it('usa Input type="time" con paso de 1 minuto y normaliza la hora', () => {
    const onChange = vi.fn();
    render(<TimeInput aria-label="Hora inicio" value="8:05" onChange={onChange} />);
    const input = screen.getByLabelText('Hora inicio');
    expect(input).toHaveAttribute('type', 'time');
    expect(input).toHaveAttribute('step', '60');
    expect(input).toHaveValue('08:05');

    fireEvent.change(input, { target: { value: '17:30' } });
    expect(onChange).toHaveBeenLastCalledWith('17:30');
  });
});

describe('MetricCard', () => {
  it('muestra etiqueta, valor, descripción y delta', () => {
    render(
      <MetricCard
        label="Horas registradas"
        value="42,5"
        description="Semana actual"
        tone="blue"
        delta={{ label: '+2,5 h', trend: 'up', description: 'frente a la semana anterior' }}
      />,
    );
    expect(screen.getByText('Horas registradas')).toBeInTheDocument();
    expect(screen.getByText('42,5')).toHaveClass('text-foreground');
    expect(screen.getByText('Semana actual')).toBeInTheDocument();
    expect(screen.getByText('+2,5 h')).toHaveTextContent('+2,5 h frente a la semana anterior');
  });
});

describe('PageHeader', () => {
  it('título h1, descripción y acciones', () => {
    render(<PageHeader title="Reportes" description="Consulta tus reportes" aside={<button type="button">Nuevo</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByText('Consulta tus reportes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
  });
});
