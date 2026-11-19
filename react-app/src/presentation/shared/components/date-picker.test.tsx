import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { TEST_TIMEZONES, TIMEZONE_OFFSETS, useTimezone } from '@/test/timezones';
import { todayDateValue } from '@presentation/shared/format';
import { DatePicker, type DatePickerProps } from './date-picker';

/** DatePicker controlado (como lo usará un formulario) que registra cada valor emitido. */
function ControlledDatePicker({ initial, onChange, ...props }: Partial<DatePickerProps> & { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="fecha">Fecha</label>
      <DatePicker
        id="fecha"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        {...props}
      />
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Fecha' });

describe.each(TEST_TIMEZONES)('DatePicker en TZ=%s', (timezone) => {
  useTimezone(timezone);

  it('la zona horaria está aplicada', () => {
    expect(new Date(2026, 10, 20).getTimezoneOffset()).toBe(TIMEZONE_OFFSETS[timezone]);
  });

  it('muestra la fecha sin desfase (también el 1 de enero)', () => {
    const { unmount } = render(<ControlledDatePicker initial="2026-11-18" />);
    expect(trigger()).toHaveTextContent('18 de nov de 2026');
    unmount();

    render(<ControlledDatePicker initial="2026-01-01" />);
    expect(trigger()).toHaveTextContent('01 de ene de 2026');
  });

  it('al seleccionar un día emite YYYY-MM-DD de ese mismo día y cierra el calendario', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledDatePicker initial="2026-11-18" onChange={onChange} />);

    await user.click(trigger());
    const calendar = await screen.findByRole('dialog');
    // Locale es: el calendario abre en el mes del valor y la semana empieza el lunes.
    expect(screen.getByRole('grid', { name: 'noviembre 2026' })).toBeInTheDocument();
    // react-day-picker oculta la cabecera a lectores (cada día ya se anuncia con su nombre completo).
    expect(screen.getAllByRole('columnheader', { hidden: true })[0]).toHaveAttribute('aria-label', 'lunes');
    expect(calendar).toContainElement(screen.getByRole('button', { name: /18 de noviembre de 2026, seleccionado/ }));

    await user.click(screen.getByRole('button', { name: /viernes, 20 de noviembre de 2026/ }));

    expect(onChange).toHaveBeenLastCalledWith('2026-11-20');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent('20 de nov de 2026');
  });

  it('el primer y el último día del mes no se desplazan', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledDatePicker initial="2026-03-15" onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: /domingo, 1 de marzo de 2026/ }));
    expect(onChange).toHaveBeenLastCalledWith('2026-03-01');

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: /martes, 31 de marzo de 2026/ }));
    expect(onChange).toHaveBeenLastCalledWith('2026-03-31');
  });
});

describe('DatePicker', () => {
  it('sin valor muestra el placeholder', () => {
    render(<ControlledDatePicker initial="" />);
    expect(trigger()).toHaveTextContent('Seleccionar fecha');
  });

  it('volver a pulsar el día seleccionado lo mantiene (como ui-date-input)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledDatePicker initial="2026-11-18" onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: /18 de noviembre de 2026, seleccionado/ }));

    expect(onChange).toHaveBeenLastCalledWith('2026-11-18');
  });

  it('"Hoy" emite la fecha local de hoy y "Limpiar" vacía el valor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledDatePicker initial="2026-11-18" onChange={onChange} />);

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(onChange).toHaveBeenLastCalledWith(todayDateValue());

    await user.click(trigger());
    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(trigger()).toHaveTextContent('Seleccionar fecha');
  });

  it('deshabilita los días fuera de min/max', async () => {
    const user = userEvent.setup();
    render(<ControlledDatePicker initial="2026-11-18" min="2026-11-10" max="2026-11-20" />);

    await user.click(trigger());

    expect(screen.getByRole('button', { name: /, 9 de noviembre de 2026/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /, 21 de noviembre de 2026/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /, 10 de noviembre de 2026/ })).toBeEnabled();
  });

  it('respeta disabled y aria-invalid', () => {
    render(<ControlledDatePicker initial="" disabled aria-invalid />);
    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
  });
});
