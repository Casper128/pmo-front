import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { TEST_TIMEZONES, useTimezone } from '@/test/timezones';
import { DateRangePicker, type DateRangeValue } from './date-range-picker';

function ControlledRange({ initial, onChange }: { initial: DateRangeValue; onChange?: (value: DateRangeValue) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateRangePicker
      aria-label="Rango de fechas"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole('button', { name: 'Rango de fechas' });

describe.each(TEST_TIMEZONES)('DateRangePicker en TZ=%s', (timezone) => {
  useTimezone(timezone);

  it('selecciona inicio y fin y emite YYYY-MM-DD sin desfase', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledRange initial={{ from: '2026-11-01', to: '' }} onChange={onChange} />);
    expect(trigger()).toHaveTextContent('01 de nov de 2026 – …');

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: /30 de noviembre de 2026/ }));

    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-01', to: '2026-11-30' });
    expect(trigger()).toHaveTextContent('01 de nov de 2026 – 30 de nov de 2026');
    // El popover sigue abierto para ajustar el rango.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('DateRangePicker', () => {
  it('sin rango muestra el placeholder; el primer clic fija desde = hasta', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledRange initial={{ from: '', to: '' }} onChange={onChange} />);
    expect(trigger()).toHaveTextContent('Seleccionar rango');

    await user.click(trigger());
    // Sin valor abre en el mes actual: se elige el día 15 del mes mostrado.
    const day = screen.getAllByRole('button', { name: /^(Hoy, )?\w+, 15 de / })[0];
    await user.click(day);

    const [{ from, to }] = onChange.mock.lastCall as [DateRangeValue];
    expect(from).toMatch(/^\d{4}-\d{2}-15$/);
    expect(to).toBe(from);
  });

  it('ampliar un rango completo y "Limpiar"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledRange initial={{ from: '2026-11-10', to: '2026-11-12' }} onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: /, 5 de noviembre de 2026/ }));
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-05', to: '2026-11-12' });

    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(onChange).toHaveBeenLastCalledWith({ from: '', to: '' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent('Seleccionar rango');
  });
});
