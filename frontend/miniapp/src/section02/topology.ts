import type { Section02Context } from './context';
import type { Section02NodeId } from './ids';

export type Section02LoaderKey =
  | 'workplace'
  | 'machines'
  | 'machine-qr'
  | 'sku-qr'
  | 'skus'
  | 'break-types'
  | 'downtime-start'
  | 'additional-work'
  | 'additional-work-types'
  | 'salary'
  | 'salary-history';

export type Section02ProjectionKind = 'menu' | 'list' | 'card' | 'form' | 'confirmation' | 'success';

export type Section02NodeDefinition = Readonly<{
  id: Section02NodeId;
  family: 'S02-F1' | 'S02-F2' | 'S02-F3' | 'S02-F4' | 'S02-F5' | 'S02-F6' | 'S02-F7';
  loader: Section02LoaderKey | null;
  projection: Section02ProjectionKind;
  requiredContext: readonly (keyof Section02Context)[];
}>;

function node(
  id: Section02NodeId,
  family: Section02NodeDefinition['family'],
  loader: Section02LoaderKey | null,
  projection: Section02ProjectionKind,
  requiredContext: readonly (keyof Section02Context)[] = [],
): Section02NodeDefinition {
  return Object.freeze({ id, family, loader, projection, requiredContext: Object.freeze([...requiredContext]) });
}

export const SECTION02_NODE_REGISTRY = Object.freeze({
  'S02-N01': node('S02-N01', 'S02-F1', 'workplace', 'menu'),
  'S02-N02': node('S02-N02', 'S02-F1', 'workplace', 'menu'),
  'S02-N03': node('S02-N03', 'S02-F2', null, 'menu'),
  'S02-QR01': node('S02-QR01', 'S02-F2', 'machine-qr', 'card'),
  'S02-N04': node('S02-N04', 'S02-F2', 'machines', 'list', ['machine_selection_mode']),
  'S02-SKU01': node('S02-SKU01', 'S02-F2', null, 'menu', ['machine_id', 'machine_name']),
  'S02-SKUQR01': node('S02-SKUQR01', 'S02-F2', 'sku-qr', 'card', ['machine_id', 'machine_name']),
  'S02-N05': node('S02-N05', 'S02-F2', 'skus', 'list', ['machine_id', 'machine_name']),
  'S02-N08': node('S02-N08', 'S02-F2', 'workplace', 'form', ['production_operation_id']),
  'S02-B01': node('S02-B01', 'S02-F3', 'break-types', 'list'),
  'S02-B03': node('S02-B03', 'S02-F3', 'workplace', 'confirmation'),
  'S02-N09': node('S02-N09', 'S02-F4', 'downtime-start', 'list'),
  'S02-N26_keyboard': node('S02-N26_keyboard', 'S02-F4', null, 'form', ['machine_id', 'machine_name', 'downtime_type_id', 'downtime_type_name', 'downtime_class', 'production_requirement']),
  'S02-N27': node('S02-N27', 'S02-F4', 'downtime-start', 'confirmation', ['machine_id', 'machine_name', 'downtime_type_id', 'downtime_type_name', 'downtime_class', 'production_requirement', 'comment']),
  'S02-N28': node('S02-N28', 'S02-F4', 'workplace', 'success', ['machine_name']),
  'S02-N10': node('S02-N10', 'S02-F4', 'workplace', 'confirmation', ['downtime_id', 'downtime_class']),
  'S02-N11': node('S02-N11', 'S02-F5', 'additional-work', 'menu'),
  'S02-AW01': node('S02-AW01', 'S02-F5', 'additional-work-types', 'list'),
  'S02-AW02': node('S02-AW02', 'S02-F5', 'additional-work-types', 'confirmation', ['additional_work_type_id', 'additional_work_name']),
  'S02-AW03': node('S02-AW03', 'S02-F5', 'additional-work', 'confirmation', ['additional_work_id', 'additional_work_name']),
  'S02-AW04': node('S02-AW04', 'S02-F5', 'additional-work', 'confirmation', ['additional_work_id', 'additional_work_name']),
  'S02-AW05': node('S02-AW05', 'S02-F5', 'additional-work', 'success'),
  'S02-FS01': node('S02-FS01', 'S02-F6', 'workplace', 'confirmation'),
  'S02-FS02': node('S02-FS02', 'S02-F6', 'workplace', 'card'),
  'S02-SAL01': node('S02-SAL01', 'S02-F7', 'salary', 'card'),
  'S02-SAL02': node('S02-SAL02', 'S02-F7', 'salary-history', 'list'),
} as const satisfies Readonly<Record<Section02NodeId, Section02NodeDefinition>>);

export const SECTION02_FORWARD_TARGETS = Object.freeze({
  'S02-N01': Object.freeze(['S02-SAL01']),
  'S02-N02': Object.freeze(['S02-N03', 'S02-N08', 'S02-B01', 'S02-B03', 'S02-N09', 'S02-N10', 'S02-N11', 'S02-FS01', 'S02-FS02', 'S02-SAL01']),
  'S02-N03': Object.freeze(['S02-QR01', 'S02-N04']),
  'S02-QR01': Object.freeze(['S02-SKU01']),
  'S02-N04': Object.freeze(['S02-SKU01', 'S02-N26_keyboard', 'S02-N09']),
  'S02-SKU01': Object.freeze(['S02-SKUQR01', 'S02-N05']),
  'S02-SKUQR01': Object.freeze([]),
  'S02-N05': Object.freeze([]),
  'S02-N08': Object.freeze([]),
  'S02-B01': Object.freeze([]),
  'S02-B03': Object.freeze([]),
  'S02-N09': Object.freeze(['S02-N26_keyboard', 'S02-N04']),
  'S02-N26_keyboard': Object.freeze(['S02-N27', 'S02-N04']),
  'S02-N27': Object.freeze([]),
  'S02-N28': Object.freeze(['S02-N02']),
  'S02-N10': Object.freeze([]),
  'S02-N11': Object.freeze(['S02-AW01', 'S02-AW03', 'S02-AW04']),
  'S02-AW01': Object.freeze(['S02-AW02']),
  'S02-AW02': Object.freeze([]),
  'S02-AW03': Object.freeze([]),
  'S02-AW04': Object.freeze([]),
  'S02-AW05': Object.freeze(['S02-N11']),
  'S02-FS01': Object.freeze(['S02-N11']),
  'S02-FS02': Object.freeze(['S02-N08', 'S02-B03', 'S02-N10', 'S02-N11']),
  'S02-SAL01': Object.freeze(['S02-SAL02']),
  'S02-SAL02': Object.freeze(['S02-SAL01']),
} as const satisfies Readonly<Record<Section02NodeId, readonly Section02NodeId[]>>);

export const SECTION02_BACK_CAPABILITY = Object.freeze({
  'S02-N01': false,
  'S02-N02': false,
  'S02-N03': true,
  'S02-QR01': true,
  'S02-N04': true,
  'S02-SKU01': true,
  'S02-SKUQR01': true,
  'S02-N05': true,
  'S02-N08': true,
  'S02-B01': true,
  'S02-B03': true,
  'S02-N09': true,
  'S02-N26_keyboard': true,
  'S02-N27': true,
  'S02-N28': false,
  'S02-N10': true,
  'S02-N11': true,
  'S02-AW01': true,
  'S02-AW02': true,
  'S02-AW03': true,
  'S02-AW04': true,
  'S02-AW05': false,
  'S02-FS01': true,
  'S02-FS02': true,
  'S02-SAL01': true,
  'S02-SAL02': true,
} as const satisfies Readonly<Record<Section02NodeId, boolean>>);

export function validateSection02NodeContext(nodeId: Section02NodeId, context: Section02Context): void {
  for (const field of SECTION02_NODE_REGISTRY[nodeId].requiredContext) {
    if (context[field] === undefined) throw new Error(`Section 02 ${nodeId} requires context.${field}.`);
  }
}
