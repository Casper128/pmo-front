export interface SendLog {
  id: string;
  userKey: string;
  userEmail: string;
  itemIndex: number;
  successful: boolean;
  reference: string;
  errorMessage: string;
  occurredAt: string;
  weekStart: string;
  weekEnd: string;
  expiresAt: string;
}

export interface CreateSendLog {
  itemIndex: number;
  successful: boolean;
  reference: string;
  errorMessage?: string;
}

export interface SendLogQuery {
  dateFrom: string;
  dateTo: string;
  scope?: 'own' | 'all';
}

export interface SendLogCollection {
  logs: SendLog[];
  isAdmin: boolean;
  retentionDays: number;
}
