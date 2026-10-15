// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveControlPresentation } from '../controls';
import {
  resolveContentFeedback,
  resolveControlFeedback,
} from '../feedback';
import { resolveStatePresentation } from '../states';
import { PresentationActionButton } from './ActionButton';
import { PresentationCard } from './Card';
import { PresentationControlListButton } from './ControlListButton';
import { PresentationEntityRow } from './EntityRow';
import { PresentationFeedbackBlock } from './FeedbackBlock';
import { PresentationMessage } from './Message';
import { PresentationStateListButton } from './StateListButton';
import { PresentationSummaryLine } from './SummaryLine';
import type {
  ActionButtonControlPresentation,
  CardStatePresentation,
  EntityRowStatePresentation,
  ListButtonControlPresentation,
  ListButtonStatePresentation,
  MessageStatePresentation,
  SummaryLineStatePresentation,
} from './contracts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(element: ReactElement): void {
  act(() => root.render(element));
}

const action = resolveControlPresentation({
  key: 'action-neutral',
  surface: 'action-button',
}) as ActionButtonControlPresentation;
const controlList = resolveControlPresentation({
  key: 'navigation-open',
  surface: 'list-button',
}) as ListButtonControlPresentation;
const stateList = resolveStatePresentation({
  key: 'state-positive',
  surface: 'list-button',
}) as ListButtonStatePresentation;
const entity = resolveStatePresentation({
  key: 'state-warning',
  surface: 'entity-row',
}) as EntityRowStatePresentation;
const card = resolveStatePresentation({
  key: 'state-info',
  surface: 'card',
}) as CardStatePresentation;
const summary = resolveStatePresentation({
  key: 'state-neutral',
  surface: 'summary-line',
}) as SummaryLineStatePresentation;
const message = resolveStatePresentation({
  key: 'state-danger',
  surface: 'message',
}) as MessageStatePresentation;

function feedback(
  availability: 'enabled' | 'disabled' | 'inert' | 'pending',
  preserveToneWhenDisabled = false,
) {
  return resolveControlFeedback({
    availability,
    preserveToneWhenDisabled,
  });
}

describe('dumb presentation primitive DOM', () => {
  it('renders exact action DOM, style bindings and enabled interaction', () => {
    const onPress = vi.fn();
    render(
      <PresentationActionButton
        ariaLabel="action"
        feedback={feedback('enabled')}
        label="Apply"
        presentation={action}
        onPress={onPress}
      />,
    );
    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.className).toBe('peaks-presentation-action-button');
    expect(button.dataset.controlKey).toBe('action-neutral');
    expect(button.dataset.availability).toBe('enabled');
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-disabled')).toBe('false');
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(button.style.getPropertyValue(
      '--peaks-presentation-background',
    )).toBe(action.tokens.background);
    expect(button.style.getPropertyValue(
      '--peaks-presentation-border',
    )).toBe(action.tokens.border);
    expect(button.style.getPropertyValue(
      '--peaks-presentation-text',
    )).toBe(action.tokens.text);
    act(() => button.click());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('suppresses disabled and pending handlers and shows exact feedback', () => {
    const disabledPress = vi.fn();
    render(
      <PresentationActionButton
        feedback={feedback('disabled')}
        label="Disabled"
        presentation={action}
        onPress={disabledPress}
      />,
    );
    let button = container.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toBe(
      'peaks-presentation-action-button peaks-presentation-feedback--muted',
    );
    act(() => button.click());
    expect(disabledPress).not.toHaveBeenCalled();

    render(
      <PresentationActionButton
        feedback={feedback('pending')}
        label="Pending"
        presentation={action}
        onPress={disabledPress}
      />,
    );
    button = container.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toBe('peaks-presentation-action-button');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('.peaks-presentation-spinner')).not.toBeNull();
    act(() => button.click());
    expect(disabledPress).not.toHaveBeenCalled();
  });

  it('renders control list lines and feedback without state input', () => {
    const onPress = vi.fn();
    render(
      <PresentationControlListButton
        feedback={feedback('enabled')}
        mainLine="Main"
        presentation={controlList}
        secondaryLine="Secondary"
        onPress={onPress}
      />,
    );
    expect(container.querySelector(
      '.peaks-presentation-control-list-button__main',
    )?.textContent).toBe('Main');
    expect(container.querySelector(
      '.peaks-presentation-control-list-button__secondary',
    )?.textContent).toBe('Secondary');
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders state list and entity markers with preserved inert tone', () => {
    render(
      <PresentationStateListButton
        feedback={feedback('inert', stateList.preserveToneWhenDisabled)}
        mainLine="State"
        presentation={stateList}
      />,
    );
    let button = container.querySelector('button') as HTMLButtonElement;
    expect(button.className).toBe('peaks-presentation-state-list-button');
    expect(button.style.getPropertyValue(
      '--peaks-presentation-marker',
    )).toBe(stateList.tokens.marker);
    expect(container.querySelector('.peaks-presentation-state-marker')).not.toBeNull();

    render(
      <PresentationEntityRow
        feedback={feedback('pending', entity.preserveToneWhenDisabled)}
        presentation={entity}
        primary="Primary"
        secondary="Secondary"
      />,
    );
    button = container.querySelector('button') as HTMLButtonElement;
    expect(button.className).toBe('peaks-presentation-entity-row');
    expect(button.dataset.stateKey).toBe('state-warning');
    expect(container.querySelector('.peaks-presentation-state-marker')).not.toBeNull();
    expect(container.querySelector('.peaks-presentation-spinner')).not.toBeNull();
  });

  it('renders ordered labeled and content-only card lines without fallback or click path', () => {
    render(
      <PresentationCard
        lines={[
          { content: 'Подтвердите действие:' },
          { label: 'ФИО', value: 'Длинное имя сотрудника' },
          { content: 'Дополнительная работа\nВторая строка активности' },
          { label: 'Комментарий', value: 'Длинное значение\nна двух строках' },
        ]}
        presentation={card}
        title="Title"
      />,
    );
    expect(container.querySelector('.peaks-presentation-card__title')?.textContent).toBe('Title');
    const lines = [...container.querySelectorAll('.peaks-presentation-card__line')];
    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line.textContent)).toEqual([
      'Подтвердите действие:',
      'ФИОДлинное имя сотрудника',
      'Дополнительная работа\nВторая строка активности',
      'КомментарийДлинное значение\nна двух строках',
    ]);
    expect(lines.map((line) => line.className)).toEqual([
      'peaks-presentation-card__line peaks-presentation-card__line--content',
      'peaks-presentation-card__line',
      'peaks-presentation-card__line peaks-presentation-card__line--content',
      'peaks-presentation-card__line',
    ]);
    for (const index of [0, 2]) {
      expect(lines[index]?.querySelector('.peaks-presentation-card__content')).not.toBeNull();
      expect(lines[index]?.querySelector('.peaks-presentation-card__label')).toBeNull();
      expect(lines[index]?.querySelector('.peaks-presentation-card__value')).toBeNull();
    }
    expect(container.textContent).not.toContain('—');
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders summary and message with exact state and ARIA contracts', () => {
    render(
      <PresentationSummaryLine presentation={summary}>
        Summary
      </PresentationSummaryLine>,
    );
    const line = container.firstElementChild as HTMLElement;
    expect(line.className).toBe('peaks-presentation-summary-line');
    expect(line.style.getPropertyValue(
      '--peaks-presentation-background',
    )).toBe('transparent');
    expect(container.querySelector('button')).toBeNull();

    render(
      <PresentationMessage
        ariaBusy
        ariaLive="assertive"
        presentation={message}
        role="alert"
      >
        Message
      </PresentationMessage>,
    );
    const section = container.firstElementChild as HTMLElement;
    expect(section.getAttribute('role')).toBe('alert');
    expect(section.getAttribute('aria-live')).toBe('assertive');
    expect(section.getAttribute('aria-busy')).toBe('true');
  });

  it('renders all content feedback kinds without default text', () => {
    for (const kind of [
      'loading',
      'empty',
      'success',
      'terminal-error',
    ] as const) {
      render(
        <PresentationFeedbackBlock
          message={kind}
          presentation={resolveContentFeedback({ kind })}
        />,
      );
      const feedbackBlock = container.firstElementChild as HTMLElement;
      expect(feedbackBlock.className).toBe(
        'peaks-presentation-feedback-block',
      );
      expect(feedbackBlock.dataset.feedbackKind).toBe(kind);
      expect(feedbackBlock.textContent).toBe(kind);
      expect(container.querySelector('button')).toBeNull();
      expect(Boolean(container.querySelector(
        '.peaks-presentation-spinner',
      ))).toBe(kind === 'loading');
    }
  });

  it('enforces recoverable retry interaction and pending suppression', () => {
    const presentation = resolveContentFeedback({
      kind: 'recoverable-error',
    });
    const onRetry = vi.fn();
    render(
      <PresentationFeedbackBlock
        message="Recoverable"
        presentation={presentation}
        retryFeedback={feedback('enabled')}
        retryLabel="Retry"
        onRetry={onRetry}
      />,
    );
    let button = container.querySelector('button') as HTMLButtonElement;
    expect(button.dataset.controlKey).toBe('action-neutral');
    act(() => button.click());
    expect(onRetry).toHaveBeenCalledTimes(1);

    render(
      <PresentationFeedbackBlock
        message="Recoverable"
        presentation={presentation}
        retryFeedback={feedback('pending')}
        retryLabel="Retry"
        onRetry={onRetry}
      />,
    );
    button = container.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.peaks-presentation-spinner')).not.toBeNull();
    act(() => button.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
