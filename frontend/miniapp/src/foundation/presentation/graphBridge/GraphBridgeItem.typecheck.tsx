import {
  PresentationGraphBridgeContent,
  PresentationGraphBridgeItem,
  PresentationGraphBridgeItems,
  createPresentationGraphBridge,
  definePresentationGraphExecutionPort,
} from './index';

const action = Object.freeze({});
const port = definePresentationGraphExecutionPort({
  activationId: 1,
  nodeId: 'NODE',
  describe: () => ({
    kind: 'graph-runtime-action-descriptor',
    activationId: 1,
    nodeId: 'NODE',
    actionClass: 'business',
    actionId: 'action',
  }),
  execute: async () => undefined,
});
const view = createPresentationGraphBridge(port).resolve({
  nodeId: 'NODE',
  items: [
    {
      kind: 'control-action-button',
      id: 'action',
      interaction: {
        kind: 'action',
        action,
        baseAvailability: 'enabled',
      },
      controlKey: 'action-neutral',
      label: { kind: 'text', text: 'Action' },
    },
    {
      kind: 'state-list-button',
      id: 'state',
      stateKey: 'state-info',
      interaction: { kind: 'inert' },
      mainLine: { kind: 'text', text: 'State' },
      secondaryLines: [{
        id: 'summary',
        stateKey: 'state-positive',
        content: { kind: 'text', text: 'Summary' },
      }],
    },
  ],
}, { interactionPending: false });
const item = view.items[0]!;
const stateItem = view.items[1]!;

const contentElement = 'label' in item
  ? <PresentationGraphBridgeContent content={item.label} />
  : null;
const itemElement = <PresentationGraphBridgeItem item={item} />;
const stateItemElement = <PresentationGraphBridgeItem item={stateItem} />;
const itemsElement = <PresentationGraphBridgeItems items={view.items} />;

const invalidItem = <PresentationGraphBridgeItem item={{
  kind: 'summary-line',
  id: 'projection',
  stateKey: 'state-info',
  // @ts-expect-error projection content is not resolved bridge content
  content: { kind: 'text', text: 'Projection' },
}} />;
// @ts-expect-error bridge item arrays are readonly
view.items.push(item);

void contentElement;
void itemElement;
void stateItemElement;
void itemsElement;
void invalidItem;
