import type { ApiClient } from '../foundation/apiClient';
import { defineGraphActionEvent, definePlatformGraphActions, graphActionEvent, platformGraphAction } from '../foundation/graphProtocol/action';
import type { InferGraphContext } from '../foundation/graphProtocol/context';
import { defineGraph, graphNodesFor, type GraphNodeProjection } from '../foundation/graphProtocol/definition';
import { graphInteraction, graphInteractionsFor } from '../foundation/graphProtocol/interaction';
import { defineGraphProgram, type GraphProgramInteractionMap } from '../foundation/graphProtocol/program';
import { graphSourcesFor } from '../foundation/graphProtocol/source';
import { defineGraphTransitions, graphTransition } from '../foundation/graphProtocol/transition';
import { SECTION03_TECHNICAL_TEXT, managerSection03Paths, requestFinishOperationalDowntime, requestManagerMachineCard, requestManagerMachines, requestManagerWorkplaceState } from './api';
import { Section03ContractError, decodeManagerMachineCardResponse, decodeManagerMachinesResponse, decodeManagerWorkplaceStateResponse, decodeOperationIdResponse, type ManagerMachineCard, type ManagerMachines, type ManagerWorkplaceState } from './contracts';
import { createSection03GraphContextSchema, decodeSection03Context, type Section03Context as Section03ScalarContext } from './program/context';
import { SECTION03_NODE_IDS, type Section03NodeId } from './program/ids';
import { decodeSection03LoadedNodeData, loadSection03Node, SECTION03_LOADER_ENDPOINTS, type Section03LoadedNodeData } from './program/loaders';
import { SECTION03_NODE_REGISTRY, validateSection03NodeContext } from './program/registry';
import { SECTION03_CONTEXT_KEYS } from './program/context';
import { SECTION03_FORWARD_TARGETS } from './program/reachability';
import { SECTION03_BUSINESS_ACTIONS, type Section03BusinessActionId } from './program/business';
import { createSection03BusinessCommands } from './program/commands';

export type { Section03NodeId } from './program/ids';
export type Section03RuntimeNodeId = Section03NodeId;

export const SECTION03_AUDIT_REASON = SECTION03_TECHNICAL_TEXT.downtimeFinish;
export const SECTION03_INITIAL_ACTIVATION = Object.freeze({ nodeId: 'S03-N01' as const, context: Object.freeze({}) });

export type Section03NodeProjection =
  | Readonly<{ kind: 'manager-main'; model: ManagerWorkplaceState }>
  | Readonly<{ kind: 'machine-list'; model: ManagerMachines }>
  | Readonly<{ kind: 'machine-card'; model: ManagerMachineCard }>
  | Readonly<{ kind: 'operational-downtime-confirmation'; model: ManagerMachineCard }>
  | Readonly<{ kind: 'section03-node'; screenId: Section03NodeId; context: Section03ScalarContext; data: Section03LoadedNodeData }>;

function requiredMachineId(context: Section03ScalarContext): string {
  if (typeof context.machine_id === 'string' && context.machine_id.trim().length > 0) {
    return context.machine_id.trim();
  }
  throw new Section03ContractError({ code: 'INVALID_ID', path: '$.context.machine_id', expected: 'non-empty machine_id', actual: context.machine_id });
}

function projection(input: Section03NodeProjection): Section03NodeProjection & GraphNodeProjection {
  return Object.freeze(input);
}

export function isSection03NodeProjection(input: GraphNodeProjection): input is Section03NodeProjection {
  return input.kind === 'manager-main' || input.kind === 'machine-list' || input.kind === 'machine-card' || input.kind === 'operational-downtime-confirmation' || input.kind === 'section03-node';
}

function createGraph(apiClient: ApiClient) {
  const context = createSection03GraphContextSchema();
  type RuntimeContext = InferGraphContext<typeof context>;
  const sources = graphSourcesFor<RuntimeContext>();
  const nodes = graphNodesFor(context);
  const workplace = sources.required<ManagerWorkplaceState, 'manager-workplace-state', '/manager/workplace-state'>({ sourceId: 'manager-workplace-state', endpoint: managerSection03Paths.workplaceState, request: async () => requestManagerWorkplaceState(apiClient), decode: decodeManagerWorkplaceStateResponse });
  const machines = sources.required<ManagerMachines, 'manager-machines', '/manager/machines'>({ sourceId: 'manager-machines', endpoint: managerSection03Paths.machines, request: async () => requestManagerMachines(apiClient), decode: decodeManagerMachinesResponse });
  const machine = sources.required<ManagerMachineCard, 'manager-machine-card', '/manager/machines/:machine_id'>({ sourceId: 'manager-machine-card', endpoint: '/manager/machines/:machine_id', request: async (sourceContext) => requestManagerMachineCard(apiClient, requiredMachineId(sourceContext)), decode: decodeManagerMachineCardResponse });
  const established = {
    'S03-N01': nodes.endpointBacked({ source: sources.endpointBacked(sources.bundle({ workplace })), project: ({ sources: loaded }) => projection({ kind: 'manager-main', model: loaded.workplace }) }),
    'S03-M01': nodes.endpointBacked({ source: sources.endpointBacked(sources.bundle({ machines })), project: ({ sources: loaded }) => projection({ kind: 'machine-list', model: loaded.machines }) }),
    'S03-M02': nodes.endpointBacked({ source: sources.endpointBacked(sources.bundle({ machine })), project: ({ sources: loaded }) => projection({ kind: 'machine-card', model: loaded.machine }) }),
    'S03-M03O': nodes.endpointBacked({ source: sources.endpointBacked(sources.bundle({ machine })), project: ({ sources: loaded }) => projection({ kind: 'operational-downtime-confirmation', model: loaded.machine }) }),
  } as const;
  type EstablishedNodeId = keyof typeof established;
  type AdditionalNodeId = Exclude<Section03NodeId, EstablishedNodeId>;
  type AdditionalNodeDataSource = ReturnType<typeof sources.required<Section03LoadedNodeData, string, string>>;
  type AdditionalEndpointNode = ReturnType<typeof nodes.endpointBacked<Readonly<{ nodeData: AdditionalNodeDataSource }>>>;
  type AdditionalGraphNode = ReturnType<typeof nodes.local> | AdditionalEndpointNode;
  const establishedIds = new Set<string>(Object.keys(established));
  const additionalEntries = SECTION03_NODE_IDS
    .filter((nodeId): nodeId is AdditionalNodeId => !establishedIds.has(nodeId))
    .map((nodeId) => {
      const definition = SECTION03_NODE_REGISTRY[nodeId];
      if (definition.loader === null) {
        const node = nodes.local({
          source: sources.local(),
          project: ({ context: localContext }) => {
            const decodedContext = decodeSection03Context(localContext);
            validateSection03NodeContext(nodeId, decodedContext);
            return projection({
              kind: 'section03-node',
              screenId: nodeId,
              context: decodedContext,
              data: Object.freeze({ loader: null, primary: null, supplemental: null, availableActions: Object.freeze([]) }),
            });
          },
        });
        return [nodeId, node as AdditionalGraphNode] as const;
      }
      const loader = definition.loader;
      const nodeData = sources.required<Section03LoadedNodeData, string, string>({
        sourceId: `section03-node:${nodeId}`,
        endpoint: SECTION03_LOADER_ENDPOINTS[loader],
        request: async (sourceContext) => loadSection03Node(apiClient, nodeId, decodeSection03Context(sourceContext)),
        decode: decodeSection03LoadedNodeData,
      });
      const node = nodes.endpointBacked({
        source: sources.endpointBacked(sources.bundle({ nodeData })),
        project: ({ context: loadedContext, sources: loaded }) => projection({
          kind: 'section03-node',
          screenId: nodeId,
          context: decodeSection03Context(loadedContext),
          data: loaded.nodeData,
        }),
      });
      return [nodeId, node as unknown as AdditionalGraphNode] as const;
    });
  const additional = Object.fromEntries(additionalEntries) as Readonly<Record<AdditionalNodeId, AdditionalGraphNode>>;
  return defineGraph({ ...established, ...additional });
}

function createActions() {
  const emptyEvent = defineGraphActionEvent({});
  const navigationEvent = defineGraphActionEvent(createSection03GraphContextSchema());
  const machineIdEvent = defineGraphActionEvent({ machine_id: graphActionEvent.id() });
  return definePlatformGraphActions({
    business: {
      FINISH_DOWNTIME: platformGraphAction.business('FINISH_DOWNTIME', navigationEvent),
      START_CRITICAL_DOWNTIME: platformGraphAction.business('START_CRITICAL_DOWNTIME', navigationEvent),
      CLOSE_EMPLOYEE_SHIFT: platformGraphAction.business('FINISH_EMPLOYEE_SHIFT_BY_MANAGER', navigationEvent),
      FINISH_PRODUCTION_BLOCKER: platformGraphAction.business('FINISH_PRODUCTION', navigationEvent),
      FINISH_BREAK_BLOCKER: platformGraphAction.business('FINISH_BREAK', navigationEvent),
      FINISH_ADDITIONAL_WORK: platformGraphAction.business('FINISH_ADDITIONAL_WORK', navigationEvent),
      APPROVE_ADDITIONAL_WORK: platformGraphAction.business('APPROVE_ADDITIONAL_WORK_REQUEST', navigationEvent),
      REJECT_ADDITIONAL_WORK: platformGraphAction.business('REJECT_ADDITIONAL_WORK_REQUEST', navigationEvent),
      CANCEL_ADDITIONAL_WORK: platformGraphAction.business('CANCEL_ADDITIONAL_WORK', navigationEvent),
      ASSIGN_ADDITIONAL_WORK: platformGraphAction.business('ASSIGN_ADDITIONAL_WORK', navigationEvent),
      ACCRUE_ADDITIONAL_WORK: platformGraphAction.business('ACCRUE_ADDITIONAL_WORK_SALARY', navigationEvent),
      MARK_WITHOUT_ACCRUAL: platformGraphAction.business('MARK_WITHOUT_ACCRUAL', navigationEvent),
      CREATE_APPROVE_SALARY_CORRECTION: platformGraphAction.business('OPEN_CORRECTIONS', navigationEvent),
      REVERSE_SALARY_ENTRY: platformGraphAction.business('OPEN_CORRECTIONS', navigationEvent),
      CREATE_PRODUCTION_CORRECTION: platformGraphAction.business('OPEN_CORRECTIONS', navigationEvent),
      CREATE_GOOGLE_SHEETS_EXPORT: platformGraphAction.business('OPEN_REPORTS', navigationEvent),
    },
    presentation: {
      openMachines: platformGraphAction.presentation(emptyEvent),
      openMachineRunning: platformGraphAction.presentation(machineIdEvent),
      openMachineWarning: platformGraphAction.presentation(machineIdEvent),
      openMachineCritical: platformGraphAction.presentation(machineIdEvent),
      openMachineIdle: platformGraphAction.presentation(machineIdEvent),
      openOperationalDowntimeFinish: platformGraphAction.presentation(navigationEvent),
      back: platformGraphAction.presentation(emptyEvent),
      p1OpenEmployees: platformGraphAction.presentation(navigationEvent),
      p1OpenDowntimes: platformGraphAction.presentation(navigationEvent),
      p1OpenAdditionalWorks: platformGraphAction.presentation(navigationEvent),
      p1OpenCorrections: platformGraphAction.presentation(navigationEvent),
      p1OpenNotifications: platformGraphAction.presentation(navigationEvent),
      p1OpenReports: platformGraphAction.presentation(navigationEvent),
      p1OpenCriticalFinish: platformGraphAction.presentation(navigationEvent),
      p1OpenDowntimeStart: platformGraphAction.presentation(navigationEvent),
      p1ContinueCriticalFinish: platformGraphAction.presentation(navigationEvent),
      p1OpenDowntimeMachine: platformGraphAction.presentation(navigationEvent),
      p1SelectDowntimeTypeWithMachine: platformGraphAction.presentation(navigationEvent),
      p1SelectDowntimeTypeWithoutMachine: platformGraphAction.presentation(navigationEvent),
      p1SelectDowntimeMachineConflict: platformGraphAction.presentation(navigationEvent),
      p1SelectDowntimeMachine: platformGraphAction.presentation(navigationEvent),
      p1ContinueDowntimeStart: platformGraphAction.presentation(navigationEvent),
      p1BackToMain: platformGraphAction.presentation(navigationEvent),
      p1BackToMachineList: platformGraphAction.presentation(navigationEvent),
      p1BackToMachineCard: platformGraphAction.presentation(navigationEvent),
      p1BackToCriticalFinishForm: platformGraphAction.presentation(navigationEvent),
      p1BackToDowntimeList: platformGraphAction.presentation(navigationEvent),
      p1BackToDowntimeTypes: platformGraphAction.presentation(navigationEvent),
      p1BackToDowntimeMachines: platformGraphAction.presentation(navigationEvent),
      p1BackToDowntimeComment: platformGraphAction.presentation(navigationEvent),
      navigate0: platformGraphAction.presentation(navigationEvent),
      navigate1: platformGraphAction.presentation(navigationEvent),
      navigate2: platformGraphAction.presentation(navigationEvent),
      navigate3: platformGraphAction.presentation(navigationEvent),
      navigate4: platformGraphAction.presentation(navigationEvent),
      navigate5: platformGraphAction.presentation(navigationEvent),
      navigate6: platformGraphAction.presentation(navigationEvent),
      navigateBack0: platformGraphAction.presentation(navigationEvent),
      navigateBack1: platformGraphAction.presentation(navigationEvent),
    },
  });
}

function createInteractions(graph: ReturnType<typeof createGraph>, actions: ReturnType<typeof createActions>, apiClient: ApiClient) {
  const commands = createSection03BusinessCommands(apiClient);
  const scoped = graphInteractionsFor(graph, actions);
  const main = scoped.node('S03-N01');
  const list = scoped.node('S03-M01');
  const card = scoped.node('S03-M02');
  const confirm = scoped.node('S03-M03O');
  const criticalComment = scoped.node('S03-M03C');
  const criticalConfirm = scoped.node('S03-M04C');
  const downtimes = scoped.node('S03-D01');
  const downtimeTypes = scoped.node('S03-D10');
  const downtimeMachines = scoped.node('S03-D11');
  const downtimeComment = scoped.node('S03-D12');
  const downtimeConfirm = scoped.node('S03-D13');
  const eventContext = Object.fromEntries(
    SECTION03_CONTEXT_KEYS.map((field) => [field, graphInteraction.event(field)]),
  );
  const currentTransitionContext = Object.fromEntries(
    SECTION03_CONTEXT_KEYS.map((field) => [field, graphTransition.context(field)]),
  );
  const transitionTargets = (
    nodeId: Section03NodeId,
    actionId: Section03BusinessActionId,
  ): readonly [Section03NodeId, Section03NodeId, Section03NodeId] => {
    if (actionId === 'START_CRITICAL_DOWNTIME') return ['S03-N01', 'S03-N01', 'S03-N01'];
    if (
      (actionId === 'FINISH_PRODUCTION_BLOCKER' || actionId === 'FINISH_BREAK_BLOCKER') ||
      (actionId === 'FINISH_ADDITIONAL_WORK' && nodeId === 'S03-E17')
    ) return ['S03-E12', 'S03-E10', 'S03-E12'];
    if (actionId === 'FINISH_DOWNTIME') {
      return nodeId === 'S03-M03O'
        ? ['S03-D12', 'S03-M01', 'S03-M01']
        : ['S03-M01', 'S03-M01', 'S03-M01'];
    }
    if (actionId === 'CLOSE_EMPLOYEE_SHIFT') return ['S03-E01', 'S03-E01', 'S03-E01'];
    if (actionId === 'CREATE_APPROVE_SALARY_CORRECTION' || actionId === 'REVERSE_SALARY_ENTRY' || actionId === 'CREATE_PRODUCTION_CORRECTION') return ['S03-C00', 'S03-C00', 'S03-C00'];
    if (actionId === 'CREATE_GOOGLE_SHEETS_EXPORT') return ['S03-R14', 'S03-R14', 'S03-R14'];
    return ['S03-AW01', 'S03-AW01', 'S03-AW01'];
  };
  const createBusinessTransition = (
    nodeId: Section03NodeId,
    actionId: Section03BusinessActionId,
  ) => {
    const command = commands[actionId];
    const [primary, secondary, tertiary] = transitionTargets(nodeId, actionId);
    const context = actionId === 'START_CRITICAL_DOWNTIME'
      ? {}
      : actionId === 'CREATE_GOOGLE_SHEETS_EXPORT'
      ? { ...currentTransitionContext, export_run_id: graphTransition.entityId('export_run_id') }
      : currentTransitionContext;
    return defineGraphTransitions({
      graph,
      command,
      currentContext: graph.nodes[nodeId].context,
      transitions: {
        PRIMARY: { node: primary, context },
        SECONDARY: { node: secondary, context },
        TERTIARY: { node: tertiary, context },
      },
    } as never);
  };
  const finishDowntimeTransition = createBusinessTransition('S03-M03O', 'FINISH_DOWNTIME');
  const finishDowntimeInteractionCandidate = confirm.business({
    action: 'FINISH_DOWNTIME',
    availability: graphInteraction.availableActions('machine', 'machine', 'available_actions'),
    command: commands.FINISH_DOWNTIME,
    input: eventContext,
    transition: finishDowntimeTransition,
  } as never);
  const finishDowntimeInteraction = finishDowntimeInteractionCandidate as typeof finishDowntimeInteractionCandidate & Readonly<{ action: 'FINISH_DOWNTIME' }>;
  const established = {
    'S03-N01': main.define({ business: [], presentation: [
      main.presentation({ action: 'openMachines', effect: graphInteraction.navigate('S03-M01', {}) }),
      main.presentation({ action: 'navigate0', effect: graphInteraction.navigate('S03-M01', eventContext) }),
      main.presentation({ action: 'navigate1', effect: graphInteraction.navigate('S03-E01', eventContext) }),
      main.presentation({ action: 'navigate2', effect: graphInteraction.navigate('S03-D01', eventContext) }),
      main.presentation({ action: 'navigate3', effect: graphInteraction.navigate('S03-AW01', eventContext) }),
      main.presentation({ action: 'navigate4', effect: graphInteraction.navigate('S03-C00', eventContext) }),
      main.presentation({ action: 'navigate5', effect: graphInteraction.navigate('S03-NOT01', eventContext) }),
      main.presentation({ action: 'navigate6', effect: graphInteraction.navigate('S03-R01', eventContext) }),
      main.presentation({ action: 'navigateBack0', effect: graphInteraction.back() }),
      main.presentation({ action: 'navigateBack1', effect: graphInteraction.back() }),
      main.presentation({ action: 'p1OpenEmployees', effect: graphInteraction.navigate('S03-E01', eventContext) }),
      main.presentation({ action: 'p1OpenDowntimes', effect: graphInteraction.navigate('S03-D01', eventContext) }),
      main.presentation({ action: 'p1OpenAdditionalWorks', effect: graphInteraction.navigate('S03-AW01', eventContext) }),
      main.presentation({ action: 'p1OpenCorrections', effect: graphInteraction.navigate('S03-C00', eventContext) }),
      main.presentation({ action: 'p1OpenNotifications', effect: graphInteraction.navigate('S03-NOT01', eventContext) }),
      main.presentation({ action: 'p1OpenReports', effect: graphInteraction.navigate('S03-R01', eventContext) }),
    ] }),
    'S03-M01': list.define({ business: [], presentation: [
      list.presentation({ action: 'openMachineRunning', effect: graphInteraction.navigate('S03-M02', { machine_id: graphInteraction.event('machine_id') }) }),
      list.presentation({ action: 'openMachineWarning', effect: graphInteraction.navigate('S03-M02', { machine_id: graphInteraction.event('machine_id') }) }),
      list.presentation({ action: 'openMachineCritical', effect: graphInteraction.navigate('S03-M02', { machine_id: graphInteraction.event('machine_id') }) }),
      list.presentation({ action: 'openMachineIdle', effect: graphInteraction.navigate('S03-M02', { machine_id: graphInteraction.event('machine_id') }) }),
      list.presentation({ action: 'back', effect: graphInteraction.back() }),
      list.presentation({ action: 'p1BackToMain', effect: graphInteraction.back() }),
    ] }),
    'S03-M02': card.define({ business: [], presentation: [
      card.presentation({ action: 'openOperationalDowntimeFinish', effect: graphInteraction.navigate('S03-M03O', { ...eventContext, machine_id: graphInteraction.context('machine_id') }) }),
      card.presentation({ action: 'navigate0', effect: graphInteraction.navigate('S03-M03C', eventContext) }),
      card.presentation({ action: 'navigate1', effect: graphInteraction.navigate('S03-D10', eventContext) }),
      card.presentation({ action: 'back', effect: graphInteraction.back() }),
      card.presentation({ action: 'p1OpenCriticalFinish', effect: graphInteraction.navigate('S03-M03C', eventContext) }),
      card.presentation({ action: 'p1OpenDowntimeStart', effect: graphInteraction.navigate('S03-D10', eventContext) }),
      card.presentation({ action: 'p1BackToMachineList', effect: graphInteraction.back() }),
      card.presentation({ action: 'p1BackToDowntimeList', effect: graphInteraction.back() }),
    ] }),
    'S03-M03O': confirm.define({ business: [finishDowntimeInteraction], presentation: [
      confirm.presentation({ action: 'back', effect: graphInteraction.back() }),
      confirm.presentation({ action: 'p1BackToMachineCard', effect: graphInteraction.back() }),
    ] }),
    'S03-M03C': criticalComment.define({ business: [], presentation: [
      criticalComment.presentation({ action: 'p1ContinueCriticalFinish', effect: graphInteraction.navigate('S03-M04C', eventContext) }),
      criticalComment.presentation({ action: 'p1BackToMachineCard', effect: graphInteraction.back() }),
    ] }),
    'S03-M04C': criticalConfirm.define({ business: [criticalConfirm.business({
      action: 'FINISH_DOWNTIME', availability: graphInteraction.availableActions('nodeData', 'availableActions'),
      command: commands.FINISH_DOWNTIME, input: eventContext,
      transition: createBusinessTransition('S03-M04C', 'FINISH_DOWNTIME'),
    } as never)], presentation: [
      criticalConfirm.presentation({ action: 'p1BackToCriticalFinishForm', effect: graphInteraction.back() }),
    ] }),
    'S03-D01': downtimes.define({ business: [], presentation: [
      downtimes.presentation({ action: 'p1OpenDowntimeMachine', effect: graphInteraction.navigate('S03-M02', eventContext) }),
      downtimes.presentation({ action: 'p1OpenDowntimeStart', effect: graphInteraction.navigate('S03-D10', eventContext) }),
      downtimes.presentation({ action: 'p1BackToMain', effect: graphInteraction.back() }),
    ] }),
    'S03-D10': downtimeTypes.define({ business: [], presentation: [
      downtimeTypes.presentation({ action: 'p1SelectDowntimeTypeWithMachine', effect: graphInteraction.navigate('S03-D12', eventContext) }),
      downtimeTypes.presentation({ action: 'p1SelectDowntimeTypeWithoutMachine', effect: graphInteraction.navigate('S03-D11', eventContext) }),
      downtimeTypes.presentation({ action: 'p1BackToMachineCard', effect: graphInteraction.back() }),
      downtimeTypes.presentation({ action: 'p1BackToDowntimeList', effect: graphInteraction.back() }),
    ] }),
    'S03-D11': downtimeMachines.define({ business: [], presentation: [
      downtimeMachines.presentation({ action: 'p1SelectDowntimeMachineConflict', effect: graphInteraction.navigate('S03-M03O', eventContext) }),
      downtimeMachines.presentation({ action: 'p1SelectDowntimeMachine', effect: graphInteraction.navigate('S03-D12', eventContext) }),
      downtimeMachines.presentation({ action: 'p1BackToDowntimeTypes', effect: graphInteraction.back() }),
    ] }),
    'S03-D12': downtimeComment.define({ business: [], presentation: [
      downtimeComment.presentation({ action: 'p1ContinueDowntimeStart', effect: graphInteraction.navigate('S03-D13', eventContext) }),
      downtimeComment.presentation({ action: 'p1BackToDowntimeTypes', effect: graphInteraction.back() }),
      downtimeComment.presentation({ action: 'p1BackToDowntimeMachines', effect: graphInteraction.back() }),
    ] }),
    'S03-D13': downtimeConfirm.define({ business: [downtimeConfirm.business({
      action: 'START_CRITICAL_DOWNTIME', availability: graphInteraction.availableActions('nodeData', 'availableActions'),
      command: commands.START_CRITICAL_DOWNTIME, input: eventContext,
      transition: createBusinessTransition('S03-D13', 'START_CRITICAL_DOWNTIME'),
    } as never)], presentation: [
      downtimeConfirm.presentation({ action: 'p1BackToDowntimeComment', effect: graphInteraction.back() }),
    ] }),
  } as const;
  type EstablishedInteractionNode = keyof typeof established;
  type AdditionalInteractionNode = Exclude<Section03NodeId, EstablishedInteractionNode>;
  const establishedIds = new Set<string>(Object.keys(established));
  const navigationActions = ['navigate0', 'navigate1', 'navigate2', 'navigate3', 'navigate4', 'navigate5', 'navigate6'] as const;
  const additionalEntries = SECTION03_NODE_IDS
    .filter((nodeId): nodeId is AdditionalInteractionNode => !establishedIds.has(nodeId))
    .map((nodeId) => {
      const node = scoped.node(nodeId);
      const forward = SECTION03_FORWARD_TARGETS[nodeId].map((target, index) => node.presentation({
        action: navigationActions[index],
        effect: graphInteraction.navigate(target, eventContext),
      } as never));
      const back = [0, 1].map((index) => node.presentation({
        action: index === 0 ? 'navigateBack0' : 'navigateBack1',
        effect: graphInteraction.back(),
      } as never));
      const historyBack = [node.presentation({
        action: 'back',
        effect: graphInteraction.back(),
      } as never)];
      const business = SECTION03_BUSINESS_ACTIONS
        .filter((candidate) => candidate.nodes.includes(nodeId))
        .map((candidate) => node.business({
          action: candidate.actionId,
          availability: graphInteraction.availableActions('nodeData', 'availableActions'),
          command: commands[candidate.actionId],
          input: candidate.actionId === 'FINISH_DOWNTIME'
            ? {
                downtime_id: graphInteraction.event('downtime_id'),
                comment_finish: graphInteraction.event('comment_finish'),
              }
            : eventContext,
          transition: createBusinessTransition(nodeId, candidate.actionId),
        } as never));
      return [nodeId, node.define({ business, presentation: [...forward, ...back, ...historyBack] } as never)] as const;
    });
  type AdditionalInteractions = (typeof additionalEntries)[number][1];
  type AdditionalInteractionMap = Readonly<{
    [TNodeId in AdditionalInteractionNode]: AdditionalInteractions & Readonly<{ node: TNodeId }>;
  }>;
  const additional = Object.fromEntries(additionalEntries) as AdditionalInteractionMap;
  return { ...established, ...additional };
}

export function createSection03Program(apiClient: ApiClient) {
  const graph = createGraph(apiClient);
  const actions = createActions();
  const interactions = createInteractions(graph, actions, apiClient) satisfies GraphProgramInteractionMap<typeof graph, typeof actions>;
  return defineGraphProgram({ graph, actions, interactions });
}

export type Section03Program = ReturnType<typeof createSection03Program>;
