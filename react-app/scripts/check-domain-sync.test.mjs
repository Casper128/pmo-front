// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { allowedDifferences, checkDomainSync } from './check-domain-sync.mjs';

const roots = [];
const repository = 'time-records/repositories/time-record.repository.ts';
const angularRepository =
  "import { Observable } from 'rxjs';\nexport abstract class Repo {\n  abstract list(): Observable<string[]>;\n}\n";
const reactRepository = 'export abstract class Repo {\n  abstract list(): Promise<string[]>;\n}\n';

const tree = (root, files) => {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
};

const compare = (angularFiles, reactFiles) => {
  const root = mkdtempSync(join(tmpdir(), 'domain-sync-'));
  roots.push(root);
  tree(join(root, 'angular'), angularFiles);
  tree(join(root, 'react'), reactFiles);
  return checkDomainSync(join(root, 'angular'), join(root, 'react'));
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-domain-sync', () => {
  const base = { 'model.ts': 'export const a = 1;\n', [repository]: angularRepository };

  it('acepta copias idénticas y la excepción declarada del repositorio', () => {
    expect(compare(base, { 'model.ts': 'export const a = 1;\n', [repository]: reactRepository })).toEqual([]);
  });

  it('detecta contenido distinto, archivos faltantes y sobrantes', () => {
    expect(
      compare(base, { 'model.ts': 'export const a = 2;\n', [repository]: reactRepository, 'extra.ts': '' }),
    ).toEqual(['extra.ts: no existe en src/domain (Angular)', 'model.ts: el contenido difiere de src/domain']);
    expect(compare(base, { [repository]: reactRepository })).toEqual(['model.ts: falta en react-app/src/domain']);
  });

  it('ignora diferencias de fin de línea (CRLF/LF), también en la excepción', () => {
    const crlf = (text) => text.replaceAll('\n', '\r\n');
    expect(
      compare(
        { 'model.ts': crlf('export const a = 1;\nexport const b = 2;\n'), [repository]: crlf(angularRepository) },
        { 'model.ts': 'export const a = 1;\nexport const b = 2;\n', [repository]: reactRepository },
      ),
    ).toEqual([]);
  });

  it('detecta cambios en el repositorio más allá de la excepción declarada', () => {
    expect(
      compare(base, { 'model.ts': 'export const a = 1;\n', [repository]: reactRepository.replace('list', 'all') }),
    ).toEqual([`${repository}: difiere de la excepción declarada (${allowedDifferences[repository].reason})`]);
  });
});
