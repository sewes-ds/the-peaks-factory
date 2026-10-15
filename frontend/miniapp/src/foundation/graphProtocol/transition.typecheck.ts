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
  type GraphNodeId,
} from './definition';
import { graphSourcesFor } from './source';
import {
  defineGraphTransitions,
  graphTransition,
} from './transition';

const currentContext = defineGraphContext({
  employee_id: graphContext.id(),
  period: graphContext.period('today', 'week'),
  mode: graphContext.mode('view', 'edit'),
  optional_note: graphContext.optionalTextInput(),
});

const destinationContext = defineGraphContext({
  employee_id: graphContext.id(),
  period: graphContext.period('today', 'week', 'month'),
  mode: graphContext.mode('view', 'edit'),
});

type DestinationContext = Readonly<{
  employee_id: string;
  period: 'today' | 'week' | 'month';
  mode: 'view' | 'edit';
}>;

const destinationSources = graphSourcesFor<DestinationContext>();
const employeeNodes = graphNodesFor(destinationContext);

const graph = defineGraph({
  'S03-E12': employeeNodes.local({
    source: destinationSources.local(),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
  'S03-E10': employeeNodes.local({
    source: destinationSources.local(),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
});

const commandInput = defineGraphCommandInput({
  employee_id: graphCommandInput.id(),
  blocker_id: graphCommandInput.id(),
});

const command = graphCommandFor(commandInput).define({
  command: 'FINISH_EMPLOYEE_BLOCKER',
  method: 'POST',
  endpoint: '/operations/employee-blockers/finish',
  outcomes: [
    'EMPLOYEE_BLOCKERS_REMAIN',
    'EMPLOYEE_READY_TO_CLOSE_SHIFT',
  ],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
    optional_blocker_id: graphCommandEntity.optionalId(),
  }),
  request: async (_input) => ({}) as unknown,
});

const transitions = defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.context('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

type NodeId = GraphNodeId<typeof graph>;
const nodeId: NodeId =
  transitions.transitions.EMPLOYEE_BLOCKERS_REMAIN.node;

defineGraphTransitions({
  graph,
  command,
  currentContext,
  // @ts-expect-error every declared command outcome requires a transition
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
    // @ts-expect-error undeclared command outcomes cannot define transitions
    FRONTEND_DECIDED_NEXT_SCREEN: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      // @ts-expect-error transition destinations must be canonical graph node IDs
      node: 'S03-X99',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      // @ts-expect-error required destination context fields must be projected
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        // @ts-expect-error unknown command entity IDs cannot be projected
        employee_id: graphTransition.entityId('machine_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        // @ts-expect-error optional command entity IDs cannot fill required destination IDs
        employee_id:
          graphTransition.entityId('optional_blocker_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        // @ts-expect-error context bindings cannot cross context categories
        period: graphTransition.context('employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        // @ts-expect-error command entity IDs can bind only destination id fields
        period: graphTransition.entityId('employee_id'),
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

const incompatibleCurrentContext = defineGraphContext({
  employee_id: graphContext.id(),
  period: graphContext.period('today', 'week'),
  mode: graphContext.mode('view', 'edit'),
});

const incompatibleDestinationContext = defineGraphContext({
  employee_id: graphContext.id(),
  period: graphContext.period('today', 'week'),
  mode: graphContext.mode('edit'),
});

type IncompatibleDestination = Readonly<{
  employee_id: string;
  period: 'today' | 'week';
  mode: 'edit';
}>;

const incompatibleSources =
  graphSourcesFor<IncompatibleDestination>();
const incompatibleNodes =
  graphNodesFor(incompatibleDestinationContext);

const incompatibleGraph = defineGraph({
  'S03-E99': incompatibleNodes.local({
    source: incompatibleSources.local(),
    project: () => ({
      title: 'synthetic',
    }),
  }),
});

defineGraphTransitions({
  graph: incompatibleGraph,
  command,
  currentContext: incompatibleCurrentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E99',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        // @ts-expect-error source context value union must fit destination context value type
        mode: graphTransition.context('mode'),
      },
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E99',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        // @ts-expect-error source context value union must fit destination context value type
        mode: graphTransition.context('mode'),
      },
    },
  },
});

defineGraphTransitions({
  graph,
  command,
  currentContext,
  transitions: {
    EMPLOYEE_BLOCKERS_REMAIN: {
      node: 'S03-E12',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
      // @ts-expect-error transition targets cannot expose business predicates
      predicate: () => true,
    },
    EMPLOYEE_READY_TO_CLOSE_SHIFT: {
      node: 'S03-E10',
      context: {
        employee_id: graphTransition.entityId('employee_id'),
        period: graphTransition.context('period'),
        mode: graphTransition.context('mode'),
      },
    },
  },
});

void nodeId;
