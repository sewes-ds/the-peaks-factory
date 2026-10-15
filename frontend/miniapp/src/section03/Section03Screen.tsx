import { useMemo, type ReactNode } from 'react';
import { assetUrl } from '../foundation/runtimePaths';
import {
  PresentationGraphBridgeItem,
  PresentationScreenTemplate,
  type PresentationGraphBridgeView,
  type ResolvedPresentationGraphBridgeItem,
} from '../foundation/presentation';
import type {
  Section03ScreenProjection,
} from './presentation';
import './section03.css';

export const SECTION03_BRIDGE_SCREEN_ERROR_CODES = Object.freeze([
  'SECTION03_SCREEN_VIEW_MISMATCH',
  'SECTION03_SCREEN_ITEM_MISSING',
] as const);

export type Section03ScreenErrorCode =
  typeof SECTION03_BRIDGE_SCREEN_ERROR_CODES[number];

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

export type Section03ScreenProps = Readonly<{
  screen: Section03ScreenProjection;
  view: PresentationGraphBridgeView;
  interactionPending: boolean;
  feedback?: ReactNode;
}>;

export function Section03Screen({
  screen,
  view,
  interactionPending,
  feedback,
}: Section03ScreenProps) {
  if (screen.nodeId !== view.nodeId) {
    throw new Section03ScreenError(
      'SECTION03_SCREEN_VIEW_MISMATCH',
    );
  }
  const itemMap = useMemo(
    () => new Map(view.items.map((item) => [item.id, item])),
    [view.items],
  );
  const read = (
    ids: readonly string[],
  ): readonly ResolvedPresentationGraphBridgeItem[] => Object.freeze(
    ids.map((id) => {
      const item = itemMap.get(id);
      if (item === undefined) {
        throw new Section03ScreenError(
          'SECTION03_SCREEN_ITEM_MISSING',
          id,
        );
      }
      return item;
    }),
  );
  const fixedTop = read(screen.slots.fixedTop);
  const scroll = read(screen.slots.scroll);
  const fixedBottom = read(screen.slots.fixedBottom);
  const render = (items: readonly ResolvedPresentationGraphBridgeItem[]) =>
    items.map((item) => (
      <PresentationGraphBridgeItem item={item} key={item.id} />
    ));

  return (
    <main className="peaks-section03-screen" data-node-id={screen.nodeId}>
      <PresentationScreenTemplate
        accessibilityLabel={screen.ariaLabel}
        activationKey={screen.nodeId}
        busy={interactionPending}
        fixedBottom={render(fixedBottom)}
        fixedTop={render(fixedTop)}
        feedback={feedback}
        header={(
          <div className="peaks-section03-header">
        <img
          alt="PEAKS"
              className="peaks-section03-header__logo"
          src={assetUrl('assets/brand/peaks_logo.png')}
        />
          </div>
        )}
        scroll={render(scroll)}
        title={screen.fixedTopTitle}
      />
    </main>
  );
}
