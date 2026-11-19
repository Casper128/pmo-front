import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { OverflowText } from './overflow-text';

const text = 'Proyecto de integración con un nombre muy largo';

/** jsdom no maqueta: se simulan las medidas que el navegador daría al texto. */
function setSize(element: HTMLElement, { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: clientWidth });
}

const renderText = (props: Partial<Parameters<typeof OverflowText>[0]> = {}) =>
  render(
    <TooltipProvider>
      <OverflowText {...props}>{text}</OverflowText>
    </TooltipProvider>,
  );

describe('OverflowText', () => {
  it('trunca a una línea por defecto y con lines usa line-clamp', () => {
    const { unmount } = renderText();
    expect(screen.getByText(text)).toHaveClass('truncate');
    unmount();
    renderText({ lines: 2 });
    expect(screen.getByText(text)).toHaveClass('line-clamp-2');
  });

  it('muestra el tooltip al pasar el puntero solo si el texto desborda', async () => {
    const user = userEvent.setup();
    renderText();
    const span = screen.getByText(text);
    setSize(span, { scrollWidth: 400, clientWidth: 120 });

    await user.hover(span);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(text);
    expect(span).toHaveAccessibleDescription(text);
  });

  it('no muestra tooltip si el texto cabe (tolerancia de 1 px como la directiva)', async () => {
    const user = userEvent.setup();
    renderText();
    const span = screen.getByText(text);
    setSize(span, { scrollWidth: 121, clientWidth: 120 });

    await user.hover(span);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('usa el texto de tooltip indicado', async () => {
    const user = userEvent.setup();
    renderText({ tooltip: 'Texto completo alternativo' });
    const span = screen.getByText(text);
    setSize(span, { scrollWidth: 400, clientWidth: 120 });

    await user.hover(span);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Texto completo alternativo');
  });
});
