// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { type PresentationFormDraftController, usePresentationFormDraftController } from './draft';
import { PresentationFormError } from './model';
import { definePresentationFormField } from './validation';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fields = Object.freeze([
  definePresentationFormField({ id: 'amount', kind: 'numeric', label: 'Amount', accessibilityLabel: 'Amount input', required: true, numericRule: 'positive' }),
]);

describe('presentation form draft controller', () => {
  it('is controlled, normalizes only on commit and resets on activation', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const state: { current?: PresentationFormDraftController } = {};
    const current = () => {
      if (state.current === undefined) throw new Error('controller unavailable');
      return state.current;
    };
    function Harness({ activationKey }: Readonly<{ activationKey: string }>) {
      state.current = usePresentationFormDraftController({ activationKey, fields });
      return <span>{state.current.field('amount').value}</span>;
    }
    act(() => root.render(<Harness activationKey="first" />));
    expect(() => current().commit()).toThrow(PresentationFormError);
    act(() => current().setValue('amount', '12.300'));
    expect(current().commit()).toEqual({ amount: '12.3' });
    act(() => root.render(<Harness activationKey="second" />));
    expect(current().field('amount').value).toBe('');
    act(() => root.unmount());
  });

  it('rejects commit while pending to suppress duplicate submission', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const state: { current?: PresentationFormDraftController } = {};
    function Harness() {
      state.current = usePresentationFormDraftController({
        activationKey: 'pending',
        fields,
        initialValues: { amount: '12' },
        pending: true,
      });
      return null;
    }
    act(() => root.render(<Harness />));
    if (state.current === undefined) throw new Error('controller unavailable');
    expect(() => state.current?.commit()).toThrowError('FORM_PENDING');
    expect(state.current.field('amount').disabled).toBe(true);
    act(() => root.unmount());
  });
});
