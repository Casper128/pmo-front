import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { AppSelect, type AppSelectOption, type AppSelectProps } from './app-select';

const few: AppSelectOption[] = [
  { value: 'Alta', label: 'Alta' },
  { value: 'Media', label: 'Media' },
  { value: 'Baja', label: 'Baja', disabled: true },
];

const cities = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta', 'Bucaramanga', 'Pereira', 'Santa Marta'];
const many: AppSelectOption[] = cities.map((city) => ({ value: city.toLowerCase(), label: city }));

function Controlled(props: Partial<AppSelectProps> & { initial?: string }) {
  const { initial = '', onValueChange, options = few, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="campo">Campo</label>
      <AppSelect
        id="campo"
        options={options}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange?.(next);
        }}
        {...rest}
      />
    </>
  );
}

const trigger = () => screen.getByRole('combobox', { name: 'Campo' });

describe('AppSelect · Select (opciones ≤ umbral)', () => {
  it('muestra el placeholder y selecciona una opción', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    expect(trigger()).toHaveTextContent('Seleccione una opción');

    await user.click(trigger());
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Buscar opción...')).not.toBeInTheDocument();
    await user.click(within(listbox).getByRole('option', { name: 'Media' }));

    expect(onValueChange).toHaveBeenCalledWith('Media');
    expect(trigger()).toHaveTextContent('Media');
  });

  it('las opciones deshabilitadas no se pueden elegir', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(trigger());
    expect(await screen.findByRole('option', { name: 'Baja' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('con exactamente 8 opciones no hay búsqueda (Angular: más de 8)', async () => {
    const user = userEvent.setup();
    render(<Controlled options={many.slice(0, 8)} />);
    await user.click(trigger());
    await screen.findByRole('listbox');
    expect(screen.queryByPlaceholderText('Buscar opción...')).not.toBeInTheDocument();
  });

  it('sin opciones muestra el mensaje vacío', async () => {
    const user = userEvent.setup();
    render(<Controlled options={[]} emptyMessage="No hay proyectos" />);
    await user.click(trigger());
    expect(await screen.findByText('No hay proyectos')).toBeInTheDocument();
  });
});

describe('AppSelect · combobox con búsqueda (opciones > umbral)', () => {
  it('filtra sin tildes ni mayúsculas y selecciona', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Controlled options={many} onValueChange={onValueChange} />);
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const search = screen.getByRole('combobox', { name: 'Buscar opción' });
    expect(search).toHaveAttribute('placeholder', 'Buscar opción...');
    await user.type(search, 'MEDELLIN');

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Medellín']);
    await user.click(screen.getByRole('option', { name: 'Medellín' }));

    expect(onValueChange).toHaveBeenCalledWith('medellín');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent('Medellín');
  });

  it('busca por "contiene" y muestra el mensaje cuando nada coincide', async () => {
    const user = userEvent.setup();
    render(<Controlled options={many} />);
    await user.click(trigger());
    const search = screen.getByRole('combobox', { name: 'Buscar opción' });

    await user.type(search, 'ta');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Bogotá', 'Cartagena', 'Cúcuta', 'Santa Marta']);

    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No hay opciones que coincidan.')).toBeInTheDocument();
  });

  it('searchable fuerza la búsqueda aunque haya pocas opciones', async () => {
    const user = userEvent.setup();
    render(<Controlled searchable />);
    await user.click(trigger());
    expect(screen.getByRole('combobox', { name: 'Buscar opción' })).toBeInTheDocument();
  });

  it('respeta un searchThreshold propio', async () => {
    const user = userEvent.setup();
    render(<Controlled searchThreshold={2} />);
    await user.click(trigger());
    expect(screen.getByRole('combobox', { name: 'Buscar opción' })).toBeInTheDocument();
  });
});

describe('AppSelect · disabled y loading', () => {
  it.each([[few], [many]])('disabled impide abrir (%#)', async (options) => {
    const user = userEvent.setup();
    render(<Controlled options={options} disabled />);
    expect(trigger()).toBeDisabled();
    await user.click(trigger());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it.each([[few], [many]])('loading deshabilita y muestra "Cargando..." sin selección (%#)', (options) => {
    render(<Controlled options={options} loading />);
    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveTextContent('Cargando...');
    expect(trigger()).toHaveAttribute('aria-busy', 'true');
  });

  it('loading conserva la etiqueta seleccionada', () => {
    render(<Controlled options={many} initial="cali" loading />);
    expect(trigger()).toHaveTextContent('Cali');
  });
});
