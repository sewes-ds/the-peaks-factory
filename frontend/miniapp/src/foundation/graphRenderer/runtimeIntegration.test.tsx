import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
} from '../graphProtocol/action';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from '../graphProtocol/command';
import {
  defineGraphContext,
  graphContext,
} from '../graphProtocol/context';
import {
  defineGraph,
  graphNodesFor,
} from '../graphProtocol/definition';
import {
  graphInteraction,
  graphInteractionsFor,
} from '../graphProtocol/interaction';
import { defineGraphProgram } from '../graphProtocol/program';
import { graphSourcesFor } from '../graphProtocol/source';
import {
  defineGraphTransitions,
  graphTransition,
} from '../graphProtocol/transition';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
  type GraphActivationRuntime,
  type GraphPresentationExecutionRuntime,
} from '../graphRuntime';
import { PeaksGraphNodeRenderer, type PeaksGraphNodeView } from './PeaksGraphNodeRenderer';
import {
  PeaksGraphReadyNodeBindingError,
  createPeaksGraphReadyNodeBinding,
  type PeaksGraphInteractionStateChange,
  type PeaksGraphReadyNodeBinding,
  type PeaksGraphRuntimeViewProjection,
} from './runtimeIntegration';

type NodeId = 'SOURCE' | 'DESTINATION' | 'OTHER';
type TestContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;
type TestReadModel = Readonly<{
  node: NodeId;
  reads: number;
  available_actions: readonly string[];
}>;

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    root.unmount();
  }
  for (const container of containers.splice(0)) {
    container.remove();
  }
});

function makeFixture() {
  const reads: Record<NodeId, number> = {
    SOURCE: 0,
    DESTINATION: 0,
    OTHER: 0,
  };
  const commandRequest = vi.fn(async () => ({
    command: 'MOVE_DONE',
    outcome: 'DONE',
    entities: { employee_id: 'E-1' },
  }));

  const context = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
  });
  const sources = graphSourcesFor<TestContext>();
  const sourceFor = (node: NodeId) =>
    sources.required<TestReadModel, `${NodeId}-source`, '/nodes/:id'>({
      sourceId: `${node}-source`,
      endpoint: '/nodes/:id',
      request: async () => {
        reads[node] += 1;
        return {
          node,
          reads: reads[node],
          available_actions: ['MOVE_DONE'],
        };
      },
      decode: (input: unknown) => input as TestReadModel,
    });
  const nodeFor = (node: NodeId) =>
    graphNodesFor(context).endpointBacked({
      source: sources.endpointBacked(
        sources.bundle({ model: sourceFor(node) }),
      ),
      project: ({ context: currentContext, sources: currentSources }) => ({
        node,
        employeeId: currentContext.employee_id,
        model: currentSources.model,
      }),
    });
  const graph = defineGraph({
    SOURCE: nodeFor('SOURCE'),
    DESTINATION: nodeFor('DESTINATION'),
    OTHER: nodeFor('OTHER'),
  });
  const noEvent = defineGraphActionEvent({});
  const actions = defineGraphActions({
    business: {
      moveDone: graphAction.business(
        'MOVE_DONE',
        noEvent,
        graphAction.actionButton({
          label: 'Move done',
          icon: 'move.svg',
          variant: 'green',
          size: 'fixed55',
          showIcon: false,
        }),
      ),
      blockedMove: graphAction.business(
        'BLOCKED_MOVE',
        noEvent,
        graphAction.actionButton({
          label: 'Blocked',
          icon: 'blocked.svg',
          variant: 'red',
        }),
      ),
    },
    presentation: {
      back: graphAction.presentation(
        noEvent,
        graphAction.actionButton({
          label: 'Back',
          icon: 'back.svg',
          variant: 'outlineBlue',
        }),
      ),
      openDestination: graphAction.presentation(
        defineGraphActionEvent({
          employee_id: graphActionEvent.id(),
        }),
        graphAction.listButton({ variant: 'blue' }),
      ),
    },
  });
  const commandInput = defineGraphCommandInput({
    employee_id: graphCommandInput.id(),
  });
  const command = graphCommandFor(commandInput).define({
    command: 'MOVE_DONE',
    method: 'POST',
    endpoint: '/move',
    outcomes: ['DONE'],
    entities: defineGraphCommandEntities({
      employee_id: graphCommandEntity.id(),
    }),
    request: commandRequest,
  });
  const transition = defineGraphTransitions({
    graph,
    command,
    currentContext: context,
    transitions: {
      DONE: {
        node: 'OTHER',
        context: {
          employee_id: graphTransition.entityId('employee_id'),
          mode: graphTransition.context('mode'),
        },
      },
    },
  });
  const interactionsFor = graphInteractionsFor(graph, actions);
  const sourceScope = interactionsFor.node('SOURCE');
  const destinationScope = interactionsFor.node('DESTINATION');
  const otherScope = interactionsFor.node('OTHER');
  const sourceInteractions = sourceScope.define({
    business: [
      sourceScope.business({
        action: 'moveDone',
        availability: graphInteraction.availableActions(
          'model',
          'available_actions',
        ),
        command,
        input: {
          employee_id: graphInteraction.context('employee_id'),
        },
        transition,
      }),
      sourceScope.business({
        action: 'blockedMove',
        availability: graphInteraction.availableActions(
          'model',
          'available_actions',
        ),
        command,
        input: {
          employee_id: graphInteraction.context('employee_id'),
        },
        transition,
      }),
    ],
    presentation: [
      sourceScope.presentation({
        action: 'back',
        effect: graphInteraction.back(),
      }),
      sourceScope.presentation({
        action: 'openDestination',
        effect: graphInteraction.navigate('DESTINATION', {
          employee_id: graphInteraction.event('employee_id'),
          mode: graphInteraction.literal('view'),
        }),
      }),
    ],
  });
  const destinationInteractions = destinationScope.define({
    business: [],
    presentation: [
      destinationScope.presentation({
        action: 'back',
        effect: graphInteraction.back(),
      }),
    ],
  });
  const otherInteractions = otherScope.define({
    business: [],
    presentation: [
      otherScope.presentation({
        action: 'back',
        effect: graphInteraction.back(),
      }),
    ],
  });
  const program = defineGraphProgram({
    graph,
    actions,
    interactions: {
      SOURCE: sourceInteractions,
      DESTINATION: destinationInteractions,
      OTHER: otherInteractions,
    },
  });
  const baseRuntime = createGraphActivationRuntime(program);
  const runtime = Object.freeze({
    program,
    getState: baseRuntime.getState,
    activate: vi.fn(baseRuntime.activate),
    refresh: vi.fn(baseRuntime.refresh),
    coordinateInteraction: baseRuntime.coordinateInteraction,
  }) satisfies GraphActivationRuntime<typeof program>;

  return {
    program,
    baseRuntime,
    runtime,
    reads,
    commandRequest,
  };
}

async function activate(
  fixture: ReturnType<typeof makeFixture>,
  nodeId: NodeId,
  mode: 'view' | 'edit' = 'edit',
) {
  return fixture.baseRuntime.activate({
    nodeId,
    context: { employee_id: 'E-1', mode },
  });
}

async function readyBinding() {
  const fixture = makeFixture();
  await activate(fixture, 'SOURCE');
  const changes: PeaksGraphInteractionStateChange<typeof fixture.program, 'SOURCE'>[] = [];
  const presentationExecution = createGraphPresentationExecutionRuntime(
    fixture.runtime,
  );
  const binding = createPeaksGraphReadyNodeBinding({
    runtime: fixture.runtime,
    presentationExecution,
    nodeId: 'SOURCE',
    onInteractionStateChange: (change) => {
      changes.push(change);
    },
  });
  return { fixture, binding, changes, presentationExecution };
}

function businessInstance(
  binding: PeaksGraphReadyNodeBinding<ReturnType<typeof makeFixture>['program'], 'SOURCE'>,
) {
  const actions = binding.actionFactory.business(
    'moveDone',
    { ariaLabel: 'Move done action' },
    {},
  );
  if (actions.length !== 1) {
    throw new Error('expected available business action');
  }
  return actions[0];
}

function listInstance(
  binding: PeaksGraphReadyNodeBinding<ReturnType<typeof makeFixture>['program'], 'SOURCE'>,
  instanceId = 'destination-row',
) {
  return binding.actionFactory.presentation(
    'openDestination',
    {
      instanceId,
      mainLine: 'Destination',
      secondaryLine: 'Open destination',
      ariaLabel: 'Open destination action',
    },
    { employee_id: 'E-2' },
  );
}

function backInstance(
  binding: PeaksGraphReadyNodeBinding<ReturnType<typeof makeFixture>['program'], 'SOURCE'>,
) {
  return binding.actionFactory.presentation(
    'back',
    { ariaLabel: 'Back action' },
    {},
  );
}

function projection(
  binding: PeaksGraphReadyNodeBinding<ReturnType<typeof makeFixture>['program'], 'SOURCE'>,
): PeaksGraphRuntimeViewProjection<ReturnType<typeof makeFixture>['program'], 'SOURCE'> {
  return {
    ariaLabel: 'Runtime view',
    focusOnEntry: true,
    liveStatus: 'Live status',
    fixedTopItems: [
      { kind: 'info-text', id: 'info', text: 'Info', tone: 'blue' },
    ],
    scrollItems: [
      {
        kind: 'production-operation-card',
        id: 'card',
        title: 'Card title',
        lines: [{ label: 'Shift', value: 'A' }],
        tone: 'green',
      },
      { kind: 'message', id: 'message', text: 'Message' },
      businessInstance(binding),
      listInstance(binding),
    ],
    fixedBottomItems: [backInstance(binding)],
  };
}

async function render(view: PeaksGraphNodeView) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(<PeaksGraphNodeRenderer view={view} />);
  });
  return container;
}

describe('B6 runtime renderer integration binding', () => {
  it('factory rejects non-ready runtime with RUNTIME_NOT_READY', () => {
    const fixture = makeFixture();
    const presentationExecution = createGraphPresentationExecutionRuntime(
      fixture.runtime,
    );

    expect(() =>
      createPeaksGraphReadyNodeBinding({
        runtime: fixture.runtime,
        presentationExecution,
        nodeId: 'SOURCE',
        onInteractionStateChange: () => undefined,
      }),
    ).toThrowError(PeaksGraphReadyNodeBindingError);
    expect(() =>
      createPeaksGraphReadyNodeBinding({
        runtime: fixture.runtime,
        presentationExecution,
        nodeId: 'SOURCE',
        onInteractionStateChange: () => undefined,
      }),
    ).toThrowError(expect.objectContaining({ code: 'RUNTIME_NOT_READY' }));
  });

  it('factory rejects requested wrong node with NODE_MISMATCH', async () => {
    const fixture = makeFixture();
    await activate(fixture, 'SOURCE');
    const presentationExecution = createGraphPresentationExecutionRuntime(
      fixture.runtime,
    );

    expect(() =>
      createPeaksGraphReadyNodeBinding({
        runtime: fixture.runtime,
        presentationExecution,
        nodeId: 'DESTINATION',
        onInteractionStateChange: () => undefined,
      }),
    ).toThrowError(expect.objectContaining({ code: 'NODE_MISMATCH' }));
  });

  it('factory rejects presentation runtime from another activation runtime', async () => {
    const fixture = makeFixture();
    const foreign = makeFixture();
    await activate(fixture, 'SOURCE');
    const presentationExecution = createGraphPresentationExecutionRuntime(
      foreign.runtime,
    );

    expect(() =>
      createPeaksGraphReadyNodeBinding({
        runtime: fixture.runtime,
        presentationExecution: presentationExecution as unknown as GraphPresentationExecutionRuntime<typeof fixture.program>,
        nodeId: 'SOURCE',
        onInteractionStateChange: () => undefined,
      }),
    ).toThrowError(expect.objectContaining({ code: 'PRESENTATION_RUNTIME_MISMATCH' }));
  });

  it('binding uses planner.actions as exact actionFactory identity', async () => {
    const { binding } = await readyBinding();

    expect(binding.actionFactory).toBe(binding.planner.actions);
  });

  it('binding ready is exact current ready object', async () => {
    const { fixture, binding } = await readyBinding();

    expect(binding.ready).toBe(fixture.runtime.getState());
  });

  it('binding and public error/result/lifecycle objects are frozen', async () => {
    const { binding, changes } = await readyBinding();
    const result = await binding.execute(businessInstance(binding));

    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(changes[0])).toBe(true);
    expect(Object.isFrozen(changes[1])).toBe(true);
    expect(
      Object.isFrozen(
        new PeaksGraphReadyNodeBindingError({
          code: 'RUNTIME_NOT_READY',
          phase: 'binding-creation',
          message: 'frozen',
        }),
      ),
    ).toBe(true);
  });

  it('nodeId in view always comes from ready state', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      { scrollItems: [{ kind: 'message', id: 'm', text: 'Message' }] },
      { interactionPending: false },
    );

    expect(view.nodeId).toBe(binding.ready.nodeId);
  });

  it('projection type/runtime mapping cannot override nodeId', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      {
        nodeId: 'OTHER',
        scrollItems: [{ kind: 'message', id: 'm', text: 'Message' }],
      } as unknown as PeaksGraphRuntimeViewProjection<typeof binding.runtime.program, 'SOURCE'>,
      { interactionPending: false },
    );

    expect(view.nodeId).toBe('SOURCE');
  });

  it('info-text maps correctly', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      { scrollItems: [{ kind: 'info-text', id: 'info', text: 'Info', tone: 'blue' }] },
      { interactionPending: false },
    );

    expect(view.scrollObjects[0]).toMatchObject({
      kind: 'infoText',
      id: 'info',
      text: 'Info',
      tone: 'blue',
    });
  });

  it('production-operation-card maps strings/lines/tone correctly', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      {
        scrollItems: [{
          kind: 'production-operation-card',
          id: 'card',
          title: 'Operation',
          lines: [{ label: 'Employee', value: 'Dilmurod' }],
          tone: 'green',
        }],
      },
      { interactionPending: false },
    );

    expect(view.scrollObjects[0]).toMatchObject({
      kind: 'productionOperationCard',
      id: 'card',
      title: 'Operation',
      lines: [{ label: 'Employee', value: 'Dilmurod' }],
      tone: 'green',
    });
  });

  it('message maps correctly', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      { scrollItems: [{ kind: 'message', id: 'message', text: 'Ready' }] },
      { interactionPending: false },
    );

    expect(view.scrollObjects[0]).toEqual({
      kind: 'messageText',
      id: 'message',
      text: 'Ready',
    });
  });

  it('view and mapped arrays/objects are frozen', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(projection(binding), {
      interactionPending: false,
    });

    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.fixedTopObjects)).toBe(true);
    expect(Object.isFrozen(view.scrollObjects)).toBe(true);
    expect(Object.isFrozen(view.fixedBottomObjects)).toBe(true);
    expect(Object.isFrozen(view.scrollObjects[0])).toBe(true);
    expect(
      view.scrollObjects[0].kind === 'productionOperationCard' &&
        Object.isFrozen(view.scrollObjects[0].lines),
    ).toBe(true);
  });

  it('action-button visual comes only from definition/input', async () => {
    const { binding } = await readyBinding();
    const action = businessInstance(binding);
    const view = binding.createView(
      { scrollItems: [action] },
      { interactionPending: false },
    );

    expect(view.scrollObjects[0]).toMatchObject({
      kind: 'actionButton',
      id: 'moveDone',
      actionId: 'moveDone',
      label: action.definition.visual.label,
      icon: action.definition.visual.icon,
      variant: action.definition.visual.variant,
      size: action.definition.visual.size,
      showIcon: action.definition.visual.showIcon,
      ariaLabel: action.input.ariaLabel,
    });
  });

  it('list-button visual comes only from definition/input', async () => {
    const { binding } = await readyBinding();
    const action = listInstance(binding, 'row-1');
    const view = binding.createView(
      { scrollItems: [action] },
      { interactionPending: false },
    );

    expect(view.scrollObjects[0]).toMatchObject({
      kind: 'listButton',
      id: 'row-1',
      actionId: 'openDestination',
      mainLine: action.input.mainLine,
      secondaryLine: action.input.secondaryLine,
      variant: action.definition.visual.variant,
      ariaLabel: action.input.ariaLabel,
    });
  });

  it('maps an inert list button without an action callback and preserves view metadata', async () => {
    const { fixture, binding, changes } = await readyBinding();
    const view = binding.createView(
      {
        className: 'peaks-s03-screen peaks-s03-screen--v17-bound',
        scrollItems: [{
          kind: 'inert-list-button',
          id: 'inert-row',
          actionId: 'inert-row-diagnostic',
          mainLine: 'Unavailable',
          secondaryLine: 'Not connected',
          variant: 'gray',
          disabled: true,
          className: 'inert-class',
          ariaLabel: 'Unavailable — not connected',
        }],
      },
      { interactionPending: false },
    );

    expect(view.className).toBe('peaks-s03-screen peaks-s03-screen--v17-bound');
    expect(view.scrollObjects[0]).toMatchObject({
      kind: 'listButton',
      id: 'inert-row',
      actionId: 'inert-row-diagnostic',
      mainLine: 'Unavailable',
      secondaryLine: 'Not connected',
      variant: 'gray',
      disabled: true,
      className: 'inert-class',
      ariaLabel: 'Unavailable — not connected',
    });
    expect(view.scrollObjects[0].kind === 'listButton' && view.scrollObjects[0].onClick).toBeUndefined();

    const container = await render(view);
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('Unavailable — not connected');
    expect(changes).toEqual([]);
    expect(fixture.commandRequest).not.toHaveBeenCalled();
  });

  it('attaches frozen line decorations to active and inert list buttons without changing their behavior', async () => {
    const { binding } = await readyBinding();
    const active = listInstance(binding, 'active-row');
    const view = binding.createView(
      {
        scrollItems: [
          active,
          {
            kind: 'inert-list-button',
            id: 'inert-row',
            actionId: 'inert-row-diagnostic',
            mainLine: 'Inert',
            secondaryLine: 'Fallback inert',
            variant: 'gray',
            disabled: true,
          },
        ],
        listButtonLineDecorations: [
          { renderId: 'active-row', lines: [{ text: 'Active line', tone: 'green' }] },
          { renderId: 'inert-row', lines: [{ text: 'Inert line', tone: 'gray' }] },
        ],
      },
      { interactionPending: false },
    );

    const activeObject = view.scrollObjects[0];
    const inertObject = view.scrollObjects[1];
    expect(activeObject).toMatchObject({
      kind: 'listButton',
      actionId: active.actionId,
      variant: active.definition.visual.variant,
      ariaLabel: active.input.ariaLabel,
      secondaryLine: active.input.secondaryLine,
      secondaryLines: [{ text: 'Active line', tone: 'green' }],
      disabled: false,
    });
    expect(inertObject).toMatchObject({
      kind: 'listButton',
      actionId: 'inert-row-diagnostic',
      secondaryLine: 'Fallback inert',
      secondaryLines: [{ text: 'Inert line', tone: 'gray' }],
      disabled: true,
    });
    expect(activeObject.kind === 'listButton' && typeof activeObject.onClick).toBe('function');
    expect(inertObject.kind === 'listButton' && inertObject.onClick).toBeUndefined();
    expect(activeObject.kind === 'listButton' && Object.isFrozen(activeObject.secondaryLines)).toBe(true);
    expect(activeObject.kind === 'listButton' && Object.isFrozen(activeObject.secondaryLines?.[0])).toBe(true);
    expect(Object.isFrozen(view.scrollObjects)).toBe(true);
  });

  it('rejects invalid, duplicate, unknown, and non-list line decoration targets', async () => {
    const { binding } = await readyBinding();
    const create = (value: unknown) => binding.createView(
      value as PeaksGraphRuntimeViewProjection<typeof binding.runtime.program, 'SOURCE'>,
      { interactionPending: false },
    );

    expect(() => create({ scrollItems: [listInstance(binding, 'row')], listButtonLineDecorations: [{ renderId: ' ', lines: [] }] }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_LIST_BUTTON_DECORATION' }));
    expect(() => create({ scrollItems: [listInstance(binding, 'row')], listButtonLineDecorations: [{ renderId: 'row', lines: [] }, { renderId: 'row', lines: [] }] }))
      .toThrowError(expect.objectContaining({ code: 'DUPLICATE_LIST_BUTTON_DECORATION' }));
    expect(() => create({ scrollItems: [listInstance(binding, 'row')], listButtonLineDecorations: [{ renderId: 'missing', lines: [] }] }))
      .toThrowError(expect.objectContaining({ code: 'UNKNOWN_LIST_BUTTON_DECORATION_TARGET' }));
    expect(() => create({ scrollItems: [{ kind: 'message', id: 'message', text: 'Message' }], listButtonLineDecorations: [{ renderId: 'message', lines: [] }] }))
      .toThrowError(expect.objectContaining({ code: 'NON_LIST_BUTTON_DECORATION_TARGET' }));
    expect(() => create({ scrollItems: [listInstance(binding, 'row')], listButtonLineDecorations: [{ renderId: 'row', lines: [{ text: ' ', tone: 'blue' }] }] }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_LIST_BUTTON_DECORATION' }));
  });

  it('unavailable business action is absent because factory.business returns empty projection', async () => {
    const { binding } = await readyBinding();

    expect(binding.actionFactory.business('blockedMove', {}, {})).toEqual([]);
  });

  it('repeated semantic list actions with unique instanceId render', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      {
        scrollItems: [
          listInstance(binding, 'row-1'),
          listInstance(binding, 'row-2'),
        ],
      },
      { interactionPending: false },
    );

    expect(view.scrollObjects.map((object) => object.id)).toEqual(['row-1', 'row-2']);
  });

  it('empty or whitespace inert ID is INVALID_RENDER_ID', async () => {
    const { binding } = await readyBinding();

    expect(() =>
      binding.createView(
        { scrollItems: [{ kind: 'message', id: ' ', text: 'Bad' }] },
        { interactionPending: false },
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_RENDER_ID' }));
  });

  it('empty or whitespace explicit instanceId is INVALID_RENDER_ID', async () => {
    const { binding } = await readyBinding();

    expect(() =>
      binding.createView(
        { scrollItems: [listInstance(binding, '  ')] },
        { interactionPending: false },
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_RENDER_ID' }));
  });

  it('duplicate identity across regions is DUPLICATE_RENDER_ID', async () => {
    const { binding } = await readyBinding();

    expect(() =>
      binding.createView(
        {
          fixedTopItems: [{ kind: 'message', id: 'same', text: 'Top' }],
          scrollItems: [{ kind: 'message', id: 'same', text: 'Scroll' }],
        },
        { interactionPending: false },
      ),
    ).toThrowError(expect.objectContaining({ code: 'DUPLICATE_RENDER_ID' }));
  });

  it('forged or foreign action instance is rejected before pending', async () => {
    const { binding, changes } = await readyBinding();
    const forged = Object.freeze({
      ...businessInstance(binding),
    }) as unknown as ReturnType<typeof businessInstance>;
    const result = await binding.execute(forged);

    expect(result).toMatchObject({
      kind: 'binding-error',
      error: { code: 'ACTION_INSTANCE_NOT_OWNED' },
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].status).toBe('settled');
  });

  it('stale binding after new activation rejects createView', async () => {
    const { fixture, binding } = await readyBinding();
    await activate(fixture, 'DESTINATION');

    expect(() =>
      binding.createView(
        { scrollItems: [{ kind: 'message', id: 'm', text: 'Message' }] },
        { interactionPending: false },
      ),
    ).toThrowError(expect.objectContaining({ code: 'BINDING_NOT_CURRENT' }));
  });

  it('stale binding after new activation rejects execute and publishes settled only', async () => {
    const { fixture, binding, changes } = await readyBinding();
    const instance = businessInstance(binding);
    await activate(fixture, 'DESTINATION');
    const result = await binding.execute(instance);

    expect(result).toMatchObject({
      kind: 'binding-error',
      error: { code: 'BINDING_NOT_CURRENT' },
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ status: 'settled' });
  });

  it('business click follows describe to plan to business executor', async () => {
    const { fixture, binding, changes } = await readyBinding();
    const result = await binding.execute(businessInstance(binding));

    expect(result.kind).toBe('business');
    expect(fixture.commandRequest).toHaveBeenCalledTimes(1);
    expect(fixture.runtime.activate).toHaveBeenCalledWith({
      nodeId: 'OTHER',
      context: { employee_id: 'E-1', mode: 'edit' },
    });
    expect(changes.map((change) => change.status)).toEqual(['pending', 'settled']);
  });

  it('presentation click follows describe to plan to presentation executor', async () => {
    const { fixture, binding, changes } = await readyBinding();
    const result = await binding.execute(listInstance(binding, 'row-1'));

    expect(result.kind).toBe('presentation');
    expect(fixture.runtime.activate).toHaveBeenCalledWith({
      nodeId: 'DESTINATION',
      context: { employee_id: 'E-2', mode: 'view' },
    });
    expect(changes.map((change) => change.status)).toEqual(['pending', 'settled']);
  });

  it('DOM MouseEvent is not passed into domain event and generated handler captures exact instance', async () => {
    const { fixture, binding, changes } = await readyBinding();
    const view = binding.createView(
      { scrollItems: [listInstance(binding, 'row-1')] },
      { interactionPending: false },
    );
    const object = view.scrollObjects[0];
    const settled = new Promise<void>((resolve) => {
      const originalLength = changes.length;
      const poll = () => {
        if (changes.length > originalLength && changes.at(-1)?.status === 'settled') {
          resolve();
          return;
        }
        queueMicrotask(poll);
      };
      poll();
    });

    if (object.kind !== 'listButton') {
      throw new Error('expected list button');
    }
    object.onClick?.({
      employee_id: 'DOM-EVENT',
    } as unknown as Parameters<NonNullable<typeof object.onClick>>[0]);
    await settled;

    expect(fixture.runtime.activate).toHaveBeenCalledWith({
      nodeId: 'DESTINATION',
      context: { employee_id: 'E-2', mode: 'view' },
    });
  });

  it('exact accepted click publishes pending then settled in this order', async () => {
    const { binding, changes } = await readyBinding();

    await binding.execute(businessInstance(binding));

    expect(changes.map((change) => change.status)).toEqual(['pending', 'settled']);
  });

  it('pre-acceptance rejection publishes settled only', async () => {
    const { binding, changes } = await readyBinding();
    const forged = Object.freeze({
      kind: 'business-action' as const,
      actionId: 'moveDone',
      definition: businessInstance(binding).definition,
      input: Object.freeze({}),
      event: Object.freeze({}),
    }) as unknown as ReturnType<typeof businessInstance>;

    await binding.execute(forged);

    expect(changes.map((change) => change.status)).toEqual(['settled']);
  });

  it('lifecycle payload contains no authority or private state keys', async () => {
    const { binding, changes } = await readyBinding();

    await binding.execute(businessInstance(binding));

    for (const change of changes) {
      expect(Object.keys(change)).not.toContain('instance');
      expect(Object.keys(change)).not.toContain('descriptor');
      expect(Object.keys(change)).not.toContain('plan');
      expect(Object.keys(change)).not.toContain('request');
      expect(Object.keys(change)).not.toContain('runtime');
      expect(Object.keys(change)).not.toContain('history');
    }
  });

  it('interactionPending sets ariaBusy true and disables every action object', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(projection(binding), {
      interactionPending: true,
    });

    expect(view.ariaBusy).toBe(true);
    expect(
      view.scrollObjects
        .filter((object) => object.kind === 'actionButton' || object.kind === 'listButton')
        .every((object) => object.disabled === true),
    ).toBe(true);
    expect(
      view.fixedBottomObjects?.every((object) =>
        object.kind === 'actionButton' ? object.disabled === true : true,
      ),
    ).toBe(true);
  });

  it('interactionPending false leaves actions enabled', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(projection(binding), {
      interactionPending: false,
    });

    expect(view.ariaBusy).toBe(false);
    expect(
      view.scrollObjects
        .filter((object) => object.kind === 'actionButton' || object.kind === 'listButton')
        .every((object) => object.disabled === false),
    ).toBe(true);
  });

  it('execution does not mutate old projection or old view', async () => {
    const { binding } = await readyBinding();
    const sourceProjection = projection(binding);
    const view = binding.createView(sourceProjection, {
      interactionPending: false,
    });
    const beforeProjection = JSON.stringify(sourceProjection);
    const beforeView = JSON.stringify(view);

    await binding.execute(businessInstance(binding));

    expect(JSON.stringify(sourceProjection)).toBe(beforeProjection);
    expect(JSON.stringify(view)).toBe(beforeView);
  });

  it('direct renderer click does not call runtime.activate outside executors', async () => {
    const { fixture, binding } = await readyBinding();
    const view = binding.createView(
      { scrollItems: [{ kind: 'message', id: 'message', text: 'Message' }] },
      { interactionPending: false },
    );

    await render(view);

    expect(fixture.runtime.activate).not.toHaveBeenCalled();
  });

  it('list-button ariaLabel reaches actual HTML button', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      { scrollItems: [listInstance(binding, 'row-1')] },
      { interactionPending: false },
    );
    const container = await render(view);

    expect(
      container.querySelector('button')?.getAttribute('aria-label'),
    ).toBe('Open destination action');
  });

  it('renders decorated list lines as escaped tone spans and preserves undecorated fallback text', async () => {
    const decorated = await render({
      nodeId: 'SOURCE',
      scrollObjects: [{
        kind: 'listButton',
        actionId: 'decorated',
        mainLine: 'Decorated',
        secondaryLine: 'Fallback should not render',
        secondaryLines: [
          { text: 'Green line', tone: 'green' },
          { text: '<img src=x>', tone: 'red' },
        ],
      }],
    });
    expect(decorated.querySelectorAll('.peaks-graph-list-lines .peaks-graph-list-line')).toHaveLength(2);
    expect(decorated.querySelector('.peaks-graph-list-line--green')?.textContent).toBe('Green line');
    expect(decorated.querySelector('.peaks-graph-list-line--red')?.textContent).toBe('<img src=x>');
    expect(decorated.querySelector('.peaks-graph-list-lines img')).toBeNull();
    expect(decorated.textContent).not.toContain('Fallback should not render');

    const fallback = await render({
      nodeId: 'SOURCE',
      scrollObjects: [{
        kind: 'listButton',
        actionId: 'fallback',
        mainLine: 'Fallback',
        secondaryLine: 'Fallback text',
      }],
    });
    expect(fallback.querySelector('.peaks-graph-list-lines')).toBeNull();
    expect(fallback.textContent).toContain('Fallback text');
  });

  it('action-button ariaLabel remains working', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(
      { scrollItems: [businessInstance(binding)] },
      { interactionPending: false },
    );
    const container = await render(view);

    expect(
      container.querySelector('button')?.getAttribute('aria-label'),
    ).toBe('Move done action');
  });

  it('PeaksGraphNodeRenderer source does not import graphRuntime', () => {
    const source = readFileSync(
      `${process.cwd()}/src/foundation/graphRenderer/PeaksGraphNodeRenderer.tsx`,
      'utf8',
    );

    expect(source).not.toContain('graphRuntime');
  });

  it('runtimeIntegration production source imports no forbidden boundaries', () => {
    const source = readFileSync(
      `${process.cwd()}/src/foundation/graphRenderer/runtimeIntegration.ts`,
      'utf8',
    );

    expect(source).not.toMatch(/Section02|Section03|Section04|router|backend|fetch|window|document/);
  });

  it('runtimeIntegration production source contains no synthetic application data words', () => {
    const source = readFileSync(
      `${process.cwd()}/src/foundation/graphRenderer/runtimeIntegration.ts`,
      'utf8',
    );

    expect(source).not.toMatch(/\b(mock|fake|fixture|demo|sample|stub|fallback)\b/i);
  });

  it('projection public API has no custom item path or arbitrary callback field', async () => {
    const { binding } = await readyBinding();
    const view = binding.createView(projection(binding), {
      interactionPending: false,
    });

    expect(view.scrollObjects.some((object) => object.kind === 'custom')).toBe(false);
    expect(JSON.stringify(projection(binding))).not.toContain('callback');
  });

  it('no second createGraphReadyNodeActionFactory call exists in runtimeIntegration source', () => {
    const source = readFileSync(
      `${process.cwd()}/src/foundation/graphRenderer/runtimeIntegration.ts`,
      'utf8',
    );

    expect(source).not.toContain('createGraphReadyNodeActionFactory');
  });

  it('createView rejects forged action instances with ACTION_INSTANCE_NOT_OWNED', async () => {
    const { binding } = await readyBinding();
    const forged = Object.freeze({
      ...businessInstance(binding),
    }) as unknown as ReturnType<typeof businessInstance>;

    expect(() =>
      binding.createView(
        { scrollItems: [forged] },
        { interactionPending: false },
      ),
    ).toThrowError(expect.objectContaining({ code: 'ACTION_INSTANCE_NOT_OWNED' }));
  });

  it('action identity uses semantic actionId when instanceId is absent', async () => {
    const { binding } = await readyBinding();
    const action = binding.actionFactory.presentation(
      'openDestination',
      { mainLine: 'Destination' },
      { employee_id: 'E-2' },
    );
    const view = binding.createView(
      { scrollItems: [action] },
      { interactionPending: false },
    );

    expect(view.scrollObjects[0].id).toBe('openDestination');
  });

  it('repeated actions without instanceId are duplicate render identity', async () => {
    const { binding } = await readyBinding();
    const first = binding.actionFactory.presentation(
      'openDestination',
      { mainLine: 'First' },
      { employee_id: 'E-2' },
    );
    const second = binding.actionFactory.presentation(
      'openDestination',
      { mainLine: 'Second' },
      { employee_id: 'E-3' },
    );

    expect(() =>
      binding.createView(
        { scrollItems: [first, second] },
        { interactionPending: false },
      ),
    ).toThrowError(expect.objectContaining({ code: 'DUPLICATE_RENDER_ID' }));
  });

  it('settled lifecycle contains the closed execution result wrapper', async () => {
    const { binding, changes } = await readyBinding();
    const result = await binding.execute(businessInstance(binding));
    const settled = changes.at(-1);

    expect(settled).toMatchObject({ status: 'settled' });
    expect(settled?.status === 'settled' && settled.result).toBe(result);
  });

  it('binding public surface contains only the ready integration fields', async () => {
    const { binding } = await readyBinding();

    expect(Object.keys(binding).sort()).toEqual([
      'actionFactory',
      'businessExecution',
      'createView',
      'execute',
      'planner',
      'presentationExecution',
      'ready',
      'runtime',
    ]);
  });
});
