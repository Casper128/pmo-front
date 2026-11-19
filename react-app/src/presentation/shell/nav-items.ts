import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LayoutTemplate,
  SendHorizontal,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export const DASHBOARD_PATH = '/registros/dashboard';

export interface NavItem {
  readonly label: string;
  readonly route: string;
  readonly icon: LucideIcon;
  readonly adminOnly?: boolean;
  readonly auditOnly?: boolean;
}

export interface NavSection {
  readonly label: string;
  readonly adminOnly: boolean;
  readonly items: readonly NavItem[];
}

export interface MobileNavItem {
  readonly label: string;
  readonly route: string;
  readonly adminOnly?: boolean;
  readonly auditOnly?: boolean;
}

export interface NavPermissions {
  readonly canManage: boolean;
  readonly canReview: boolean;
}

/** Mismas secciones, ítems, rutas e iconos que `navSections` del shell Angular. */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: 'Trabajo',
    adminOnly: false,
    items: [
      { label: 'Reportar', route: '/registros/importar', icon: SendHorizontal },
      { label: 'Consolidado', route: '/registros/consolidado', icon: ClipboardCheck },
      { label: 'Reportes', route: '/registros/reportes', icon: ClipboardList },
    ],
  },
  {
    label: 'Análisis',
    adminOnly: false,
    items: [
      { label: 'Dashboard', route: DASHBOARD_PATH, icon: LayoutDashboard },
      { label: 'Datos', route: '/registros/estadisticas', icon: BarChart3 },
    ],
  },
  {
    label: 'Preferencias',
    adminOnly: false,
    items: [{ label: 'Plantillas', route: '/registros/plantillas', icon: LayoutTemplate }],
  },
  {
    label: 'Administración',
    adminOnly: false,
    items: [
      { label: 'Auditoría', route: '/auditoria/eliminaciones', icon: ShieldCheck, auditOnly: true },
      { label: 'Configuración', route: '/configuracion', icon: Settings, adminOnly: true },
    ],
  },
];

export const MOBILE_NAV_MAX_ITEMS = 5;

/** Ítems de la barra inferior en orden de visualización; Admin y Auditoría solo con permisos. */
export const MOBILE_NAV_ITEMS: readonly MobileNavItem[] = [
  { label: 'Dashboard', route: DASHBOARD_PATH },
  { label: 'Reportar', route: '/registros/importar' },
  { label: 'Reportes', route: '/registros/reportes' },
  { label: 'Datos', route: '/registros/estadisticas' },
  { label: 'Ajustes', route: '/registros/plantillas' },
  { label: 'Admin', route: '/configuracion', adminOnly: true },
  { label: 'Auditoría', route: '/auditoria/eliminaciones', auditOnly: true },
];

/** Rutas que salen primero de la barra cuando hay más de 5 ítems (siguen en "Abrir navegación"). */
const MOBILE_DROP_ORDER = ['/registros/plantillas', '/registros/estadisticas'];

const canShow = (item: { adminOnly?: boolean; auditOnly?: boolean }, permissions: NavPermissions) =>
  !(item.adminOnly && !permissions.canManage) && !(item.auditOnly && !permissions.canReview);

/** `visibleNavItems` de Angular: filtra por `adminOnly`/`auditOnly` y omite secciones vacías. */
export function visibleNavSections(
  sections: readonly NavSection[],
  permissions: NavPermissions,
): NavSection[] {
  return sections
    .filter((section) => !(section.adminOnly && !permissions.canManage))
    .map((section) => ({ ...section, items: section.items.filter((item) => canShow(item, permissions)) }))
    .filter((section) => section.items.length > 0);
}

/**
 * Ítems visibles según permisos, máximo `MOBILE_NAV_MAX_ITEMS`. Si Admin/Auditoría hacen superar el máximo,
 * se retiran primero Ajustes y luego Datos; lo retirado queda en "Abrir navegación" (menú lateral).
 */
export function visibleMobileNavItems(
  items: readonly MobileNavItem[],
  permissions: NavPermissions,
): MobileNavItem[] {
  const visible = items.filter((item) => canShow(item, permissions));
  for (const route of MOBILE_DROP_ORDER) {
    if (visible.length <= MOBILE_NAV_MAX_ITEMS) break;
    const index = visible.findIndex((item) => item.route === route);
    if (index >= 0) visible.splice(index, 1);
  }
  return visible;
}

/** Ruta activa: la misma o una subruta (equivale a `routerLinkActive`). */
export function isActiveRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}
