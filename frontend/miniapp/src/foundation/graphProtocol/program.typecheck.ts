import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
} from './action';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
} from './command';
import {
  defineGraphContext,
  graphContext,
} from './context';
import {
  defineGraph,
  graphNodesFor,
} from './definition';
import {
  graphInteraction,
  graphInteractionsFor,
} from './interaction';
import {
  defineGraphProgram,
  type GraphProgramProjectorActionFactory,
} from './program';
import { graphSourcesFor } from './source';
import {
  defineGraphTransitions,
  graphTransition,
} from './transition';

type EmployeeReadModel = Readonly<{
  employee_id: string;
  available_actions: readonly ['FINISH_EMPLOYEE_BLOCKER'];
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
  request: async (_context) => ({}) as unknown,
  decode: (input: unknown) => input as EmployeeReadModel,
});

const graph = defineGraph({
  'S03-E12': graphNodesFor(employeeContext).endpointBacked({
    source: employeeSources.endpointBacked(
      employeeSources.bundle({
        employee: employeeSource,
      }),
    ),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
  'S03-E10': graphNodesFor(employeeContext).local({
    source: graphSourcesFor<EmployeeContext>().local(),
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
    finishEmployeeBlocker: graphAction.business(
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
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

const scope = graphInteractionsFor(graph, actions).node('S03-E12');

const finish = scope.business({
  action: 'finishEmployeeBlocker',
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

const back = scope.presentation({
  action: 'back',
  effect: graphInteraction.back(),
});

const employeeInteractions = scope.define({
  business: [finish],
  presentation: [back],
});

const program = defineGraphProgram({
  graph,
  actions,
  interactions: {
    'S03-E12': employeeInteractions,
  },
});

declare const factory: GraphProgramProjectorActionFactory<
  typeof program,
  'S03-E12'
>;

factory.business(
  'finishEmployeeBlocker',
  {},
  { blocker_id: 'B-1' },
);
factory.presentation('back', {}, {});

// @ts-expect-error the node-scoped factory cannot expose undeclared semantic actions
factory.presentation('next', {}, {});

type MissingFactory =
  // @ts-expect-error a node without declared interactions has no projector action-factory type
  GraphProgramProjectorActionFactory<typeof program, 'S03-E10'>;

// @ts-expect-error program interactions can use only canonical graph node IDs
defineGraphProgram({
  graph,
  actions,
  interactions: {
    'S03-E12': employeeInteractions,
    'S03-X99': employeeInteractions,
  },
});

// @ts-expect-error interaction declaration node must match its program map key
defineGraphProgram({
  graph,
  actions,
  interactions: {
    'S03-E10': employeeInteractions,
  },
});

const unusedActions = defineGraphActions({
  business: {
    finishEmployeeBlocker: graphAction.business(
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
    next: graphAction.presentation(
      noEvent,
      graphAction.actionButton({
        label: 'Далее',
        icon: 'next.svg',
        variant: 'primaryBlue',
      }),
    ),
  },
});

const unusedScope = graphInteractionsFor(graph, unusedActions).node(
  'S03-E12',
);
const unusedFinish = unusedScope.business({
  action: 'finishEmployeeBlocker',
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
const unusedBack = unusedScope.presentation({
  action: 'back',
  effect: graphInteraction.back(),
});
const incompleteInteractions = unusedScope.define({
  business: [unusedFinish],
  presentation: [unusedBack],
});

// @ts-expect-error every registry semantic action must be reachable from a program interaction
defineGraphProgram({
  graph,
  actions: unusedActions,
  interactions: {
    'S03-E12': incompleteInteractions,
  },
});

void program;
