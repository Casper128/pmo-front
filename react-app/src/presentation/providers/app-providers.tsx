import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from '@/shared/ui/sonner';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { useTheme } from '@presentation/shell/theme-context';
import { ThemeProvider } from '@presentation/shell/theme-provider';
import { ContainerContext, type Container } from './container-context';

function AppToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" />;
}

export interface AppProvidersProps {
  readonly container: Container;
  readonly queryClient: QueryClient;
  readonly children: ReactNode;
}

/** Proveedores globales. `container` y `queryClient` se crean una vez fuera del árbol (StrictMode). */
export function AppProviders({ container, queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ContainerContext.Provider value={container}>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <AppToaster />
          </TooltipProvider>
        </ThemeProvider>
      </ContainerContext.Provider>
    </QueryClientProvider>
  );
}
