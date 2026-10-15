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
import { createGraphActivationRuntime } from './activation';
import {
  createGraphReadyInteractionPlanner,
  type GraphBackInteractionPlan,
  type GraphNavigateInteractionPlan,
  type GraphPresentationInteractionPlan,
} from './planning';
import {
  createGraphPresentationExecutionRuntime,
  type GraphPresentationExecutionPendingState,
} from './presentationExecution';

// @ts-expect-error navigation history entry type is private and not exported
import type { GraphPresentationExecutionHistoryEntry } from './presentationExecution';

type EmployeeContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;

type EmployeeReadModel = Readonly<{
  employee_id: string | number;
  available_actions: readonly ['FINISH_EMPLOYEE_BLOCKER'];
}>;

const employeeContext = defineGraphContext({
  employee_id: graphContext.id(),
  mode: graphContext.mode('view', 'edit'),
});
const sources = graphSourcesFor<EmployeeContext>();
const employeeSource = sources.required<
  EmployeeReadModel,
  'employee',
  '/employee'
>({
  sourceId: 'employee',
  endpoint: '/employee',
  request: async () => ({
    employee_id: 1,
    available_actions: ['FINISH_EMPLOYEE_BLOCKER'],
  }),
  decode: (input: unknown) => input as EmployeeReadModel,
});
const graph = defineGraph({
  EMPLOYEE: graphNodesFor(employeeContext).endpointBacked({
    source: sources.endpointBacked(
      sources.bundle({ employee: employeeSource }),
    ),
    project: ({ context }) => ({ employeeId: context.employee_id }),
  }),
  LOCAL: graphNodesFor(employeeContext).local({
    source: sources.local(),
    project: ({ context }) => ({ employeeId: context.employee_id }),
  }),
});
const actions = defineGraphActions({
  business: {
    finish: graphAction.business(
      'FINISH_EMPLOYEE_BLOCKER',
      defineGraphActionEvent({}),
      graphAction.actionButton({
        label: 'Finish',
        icon: 'finish.svg',
        variant: 'green',
      }),
    ),
  },
  presentation: {
    back: graphAction.presentation(
      defineGraphActionEvent({}),
      graphAction.actionButton({
        label: 'Back',
        icon: 'back.svg',
        variant: 'outlineBlue',
      }),
    ),
    open: graphAction.presentation(
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
  command: 'FINISH_EMPLOYEE_BLOCKER',
  method: 'POST',
  endpoint: '/finish',
  outcomes: ['DONE'],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
  }),
  request: async () => ({
    command: 'FINISH_EMPLOYEE_BLOCKER',
    outcome: 'DONE',
    entities: { employee_id: 'E-1' },
  }),
});
const transition = defineGraphTransitions({
  graph,
  command,
  currentContext: employeeContext,
  transitions: {
    DONE: {
      node: 'LOCAL',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});
const employeeScope = graphInteractionsFor(graph, actions).node('EMPLOYEE');
const localScope = graphInteractionsFor(graph, actions).node('LOCAL');
const employeeInteractions = employeeScope.define({
  business: [
    employeeScope.business({
      action: 'finish',
      availability: graphInteraction.availableActions(
        'employee',
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
    employeeScope.presentation({
      action: 'back',
      effect: graphInteraction.back(),
    }),
  ],
});
const localInteractions = localScope.define({
  business: [],
  presentation: [
    localScope.presentation({
      action: 'open',
      effect: graphInteraction.navigate('EMPLOYEE', {
        employee_id: graphInteraction.event('employee_id'),
        mode: graphInteraction.literal('view'),
      }),
    }),
  ],
});
const program = defineGraphProgram({
  graph,
  actions,
  interactions: {
    EMPLOYEE: employeeInteractions,
    LOCAL: localInteractions,
  },
});
const runtime = createGraphActivationRuntime(program);
const executor = createGraphPresentationExecutionRuntime(runtime);

const otherContext = defineGraphContext({
  other_id: graphContext.id(),
});
const otherSources = graphSourcesFor<Readonly<{ other_id: string }>>();
const otherGraph = defineGraph({
  OTHER: graphNodesFor(otherContext).local({
    source: otherSources.local(),
    project: ({ context }) => ({ otherId: context.other_id }),
  }),
});
const otherActions = defineGraphActions({
  business: {},
  presentation: {
    otherBack: graphAction.presentation(
      defineGraphActionEvent({}),
      graphAction.actionButton({
        label: 'Other back',
        icon: 'back.svg',
        variant: 'outlineBlue',
      }),
    ),
  },
});
const otherScope = graphInteractionsFor(otherGraph, otherActions).node('OTHER');
const otherProgram = defineGraphProgram({
  graph: otherGraph,
  actions: otherActions,
  interactions: {
    OTHER: otherScope.define({
      business: [],
      presentation: [
        otherScope.presentation({
          action: 'otherBack',
          effect: graphInteraction.back(),
        }),
      ],
    }),
  },
});
const otherRuntime = createGraphActivationRuntime(otherProgram);
const otherExecutor = createGraphPresentationExecutionRuntime(otherRuntime);

async function typecheckPresentationExecution(): Promise<void> {
  await runtime.activate({
    nodeId: 'EMPLOYEE',
    context: { employee_id: 'E-1', mode: 'view' },
  });
  const employeePlanner = createGraphReadyInteractionPlanner(
    runtime,
    'EMPLOYEE',
  );
  const backInstance = employeePlanner.actions.presentation(
    'back',
    {},
    {},
  );
  const backPlan = employeePlanner.plan(
    backInstance,
    employeePlanner.actions.describe(backInstance),
  );
  if (backPlan.effect !== 'back') {
    throw new Error('expected back');
  }
  const exactBack: GraphBackInteractionPlan<'EMPLOYEE', 'back'> = backPlan;
  const backResult = await executor.execute(employeePlanner, backPlan);
  if (backResult.status === 'ready') {
    const nodeId: 'EMPLOYEE' | 'LOCAL' = backResult.activation.nodeId;
    void nodeId;
  }

  const businessProjection = employeePlanner.actions.business(
    'finish',
    {},
    {},
  );
  if (businessProjection.length === 1) {
    const businessPlan = employeePlanner.plan(
      businessProjection[0],
      employeePlanner.actions.describe(businessProjection[0]),
    );
    // @ts-expect-error business plan is not accepted by presentation execution
    await executor.execute(employeePlanner, businessPlan);
  }

  await runtime.activate({
    nodeId: 'LOCAL',
    context: { employee_id: 'E-1', mode: 'view' },
  });
  const localPlanner = createGraphReadyInteractionPlanner(runtime, 'LOCAL');
  const openInstance = localPlanner.actions.presentation(
    'open',
    { mainLine: 'Employee' },
    { employee_id: 'E-2' },
  );
  const navigatePlan = localPlanner.plan(
    openInstance,
    localPlanner.actions.describe(openInstance),
  );
  if (navigatePlan.effect !== 'navigate') {
    throw new Error('expected navigate');
  }
  const exactNavigate: GraphNavigateInteractionPlan<'LOCAL', 'open'> =
    navigatePlan;
  await executor.execute(localPlanner, navigatePlan);

  const current = executor.getState();
  if (current.status === 'pending') {
    const pending: GraphPresentationExecutionPendingState<
      GraphPresentationInteractionPlan
    > = current;
    const presentationPlan: GraphPresentationInteractionPlan = pending.plan;
    void presentationPlan;
  }

  // @ts-expect-error plan from another node does not belong to this planner
  await executor.execute(employeePlanner, navigatePlan);

  await otherRuntime.activate({
    nodeId: 'OTHER',
    context: { other_id: 'O-1' },
  });
  const otherPlanner = createGraphReadyInteractionPlanner(otherRuntime, 'OTHER');
  const otherBack = otherPlanner.actions.presentation('otherBack', {}, {});
  const otherPlan = otherPlanner.plan(
    otherBack,
    otherPlanner.actions.describe(otherBack),
  );
  await otherExecutor.execute(otherPlanner, otherPlan);
  // @ts-expect-error planner from another program/runtime is rejected by type
  await executor.execute(otherPlanner, otherPlan);

  // @ts-expect-error presentation runtime exposes no history
  executor.history;
  // @ts-expect-error presentation runtime exposes no push
  executor.push;
  // @ts-expect-error presentation runtime exposes no pop
  executor.pop;
  // @ts-expect-error presentation runtime exposes no renderer
  executor.renderer;
  // @ts-expect-error presentation runtime exposes no router
  executor.router;
  // @ts-expect-error presentation runtime exposes no navigate callback
  executor.navigateCallback;

  type ImportedHistoryEntry = GraphPresentationExecutionHistoryEntry;
  type HistoryEntryIsNotExported = ImportedHistoryEntry;

  void exactBack;
  void exactNavigate;
  void (undefined as unknown as HistoryEntryIsNotExported);
}

void typecheckPresentationExecution;
