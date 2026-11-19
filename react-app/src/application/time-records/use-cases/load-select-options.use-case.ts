import type { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import type { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import { runWithConcurrency } from '@application/shared/run-with-concurrency';

/** Gestiones de demanda de un cliente para el proyecto resuelto. */
export interface ClientManagementOptions {
  project: string;
  options: ManagementDemandOption[];
}

export class LoadSelectOptionsUseCase {
  /** Caché de sesión por cliente+proyecto: cada combinación se consulta una sola vez. */
  private readonly managementCache = new Map<string, Promise<ClientManagementOptions>>();
  private readonly repository: TimeRecordRepository;

  constructor(repository: TimeRecordRepository) {
    this.repository = repository;
  }

  clientes(): Promise<string[]> {
    return this.repository.getClientes();
  }

  /**
   * Gestiones del cliente, cacheadas. Sin `proyecto` usa el primer proyecto del cliente
   * (mismo criterio que la carga por fila). Si la consulta falla se descarta la entrada
   * para permitir reintentar.
   */
  managementOptions(cliente: string, proyecto = ''): Promise<ClientManagementOptions> {
    const key = this.managementKey(cliente, proyecto);
    const cached = this.managementCache.get(key);
    if (cached) return cached;

    const request = this.requestManagementOptions(cliente, proyecto);
    this.managementCache.set(key, request);
    request.catch(() => {
      // Solo se borra si la entrada sigue siendo esta petición (no una posterior a un clear()).
      if (this.managementCache.get(key) === request) this.managementCache.delete(key);
    });
    return request;
  }

  /** Precarga las gestiones de todos los clientes con concurrencia limitada; ignora fallos. */
  async preloadManagementOptions(clientes: readonly string[], concurrency = 4): Promise<void> {
    const unique = [...new Set(clientes.filter(Boolean))];
    await runWithConcurrency(unique, concurrency, (cliente) =>
      this.managementOptions(cliente).catch(() => undefined),
    );
  }

  /** Descarta la caché (p. ej. tras crear o editar gestiones). */
  clearManagementOptionsCache(): void {
    this.managementCache.clear();
  }

  private async requestManagementOptions(
    cliente: string,
    proyecto: string,
  ): Promise<ClientManagementOptions> {
    const project = proyecto || (await this.repository.getProyectos(cliente))[0] || '';
    const options = await this.repository.getSolicitudOptions(cliente, project);
    const result: ClientManagementOptions = {
      project,
      options: options.map((option) => ({
        ...option,
        client: option.client || cliente,
        project: option.project || project,
      })),
    };
    // Alias por proyecto resuelto: al fijarse el proyecto en el registro no se vuelve a consultar.
    const resolvedKey = this.managementKey(cliente, result.project);
    if (!this.managementCache.has(resolvedKey))
      this.managementCache.set(resolvedKey, Promise.resolve(result));
    return result;
  }

  private managementKey(cliente: string, proyecto: string): string {
    return `${cliente}\u0000${proyecto}`;
  }
}
