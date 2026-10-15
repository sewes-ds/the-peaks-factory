// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
} from '../../graphProtocol/action';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from '../../graphProtocol/command';
import { defineGraphContext, graphContext } from '../../graphProtocol/context';
import { defineGraph, graphNodesFor } from '../../graphProtocol/definition';
import {
  graphInteraction,
  graphInteractionsFor,
} from '../../graphProtocol/interaction';
import { defineGraphProgram } from '../../graphProtocol/program';
import { graphSourcesFor } from '../../graphProtocol/source';
import {
  defineGraphTransitions,
  graphTransition,
} from '../../graphProtocol/transition';
import {
  createGraphActivationRuntime,
  createGraphPresentationExecutionRuntime,
  type GraphActivationRuntime,
} from '../../graphRuntime';
import {
  createPeaksGraphReadyNodeBinding,
} from '../../graphRenderer/runtimeIntegration';
import { PresentationGraphBridgeItems } from './GraphBridgeItems';
import {
  PresentationGraphBridgeError,
  type ResolvedPresentationGraphBridgeItem,
} from './model';
import { definePresentationGraphExecutionPort } from './port';
import { createPresentationGraphBridge } from './resolver';

type NodeId = 'SOURCE' | 'DESTINATION';
type TestContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;
type TestReadModel = Readonly<{
  node: NodeId;
  available_actions: readonly string[];
}>;

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  for (const container of containers.splice(0)) {
    container.remove();
  }
});

function makeProgramFixture() {
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
      request: async () => ({
        node,
        available_actions: ['MOVE_DONE'],
      }),
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
  });
  const noEvent = defineGraphActionEvent({});
  const actions = defineGraphActions({
    business: {
      moveDone: graphAction.business(
        'MOVE_DONE',
        noEvent,
        graphAction.actionButton({
          label: 'Legacy move label',
          icon: 'legacy-move.svg',
          variant: 'green',
          size: 'fixed55',
          showIcon: false,
        }),
      ),
    },
    presentation: {
      back: graphAction.presentation(
        noEvent,
        graphAction.actionButton({
          label: 'Legacy back',
          icon: 'legacy-back.svg',
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
        node: 'DESTINATION',
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
    ],
    presentation: [
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
  const program = defineGraphProgram({
    graph,
    actions,
    interactions: {
      SOURCE: sourceInteractions,
      DESTINATION: destinationInteractions,
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
  return { baseRuntime, commandRequest, program, runtime };
}

async function readyFixture() {
  const fixture = makeProgramFixture();
  await fixture.baseRuntime.activate({
    nodeId: 'SOURCE',
    context: { employee_id: 'E-1', mode: 'edit' },
  });
  const changes: Array<Readonly<{ status: string }>> = [];
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
  return { binding, changes, fixture };
}

function businessAction(
  binding: Awaited<ReturnType<typeof readyFixture>>['binding'],
) {
  const projection = binding.actionFactory.business(
    'moveDone',
    { ariaLabel: 'Move' },
    {},
  );
  if (projection.length !== 1) {
    throw new Error('Expected one business action.');
  }
  return projection[0];
}

function navigationAction(
  binding: Awaited<ReturnType<typeof readyFixture>>['binding'],
) {
  return binding.actionFactory.presentation(
    'openDestination',
    {
      instanceId: 'destination',
      mainLine: 'Legacy destination',
      secondaryLine: 'Legacy secondary',
      ariaLabel: 'Open legacy destination',
    },
    { employee_id: 'E-2' },
  );
}

function bridgeFor(
  binding: Awaited<ReturnType<typeof readyFixture>>['binding'],
) {
  let result: unknown;
  const execute = vi.fn(async (action: object) => {
    result = await binding.execute(
      action as Parameters<typeof binding.execute>[0],
    );
    return result;
  });
  const port = definePresentationGraphExecutionPort({
    activationId: binding.ready.activationId,
    nodeId: binding.ready.nodeId,
    describe: (action: object) => binding.actionFactory.describe(
      action as Parameters<typeof binding.actionFactory.describe>[0],
    ),
    execute,
  });
  return {
    bridge: createPresentationGraphBridge(port),
    execute,
    result: () => result,
  };
}

function render(items: readonly ResolvedPresentationGraphBridgeItem[]) {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(<PresentationGraphBridgeItems items={items} />));
  return container;
}

describe('Graph Bridge compatibility with the existing ready-node binding', () => {
  it('accepts and delegates an exact business action to runtime ownership', async () => {
    const { binding, changes, fixture } = await readyFixture();
    const action = businessAction(binding);
    const navigation = navigationAction(binding);
    const adapter = bridgeFor(binding);
    const view = adapter.bridge.resolve({
      nodeId: binding.ready.nodeId,
      items: [
        {
          kind: 'control-action-button',
          id: 'business',
          interaction: {
            kind: 'action',
            action,
            baseAvailability: 'enabled',
          },
          controlKey: 'action-neutral',
          label: { kind: 'text', text: 'Bridge business' },
        },
        {
          kind: 'control-list-button',
          id: 'navigation',
          interaction: {
            kind: 'action',
            action: navigation,
            baseAvailability: 'enabled',
          },
          controlKey: 'navigation-open',
          mainLine: { kind: 'text', text: 'Bridge destination' },
        },
      ],
    }, { interactionPending: false });
    const container = render(view.items);

    expect(adapter.execute).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Bridge business');
    expect(container.textContent).toContain('Bridge destination');
    expect(container.innerHTML).not.toContain('Legacy move label');
    expect(container.innerHTML).not.toContain('legacy-move.svg');
    expect(container.innerHTML).not.toContain('Legacy destination');

    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    await vi.waitFor(() => {
      expect(changes.map((change) => change.status))
        .toEqual(['pending', 'settled']);
    });
    expect(adapter.execute).toHaveBeenCalledWith(action);
    expect(adapter.result()).toMatchObject({ kind: 'business' });
    expect(Object.isFrozen(adapter.result())).toBe(true);
    expect(fixture.commandRequest).toHaveBeenCalledTimes(1);
    expect(fixture.runtime.activate).toHaveBeenCalledWith({
      nodeId: 'DESTINATION',
      context: { employee_id: 'E-1', mode: 'edit' },
    });
  });

  it('delegates exact presentation navigation and rejects foreign ownership', async () => {
    const owner = await readyFixture();
    const foreign = await readyFixture();
    const action = navigationAction(owner.binding);
    const adapter = bridgeFor(owner.binding);
    const view = adapter.bridge.resolve({
      nodeId: owner.binding.ready.nodeId,
      items: [{
        kind: 'control-list-button',
        id: 'navigation',
        interaction: {
          kind: 'action',
          action,
          baseAvailability: 'enabled',
        },
        controlKey: 'navigation-open',
        mainLine: { kind: 'text', text: 'Bridge navigation' },
      }],
    }, { interactionPending: false });
    const container = render(view.items);

    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    await vi.waitFor(() => {
      expect(owner.changes.map((change) => change.status))
        .toEqual(['pending', 'settled']);
    });
    expect(adapter.execute).toHaveBeenCalledWith(action);
    expect(adapter.result()).toMatchObject({ kind: 'presentation' });
    expect(Object.isFrozen(adapter.result())).toBe(true);
    expect(owner.fixture.runtime.activate).toHaveBeenCalledWith({
      nodeId: 'DESTINATION',
      context: { employee_id: 'E-2', mode: 'view' },
    });

    const foreignAction = businessAction(foreign.binding);
    try {
      adapter.bridge.resolve({
        nodeId: owner.binding.ready.nodeId,
        items: [{
          kind: 'control-action-button',
          id: 'foreign',
          interaction: {
            kind: 'action',
            action: foreignAction,
            baseAvailability: 'enabled',
          },
          controlKey: 'action-neutral',
          label: { kind: 'text', text: 'Foreign' },
        }],
      }, { interactionPending: false });
      throw new Error('Expected foreign action rejection.');
    } catch (error) {
      expect(error).toBeInstanceOf(PresentationGraphBridgeError);
      expect((error as PresentationGraphBridgeError).code).toBe(
        'ACTION_NOT_OWNED',
      );
      expect((error as PresentationGraphBridgeError).originalError)
        .toBeInstanceOf(Error);
    }
  });
});
