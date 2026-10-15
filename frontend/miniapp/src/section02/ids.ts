export const SECTION02_NODE_IDS = Object.freeze([
  'S02-N01',
  'S02-N02',
  'S02-N03',
  'S02-QR01',
  'S02-N04',
  'S02-SKU01',
  'S02-SKUQR01',
  'S02-N05',
  'S02-N08',
  'S02-B01',
  'S02-B03',
  'S02-N09',
  'S02-N26_keyboard',
  'S02-N27',
  'S02-N28',
  'S02-N10',
  'S02-N11',
  'S02-AW01',
  'S02-AW02',
  'S02-AW03',
  'S02-AW04',
  'S02-AW05',
  'S02-FS01',
  'S02-FS02',
  'S02-SAL01',
  'S02-SAL02',
] as const);

export type Section02NodeId = typeof SECTION02_NODE_IDS[number];

const ids = new Set<string>(SECTION02_NODE_IDS);

export function isSection02NodeId(value: unknown): value is Section02NodeId {
  return typeof value === 'string' && ids.has(value);
}

export const SECTION02_FAMILIES = Object.freeze({
  'S02-F1': Object.freeze(['S02-N01', 'S02-N02']),
  'S02-F2': Object.freeze(['S02-N03', 'S02-QR01', 'S02-N04', 'S02-SKU01', 'S02-SKUQR01', 'S02-N05', 'S02-N08']),
  'S02-F3': Object.freeze(['S02-B01', 'S02-B03']),
  'S02-F4': Object.freeze(['S02-N09', 'S02-N26_keyboard', 'S02-N27', 'S02-N28', 'S02-N10']),
  'S02-F5': Object.freeze(['S02-N11', 'S02-AW01', 'S02-AW02', 'S02-AW03', 'S02-AW04', 'S02-AW05']),
  'S02-F6': Object.freeze(['S02-FS01', 'S02-FS02']),
  'S02-F7': Object.freeze(['S02-SAL01', 'S02-SAL02']),
} as const satisfies Readonly<Record<string, readonly Section02NodeId[]>>);
