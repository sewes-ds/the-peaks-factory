import { createElement } from 'react';

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
  type GraphPresentationExecutionRuntime,
  type GraphReadyInteractionPlanner,
} from '../graphRuntime';
import type { PeaksListButtonProps } from './PeaksActionButton';
import {
  createPeaksGraphReadyNodeBinding,
  type PeaksGraphInteractionPendingChange,
  type PeaksGraphInteractionStateChange,
  type PeaksGraphReadyNodeBinding,
  type PeaksGraphRuntimeInfoTextItem,
  type PeaksGraphRuntimeViewProjection,
} from './runtimeIntegration';

// @ts-expect-error history entry type is private and not exported
import type { PeaksGraphRuntimeHistoryEntry } from './runtimeIntegration';

type EmployeeContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;

type EmployeeReadModel = Readonly<{
  employee_id: string;
  available_actions: readonly [
    'FINISH_EMPLOYEE_BLOCKER',
    'ARCHIVE_LOCAL',
  ];
}>;

const context = defineGraphContext({
  employee_id: graphContext.id(),
  mode: graphContext.mode('view', 'edit'),
});
const sources = graphSourcesFor<EmployeeContext>();
const modelSource = sources.required<
  EmployeeReadModel,
  'employee',
  '/employee'
>({
  sourceId: 'employee',
  endpoint: '/employee',
  request: async () => ({
    employee_id: 'E-1',
    available_actions: ['FINISH_EMPLOYEE_BLOCKER', 'ARCHIVE_LOCAL'],
  }),
  decode: (input: unknown) => input as EmployeeReadModel,
});
const graph = defineGraph({
  EMPLOYEE: graphNodesFor(context).endpointBacked({
    source: sources.endpointBacked(
      sources.bundle({ employee: modelSource }),
    ),
    project: ({ context: currentContext }) => ({
      employeeId: currentContext.employee_id,
    }),
  }),
  LOCAL: graphNodesFor(context).endpointBacked({
    source: sources.endpointBacked(
      sources.bundle({ employee: modelSource }),
    ),
    project: ({ context: currentContext }) => ({
      employeeId: currentContext.employee_id,
    }),
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
    archive: graphAction.business(
      'ARCHIVE_LOCAL',
      defineGraphActionEvent({}),
      graphAction.actionButton({
        label: 'Archive',
        icon: 'archive.svg',
        variant: 'gray',
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
  currentContext: context,
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
const interactionsFor = graphInteractionsFor(graph, actions);
const employeeScope = interactionsFor.node('EMPLOYEE');
const localScope = interactionsFor.node('LOCAL');
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
  business: [
    localScope.business({
      action: 'archive',
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
const presentationExecution = createGraphPresentationExecutionRuntime(runtime);

async function typecheckRendererIntegration(): Promise<void> {
  await runtime.activate({
    nodeId: 'EMPLOYEE',
    context: { employee_id: 'E-1', mode: 'view' },
  });

  const changes: PeaksGraphInteractionStateChange<typeof program, 'EMPLOYEE'>[] = [];
  const binding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution,
    nodeId: 'EMPLOYEE',
    onInteractionStateChange: (change) => {
      changes.push(change);
    },
  });
  const exactBinding: PeaksGraphReadyNodeBinding<typeof program, 'EMPLOYEE'> =
    binding;
  const exactPresentationRuntime: GraphPresentationExecutionRuntime<typeof program> =
    binding.presentationExecution;
  const exactPlanner: GraphReadyInteractionPlanner<typeof program, 'EMPLOYEE'> =
    binding.planner;
  const exactActionFactory: typeof binding.planner.actions =
    binding.actionFactory;
  const props: PeaksListButtonProps = {
    variant: 'blue',
    mainLine: 'Line',
    ariaLabel: 'List aria',
  };

  const finishProjection = binding.actionFactory.business(
    'finish',
    {},
    {},
  );
  if (finishProjection.length !== 1) {
    throw new Error('expected finish');
  }
  const finish = finishProjection[0];
  const back = binding.actionFactory.presentation('back', {}, {});
  const projection: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> =
    {
      scrollItems: [
        { kind: 'info-text', id: 'info', text: 'Info' },
        {
          kind: 'production-operation-card',
          id: 'card',
          title: 'Card',
          lines: [{ label: 'Employee', value: 'E-1' }],
        },
        { kind: 'message', id: 'message', text: 'Message' },
        finish,
        back,
      ],
    };

  await binding.execute(finish);
  await binding.execute(back);

  await runtime.activate({
    nodeId: 'LOCAL',
    context: { employee_id: 'E-1', mode: 'view' },
  });
  const localBinding = createPeaksGraphReadyNodeBinding({
    runtime,
    presentationExecution,
    nodeId: 'LOCAL',
    onInteractionStateChange: () => undefined,
  });
  const archiveProjection = localBinding.actionFactory.business(
    'archive',
    {},
    {},
  );
  if (archiveProjection.length !== 1) {
    throw new Error('expected archive');
  }
  const archive = archiveProjection[0];
  const open = localBinding.actionFactory.presentation(
    'open',
    { mainLine: 'Employee' },
    { employee_id: 'E-2' },
  );

  const wrongBusiness: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    scrollItems: [
      // @ts-expect-error business action ID from another node is not accepted
      archive,
    ],
  };

  const wrongPresentation: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    scrollItems: [
      // @ts-expect-error presentation action ID from another node is not accepted
      open,
    ],
  };

  const withNodeId: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    // @ts-expect-error projection cannot define nodeId
    nodeId: 'EMPLOYEE',
    scrollItems: [],
  };

  const withDisabled: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    // @ts-expect-error projection cannot define disabled
    disabled: true,
    scrollItems: [],
  };

  const withOnClick: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    // @ts-expect-error projection cannot define onClick
    onClick: () => undefined,
    scrollItems: [],
  };

  const withCustomItem: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    scrollItems: [
      {
        // @ts-expect-error projection cannot include custom renderer item
        kind: 'custom',
        id: 'custom',
        node: 'node',
      },
    ],
  };

  const withReactNode: PeaksGraphRuntimeInfoTextItem = {
    kind: 'info-text',
    id: 'react',
    // @ts-expect-error inert item text must be a string, not ReactNode
    text: createElement('span'),
  };

  const withRequest: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    scrollItems: [],
    // @ts-expect-error projection cannot include backend request
    request: async () => ({}),
  };

  const withPlanner: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    scrollItems: [],
    // @ts-expect-error projection cannot include planner
    planner: binding.planner,
  };

  const withExecutor: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    scrollItems: [],
    // @ts-expect-error projection cannot include executor
    executor: binding.businessExecution,
  };

  const withRuntime: PeaksGraphRuntimeViewProjection<typeof program, 'EMPLOYEE'> = {
    scrollItems: [],
    // @ts-expect-error projection cannot include runtime
    runtime,
  };

  // @ts-expect-error execute rejects arbitrary action object
  await binding.execute({ kind: 'business-action', actionId: 'finish' });

  if (changes[0]?.status === 'pending') {
    const pending: PeaksGraphInteractionPendingChange<'EMPLOYEE'> =
      changes[0];
    const actionId: string = pending.actionId;
    // @ts-expect-error pending lifecycle exposes no action instance
    pending.instance;
    // @ts-expect-error pending lifecycle exposes no descriptor
    pending.descriptor;
    // @ts-expect-error pending lifecycle exposes no plan
    pending.plan;
    // @ts-expect-error pending lifecycle exposes no request
    pending.request;
    // @ts-expect-error pending lifecycle exposes no history
    pending.history;
    void actionId;
  }

  const settled = changes.find((change) => change.status === 'settled');
  if (settled?.status === 'settled') {
    const closedResult = settled.result;
    // @ts-expect-error settled lifecycle exposes no action instance
    settled.instance;
    void closedResult;
  }

  // @ts-expect-error binding exposes no history
  binding.history;
  // @ts-expect-error binding exposes no router
  binding.router;
  // @ts-expect-error binding exposes no backend API
  binding.backendApi;

  type ImportedHistoryEntry = PeaksGraphRuntimeHistoryEntry;

  void exactBinding;
  void exactPresentationRuntime;
  void exactPlanner;
  void exactActionFactory;
  void props;
  void projection;
  void wrongBusiness;
  void wrongPresentation;
  void withNodeId;
  void withDisabled;
  void withOnClick;
  void withCustomItem;
  void withReactNode;
  void withRequest;
  void withPlanner;
  void withExecutor;
  void withRuntime;
  void (undefined as unknown as ImportedHistoryEntry);
}

void typecheckRendererIntegration;
