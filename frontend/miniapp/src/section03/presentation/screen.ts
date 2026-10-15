import type {
  PresentationGraphBridgeItemInput,
  PresentationGraphBridgeProjection,
} from '../../foundation/presentation';
import type { Section03NodeId } from '../program';
import { isSection03NodeId } from '../program/ids';

export type Section03ScreenSlots = Readonly<{
  fixedTop: readonly string[];
  scroll: readonly string[];
  fixedBottom: readonly string[];
}>;

export type Section03ScreenProjection = Readonly<{
  nodeId: Section03NodeId;
  ariaLabel: string;
  fixedTopTitle?: string;
  bridgeProjection: PresentationGraphBridgeProjection;
  slots: Section03ScreenSlots;
}>;

export const SECTION03_SCREEN_ERROR_CODES = Object.freeze([
  'INVALID_SECTION03_SCREEN_PROJECTION',
  'UNKNOWN_SECTION03_SCREEN_FIELD',
  'INVALID_SECTION03_SCREEN_NODE',
  'INVALID_SECTION03_SCREEN_ARIA',
  'INVALID_SECTION03_SCREEN_TITLE',
  'INVALID_SECTION03_SCREEN_SLOTS',
  'UNKNOWN_SECTION03_SCREEN_SLOT_FIELD',
  'DUPLICATE_SECTION03_SCREEN_ITEM',
  'DUPLICATE_SECTION03_SLOT_ITEM',
  'UNKNOWN_SECTION03_SLOT_ITEM',
  'UNASSIGNED_SECTION03_SCREEN_ITEM',
  'SECTION03_SCREEN_NODE_MISMATCH',
] as const);

export type Section03ScreenErrorCode =
  typeof SECTION03_SCREEN_ERROR_CODES[number];

export class Section03ScreenError extends Error {
  readonly code: Section03ScreenErrorCode;
  readonly itemId: string | null;

  constructor(code: Section03ScreenErrorCode, itemId?: string) {
    super(code);
    this.name = 'Section03ScreenError';
    this.code = code;
    this.itemId = itemId ?? null;
    Object.freeze(this);
  }
}

function plain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function known(
  value: Record<string, unknown>,
  fields: readonly string[],
  code: Section03ScreenErrorCode,
): void {
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) {
      throw new Section03ScreenError(code);
    }
  }
}

function nodeId(value: unknown): Section03NodeId {
  if (!isSection03NodeId(value)) {
    throw new Section03ScreenError('INVALID_SECTION03_SCREEN_NODE');
  }
  return value;
}

function nonEmpty(
  value: unknown,
  code: Section03ScreenErrorCode,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Section03ScreenError(code);
  }
  return value;
}

function itemIds(
  bridgeProjection: Record<string, unknown>,
): Readonly<{
  projection: PresentationGraphBridgeProjection;
  ids: ReadonlySet<string>;
}> {
  known(
    bridgeProjection,
    ['nodeId', 'items'],
    'INVALID_SECTION03_SCREEN_PROJECTION',
  );
  if (
    typeof bridgeProjection.nodeId !== 'string' ||
    !Array.isArray(bridgeProjection.items)
  ) {
    throw new Section03ScreenError(
      'INVALID_SECTION03_SCREEN_PROJECTION',
    );
  }
  const ids = new Set<string>();
  const items = bridgeProjection.items.map((candidate) => {
    if (!plain(candidate)) {
      throw new Section03ScreenError(
        'INVALID_SECTION03_SCREEN_PROJECTION',
      );
    }
    const id = nonEmpty(
      candidate.id,
      'INVALID_SECTION03_SCREEN_PROJECTION',
    );
    if (ids.has(id)) {
      throw new Section03ScreenError(
        'DUPLICATE_SECTION03_SCREEN_ITEM',
        id,
      );
    }
    ids.add(id);
    return candidate as PresentationGraphBridgeItemInput;
  });
  return Object.freeze({
    projection: Object.freeze({
      nodeId: bridgeProjection.nodeId,
      items: Object.freeze(items),
    }),
    ids,
  });
}

function slots(
  value: unknown,
  ids: ReadonlySet<string>,
): Section03ScreenSlots {
  if (!plain(value)) {
    throw new Section03ScreenError('INVALID_SECTION03_SCREEN_SLOTS');
  }
  known(
    value,
    ['fixedTop', 'scroll', 'fixedBottom'],
    'UNKNOWN_SECTION03_SCREEN_SLOT_FIELD',
  );
  const assigned = new Set<string>();
  const read = (candidate: unknown): readonly string[] => {
    if (!Array.isArray(candidate)) {
      throw new Section03ScreenError('INVALID_SECTION03_SCREEN_SLOTS');
    }
    return Object.freeze(candidate.map((item) => {
      const id = nonEmpty(item, 'INVALID_SECTION03_SCREEN_SLOTS');
      if (assigned.has(id)) {
        throw new Section03ScreenError(
          'DUPLICATE_SECTION03_SLOT_ITEM',
          id,
        );
      }
      if (!ids.has(id)) {
        throw new Section03ScreenError(
          'UNKNOWN_SECTION03_SLOT_ITEM',
          id,
        );
      }
      assigned.add(id);
      return id;
    }));
  };
  const result = Object.freeze({
    fixedTop: read(value.fixedTop),
    scroll: read(value.scroll),
    fixedBottom: read(value.fixedBottom),
  });
  for (const id of ids) {
    if (!assigned.has(id)) {
      throw new Section03ScreenError(
        'UNASSIGNED_SECTION03_SCREEN_ITEM',
        id,
      );
    }
  }
  return result;
}

export function defineSection03ScreenProjection(
  input: unknown,
): Section03ScreenProjection {
  if (!plain(input)) {
    throw new Section03ScreenError(
      'INVALID_SECTION03_SCREEN_PROJECTION',
    );
  }
  known(
    input,
    ['nodeId', 'ariaLabel', 'fixedTopTitle', 'bridgeProjection', 'slots'],
    'UNKNOWN_SECTION03_SCREEN_FIELD',
  );
  const resolvedNodeId = nodeId(input.nodeId);
  const ariaLabel = nonEmpty(
    input.ariaLabel,
    'INVALID_SECTION03_SCREEN_ARIA',
  );
  const fixedTopTitle = input.fixedTopTitle === undefined
    ? undefined
    : nonEmpty(
      input.fixedTopTitle,
      'INVALID_SECTION03_SCREEN_TITLE',
    );
  if (!plain(input.bridgeProjection)) {
    throw new Section03ScreenError(
      'INVALID_SECTION03_SCREEN_PROJECTION',
    );
  }
  const bridge = itemIds(input.bridgeProjection);
  if (bridge.projection.nodeId !== resolvedNodeId) {
    throw new Section03ScreenError('SECTION03_SCREEN_NODE_MISMATCH');
  }
  const resolvedSlots = slots(input.slots, bridge.ids);
  return Object.freeze({
    nodeId: resolvedNodeId,
    ariaLabel,
    ...(fixedTopTitle === undefined ? {} : { fixedTopTitle }),
    bridgeProjection: bridge.projection,
    slots: resolvedSlots,
  });
}
