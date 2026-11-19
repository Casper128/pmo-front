import { useCallback, useState, type ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { MobileNav } from './mobile-nav';

/** Clave de localStorage (la misma que la app Angular). */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'pmo_sidebar_collapsed';

/** Igual que Angular: contraída salvo que se haya guardado `'false'`. */
const readCollapsed = () => localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) !== 'false';

export function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const onOpenChange = useCallback((open: boolean) => {
    setCollapsed(!open);
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(!open));
  }, []);

  return (
    <SidebarProvider open={!collapsed} onOpenChange={onOpenChange}>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
