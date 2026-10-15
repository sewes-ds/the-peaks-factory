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
} from './activation';
import {
  createGraphReadyNodeActionFactory,
  type GraphRuntimeActionDescriptor,
} from './actions';

type EmployeeReadModel = Readonly<{
  employee_id: string;
  available_actions: readonly (
    | 'FINISH_EMPLOYEE_BLOCKER'
    | 'CLOSE_SHIFT'
  )[];
}>;

const employeeContext = defineGraphContext({
  employee_id: graphContext.id(),
  mode: graphContext.mode('view', 'edit'),
});

type EmployeeContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;

const employeeSources = graphSourcesFor<EmployeeContext>();
const employeeSource = employeeSources.required<
  EmployeeReadModel,
  'employee',
  '/manager/employees/:id'
>({
  sourceId: 'employee',
  endpoint: '/manager/employees/:id',
  request: async (_context) => ({
    employee_id: 'E-1',
    available_actions: ['FINISH_EMPLOYEE_BLOCKER'],
  }),
  decode: (input: unknown) => input as EmployeeReadModel,
});

const graph = defineGraph({
  EMPLOYEE: graphNodesFor(employeeContext).endpointBacked({
    source: employeeSources.endpointBacked(
      employeeSources.bundle({
        employee: employeeSource,
      }),
    ),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
  LOCAL: graphNodesFor(employeeContext).local({
    source: employeeSources.local(),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
  NONE: graphNodesFor(employeeContext).local({
    source: employeeSources.local(),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
});

const blockerEvent = defineGraphActionEvent({
  blocker_id: graphActionEvent.id(),
});
const noEvent = defineGraphActionEvent({});

const actions = defineGraphActions({
  business: {
    finish: graphAction.business(
      'FINISH_EMPLOYEE_BLOCKER',
      blockerEvent,
      graphAction.actionButton({
        label: 'Завершить',
        icon: 'finish.svg',
        variant: 'green',
      }),
    ),
  },
  presentation: {
    back: graphAction.presentation(
      noEvent,
      graphAction.actionButton({
        label: 'Назад',
        icon: 'back.svg',
        variant: 'outlineBlue',
      }),
    ),
    open: graphAction.presentation(
      defineGraphActionEvent({
        employee_id: graphActionEvent.id(),
      }),
      graphAction.listButton({
        variant: 'blue',
      }),
    ),
  },
});

const commandInput = defineGraphCommandInput({
  employee_id: graphCommandInput.id(),
  blocker_id: graphCommandInput.id(),
});

const command = graphCommandFor(commandInput).define({
  command: 'FINISH_EMPLOYEE_BLOCKER',
  method: 'POST',
  endpoint: '/operations/employee-blockers/finish',
  outcomes: ['DONE'],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
  }),
  request: async (_input) => ({}) as unknown,
});

const transitions = defineGraphTransitions({
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

const employeeScope =
  graphInteractionsFor(graph, actions).node('EMPLOYEE');

const finish = employeeScope.business({
  action: 'finish',
  availability: graphInteraction.availableActions(
    'employee',
    'available_actions',
  ),
  command,
  input: {
    employee_id: graphInteraction.context('employee_id'),
    blocker_id: graphInteraction.event('blocker_id'),
  },
  transition: transitions,
});

const back = employeeScope.presentation({
  action: 'back',
  effect: graphInteraction.back(),
});

const employeeInteractions = employeeScope.define({
  business: [finish],
  presentation: [back],
});

const localScope =
  graphInteractionsFor(graph, actions).node('LOCAL');

const open = localScope.presentation({
  action: 'open',
  effect: graphInteraction.navigate('EMPLOYEE', {
    employee_id: graphInteraction.event('employee_id'),
    mode: graphInteraction.literal('view'),
  }),
});

const localInteractions = localScope.define({
  business: [],
  presentation: [open],
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

async function typecheckFactory(): Promise<void> {
  const activated = await runtime.activate({
    nodeId: 'EMPLOYEE',
    context: {
      employee_id: 'E-1',
      mode: 'view',
    },
  });

  if (activated.status !== 'ready') {
    throw new Error('expected ready');
  }

  const factory = createGraphReadyNodeActionFactory(
    runtime,
    'EMPLOYEE',
  );

  const business = factory.business(
    'finish',
    {},
    { blocker_id: 'B-1' },
  );

  const presentation = factory.presentation(
    'back',
    {},
    {},
  );

  const descriptor: GraphRuntimeActionDescriptor<'EMPLOYEE'> =
    factory.describe(presentation);

  if (business.length === 1) {
    factory.describe(business[0]);
  }

  // @ts-expect-error factory exposes only node-declared business action IDs
  factory.business('closeShift', {}, {});

  // @ts-expect-error factory exposes only node-declared presentation action IDs
  factory.presentation('open', {}, { employee_id: 'E-1' });

  factory.business('finish', {}, {
    // @ts-expect-error business event snapshots are not scalar schema data
    blocker_id: {
      id: 'B-1',
    },
  });

  // @ts-expect-error a node omitted from the program interaction map has no factory
  createGraphReadyNodeActionFactory(runtime, 'NONE');

  void descriptor;
}

void typecheckFactory;
