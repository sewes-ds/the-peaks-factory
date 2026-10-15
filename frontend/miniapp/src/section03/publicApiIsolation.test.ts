import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const section03Root = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(section03Root, '..');
const publicBarrelPath = resolve(section03Root, 'index.ts');

const forbiddenPublicApiMarkers = Object.freeze([
  './fixtures/',
  '/fixtures/',
  'SECTION03_P1_FIXTURES',
  'SECTION03_P1_FIXTURE_IDS',
  'SECTION03_P2A1_FIXTURES',
  'SECTION03_P2A1_FIXTURE_IDS',
]);

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (path === resolve(section03Root, 'fixtures')) return [];
      return productionSourceFiles(path);
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) return [];
    if (/\.(?:test|typecheck)\.[^.]+$/.test(entry.name)) return [];
    return [path];
  });
}

function moduleSpecifiers(source: string): string[] {
  return [...source.matchAll(
    /(?:from\s+|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g,
  )].map((match) => match[1]!);
}

function resolveSourceModule(importer: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(importer), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function productionEntryGraph(entry: string): readonly string[] {
  const pending = [entry];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    for (const specifier of moduleSpecifiers(readFileSync(path, 'utf8'))) {
      const resolved = resolveSourceModule(path, specifier);
      if (resolved !== null && resolved.startsWith(sourceRoot)) pending.push(resolved);
    }
  }
  return Object.freeze([...visited]);
}

function assertNoBundleMarkers(path: string): void {
  const source = readFileSync(path, 'utf8');
  for (const marker of ['scenario-id', 'EMP-CW']) {
    if (source.includes(marker)) throw new Error(`Bundle marker found: ${marker}.`);
  }
}

describe('Section03 production public API isolation', () => {
  it('keeps every fixture module and identifier out of the public barrel', () => {
    const publicBarrel = readFileSync(publicBarrelPath, 'utf8');
    for (const marker of forbiddenPublicApiMarkers) {
      expect(
        publicBarrel.includes(marker),
        `Production barrel must not contain fixture marker ${marker}.`,
      ).toBe(false);
    }
  });

  it('retains the required production preview host export', () => {
    const publicBarrel = readFileSync(publicBarrelPath, 'utf8');
    expect(
      publicBarrel,
      'Production barrel must continue exporting Section03Host.',
    ).toContain('export { Section03Host }');
  });

  it('prevents non-test production source from importing fixture modules', () => {
    const auditedFiles = productionSourceFiles(sourceRoot);
    expect(auditedFiles.length, 'Production source audit must inspect files.').toBeGreaterThan(0);

    for (const path of auditedFiles) {
      const source = readFileSync(path, 'utf8');
      for (const specifier of moduleSpecifiers(source)) {
        const importsFixtureModule =
          specifier.includes('section03/fixtures') ||
          specifier.includes('/fixtures/p1') ||
          specifier.includes('/fixtures/p2a1Employees') ||
          /(?:^|\/)fixtures\/(?:p1|p2a1Employees)$/.test(specifier);
        expect(
          importsFixtureModule,
          `${relative(sourceRoot, path)} imports production fixture dependency ${specifier}.`,
        ).toBe(false);
      }
    }
  });

  it('keeps generic diagnostics and test registries outside the production entry graph', () => {
    const graph = productionEntryGraph(resolve(sourceRoot, 'main.tsx'));
    expect(graph.length).toBeGreaterThan(0);
    expect(graph.some((path) => path.endsWith('/projections/generic.ts'))).toBe(false);
    expect(graph.some((path) => path.includes('/fixtures/'))).toBe(false);
    expect(graph.some((path) => path.includes('/browser-tests/'))).toBe(false);
  });

  it('fails the exact marker scanner on a synthetic temporary artifact', () => {
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'peaks-bundle-marker-'));
    const artifact = resolve(temporaryRoot, 'synthetic.js');
    try {
      writeFileSync(artifact, 'export const clean = true;');
      expect(() => assertNoBundleMarkers(artifact)).not.toThrow();
      writeFileSync(artifact, 'export const marker = "scenario-id";');
      expect(() => assertNoBundleMarkers(artifact))
        .toThrow('Bundle marker found: scenario-id.');
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
