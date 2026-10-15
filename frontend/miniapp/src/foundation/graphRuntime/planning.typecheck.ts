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
  type GraphBusinessInteractionPlanFor,
  type GraphNavigateInteractionPlan,
} from './planning';

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
  '/manager/employees/:id'
>({
  sourceId: 'employee',
  endpoint: '/manager/employees/:id',
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
  NONE: graphNodesFor(employeeContext).local({
    source: sources.local(),
    project: ({ context }) => ({ employeeId: context.employee_id }),
  }),
});

const actions = defineGraphActions({
  business: {
    finish: graphAction.business(
      'FINISH_EMPLOYEE_BLOCKER',
      defineGraphActionEvent({
        blocker_id: graphActionEvent.id(),
      }),
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
  blocker_id: graphCommandInput.id(),
  source_employee_id: graphCommandInput.id(),
});
const command = graphCommandFor(commandInput).define({
  command: 'FINISH_EMPLOYEE_BLOCKER',
  method: 'POST',
  endpoint: '/operations/employee-blockers/finish',
  outcomes: ['DONE'],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
  }),
  request: async () => ({} as unknown),
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

const otherCommandInput = defineGraphCommandInput({
  other_id: graphCommandInput.id(),
});
const otherCommand = graphCommandFor(otherCommandInput).define({
  command: 'OTHER_COMMAND',
  method: 'POST',
  endpoint: '/operations/other',
  outcomes: ['OTHER_DONE'],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
  }),
  request: async () => ({} as unknown),
});
const otherTransitions = defineGraphTransitions({
  graph,
  command: otherCommand,
  currentContext: employeeContext,
  transitions: {
    OTHER_DONE: {
      node: 'LOCAL',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
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
      availability: graphInteraction.availableActions(
        'employee',
        'available_actions',
      ),
      command,
      input: {
        employee_id: graphInteraction.context('employee_id'),
        blocker_id: graphInteraction.event('blocker_id'),
        source_employee_id: graphInteraction.sourceId(
          'employee',
          'employee_id',
        ),
      },
      transition: transitions,
    }),
  ],
  presentation: [
    employeeScope.presentation({
      action: 'back',
      effect: graphInteraction.back(),
    }),
  ],
});
const localScope = graphInteractionsFor(graph, actions).node('LOCAL');
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

async function typecheckPlanning(): Promise<void> {
  await runtime.activate({
    nodeId: 'EMPLOYEE',
    context: { employee_id: 'E-1', mode: 'view' },
  });
  const employeePlanner = createGraphReadyInteractionPlanner(
    runtime,
    'EMPLOYEE',
  );
  const businessProjection = employeePlanner.actions.business(
    'finish',
    {},
    { blocker_id: 'B-1' },
  );

  if (businessProjection.length === 1) {
    const instance = businessProjection[0];
    const plan = employeePlanner.plan(
      instance,
      employeePlanner.actions.describe(instance),
    );
    const exactPlan: GraphBusinessInteractionPlanFor<
      typeof program,
      'EMPLOYEE',
      'finish'
    > = plan;
    const exactCommand: typeof command = plan.command;
    const exactInput: GraphCommandInput<typeof command> = plan.input;
    const exactTransition: typeof transitions = plan.transition;
    const exactTransitionCommand: typeof plan.command =
      plan.transition.command;

    const rawResult = await plan.command.request(plan.input);
    const decoded: InferGraphCommandResult<typeof command> =
      plan.command.decode(rawResult);
    const target = plan.transition.transitions[decoded.outcome];
    const exactTarget: (typeof transitions)['transitions'][
      typeof decoded.outcome
    ] = target;

    const unknownPlan: unknown = plan;
    if (employeePlanner.ownsBusinessPlan(unknownPlan)) {
      const ownedPlan: GraphBusinessInteractionPlanFor<
        typeof program,
        'EMPLOYEE',
        'finish'
      > = unknownPlan;
      void ownedPlan;
    }

    if (employeePlanner.ownsPresentationPlan(unknownPlan)) {
      // @ts-expect-error business plan cannot be narrowed to a presentation plan
      const notBusiness: GraphBusinessInteractionPlanFor<
        typeof program,
        'EMPLOYEE',
        'finish'
      > = unknownPlan;
      void notBusiness;
    }

    // @ts-expect-error exact business command must not widen to another command
    const wrongCommand: typeof otherCommand = plan.command;
    // @ts-expect-error parsed input belongs to the exact command schema
    const wrongInput: GraphCommandInput<typeof otherCommand> = plan.input;
    // @ts-expect-error transition must be the exact same-command transition
    const wrongTransition: typeof otherTransitions = plan.transition;
    // @ts-expect-error business plans are not presentation plans
    const backPlan: GraphBackInteractionPlan<'EMPLOYEE', 'back'> = plan;

    void exactPlan;
    void exactCommand;
    void exactInput;
    void exactTransition;
    void exactTransitionCommand;
    void exactTarget;
    void wrongCommand;
    void wrongInput;
    void wrongTransition;
    void backPlan;
  }

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
  const unknownBackPlan: unknown = backPlan;
  if (
    employeePlanner.ownsPresentationPlan(unknownBackPlan) &&
    unknownBackPlan.effect === 'back'
  ) {
    const ownedBack: GraphBackInteractionPlan<'EMPLOYEE', 'back'> =
      unknownBackPlan;
    // @ts-expect-error presentation ownership stays scoped to the current node action IDs
    const wrongNodeAction: GraphNavigateInteractionPlan<'LOCAL', 'open'> =
      unknownBackPlan;
    void ownedBack;
    void wrongNodeAction;
  }

  // @ts-expect-error planner exposes only node-declared presentation IDs
  employeePlanner.actions.presentation('open', { mainLine: 'x' }, { employee_id: 'E-1' });

  // @ts-expect-error planner exposes no command request API
  employeePlanner.request;
  // @ts-expect-error planner exposes no result decode API
  employeePlanner.decode;
  // @ts-expect-error planner exposes no transition execution API
  employeePlanner.transition;
  // @ts-expect-error planner exposes no activation API
  employeePlanner.activate;
  // @ts-expect-error planner exposes no renderer API
  employeePlanner.render;

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
  const navigate = localPlanner.plan(
    openInstance,
    localPlanner.actions.describe(openInstance),
  );

  if (navigate.effect !== 'navigate') {
    throw new Error('expected navigate');
  }

  const exactNavigate: GraphNavigateInteractionPlan<
    'LOCAL',
    'open'
  > = navigate;
  const unknownNavigatePlan: unknown = navigate;
  if (
    localPlanner.ownsPresentationPlan(unknownNavigatePlan) &&
    unknownNavigatePlan.effect === 'navigate'
  ) {
    const ownedNavigate: GraphNavigateInteractionPlan<
      'LOCAL',
      'open'
    > = unknownNavigatePlan;
    void ownedNavigate;
  }

  // @ts-expect-error a node omitted from the interaction map has no planner
  createGraphReadyInteractionPlanner(runtime, 'NONE');

  void exactBack;
  void exactNavigate;
}

void typecheckPlanning;
