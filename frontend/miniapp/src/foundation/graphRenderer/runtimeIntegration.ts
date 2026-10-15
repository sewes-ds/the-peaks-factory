import {
  GraphBusinessExecutionError,
  GraphInteractionPlanningError,
  GraphNodeActionFactoryError,
  createGraphReadyBusinessExecutionRuntime,
  createGraphReadyInteractionPlanner,
  type GraphActivationNodeId,
  type GraphActivationProgram,
  type GraphActivationReadyState,
  type GraphActivationRuntime,
  type GraphBusinessExecutionResult,
  type GraphBusinessInteractionPlanFor,
  type GraphPresentationExecutionResult,
  type GraphPresentationExecutionRuntime,
  type GraphPresentationInteractionPlan,
  type GraphReadyBusinessExecutionRuntime,
  type GraphReadyInteractionPlanner,
  type GraphReadyNodeActionFactory,
  type GraphRuntimeBusinessInteractionActionId,
  type GraphRuntimeInteractionNodeId,
  type GraphRuntimePresentationInteractionActionId,
} from '../graphRuntime';
import type {
  GraphBusinessActionDefinition,
  GraphBusinessActionInstance,
  GraphPresentationActionDefinition,
  GraphPresentationActionInstance,
} from '../graphProtocol/action';
import type {
  PeaksActionButtonSize,
  PeaksActionButtonVariant,
  PeaksListButtonVariant,
} from './PeaksActionButton';
import type {
  PeaksGraphCardTone,
  PeaksGraphInfoTone,
  PeaksGraphListLine,
  PeaksGraphNodeView,
  PeaksGraphObject,
} from './PeaksGraphNodeRenderer';

export type PeaksGraphRuntimeInfoTextItem = Readonly<{
  kind: 'info-text';
  id: string;
  text: string;
  tone?: PeaksGraphInfoTone;
}>;

export type PeaksGraphRuntimeProductionOperationCardItem = Readonly<{
  kind: 'production-operation-card';
  id: string;
  title: string;
  lines: readonly Readonly<{
    label: string;
    value: string;
  }>[];
  tone?: PeaksGraphCardTone;
}>;

export type PeaksGraphRuntimeMessageItem = Readonly<{
  kind: 'message';
  id: string;
  text: string;
}>;

/** A deliberately non-semantic, visually disabled list button. */
export type PeaksGraphRuntimeInertListButtonItem = Readonly<{
  kind: 'inert-list-button';
  id: string;
  actionId: string;
  mainLine: string;
  secondaryLine?: string;
  variant: PeaksListButtonVariant;
  disabled: true;
  ariaLabel?: string;
  className?: string;
}>;

export type PeaksGraphRuntimeInertItem =
  | PeaksGraphRuntimeInfoTextItem
  | PeaksGraphRuntimeProductionOperationCardItem
  | PeaksGraphRuntimeMessageItem
  | PeaksGraphRuntimeInertListButtonItem;

type PeaksGraphRuntimeBusinessActionItem<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = {
  [TActionId in GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >]: GraphBusinessActionInstance<
    TActionId,
    Extract<
      TProgram['actions']['business'][TActionId],
      GraphBusinessActionDefinition
    >
  >;
}[GraphRuntimeBusinessInteractionActionId<TProgram, TNodeId>];

type PeaksGraphRuntimePresentationActionItem<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = {
  [TActionId in GraphRuntimePresentationInteractionActionId<
    TProgram,
    TNodeId
  >]: GraphPresentationActionInstance<
    TActionId,
    Extract<
      TProgram['actions']['presentation'][TActionId],
      GraphPresentationActionDefinition
    >
  >;
}[GraphRuntimePresentationInteractionActionId<TProgram, TNodeId>];

export type PeaksGraphRuntimeActionItem<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> =
  | PeaksGraphRuntimeBusinessActionItem<TProgram, TNodeId>
  | PeaksGraphRuntimePresentationActionItem<TProgram, TNodeId>;

export type PeaksGraphRuntimeViewItem<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> =
  | PeaksGraphRuntimeInertItem
  | PeaksGraphRuntimeActionItem<TProgram, TNodeId>;

export type PeaksGraphRuntimeListButtonLineDecoration = Readonly<{
  renderId: string;
  lines: readonly PeaksGraphListLine[];
}>;

export type PeaksGraphRuntimeViewProjection<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Readonly<{
  ariaLabel?: string;
  className?: string;
  listButtonLineDecorations?: readonly PeaksGraphRuntimeListButtonLineDecoration[];
  focusOnEntry?: boolean;
  liveStatus?: string;
  fixedTopItems?: readonly PeaksGraphRuntimeViewItem<TProgram, TNodeId>[];
  scrollItems: readonly PeaksGraphRuntimeViewItem<TProgram, TNodeId>[];
  fixedBottomItems?: readonly PeaksGraphRuntimeViewItem<TProgram, TNodeId>[];
}>;

export type PeaksGraphReadyNodeCreateViewOptions = Readonly<{
  interactionPending: boolean;
}>;

export type PeaksGraphReadyNodeBindingErrorPhase =
  | 'binding-creation'
  | 'view-projection'
  | 'action-acceptance';

export type PeaksGraphReadyNodeBindingErrorCode =
  | 'RUNTIME_NOT_READY'
  | 'NODE_MISMATCH'
  | 'PRESENTATION_RUNTIME_MISMATCH'
  | 'PLATFORM_ACTIONS_REQUIRE_PRESENTATION_BRIDGE'
  | 'NODE_ACTIONS_UNAVAILABLE'
  | 'BINDING_NOT_CURRENT'
  | 'INVALID_RENDER_ID'
  | 'DUPLICATE_RENDER_ID'
  | 'INVALID_LIST_BUTTON_DECORATION'
  | 'DUPLICATE_LIST_BUTTON_DECORATION'
  | 'UNKNOWN_LIST_BUTTON_DECORATION_TARGET'
  | 'NON_LIST_BUTTON_DECORATION_TARGET'
  | 'ACTION_INSTANCE_NOT_OWNED'
  | 'ACTION_DESCRIPTION_FAILED'
  | 'ACTION_PLANNING_FAILED';

export class PeaksGraphReadyNodeBindingError extends Error {
  readonly code: PeaksGraphReadyNodeBindingErrorCode;
  readonly phase: PeaksGraphReadyNodeBindingErrorPhase;
  readonly activationId: number | null;
  readonly nodeId: string | null;
  readonly actionId: string | null;
  readonly renderId: string | null;
  readonly originalError: unknown;

  constructor(
    definition: Readonly<{
      code: PeaksGraphReadyNodeBindingErrorCode;
      phase: PeaksGraphReadyNodeBindingErrorPhase;
      message: string;
      activationId?: number;
      nodeId?: string;
      actionId?: string;
      renderId?: string;
      originalError?: unknown;
    }>,
  ) {
    super(definition.message);
    this.name = 'PeaksGraphReadyNodeBindingError';
    this.code = definition.code;
    this.phase = definition.phase;
    this.activationId = definition.activationId ?? null;
    this.nodeId = definition.nodeId ?? null;
    this.actionId = definition.actionId ?? null;
    this.renderId = definition.renderId ?? null;
    this.originalError = definition.originalError;
    Object.freeze(this);
  }
}

export type PeaksGraphReadyNodeBindingErrorResult = Readonly<{
  kind: 'binding-error';
  error: PeaksGraphReadyNodeBindingError;
}>;

export type PeaksGraphReadyNodeBusinessExecutionResult<
  TProgram extends GraphActivationProgram,
> = Readonly<{
  kind: 'business';
  result: GraphBusinessExecutionResult<GraphActivationNodeId<TProgram>>;
}>;

export type PeaksGraphReadyNodePresentationExecutionResult<
  TProgram extends GraphActivationProgram,
> = Readonly<{
  kind: 'presentation';
  result: GraphPresentationExecutionResult<GraphActivationNodeId<TProgram>>;
}>;

export type PeaksGraphReadyNodeExecutionResult<
  TProgram extends GraphActivationProgram,
> =
  | PeaksGraphReadyNodeBindingErrorResult
  | PeaksGraphReadyNodeBusinessExecutionResult<TProgram>
  | PeaksGraphReadyNodePresentationExecutionResult<TProgram>;

export type PeaksGraphInteractionPendingChange<
  TNodeId extends string,
> = Readonly<{
  status: 'pending';
  activationId: number;
  nodeId: TNodeId;
  actionClass: 'business' | 'presentation';
  actionId: string;
}>;

export type PeaksGraphInteractionSettledChange<
  TProgram extends GraphActivationProgram,
  TNodeId extends string,
> = Readonly<{
  status: 'settled';
  activationId: number;
  nodeId: TNodeId;
  actionClass: 'business' | 'presentation';
  actionId: string;
  result: PeaksGraphReadyNodeExecutionResult<TProgram>;
}>;

export type PeaksGraphInteractionStateChange<
  TProgram extends GraphActivationProgram,
  TNodeId extends string,
> =
  | PeaksGraphInteractionPendingChange<TNodeId>
  | PeaksGraphInteractionSettledChange<TProgram, TNodeId>;

export type PeaksGraphReadyNodeBindingDefinition<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Readonly<{
  runtime: GraphActivationRuntime<TProgram>;
  presentationExecution: GraphPresentationExecutionRuntime<TProgram>;
  nodeId: TNodeId;
  onInteractionStateChange: (
    change: PeaksGraphInteractionStateChange<TProgram, TNodeId>,
  ) => void;
}>;

type BusinessPlanForBinding<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = {
  [TActionId in GraphRuntimeBusinessInteractionActionId<
    TProgram,
    TNodeId
  >]: GraphBusinessInteractionPlanFor<TProgram, TNodeId, TActionId>;
}[GraphRuntimeBusinessInteractionActionId<TProgram, TNodeId>];

type PresentationPlanForBinding<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = GraphPresentationInteractionPlan<
  TNodeId,
  GraphRuntimePresentationInteractionActionId<TProgram, TNodeId>
>;

export type PeaksGraphReadyNodeBinding<
  TProgram extends GraphActivationProgram,
  TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
> = Readonly<{
  runtime: GraphActivationRuntime<TProgram>;
  ready: GraphActivationReadyState<TNodeId>;
  actionFactory: GraphReadyNodeActionFactory<TProgram, TNodeId>;
  planner: GraphReadyInteractionPlanner<TProgram, TNodeId>;
  businessExecution: GraphReadyBusinessExecutionRuntime<TProgram, TNodeId>;
  presentationExecution: GraphPresentationExecutionRuntime<TProgram>;
  createView: (
    projection: PeaksGraphRuntimeViewProjection<TProgram, TNodeId>,
    options: PeaksGraphReadyNodeCreateViewOptions,
  ) => PeaksGraphNodeView;
  execute: (
    instance: PeaksGraphRuntimeActionItem<TProgram, TNodeId>,
  ) => Promise<PeaksGraphReadyNodeExecutionResult<TProgram>>;
}>;

type RuntimeActionItem = Readonly<{
  kind: 'business-action' | 'presentation-action';
  actionId: string;
  definition: Readonly<{
    visual: Readonly<{
      kind: 'action-button' | 'list-button';
    }>;
  }>;
  input: Readonly<{
    instanceId?: string;
    ariaLabel?: string;
    mainLine?: string;
    secondaryLine?: string;
  }>;
  event: unknown;
}>;

type RuntimeActionIdentity = Readonly<{
  actionId: string;
  input: Readonly<{
    instanceId?: string;
  }>;
}>;

type RuntimeActionButtonItem = RuntimeActionItem & Readonly<{
  definition: Readonly<{
    visual: Readonly<{
      kind: 'action-button';
      label: string;
      icon: string;
      variant: PeaksActionButtonVariant;
      size: PeaksActionButtonSize;
      showIcon: boolean;
    }>;
  }>;
}>;

type RuntimeListButtonItem = RuntimeActionItem & Readonly<{
  definition: Readonly<{
    visual: Readonly<{
      kind: 'list-button';
      variant: PeaksListButtonVariant;
    }>;
  }>;
  input: Readonly<{
    instanceId?: string;
    ariaLabel?: string;
    mainLine: string;
    secondaryLine?: string;
  }>;
}>;

type ProductionOperationCardObject = PeaksGraphObject & Readonly<{
  kind: 'productionOperationCard';
  title: string;
}>;

const emptyObjects = Object.freeze([]) as readonly PeaksGraphObject[];

function bindingError(
  code: PeaksGraphReadyNodeBindingErrorCode,
  phase: PeaksGraphReadyNodeBindingErrorPhase,
  message: string,
  details: Readonly<{
    activationId?: number;
    nodeId?: string;
    actionId?: string;
    renderId?: string;
    originalError?: unknown;
  }> = Object.freeze({}),
): PeaksGraphReadyNodeBindingError {
  return new PeaksGraphReadyNodeBindingError({
    code,
    phase,
    message,
    ...details,
  });
}

function freezeBindingErrorResult(
  error: PeaksGraphReadyNodeBindingError,
): PeaksGraphReadyNodeBindingErrorResult {
  return Object.freeze({ kind: 'binding-error' as const, error });
}

function freezeBusinessResult<TProgram extends GraphActivationProgram>(
  result: GraphBusinessExecutionResult<GraphActivationNodeId<TProgram>>,
): PeaksGraphReadyNodeBusinessExecutionResult<TProgram> {
  return Object.freeze({ kind: 'business' as const, result });
}

function freezePresentationResult<
  TProgram extends GraphActivationProgram,
>(
  result: GraphPresentationExecutionResult<GraphActivationNodeId<TProgram>>,
): PeaksGraphReadyNodePresentationExecutionResult<TProgram> {
  return Object.freeze({ kind: 'presentation' as const, result });
}

function nodeActionsUnavailable(error: unknown): boolean {
  return (
    error instanceof GraphNodeActionFactoryError ||
    error instanceof GraphInteractionPlanningError ||
    error instanceof GraphBusinessExecutionError
  );
}

function actionDescriptionError(
  error: GraphNodeActionFactoryError,
): PeaksGraphReadyNodeBindingErrorCode {
  if (error.code === 'UNKNOWN_ACTION_INSTANCE') {
    return 'ACTION_INSTANCE_NOT_OWNED';
  }

  if (
    error.code === 'ACTIVATION_NOT_CURRENT' ||
    error.code === 'ACTIVATION_NOT_READY' ||
    error.code === 'ACTIVATION_NODE_MISMATCH'
  ) {
    return 'BINDING_NOT_CURRENT';
  }

  return 'ACTION_DESCRIPTION_FAILED';
}

function activationDetails<TNodeId extends string>(
  ready: GraphActivationReadyState<TNodeId>,
  actionId?: string,
): Readonly<{
  activationId: number;
  nodeId: TNodeId;
  actionId?: string;
}> {
  return Object.freeze({
    activationId: ready.activationId,
    nodeId: ready.nodeId,
    ...(actionId === undefined ? {} : { actionId }),
  });
}

function assertCurrentBinding<TNodeId extends string>(
  runtime: GraphActivationRuntime<GraphActivationProgram>,
  ready: GraphActivationReadyState<TNodeId>,
  phase: PeaksGraphReadyNodeBindingErrorPhase,
  actionId?: string,
): void {
  if (runtime.getState() !== ready) {
    throw bindingError(
      'BINDING_NOT_CURRENT',
      phase,
      'Peaks graph ready node binding is no longer current.',
      activationDetails(ready, actionId),
    );
  }
}

function resolveInertRenderId(
  item: PeaksGraphRuntimeInertItem,
  phase: PeaksGraphReadyNodeBindingErrorPhase,
  ready: GraphActivationReadyState<string>,
): string {
  const renderId = item.id.trim();
  if (renderId.length === 0) {
    throw bindingError(
      'INVALID_RENDER_ID',
      phase,
      'Peaks graph inert item render identity must be non-empty.',
      { activationId: ready.activationId, nodeId: ready.nodeId },
    );
  }
  if (item.kind === 'inert-list-button' && item.actionId.trim().length === 0) {
    throw bindingError(
      'INVALID_RENDER_ID',
      phase,
      'Peaks graph inert list button diagnostic action identity must be non-empty.',
      { activationId: ready.activationId, nodeId: ready.nodeId, renderId },
    );
  }
  return renderId;
}

function resolveActionRenderId(
  item: RuntimeActionIdentity,
  phase: PeaksGraphReadyNodeBindingErrorPhase,
  ready: GraphActivationReadyState<string>,
): string {
  const explicitId = item.input.instanceId;

  if (explicitId !== undefined) {
    const renderId = explicitId.trim();
    if (renderId.length === 0) {
      throw bindingError(
        'INVALID_RENDER_ID',
        phase,
        'Peaks graph action instance identity must be non-empty.',
        activationDetails(ready, item.actionId),
      );
    }
    return renderId;
  }

  const renderId = item.actionId.trim();
  if (renderId.length === 0) {
    throw bindingError(
      'INVALID_RENDER_ID',
      phase,
      'Peaks graph action render identity must be non-empty.',
      activationDetails(ready, item.actionId),
    );
  }
  return renderId;
}

function assertUniqueRenderId(
  renderIds: Set<string>,
  renderId: string,
  phase: PeaksGraphReadyNodeBindingErrorPhase,
  ready: GraphActivationReadyState<string>,
  actionId?: string,
): void {
  if (renderIds.has(renderId)) {
    throw bindingError(
      'DUPLICATE_RENDER_ID',
      phase,
      'Peaks graph view contains duplicate render identity.',
      { activationId: ready.activationId, nodeId: ready.nodeId, actionId, renderId },
    );
  }
  renderIds.add(renderId);
}

function freezeObjects(
  objects: readonly PeaksGraphObject[],
): PeaksGraphObject[] {
  return Object.freeze([...objects]) as PeaksGraphObject[];
}

export function createPeaksGraphReadyNodeBinding<
  const TProgram extends GraphActivationProgram,
  const TNodeId extends GraphRuntimeInteractionNodeId<TProgram>,
>(
  definition: PeaksGraphReadyNodeBindingDefinition<TProgram, TNodeId>,
): PeaksGraphReadyNodeBinding<TProgram, TNodeId> {
  if (definition.presentationExecution.runtime !== definition.runtime) {
    throw bindingError(
      'PRESENTATION_RUNTIME_MISMATCH',
      'binding-creation',
      'Presentation execution runtime must belong to the same graph activation runtime.',
      { nodeId: definition.nodeId },
    );
  }

  const current = definition.runtime.getState();
  if (current.status !== 'ready') {
    throw bindingError(
      'RUNTIME_NOT_READY',
      'binding-creation',
      'Peaks graph ready node binding requires current ready activation.',
      { nodeId: definition.nodeId },
    );
  }

  if (current.nodeId !== definition.nodeId) {
    throw bindingError(
      'NODE_MISMATCH',
      'binding-creation',
      'Current ready node does not match requested binding node.',
      {
        activationId: current.activationId,
        nodeId: current.nodeId,
      },
    );
  }

  const ready = current as GraphActivationReadyState<TNodeId>;
  let planner: GraphReadyInteractionPlanner<TProgram, TNodeId>;
  let businessExecution: GraphReadyBusinessExecutionRuntime<TProgram, TNodeId>;

  try {
    planner = createGraphReadyInteractionPlanner(
      definition.runtime,
      definition.nodeId,
    );
    businessExecution = createGraphReadyBusinessExecutionRuntime(
      definition.runtime,
      planner,
    );
  } catch (error: unknown) {
    if (nodeActionsUnavailable(error)) {
      throw bindingError(
        'NODE_ACTIONS_UNAVAILABLE',
        'binding-creation',
        'Current ready node does not expose a compatible interaction boundary.',
        {
          activationId: ready.activationId,
          nodeId: ready.nodeId,
          originalError: error,
        },
      );
    }
    throw error;
  }

  const actionFactory = planner.actions;

  const publishSettled = (
    actionClass: 'business' | 'presentation',
    actionId: string,
    result: PeaksGraphReadyNodeExecutionResult<TProgram>,
  ): void => {
    definition.onInteractionStateChange(
      Object.freeze({
        status: 'settled' as const,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
        actionClass,
        actionId,
        result,
      }),
    );
  };

  const execute = async (
    instance: PeaksGraphRuntimeActionItem<TProgram, TNodeId>,
  ): Promise<PeaksGraphReadyNodeExecutionResult<TProgram>> => {
    const runtimeInstance = instance as RuntimeActionItem;
    const actionClass =
      runtimeInstance.kind === 'business-action'
        ? 'business'
        : 'presentation';
    const actionId = runtimeInstance.actionId;

    if (definition.runtime.getState() !== ready) {
      const result = freezeBindingErrorResult(
        bindingError(
          'BINDING_NOT_CURRENT',
          'action-acceptance',
          'Peaks graph ready node binding is no longer current.',
          activationDetails(ready, actionId),
        ),
      );
      publishSettled(actionClass, actionId, result);
      return result;
    }

    let descriptor;
    try {
      descriptor = actionFactory.describe(runtimeInstance);
    } catch (error: unknown) {
      if (error instanceof GraphNodeActionFactoryError) {
        const result = freezeBindingErrorResult(
          bindingError(
            actionDescriptionError(error),
            'action-acceptance',
            'Peaks graph action instance was not accepted by the current action factory.',
            {
              activationId: ready.activationId,
              nodeId: ready.nodeId,
              actionId,
              originalError: error,
            },
          ),
        );
        publishSettled(actionClass, actionId, result);
        return result;
      }
      throw error;
    }

    let plan:
      | BusinessPlanForBinding<TProgram, TNodeId>
      | PresentationPlanForBinding<TProgram, TNodeId>;
    try {
      if (runtimeInstance.kind === 'business-action') {
        plan = planner.plan(
          instance as PeaksGraphRuntimeBusinessActionItem<TProgram, TNodeId>,
          descriptor,
        );
      } else {
        plan = planner.plan(
          instance as PeaksGraphRuntimePresentationActionItem<TProgram, TNodeId>,
          descriptor,
        );
      }
    } catch (error: unknown) {
      if (error instanceof GraphInteractionPlanningError) {
        const result = freezeBindingErrorResult(
          bindingError(
            'ACTION_PLANNING_FAILED',
            'action-acceptance',
            'Peaks graph action planning failed for the current binding.',
            {
              activationId: ready.activationId,
              nodeId: ready.nodeId,
              actionId,
              originalError: error,
            },
          ),
        );
        publishSettled(actionClass, actionId, result);
        return result;
      }
      throw error;
    }

    definition.onInteractionStateChange(
      Object.freeze({
        status: 'pending' as const,
        activationId: ready.activationId,
        nodeId: ready.nodeId,
        actionClass,
        actionId,
      }),
    );

    if (plan.kind === 'graph-business-interaction-plan') {
      const result = freezeBusinessResult<TProgram>(
        await businessExecution.execute(
          plan,
        ),
      );
      publishSettled(actionClass, actionId, result);
      return result;
    }

    const result = freezePresentationResult<TProgram>(
      await definition.presentationExecution.execute(
        planner,
        plan,
      ),
    );
    publishSettled(actionClass, actionId, result);
    return result;
  };

  const mapAction = (
    item: PeaksGraphRuntimeActionItem<TProgram, TNodeId>,
    renderId: string,
    options: PeaksGraphReadyNodeCreateViewOptions,
  ): PeaksGraphObject => {
    const runtimeItem = item as RuntimeActionItem;
    try {
      actionFactory.describe(runtimeItem);
    } catch (error: unknown) {
      if (error instanceof GraphNodeActionFactoryError) {
        throw bindingError(
          actionDescriptionError(error),
          'view-projection',
          'Peaks graph view action instance was not accepted by the current action factory.',
          {
            activationId: ready.activationId,
            nodeId: ready.nodeId,
            actionId: runtimeItem.actionId,
            renderId,
            originalError: error,
          },
        );
      }
      throw error;
    }

    if (runtimeItem.definition.visual.kind === 'action-button') {
      const actionItem = runtimeItem as RuntimeActionButtonItem;
      const visual = actionItem.definition.visual;
      return Object.freeze({
        kind: 'actionButton' as const,
        id: renderId,
        actionId: actionItem.actionId,
        label: visual.label,
        icon: visual.icon,
        variant: visual.variant,
        size: visual.size,
        showIcon: visual.showIcon,
        ariaLabel: actionItem.input.ariaLabel,
        disabled: options.interactionPending,
        onClick: () => {
          void execute(item);
        },
      });
    }

    const listItem = runtimeItem as RuntimeListButtonItem;
    return Object.freeze({
      kind: 'listButton' as const,
      id: renderId,
      actionId: listItem.actionId,
      mainLine: listItem.input.mainLine,
      secondaryLine: listItem.input.secondaryLine,
      variant: listItem.definition.visual.variant,
      ariaLabel: listItem.input.ariaLabel,
      disabled: options.interactionPending,
      onClick: () => {
        void execute(item);
      },
    });
  };

  const mapInert = (
    item: PeaksGraphRuntimeInertItem,
    renderId: string,
  ): PeaksGraphObject => {
    if (item.kind === 'inert-list-button') {
      return Object.freeze({
        kind: 'listButton' as const,
        id: renderId,
        actionId: item.actionId,
        mainLine: item.mainLine,
        secondaryLine: item.secondaryLine,
        variant: item.variant,
        disabled: true,
        ariaLabel: item.ariaLabel,
        className: item.className,
      });
    }

    if (item.kind === 'info-text') {
      return Object.freeze({
        kind: 'infoText' as const,
        id: renderId,
        text: item.text,
        tone: item.tone,
      });
    }

    if (item.kind === 'production-operation-card') {
      const lines = Object.freeze(
        item.lines.map((line) => Object.freeze({
          label: line.label,
          value: line.value,
        })),
      );
      return Object.freeze({
        kind: 'productionOperationCard' as const,
        id: renderId,
        title: item.title,
        lines,
        tone: item.tone,
      }) as ProductionOperationCardObject;
    }

    return Object.freeze({
      kind: 'messageText' as const,
      id: renderId,
      text: item.text,
    });
  };

  const mapRegion = (
    items: readonly PeaksGraphRuntimeViewItem<TProgram, TNodeId>[] | undefined,
    options: PeaksGraphReadyNodeCreateViewOptions,
    renderIds: Set<string>,
  ): PeaksGraphObject[] => {
    if (items === undefined) {
      return freezeObjects(emptyObjects);
    }

    const objects = items.map((item) => {
      if (
        item.kind === 'business-action' ||
        item.kind === 'presentation-action'
      ) {
        const renderId = resolveActionRenderId(item, 'view-projection', ready);
        assertUniqueRenderId(
          renderIds,
          renderId,
          'view-projection',
          ready,
          item.actionId,
        );
        return mapAction(item, renderId, options);
      }

      const renderId = resolveInertRenderId(item, 'view-projection', ready);
      assertUniqueRenderId(renderIds, renderId, 'view-projection', ready);
      return mapInert(item, renderId);
    });

    return freezeObjects(objects);
  };

  const applyListButtonLineDecorations = (
    decorations: readonly PeaksGraphRuntimeListButtonLineDecoration[] | undefined,
    regions: readonly PeaksGraphObject[][],
  ): readonly PeaksGraphObject[][] => {
    if (decorations === undefined || decorations.length === 0) {
      return regions;
    }

    const objectsById = new Map<string, PeaksGraphObject>();
    for (const region of regions) {
      for (const object of region) {
        if (object.id !== undefined) {
          objectsById.set(object.id, object);
        }
      }
    }

    const linesByRenderId = new Map<string, readonly PeaksGraphListLine[]>();
    for (const decoration of decorations) {
      const renderId = typeof decoration.renderId === 'string'
        ? decoration.renderId.trim()
        : '';
      if (renderId.length === 0 || !Array.isArray(decoration.lines)) {
        throw bindingError(
          'INVALID_LIST_BUTTON_DECORATION',
          'view-projection',
          'Peaks graph list button line decoration must have a non-empty render identity and lines array.',
          { activationId: ready.activationId, nodeId: ready.nodeId, renderId },
        );
      }
      if (linesByRenderId.has(renderId)) {
        throw bindingError(
          'DUPLICATE_LIST_BUTTON_DECORATION',
          'view-projection',
          'Peaks graph view contains duplicate list button line decoration identity.',
          { activationId: ready.activationId, nodeId: ready.nodeId, renderId },
        );
      }
      const target = objectsById.get(renderId);
      if (target === undefined) {
        throw bindingError(
          'UNKNOWN_LIST_BUTTON_DECORATION_TARGET',
          'view-projection',
          'Peaks graph list button line decoration target was not rendered.',
          { activationId: ready.activationId, nodeId: ready.nodeId, renderId },
        );
      }
      if (target.kind !== 'listButton') {
        throw bindingError(
          'NON_LIST_BUTTON_DECORATION_TARGET',
          'view-projection',
          'Peaks graph list button line decoration target must be a list button.',
          { activationId: ready.activationId, nodeId: ready.nodeId, renderId },
        );
      }
      const lines = decoration.lines.map((line) => {
        const candidate = line as Readonly<{ text?: unknown; tone?: unknown }>;
        if (
          typeof candidate.text !== 'string'
          || candidate.text.trim().length === 0
          || candidate.tone !== 'blue'
          && candidate.tone !== 'green'
          && candidate.tone !== 'yellow'
          && candidate.tone !== 'red'
          && candidate.tone !== 'gray'
        ) {
          throw bindingError(
            'INVALID_LIST_BUTTON_DECORATION',
            'view-projection',
            'Peaks graph list button line decoration contains an invalid line.',
            { activationId: ready.activationId, nodeId: ready.nodeId, renderId },
          );
        }
        return Object.freeze({ text: candidate.text, tone: candidate.tone }) as PeaksGraphListLine;
      });
      linesByRenderId.set(renderId, Object.freeze(lines));
    }

    return Object.freeze(regions.map((region) => freezeObjects(region.map((object) => {
      const lines = object.id === undefined ? undefined : linesByRenderId.get(object.id);
      if (lines === undefined) {
        return object;
      }
      if (object.kind !== 'listButton') {
        return object;
      }
      return Object.freeze({ ...object, secondaryLines: lines });
    }))));
  };

  const createView = (
    projection: PeaksGraphRuntimeViewProjection<TProgram, TNodeId>,
    options: PeaksGraphReadyNodeCreateViewOptions,
  ): PeaksGraphNodeView => {
    if (
      definition.runtime.program.actions.presentationMode !==
      'legacy-visual'
    ) {
      throw bindingError(
        'PLATFORM_ACTIONS_REQUIRE_PRESENTATION_BRIDGE',
        'view-projection',
        'Platform-authority Graph actions must render through the Presentation Graph Bridge.',
        { activationId: ready.activationId, nodeId: ready.nodeId },
      );
    }

    assertCurrentBinding(
      definition.runtime,
      ready,
      'view-projection',
    );
    const renderIds = new Set<string>();
    const fixedTopObjects = mapRegion(
      projection.fixedTopItems,
      options,
      renderIds,
    );
    const scrollObjects = mapRegion(
      projection.scrollItems,
      options,
      renderIds,
    );
    const fixedBottomObjects = mapRegion(
      projection.fixedBottomItems,
      options,
      renderIds,
    );

    const decoratedRegions = applyListButtonLineDecorations(
      projection.listButtonLineDecorations,
      [fixedTopObjects, scrollObjects, fixedBottomObjects],
    );

    return Object.freeze({
      nodeId: ready.nodeId,
      ariaLabel: projection.ariaLabel,
      className: projection.className,
      focusOnEntry: projection.focusOnEntry,
      liveStatus: projection.liveStatus,
      ariaBusy: options.interactionPending,
      fixedTopObjects: decoratedRegions[0],
      scrollObjects: decoratedRegions[1],
      fixedBottomObjects: decoratedRegions[2],
    }) as PeaksGraphNodeView;
  };

  return Object.freeze({
    runtime: definition.runtime,
    ready,
    actionFactory,
    planner,
    businessExecution,
    presentationExecution: definition.presentationExecution,
    createView,
    execute,
  });
}
