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
        <p className="px-2 py-1 text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">PMO</p>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Navegación principal">
          {sections.map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-xs font-medium">{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.route}>
                      <SidebarMenuButton asChild isActive={isActiveRoute(pathname, item.route)} tooltip={item.label}>
                        <NavLink className="group-data-[active=true]/menu-button:[&>svg]:text-primary" to={item.route} onClick={() => isMobile && setOpenMobile(false)}>
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
