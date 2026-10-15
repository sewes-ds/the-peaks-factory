import {
  resolvePlatformPolicyOwner,
  type PlatformAuthorityKind,
  type PresentationSurface,
} from '../../foundation/presentation';
import { SECTION03_BACK_REGISTRY } from '../program/back';
import { SECTION03_BUSINESS_ACTIONS } from '../program/business';
import {
  SECTION03_NODE_IDS,
  type Section03NodeId,
} from '../program/ids';
import { SECTION03_NODE_REGISTRY } from '../program/registry';
import { SECTION03_FORWARD_TARGETS } from '../program/reachability';
import type {
  Section03Family,
  Section03LoaderKey,
  Section03ProjectionKind,
} from '../program/types';
import type { Section03BackendPresentationFamily } from '../generated/managerPresentationContract';
import {
  SECTION03_PRESENTATION_POLICY,
  SECTION03_PRESENTATION_ROOT_CATALOG,
  type Section03PolicyRootDefinition,
  type Section03PolicySelector,
} from './sectionPolicy';

export type Section03OwnershipMatrixRoot = Readonly<{
  rootId: string;
  surface: PresentationSurface;
  ownerRootId: string;
  role: string;
  authority: PlatformAuthorityKind;
  backendFamily: Section03BackendPresentationFamily | null;
  compound: 'independent' | 'inherit-parent' | 'independent-child';
  contextualException: string | null;
}>;

export type Section03OwnershipMatrixNode = Readonly<{
  nodeId: Section03NodeId;
  family: Section03Family;
  loader: Section03LoaderKey | null;
  projection: Section03ProjectionKind;
  roots: readonly Section03OwnershipMatrixRoot[];
}>;

const businessNodes = new Set<Section03NodeId>(
  SECTION03_BUSINESS_ACTIONS.flatMap((action) => action.nodes),
);

function matchesSelector(
  selector: Section03PolicySelector,
  nodeId: Section03NodeId,
): boolean {
  const node = SECTION03_NODE_REGISTRY[nodeId];
  switch (selector.kind) {
    case 'all':
      return true;
    case 'nodes':
      return selector.values.includes(nodeId);
    case 'families':
      return selector.values.includes(node.family);
    case 'loaders':
      return node.loader !== null && selector.values.includes(node.loader);
    case 'projections':
      return selector.values.includes(node.projection);
    case 'graph-action':
      if (selector.value === 'back') {
        return SECTION03_BACK_REGISTRY[nodeId].kind !== 'terminal';
      }
      if (selector.value === 'forward') {
        return SECTION03_FORWARD_TARGETS[nodeId].length > 0;
      }
      return businessNodes.has(nodeId);
  }
}

function compoundKind(
  root: Section03PolicyRootDefinition,
): Section03OwnershipMatrixRoot['compound'] {
  if (root.ownership === 'inherit-parent') return 'inherit-parent';
  if (root.parentRootId !== undefined) return 'independent-child';
  return 'independent';
}

function matrixRoot(
  root: Section03PolicyRootDefinition,
): Section03OwnershipMatrixRoot {
  const resolved = resolvePlatformPolicyOwner(
    SECTION03_PRESENTATION_POLICY,
    root.rootId,
  );
  return Object.freeze({
    rootId: root.rootId,
    surface: root.surface,
    ownerRootId: resolved.ownerRoot.rootId,
    role: resolved.role.role,
    authority: resolved.role.authority,
    backendFamily: root.backendFamily,
    compound: compoundKind(root),
    contextualException: root.contextualException,
  });
}

/**
 * Derived evidence only. The Section policy and Graph registry are the two
 * normative inputs; no second, hand-maintained node matrix is accepted.
 */
export function createSection03OwnershipMatrix(): readonly Section03OwnershipMatrixNode[] {
  return Object.freeze(SECTION03_NODE_IDS.map((nodeId) => {
    const node = SECTION03_NODE_REGISTRY[nodeId];
    const roots = SECTION03_PRESENTATION_ROOT_CATALOG
      .filter((root) => matchesSelector(root.selector, nodeId))
      .map(matrixRoot);
    return Object.freeze({
      nodeId,
      family: node.family,
      loader: node.loader,
      projection: node.projection,
      roots: Object.freeze(roots),
    });
  }));
}

export const SECTION03_PRESENTATION_OWNERSHIP_MATRIX =
  createSection03OwnershipMatrix();

export function serializeSection03OwnershipMatrix(): string {
  return `${JSON.stringify(SECTION03_PRESENTATION_OWNERSHIP_MATRIX, null, 2)}\n`;
}
