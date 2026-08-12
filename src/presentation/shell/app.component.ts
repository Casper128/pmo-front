import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthGateway } from '@application/auth/auth.gateway';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import { catchError, filter, firstValueFrom, of } from 'rxjs';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import { environment } from '@env/environment';
import { PlayfulMascotComponent } from '@presentation/shared/components/playful-mascot/playful-mascot.component';
import { PlayfulMascotService } from '@presentation/shared/components/playful-mascot/playful-mascot.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    OverflowTooltipDirective,
    PlayfulMascotComponent,
  ],
  template: `
    <main class="min-h-screen bg-[#f4f7fb] text-slate-900">
      @if (restoringSession()) {
        <section class="grid min-h-screen place-items-center px-4">
          <div class="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-xl">
            <span
              class="mx-auto block size-7 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
            ></span>
            <p class="mt-3 text-sm font-black text-blue-950">Validando sesion...</p>
          </div>
        </section>
      } @else if (!auth.isLoggedIn()) {
        <section class="grid min-h-screen place-items-center px-4 py-8">
          <div
            class="grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div
              class="relative hidden min-h-[560px] overflow-hidden bg-blue-950 p-8 text-white lg:block"
            >
              <div
                class="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.35),transparent_32%),radial-gradient(circle_at_82%_28%,rgba(16,185,129,0.25),transparent_30%)]"
              ></div>
              <div class="relative flex h-full flex-col justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="grid size-12 place-items-center rounded-2xl bg-white text-blue-700 font-black"
                  >
                    PM
                  </div>
                  <div>
                    <p class="font-black">PMO</p>
                    <p class="text-xs text-blue-100">Registro de tiempos</p>
                  </div>
                </div>
                <div>
                  <p class="text-[11px] font-black uppercase tracking-[0.22em] text-blue-200">
                    Operación consultores
                  </p>
                  <h1 class="mt-3 max-w-md text-4xl font-black leading-tight">
                    Carga tus actividades y genera reportes sin fricción.
                  </h1>
                  <div class="mt-8 grid grid-cols-3 gap-3">
                    <div class="rounded-2xl border border-white/15 bg-white/10 p-4">
                      <p class="text-2xl font-black">01</p>
                      <p class="mt-1 text-xs text-blue-100">Importa por bloques</p>
                    </div>
                    <div class="rounded-2xl border border-white/15 bg-white/10 p-4">
                      <p class="text-2xl font-black">02</p>
                      <p class="mt-1 text-xs text-blue-100">Valida campos</p>
                    </div>
                    <div class="rounded-2xl border border-white/15 bg-white/10 p-4">
                      <p class="text-2xl font-black">03</p>
                      <p class="mt-1 text-xs text-blue-100">Descarga Excel</p>
                    </div>
                  </div>
                </div>
                <p class="text-xs text-blue-100">Conectado a los endpoints originales de PMO.</p>
              </div>
            </div>

            <form class="flex min-h-[560px] items-center" (ngSubmit)="login()">
              <div class="w-full p-6 sm:p-10">
                <div class="mb-8 flex items-center gap-3 lg:hidden">
                  <div
                    class="grid size-12 place-items-center rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20"
                  >
                    PM
                  </div>
                  <div>
                    <h1 class="text-xl font-black text-blue-950">REGISTRO DE TIEMPOS</h1>
                    <p class="text-xs font-semibold text-slate-500">APLICATIVO PMO</p>
                  </div>
                </div>

                <div>
                  <p class="text-[11px] font-black uppercase tracking-[0.22em] text-blue-600">
                    Acceso seguro
                  </p>
                  <h2 class="mt-2 text-3xl font-black text-blue-950">Bienvenido</h2>
                  <p class="mt-2 text-sm text-slate-500">
                    Ingresa tus credenciales del aplicativo PMO para continuar.
                  </p>
                </div>

                @if (loginError()) {
                  <div
                    class="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                  >
                    {{ loginError() }}
                  </div>
                }

                <div class="mt-6 space-y-4">
                  <label class="flex flex-col gap-1">
                    <span class="text-xs font-bold text-slate-600">Email</span>
                    <input
                      class="rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      type="email"
                      autocomplete="username"
                      [(ngModel)]="email"
                      name="email"
                      required
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs font-bold text-slate-600">Contraseña</span>
                    <input
                      class="rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      type="password"
                      autocomplete="current-password"
                      [(ngModel)]="password"
                      name="password"
                      required
                    />
                  </label>
                </div>

                <button
                  class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  type="submit"
                  [disabled]="loggingIn()"
                >
                  @if (loggingIn()) {
                    <span
                      class="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    ></span>
                  }
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </section>
      } @else {
        <div class="flex h-screen overflow-hidden">
          <aside
            class="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-slate-200 bg-white p-3 transition-[width] duration-200 lg:flex lg:flex-col"
            [class.w-72]="sidebarExpanded()"
            [class.w-20]="!sidebarExpanded()"
          >
            <div
              class="mb-6 flex items-center gap-2"
              [class.justify-between]="sidebarExpanded()"
              [class.flex-col]="!sidebarExpanded()"
            >
              <div class="flex min-w-0 items-center gap-3">
                <div
                  class="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20"
                >
                  PM
                </div>
                @if (sidebarExpanded()) {
                  <div class="min-w-0">
                    <p class="font-black text-blue-950">PMO</p>
                    <p class="truncate text-xs text-slate-500" appOverflowTooltip tabindex="0">
                      Tiempos consultores
                    </p>
                  </div>
                }
              </div>
              <button
                class="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                type="button"
                [attr.aria-label]="sidebarExpanded() ? 'Cerrar menú lateral' : 'Abrir menú lateral'"
                [title]="sidebarExpanded() ? 'Cerrar menú' : 'Abrir menú'"
                (click)="sidebarExpanded.update((value) => !value)"
              >
                <svg
                  class="size-4 transition-transform"
                  [class.rotate-180]="sidebarExpanded()"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
            <nav class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
              <section>
                @if (sidebarExpanded()) {
                  <p
                    class="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"
                  >
                    Operación
                  </p>
                }
                <div class="space-y-1">
                  <a
                    class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                    [class.justify-center]="!sidebarExpanded()"
                    routerLink="/registros/importar"
                    routerLinkActive="bg-blue-50 !text-blue-700"
                    title="Importar tiempos"
                  >
                    <svg
                      class="size-5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"
                      />
                    </svg>
                    @if (sidebarExpanded()) {
                      <span class="whitespace-nowrap">Importar tiempos</span>
                    }
                  </a>
                  <a
                    class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                    [class.justify-center]="!sidebarExpanded()"
                    routerLink="/registros/consolidado"
                    routerLinkActive="bg-emerald-50 !text-emerald-700"
                    title="Reporte consolidado"
                  >
                    <svg
                      class="size-5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 19V5h16v14H4Zm4-4h2m2 0h4M8 11h8M8 8h8"
                      />
                    </svg>
                    @if (sidebarExpanded()) {
                      <span class="whitespace-nowrap">Reporte consolidado</span>
                    }
                  </a>
                  <a
                    class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                    [class.justify-center]="!sidebarExpanded()"
                    routerLink="/registros/reportes"
                    routerLinkActive="bg-slate-100 !text-slate-950"
                    title="Gestión de reportes"
                  >
                    <svg
                      class="size-5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M7 3h10l3 3v15H4V3h3Zm2 6h6m-6 4h6m-6 4h4"
                      />
                    </svg>
                    @if (sidebarExpanded()) {
                      <span class="whitespace-nowrap">Gestión de reportes</span>
                    }
                  </a>
                  <a
                    class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                    [class.justify-center]="!sidebarExpanded()"
                    routerLink="/registros/logs"
                    routerLinkActive="bg-cyan-50 !text-cyan-700"
                    title="Logs de envío"
                  >
                    <svg
                      class="size-5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 4h14v16H5V4Zm4 4h6M9 12h6M9 16h4"
                      />
                    </svg>
                    @if (sidebarExpanded()) {
                      <span class="whitespace-nowrap">Logs de envío</span>
                    }
                  </a>
                </div>
              </section>

              <section>
                @if (sidebarExpanded()) {
                  <p
                    class="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"
                  >
                    Análisis
                  </p>
                }
                <a
                  class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                  [class.justify-center]="!sidebarExpanded()"
                  routerLink="/registros/estadisticas"
                  routerLinkActive="bg-violet-50 !text-violet-700"
                  title="Estadísticas"
                >
                  <svg
                    class="size-5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 19V9m6 10V5m6 14v-7m4 7H2"
                    />
                  </svg>
                  @if (sidebarExpanded()) {
                    <span class="whitespace-nowrap">Estadísticas</span>
                  }
                </a>
              </section>

              <section>
                @if (sidebarExpanded()) {
                  <p
                    class="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"
                  >
                    Preferencias
                  </p>
                }
                <a
                  class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
                  [class.justify-center]="!sidebarExpanded()"
                  routerLink="/configuracion"
                  routerLinkActive="bg-amber-50 !text-amber-700"
                  title="Configuración"
                >
                  <svg
                    class="size-5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19 12l2-1-2-4-2 .5-1.5-1L15 4h-6l-.5 2.5-1.5 1L5 7l-2 4 2 1v2l-2 1 2 4 2-.5 1.5 1L9 22h6l.5-2.5 1.5-1 2 .5 2-4-2-1v-2Z"
                    />
                  </svg>
                  @if (sidebarExpanded()) {
                    <span class="whitespace-nowrap">Configuración</span>
                  }
                </a>
              </section>
            </nav>
          </aside>

          <div class="flex h-screen min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <nav
              class="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur"
            >
              <div class="flex-1">
                <div>
                  <p class="text-sm font-black text-blue-950">GESTIÓN DE TIEMPOS</p>
                  <p class="text-xs text-slate-500">Operación y análisis para consultores</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div
                  class="grid size-9 place-items-center rounded-full bg-blue-600 text-xs font-black text-white"
                >
                  {{ initials() }}
                </div>
                <span class="hidden text-sm font-bold text-slate-600 sm:inline">{{
                  auth.user()?.name
                }}</span>
                <button
                  class="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                  type="button"
                  (click)="logout()"
                >
                  Salir
                </button>
              </div>
            </nav>

            <router-outlet></router-outlet>
          </div>
        </div>
      }
      <app-playful-mascot />
    </main>
  `,
})
export class AppComponent implements OnDestroy {
  auth = inject(AuthGateway);
  parameters = inject(AppParametersFacade);
  private location = inject(LocationGateway);
  private audit = inject(UserAuditGateway);
  private router = inject(Router);
  private mascot = inject(PlayfulMascotService);
  email = '';
  password = '';
  loggingIn = signal(false);
  loginError = signal('');
  restoringSession = signal(true);
  sidebarExpanded = signal(false);
  private refreshId: number | null = null;
  private readonly navigationSubscription = this.router.events
    .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
    .subscribe(() => {
      this.mascot.play('page');
    });
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
          this.mascot.play('page');
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
        this.mascot.play('page');
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
    this.navigationSubscription.unsubscribe();
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
