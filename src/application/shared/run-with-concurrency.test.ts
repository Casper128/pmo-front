import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './run-with-concurrency';

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};

describe('runWithConcurrency', () => {
  it('procesa todos los elementos sin superar la concurrencia', async () => {
    const pending = new Map<number, () => void>();
    let active = 0;
    let maxActive = 0;
    const processed: number[] = [];

    const run = runWithConcurrency([1, 2, 3, 4, 5, 6], 4, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const gate = deferred();
      pending.set(item, gate.resolve);
      await gate.promise;
      processed.push(item);
      active -= 1;
    });

    await Promise.resolve();
    expect([...pending.keys()]).toEqual([1, 2, 3, 4]);
    for (let item = 1; item <= 6; item += 1) {
      while (!pending.has(item)) await Promise.resolve();
      pending.get(item)?.();
    }
    await run;

    expect(maxActive).toBe(4);
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('resuelve sin elementos y trata una concurrencia inválida como 1', async () => {
    await expect(runWithConcurrency([], 4, async () => undefined)).resolves.toBeUndefined();
    const order: number[] = [];
    await runWithConcurrency([1, 2], 0, async (item) => {
      order.push(item);
    });
    expect(order).toEqual([1, 2]);
  });
});
