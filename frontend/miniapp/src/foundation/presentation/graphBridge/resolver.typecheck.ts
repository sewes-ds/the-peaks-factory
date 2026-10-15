import {
  definePresentationGraphExecutionPort,
} from './port';
import { createPresentationGraphBridge } from './resolver';
import type {
  PresentationGraphBridgeProjection,
} from './model';

const action = {};
const port = definePresentationGraphExecutionPort({
  activationId: 1,
  nodeId: 'NODE',
  describe: (_action: object) => ({
    kind: 'graph-runtime-action-descriptor',
    activationId: 1,
    nodeId: 'NODE',
    actionClass: 'business',
    actionId: 'action',
  }),
  execute: async (_action: object) => undefined,
});
const bridge = createPresentationGraphBridge(port);
const projection: PresentationGraphBridgeProjection = {
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
        id: 'line',
        stateKey: 'state-warning',
        content: { kind: 'text', text: 'Summary' },
      }],
    },
  ],
};
const view = bridge.resolve(projection, { interactionPending: false });

// @ts-expect-error view is readonly
view.nodeId = 'OTHER';
// @ts-expect-error item array is readonly
view.items.push(view.items[0]);
const stateItem = view.items[1];
if (stateItem?.kind === 'state-list-button') {
  // @ts-expect-error resolved summary lines are readonly
  stateItem.secondaryLines?.push(stateItem.secondaryLines[0]!);
}

void view;
