import type {
  ActionInteractionBinding,
  InertInteractionBinding,
  PresentationGraphContentCardLineInput,
  PresentationGraphBridgeProjection,
  PresentationGraphLabeledCardLineInput,
} from './model';

const action = {};
const actionBinding: ActionInteractionBinding = {
  kind: 'action',
  action,
  baseAvailability: 'enabled',
};
const inert: InertInteractionBinding = { kind: 'inert' };
const labeledCardLine: PresentationGraphLabeledCardLineInput = {
  id: 'labeled',
  label: { kind: 'text', text: 'Label' },
  value: { kind: 'text', text: 'Value' },
};
const contentCardLine: PresentationGraphContentCardLineInput = {
  id: 'content',
  content: { kind: 'text', text: 'Content' },
};
const projection: PresentationGraphBridgeProjection = {
  nodeId: 'NODE',
  items: [
    {
      kind: 'control-action-button',
      id: 'inert-action',
      interaction: inert,
      controlKey: 'action-neutral',
      label: { kind: 'text', text: 'Unavailable action' },
    },
    {
      kind: 'state-list-button',
      id: 'state',
      stateKey: 'state-info',
      interaction: inert,
      mainLine: { kind: 'text', text: 'State' },
      secondaryLines: [{
        id: 'state-line',
        stateKey: 'state-positive',
        content: { kind: 'text', text: 'Summary' },
      }],
    },
    {
      kind: 'card',
      id: 'card',
      stateKey: 'state-info',
      lines: [contentCardLine, labeledCardLine],
    },
  ],
};

const invalidPending: ActionInteractionBinding = {
  kind: 'action',
  action,
  // @ts-expect-error pending is derived, not a base availability
  baseAvailability: 'pending',
};
const invalidInert: InertInteractionBinding = {
  kind: 'inert',
  // @ts-expect-error inert contains no action
  action,
};

void actionBinding;
void labeledCardLine;
void contentCardLine;
void projection;
void invalidPending;
void invalidInert;
