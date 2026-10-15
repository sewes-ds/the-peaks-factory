import {
  resolvePlatformPresentation,
  type ControlSemanticKey,
  type PresentationGraphBridgeItemInput,
  type StatePresentationKey,
} from '../foundation/presentation';

function authorityKey(
  item: Readonly<Record<string, unknown>>,
): StatePresentationKey | ControlSemanticKey | null {
  if (item.presentationAuthority === undefined) {
    return null;
  }
  const authority = item.presentationAuthority as Readonly<{
    policy: Parameters<typeof resolvePlatformPresentation>[0]['policy'];
    rootId: string;
    evidence: unknown;
  }>;
  const resolution = resolvePlatformPresentation({
    ...authority,
    interaction: { kind: 'inert' },
    availability: 'inert',
  });
  if (resolution.status !== 'resolved') {
    throw new Error(`Unresolved test presentation authority: ${resolution.contractCode}`);
  }
  return resolution.base.binding.key;
}

export function section03ResolvedAppearanceKey(
  item: Readonly<Record<string, unknown>>,
): StatePresentationKey | ControlSemanticKey | null {
  if (typeof item.stateKey === 'string') {
    return item.stateKey as StatePresentationKey;
  }
  if (typeof item.controlKey === 'string') {
    return item.controlKey as ControlSemanticKey;
  }
  return authorityKey(item);
}

export function section03ProjectionStateKeys(
  items: readonly PresentationGraphBridgeItemInput[],
): readonly StatePresentationKey[] {
  return items.flatMap((item) => {
    const key = section03ResolvedAppearanceKey(item);
    return key !== null && key.startsWith('state-')
      ? [key as StatePresentationKey]
      : [];
  });
}

export function section03ProjectionControlKeys(
  items: readonly PresentationGraphBridgeItemInput[],
): readonly ControlSemanticKey[] {
  return items.flatMap((item) => {
    const key = section03ResolvedAppearanceKey(item);
    return key !== null && !key.startsWith('state-')
      ? [key as ControlSemanticKey]
      : [];
  });
}

export function section03VisibleJson(value: unknown): string {
  return JSON.stringify(value, (key, current) =>
    key === 'presentationAuthority' ? undefined : current);
}
