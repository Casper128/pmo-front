// Verifica que react-app/src/domain sea copia exacta de ../src/domain (Angular), salvo las
// excepciones declaradas abajo (docs/migration-plan.md §1.1 y R5). Sin dependencias.
// Uso: `node scripts/check-domain-sync.mjs`. `checkDomainSync()` se exporta para sus tests.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Únicas diferencias permitidas. Cada excepción declara la transformación exacta que convierte el
 * archivo de Angular en el de React; cualquier otro cambio en ese archivo también se detecta.
 */
export const allowedDifferences = {
  'time-records/repositories/time-record.repository.ts': {
    reason: 'Puerto de repositorio de Observable (rxjs) a Promise',
    transform: (angular) =>
      angular.replace(/^import \{ Observable \} from 'rxjs';\r?\n/m, '').replaceAll('Observable<', 'Promise<'),
  },
};

const normalizeEol = (text) => text.replace(/\r\n?/g, '\n');
const toPosix = (path) => path.split(sep).join('/');

const listFiles = (root, directory = root) =>
  readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) return listFiles(root, path);
    return name === '.DS_Store' ? [] : [toPosix(relative(root, path))];
  });

/** Devuelve las divergencias entre ambos dominios (vacía si están sincronizados). */
export function checkDomainSync(angularDomain, reactDomain, exceptions = allowedDifferences) {
  const problems = [];
  for (const [label, path] of [
    ['Angular', angularDomain],
    ['React', reactDomain],
  ]) {
    if (!existsSync(path)) problems.push(`no existe el dominio de ${label}: ${path}`);
  }
  if (problems.length) return problems;

  const angularFiles = new Set(listFiles(angularDomain));
  const reactFiles = new Set(listFiles(reactDomain));

  for (const file of angularFiles) {
    if (!reactFiles.has(file)) problems.push(`${file}: falta en react-app/src/domain`);
  }
  for (const file of reactFiles) {
    if (!angularFiles.has(file)) problems.push(`${file}: no existe en src/domain (Angular)`);
  }

  for (const file of angularFiles) {
    if (!reactFiles.has(file)) continue;
    // Se normalizan finales de línea: un checkout con CRLF no es una divergencia real.
    const angular = normalizeEol(readFileSync(resolve(angularDomain, file), 'utf8'));
    const react = normalizeEol(readFileSync(resolve(reactDomain, file), 'utf8'));
    const exception = exceptions[file];
    const expected = exception ? exception.transform(angular) : angular;
    if (react === expected) continue;
    problems.push(
      exception
        ? `${file}: difiere de la excepción declarada (${exception.reason})`
        : `${file}: el contenido difiere de src/domain`,
    );
  }

  for (const file of Object.keys(exceptions)) {
    if (!angularFiles.has(file)) problems.push(`${file}: excepción declarada para un archivo inexistente`);
  }

  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = resolve(import.meta.dirname, '..');
  const problems = checkDomainSync(
    resolve(workspace, '..', 'src', 'domain'),
    resolve(workspace, 'src', 'domain'),
  );
  if (problems.length) {
    console.error(
      `Dominio desincronizado con src/domain (aplique el cambio en ambos lados):\n- ${problems.join('\n- ')}`,
    );
    process.exit(1);
  }
  const exceptions = Object.keys(allowedDifferences).length;
  console.log(`Dominio sincronizado con src/domain (${exceptions} excepción declarada).`);
}
