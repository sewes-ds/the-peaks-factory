import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  Section03SystemFeedback,
} from './Section03SystemFeedback';

function render(
  kind: 'loading' | 'recoverable-error' | 'terminal-error',
  message: string,
  onRetry?: () => void,
) {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(
    <Section03SystemFeedback
      diagnosticCode={kind === 'recoverable-error'
        ? 'PLATFORM_FONT_LOAD_REJECTED'
        : null}
      fontReadinessState={kind === 'recoverable-error'
        ? 'LOAD_REJECTED'
        : undefined}
      kind={kind}
      message={message}
      onRetry={onRetry}
    />,
  ));
  return { container, root };
}

describe('Section03SystemFeedback', () => {
  it('renders loading feedback in the Section 03 scoped viewport shell', () => {
    const { container, root } = render('loading', 'Загрузка');
    expect(container.querySelector('main')?.className)
      .toBe('peaks-section03-screen peaks-section03-system-shell');
    expect(container.querySelector('main')?.getAttribute('data-feedback-shell')).toBe('section03');
    expect(container.querySelector('main')?.hasAttribute('data-node-id')).toBe(false);
    expect(container.querySelector('.peaks-section03-header')).not.toBeNull();
    expect(container.querySelector('[data-presentation-scroll-slot="true"]'))
      .not.toBeNull();
    expect(container.querySelector('[data-feedback-kind="loading"]'))
      .not.toBeNull();
    expect(container.querySelector('.peaks-presentation-spinner'))
      .not.toBeNull();
    expect(container.textContent).toContain('Загрузка');
    expect(container.querySelector('button')).toBeNull();
    root.unmount();
  });

  it('renders safe recoverable feedback with retry and machine diagnostics', () => {
    const onRetry = vi.fn();
    const { container, root } = render(
      'recoverable-error',
      'Не удалось загрузить оформление приложения.',
      onRetry,
    );
    const main = container.querySelector('main');
    expect(main?.dataset.platformFontReadinessState).toBe('LOAD_REJECTED');
    expect(main?.dataset.platformDiagnosticCode)
      .toBe('PLATFORM_FONT_LOAD_REJECTED');
    expect(container.textContent).not.toContain('PLATFORM_');
    const retry = container.querySelector('button');
    expect(retry?.textContent).toBe('Повторить');
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
    root.unmount();
  });

  it('renders terminal error without retry or default text', () => {
    const { container, root } = render('terminal-error', 'Exact failure');
    expect(container.querySelector('[data-feedback-kind="terminal-error"]'))
      .not.toBeNull();
    expect(container.textContent).toBe('Exact failure');
    expect(container.querySelector('button')).toBeNull();
    root.unmount();
    expect(() => render('terminal-error', ' ')).toThrow(
      'SECTION03_SYSTEM_FEEDBACK_MESSAGE_REQUIRED',
    );
  });
});
