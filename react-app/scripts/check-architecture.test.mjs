// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeSource, checkArchitecture } from './check-architecture.mjs';

const roots = [];

/** Crea un proyecto temporal con las cuatro capas, un package.json y los archivos indicados. */
const fixture = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'check-architecture-'));
  roots.push(root);
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      dependencies: { react: '*', zod: '*', 'chart.js': '*' },
      devDependencies: { vitest: '*', rxjs: '*', '@angular/core': '*', '@tanstack/react-query': '*' },
    }),
  );
  for (const layer of ['domain', 'application', 'infrastructure', 'presentation']) {
    mkdirSync(join(root, 'src', layer), { recursive: true });
  }
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(root, 'src', path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
  return root;
};

const violationsOf = (files) => checkArchitecture(fixture(files));

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-architecture', () => {
  it('acepta un proyecto válido con composition root y specs de dominio', () => {
    expect(
      violationsOf({
        'domain/model.ts': "export interface Model { id: string }\n",
        'domain/model.spec.ts': "import { it } from 'vitest';\nimport { Model } from './model';\nit('x', () => undefined as unknown as Model);\n",
        'application/use-case.ts': "import { Model } from '@domain/model';\nexport type Out = Model;\n",
        'infrastructure/adapter.ts': "export class Adapter { fetch(url: string) { return url; } }\nexport const call = (a: Adapter) => a.fetch('x');\n",
        'presentation/providers/container.ts': "import { Adapter } from '@infrastructure/adapter';\nexport const container = { Adapter };\n",
        'config/environment.ts': "import { z } from 'zod';\nexport const schema = z.string();\n",
        'shared/lib/format.ts': "export const upper = (value: string) => value.toUpperCase();\n",
        'test/fakes.ts': "import { Model } from '@domain/model';\nexport const fake: Model = { id: '1' };\n",
        'presentation/page.test.tsx': "import { fake } from '@/test/fakes';\nexport const used = fake;\n",
      }),
    ).toEqual([]);
  });

  it('exige las cuatro capas', () => {
    const root = fixture({});
    rmSync(join(root, 'src', 'application'), { recursive: true });
    expect(checkArchitecture(root)).toContain('src/application: falta la capa src/application');
  });

  it('domain solo admite vitest como paquete externo y no puede salir de sí mismo', () => {
    const violations = violationsOf({
      'domain/bad.ts': [
        "import { z } from 'zod';",
        "import { Observable } from 'rxjs';",
        "import { Adapter } from '../infrastructure/adapter';",
        'export const value = [z, Observable, Adapter];',
      ].join('\n'),
    });
    expect(violations).toContain('src/domain/bad.ts: domain solo puede importar paquetes permitidos (vitest), ni módulos de Node');
    expect(violations).toContain('src/domain/bad.ts: domain solo puede depender de sí mismo');
  });

  it('prohíbe archivos .tsx en domain y application', () => {
    const violations = violationsOf({
      'domain/view.tsx': 'export const view = 1;\n',
      'application/view.tsx': 'export const view = 1;\n',
    });
    expect(violations).toContain('src/domain/view.tsx: domain no puede contener archivos .tsx');
    expect(violations).toContain('src/application/view.tsx: application no puede contener archivos .tsx');
  });

  it('detecta require() y import() dinámico', () => {
    const violations = violationsOf({
      'application/legacy.ts': "const rx = require('rxjs');\nexport const lazy = () => import('@presentation/page');\nexport { rx };\n",
    });
    expect(violations).toContain('src/application/legacy.ts: application no puede importar rxjs');
    expect(violations).toContain(
      'src/application/legacy.ts: application solo puede depender de domain y de sí misma',
    );
  });

  it('aplica las reglas de application, infrastructure y presentation', () => {
    const violations = violationsOf({
      'application/angular.ts': "import { Injectable } from '@angular/core';\nimport { useQuery } from '@tanstack/react-query';\nexport const x = [Injectable, useQuery];\n",
      'infrastructure/ui.ts': "import { useState } from 'react';\nimport { Page } from '@presentation/page';\nexport const x = [useState, Page];\n",
      'presentation/page.tsx': "import { Adapter } from '@/infrastructure/adapter';\nexport const load = () => fetch('/api');\nexport const x = Adapter;\n",
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/application/angular.ts: application no puede importar Angular',
        'src/application/angular.ts: application no puede importar @tanstack',
        'src/infrastructure/ui.ts: infrastructure no puede importar React',
        'src/infrastructure/ui.ts: infrastructure no puede depender de presentation ni de la UI',
        'src/presentation/page.tsx: presentation debe usar puertos de application, no implementaciones de infrastructure',
        'src/presentation/page.tsx: presentation no puede usar fetch',
      ]),
    );
  });

  it('da reglas a shared/lib, config y test', () => {
    const violations = violationsOf({
      'shared/lib/bad.ts': "import { Page } from '@presentation/page';\nexport const x = Page;\n",
      'config/bad.ts': "import { Adapter } from '@infrastructure/adapter';\nexport const x = Adapter;\n",
      'test/bad.ts': "import { Adapter } from '../infrastructure/adapter';\nexport const x = Adapter;\n",
      'presentation/uses-test.ts': "import { fake } from '@/test/fakes';\nexport const x = fake;\n",
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/shared/lib/bad.ts: shared/lib es utilitario: no puede depender de capas ni de UI',
        'src/config/bad.ts: config no puede depender de application, infrastructure, presentation ni UI',
        'src/test/bad.ts: src/test contiene dobles: no puede depender de infrastructure',
        'src/presentation/uses-test.ts: solo los tests y src/test pueden importar src/test',
      ]),
    );
  });

  it('detecta window, localStorage, fetch y any en código real', () => {
    const violations = violationsOf({
      'domain/bad.ts': 'export const read = (): any => [window.location, localStorage, fetch("/x")];\n',
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/domain/bad.ts: no se permite any explícito',
        'src/domain/bad.ts: domain no puede usar fetch',
        'src/domain/bad.ts: domain no puede usar localStorage ni sessionStorage',
        'src/domain/bad.ts: domain no puede usar window',
      ]),
    );
  });

  it('ignora comentarios de fin de línea, strings y métodos propios .fetch()', () => {
    expect(
      violationsOf({
        'domain/clean.ts': [
          'export const label = "window.open o fetch( o x: any";',
          "export const tip = 'no use localStorage';",
          'export const total = 1; // window.location y fetch( en comentario: any',
          '/* : any */',
          'export const tpl = `${label}: any window.x`;',
          'export class Repo { fetch(): number { return 1; } }',
          'export const n = new Repo().fetch();',
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('detecta primitivos UI hechos a mano y chart.js fuera de shared/ui', () => {
    const violations = violationsOf({
      'presentation/raw.tsx': [
        "import { Chart } from 'chart.js';",
        'export const Raw = () => (',
        '  <div role="dialog"><select /><table /><dialog /><input type="date" />{String(new Chart("c", {}))}</div>',
        ');',
      ].join('\n'),
      'shared/ui/table.tsx': 'export const Table = () => <table />;\n',
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/presentation/raw.tsx: use Shadcn Chart (Recharts), no chart.js',
        'src/presentation/raw.tsx: use Shadcn Chart (Recharts), no Chart.js',
        'src/presentation/raw.tsx: use Shadcn Select/Combobox, no <select>',
        'src/presentation/raw.tsx: use TanStack Table + Shadcn Table, no <table>',
        'src/presentation/raw.tsx: use Shadcn Dialog/Sheet, no <dialog>',
        'src/presentation/raw.tsx: use Shadcn Dialog/Sheet, no role="dialog"',
        'src/presentation/raw.tsx: use Shadcn Calendar + Popover, no type="date"',
      ]),
    );
    expect(violations.some((violation) => violation.startsWith('src/shared/ui/'))).toBe(false);
  });

  it('exige que los paquetes importados estén declarados (evita resolver ../node_modules)', () => {
    expect(
      violationsOf({ 'presentation/leaflet.ts': "import L from 'leaflet';\nexport const map = L;\n" }),
    ).toContain('src/presentation/leaflet.ts: paquete no declarado en package.json: leaflet');
  });

  it('prohíbe la URL de la API PMO en el código', () => {
    expect(
      violationsOf({
        'infrastructure/api.ts': "export const url = 'https://abc123.execute-api.us-west-2.amazonaws.com/dev';\n",
      }),
    ).toContain('src/infrastructure/api.ts: la URL de PMO debe provenir de .env (VITE_API_BASE_URL)');
  });
});

describe('check-architecture · correcciones QA F1', () => {
  const fetchViolation = 'src/presentation/load.ts: presentation no puede usar fetch';

  it.each([
    ["fetch(buildUrl('x'));"],
    ['fetch(u, { headers: h() });'],
    ["globalThis.fetch('/api');"],
    ["window.fetch('/api');"],
    ["self.fetch('/api');"],
    ["window?.fetch('/api');"],
    ['export const t = `${await fetch(u)}`;'],
    ["export const t = `a ${`b ${fetch('/x')}`}`;"],
  ])('detecta el fetch global en %s', (line) => {
    expect(violationsOf({ 'presentation/load.ts': `${line}\n` })).toContain(fetchViolation);
  });

  it.each([
    ["repo.fetch('/x');"],
    ['this.client.fetch(u, { a: 1 });'],
    ['class Repo { fetch() { return 1; } }'],
    ['class Repo { async fetch(id: string, options: { a: number }): Promise<number> { return 1; } }'],
    ['const tip = `texto fetch( literal`;'],
  ])('no marca métodos propios, definiciones ni texto: %s', (line) => {
    expect(violationsOf({ 'presentation/load.ts': `${line}\n` })).not.toContain(fetchViolation);
  });

  it('detecta localStorage y sessionStorage con receptor global en domain', () => {
    const storage = 'src/domain/store.ts: domain no puede usar localStorage ni sessionStorage';
    expect(violationsOf({ 'domain/store.ts': "export const a = globalThis.localStorage;\n" })).toContain(storage);
    expect(violationsOf({ 'domain/store.ts': 'export const a = sessionStorage;\n' })).toContain(storage);
  });

  it('no confunde // ni comillas dentro de un literal regex', () => {
    expect(
      violationsOf({
        'domain/regex.ts': [
          "export const url = /https?:\\/\\/[^'\"]+/; export const x = window.location;",
          "export const quote = /['\"]/g.test('a'); export const y = fetch('/z');",
        ].join('\n'),
      }),
    ).toEqual(
      expect.arrayContaining([
        'src/domain/regex.ts: domain no puede usar window',
        'src/domain/regex.ts: domain no puede usar fetch',
      ]),
    );
  });

  it('prohíbe node:* en domain y application, pero no lo reporta como paquete no declarado', () => {
    const violations = violationsOf({
      'domain/fs.ts': "import { readFileSync } from 'node:fs';\nexport const r = readFileSync;\n",
      'application/path.ts': "import { join } from 'node:path';\nexport const j = join;\n",
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/domain/fs.ts: domain solo puede importar paquetes permitidos (vitest), ni módulos de Node',
        'src/application/path.ts: application no puede importar módulos de Node',
      ]),
    );
    expect(violations.some((violation) => violation.includes('no declarado'))).toBe(false);
  });

  it('no trata imports absolutos de public/ como paquetes', () => {
    expect(
      violationsOf({ 'presentation/logo.ts': "import logo from '/logo.svg';\nexport const l = logo;\n" }),
    ).toEqual([]);
  });
});

describe('texto JSX en .tsx (correcciones QA F2)', () => {
  const fetchViolation = 'src/presentation/view.tsx: presentation no puede usar fetch';

  it.each([
    ["export const V = () => <p>Don't {fetch('x')}</p>;"],
    ["export const V = () => <a>http://x {fetch('y')}</a>;"],
    ["export const V = () => (\n  <div>\n    <p>It's</p>\n    {items.map((i) => <span key={i}>{fetch(i)}</span>)}\n  </div>\n);"],
    ["export const V = () => <Button onClick={() => fetch('/x')} title=\"Don't\">Ok</Button>;"],
    ["export const V = () => <>Don't {cond ? <b>a</b> : fetch('z')}</>;"],
    ["export const f = <T,>(x: T) => fetch(String(x));"],
    ["export const g = <T extends string>(x: T) => fetch(x);"],
  ])('sigue analizando las expresiones {…} y el código: %s', (line) => {
    expect(violationsOf({ 'presentation/view.tsx': `${line}\n` })).toContain(fetchViolation);
  });

  it('el texto entre etiquetas no es código ni abre strings o comentarios', () => {
    expect(
      violationsOf({
        'presentation/view.tsx': [
          "export const V = () => <p>Don't use fetch(x) ni window.open: any</p>;",
          'export const W = () => <a href="http://x">http://x fetch(y)</a>;',
          'export const n = 1;',
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('los atributos y el texto JSX no son código; las expresiones sí', () => {
    const { facts, literals } = analyzeSource(
      "const v = <p title=\"Don't fetch(x)\">It's {f('a')} // no</p>; // fin",
      'view.tsx',
    );
    expect(facts.has('fetch')).toBe(false);
    expect(literals).toEqual(expect.arrayContaining(["Don't fetch(x)", "a"]));
  });

  it('las comparaciones y genéricos no se toman como JSX', () => {
    expect(
      violationsOf({
        'presentation/view.tsx':
          "export const a = (b: number, c: number) => b < c && c > b;\nexport const s = new Map<string, string>();\nexport const x = fetch('/z');\n",
      }),
    ).toContain(fetchViolation);
  });

  it('en .ts las aserciones <T>x no son JSX', () => {
    expect(
      violationsOf({
        'presentation/cast.ts': "const y: unknown = 1;\nexport const x = <number>y; export const z = fetch('/a');\n",
      }),
    ).toEqual(['src/presentation/cast.ts: presentation no puede usar fetch']);
  });
});

describe('check-architecture · AST (correcciones QA F3)', () => {
  const fetchViolation = 'src/presentation/view.tsx: presentation no puede usar fetch';

  it.each([
    ["type Fn = <T>(x: T) => T;\nexport const id: Fn = (x) => x;\nexport const r = fetch('/x');"],
    ["export const f = <const T,>(x: T) => fetch(String(x));"],
    ["export const g = <T = string>(x: T) => fetch(String(x));"],
    ["export const V = () => <div /* {fetch('no')} */ title=\"a\">{fetch('/x') && 'ok'}</div>;"],
    ["export const h = () => globalThis?.['fetch']('/x');"],
  ])('sin falsos negativos tras genéricos o comentarios: %s', (line) => {
    expect(violationsOf({ 'presentation/view.tsx': `${line}\n` })).toContain(fetchViolation);
  });

  it('detecta primitivos con comentarios dentro de la etiqueta y valores en plantilla o expresión', () => {
    const violations = violationsOf({
      'presentation/raw.tsx': [
        'export const A = () => <select /* comentario */ name="a"></select>;',
        'export const B = () => <div role={`dialog`} />;',
        "export const C = () => <div role={'dialog'} />;",
        'export const D = () => <Input /* x */ type={"date"} />;',
        'const Input = (props: { type: string }) => <span>{props.type}</span>;',
      ].join('\n'),
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/presentation/raw.tsx: use Shadcn Select/Combobox, no <select>',
        'src/presentation/raw.tsx: use Shadcn Dialog/Sheet, no role="dialog"',
        'src/presentation/raw.tsx: use Shadcn Calendar + Popover, no type="date"',
      ]),
    );
  });

  it('sin falsos positivos por texto, strings, componentes o plantillas dinámicas', () => {
    expect(
      violationsOf({
        'presentation/text.tsx': [
          "export const tip = '<select> y <table> y role=\"dialog\" y type=\"date\"';",
          "export const V = () => <p>No use {'<select>'} ni &lt;table&gt; ni new Chart(x)</p>;",
          'export const W = ({ kind }: { kind: string }) => <div role={`dialog-${kind}`} data-type="date" />;',
          'export const T = () => <Table><Select /></Table>;',
          'const Table = (p: { children: unknown }) => <div>{String(p.children)}</div>;',
          'const Select = () => <span />;',
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('detecta any en cualquier posición de tipo, pero no en texto ni nombres', () => {
    const anyViolation = 'src/presentation/types.ts: no se permite any explícito';
    for (const line of [
      'export type A = Array<any>;',
      'export type B = Record<string, any>;',
      'export const c = (x: unknown) => x as any;',
      'export type D = { [k: string]: any };',
      'export type E = any[];',
    ]) {
      expect(violationsOf({ 'presentation/types.ts': `${line}\n` })).toContain(anyViolation);
    }
    expect(
      violationsOf({
        'presentation/types.ts': "export const any = 'any';\nexport const label = { any: 1 }; // : any\n",
      }),
    ).toEqual([]);
  });

  it('detecta export from, import type, import = require y tipos import()', () => {
    const violations = violationsOf({
      'application/reexport.ts': "export { useQuery } from '@tanstack/react-query';\n",
      'application/types.ts': "import type { Observable } from 'rxjs';\nexport type O = Observable<number>;\n",
      'application/eq.ts': "import rx = require('rxjs');\nexport const r = rx;\n",
      'application/type-import.ts': "export type P = typeof import('@presentation/page');\n",
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/application/reexport.ts: application no puede importar @tanstack',
        'src/application/types.ts: application no puede importar rxjs',
        'src/application/eq.ts: application no puede importar rxjs',
        'src/application/type-import.ts: application solo puede depender de domain y de sí misma',
      ]),
    );
  });

  it('domain: detecta document y accesos globales, no propiedades ni declaraciones homónimas', () => {
    expect(
      violationsOf({ 'domain/dom.ts': 'export const t = () => document.title + globalThis.window;\n' }),
    ).toEqual(
      expect.arrayContaining([
        'src/domain/dom.ts: domain no puede usar document',
        'src/domain/dom.ts: domain no puede usar window',
      ]),
    );
    expect(
      violationsOf({
        'domain/clean.ts': [
          'export interface Doc { document: string; window: number; localStorage?: boolean }',
          'export const read = (d: Doc) => [d.document, d.window, d.localStorage];',
          'export const build = (document: string, size: number) => ({ document: size, window: 1 });',
        ].join('\n'),
      }),
    ).toEqual([]);
  });
});

describe('check-architecture · correcciones QA F4', () => {
  const placement =
    'ubicación no permitida: el código va en src/{domain,application,infrastructure,presentation,shared/ui,shared/hooks,shared/lib,config,test} (o src/main.tsx)';

  it('falla ante archivos fuera de las carpetas permitidas', () => {
    const violations = violationsOf({
      'utils/format.ts': 'export const x = 1;\n',
      'helpers.ts': 'export const y = 1;\n',
      'shared/components/button.tsx': 'export const B = () => <span />;\n',
      'shared/format.ts': 'export const z = 1;\n',
      'App.tsx': 'export const App = () => <div />;\n',
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        `src/utils/format.ts: ${placement}`,
        `src/helpers.ts: ${placement}`,
        `src/shared/components/button.tsx: ${placement}`,
        `src/shared/format.ts: ${placement}`,
        `src/App.tsx: ${placement}`,
      ]),
    );
  });

  it('acepta todas las carpetas permitidas y src/main.tsx', () => {
    expect(
      violationsOf({
        'shared/ui/button.tsx': 'export const Button = () => <button />;\n',
        'shared/hooks/use-mobile.ts': 'export const useMobile = () => false;\n',
        'shared/lib/utils.ts': 'export const noop = () => undefined;\n',
        'config/environment.ts': 'export const env = {};\n',
        'test/setup.ts': 'export {};\n',
        'main.tsx': 'export const root = <div />;\n',
      }),
    ).toEqual([]);
  });

  it('src/main.tsx es presentation: puede crear infraestructura como el composition root', () => {
    expect(
      violationsOf({
        'infrastructure/adapter.ts': 'export class Adapter {}\n',
        'main.tsx': "import { Adapter } from '@infrastructure/adapter';\nexport const a = new Adapter();\n",
      }),
    ).toEqual([]);
  });

  it('src/main.tsx sigue las demás reglas de presentation', () => {
    const violations = violationsOf({
      'main.tsx': [
        "import { fake } from '@/test/fakes';",
        "export const load = () => fetch('/api');",
        'export const V = () => <select />;',
        'export const f = fake;',
      ].join('\n'),
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/main.tsx: presentation no puede usar fetch',
        'src/main.tsx: solo los tests y src/test pueden importar src/test',
        'src/main.tsx: use Shadcn Select/Combobox, no <select>',
      ]),
    );
    expect(violations).not.toContain(`src/main.tsx: ${placement}`);
  });

  it('el composition root solo exime a container.ts y main.tsx', () => {
    expect(
      violationsOf({
        'infrastructure/adapter.ts': 'export class Adapter {}\n',
        'presentation/providers/other.ts': "import { Adapter } from '@infrastructure/adapter';\nexport const a = Adapter;\n",
      }),
    ).toContain(
      'src/presentation/providers/other.ts: presentation debe usar puertos de application, no implementaciones de infrastructure',
    );
  });

  it.each([
    ['presentation/uses-test.ts'],
    ['application/uses-test.ts'],
    ['infrastructure/uses-test.ts'],
    ['domain/uses-test.ts'],
    ['shared/lib/uses-test.ts'],
  ])('importar src/test fuera de tests da un único mensaje (%s)', (path) => {
    expect(
      violationsOf({ [path]: "import { fake } from '@/test/fakes';\nexport const x = fake;\n" }),
    ).toEqual([`src/${path}: solo los tests y src/test pueden importar src/test`]);
  });

  it('los tests de cualquier capa pueden importar src/test', () => {
    expect(
      violationsOf({
        'domain/model.spec.ts': "import { fake } from '@/test/fakes';\nexport const x = fake;\n",
        'application/use-case.test.ts': "import { fake } from '../test/fakes';\nexport const x = fake;\n",
        'infrastructure/adapter.test.ts': "import { fake } from '@/test/fakes';\nexport const x = fake;\n",
      }),
    ).toEqual([]);
  });

  it('prohíbe role="alertdialog" y los inputs nativos de fecha, pero permite type="time" (P5)', () => {
    const violations = violationsOf({
      'presentation/raw.tsx': [
        'export const A = () => <div role="alertdialog" />;',
        "export const B = () => <input type={'datetime-local'} />;",
        'export const C = () => <Input type="month" />;',
        'export const D = () => <Input type={`week`} />;',
        'const Input = (props: { type: string }) => <span>{props.type}</span>;',
      ].join('\n'),
    });
    expect(violations).toEqual(
      expect.arrayContaining([
        'src/presentation/raw.tsx: use Shadcn AlertDialog, no role="alertdialog"',
        'src/presentation/raw.tsx: use Shadcn Calendar + Popover, no type="datetime-local"',
        'src/presentation/raw.tsx: use Shadcn Calendar + Popover, no type="month"',
        'src/presentation/raw.tsx: use Shadcn Calendar + Popover, no type="week"',
      ]),
    );
    expect(
      violationsOf({
        'presentation/time.tsx': [
          'export const T = () => <Input type="time" step={60} />;',
          'const Input = (props: { type: string; step: number }) => <span>{props.type}</span>;',
        ].join('\n'),
      }),
    ).toEqual([]);
  });
});
