import { SECTION03_NODE_IDS, type Section03NodeId } from './ids';

export type Section03BackRule =
  | Readonly<{ kind: 'terminal' }>
  | Readonly<{ kind: 'history' }>;

export const SECTION03_BACK_REGISTRY = Object.freeze(Object.fromEntries(
  SECTION03_NODE_IDS.map((nodeId) => [
    nodeId,
    Object.freeze(nodeId === 'S03-N01'
      ? { kind: 'terminal' as const }
      : { kind: 'history' as const }),
  ]),
)) as Readonly<Record<Section03NodeId, Section03BackRule>>;
