import { describe, expect, it, vi } from 'vitest';

import {
  PresentationGraphBridgeError,
  isPresentationGraphBridgeItemOwned,
  type PresentationGraphBridgeErrorCode,
} from './model';
import {
  definePresentationGraphExecutionPort,
} from './port';
import { createPresentationGraphBridge } from './resolver';

const text = (value: string) => ({ kind: 'text', text: value } as const);

function harness() {
  const descriptors = new Map<object, Readonly<{
    kind: 'graph-runtime-action-descriptor';
    activationId: number;
    nodeId: string;
    actionClass: 'business' | 'presentation';
    actionId: string;
  }>>();
  const describe = vi.fn((action: object) => {
    const descriptor = descriptors.get(action);
    if (descriptor === undefined) {
      throw new Error('unowned action');
    }
    return descriptor;
  });
  const execute = vi.fn(async (action: object) => ({ action }));
  const port = definePresentationGraphExecutionPort({
    activationId: 9,
    nodeId: 'NODE',
    describe,
    execute,
  });
  const bridge = createPresentationGraphBridge(port);
  const action = (
    actionId: string,
    actionClass: 'business' | 'presentation' = 'business',
    legacy: object = {},
  ) => {
    const value = Object.freeze({ legacy });
    descriptors.set(value, Object.freeze({
      kind: 'graph-runtime-action-descriptor',
      activationId: 9,
      nodeId: 'NODE',
      actionClass,
      actionId,
    }));
    return value;
  };
  return { descriptors, describe, execute, port, bridge, action };
}

function bridgeCode(callback: () => unknown): PresentationGraphBridgeErrorCode {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(PresentationGraphBridgeError);
    return (error as PresentationGraphBridgeError).code;
  }
  throw new Error('Expected bridge error.');
}

function options(interactionPending = false) {
  return { interactionPending };
}

describe('sealed presentation Graph Bridge resolver', () => {
  it('keeps an unavailable static action button inert without inventing a graph action', () => {
    const fixture = harness();
    const [resolved] = fixture.bridge.resolve({
      nodeId: 'NODE',
      items: [{
        kind: 'control-action-button',
        id: 'unavailable-action',
        interaction: { kind: 'inert' },
        controlKey: 'action-neutral',
        label: text('Unavailable action'),
      }],
    }, options()).items;

    expect(resolved).toMatchObject({
      kind: 'control-action-button',
      actionId: null,
      actionClass: null,
      feedback: { availability: 'inert' },
      onPress: undefined,
    });
  });

  it('resolves a frozen owned flat view containing the eight non-form kinds', () => {
    const fixture = harness();
    const action = fixture.action('action');
    const actionItem = {
      kind: 'control-action-button',
      id: 'action',
      interaction: {
        kind: 'action',
        action,
        baseAvailability: 'enabled',
      },
      controlKey: 'action-neutral',
      label: text('Action'),
    };
    const projection = {
      nodeId: 'NODE',
      items: [
        actionItem,
        {
          kind: 'control-list-button',
          id: 'control-list',
          interaction: {
            kind: 'action',
            action,
            baseAvailability: 'enabled',
          },
          controlKey: 'navigation-open',
          mainLine: text('Control list'),
          secondaryLines: [
            {
              id: 'summary-a',
              stateKey: 'state-positive',
              content: text('Positive'),
            },
            {
              id: 'summary-b',
              stateKey: 'state-warning',
              content: text('Warning'),
            },
          ],
        },
        {
          kind: 'state-list-button',
          id: 'state-list',
          stateKey: 'state-positive',
          interaction: { kind: 'inert' },
          mainLine: text('State list'),
        },
        {
          kind: 'entity-row',
          id: 'entity',
          stateKey: 'state-warning',
          interaction: {
            kind: 'action',
            action,
            baseAvailability: 'disabled',
          },
          primary: text('Primary'),
          secondary: text('Secondary'),
        },
        {
          kind: 'card',
          id: 'card',
          stateKey: 'state-info',
          title: text('Card'),
          lines: [
            { id: 'heading', content: text('Heading') },
            { id: 'name', label: text('Name'), value: text('Value') },
            { id: 'activity', content: text('Activity') },
            { id: 'comment', label: text('Comment'), value: text('Detail') },
          ],
        },
        {
          kind: 'summary-line',
          id: 'summary',
          stateKey: 'state-neutral',
          content: text('Summary'),
        },
        {
          kind: 'message',
          id: 'message',
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
          id: 'feedback',
          feedbackKind: 'recoverable-error',
          message: text('Recoverable'),
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
    };
    const view = fixture.bridge.resolve(projection, options());

    expect(view.nodeId).toBe('NODE');
    expect(view.items.map((item) => item.kind)).toEqual([
      'control-action-button',
      'control-list-button',
      'state-list-button',
      'entity-row',
      'card',
      'summary-line',
      'message',
      'feedback-block',
    ]);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.items)).toBe(true);
    for (const item of view.items) {
      expect(Object.isFrozen(item)).toBe(true);
      expect(isPresentationGraphBridgeItemOwned(item)).toBe(true);
      expect(Object.values(item)).not.toContain(action);
      expect(Object.values(item)).not.toContain(fixture.port);
    }
    expect(view.items[0]).toMatchObject({
      actionId: 'action',
      actionClass: 'business',
      presentation: { surface: 'action-button' },
      feedback: { availability: 'enabled' },
    });
    expect(view.items[1]).toMatchObject({
      presentation: { surface: 'list-button' },
    });
    expect(view.items[2]).toMatchObject({
      actionId: null,
      actionClass: null,
      presentation: { surface: 'list-button' },
      feedback: { availability: 'inert', visualTreatment: 'full' },
      onPress: undefined,
    });
    expect(view.items[3]).toMatchObject({
      presentation: { surface: 'entity-row' },
      feedback: { availability: 'disabled', visualTreatment: 'full' },
    });
    expect(view.items[4]).toMatchObject({
      presentation: { surface: 'card' },
    });
    const card = view.items[4];
    expect(card?.kind).toBe('card');
    if (card?.kind !== 'card') {
      throw new Error('Expected resolved card.');
    }
    expect(card.lines.map((line) => line.id)).toEqual([
      'heading',
      'name',
      'activity',
      'comment',
    ]);
    expect(card.lines.map((line) => Object.keys(line))).toEqual([
      ['id', 'content'],
      ['id', 'label', 'value'],
      ['id', 'content'],
      ['id', 'label', 'value'],
    ]);
    expect(Object.isFrozen(card.lines)).toBe(true);
    for (const line of card.lines) {
      expect(Object.isFrozen(line)).toBe(true);
    }
    expect(view.items[5]).toMatchObject({
      presentation: { surface: 'summary-line' },
    });
    expect(view.items[6]).toMatchObject({
      presentation: { surface: 'message' },
      content: { lines: ['30.07.2026', '01:30'] },
    });
    expect(view.items[7]).toMatchObject({
      presentation: {
        kind: 'recoverable-error',
        retryControl: { key: 'action-neutral', surface: 'action-button' },
      },
      retryFeedback: { availability: 'enabled' },
    });
    expect(fixture.describe).toHaveBeenCalledTimes(4);
    expect(fixture.execute).not.toHaveBeenCalled();
    expect(actionItem.interaction.action).toBe(action);
  });

  it('enforces projection, identity, nested and retry boundaries', () => {
    const fixture = harness();
    const action = fixture.action('action');
    expect(fixture.bridge.resolve(
      { nodeId: 'NODE', items: [] },
      options(),
    )).toEqual({ nodeId: 'NODE', items: [] });
    expect(bridgeCode(() => fixture.bridge.resolve(null, options()))).toBe(
      'INVALID_GRAPH_BRIDGE_PROJECTION',
    );
    expect(bridgeCode(() => fixture.bridge.resolve(
      { nodeId: 'OTHER', items: [] },
      options(),
    ))).toBe('GRAPH_BRIDGE_NODE_MISMATCH');
    expect(bridgeCode(() => fixture.bridge.resolve(
      { nodeId: 'NODE', items: [], extra: true },
      options(),
    ))).toBe('UNKNOWN_GRAPH_BRIDGE_PROJECTION_FIELD');
    expect(bridgeCode(() => fixture.bridge.resolve(
      { nodeId: 'NODE', items: [] },
      { interactionPending: false, extra: true },
    ))).toBe('UNKNOWN_GRAPH_BRIDGE_OPTION_FIELD');
    expect(bridgeCode(() => fixture.bridge.resolve(
      { nodeId: 'NODE', items: [] },
      { interactionPending: 'false' },
    ))).toBe('INVALID_INTERACTION_PENDING');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [
          {
            kind: 'summary-line',
            id: 'same',
            stateKey: 'state-info',
            content: text('A'),
          },
          {
            kind: 'message',
            id: 'same',
            stateKey: 'state-info',
            content: text('B'),
          },
        ],
      },
      options(),
    ))).toBe('DUPLICATE_RENDER_ID');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'control-list-button',
          id: 'list',
          interaction: {
            kind: 'action',
            action,
            baseAvailability: 'enabled',
          },
          controlKey: 'navigation-open',
          mainLine: text('Main'),
          secondaryLine: text('One'),
          secondaryLines: [{
            id: 'line',
            stateKey: 'state-info',
            content: text('Two'),
          }],
        }],
      },
      options(),
    ))).toBe('INVALID_SECONDARY_CONTENT');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'card',
          id: 'card',
          stateKey: 'state-info',
          lines: [],
        }],
      },
      options(),
    ))).toBe('INVALID_CARD_LINES');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'card',
          id: 'card',
          stateKey: 'state-info',
          lines: [{
            id: 'mixed',
            label: text('Label'),
            value: text('Value'),
            content: text('Content'),
          }],
        }],
      },
      options(),
    ))).toBe('INVALID_CARD_LINES');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'card',
          id: 'card',
          stateKey: 'state-info',
          lines: [{ id: 'missing', label: text('Label') }],
        }],
      },
      options(),
    ))).toBe('INVALID_CARD_LINES');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'card',
          id: 'card',
          stateKey: 'state-info',
          lines: [{
            id: 'extra',
            content: text('Content'),
            extra: true,
          }],
        }],
      },
      options(),
    ))).toBe('INVALID_CARD_LINES');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'card',
          id: 'card',
          stateKey: 'state-info',
          lines: [
            { id: 'same', content: text('Content') },
            { id: 'same', label: text('Label'), value: text('Value') },
          ],
        }],
      },
      options(),
    ))).toBe('DUPLICATE_CARD_LINE_ID');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'feedback-block',
          id: 'feedback',
          feedbackKind: 'recoverable-error',
          message: text('Error'),
        }],
      },
      options(),
    ))).toBe('RETRY_BINDING_REQUIRED');
    expect(bridgeCode(() => fixture.bridge.resolve(
      {
        nodeId: 'NODE',
        items: [{
          kind: 'feedback-block',
          id: 'feedback',
          feedbackKind: 'success',
          message: text('Done'),
          retry: {
            interaction: {
              kind: 'action',
              action,
              baseAvailability: 'enabled',
            },
            label: text('Retry'),
          },
        }],
      },
      options(),
    ))).toBe('RETRY_BINDING_FORBIDDEN');
  });

  it('applies only the exact action, disabled, inert and pending matrix', () => {
    const fixture = harness();
    const action = fixture.action('action');
    const item = (
      id: string,
      interaction: object,
    ) => ({
      kind: 'state-list-button',
      id,
      stateKey: 'state-positive',
      interaction,
      mainLine: text(id),
      secondaryLines: [{
        id: `${id}-summary`,
        stateKey: 'state-warning',
        content: text(`${id} summary`),
      }],
    });
    const resolve = (interactionPending: boolean) =>
      fixture.bridge.resolve({
        nodeId: 'NODE',
        items: [
          item('enabled', {
            kind: 'action',
            action,
            baseAvailability: 'enabled',
          }),
          item('disabled', {
            kind: 'action',
            action,
            baseAvailability: 'disabled',
          }),
          item('inert', { kind: 'inert' }),
        ],
      }, options(interactionPending)).items;

    const normal = resolve(false);
    const pending = resolve(true);
    expect(normal.map((item) => 'feedback' in item
      ? item.feedback.availability
      : null)).toEqual(['enabled', 'disabled', 'inert']);
    expect(pending.map((item) => 'feedback' in item
      ? item.feedback.availability
      : null)).toEqual(['pending', 'disabled', 'inert']);
    expect(normal[0]?.kind).toBe('state-list-button');
    expect(normal[1]?.kind).toBe('state-list-button');
    expect(normal[2]?.kind).toBe('state-list-button');
    expect(pending[0]?.kind).toBe('state-list-button');
    if (
      normal[0]?.kind !== 'state-list-button' ||
      normal[1]?.kind !== 'state-list-button' ||
      normal[2]?.kind !== 'state-list-button' ||
      pending[0]?.kind !== 'state-list-button'
    ) {
      throw new Error('Expected state list bridge items.');
    }
    expect(normal[0].onPress).toBeDefined();
    expect(normal[1].onPress).toBeUndefined();
    expect(normal[2].onPress).toBeUndefined();
    expect(pending[0].onPress).toBeUndefined();
    for (const resolved of [...normal, ...pending]) {
      if (resolved.kind !== 'state-list-button') {
        throw new Error('Expected state list bridge item.');
      }
      expect(resolved.secondaryLines).toHaveLength(1);
      expect(resolved.secondaryLines?.[0]?.presentation).toMatchObject({
        key: 'state-warning',
        surface: 'summary-line',
      });
      expect(Object.isFrozen(resolved.secondaryLines)).toBe(true);
      expect(Object.isFrozen(resolved.secondaryLines?.[0])).toBe(true);
    }
  });

  it('closes state-list secondary line structure and local identity', () => {
    const fixture = harness();
    const base = {
      kind: 'state-list-button',
      id: 'state',
      stateKey: 'state-info',
      interaction: { kind: 'inert' },
      mainLine: text('State'),
    };
    expect(bridgeCode(() => fixture.bridge.resolve({
      nodeId: 'NODE',
      items: [{
        ...base,
        secondaryLine: text('Single'),
        secondaryLines: [{
          id: 'summary',
          stateKey: 'state-info',
          content: text('Summary'),
        }],
      }],
    }, options()))).toBe('INVALID_SECONDARY_CONTENT');
    expect(bridgeCode(() => fixture.bridge.resolve({
      nodeId: 'NODE',
      items: [{ ...base, secondaryLines: [] }],
    }, options()))).toBe('INVALID_SECONDARY_LINES');
    expect(bridgeCode(() => fixture.bridge.resolve({
      nodeId: 'NODE',
      items: [{
        ...base,
        secondaryLines: [
          {
            id: 'same',
            stateKey: 'state-info',
            content: text('First'),
          },
          {
            id: 'same',
            stateKey: 'state-danger',
            content: text('Second'),
          },
        ],
      }],
    }, options()))).toBe('DUPLICATE_SECONDARY_LINE_ID');
  });

  it('verifies descriptors, preserves describe errors and rejects clones', () => {
    const fixture = harness();
    const action = fixture.action('action');
    const projection = {
      nodeId: 'NODE',
      items: [{
        kind: 'control-action-button',
        id: 'action',
        interaction: {
          kind: 'action',
          action,
          baseAvailability: 'enabled',
        },
        controlKey: 'action-neutral',
        label: text('Action'),
      }],
    };
    fixture.descriptors.set(action, Object.freeze({
      kind: 'graph-runtime-action-descriptor',
      activationId: 10,
      nodeId: 'NODE',
      actionClass: 'business',
      actionId: 'action',
    }));
    expect(bridgeCode(() =>
      fixture.bridge.resolve(projection, options()),
    )).toBe('ACTION_DESCRIPTOR_MISMATCH');

    fixture.descriptors.delete(action);
    try {
      fixture.bridge.resolve(projection, options());
    } catch (error) {
      expect((error as PresentationGraphBridgeError).code).toBe(
        'ACTION_NOT_OWNED',
      );
      expect((error as PresentationGraphBridgeError).originalError)
        .toBeInstanceOf(Error);
    }
    expect(bridgeCode(() =>
      createPresentationGraphBridge({ ...fixture.port }),
    )).toBe('INVALID_GRAPH_BRIDGE_PORT');
  });

  it('ignores legacy visuals and delegates exact actions with stable callbacks', () => {
    const fixture = harness();
    const firstAction = fixture.action('same', 'presentation', {
      visual: { color: 'old-a', image: 'a', text: 'Old A' },
    });
    const secondAction = fixture.action('same', 'presentation', {
      visual: { color: 'old-b', image: 'b', text: 'Old B' },
    });
    const project = (action: object) => ({
      nodeId: 'NODE',
      items: [{
        kind: 'control-action-button',
        id: 'action',
        interaction: {
          kind: 'action',
          action,
          baseAvailability: 'enabled',
        },
        controlKey: 'navigation-back',
        label: text('Bridge label'),
      }],
    });
    const first = fixture.bridge.resolve(
      project(firstAction),
      options(),
    ).items[0];
    const repeated = fixture.bridge.resolve(
      project(firstAction),
      options(),
    ).items[0];
    const second = fixture.bridge.resolve(
      project(secondAction),
      options(),
    ).items[0];

    expect(first?.kind).toBe('control-action-button');
    expect(repeated?.kind).toBe('control-action-button');
    expect(second?.kind).toBe('control-action-button');
    if (
      first?.kind !== 'control-action-button' ||
      repeated?.kind !== 'control-action-button' ||
      second?.kind !== 'control-action-button'
    ) {
      throw new Error('Expected control action bridge items.');
    }
    expect(first.onPress).toBe(repeated.onPress);
    expect(first).toMatchObject({
      actionId: 'same',
      actionClass: 'presentation',
      presentation: { key: 'navigation-back' },
      label: { text: 'Bridge label' },
    });
    expect(second).toMatchObject({
      actionId: 'same',
      actionClass: 'presentation',
      presentation: { key: 'navigation-back' },
      label: { text: 'Bridge label' },
    });
    first.onPress?.();
    expect(fixture.execute).toHaveBeenCalledTimes(1);
    expect(fixture.execute).toHaveBeenCalledWith(firstAction);
  });
});
