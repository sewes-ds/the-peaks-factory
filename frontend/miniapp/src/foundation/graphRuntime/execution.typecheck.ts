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
  type GraphCommandInput,
  type InferGraphCommandResult,
} from '../graphProtocol/command';
import { defineGraphContext, graphContext } from '../graphProtocol/context';
import { defineGraph, graphNodesFor, type GraphNodeId } from '../graphProtocol/definition';
import { graphInteraction, graphInteractionsFor } from '../graphProtocol/interaction';
import { defineGraphProgram } from '../graphProtocol/program';
import { graphSourcesFor } from '../graphProtocol/source';
import { defineGraphTransitions, graphTransition } from '../graphProtocol/transition';
import { createGraphActivationRuntime } from './activation';
import { createGraphReadyBusinessExecutionRuntime } from './execution';
import {
  createGraphReadyInteractionPlanner,
  type GraphBusinessInteractionPlanFor,
} from './planning';

type EmployeeContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;

type EmployeeReadModel = Readonly<{
  employee_id: string | number;
  available_actions: readonly ['FINISH_EMPLOYEE', 'ARCHIVE_EMPLOYEE'];
}>;

const employeeContext = defineGraphContext({
  employee_id: graphContext.id(),
  mode: graphContext.mode('view', 'edit'),
});
const sources = graphSourcesFor<EmployeeContext>();
const employeeSource = sources.required<EmployeeReadModel, 'employee', '/employees/:id'>({
  sourceId: 'employee',
  endpoint: '/employees/:id',
  request: async () => ({ employee_id: 1, available_actions: ['FINISH_EMPLOYEE', 'ARCHIVE_EMPLOYEE'] }),
  decode: (input: unknown) => input as EmployeeReadModel,
});
const graph = defineGraph({
  EMPLOYEE: graphNodesFor(employeeContext).endpointBacked({
    source: sources.endpointBacked(sources.bundle({ employee: employeeSource })),
    project: ({ context }) => ({ employeeId: context.employee_id }),
  }),
  RESULT: graphNodesFor(employeeContext).local({
    source: sources.local(),
    project: ({ context }) => ({ employeeId: context.employee_id }),
  }),
});

const actions = defineGraphActions({
  business: {
    finish: graphAction.business(
      'FINISH_EMPLOYEE',
      defineGraphActionEvent({ blocker_id: graphActionEvent.id() }),
      graphAction.actionButton({ label: 'Finish', icon: 'finish.svg', variant: 'green' }),
    ),
    archive: graphAction.business(
      'ARCHIVE_EMPLOYEE',
      defineGraphActionEvent({ archive_reason: graphActionEvent.textInput() }),
      graphAction.actionButton({ label: 'Archive', icon: 'archive.svg', variant: 'red' }),
    ),
  },
  presentation: {
    back: graphAction.presentation(
      defineGraphActionEvent({}),
      graphAction.actionButton({ label: 'Back', icon: 'back.svg', variant: 'outlineBlue' }),
    ),
  },
});

const finishInput = defineGraphCommandInput({
  employee_id: graphCommandInput.id(),
  blocker_id: graphCommandInput.id(),
});
const finishCommand = graphCommandFor(finishInput).define({
  command: 'FINISH_EMPLOYEE',
  method: 'POST',
  endpoint: '/operations/finish',
  outcomes: ['FINISHED'],
  entities: defineGraphCommandEntities({ employee_id: graphCommandEntity.id() }),
  request: async () => ({} as unknown),
});
const finishTransition = defineGraphTransitions({
  graph,
  command: finishCommand,
  currentContext: employeeContext,
  transitions: {
    FINISHED: {
      node: 'RESULT',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

const archiveInput = defineGraphCommandInput({
  employee_id: graphCommandInput.id(),
  archive_reason: graphCommandInput.textInput(),
});
const archiveCommand = graphCommandFor(archiveInput).define({
  command: 'ARCHIVE_EMPLOYEE',
  method: 'POST',
  endpoint: '/operations/archive',
  outcomes: ['ARCHIVED', 'ALREADY_ARCHIVED'],
  entities: defineGraphCommandEntities({ archived_employee_id: graphCommandEntity.id() }),
  request: async () => ({} as unknown),
});
const archiveTransition = defineGraphTransitions({
  graph,
  command: archiveCommand,
  currentContext: employeeContext,
  transitions: {
    ARCHIVED: {
      node: 'RESULT',
      context: {
        employee_id: graphTransition.entityId('archived_employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
    ALREADY_ARCHIVED: {
      node: 'RESULT',
      context: {
        employee_id: graphTransition.entityId('archived_employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

const employeeScope = graphInteractionsFor(graph, actions).node('EMPLOYEE');
const employeeInteractions = employeeScope.define({
  business: [
    employeeScope.business({
      action: 'finish',
      availability: graphInteraction.availableActions('employee', 'available_actions'),
      command: finishCommand,
      input: {
        employee_id: graphInteraction.context('employee_id'),
        blocker_id: graphInteraction.event('blocker_id'),
      },
      transition: finishTransition,
    }),
    employeeScope.business({
      action: 'archive',
      availability: graphInteraction.availableActions('employee', 'available_actions'),
      command: archiveCommand,
      input: {
        employee_id: graphInteraction.context('employee_id'),
        archive_reason: graphInteraction.event('archive_reason'),
      },
      transition: archiveTransition,
    }),
  ],
  presentation: [
    employeeScope.presentation({ action: 'back', effect: graphInteraction.back() }),
  ],
});
const resultScope = graphInteractionsFor(graph, actions).node('RESULT');
const resultInteractions = resultScope.define({ business: [], presentation: [] });
const program = defineGraphProgram({
  graph,
  actions,
  interactions: { EMPLOYEE: employeeInteractions, RESULT: resultInteractions },
});
const runtime = createGraphActivationRuntime(program);

type ForeignContext = Readonly<{ task_id: string }>;
type ForeignReadModel = Readonly<{
  task_id: string;
  available_actions: readonly ['CLOSE_TASK'];
}>;
const foreignContext = defineGraphContext({ task_id: graphContext.id() });
const foreignSources = graphSourcesFor<ForeignContext>();
const foreignSource = foreignSources.required<
  ForeignReadModel,
  'task',
  '/tasks/:id'
>({
  sourceId: 'task',
  endpoint: '/tasks/:id',
  request: async (context) => ({
    task_id: context.task_id,
    available_actions: ['CLOSE_TASK'],
  }),
  decode: (input: unknown) => input as ForeignReadModel,
});
const foreignGraph = defineGraph({
  TASK: graphNodesFor(foreignContext).endpointBacked({
    source: foreignSources.endpointBacked(
      foreignSources.bundle({ task: foreignSource }),
    ),
    project: ({ context }) => ({ taskId: context.task_id }),
  }),
  TASK_RESULT: graphNodesFor(foreignContext).local({
    source: foreignSources.local(),
    project: ({ context }) => ({ taskId: context.task_id }),
  }),
});
const foreignActions = defineGraphActions({
  business: {
    close: graphAction.business(
      'CLOSE_TASK',
      defineGraphActionEvent({}),
      graphAction.actionButton({ label: 'Close', icon: 'close.svg', variant: 'green' }),
    ),
  },
  presentation: {},
});
const foreignInput = defineGraphCommandInput({ task_id: graphCommandInput.id() });
const foreignCommand = graphCommandFor(foreignInput).define({
  command: 'CLOSE_TASK',
  method: 'POST',
  endpoint: '/tasks/close',
  outcomes: ['CLOSED'],
  entities: defineGraphCommandEntities({ task_id: graphCommandEntity.id() }),
  request: async () => ({} as unknown),
});
const foreignTransition = defineGraphTransitions({
  graph: foreignGraph,
  command: foreignCommand,
  currentContext: foreignContext,
  transitions: {
    CLOSED: {
      node: 'TASK_RESULT',
      context: { task_id: graphTransition.entityId('task_id') },
    },
  },
});
const foreignScope = graphInteractionsFor(foreignGraph, foreignActions).node('TASK');
const foreignProgram = defineGraphProgram({
  graph: foreignGraph,
  actions: foreignActions,
  interactions: {
    TASK: foreignScope.define({
      business: [foreignScope.business({
        action: 'close',
        availability: graphInteraction.availableActions('task', 'available_actions'),
        command: foreignCommand,
        input: { task_id: graphInteraction.context('task_id') },
        transition: foreignTransition,
      })],
      presentation: [],
    }),
    TASK_RESULT: graphInteractionsFor(foreignGraph, foreignActions)
      .node('TASK_RESULT')
      .define({ business: [], presentation: [] }),
  },
});

async function typecheckExecution(): Promise<void> {
  await runtime.activate({ nodeId: 'EMPLOYEE', context: { employee_id: 'E-1', mode: 'edit' } });
  const planner = createGraphReadyInteractionPlanner(runtime, 'EMPLOYEE');
  const executor = createGraphReadyBusinessExecutionRuntime(runtime, planner);

  const finishProjection = planner.actions.business('finish', {}, { blocker_id: 'B-1' });
  if (finishProjection.length === 1) {
    const instance = finishProjection[0];
    const plan = planner.plan(instance, planner.actions.describe(instance));
    const exactPlan: GraphBusinessInteractionPlanFor<typeof program, 'EMPLOYEE', 'finish'> = plan;
    const exactCommand: typeof finishCommand = plan.command;
    const exactInput: GraphCommandInput<typeof finishCommand> = plan.input;
    const decoded: InferGraphCommandResult<typeof finishCommand> = plan.command.decode(await plan.command.request(plan.input));
    const target = plan.transition.transitions[decoded.outcome];
    const exactDestination: GraphNodeId<typeof graph> = target.node;
    const result = await executor.execute(plan);

    // @ts-expect-error finish input is not archive input
    const wrongInput: GraphCommandInput<typeof archiveCommand> = plan.input;
    // @ts-expect-error finish transition is not archive transition
    const wrongTransition: typeof archiveTransition = plan.transition;

    void exactPlan;
    void exactCommand;
    void exactInput;
    void exactDestination;
    void result;
    void wrongInput;
    void wrongTransition;
  }

  const archiveProjection = planner.actions.business('archive', {}, { archive_reason: 'duplicate' });
  if (archiveProjection.length === 1) {
    const instance = archiveProjection[0];
    const plan = planner.plan(instance, planner.actions.describe(instance));
    const exactPlan: GraphBusinessInteractionPlanFor<typeof program, 'EMPLOYEE', 'archive'> = plan;
    const exactCommand: typeof archiveCommand = plan.command;
    const exactInput: GraphCommandInput<typeof archiveCommand> = plan.input;
    const decoded = plan.command.decode(await plan.command.request(plan.input));
    const target = plan.transition.transitions[decoded.outcome];
    const exactDestination: GraphNodeId<typeof graph> = target.node;
    await executor.execute(plan);

    void exactPlan;
    void exactCommand;
    void exactInput;
    void exactDestination;
  }

  const presentation = planner.actions.presentation('back', {}, {});
  const presentationPlan = planner.plan(presentation, planner.actions.describe(presentation));
  // @ts-expect-error presentation plans cannot enter the business executor
  await executor.execute(presentationPlan);

  const foreignRuntime = createGraphActivationRuntime(foreignProgram);
  await foreignRuntime.activate({ nodeId: 'TASK', context: { task_id: 'T-1' } });
  const foreignPlanner = createGraphReadyInteractionPlanner(foreignRuntime, 'TASK');
  const foreignInstances = foreignPlanner.actions.business('close', {}, {});
  if (foreignInstances.length === 1) {
    const foreignInstance = foreignInstances[0];
    const foreignPlan = foreignPlanner.plan(
      foreignInstance,
      foreignPlanner.actions.describe(foreignInstance),
    );

    // @ts-expect-error planner belongs to an incompatible program/runtime
    createGraphReadyBusinessExecutionRuntime(runtime, foreignPlanner);
    // @ts-expect-error foreign program plan cannot enter this executor
    await executor.execute(foreignPlan);
    // @ts-expect-error foreign plan cannot satisfy the employee program contract
    const incompatiblePlan: GraphBusinessInteractionPlanFor<typeof program, 'EMPLOYEE', 'finish'> = foreignPlan;
    void incompatiblePlan;
  }
}

void typecheckExecution;
