import { TimeRecordApiBody, TimeRecordRegistrationResponse } from '../models/time-record-api.model';
import { ManagementDemandOption } from '../models/management-template.model';

export abstract class TimeRecordRepository {
  abstract register(body: TimeRecordApiBody): Promise<TimeRecordRegistrationResponse>;
  abstract getClientes(): Promise<string[]>;
  abstract getProyectos(cliente: string): Promise<string[]>;
  abstract getSolicitudes(cliente: string, proyecto: string): Promise<string[]>;
  abstract getSolicitudOptions(
    cliente: string,
    proyecto: string,
  ): Promise<ManagementDemandOption[]>;
}
