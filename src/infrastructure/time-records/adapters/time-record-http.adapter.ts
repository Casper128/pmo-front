import type { AuthGateway } from '@application/auth/auth.gateway';
import type { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import type {
  TimeRecordApiBody,
  TimeRecordRegistrationResponse,
} from '@domain/time-records/models/time-record-api.model';
import type { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import type { Environment } from '@env/environment';
import type { HttpClient } from '../../http/http-client';
import { TimeRecordOptionsMapper } from '../mappers/time-record-options.mapper';

type CollectionResponse =
  | unknown[]
  | { clientes?: unknown[]; proyectos?: unknown[]; solicitudes?: unknown[]; data?: unknown[] };

/** Registro y opciones de selects contra la API PMO. Las consultas de opciones devuelven [] si fallan. */
export class TimeRecordHttpAdapter implements TimeRecordRepository {
  private readonly mapper = new TimeRecordOptionsMapper();
  private readonly http: HttpClient;
  private readonly auth: AuthGateway;
  private readonly env: Environment;

  constructor(http: HttpClient, auth: AuthGateway, env: Environment) {
    this.http = http;
    this.auth = auth;
    this.env = env;
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.auth.token}` };
  }

  register(body: TimeRecordApiBody): Promise<TimeRecordRegistrationResponse> {
    return this.http.post<TimeRecordRegistrationResponse>(
      `${this.env.apiBaseUrl}/tiemposConsultores/registrar`,
      body,
      { headers: this.headers },
    );
  }

  async getClientes(): Promise<string[]> {
    try {
      const d = await this.http.post<CollectionResponse>(
        `${this.env.apiBaseUrl}/tiemposConsultores/clientes`,
        {},
        { headers: this.headers },
      );
      const lista = this.mapper.collection(d, 'clientes');
      return lista.map((c) => this.mapper.optionValue(c, ['cliente', 'nombre', 'id'])).filter(Boolean);
    } catch {
      return [];
    }
  }

  async getProyectos(cliente: string): Promise<string[]> {
    try {
      const d = await this.http.post<CollectionResponse>(
        `${this.env.apiBaseUrl}/tiemposConsultores/proyectos/${encodeURIComponent(cliente)}`,
        {},
        { headers: this.headers },
      );
      const lista = this.mapper.collection(d, 'proyectos');
      return lista.map((p) => this.mapper.optionValue(p, ['proyecto', 'nombre', 'id'])).filter(Boolean);
    } catch {
      return [];
    }
  }

  async getSolicitudes(cliente: string, proyecto: string): Promise<string[]> {
    const options = await this.getSolicitudOptions(cliente, proyecto);
    return options.map((s) => s.requestValue || s.name);
  }

  async getSolicitudOptions(cliente: string, proyecto: string): Promise<ManagementDemandOption[]> {
    try {
      const d = await this.http.post<CollectionResponse>(
        `${this.env.apiBaseUrl}/tiemposConsultores/solicitudes?cliente=${encodeURIComponent(cliente)}&proyecto=${encodeURIComponent(proyecto)}`,
        {},
        { headers: this.headers },
      );
      const lista = this.mapper.collection(d, 'solicitudes');
      return lista.map((s) => this.mapper.demandOption(s)).filter((s) => s.id && s.name);
    } catch {
      return [];
    }
  }
}
