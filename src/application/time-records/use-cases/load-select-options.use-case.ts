import {
  EMPTY,
  Observable,
  catchError,
  from,
  ignoreElements,
  map,
  mergeMap,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';

/** Gestiones de demanda de un cliente para el proyecto resuelto. */
export interface ClientManagementOptions {
  project: string;
  options: ManagementDemandOption[];
}

export class LoadSelectOptionsUseCase {
  /** Caché de sesión por cliente+proyecto: cada combinación se consulta una sola vez. */
  private readonly managementCache = new Map<string, Observable<ClientManagementOptions>>();

  constructor(private readonly repository: TimeRecordRepository) {}

  clientes(): Observable<string[]> {
    return this.repository.getClientes();
  }

  proyectos(cliente: string): Observable<string[]> {
    return this.repository.getProyectos(cliente);
  }

  solicitudes(cliente: string, proyecto: string): Observable<string[]> {
    return this.repository.getSolicitudes(cliente, proyecto);
  }

  solicitudOptions(cliente: string, proyecto: string): Observable<ManagementDemandOption[]> {
    return this.repository.getSolicitudOptions(cliente, proyecto);
  }

  /**
   * Gestiones del cliente, cacheadas. Sin `proyecto` usa el primer proyecto del cliente
   * (mismo criterio que la carga por fila). Si la consulta falla se descarta la entrada
   * para permitir reintentar.
   */
  managementOptions(cliente: string, proyecto = ''): Observable<ClientManagementOptions> {
    const key = this.managementKey(cliente, proyecto);
    const cached = this.managementCache.get(key);
    if (cached) return cached;

    const project$ = proyecto
      ? of(proyecto)
      : this.repository.getProyectos(cliente).pipe(map((proyectos) => proyectos[0] || ''));
    const request$ = project$.pipe(
      switchMap((project) =>
        this.repository.getSolicitudOptions(cliente, project).pipe(
          map((options) => ({
            project,
            options: options.map((option) => ({
              ...option,
              client: option.client || cliente,
              project: option.project || project,
            })),
          })),
        ),
      ),
      tap((result) => {
        // Alias por proyecto resuelto: al fijarse el proyecto en el registro no se vuelve a consultar.
        const resolvedKey = this.managementKey(cliente, result.project);
        if (!this.managementCache.has(resolvedKey))
          this.managementCache.set(resolvedKey, of(result));
      }),
      catchError((error) => {
        this.managementCache.delete(key);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.managementCache.set(key, request$);
    return request$;
  }

  /** Precarga las gestiones de todos los clientes con concurrencia limitada; ignora fallos. */
  preloadManagementOptions(clientes: readonly string[], concurrency = 4): Observable<never> {
    const unique = [...new Set(clientes.filter(Boolean))];
    return from(unique).pipe(
      mergeMap(
        (cliente) => this.managementOptions(cliente).pipe(catchError(() => EMPTY)),
        concurrency,
      ),
      ignoreElements(),
    );
  }

  /** Descarta la caché (p. ej. tras crear o editar gestiones). */
  clearManagementOptionsCache(): void {
    this.managementCache.clear();
  }

  private managementKey(cliente: string, proyecto: string): string {
    return `${cliente}\u0000${proyecto}`;
  }
}
