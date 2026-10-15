// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { PresentationFormField } from './fields';
import { definePresentationFormField, resolvePresentationFormField } from './validation';

describe('global form primitives', () => {
  it('renders a controlled native field without caller styling', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const definition = definePresentationFormField({ id: 'reason', kind: 'multiline', label: 'Reason', accessibilityLabel: 'Reason input', required: true });
    const onValueChange = vi.fn();
    act(() => root.render(<PresentationFormField field={resolvePresentationFormField(definition, 'value', { disabled: false, pending: false })} onValueChange={onValueChange} />));
    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('value');
    expect(textarea?.disabled).toBe(false);
    act(() => root.unmount());
  });
});
