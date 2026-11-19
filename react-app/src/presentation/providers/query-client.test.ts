import { FakeAuthGateway, testUser } from '@/test/fakes/fake-auth';
import { createQueryClient } from './query-client';

describe('createQueryClient', () => {
  it('reintenta una vez, nunca ante sesión expirada (401/403), y no refresca al enfocar', () => {
    const client = createQueryClient(new FakeAuthGateway());
    const { retry, refetchOnWindowFocus, staleTime } = client.getDefaultOptions().queries ?? {};
    if (typeof retry !== 'function') throw new Error('retry debe ser una función');

    expect(retry(0, new Error('red'))).toBe(true);
    expect(retry(1, new Error('red'))).toBe(false);
    expect(retry(0, { status: 401 })).toBe(false);
    expect(retry(0, { status: 403 })).toBe(false);
    expect(refetchOnWindowFocus).toBe(false);
    expect(staleTime).toBe(30_000);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('cierra sesión si una consulta falla con sesión expirada', async () => {
    const auth = new FakeAuthGateway({ user: testUser });
    const client = createQueryClient(auth);

    await expect(
      client.fetchQuery({ queryKey: ['x'], queryFn: () => Promise.reject({ status: 500 }), retry: false }),
    ).rejects.toEqual({ status: 500 });
    expect(auth.isLoggedIn()).toBe(true);

    await expect(
      client.fetchQuery({ queryKey: ['y'], queryFn: () => Promise.reject({ status: 401 }), retry: false }),
    ).rejects.toEqual({ status: 401 });
    expect(auth.isLoggedIn()).toBe(false);
  });
});
