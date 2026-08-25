import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import {
  lucideBarChart3,
  lucideClipboardCheck,
  lucideClipboardList,
  lucideLayoutTemplate,
  lucideSendHorizontal,
  lucideSettings,
  lucideShieldCheck,
} from '@ng-icons/lucide';
import { AuthGateway } from '@application/auth/auth.gateway';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import { catchError, firstValueFrom, of } from 'rxjs';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import { environment } from '@env/environment';
import { UiToolbarComponent } from '@presentation/shared/components/ui-toolbar/ui-toolbar.component';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';

type AppTheme = 'light' | 'dark';
type NavItem = {
  label: string;
  route: string;
  icon: string;
  adminOnly?: boolean;
  auditOnly?: boolean;
};
type NavSection = {
  label: string;
  adminOnly: boolean;
  items: NavItem[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NgIcon,
    OverflowTooltipDirective,
    UiToolbarComponent,
    UiFieldComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnDestroy {
  auth = inject(AuthGateway);
  parameters = inject(AppParametersFacade);
  private location = inject(LocationGateway);
  private audit = inject(UserAuditGateway);
  private router = inject(Router);
  email = '';
  password = '';
  loggingIn = signal(false);
  loginError = signal('');
  restoringSession = signal(true);
  sidebarCollapsed = signal(localStorage.getItem('pmo_sidebar_collapsed') !== 'false');
  theme = signal<AppTheme>(this.storedTheme());
  readonly navSections: NavSection[] = [
    {
      label: 'Trabajo',
      adminOnly: false,
      items: [
        { label: 'Reportar', route: '/registros/importar', icon: lucideSendHorizontal },
        { label: 'Consolidado', route: '/registros/consolidado', icon: lucideClipboardCheck },
        { label: 'Reportes', route: '/registros/reportes', icon: lucideClipboardList },
      ],
    },
    {
      label: 'Análisis',
      adminOnly: false,
      items: [{ label: 'Datos', route: '/registros/estadisticas', icon: lucideBarChart3 }],
    },
    {
      label: 'Preferencias',
      adminOnly: false,
      items: [
        { label: 'Plantillas', route: '/registros/plantillas', icon: lucideLayoutTemplate },
      ],
    },
    {
      label: 'Administración',
      adminOnly: false,
      items: [
        { label: 'Auditoría', route: '/auditoria/eliminaciones', icon: lucideShieldCheck, auditOnly: true },
        { label: 'Configuración', route: '/configuracion', icon: lucideSettings, adminOnly: true },
      ],
    },
  ];
  readonly mobileNavItems = [
    { label: 'Reportar', route: '/registros/importar' },
    { label: 'Reportes', route: '/registros/reportes' },
    { label: 'Datos', route: '/registros/estadisticas' },
    { label: 'Ajustes', route: '/registros/plantillas' },
  ];
  readonly mobileAdminItem = { label: 'Admin', route: '/configuracion' };
  readonly mobileAuditItem = { label: 'Auditoría', route: '/auditoria/eliminaciones' };
  private refreshId: number | null = null;
  private readonly themeSync = effect(() => this.applyTheme(this.theme()));
  private readonly locationRouteProtection = effect(() => {
    const email = String(this.auth.user()?.email || '')
      .trim()
      .toLowerCase();
    const allowed = environment.locationAdminEmails.includes(email);
    if (!allowed && this.router.url.startsWith('/administracion/ubicaciones')) {
      void this.router.navigateByUrl('/registros/importar', { replaceUrl: true });
    }
  });

  constructor() {
    this.auth.restoreSession().subscribe({
      next: (user) => {
        this.restoringSession.set(false);
        if (user) {
          void this.parameters.load();
          this.scheduleRefresh();
        }
      },
      error: () => {
        this.restoringSession.set(false);
        this.auth.clearTokens();
      },
    });
  }

  login() {
    this.loginError.set('');
    if (!this.email.trim() || !this.password) {
      this.loginError.set('Ingresa email y contraseña');
      return;
    }
    this.loggingIn.set(true);
    this.clearRefreshInterval();
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (user) => {
        this.auth.setUser(user);
        void this.recordLoginAudit();
        void this.parameters.load();
        this.loggingIn.set(false);
        this.scheduleRefresh();
      },
      error: (err) => {
        this.loggingIn.set(false);
        this.loginError.set(err?.message || 'No se pudo iniciar sesión');
      },
    });
  }

  logout() {
    this.auth.clearTokens();
    this.clearRefreshInterval();
  }

  toggleSidebar() {
    this.sidebarCollapsed.update((collapsed) => {
      const next = !collapsed;
      localStorage.setItem('pmo_sidebar_collapsed', String(next));
      return next;
    });
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    sessionStorage.setItem('pmo_theme', theme);
  }

  initials(): string {
    const name = this.auth.user()?.name || this.auth.user()?.email || 'PMO';
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  ngOnDestroy(): void {
    this.clearRefreshInterval();
  }

  visibleNavItems(section: NavSection): NavItem[] {
    if (section.adminOnly && !this.parameters.canManage()) return [];
    return section.items.filter((item) => this.canShowNavItem(item));
  }

  canReviewDeleteRequests(): boolean {
    const user = this.auth.user();
    const identities = [user?.email, user?.username].map((value) => this.normalizeEmail(value));
    const auditor = this.normalizeEmail(this.parameters.deletionSettings().auditorEmail);
    const role = this.normalizeEmail(user?.role);
    return (
      this.parameters.canManage() ||
      this.parameters.canUseTechnicalDelete(user?.email) ||
      this.parameters.canUseTechnicalDelete(user?.username) ||
      (!!auditor && identities.includes(auditor)) ||
      role === 'admin' ||
      role.includes('auditor')
    );
  }

  private scheduleRefresh() {
    if (!this.auth.isAuthenticated() || this.refreshId) return;
    this.refreshId = window.setInterval(
      () => {
        this.auth.refreshSession().subscribe({
          error: (error) => {
            if (this.auth.isSessionExpiredError(error)) this.logout();
          },
        });
      },
      4 * 60 * 1000,
    );
  }

  private clearRefreshInterval() {
    if (this.refreshId) window.clearInterval(this.refreshId);
    this.refreshId = null;
  }

  private async recordLoginAudit(): Promise<void> {
    const location = await this.location.capture({
      highAccuracy: false,
      maximumAgeMs: 300000,
      timeoutMs: 10000,
    });
    await firstValueFrom(this.audit.recordLogin(location).pipe(catchError(() => of(undefined))));
  }

  private storedTheme(): AppTheme {
    return sessionStorage.getItem('pmo_theme') === 'dark' ? 'dark' : 'light';
  }

  private applyTheme(theme: AppTheme): void {
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.style.colorScheme = theme;
  }

  private canShowNavItem(item: NavItem): boolean {
    if (item.adminOnly && !this.parameters.canManage()) return false;
    if (item.auditOnly && !this.canReviewDeleteRequests()) return false;
    return true;
  }

  private normalizeEmail(value: unknown): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }
}
