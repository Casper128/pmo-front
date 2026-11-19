// @vitest-environment node
import { ESLint } from 'eslint';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: resolve(import.meta.dirname, '..') });

/** Reglas que fallan al lintar `code` como si estuviera en `filePath` (sin escribir el archivo). */
const failingRules = async (filePath, code) => {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
};

const source = [
  "import { TimeRecord } from '@domain/time-records/models/time-record.model';",
  'export enum Phase { Idle }',
  'export class UseCase {',
  '  constructor(private readonly record: TimeRecord) {}',
  '}',
  '',
].join('\n');

describe('ESLint · compensación de las opciones de tsconfig desactivadas', () => {
  it('fuera de domain exige import type y prohíbe enum y parameter properties', async () => {
    const rules = await failingRules('src/application/fixture.ts', source);
    expect(rules).toContain('@typescript-eslint/consistent-type-imports');
    expect(rules.filter((rule) => rule === 'no-restricted-syntax')).toHaveLength(2);
  });

  it('en src/domain (copia de Angular) no aplica esas reglas', async () => {
    const rules = await failingRules('src/domain/fixture.ts', source);
    expect(rules).not.toContain('@typescript-eslint/consistent-type-imports');
    expect(rules).not.toContain('no-restricted-syntax');
  });

  it('fuera de domain detecta miembros private sin usar (TS private y #private)', async () => {
    const code = [
      'export class Store {',
      '  private readonly unused = 1;',
      '  private readonly used = 2;',
      '  #hidden = 3;',
      '  private helper(): number { return this.used; }',
      '  value(): number { return this.used; }',
      '}',
      '',
    ].join('\n');
    const messages = async (filePath) => {
      const [result] = await eslint.lintText(code, { filePath });
      return result.messages
        .filter((message) => message.ruleId === '@typescript-eslint/no-unused-private-class-members')
        .map((message) => message.message);
    };
    expect(await messages('src/infrastructure/fixture.ts')).toEqual([
      "Private class member 'unused' is defined but never used.",
      "Private class member '#hidden' is defined but never used.",
      "Private class member 'helper' is defined but never used.",
    ]);
    expect(await messages('src/domain/fixture.ts')).toEqual([]);
  });
});

describe('ESLint · fetch fuera de infrastructure (corrección QA F4)', () => {
  const code = "export const load = () => fetch('/api');\n";
  const fetchMessages = async (filePath) => {
    const [result] = await eslint.lintText(code, { filePath });
    return result.messages.filter((message) => message.ruleId === 'no-restricted-globals');
  };

  it.each([
    ['src/domain/fixture.ts'],
    ['src/application/fixture.ts'],
    ['src/presentation/fixture.tsx'],
    ['src/main.tsx'],
  ])('prohíbe el fetch global en %s con un mensaje claro', async (filePath) => {
    const messages = await fetchMessages(filePath);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('fetch solo se usa en src/infrastructure');
  });

  it('infrastructure sí puede usar fetch', async () => {
    expect(await fetchMessages('src/infrastructure/fixture.ts')).toEqual([]);
  });
});
