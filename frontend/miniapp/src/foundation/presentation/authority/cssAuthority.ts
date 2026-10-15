import { PEAKS_COLOR_TOKENS } from '../tokens';

const PRESENTATION_CLASS_PREFIX = `${['peaks', 'presentation'].join('-')}-`;

const SEMANTIC_PRIMITIVE_NAMES = Object.freeze([
  'action-button',
  'control-list-button',
  'state-list-button',
  'entity-row',
  'card',
  'summary-line',
  'message',
  'feedback-block',
  'feedback',
  'spinner',
] as const);

const FOUNDATION_PRIMITIVE_STYLESHEET =
  'src/foundation/presentation/primitives/primitives.css';
const FOUNDATION_PALETTE_STYLESHEET =
  'src/foundation/peaksTheme.css';

export const PLATFORM_CSS_AUTHORITY_ERROR_CODES = Object.freeze([
  'SEMANTIC_PAINT_OVERRIDE',
  'SEMANTIC_PAINT_IMPORTANT_OVERRIDE',
  'UNBOUNDED_SEMANTIC_PAINT_OVERRIDE',
  'SEMANTIC_VARIABLE_OVERRIDE',
  'PALETTE_VARIABLE_OVERRIDE',
] as const);

export type PlatformCssAuthorityErrorCode =
  typeof PLATFORM_CSS_AUTHORITY_ERROR_CODES[number];

export type PlatformCssAuthorityViolation = Readonly<{
  code: PlatformCssAuthorityErrorCode;
  sourceId: string;
  line: number;
  selector: string;
  property: string;
}>;

export type PlatformCssAuthorityAudit = Readonly<{
  sourceId: string;
  violations: readonly PlatformCssAuthorityViolation[];
}>;

type CssDeclaration = Readonly<{
  property: string;
  value: string;
  offset: number;
}>;

type CssRule = Readonly<{
  selector: string;
  declarations: readonly CssDeclaration[];
  offset: number;
}>;

function normalizeSourceId(sourceId: string): string {
  return sourceId.replaceAll('\\', '/').replace(/^\.\//, '');
}

function isSource(
  sourceId: string,
  expected: string,
): boolean {
  return normalizeSourceId(sourceId) === expected;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' '));
}

function declarationList(body: string, bodyOffset: number): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  const pattern = /(?:^|;)\s*(--[a-z0-9-]+|[a-z][a-z0-9-]*)\s*:\s*([^;}]*)/gi;
  for (const match of body.matchAll(pattern)) {
    const property = match[1];
    const value = match[2];
    if (property === undefined || value === undefined || match.index === undefined) {
      continue;
    }
    declarations.push(Object.freeze({
      property: property.toLowerCase(),
      value: value.trim(),
      offset: bodyOffset + match.index + match[0].indexOf(property),
    }));
  }
  return declarations;
}

function leafRules(source: string): CssRule[] {
  const rules: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of source.matchAll(pattern)) {
    const selector = match[1]?.trim();
    const body = match[2];
    if (
      selector === undefined ||
      body === undefined ||
      match.index === undefined ||
      selector.startsWith('@font-face')
    ) {
      continue;
    }
    const openBraceOffset = match.index + match[0].indexOf('{');
    rules.push(Object.freeze({
      selector,
      declarations: Object.freeze(declarationList(body, openBraceOffset + 1)),
      offset: match.index,
    }));
  }
  return rules;
}

function colorVariableNames(value: unknown, target: Set<string>): void {
  if (typeof value === 'string') {
    const match = /^var\((--[a-z0-9-]+)\)$/i.exec(value);
    if (match?.[1] !== undefined) target.add(match[1].toLowerCase());
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const nested of Object.values(value)) {
    colorVariableNames(nested, target);
  }
}

const paletteVariables = new Set<string>();
colorVariableNames(PEAKS_COLOR_TOKENS, paletteVariables);

function targetsSemanticPrimitive(selector: string): boolean {
  const normalized = selector.toLowerCase();
  return SEMANTIC_PRIMITIVE_NAMES.some((name) =>
    normalized.includes(`${PRESENTATION_CLASS_PREFIX}${name}`));
}

function hasUniversalTarget(selector: string): boolean {
  return /(^|[\s>+~,(])\*(?=[:\s>+~,.#\[{]|$)/.test(selector);
}

function hasBarePrimitiveElementTarget(selector: string): boolean {
  return selector.split(',').some((branch) => {
    const compounds = branch.trim().split(/[\s>+~]+/).filter(Boolean);
    const target = compounds.at(-1);
    if (target === undefined) return false;
    const withoutPseudo = target.replace(/:{1,2}[a-z-]+(?:\([^)]*\))?/gi, '');
    return /^(?:button|section|div|span)$/i.test(withoutPseudo);
  });
}

function isSemanticPaintProperty(property: string): boolean {
  return (
    property === 'color' ||
    property === 'background' ||
    property === 'background-color' ||
    property === 'background-image' ||
    property === 'border' ||
    property === 'border-color' ||
    property === 'border-style' ||
    property === 'border-width' ||
    /^border-(?:block|inline|top|right|bottom|left)$/.test(property) ||
    /^border-(?:(?:block|inline)(?:-start|-end)?|top|right|bottom|left)?-?color$/.test(property) ||
    property === 'outline' ||
    property === 'outline-color' ||
    property === 'box-shadow' ||
    property === 'text-shadow' ||
    property === 'text-decoration-color' ||
    property === '-webkit-text-fill-color' ||
    property === 'fill' ||
    property === 'stroke' ||
    property === 'opacity' ||
    property === 'filter' ||
    property === 'mix-blend-mode' ||
    property === 'mask' ||
    property === 'mask-image' ||
    property === 'appearance' ||
    property === '-webkit-appearance' ||
    property === 'forced-color-adjust' ||
    property === 'all' ||
    property === 'animation' ||
    property === 'animation-name'
  );
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

function violation(input: Readonly<{
  code: PlatformCssAuthorityErrorCode;
  sourceId: string;
  source: string;
  rule: CssRule;
  declaration: CssDeclaration;
}>): PlatformCssAuthorityViolation {
  return Object.freeze({
    code: input.code,
    sourceId: input.sourceId,
    line: lineAt(input.source, input.declaration.offset),
    selector: input.rule.selector,
    property: input.declaration.property,
  });
}

export function auditPlatformPresentationCss(input: Readonly<{
  sourceId: string;
  css: string;
}>): PlatformCssAuthorityAudit {
  const sourceId = normalizeSourceId(input.sourceId);
  const source = stripComments(input.css);
  const primitiveOwner = isSource(sourceId, FOUNDATION_PRIMITIVE_STYLESHEET);
  const paletteOwner = isSource(sourceId, FOUNDATION_PALETTE_STYLESHEET);
  const violations: PlatformCssAuthorityViolation[] = [];

  for (const rule of leafRules(source)) {
    for (const declaration of rule.declarations) {
      if (declaration.property.startsWith('--peaks-presentation-')) {
        violations.push(violation({
          code: 'SEMANTIC_VARIABLE_OVERRIDE',
          sourceId,
          source,
          rule,
          declaration,
        }));
        continue;
      }
      if (paletteVariables.has(declaration.property) && !paletteOwner) {
        violations.push(violation({
          code: 'PALETTE_VARIABLE_OVERRIDE',
          sourceId,
          source,
          rule,
          declaration,
        }));
        continue;
      }
      if (!isSemanticPaintProperty(declaration.property) || primitiveOwner) {
        continue;
      }

      const directTarget = targetsSemanticPrimitive(rule.selector);
      const unboundedTarget = hasUniversalTarget(rule.selector) ||
        hasBarePrimitiveElementTarget(rule.selector);
      if (!directTarget && !unboundedTarget) continue;

      violations.push(violation({
        code: directTarget && /!important\b/i.test(declaration.value)
          ? 'SEMANTIC_PAINT_IMPORTANT_OVERRIDE'
          : directTarget
            ? 'SEMANTIC_PAINT_OVERRIDE'
            : 'UNBOUNDED_SEMANTIC_PAINT_OVERRIDE',
        sourceId,
        source,
        rule,
        declaration,
      }));
    }
  }

  return Object.freeze({
    sourceId,
    violations: Object.freeze(violations),
  });
}
