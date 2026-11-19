import { Ellipsis } from 'lucide-react';
import { cn } from 'cn';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { MOBILE_NAV_ITEMS, isActiveRoute, splitMobileNavItems } from './nav-items';
import { usePermissions } from './use-permissions';

const itemClassName =
  'flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium outline-none transition-colors motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:size-5';

/** Barra inferior en móvil: icono + etiqueta; con más de 5 accesos, los últimos pasan al Sheet "Más". */
export function MobileNav() {
  const { canManage, canReview } = usePermissions();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { primary, overflow } = splitMobileNavItems(MOBILE_NAV_ITEMS, { canManage, canReview });
  const overflowActive = overflow.some((item) => isActiveRoute(pathname, item.route));

  return (
    <>
      <nav
        aria-label="Navegación móvil"
        className="fixed inset-x-0 bottom-0 z-30 grid h-(--mobile-nav-h) auto-cols-fr grid-flow-col border-t bg-background px-2 pt-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      >
        {primary.map(({ route, label, icon: Icon }) => (
          <NavLink
            key={route}
            to={route}
            className={({ isActive }) => cn(itemClassName, isActive ? 'text-primary' : 'text-muted-foreground')}
          >
            <Icon aria-hidden="true" />
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
        {overflow.length > 0 ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn(itemClassName, overflowActive ? 'text-primary' : 'text-muted-foreground')}
          >
            <Ellipsis aria-hidden="true" />
            <span>Más</span>
          </button>
        ) : null}
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom,0px)]">
          <SheetHeader>
            <SheetTitle>Más</SheetTitle>
            <SheetDescription className="sr-only">Otros accesos de la aplicación</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-1 px-2 pb-3">
            {overflow.map(({ route, label, icon: Icon }) => (
              <li key={route}>
                <NavLink
                  to={route}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&>svg]:size-5',
                      isActive ? 'font-medium text-primary' : 'text-foreground',
                    )
                  }
                >
                  <Icon aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
