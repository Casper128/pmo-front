import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const workspace = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(workspace, 'src');
const requiredLayers = ['domain', 'application', 'infrastructure', 'presentation'];

const files = (directory) =>
  readdirSync(directory)
    .flatMap((name) => {
      const path = resolve(directory, name);
      return statSync(path).isDirectory() ? files(path) : [path];
    })
    .filter((path) => path.endsWith('.ts'));

const violations = [];
const report = (path, rule) => violations.push(`${relative(workspace, path)}: ${rule}`);
const imports = (content, alias) =>
  new RegExp(`(?:from\\s+|import\\s*)['\"]${alias.replace('/', '\\/')}`).test(content);

for (const layer of requiredLayers) {
  const layerPath = resolve(sourceRoot, layer);
  if (!existsSync(layerPath)) report(layerPath, `falta la capa src/${layer}`);
}

for (const path of files(sourceRoot)) {
  const normalized = path.replaceAll('\\', '/');
  const content = readFileSync(path, 'utf8');
  const isCompositionRoot =
    normalized.endsWith('/presentation/shell/app.config.ts') ||
    normalized.includes('/presentation/shell/providers/');

  if (/\bany\b/.test(content)) report(path, 'no se permite any explícito');

  if (normalized.includes('/domain/')) {
    if (/@angular\//.test(content)) report(path, 'domain no puede importar Angular');
    if (
      imports(content, '@application/') ||
      imports(content, '@infrastructure/') ||
      imports(content, '@presentation/')
    ) {
      report(path, 'domain solo puede depender de sí mismo');
    }
  }

  if (normalized.includes('/application/')) {
    if (/@angular\//.test(content)) report(path, 'application no puede importar Angular');
    if (imports(content, '@infrastructure/') || imports(content, '@presentation/')) {
      report(path, 'application solo puede depender de domain y de sí misma');
    }
  }

  if (normalized.includes('/infrastructure/') && imports(content, '@presentation/')) {
    report(path, 'infrastructure no puede depender de presentation');
  }

  if (normalized.includes('/presentation/')) {
    if (!isCompositionRoot && imports(content, '@infrastructure/')) {
      report(
        path,
        'presentation debe usar puertos de application, no implementaciones de infrastructure',
      );
    }
    if (!isCompositionRoot && /@angular\/common\/http/.test(content))
      report(path, 'presentation no puede usar HttpClient');
    if (/\bfetch\s*\(/.test(content)) report(path, 'presentation no puede usar fetch');
  }

  if (!normalized.includes('/environments/') && /https:\/\/wwz8sswbkh\.execute-api/.test(content)) {
    report(path, 'la URL de PMO debe provenir de environment');
  }
}

if (existsSync(resolve(sourceRoot, 'app'))) {
  const legacyFiles = files(resolve(sourceRoot, 'app'));
  if (legacyFiles.length)
    report(resolve(sourceRoot, 'app'), 'no debe contener código: use las cuatro capas raíz');
}

if (violations.length) {
  console.error(`Arquitectura inválida:\n- ${violations.join('\n- ')}`);
  process.exit(1);
}

console.log('Arquitectura válida: capas, dependencias, tipos y configuración verificados.');
