import type {
  CreateSendLog,
  SendLogCollection,
  SendLogQuery,
} from '@domain/time-records/models/send-log.model';

export abstract class SendLogGateway {
  abstract create(log: CreateSendLog): Promise<void>;
  abstract createMany(logs: CreateSendLog[]): Promise<void>;
  abstract list(query: SendLogQuery): Promise<SendLogCollection>;
}
