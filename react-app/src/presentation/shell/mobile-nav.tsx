import { cn } from 'cn';
import { NavLink } from 'react-router';
import { MOBILE_NAV_ITEMS, visibleMobileNavItems } from './nav-items';
import { usePermissions } from './use-permissions';

/** Barra inferior en móvil (equivale a la de Angular): mismos accesos, Admin y Auditoría según permisos. */
export function MobileNav() {
  const { canManage, canReview } = usePermissions();
  const items = visibleMobileNavItems(MOBILE_NAV_ITEMS, { canManage, canReview });

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col gap-1 border-t bg-background/95 px-2 py-2 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.route}
          to={item.route}
          className={({ isActive }) =>
            cn(
              'truncate rounded-lg px-1 py-2 text-center text-xs font-semibold transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
