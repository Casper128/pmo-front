/**
 * Ejecuta `task` sobre cada elemento con como máximo `concurrency` tareas a la vez y espera a que
 * terminen todas. Equivale al `mergeMap(task, concurrency)` de la app Angular. Un rechazo de `task` rechaza el
 * resultado (los consumidores que quieran ignorar fallos los capturan dentro de `task`).
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<unknown>,
): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  };
  const workers = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
}
