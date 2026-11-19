import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { relevantRequests } from './use-my-delete-requests';

const request = (identifier: string, status: ManagementDeleteRequest['status'], requestedAt: string): ManagementDeleteRequest => ({
  id: `${identifier}-${status}-${requestedAt}`,
  identifier,
  requesterKey: 'k',
  requesterEmail: 'consultor@example.test',
  auditorEmail: 'auditor@example.test',
  report: {},
  status,
  requestedAt,
});

describe('relevantRequests', () => {
  it('prefiere la pendiente; si no, la rechazada más reciente; ignora aprobadas y canceladas', () => {
    const result = relevantRequests([
      request('A', 'rejected', '2026-09-01'),
      request('A', 'pending', '2026-08-01'),
      request('B', 'rejected', '2026-09-01'),
      request('B', 'rejected', '2026-09-05'),
      request('C', 'approved', '2026-09-01'),
      request('D', 'cancelled', '2026-09-01'),
    ]);
    expect(result.get('A')?.status).toBe('pending');
    expect(result.get('B')?.requestedAt).toBe('2026-09-05');
    expect([...result.keys()]).toEqual(['A', 'B']);
  });
});
