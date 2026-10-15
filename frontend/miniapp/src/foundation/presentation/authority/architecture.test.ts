import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const authorityRoot = resolve(
  process.cwd(),
  'src/foundation/presentation/authority',
);

function productionFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return productionFiles(path);
    return entry.isFile() && /\.ts$/.test(path) && !/\.(?:test|typecheck)\.ts$/.test(path)
      ? [path]
      : [];
  });
}

describe('Platform Presentation Authority architecture', () => {
  it('keeps Platform Core domain-neutral and renderer-free', () => {
    const forbidden = [
      /S0[1-9]-|Section\s*0[1-9]|section0[1-9]/i,
      /machine|employee|additional.?work|salary|report/i,
      /[\u0400-\u04FF]/,
      /graphProtocol|graphRuntime|graphRenderer|section0[1-9]/i,
      /from\s+["'][^"']*(?:api|readModels)[^"']*["']/,
      /\bfetch\s*\(|\bReact\b|\.tsx["']?$/,
    ];

    for (const path of productionFiles(authorityRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const pattern of forbidden) {
        expect(source, `${relative(authorityRoot, path)} matches ${pattern}`)
          .not.toMatch(pattern);
      }
    }
  });

  it('contains no fallback semantic binding', () => {
    for (const path of productionFiles(authorityRoot)) {
      const source = readFileSync(path, 'utf8');
      expect(source, relative(authorityRoot, path)).not.toMatch(
        /fallback|default(?:State|Action|Role|Binding)|catch\s*\([^)]*\)\s*\{\s*return\s+definePlatform/i,
      );
    }
  });
});
