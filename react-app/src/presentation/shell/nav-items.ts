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
  readonly icon: LucideIcon;
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
  { label: 'Dashboard', route: DASHBOARD_PATH, icon: LayoutDashboard },
  { label: 'Reportar', route: '/registros/importar', icon: SendHorizontal },
  { label: 'Reportes', route: '/registros/reportes', icon: ClipboardList },
  { label: 'Datos', route: '/registros/estadisticas', icon: BarChart3 },
  { label: 'Ajustes', route: '/registros/plantillas', icon: LayoutTemplate },
  { label: 'Admin', route: '/configuracion', icon: Settings, adminOnly: true },
  { label: 'Auditoría', route: '/auditoria/eliminaciones', icon: ShieldCheck, auditOnly: true },
];

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
 * Ítems de la barra inferior según permisos. Hasta `MOBILE_NAV_MAX_ITEMS` todos van en la barra; con más,
 * la barra lleva los primeros `MAX - 1` y el resto queda en `overflow` (botón "Más").
 */
export function splitMobileNavItems(
  items: readonly MobileNavItem[],
  permissions: NavPermissions,
): { primary: MobileNavItem[]; overflow: MobileNavItem[] } {
  const visible = items.filter((item) => canShow(item, permissions));
  if (visible.length <= MOBILE_NAV_MAX_ITEMS) return { primary: visible, overflow: [] };
  return {
    primary: visible.slice(0, MOBILE_NAV_MAX_ITEMS - 1),
    overflow: visible.slice(MOBILE_NAV_MAX_ITEMS - 1),
  };
}

/** Ruta activa: la misma o una subruta (equivale a `routerLinkActive`). */
export function isActiveRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}
