// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PresentationGraphContentError,
  resolvePresentationGraphContent,
} from './content';
import { PresentationGraphBridgeContent } from './GraphBridgeContent';
import { PresentationGraphBridgeItem } from './GraphBridgeItem';
import { PresentationGraphBridgeItems } from './GraphBridgeItems';
import {
  PresentationGraphBridgeError,
  type ResolvedPresentationGraphBridgeItem,
} from './model';
import { definePresentationGraphExecutionPort } from './port';
import { createPresentationGraphBridge } from './resolver';

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

const text = (value: string) => ({ kind: 'text', text: value } as const);

function harness(interactionPending = false) {
  const action = Object.freeze({
    definition: {
      visual: {
        label: 'Legacy label',
        icon: 'legacy.svg',
        variant: 'outlineBlue',
        size: 'fixed55',
      },
    },
  });
  const execute = vi.fn(async () => Object.freeze({ kind: 'runtime-result' }));
  const port = definePresentationGraphExecutionPort({
    activationId: 12,
    nodeId: 'NODE',
    describe: (candidate: object) => {
      if (candidate !== action) {
        throw new Error('unowned');
      }
      return Object.freeze({
        kind: 'graph-runtime-action-descriptor' as const,
        activationId: 12,
        nodeId: 'NODE',
        actionClass: 'business' as const,
        actionId: 'exact-action',
      });
    },
    execute,
  });
  const bridge = createPresentationGraphBridge(port);
  const view = bridge.resolve({
    nodeId: 'NODE',
    items: [
      {
        kind: 'control-action-button',
        id: '01-action',
        interaction: {
          kind: 'action',
          action,
          baseAvailability: 'enabled',
        },
        controlKey: 'action-neutral',
        label: text('Bridge action'),
        ariaLabel: 'Exact action',
      },
      {
        kind: 'control-list-button',
        id: '02-control-list',
        interaction: {
          kind: 'action',
          action,
          baseAvailability: 'enabled',
        },
        controlKey: 'navigation-open',
        mainLine: text('Control main'),
        secondaryLines: [
          {
            id: 'positive',
            stateKey: 'state-positive',
            content: text('First summary'),
          },
          {
            id: 'warning',
            stateKey: 'state-warning',
            content: text('Second summary'),
          },
        ],
      },
      {
        kind: 'state-list-button',
        id: '03-state-list',
        stateKey: 'state-positive',
        interaction: { kind: 'inert' },
        mainLine: text('State main'),
        secondaryLines: [
          {
            id: 'state-info',
            stateKey: 'state-info',
            content: text('State first'),
          },
          {
            id: 'state-danger',
            stateKey: 'state-danger',
            content: text('State second'),
          },
        ],
      },
      {
        kind: 'entity-row',
        id: '04-entity',
        stateKey: 'state-warning',
        interaction: { kind: 'inert' },
        primary: text('Entity primary'),
        secondary: text('Entity secondary'),
      },
      {
        kind: 'card',
        id: '05-card',
        stateKey: 'state-info',
        title: text('Card title'),
        lines: [
          {
            id: 'card-heading',
            content: text('Confirm action'),
          },
          {
            id: 'card-name',
            label: text('Name'),
            value: text('Full name'),
          },
          {
            id: 'card-activity',
            content: text('Activity\nSecond line'),
          },
          {
            id: 'card-comment',
            label: text('Comment'),
            value: text('Long detail'),
          },
        ],
      },
      {
        kind: 'summary-line',
        id: '06-summary',
        stateKey: 'state-neutral',
        content: text('Standalone summary'),
      },
      {
        kind: 'message',
        id: '07-message',
        stateKey: 'state-danger',
        content: {
          kind: 'time',
          request: {
            role: 'date-time-multiline',
            timestamp: '2026-07-29T20:30Z',
          },
        },
        role: 'alert',
        ariaLive: 'assertive',
        ariaBusy: false,
      },
      {
        kind: 'feedback-block',
        id: '08-feedback',
        feedbackKind: 'recoverable-error',
        message: text('Try again'),
        retry: {
          interaction: {
            kind: 'action',
            action,
            baseAvailability: 'enabled',
          },
          label: text('Retry'),
        },
      },
    ],
  }, { interactionPending });
  return { action, execute, view };
}

describe('presentation Graph Bridge primitive rendering', () => {
  it('renders owned one-line, multiline and HTML-looking content exactly', () => {
    const oneLine = resolvePresentationGraphContent(text('<img src=x>'));
    render(<PresentationGraphBridgeContent content={oneLine} />);
    expect(container.textContent).toBe('<img src=x>');
    expect(container.querySelector('img')).toBeNull();

    const multiline = resolvePresentationGraphContent({
      kind: 'time',
      request: {
        role: 'date-time-multiline',
        timestamp: '2026-07-29T20:30Z',
      },
    });
    render(<PresentationGraphBridgeContent content={multiline} />);
    expect(container.textContent).toBe('30.07.202601:30');
    expect(container.innerHTML).toBe('30.07.2026<br>01:30');
  });

  it('renders the eight non-form primitive kinds in exact order without a wrapper', () => {
    const { execute, view } = harness();
    render(<PresentationGraphBridgeItems items={view.items} />);

    expect([...container.children].map((element) => element.className))
      .toEqual([
        'peaks-presentation-action-button',
        'peaks-presentation-control-list-button',
        'peaks-presentation-state-list-button',
        'peaks-presentation-entity-row',
        'peaks-presentation-card',
        'peaks-presentation-summary-line',
        'peaks-presentation-message',
        'peaks-presentation-feedback-block',
      ]);
    expect(container.children).toHaveLength(8);
    expect(container.firstElementChild?.parentElement).toBe(container);

    const actionButton = container.children[0] as HTMLButtonElement;
    expect(actionButton.dataset.controlKey).toBe('action-neutral');
    expect(actionButton.dataset.availability).toBe('enabled');
    expect(actionButton.getAttribute('aria-label')).toBe('Exact action');
    expect(actionButton.textContent).toBe('Bridge action');

    const summaries = container.children[1]!.querySelectorAll(
      '.peaks-presentation-summary-line',
    );
    expect([...summaries].map((line) => ({
      state: (line as HTMLElement).dataset.stateKey,
      text: line.textContent,
    }))).toEqual([
      { state: 'state-positive', text: 'First summary' },
      { state: 'state-warning', text: 'Second summary' },
    ]);
    expect((container.children[2] as HTMLButtonElement).disabled).toBe(true);
    expect((container.children[2] as HTMLElement).dataset.availability)
      .toBe('inert');
    const stateSummaries = container.children[2]!.querySelectorAll(
      '.peaks-presentation-summary-line',
    );
    expect([...stateSummaries].map((line) => ({
      state: (line as HTMLElement).dataset.stateKey,
      text: line.textContent,
    }))).toEqual([
      { state: 'state-info', text: 'State first' },
      { state: 'state-danger', text: 'State second' },
    ]);
    expect((container.children[3] as HTMLButtonElement).disabled).toBe(true);
    expect((container.children[4] as HTMLElement).dataset.stateKey)
      .toBe('state-info');
    const cardLines = container.children[4]!.querySelectorAll(
      '.peaks-presentation-card__line',
    );
    expect([...cardLines].map((line) => line.textContent)).toEqual([
      'Confirm action',
      'NameFull name',
      'Activity\nSecond line',
      'CommentLong detail',
    ]);
    expect([...cardLines].map((line) => line.className)).toEqual([
      'peaks-presentation-card__line peaks-presentation-card__line--content',
      'peaks-presentation-card__line',
      'peaks-presentation-card__line peaks-presentation-card__line--content',
      'peaks-presentation-card__line',
    ]);
    for (const line of [cardLines[0], cardLines[2]]) {
      expect(line?.querySelector('.peaks-presentation-card__content'))
        .not.toBeNull();
      expect(line?.querySelector('.peaks-presentation-card__label')).toBeNull();
      expect(line?.querySelector('.peaks-presentation-card__value')).toBeNull();
    }
    expect(container.children[5]!.textContent).toBe('Standalone summary');
    expect(container.children[6]!.innerHTML).toContain(
      '30.07.2026<br>01:30',
    );
    expect(container.children[6]!.getAttribute('role')).toBe('alert');
    expect((container.children[7] as HTMLElement).dataset.feedbackKind)
      .toBe('recoverable-error');
    expect(container.children[7]!.querySelector('button')?.textContent)
      .toBe('Retry');
    expect(container.innerHTML).not.toContain('legacy.svg');
    expect(container.innerHTML).not.toContain('outlineBlue');
    expect(container.innerHTML).not.toContain('fixed55');
    expect(execute).not.toHaveBeenCalled();

    act(() => actionButton.click());
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('renders pending action and retry controls disabled with no click path', () => {
    const { execute, view } = harness(true);
    render(<PresentationGraphBridgeItems items={view.items} />);

    const actionButton = container.children[0] as HTMLButtonElement;
    const retryButton = container.children[7]!.querySelector(
      'button',
    ) as HTMLButtonElement;
    expect(actionButton.disabled).toBe(true);
    expect(actionButton.dataset.availability).toBe('pending');
    expect(actionButton.getAttribute('aria-busy')).toBe('true');
    expect(retryButton.disabled).toBe(true);
    expect(retryButton.dataset.availability).toBe('pending');
    act(() => {
      actionButton.click();
      retryButton.click();
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects structural content and item clones', () => {
    const content = resolvePresentationGraphContent(text('Owned'));
    expect(() => PresentationGraphBridgeContent({
      content: { ...content },
    })).toThrowError(expect.objectContaining({
      code: 'INVALID_GRAPH_CONTENT',
    }) as PresentationGraphContentError);

    const { view } = harness();
    const clone = {
      ...view.items[0],
    } as ResolvedPresentationGraphBridgeItem;
    expect(() => PresentationGraphBridgeItem({ item: clone }))
      .toThrowError(expect.objectContaining({
        code: 'BRIDGE_ITEM_NOT_OWNED',
      }) as PresentationGraphBridgeError);
  });
});
