// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { definePresentationFormField, usePresentationFormDraftController } from '../forms';
import { PresentationGraphBridgeItems } from './GraphBridgeItems';
import { definePresentationGraphExecutionPort } from './port';
import { createPresentationGraphBridge } from './resolver';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const definition = definePresentationFormField({
  id: 'field',
  kind: 'text',
  label: 'Field',
  accessibilityLabel: 'Field input',
  required: true,
});

function Harness() {
  const controller = usePresentationFormDraftController({
    activationKey: 'NODE',
    fields: [definition],
    initialValues: { field: 'initial' },
  });
  const port = definePresentationGraphExecutionPort({
    activationId: 1,
    nodeId: 'NODE',
    describe: () => { throw new Error('no graph action'); },
    execute: async () => Object.freeze({ status: 'unused' }),
  });
  const view = createPresentationGraphBridge(port).resolve({
    nodeId: 'NODE',
    items: [{ kind: 'form-field', id: 'field-item', controller, fieldId: 'field' }],
  }, { interactionPending: false });
  return <PresentationGraphBridgeItems items={view.items} />;
}

describe('Graph Bridge form field', () => {
  it('resolves the single generic form-field kind to a controlled native primitive', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<Harness />));
    const input = container.querySelector('input');
    expect(input?.value).toBe('initial');
    expect(container.querySelector('.peaks-presentation-form-field')).not.toBeNull();
    act(() => root.unmount());
  });
});
