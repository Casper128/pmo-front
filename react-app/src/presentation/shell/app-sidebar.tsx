import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/shared/ui/sidebar';
import { NAV_SECTIONS, isActiveRoute, visibleNavSections } from './nav-items';
import { usePermissions } from './use-permissions';

/** Sustituye el texto en inglés de Shadcn ("Toggle Sidebar") del borde arrastrable. */
const RAIL_LABEL = 'Contraer o expandir navegación';

function CollapseButton() {
  const { open, toggleSidebar } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={open ? 'Contraer navegación' : 'Expandir navegación'}
          aria-expanded={open}
          tooltip="Expandir navegación"
          onClick={toggleSidebar}
        >
          {open ? <ChevronsLeft aria-hidden="true" /> : <ChevronsRight aria-hidden="true" />}
          <span>Contraer</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { canManage, canReview } = usePermissions();
  const sections = visibleNavSections(NAV_SECTIONS, { canManage, canReview });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 p-1 group-data-[collapsible=icon]:p-0">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground"
          >
            PM
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold">PMO</p>
            <p className="truncate text-xs text-muted-foreground">Tiempos</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Navegación principal">
          {sections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.route}>
                      <SidebarMenuButton asChild isActive={isActiveRoute(pathname, item.route)} tooltip={item.label}>
                        <NavLink to={item.route} onClick={() => isMobile && setOpenMobile(false)}>
                          <item.icon aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      {isMobile ? null : (
        <SidebarFooter>
          <CollapseButton />
        </SidebarFooter>
      )}
      <SidebarRail title={RAIL_LABEL} aria-label={RAIL_LABEL} />
    </Sidebar>
  );
}
