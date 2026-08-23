import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthGateway } from '@application/auth/auth.gateway';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import { catchError, firstValueFrom, of } from 'rxjs';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import { environment } from '@env/environment';
import { UiToolbarComponent } from '@presentation/shared/components/ui-toolbar/ui-toolbar.component';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
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
  readonly navSections = [
    {
      label: 'Trabajo',
      adminOnly: false,
      items: [
        { label: 'Reportar', route: '/registros/importar' },
        { label: 'Consolidado', route: '/registros/consolidado' },
        { label: 'Reportes', route: '/registros/reportes' },
      ],
    },
    {
      label: 'Análisis',
      adminOnly: false,
      items: [{ label: 'Datos', route: '/registros/estadisticas' }],
    },
    {
      label: 'Preferencias',
      adminOnly: false,
      items: [{ label: 'Plantillas', route: '/registros/plantillas' }],
    },
    {
      label: 'Administración',
      adminOnly: true,
      items: [{ label: 'Configuración', route: '/configuracion' }],
    },
  ];
  readonly mobileNavItems = [
    { label: 'Reportar', route: '/registros/importar' },
    { label: 'Reportes', route: '/registros/reportes' },
    { label: 'Datos', route: '/registros/estadisticas' },
    { label: 'Ajustes', route: '/registros/plantillas' },
  ];
  readonly mobileAdminItem = { label: 'Admin', route: '/configuracion' };
  readonly menuBarItems = [
    { label: 'Reportar', route: '/registros/importar' },
    { label: 'Reportes', route: '/registros/reportes' },
    { label: 'Datos', route: '/registros/estadisticas' },
  ];
  private refreshId: number | null = null;
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
}
