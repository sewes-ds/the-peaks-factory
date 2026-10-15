import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const presentationRoot = resolve(process.cwd(), 'src/foundation/presentation');
const sourceRoot = resolve(process.cwd(), 'src');

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return files(path);
    }
    return entry.isFile() ? [path] : [];
  });
}

function productionTypeScript(root: string): string[] {
  return files(root).filter((path) =>
    /\.tsx?$/.test(path) && !/\.(?:test|typecheck)\.[^.]+$/.test(path),
  );
}

describe('global presentation architecture boundary', () => {
  it('keeps production presentation source section, application and renderer free', () => {
    const forbidden = [
      /S0[23]-/,
      new RegExp('section0[23]', 'i'),
      /[\u0400-\u04FF]/,
      new RegExp('/' + '(?:manager|machine-downtimes|employees|operations|shifts|breaks|additional-works|reports|exports)'),
      new RegExp('from\\s+["\\\'][^"\\\']*(?:graph' + 'Protocol|graph' + 'Renderer)[^"\\\']*["\\\']'),
      /#[0-9A-Fa-f]{3,8}\b|rgba?\s*\(/,
      /\bany\b/,
      /dangerouslySetInnerHTML/,
      /["'`](?:primaryBlue|outlineBlue|lightBlue|fixed55)["'`]/,
    ];

    for (const path of productionTypeScript(presentationRoot)) {
      const source = readFileSync(path, 'utf8');
      for (const pattern of forbidden) {
        expect(source, `${relative(sourceRoot, path)} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('keeps layer imports directed before application migration', () => {
    const modelRoot = join(presentationRoot, 'model');
    const tokensRoot = join(presentationRoot, 'tokens');
    const paletteRoot = join(presentationRoot, 'palette');
    const controlsRoot = join(presentationRoot, 'controls');
    const statesRoot = join(presentationRoot, 'states');
    const timeRoot = join(presentationRoot, 'time');
    const feedbackRoot = join(presentationRoot, 'feedback');
    const primitivesRoot = join(presentationRoot, 'primitives');
    const graphBridgeRoot = join(presentationRoot, 'graphBridge');
    const formsRoot = join(presentationRoot, 'forms');
    const templatesRoot = join(presentationRoot, 'templates');

    for (const path of productionTypeScript(presentationRoot)) {
      const source = readFileSync(path, 'utf8');
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)]
        .map((match) => match[1]);

      if (path.startsWith(modelRoot)) {
        expect(imports.every((item) => item.startsWith('./'))).toBe(true);
      }
      if (path.startsWith(tokensRoot)) {
        expect(imports.every((item) => item.startsWith('./'))).toBe(true);
      }
      if (path.startsWith(paletteRoot)) {
        expect(imports.every((item) => item.startsWith('../model') || item.startsWith('../tokens') || item.startsWith('./'))).toBe(true);
      }
      if (path.startsWith(controlsRoot) || path.startsWith(statesRoot)) {
        expect(imports.every((item) => item.startsWith('../model') || item.startsWith('../palette') || item.startsWith('./'))).toBe(true);
      }
      if (path.startsWith(timeRoot)) {
        expect(imports.every((item) => item.startsWith('./'))).toBe(true);
      }
      if (path.startsWith(feedbackRoot)) {
        expect(imports.every((item) =>
          item.startsWith('../model') ||
          item.startsWith('../controls') ||
          item.startsWith('../states') ||
          item.startsWith('./'),
        )).toBe(true);
      }
      if (path.startsWith(primitivesRoot)) {
        expect(imports.every((item) =>
          item === 'react' ||
          item.startsWith('../controls') ||
          item.startsWith('../states') ||
          item.startsWith('../feedback') ||
          item.startsWith('../tokens') ||
          item.startsWith('./'),
        )).toBe(true);
      }
      if (path.startsWith(graphBridgeRoot)) {
        const relativePath = relative(graphBridgeRoot, path);
        if (relativePath === 'port.ts') {
          expect(imports).toEqual(['../../graphRuntime']);
          expect(source).toMatch(
            /import\s+type\s+\{[\s\S]*GraphRuntimeActionDescriptor[\s\S]*\}\s+from\s+["']\.\.\/\.\.\/graphRuntime["']/,
          );
        } else {
          expect(imports.every((item) =>
            item === 'react' ||
            item.startsWith('../controls') ||
            item.startsWith('../states') ||
            item.startsWith('../time') ||
            item.startsWith('../feedback') ||
            item.startsWith('../forms') ||
            item.startsWith('../primitives') ||
            item.startsWith('../authority') ||
            item.startsWith('../model') ||
            item.startsWith('./'),
          )).toBe(true);
        }
      }
      if (path.startsWith(formsRoot)) {
        expect(imports.every((item) => item === 'react' || item.startsWith('./'))).toBe(true);
      }
      if (path.startsWith(templatesRoot)) {
        expect(imports.every((item) => item === 'react' || item.startsWith('./'))).toBe(true);
      }
    }
  });

  it('allows React and static global classes only inside dumb primitives', () => {
    const primitivesRoot = join(presentationRoot, 'primitives');
    const graphBridgeRoot = join(presentationRoot, 'graphBridge');
    const formsRoot = join(presentationRoot, 'forms');
    const templatesRoot = join(presentationRoot, 'templates');
    const bridgeReactFiles = new Set([
      join(graphBridgeRoot, 'GraphBridgeContent.tsx'),
      join(graphBridgeRoot, 'GraphBridgeItem.tsx'),
      join(graphBridgeRoot, 'GraphBridgeItems.tsx'),
    ]);
    const reactImport = /from\s+["']react["']/;
    const staticClass = /["'`](peaks-[^"'`]*)["'`]/g;

    for (const path of productionTypeScript(presentationRoot)) {
      const source = readFileSync(path, 'utf8');
      if (!path.startsWith(primitivesRoot) && !path.startsWith(formsRoot) && !path.startsWith(templatesRoot) && !bridgeReactFiles.has(path)) {
        expect(source, relative(sourceRoot, path)).not.toMatch(reactImport);
        expect(source, relative(sourceRoot, path)).not.toMatch(staticClass);
        staticClass.lastIndex = 0;
        continue;
      }

      const classes = [...source.matchAll(staticClass)]
        .map((match) => match[1]);
      expect(
        classes.every((className) =>
          className.startsWith('peaks-presentation-'),
        ),
        relative(sourceRoot, path),
      ).toBe(true);
      expect(source, relative(sourceRoot, path)).not.toMatch(
        /\b(?:className|style)\??\s*:/,
      );
    }
  });

  it('keeps the Graph Bridge sealed, flat and execution-port only', () => {
    const graphBridgeRoot = join(presentationRoot, 'graphBridge');
    const production = productionTypeScript(graphBridgeRoot);

    for (const path of production) {
      const source = readFileSync(path, 'utf8');
      expect(source, relative(sourceRoot, path)).not.toMatch(
        /graphRenderer|section0[23]|definition\.visual|["'`](?:variant|showIcon|primaryBlue|outlineBlue|lightBlue)["'`]/i,
      );
      expect(source, relative(sourceRoot, path)).not.toMatch(
        /fixedTop|fixedBottom|scroll|layout|sticky|viewport|logo/i,
      );
      expect(source, relative(sourceRoot, path)).not.toMatch(
        /\bfetch\s*\(|import\s+["'][^"']+\.css["']/,
      );
      expect(source, relative(sourceRoot, path)).not.toMatch(
        /createGraphReadyInteractionPlanner|createGraphReadyBusinessExecutionRuntime|createGraphPresentationExecutionRuntime|createGraphReadyNodeActionFactory/,
      );
    }
  });

  it('allows only the migrated Section02 and Section03 application consumers', () => {
    const importPattern = /(?:import|export)[\s\S]*?from\s+["'][^"']*presentation(?:\/|["'])/g;
    const allowedBarrel = resolve(sourceRoot, 'foundation/index.ts');
    const section03Root = resolve(sourceRoot, 'section03');
    const section02Root = resolve(sourceRoot, 'section02');

    for (const path of productionTypeScript(sourceRoot)) {
      if (path.startsWith(presentationRoot)) {
        continue;
      }

      const source = readFileSync(path, 'utf8');
      const importsPresentation = importPattern.test(source);
      importPattern.lastIndex = 0;

      if (path === allowedBarrel) {
        expect(source).toContain("export * from './presentation';");
        continue;
      }

      if (path.startsWith(section02Root) || path.startsWith(section03Root)) {
        continue;
      }

      expect(importsPresentation, relative(sourceRoot, path)).toBe(false);
    }
  });
});
