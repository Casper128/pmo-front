import { LogOut, Moon, Sun } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { SidebarTrigger } from '@/shared/ui/sidebar';
import { NotificationBell } from '@presentation/notifications/notification-bell';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import { userInitials } from './permissions';
import { useTheme, type AppTheme } from './theme-context';

const themeOptions: readonly { value: AppTheme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Tema claro', Icon: Sun },
  { value: 'dark', label: 'Tema oscuro', Icon: Moon },
];

/** Barra superior (equivale a `ui-toolbar`): título, tema claro/oscuro y menú de usuario con salida. */
export function AppHeader() {
  const { auth, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const userName = user?.name || '';

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-4">
      <SidebarTrigger className="md:hidden" aria-label="Abrir navegación" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">Gestión de tiempos</p>
        <p className="truncate text-xs text-muted-foreground">Reportes y avances</p>
      </div>
      <NotificationBell />
      <div role="group" aria-label="Tema de la aplicación" className="flex items-center rounded-lg border p-0.5">
        {themeOptions.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            variant={theme === value ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={label}
            aria-pressed={theme === value}
            title={label}
            onClick={() => setTheme(value)}
          >
            <Icon aria-hidden="true" />
          </Button>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-2 px-1.5"
            aria-label={userName ? `Menú de usuario de ${userName}` : 'Menú de usuario'}
          >
            <Avatar>
              <AvatarFallback className="text-xs font-semibold">{userInitials(user)}</AvatarFallback>
            </Avatar>
            {userName ? <span className="hidden max-w-40 truncate sm:inline">{userName}</span> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{userName || 'Usuario PMO'}</span>
            <span className="text-xs font-normal text-muted-foreground">Sesión activa</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => auth.clearTokens()}>
            <LogOut aria-hidden="true" />
            Salir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
