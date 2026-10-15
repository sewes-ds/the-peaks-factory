import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { assetUrl } from '../foundation/runtimePaths';
import { PeaksCommentInputKeyboard, PeaksNumericInputKeyboard } from '../foundation/graphObjects';
import '../foundation/graphObjects/graphObjects.css';
import {
  PresentationGraphBridgeItem,
  PresentationScreenTemplate,
  type PresentationGraphBridgeView,
  type ResolvedPresentationGraphBridgeItem,
} from '../foundation/presentation';
import type { Section02ScreenProjection } from './projection';
import './section02.css';

export function Section02Screen(input: Readonly<{
  screen: Section02ScreenProjection;
  view: PresentationGraphBridgeView;
  interactionPending: boolean;
  feedback?: ReactNode;
}>) {
  if (input.screen.nodeId !== input.view.nodeId) throw new Error('SECTION02_SCREEN_VIEW_MISMATCH');
  const itemMap = useMemo(() => new Map(input.view.items.map((item) => [item.id, item])), [input.view.items]);
  const read = (ids: readonly string[]): readonly ResolvedPresentationGraphBridgeItem[] => Object.freeze(ids.map((id) => {
    const item = itemMap.get(id);
    if (item === undefined) throw new Error(`SECTION02_SCREEN_ITEM_MISSING:${id}`);
    return item;
  }));
  const formChange = (item: Extract<ResolvedPresentationGraphBridgeItem, { kind: 'form-field' }>): Dispatch<SetStateAction<string>> => (next) => {
    item.onValueChange(typeof next === 'function' ? next(item.field.value) : next);
  };
  const renderItem = (item: ResolvedPresentationGraphBridgeItem) => {
    if (item.kind === 'form-field' && input.screen.nodeId === 'S02-N08') {
      return <PeaksNumericInputKeyboard ariaLabel="Ввод количества" disabled={item.field.disabled} onChange={formChange(item)} value={item.field.value} />;
    }
    if (item.kind === 'form-field' && input.screen.nodeId === 'S02-N26_keyboard') {
      return <PeaksCommentInputKeyboard ariaLabel="Комментарий" disabled={item.field.disabled} maxLength={item.field.definition.maxLength} minRows={4} onChange={formChange(item)} value={item.field.value} />;
    }
    return <PresentationGraphBridgeItem item={item} />;
  };
  const render = (items: readonly ResolvedPresentationGraphBridgeItem[]) => items.map((item) => <div data-presentation-item-id={item.id} key={item.id}>{renderItem(item)}</div>);
  const header = <div className="peaks-section02-header"><img alt="PEAKS" className="peaks-section02-header__logo" src={assetUrl('assets/brand/peaks_logo.png')} /></div>;
  const scroll = render(read(input.screen.slots.scroll));
  return (
    <main className="peaks-section02-screen" data-node-id={input.screen.nodeId}>
      <PresentationScreenTemplate
        accessibilityLabel={input.screen.ariaLabel}
        activationKey={input.screen.nodeId}
        busy={input.interactionPending}
        fixedBottom={render(read(input.screen.slots.fixedBottom))}
        fixedTop={render(read(input.screen.slots.fixedTop))}
        feedback={input.feedback}
        header={header}
        scroll={scroll}
        title={input.screen.fixedTopTitle}
      />
    </main>
  );
}
