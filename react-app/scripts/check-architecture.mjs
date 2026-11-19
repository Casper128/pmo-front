// Verifica las reglas de Clean Architecture de react-app (docs/migration-plan.md §4.3).
// Port de ../scripts/check-architecture.mjs (Angular) para .ts/.tsx. Analiza el AST con la API del
// compilador de TypeScript (`typescript`, ya en devDependencies): comentarios, strings, texto JSX y
// genéricos no generan falsos positivos ni ocultan código.
// Uso: `node scripts/check-architecture.mjs`. `checkArchitecture(root)` se exporta para sus tests.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const requiredLayers = ['domain', 'application', 'infrastructure', 'presentation'];
/** Punto de entrada de Vite: se analiza como presentation. */
const entryPoint = 'main.tsx';
/** Únicos archivos de presentation que pueden importar infrastructure (crean el grafo de dependencias). */
const compositionRoots = new Set(['presentation/providers/container.ts', entryPoint]);

/** Alias de tsconfig.app.json → carpeta relativa a src/. */
const aliases = [
  ['@domain/', 'domain/'],
  ['@application/', 'application/'],
  ['@infrastructure/', 'infrastructure/'],
  ['@presentation/', 'presentation/'],
  ['@env/', 'config/'],
  ['@/', ''],
];

const toPosix = (path) => path.split(sep).join('/');

const listFiles = (directory) =>
  readdirSync(directory)
    .flatMap((name) => {
      const path = resolve(directory, name);
      return statSync(path).isDirectory() ? listFiles(path) : [path];
    })
    .filter((path) => /\.tsx?$/.test(path) && !path.endsWith('.d.ts'));

const packageName = (specifier) => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/** Carpeta lógica de una ruta relativa a src/: capa, `shared/<x>`, `config` o `test`. */
const areaOf = (path) => {
  if (path === entryPoint) return 'presentation';
  const [first, second] = path.split('/');
  return first === 'shared' && second ? `shared/${second}` : first;
};

const isReact = (pkg) => /^react(?:-[\w-]+)?(?:\/|$)/.test(pkg);
const isTanstack = (pkg) => pkg.startsWith('@tanstack/');
const isRxjs = (pkg) => pkg === 'rxjs' || pkg.startsWith('rxjs/');
const isAngular = (pkg) => pkg.startsWith('@angular/');

const layers = ['domain', 'application', 'infrastructure', 'presentation'];
/** Carpetas de src/ que pueden contener código; cualquier otra ubicación es una violación. */
const permittedAreas = new Set([...layers, 'shared/ui', 'shared/hooks', 'shared/lib', 'config', 'test']);
const placementMessage =
  'ubicación no permitida: el código va en src/{domain,application,infrastructure,presentation,shared/ui,shared/hooks,shared/lib,config,test} (o src/main.tsx)';
const isNodeBuiltin = (pkg) => pkg.startsWith('node:');

/**
 * Reglas por carpeta:
 * - `allowedPackages`: lista blanca de paquetes externos (si se define, el resto se prohíbe).
 * - `packages`: paquetes prohibidos.
 * - `allowedAreas` / `forbiddenAreas`: carpetas internas que puede o no importar. `src/test` no se lista:
 *   lo controla una regla común (solo tests y src/test lo importan), con un único mensaje.
 * - `code`: hechos del AST prohibidos (`fetch`, `window`, `document`, `storage`; ver `analyzeSource`).
 */
const areaRules = {
  domain: {
    allowedPackages: ['vitest'],
    packageMessage: 'domain solo puede importar paquetes permitidos (vitest), ni módulos de Node',
    allowedAreas: ['domain'],
    areaMessage: 'domain solo puede depender de sí mismo',
    noTsx: true,
    code: [
      ['fetch', 'domain no puede usar fetch'],
      ['storage', 'domain no puede usar localStorage ni sessionStorage'],
      ['window', 'domain no puede usar window'],
      ['document', 'domain no puede usar document'],
    ],
  },
  application: {
    packages: [
      [isReact, 'application no puede importar React'],
      [isTanstack, 'application no puede importar @tanstack'],
      [isRxjs, 'application no puede importar rxjs'],
      [isAngular, 'application no puede importar Angular'],
      [isNodeBuiltin, 'application no puede importar módulos de Node'],
    ],
    forbiddenAreas: ['infrastructure', 'presentation', 'shared/ui', 'shared/hooks'],
    areaMessage: 'application solo puede depender de domain y de sí misma',
    noTsx: true,
    code: [['fetch', 'application no puede usar fetch']],
  },
  infrastructure: {
    packages: [[isReact, 'infrastructure no puede importar React']],
    forbiddenAreas: ['presentation', 'shared/ui', 'shared/hooks'],
    areaMessage: 'infrastructure no puede depender de presentation ni de la UI',
    code: [],
  },
  presentation: {
    packages: [],
    forbiddenAreas: ['infrastructure'],
    areaMessage:
      'presentation debe usar puertos de application, no implementaciones de infrastructure',
    code: [['fetch', 'presentation no puede usar fetch']],
  },
  config: {
    packages: [],
    forbiddenAreas: [...layers.filter((layer) => layer !== 'domain'), 'shared/ui', 'shared/hooks'],
    areaMessage: 'config no puede depender de application, infrastructure, presentation ni UI',
    code: [],
  },
  'shared/lib': {
    packages: [],
    forbiddenAreas: [...layers, 'shared/ui', 'shared/hooks'],
    areaMessage: 'shared/lib es utilitario: no puede depender de capas ni de UI',
    code: [],
  },
  'shared/ui': {
    packages: [],
    forbiddenAreas: [...layers],
    areaMessage: 'shared/ui (Shadcn) no puede depender de capas de la aplicación',
    code: [],
  },
  'shared/hooks': {
    packages: [],
    forbiddenAreas: [...layers],
    areaMessage: 'shared/hooks (Shadcn) no puede depender de capas de la aplicación',
    code: [],
  },
  test: {
    packages: [],
    forbiddenAreas: ['infrastructure'],
    areaMessage: 'src/test contiene dobles: no puede depender de infrastructure',
    code: [],
  },
};

/** Código generado por Shadcn: exento de las reglas de `any` y de primitivos. */
const generatedAreas = new Set(['shared/ui', 'shared/hooks']);

const pmoApiUrl = /https:\/\/[\w-]+\.execute-api\./;
const globalReceivers = new Set(['globalThis', 'window', 'self']);
const storageNames = new Set(['localStorage', 'sessionStorage']);
const browserGlobals = new Set(['window', 'document', ...storageNames]);

/** Elementos JSX prohibidos fuera de src/shared/ui (skill react-dashboard-architect). */
const forbiddenElements = {
  select: 'use Shadcn Select/Combobox, no <select>',
  table: 'use TanStack Table + Shadcn Table, no <table>',
  dialog: 'use Shadcn Dialog/Sheet, no <dialog>',
};
const primitiveRules = {
  chartJs: 'use Shadcn Chart (Recharts), no chart.js',
  newChart: 'use Shadcn Chart (Recharts), no Chart.js',
  roleDialog: 'use Shadcn Dialog/Sheet, no role="dialog"',
  roleAlertDialog: 'use Shadcn AlertDialog, no role="alertdialog"',
};
/** `type` de input con selector nativo de fecha. `time` sí se permite (decisión P5: Input type="time"). */
const dateInputTypes = new Set(['date', 'datetime-local', 'month', 'week']);
const dateInputRule = (type) => `use Shadcn Calendar + Popover, no type="${type}"`;

/** Texto de un literal string o plantilla sin expresiones (`'x'`, `"x"`, `` `x` ``), o null. */
const literalText = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

/** Valor estático de un atributo JSX: `a="x"`, `a={'x'}` o `` a={`x`} ``; null si es dinámico. */
const jsxAttributeValue = (attribute) => {
  const { initializer } = attribute;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer)) return literalText(initializer.expression);
  return null;
};

/** Receptor global de un acceso `globalThis.x`, `window?.x` o `self['x']`. */
const isGlobalReceiver = (node) => ts.isIdentifier(node) && globalReceivers.has(node.text);

/** Nombre accedido en `obj.name` u `obj['name']`, o null. */
const accessedName = (node) => {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) return literalText(node.argumentExpression);
  return null;
};

/**
 * Un identificador es una referencia (no un nombre de propiedad ni de declaración): excluye `obj.window`,
 * `{ window: 1 }`, `const window = …`, `function document()`, parámetros, miembros de clase, atributos JSX,
 * especificadores de import/export y nombres calificados de tipos. `{ window }` sí es referencia.
 */
const isReference = (node) => {
  const { parent } = node;
  if (!parent) return true;
  if (ts.isShorthandPropertyAssignment(parent)) return parent.name === node;
  if (ts.isQualifiedName(parent)) return parent.left === node;
  if ('name' in parent && parent.name === node) return false;
  if ('propertyName' in parent && parent.propertyName === node) return false;
  return true;
};

/**
 * Recorre el AST y devuelve:
 * - `specifiers`: imports estáticos (incl. `import type`), `export … from`, `import x = require()`,
 *   `import()` dinámico, `require()` y tipos `import('x')`.
 * - `facts`: `fetch` (llamada al `fetch` global: `fetch()`, `globalThis|window|self.fetch()`, también con
 *   `?.` o `['fetch']`; no métodos de otros objetos ni declaraciones), `window`, `document`, `storage`
 *   (referencias a esos globales, también como `globalThis.localStorage`), `any` (`AnyKeyword`).
 * - `primitives`: reglas de primitivos UI violadas (elementos JSX, `role` = `dialog`/`alertdialog`,
 *   `type` = `date`/`datetime-local`/`month`/`week`, `new Chart`).
 * - `literals`: texto de strings, plantillas y JSX (para la regla de la URL de PMO).
 */
export const analyzeSource = (source, fileName = 'file.ts') => {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const specifiers = [];
  const facts = new Set();
  const primitives = new Set();
  const literals = [];

  const addSpecifier = (node) => {
    const text = literalText(node);
    if (text !== null) specifiers.push(text);
  };

  const checkJsxTag = (tagName, attributes) => {
    if (ts.isIdentifier(tagName) && Object.hasOwn(forbiddenElements, tagName.text)) {
      primitives.add(forbiddenElements[tagName.text]);
    }
    for (const attribute of attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue;
      const value = jsxAttributeValue(attribute);
      if (attribute.name.text === 'role' && value === 'dialog') primitives.add(primitiveRules.roleDialog);
      if (attribute.name.text === 'role' && value === 'alertdialog') {
        primitives.add(primitiveRules.roleAlertDialog);
      }
      if (attribute.name.text === 'type' && dateInputTypes.has(value)) primitives.add(dateInputRule(value));
    }
  };

  const visit = (node) => {
    switch (node.kind) {
      case ts.SyntaxKind.AnyKeyword:
        facts.add('any');
        break;
      case ts.SyntaxKind.ImportDeclaration:
      case ts.SyntaxKind.ExportDeclaration:
        addSpecifier(node.moduleSpecifier);
        break;
      case ts.SyntaxKind.ExternalModuleReference:
        addSpecifier(node.expression);
        break;
      case ts.SyntaxKind.ImportType:
        if (ts.isLiteralTypeNode(node.argument)) addSpecifier(node.argument.literal);
        break;
      case ts.SyntaxKind.CallExpression: {
        const callee = node.expression;
        if (callee.kind === ts.SyntaxKind.ImportKeyword) addSpecifier(node.arguments[0]);
        if (ts.isIdentifier(callee) && callee.text === 'require') addSpecifier(node.arguments[0]);
        const isGlobalFetch =
          (ts.isIdentifier(callee) && callee.text === 'fetch') ||
          (accessedName(callee) === 'fetch' && isGlobalReceiver(callee.expression));
        if (isGlobalFetch) facts.add('fetch');
        break;
      }
      case ts.SyntaxKind.NewExpression:
        if (ts.isIdentifier(node.expression) && node.expression.text === 'Chart') {
          primitives.add(primitiveRules.newChart);
        }
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
      case ts.SyntaxKind.ElementAccessExpression: {
        const name = accessedName(node);
        if (name && browserGlobals.has(name) && isGlobalReceiver(node.expression)) {
          facts.add(storageNames.has(name) ? 'storage' : name);
        }
        break;
      }
      case ts.SyntaxKind.Identifier:
        if (browserGlobals.has(node.text) && isReference(node)) {
          facts.add(storageNames.has(node.text) ? 'storage' : node.text);
        }
        break;
      case ts.SyntaxKind.JsxOpeningElement:
      case ts.SyntaxKind.JsxSelfClosingElement:
        checkJsxTag(node.tagName, node.attributes);
        break;
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail:
      case ts.SyntaxKind.JsxText:
        literals.push(node.text);
        break;
      default:
        break;
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { specifiers, facts, primitives, literals };
};

const isTestFile = (path) => /\.(test|spec)\.tsx?$/.test(path);

/** Devuelve la lista de violaciones (vacía si la arquitectura es válida). */
export function checkArchitecture(workspace) {
  const sourceRoot = resolve(workspace, 'src');
  const manifest = JSON.parse(readFileSync(resolve(workspace, 'package.json'), 'utf8'));
  const declaredPackages = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const violations = [];
  const report = (path, rule) =>
    violations.push(`${toPosix(relative(workspace, path))}: ${rule}`);

  for (const layer of requiredLayers) {
    const layerPath = resolve(sourceRoot, layer);
    if (!existsSync(layerPath)) report(layerPath, `falta la capa src/${layer}`);
  }
  if (!existsSync(sourceRoot)) return violations;

  /** Resuelve un especificador a ruta relativa a src/, `../…` si sale de src/, o null si es paquete. */
  const internalTarget = (specifier, filePath) => {
    if (specifier.startsWith('.')) return toPosix(relative(sourceRoot, resolve(dirname(filePath), specifier)));
    const alias = aliases.find(([prefix]) => specifier.startsWith(prefix));
    return alias ? alias[1] + specifier.slice(alias[0].length) : null;
  };

  for (const path of listFiles(sourceRoot)) {
    const sourcePath = toPosix(relative(sourceRoot, path));
    const area = areaOf(sourcePath);
    const isGenerated = generatedAreas.has(area);
    const { specifiers, facts, primitives, literals } = analyzeSource(readFileSync(path, 'utf8'), path);
    const reported = new Set();
    const once = (rule) => {
      if (reported.has(rule)) return;
      reported.add(rule);
      report(path, rule);
    };

    if (!isGenerated && facts.has('any')) once('no se permite any explícito');
    if (literals.some((text) => pmoApiUrl.test(text))) {
      once('la URL de PMO debe provenir de .env (VITE_API_BASE_URL)');
    }

    if (!isGenerated) {
      if (specifiers.some((specifier) => packageName(specifier) === 'chart.js')) once(primitiveRules.chartJs);
      for (const rule of primitives) once(rule);
    }

    if (!permittedAreas.has(area)) once(placementMessage);

    const rules = areaRules[area];
    if (rules?.noTsx && sourcePath.endsWith('.tsx')) once(`${area} no puede contener archivos .tsx`);

    for (const specifier of specifiers) {
      const target = internalTarget(specifier, path);
      if (target === null) {
        // `/x.svg`: recurso de public/, no es un paquete.
        if (specifier.startsWith('/')) continue;
        const pkg = packageName(specifier);
        if (!isNodeBuiltin(pkg) && !declaredPackages.has(pkg)) {
          once(`paquete no declarado en package.json: ${pkg}`);
        }
        if (!rules) continue;
        if (rules.allowedPackages && !rules.allowedPackages.includes(pkg)) once(rules.packageMessage);
        for (const [matches, rule] of rules.packages ?? []) if (matches(specifier)) once(rule);
        continue;
      }
      if (target.startsWith('..')) {
        once(`import fuera de src/ no permitido: ${specifier}`);
        continue;
      }
      const targetArea = areaOf(target);
      if (targetArea === 'test') {
        // Única regla para src/test: así una importación indebida produce un solo mensaje.
        if (area !== 'test' && !isTestFile(sourcePath)) once('solo los tests y src/test pueden importar src/test');
        continue;
      }
      if (!rules) continue;
      const forbidden = rules.allowedAreas
        ? !rules.allowedAreas.includes(targetArea)
        : rules.forbiddenAreas.includes(targetArea);
      const compositionRootException =
        compositionRoots.has(sourcePath) && targetArea === 'infrastructure';
      if (forbidden && !compositionRootException) once(rules.areaMessage);
    }

    for (const [fact, rule] of rules?.code ?? []) if (facts.has(fact)) once(rule);
  }

  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkArchitecture(resolve(import.meta.dirname, '..'));
  if (violations.length) {
    console.error(`Arquitectura inválida:\n- ${violations.join('\n- ')}`);
    process.exit(1);
  }
  console.log(
    'Arquitectura válida: capas, dependencias (alias, relativas y require), paquetes declarados, primitivos UI, tipos y configuración verificados.',
  );
}
