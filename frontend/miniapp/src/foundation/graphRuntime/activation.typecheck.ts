import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
} from '../graphProtocol/action';
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
import {
  defineGraphProgram,
} from '../graphProtocol/program';
import {
  graphSourcesFor,
} from '../graphProtocol/source';
import {
  createGraphActivationRuntime,
  type GraphActivationNodeId,
  type GraphActivationResult,
} from './activation';

const context = defineGraphContext({
  employee_id: graphContext.id(),
});

type Context = Readonly<{
  employee_id: string;
}>;

const sources = graphSourcesFor<Context>();

const graph = defineGraph({
  LOCAL: graphNodesFor(context).local({
    source: sources.local(),
    project: ({ context: currentContext }) => ({
      employeeId: currentContext.employee_id,
    }),
  }),
});

const noEvent = defineGraphActionEvent({});

const actions = defineGraphActions({
  business: {},
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

const scope = graphInteractionsFor(
  graph,
  actions,
).node('LOCAL');

const back = scope.presentation({
  action: 'back',
  effect: graphInteraction.back(),
});

const interactions = scope.define({
  business: [],
  presentation: [back],
});

const program = defineGraphProgram({
  graph,
  actions,
  interactions: {
    LOCAL: interactions,
  },
});

const runtime = createGraphActivationRuntime(program);

type NodeId = GraphActivationNodeId<typeof program>;
const nodeId: NodeId = 'LOCAL';

const result = runtime.activate({
  nodeId,
  context: {
    employee_id: 'E-1',
  },
});

type Result = Awaited<typeof result>;
const resultType: GraphActivationResult<NodeId> =
  null as unknown as Result;

// @ts-expect-error GraphActivationNodeId remains the canonical graph-node union
const unknownNodeId: NodeId = 'UNKNOWN';

// @ts-expect-error B1 Runtime exposes no command execution API
runtime.executeCommand;

// @ts-expect-error B1 Runtime exposes no renderer integration API
runtime.render;

// @ts-expect-error B1 Runtime requires a branded verified GraphProgram
createGraphActivationRuntime({
  kind: 'graph-program',
  graph,
});

void resultType;
void unknownNodeId;
