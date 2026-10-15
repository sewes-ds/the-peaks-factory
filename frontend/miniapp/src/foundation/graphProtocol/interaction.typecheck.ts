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
  type GraphNodeActionFactoryFor,
} from './interaction';
import { graphSourcesFor } from './source';
import {
  defineGraphTransitions,
  graphTransition,
} from './transition';

type EmployeeReadModel = Readonly<{
  employee_id: string;
  display_name: string;
  available_actions: readonly [
    'FINISH_EMPLOYEE_BLOCKER',
    ...'FINISH_EMPLOYEE_BLOCKER'[],
  ];
  active: Readonly<{
    operation_id: string | null;
  }>;
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
const employeeSource = employeeSources.required<EmployeeReadModel, 'employee', '/manager/employees/:id'>({
  sourceId: 'employee',
  endpoint: '/manager/employees/:id',
  request: async (_context) => ({}) as unknown,
  decode: (input: unknown) => input as EmployeeReadModel,
});
const optionalHintSource = employeeSources.optional<
  Readonly<{ available_actions: readonly ['FINISH_EMPLOYEE_BLOCKER'] }>,
  'hint',
  '/manager/employees/:id/hint'
>({
  sourceId: 'hint',
  endpoint: '/manager/employees/:id/hint',
  request: async (_context) => ({}) as unknown,
  decode: (input: unknown) =>
    input as Readonly<{
      available_actions: readonly ['FINISH_EMPLOYEE_BLOCKER'];
    }>,
});

const bundle = employeeSources.bundle({
  employee: employeeSource,
  hint: optionalHintSource,
});
const employeeNodes = graphNodesFor(employeeContext);

const destinationContext = defineGraphContext({
  employee_id: graphContext.id(),
  mode: graphContext.mode('view', 'edit'),
});
type DestinationContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;
const destinationSources = graphSourcesFor<DestinationContext>();
const destinationNodes = graphNodesFor(destinationContext);

const graph = defineGraph({
  'S03-E12': employeeNodes.endpointBacked({
    source: employeeSources.endpointBacked(bundle),
    project: ({ context, sources }) => ({
      employeeId: context.employee_id,
      availableActions: sources.employee.available_actions,
    }),
  }),
  'S03-E10': destinationNodes.local({
    source: destinationSources.local(),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
});

const blockerEvent = defineGraphActionEvent({
  blocker_id: graphActionEvent.id(),
});

const employeeEvent = defineGraphActionEvent({
  employee_id: graphActionEvent.id(),
  mode: graphActionEvent.mode('view', 'edit'),
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
    closeEmployeeShift: graphAction.business(
      'CLOSE_EMPLOYEE_SHIFT',
      noEvent,
      graphAction.actionButton({
        label: 'Закрыть смену',
        icon: 'close.svg',
        variant: 'yellow',
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
    openEmployee: graphAction.presentation(
      employeeEvent,
      graphAction.listButton({
        variant: 'blue',
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

const finishInput = defineGraphCommandInput({
  employee_id: graphCommandInput.id(),
  blocker_id: graphCommandInput.id(),
  operation_id: graphCommandInput.optionalId(),
});

const finishCommand = graphCommandFor(finishInput).define({
  command: 'FINISH_EMPLOYEE_BLOCKER',
  method: 'POST',
  endpoint: '/operations/employee-blockers/finish',
  outcomes: [
    'EMPLOYEE_BLOCKERS_REMAIN',
    'EMPLOYEE_READY_TO_CLOSE_SHIFT',
  ],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
  }),
  request: async (_input) => ({}) as unknown,
});

const finishTransitions = defineGraphTransitions({
  graph,
  command: finishCommand,
  currentContext: employeeContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

const scope = graphInteractionsFor(graph, actions).node('S03-E12');

const finishInteraction = scope.business({
  action: 'finishEmployeeBlocker',
  availability: graphInteraction.availableActions(
    'employee',
    'available_actions',
  ),
  command: finishCommand,
  input: {
    employee_id: graphInteraction.context('employee_id'),
    blocker_id: graphInteraction.event('blocker_id'),
    operation_id: graphInteraction.optionalSourceId(
      'employee',
      'active',
      'operation_id',
    ),
  },
  transition: finishTransitions,
});

const backInteraction = scope.presentation({
  action: 'back',
  effect: graphInteraction.back(),
});

const openEmployeeInteraction = scope.presentation({
  action: 'openEmployee',
  effect: graphInteraction.navigate('S03-E10', {
    employee_id: graphInteraction.event('employee_id'),
    mode: graphInteraction.literal('view'),
  }),
});

const nodeInteractions = scope.define({
  business: [finishInteraction],
  presentation: [backInteraction, openEmployeeInteraction],
});

declare const nodeActions: GraphNodeActionFactoryFor<
  typeof nodeInteractions
>;

nodeActions.business(
  'finishEmployeeBlocker',
  {},
  {
    blocker_id: 'blocker-1',
  },
);

nodeActions.presentation('back', {}, {});

nodeActions.presentation(
  'openEmployee',
  {
    mainLine: 'Employee',
  },
  {
    employee_id: '1',
    mode: 'view',
  },
);

// @ts-expect-error node-scoped action factory cannot instantiate undeclared presentation actions
nodeActions.presentation('next', {}, {});

// @ts-expect-error available_actions evidence must come from a required node source
scope.business({
  action: 'finishEmployeeBlocker',
  availability: graphInteraction.availableActions(
    'hint',
    'available_actions',
  ),
  command: finishCommand,
  input: {
    employee_id: graphInteraction.context('employee_id'),
    blocker_id: graphInteraction.event('blocker_id'),
    operation_id: graphInteraction.optionalSourceId(
      'employee',
      'active',
      'operation_id',
    ),
  },
  transition: finishTransitions,
});

// @ts-expect-error availability path must type-contain the business action backend token
scope.business({
  action: 'closeEmployeeShift',
  availability: graphInteraction.availableActions(
    'employee',
    'available_actions',
  ),
  command: finishCommand,
  input: {
    employee_id: graphInteraction.context('employee_id'),
    blocker_id: graphInteraction.context('employee_id'),
    operation_id: graphInteraction.optionalSourceId(
      'employee',
      'active',
      'operation_id',
    ),
  },
  transition: finishTransitions,
});

scope.business({
  action: 'finishEmployeeBlocker',
  availability: graphInteraction.availableActions(
    'employee',
    'available_actions',
  ),
  command: finishCommand,
  input: {
    employee_id: graphInteraction.context('employee_id'),
    // @ts-expect-error command input bindings cannot cross scalar categories
    blocker_id: graphInteraction.context('mode'),
    operation_id: graphInteraction.optionalSourceId(
      'employee',
      'active',
      'operation_id',
    ),
  },
  transition: finishTransitions,
});

// @ts-expect-error nullable source IDs require omit semantics and optional command destinations
scope.business({
  action: 'finishEmployeeBlocker',
  availability: graphInteraction.availableActions(
    'employee',
    'available_actions',
  ),
  command: finishCommand,
  input: {
    employee_id: graphInteraction.context('employee_id'),
    blocker_id: graphInteraction.event('blocker_id'),
    operation_id: graphInteraction.sourceId(
      'employee',
      'active',
      'operation_id',
    ),
  },
  transition: finishTransitions,
});

scope.presentation({
  action: 'openEmployee',
  // @ts-expect-error navigation bindings cannot cross scalar categories
  effect: graphInteraction.navigate('S03-E10', {
    employee_id: graphInteraction.event('employee_id'),
    mode: graphInteraction.event('employee_id'),
  }),
});

scope.presentation({
  action: 'openEmployee',
  // @ts-expect-error literal must fit the destination field value union
  effect: graphInteraction.navigate('S03-E10', {
    employee_id: graphInteraction.event('employee_id'),
    mode: graphInteraction.literal('manage'),
  }),
});

scope.presentation({
  action: 'openEmployee',
  // @ts-expect-error presentation navigate effect requires a canonical graph node ID
  effect: graphInteraction.navigate(
    'S03-X99',
    {
      employee_id: graphInteraction.event('employee_id'),
      mode: graphInteraction.literal('view'),
    },
  ),
});

const localScope = graphInteractionsFor(graph, actions).node('S03-E10');

// @ts-expect-error local nodes cannot declare business availability evidence
localScope.business({
  action: 'finishEmployeeBlocker',
  availability: graphInteraction.availableActions(
    'employee',
    'available_actions',
  ),
  command: finishCommand,
  input: {
    employee_id: graphInteraction.context('employee_id'),
    blocker_id: graphInteraction.event('blocker_id'),
    operation_id: graphInteraction.event('blocker_id'),
  },
  transition: finishTransitions,
});

void nodeInteractions;
