import type {
  PeaksActionButtonSize,
  PeaksActionButtonVariant,
  PeaksListButtonVariant,
} from '../graphRenderer';

import {
  GraphScalarDataValidationError,
  defineGraphContext,
  graphContext,
  parseGraphScalarData,
  type GraphContextSchema,
  type InferGraphContext,
} from './context';

export type GraphActionButtonVisual = Readonly<{
  kind: 'action-button';
  label: string;
  icon: string;
  variant: PeaksActionButtonVariant;
  size: PeaksActionButtonSize;
  showIcon: boolean;
}>;

export type GraphListButtonVisual = Readonly<{
  kind: 'list-button';
  variant: PeaksListButtonVariant;
}>;

export type GraphActionVisual =
  | GraphActionButtonVisual
  | GraphListButtonVisual;

export type GraphActionEventSchema = GraphContextSchema;

export type InferGraphActionEvent<
  TSchema extends GraphActionEventSchema,
> = InferGraphContext<TSchema>;

export type GraphLegacyBusinessActionDefinition<
  TAvailableAction extends string = string,
  TEventSchema extends GraphActionEventSchema = GraphActionEventSchema,
  TVisual extends GraphActionVisual = GraphActionVisual,
> = Readonly<{
  class: 'business';
  availableAction: TAvailableAction;
  eventSchema: TEventSchema;
  visual: TVisual;
}>;

export type GraphLegacyPresentationActionDefinition<
  TEventSchema extends GraphActionEventSchema = GraphActionEventSchema,
  TVisual extends GraphActionVisual = GraphActionVisual,
> = Readonly<{
  class: 'presentation';
  eventSchema: TEventSchema;
  visual: TVisual;
}>;

export type GraphPlatformBusinessActionDefinition<
  TAvailableAction extends string = string,
  TEventSchema extends GraphActionEventSchema = GraphActionEventSchema,
> = Readonly<{
  class: 'business';
  availableAction: TAvailableAction;
  eventSchema: TEventSchema;
  visual?: never;
}>;

export type GraphPlatformPresentationActionDefinition<
  TEventSchema extends GraphActionEventSchema = GraphActionEventSchema,
> = Readonly<{
  class: 'presentation';
  eventSchema: TEventSchema;
  visual?: never;
}>;

export type GraphBusinessActionDefinition =
  | GraphLegacyBusinessActionDefinition
  | GraphPlatformBusinessActionDefinition;

export type GraphPresentationActionDefinition =
  | GraphLegacyPresentationActionDefinition
  | GraphPlatformPresentationActionDefinition;

export type GraphActionDefinition =
  | GraphBusinessActionDefinition
  | GraphPresentationActionDefinition;

export type GraphBusinessActionMap = Readonly<
  Record<string, GraphBusinessActionDefinition>
>;

export type GraphPresentationActionMap = Readonly<
  Record<string, GraphPresentationActionDefinition>
>;

export type GraphLegacyBusinessActionMap = Readonly<
  Record<string, GraphLegacyBusinessActionDefinition>
>;

export type GraphLegacyPresentationActionMap = Readonly<
  Record<string, GraphLegacyPresentationActionDefinition>
>;

export type GraphPlatformBusinessActionMap = Readonly<
  Record<string, GraphPlatformBusinessActionDefinition>
>;

export type GraphPlatformPresentationActionMap = Readonly<
  Record<string, GraphPlatformPresentationActionDefinition>
>;

export const GRAPH_ACTION_PRESENTATION_MODES = Object.freeze([
  'legacy-visual',
  'platform-authority',
] as const);

export type GraphActionPresentationMode =
  typeof GRAPH_ACTION_PRESENTATION_MODES[number];

declare const graphActionRegistryBrand: unique symbol;

export type GraphActionRegistry<
  TBusiness extends GraphBusinessActionMap = GraphBusinessActionMap,
  TPresentation extends GraphPresentationActionMap = GraphPresentationActionMap,
  TMode extends GraphActionPresentationMode = GraphActionPresentationMode,
> = Readonly<{
  kind: 'graph-action-registry';
  presentationMode: TMode;
  business: TBusiness;
  presentation: TPresentation;
  readonly [graphActionRegistryBrand]: true;
}>;

export type GraphBusinessActionId<
  TRegistry extends GraphActionRegistry,
> = Extract<keyof TRegistry['business'], string>;

export type GraphPresentationActionId<
  TRegistry extends GraphActionRegistry,
> = Extract<keyof TRegistry['presentation'], string>;

type NoActionIdOverlap<
  TBusiness extends GraphBusinessActionMap,
  TPresentation extends GraphPresentationActionMap,
> = Extract<keyof TBusiness, keyof TPresentation> extends never
  ? unknown
  : never;

type NonEmptyActionRegistry<
  TBusiness extends GraphBusinessActionMap,
  TPresentation extends GraphPresentationActionMap,
> = keyof TBusiness | keyof TPresentation extends never ? never : unknown;

function freezeActionVisual<TVisual extends GraphActionVisual>(
  visual: TVisual,
): TVisual {
  return Object.freeze({ ...visual }) as TVisual;
}

function freezeEventSchema<
  TSchema extends GraphActionEventSchema,
>(
  schema: TSchema,
): TSchema {
  return Object.freeze({ ...schema }) as TSchema;
}

type GraphActionEventSchemaGuard<TSchema> = 0 extends 1 & TSchema
  ? [forbiddenUnboundedEventSchema: never]
  : unknown extends TSchema
    ? [forbiddenUnboundedEventSchema: never]
    : [];

export class GraphActionEventValidationError extends Error {
  readonly field: string | null;

  constructor(message: string, field: string | null = null) {
    super(message);
    this.name = 'GraphActionEventValidationError';
    this.field = field;
  }
}

export const graphActionEvent = graphContext;

export function defineGraphActionEvent<
  const TSchema extends GraphActionEventSchema,
>(
  schema: TSchema,
  ..._guard: GraphActionEventSchemaGuard<TSchema>
): TSchema {
  return defineGraphContext(schema);
}

export function parseGraphActionEvent<
  const TSchema extends GraphActionEventSchema,
>(
  schema: TSchema,
  input: unknown,
): InferGraphActionEvent<TSchema> {
  try {
    return parseGraphScalarData(
      schema,
      input,
      Object.freeze({
        container: 'Graph action event',
        field: 'graph action event',
      }),
    );
  } catch (error: unknown) {
    if (error instanceof GraphScalarDataValidationError) {
      throw new GraphActionEventValidationError(
        error.message,
        error.field,
      );
    }

    throw error;
  }
}

export const graphAction = Object.freeze({
  actionButton(
    visual: Readonly<{
      label: string;
      icon: string;
      variant: PeaksActionButtonVariant;
      size?: PeaksActionButtonSize;
      showIcon?: boolean;
    }>,
  ): GraphActionButtonVisual {
    return Object.freeze({
      kind: 'action-button',
      label: visual.label,
      icon: visual.icon,
      variant: visual.variant,
      size: visual.size ?? 'main70',
      showIcon: visual.showIcon ?? true,
    });
  },

  listButton(
    visual: Readonly<{
      variant: PeaksListButtonVariant;
    }>,
  ): GraphListButtonVisual {
    return Object.freeze({
      kind: 'list-button',
      variant: visual.variant,
    });
  },

  business<
    const TAvailableAction extends string,
    const TEventSchema extends GraphActionEventSchema,
    const TVisual extends GraphActionVisual,
  >(
    availableAction: TAvailableAction,
    eventSchema: TEventSchema,
    visual: TVisual,
  ): GraphLegacyBusinessActionDefinition<
    TAvailableAction,
    TEventSchema,
    TVisual
  > {
    return Object.freeze({
      class: 'business',
      availableAction,
      eventSchema: freezeEventSchema(eventSchema),
      visual: freezeActionVisual(visual),
    });
  },

  presentation<
    const TEventSchema extends GraphActionEventSchema,
    const TVisual extends GraphActionVisual,
  >(
    eventSchema: TEventSchema,
    visual: TVisual,
  ): GraphLegacyPresentationActionDefinition<TEventSchema, TVisual> {
    return Object.freeze({
      class: 'presentation',
      eventSchema: freezeEventSchema(eventSchema),
      visual: freezeActionVisual(visual),
    });
  },
});

export const platformGraphAction = Object.freeze({
  business<
    const TAvailableAction extends string,
    const TEventSchema extends GraphActionEventSchema,
  >(
    availableAction: TAvailableAction,
    eventSchema: TEventSchema,
  ): GraphPlatformBusinessActionDefinition<
    TAvailableAction,
    TEventSchema
  > {
    return Object.freeze({
      class: 'business',
      availableAction,
      eventSchema: freezeEventSchema(eventSchema),
    });
  },

  presentation<
    const TEventSchema extends GraphActionEventSchema,
  >(
    eventSchema: TEventSchema,
  ): GraphPlatformPresentationActionDefinition<TEventSchema> {
    return Object.freeze({
      class: 'presentation',
      eventSchema: freezeEventSchema(eventSchema),
    });
  },
});

function validateActionDefinitions(
  definitions: Readonly<{
    business: GraphBusinessActionMap;
    presentation: GraphPresentationActionMap;
  }>,
  presentationMode: GraphActionPresentationMode,
): void {
  for (const definition of [
    ...Object.values(definitions.business),
    ...Object.values(definitions.presentation),
  ]) {
    const hasVisual = Object.prototype.hasOwnProperty.call(
      definition,
      'visual',
    );

    if (presentationMode === 'legacy-visual' && !hasVisual) {
      throw new Error(
        'Legacy Graph action definitions must declare visual metadata.',
      );
    }

    if (presentationMode === 'platform-authority' && hasVisual) {
      throw new Error(
        'Platform Graph action definitions cannot declare visual metadata.',
      );
    }
  }
}

function defineGraphActionRegistry<
  const TBusiness extends GraphBusinessActionMap,
  const TPresentation extends GraphPresentationActionMap,
  const TMode extends GraphActionPresentationMode,
>(
  definitions: Readonly<{
    business: TBusiness;
    presentation: TPresentation;
  }>,
  presentationMode: TMode,
): GraphActionRegistry<TBusiness, TPresentation, TMode> {
  const businessEntries = Object.entries(definitions.business);
  const presentationEntries = Object.entries(definitions.presentation);

  if (businessEntries.length === 0 && presentationEntries.length === 0) {
    throw new Error(
      'Graph action registry must contain at least one semantic action.',
    );
  }

  const businessIds = new Set(
    businessEntries.map(([actionId]) => actionId),
  );

  for (const [actionId] of [
    ...businessEntries,
    ...presentationEntries,
  ]) {
    if (actionId.trim().length === 0) {
      throw new Error(
        'Graph semantic action IDs must be non-empty strings.',
      );
    }
  }

  for (const [actionId] of presentationEntries) {
    if (businessIds.has(actionId)) {
      throw new Error(
        `Graph semantic action ID "${actionId}" cannot be both business and presentation.`,
      );
    }
  }

  validateActionDefinitions(definitions, presentationMode);

  return Object.freeze({
    kind: 'graph-action-registry' as const,
    presentationMode,
    business: Object.freeze({ ...definitions.business }) as TBusiness,
    presentation: Object.freeze({
      ...definitions.presentation,
    }) as TPresentation,
  }) as GraphActionRegistry<TBusiness, TPresentation, TMode>;
}

export function defineGraphActions<
  const TBusiness extends GraphLegacyBusinessActionMap,
  const TPresentation extends GraphLegacyPresentationActionMap,
>(
  definitions: Readonly<{
    business: TBusiness;
    presentation: TPresentation;
  }> &
    NoActionIdOverlap<TBusiness, TPresentation> &
    NonEmptyActionRegistry<TBusiness, TPresentation>,
): GraphActionRegistry<TBusiness, TPresentation, 'legacy-visual'> {
  return defineGraphActionRegistry(definitions, 'legacy-visual');
}

export function definePlatformGraphActions<
  const TBusiness extends GraphPlatformBusinessActionMap,
  const TPresentation extends GraphPlatformPresentationActionMap,
>(
  definitions: Readonly<{
    business: TBusiness;
    presentation: TPresentation;
  }> &
    NoActionIdOverlap<TBusiness, TPresentation> &
    NonEmptyActionRegistry<TBusiness, TPresentation>,
): GraphActionRegistry<TBusiness, TPresentation, 'platform-authority'> {
  return defineGraphActionRegistry(definitions, 'platform-authority');
}

export type GraphActionInstanceCommonInput = Readonly<{
  instanceId?: string;
  ariaLabel?: string;
}>;

export type GraphActionInstanceInput<
  TDefinition extends GraphActionDefinition,
> = TDefinition extends GraphLegacyBusinessActionDefinition |
  GraphLegacyPresentationActionDefinition
  ? TDefinition['visual'] extends GraphListButtonVisual
    ? Readonly<
        GraphActionInstanceCommonInput & {
          mainLine: string;
          secondaryLine?: string;
        }
      >
    : GraphActionInstanceCommonInput
  : GraphActionInstanceCommonInput;

export type GraphActionInstanceEvent<
  TDefinition extends GraphActionDefinition,
> = InferGraphActionEvent<TDefinition['eventSchema']>;

export type GraphBusinessActionInstance<
  TActionId extends string,
  TDefinition extends GraphBusinessActionDefinition,
> = Readonly<{
  kind: 'business-action';
  actionId: TActionId;
  definition: TDefinition;
  input: GraphActionInstanceInput<TDefinition>;
  event: GraphActionInstanceEvent<TDefinition>;
}>;

export type GraphPresentationActionInstance<
  TActionId extends string,
  TDefinition extends GraphPresentationActionDefinition,
> = Readonly<{
  kind: 'presentation-action';
  actionId: TActionId;
  definition: TDefinition;
  input: GraphActionInstanceInput<TDefinition>;
  event: GraphActionInstanceEvent<TDefinition>;
}>;

export function graphActionInstancesFor<
  const TBusiness extends GraphBusinessActionMap,
  const TPresentation extends GraphPresentationActionMap,
>(
  registry: GraphActionRegistry<TBusiness, TPresentation>,
) {
  return Object.freeze({
    business<const TActionId extends Extract<keyof TBusiness, string>>(
      actionId: TActionId,
      input: GraphActionInstanceInput<TBusiness[TActionId]>,
      event: GraphActionInstanceEvent<TBusiness[TActionId]>,
    ): GraphBusinessActionInstance<TActionId, TBusiness[TActionId]> {
      const definition = registry.business[actionId];

      return Object.freeze({
        kind: 'business-action',
        actionId,
        definition,
        input: Object.freeze({ ...input }) as GraphActionInstanceInput<
          TBusiness[TActionId]
        >,
        event: parseGraphActionEvent(
          definition.eventSchema,
          event,
        ) as GraphActionInstanceEvent<TBusiness[TActionId]>,
      });
    },

    presentation<
      const TActionId extends Extract<keyof TPresentation, string>,
    >(
      actionId: TActionId,
      input: GraphActionInstanceInput<TPresentation[TActionId]>,
      event: GraphActionInstanceEvent<TPresentation[TActionId]>,
    ): GraphPresentationActionInstance<
      TActionId,
      TPresentation[TActionId]
    > {
      const definition = registry.presentation[actionId];

      return Object.freeze({
        kind: 'presentation-action',
        actionId,
        definition,
        input: Object.freeze({ ...input }) as GraphActionInstanceInput<
          TPresentation[TActionId]
        >,
        event: parseGraphActionEvent(
          definition.eventSchema,
          event,
        ) as GraphActionInstanceEvent<TPresentation[TActionId]>,
      });
    },
  });
}
