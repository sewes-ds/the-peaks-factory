import {
  presentationGraphBridgeItemFragment,
} from './GraphBridgeItem';
import type { ResolvedPresentationGraphBridgeItem } from './model';

export type PresentationGraphBridgeItemsProps = Readonly<{
  items: readonly ResolvedPresentationGraphBridgeItem[];
}>;

export function PresentationGraphBridgeItems({
  items,
}: PresentationGraphBridgeItemsProps) {
  return <>{items.map(presentationGraphBridgeItemFragment)}</>;
}
