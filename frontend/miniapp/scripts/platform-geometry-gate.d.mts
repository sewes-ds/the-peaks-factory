export const PLATFORM_ROOT_GEOMETRY_CONTRACT: 'PGR-1';

export type PlatformGeometryBounds = Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}>;

export type PlatformGeometrySnapshot = Readonly<{
  gate: 'PLATFORM_HORIZONTAL_GEOMETRY';
  status: 'PASS' | 'FAIL';
  tolerance: number;
  document: Readonly<{
    viewport_inner_width: number;
    document_client_width: number;
    document_scroll_width: number;
    body_client_width: number;
    body_scroll_width: number;
  }>;
  normalization: Readonly<{
    expected_contract: string | null;
    actual_contract: string;
    html_margin: readonly string[];
    html_padding: readonly string[];
    body_margin: readonly string[];
    body_padding: readonly string[];
    root_margin: readonly string[] | null;
    root_padding: readonly string[] | null;
    scrollbar_gutter: string;
  }>;
  significant_roots: readonly Readonly<{
    target: string;
    position: string;
    transform: string;
    bounds: PlatformGeometryBounds;
    parent_content_bounds: Readonly<{ left: number; right: number }> | null;
    client_width: number;
    scroll_width: number;
  }>[];
  positioned_elements: readonly Readonly<{
    target: string;
    position: string;
    transform: string;
    bounds: PlatformGeometryBounds;
  }>[];
  horizontal_scroll_capability: 'NOT_DEFINED_NO_CONSUMER';
  failures: readonly string[];
}>;

export function inspectPlatformGeometry(
  documentRef?: Document,
  windowRef?: Window,
  options?: Readonly<{
    tolerance?: number;
    expectedNormalizationContract?: string | null;
    rootSelectors?: readonly string[];
  }>,
): PlatformGeometrySnapshot;

export function platformGeometryEvaluationExpression(options?: Readonly<Record<string, unknown>>): string;
export function assertPlatformGeometry(snapshot: PlatformGeometrySnapshot, context?: string): PlatformGeometrySnapshot;
