import type { ApiClient } from '../foundation/apiClient';
import { defineGraphActionEvent, definePlatformGraphActions, platformGraphAction } from '../foundation/graphProtocol/action';
import type { InferGraphContext } from '../foundation/graphProtocol/context';
import { defineGraph, graphNodesFor, type GraphNodeProjection } from '../foundation/graphProtocol/definition';
import { graphInteraction, graphInteractionsFor } from '../foundation/graphProtocol/interaction';
import { defineGraphProgram, type GraphProgram, type GraphProgramInteractionMap } from '../foundation/graphProtocol/program';
import { graphSourcesFor } from '../foundation/graphProtocol/source';
import { defineGraphTransitions, graphTransition } from '../foundation/graphProtocol/transition';
import { createSection02BusinessCommands, SECTION02_BUSINESS_ACTION_IDS, type Section02BusinessActionId } from './commands';
import { createSection02ContextSchema, SECTION02_CONTEXT_KEYS, type Section02Context } from './context';
import { SECTION02_NODE_IDS, type Section02NodeId } from './ids';
import { decodeSection02LoadedNodeData, emptySection02LoadedData, loadSection02Node, SECTION02_LOADER_ENDPOINTS, type Section02LoadedNodeData } from './loaders';
import { SECTION02_FORWARD_TARGETS, SECTION02_NODE_REGISTRY, validateSection02NodeContext } from './topology';
import { telegramQrScanner, type TelegramQrScanner } from '../foundation/telegramQr';

export type Section02NodeProjection = Readonly<{
  kind: 'section02-node';
  screenId: Section02NodeId;
  context: Section02Context;
  data: Section02LoadedNodeData;
}>;

function projection(input: Section02NodeProjection): Section02NodeProjection & GraphNodeProjection {
  return Object.freeze(input);
}

export function isSection02NodeProjection(value: GraphNodeProjection): value is Section02NodeProjection {
  return value.kind === 'section02-node';
}

function createGraph(apiClient: ApiClient, qrScanner: TelegramQrScanner) {
  const context = createSection02ContextSchema();
  type RuntimeContext = InferGraphContext<typeof context>;
  const sources = graphSourcesFor<RuntimeContext>();
  const nodes = graphNodesFor(context);
  type DataSource = ReturnType<typeof sources.required<Section02LoadedNodeData, string, string>>;
  type EndpointNode = ReturnType<typeof nodes.endpointBacked<Readonly<{ nodeData: DataSource }>>>;
  type AnyNode = ReturnType<typeof nodes.local> | EndpointNode;
  const entries = SECTION02_NODE_IDS.map((nodeId) => {
    const definition = SECTION02_NODE_REGISTRY[nodeId];
    if (definition.loader === null) {
      return [nodeId, nodes.local({
        source: sources.local(),
        project: ({ context: localContext }) => {
          const scalarContext = localContext as Section02Context;
          validateSection02NodeContext(nodeId, scalarContext);
          return projection({ kind: 'section02-node', screenId: nodeId, context: scalarContext, data: emptySection02LoadedData() });
        },
      }) as AnyNode] as const;
    }
    const endpoints = SECTION02_LOADER_ENDPOINTS[definition.loader];
    const nodeData = sources.required<Section02LoadedNodeData, string, string>({
      sourceId: `section02-node:${nodeId}`,
      endpoint: endpoints[0]!,
      request: async (sourceContext) => loadSection02Node(apiClient, nodeId, sourceContext as Section02Context, qrScanner),
      decode: decodeSection02LoadedNodeData,
    });
    return [nodeId, nodes.endpointBacked({
      source: sources.endpointBacked(sources.bundle({ nodeData })),
      project: ({ context: loadedContext, sources: loaded }) => projection({
        kind: 'section02-node', screenId: nodeId, context: loadedContext as Section02Context, data: loaded.nodeData,
      }),
    }) as AnyNode] as const;
  });
  return defineGraph(Object.fromEntries(entries) as Readonly<Record<Section02NodeId, AnyNode>>);
}

function createActions() {
  const navigationEvent = defineGraphActionEvent(createSection02ContextSchema());
  return definePlatformGraphActions({
    business: Object.fromEntries(SECTION02_BUSINESS_ACTION_IDS.map((actionId) => [
      actionId,
      platformGraphAction.business(actionId === 'START_OPERATIONAL_DOWNTIME' ? 'START_OPERATIONAL_DOWNTIME' : actionId === 'START_CRITICAL_DOWNTIME' ? 'START_CRITICAL_DOWNTIME' : actionId, navigationEvent),
    ])) as never,
    presentation: {
      navigate0: platformGraphAction.presentation(navigationEvent),
      navigate1: platformGraphAction.presentation(navigationEvent),
      navigate2: platformGraphAction.presentation(navigationEvent),
      navigate3: platformGraphAction.presentation(navigationEvent),
      navigate4: platformGraphAction.presentation(navigationEvent),
      navigate5: platformGraphAction.presentation(navigationEvent),
      navigate6: platformGraphAction.presentation(navigationEvent),
      navigate7: platformGraphAction.presentation(navigationEvent),
      navigate8: platformGraphAction.presentation(navigationEvent),
      navigate9: platformGraphAction.presentation(navigationEvent),
      back: platformGraphAction.presentation(navigationEvent),
    },
  });
}

const commandNodes = Object.freeze({
  START_SHIFT: Object.freeze(['S02-N01']),
  START_PRODUCTION: Object.freeze(['S02-SKUQR01', 'S02-N05']),
  FINISH_PRODUCTION: Object.freeze(['S02-N08']),
  START_BREAK: Object.freeze(['S02-B01']),
  FINISH_BREAK: Object.freeze(['S02-B03']),
  START_OPERATIONAL_DOWNTIME: Object.freeze(['S02-N09']),
  START_CRITICAL_DOWNTIME: Object.freeze(['S02-N27']),
  FINISH_DOWNTIME: Object.freeze(['S02-N10']),
  REQUEST_ADDITIONAL_WORK: Object.freeze(['S02-AW02']),
  START_ADDITIONAL_WORK: Object.freeze(['S02-AW03']),
  FINISH_ADDITIONAL_WORK: Object.freeze(['S02-AW04']),
  FINISH_SHIFT: Object.freeze(['S02-FS01']),
} as const satisfies Readonly<Record<Section02BusinessActionId, readonly Section02NodeId[]>>);

function transitionTargets(actionId: Section02BusinessActionId): readonly [Section02NodeId, Section02NodeId] {
  if (actionId === 'START_SHIFT') return ['S02-N02', 'S02-N02'];
  if (actionId === 'START_PRODUCTION') return ['S02-N02', 'S02-N02'];
  if (actionId === 'FINISH_PRODUCTION') return ['S02-N02', 'S02-N02'];
  if (actionId === 'START_BREAK') return ['S02-N02', 'S02-N02'];
  if (actionId === 'FINISH_BREAK') return ['S02-N02', 'S02-N02'];
  if (actionId === 'START_OPERATIONAL_DOWNTIME') return ['S02-N02', 'S02-N02'];
  if (actionId === 'START_CRITICAL_DOWNTIME') return ['S02-N28', 'S02-N28'];
  if (actionId === 'FINISH_DOWNTIME') return ['S02-N02', 'S02-N02'];
  if (actionId === 'REQUEST_ADDITIONAL_WORK' || actionId === 'START_ADDITIONAL_WORK') return ['S02-N11', 'S02-N11'];
  if (actionId === 'FINISH_ADDITIONAL_WORK') return ['S02-AW05', 'S02-AW05'];
  return ['S02-N01', 'S02-N01'];
}

function createInteractions(graph: ReturnType<typeof createGraph>, actions: ReturnType<typeof createActions>, apiClient: ApiClient) {
  const scoped = graphInteractionsFor(graph, actions);
  const commands = createSection02BusinessCommands(apiClient);
  const eventContext = Object.fromEntries(SECTION02_CONTEXT_KEYS.map((field) => [field, graphInteraction.event(field)]));
  const transitionContext = Object.fromEntries(SECTION02_CONTEXT_KEYS.map((field) => [field, graphTransition.context(field)]));
  const entries = SECTION02_NODE_IDS.map((nodeId) => {
    const node = scoped.node(nodeId);
    const presentation = SECTION02_FORWARD_TARGETS[nodeId].map((target, index) => node.presentation({
      action: `navigate${index}`,
      effect: graphInteraction.navigate(target, eventContext),
    } as never));
    presentation.push(node.presentation({ action: 'back', effect: graphInteraction.back() } as never));
    const business = SECTION02_BUSINESS_ACTION_IDS.flatMap((actionId) => {
      if (!(commandNodes[actionId] as readonly string[]).includes(nodeId)) return [];
      const [primary, secondary] = transitionTargets(actionId);
      const command = commands[actionId];
      const transition = defineGraphTransitions({
        graph,
        command,
        currentContext: graph.nodes[nodeId].context,
        transitions: {
          PRIMARY: { node: primary, context: transitionContext },
          SECONDARY: { node: secondary, context: transitionContext },
        },
      } as never);
      return [node.business({
        action: actionId,
        availability: graphInteraction.availableActions('nodeData', 'availableActions'),
        command,
        input: eventContext,
        transition,
      } as never)];
    });
    return [nodeId, node.define({ business, presentation } as never)] as const;
  });
  return Object.fromEntries(entries);
}

export function createSection02Program(apiClient: ApiClient, qrScanner: TelegramQrScanner = telegramQrScanner) {
  const graph = createGraph(apiClient, qrScanner);
  const actions = createActions();
  type Interactions = GraphProgramInteractionMap<typeof graph, typeof actions>;
  const interactions = createInteractions(graph, actions, apiClient) as Interactions;
  const define = defineGraphProgram as unknown as (input: Readonly<{
    graph: typeof graph;
    actions: typeof actions;
    interactions: Interactions;
  }>) => GraphProgram<typeof graph, typeof actions, Interactions>;
  return define({ graph, actions, interactions });
}

export type Section02Program = ReturnType<typeof createSection02Program>;

export function resolveSection02InitialNode(workplace: import('./contracts').OperatorWorkplaceStateResponse): Section02NodeId {
  if (!workplace.shift.is_active) return 'S02-N01';
  return 'S02-N02';
}
