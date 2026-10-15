import {
  type GraphActionEventSchema,
  type GraphActionInstanceEvent,
  type GraphActionInstanceInput,
  type GraphActionRegistry,
  type GraphBusinessActionDefinition,
  type GraphBusinessActionId,
  type GraphBusinessActionInstance,
  type GraphBusinessActionMap,
  type GraphPresentationActionDefinition,
  type GraphPresentationActionId,
  type GraphPresentationActionInstance,
  type GraphPresentationActionMap,
} from './action';
import type {
  GraphCommandDefinition,
  GraphCommandEntitySchema,
  GraphCommandInputSchema,
} from './command';
import {
  GraphScalarDataValidationError,
  parseGraphScalarData,
  type GraphContextField,
  type GraphContextFieldKind,
  type GraphContextScalar,
  type GraphContextSchema,
} from './context';
import type {
  GraphDefinition,
  GraphNodeId,
  GraphNodeMap,
} from './definition';
import type { GraphTransitionDefinition } from './transition';

type GraphActionRegistryBoundary = GraphActionRegistry<
  GraphBusinessActionMap,
  GraphPresentationActionMap
>;

type GraphCommandDefinitionBoundary = GraphCommandDefinition<
  GraphCommandInputSchema,
  string,
  readonly [string, ...string[]],
  GraphCommandEntitySchema
>;

type GraphNodeContextSchema<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
> = TGraph['nodes'][TNodeId]['context'] extends infer TSchema
  ? TSchema extends GraphContextSchema
    ? TSchema
    : never
  : never;

type GraphNodeSources<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
> = TGraph['nodes'][TNodeId] extends Readonly<{
  kind: 'endpoint-backed';
  source: Readonly<{
    sourceBundle: Readonly<{
      sources: infer TSources;
    }>;
  }>;
}>
  ? TSources
  : never;

type GraphRequiredNodeSourceKey<TSources> = Extract<
  {
    [TKey in keyof TSources]-?: TSources[TKey] extends Readonly<{
      requirement: 'required';
    }>
      ? TKey
      : never;
  }[keyof TSources],
  string
>;

type GraphSourceValue<TSource> =
  TSource extends Readonly<{
    decode: (input: unknown) => infer TValue;
  }>
    ? TValue
    : never;

type GraphFieldValue<TField> =
  TField extends GraphContextField<
    infer TValue,
    boolean,
    GraphContextFieldKind
  >
    ? TValue
    : never;

type GraphFieldKind<TField> =
  TField extends GraphContextField<
    GraphContextScalar,
    boolean,
    infer TKind
  >
    ? TKind
    : never;

type GraphFieldOptional<TField> =
  TField extends GraphContextField<
    GraphContextScalar,
    infer TOptional,
    GraphContextFieldKind
  >
    ? TOptional
    : never;

type GraphRequiredFieldKeys<TSchema extends GraphContextSchema> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphContextField<
    GraphContextScalar,
    true,
    GraphContextFieldKind
  >
    ? never
    : TKey;
}[keyof TSchema];

type GraphOptionalFieldKeys<TSchema extends GraphContextSchema> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphContextField<
    GraphContextScalar,
    true,
    GraphContextFieldKind
  >
    ? TKey
    : never;
}[keyof TSchema];

type IsScalarFieldCompatible<
  TSourceField,
  TDestinationField,
> = GraphFieldKind<TSourceField> extends GraphFieldKind<TDestinationField>
  ? GraphFieldKind<TDestinationField> extends GraphFieldKind<TSourceField>
    ? GraphFieldOptional<TSourceField> extends true
      ? GraphFieldOptional<TDestinationField> extends true
        ? GraphFieldValue<TSourceField> extends GraphFieldValue<TDestinationField>
          ? true
          : false
        : false
      : GraphFieldValue<TSourceField> extends GraphFieldValue<TDestinationField>
        ? true
        : false
    : false
  : false;

type GraphCompatibleFieldKeys<
  TSourceSchema extends GraphContextSchema,
  TDestinationField,
> = Extract<
  {
    [TKey in keyof TSourceSchema]-?: IsScalarFieldCompatible<
      TSourceSchema[TKey],
      TDestinationField
    > extends true
      ? TKey
      : never;
  }[keyof TSourceSchema],
  string
>;

type GraphPathValue<
  TValue,
  TPath extends readonly string[],
> = TPath extends readonly [
  infer THead extends string,
  ...infer TTail extends readonly string[],
]
  ? THead extends keyof NonNullable<TValue>
    ? TTail extends readonly []
      ? NonNullable<TValue>[THead]
      : GraphPathValue<
          NonNullable<NonNullable<TValue>[THead]>,
          TTail
        >
    : never
  : TValue;

type GraphPathMayBeMissing<
  TValue,
  TPath extends readonly string[],
> = Extract<TValue, null | undefined> extends never
  ? TPath extends readonly [
      infer THead extends string,
      ...infer TTail extends readonly string[],
    ]
    ? THead extends keyof NonNullable<TValue>
      ? TTail extends readonly []
        ? Extract<
            NonNullable<TValue>[THead],
            null | undefined
          > extends never
          ? false
          : true
        : GraphPathMayBeMissing<
            NonNullable<TValue>[THead],
            TTail
          >
      : true
    : false
  : true;

export type GraphInteractionContextBinding<
  TField extends string = string,
> = Readonly<{
  source: 'context';
  field: TField;
}>;

export type GraphInteractionEventBinding<
  TField extends string = string,
> = Readonly<{
  source: 'event';
  field: TField;
}>;

export type GraphInteractionLiteralBinding<
  TValue extends GraphContextScalar = GraphContextScalar,
> = Readonly<{
  source: 'literal';
  value: TValue;
}>;

export type GraphAvailableActionsBinding<
  TSourceName extends string = string,
  TPath extends readonly string[] = readonly string[],
> = Readonly<{
  source: 'available-actions';
  sourceName: TSourceName;
  path: TPath;
}>;

export type GraphRequiredSourceIdBinding<
  TSourceName extends string = string,
  TPath extends readonly string[] = readonly string[],
> = Readonly<{
  source: 'node-source-id';
  sourceName: TSourceName;
  path: TPath;
  normalize: 'string';
  missing: 'reject';
}>;

export type GraphOptionalSourceIdBinding<
  TSourceName extends string = string,
  TPath extends readonly string[] = readonly string[],
> = Readonly<{
  source: 'node-source-id';
  sourceName: TSourceName;
  path: TPath;
  normalize: 'string';
  missing: 'omit';
}>;

export type GraphCommandInputBinding =
  | GraphInteractionContextBinding
  | GraphInteractionEventBinding
  | GraphRequiredSourceIdBinding
  | GraphOptionalSourceIdBinding;

export type GraphPresentationContextBinding =
  | GraphInteractionContextBinding
  | GraphInteractionEventBinding
  | GraphInteractionLiteralBinding;


type GraphAvailabilityBindingCompatibility<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TAvailableAction extends string,
  TBinding extends GraphAvailableActionsBinding,
  TSources = GraphNodeSources<TGraph, TNodeId>,
> = TBinding extends GraphAvailableActionsBinding<
  infer TSourceName,
  infer TPath
>
  ? TSourceName extends GraphRequiredNodeSourceKey<TSources>
    ? [
        GraphPathValue<
          GraphSourceValue<TSources[TSourceName]>,
          TPath
        >,
      ] extends [never]
      ? false
      : GraphPathMayBeMissing<
            GraphSourceValue<TSources[TSourceName]>,
            TPath
          > extends false
        ? NonNullable<
            GraphPathValue<
              GraphSourceValue<TSources[TSourceName]>,
              TPath
            >
          > extends readonly (infer TAction extends string)[]
          ? TAvailableAction extends TAction
            ? true
            : false
          : false
        : false
    : false
  : false;

type GraphAvailabilityBindingGuard<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TAvailableAction extends string,
  TBinding extends GraphAvailableActionsBinding,
> = GraphAvailabilityBindingCompatibility<
  TGraph,
  TNodeId,
  TAvailableAction,
  TBinding
> extends true
  ? unknown
  : Readonly<{
      invalidAvailabilityBinding: never;
    }>;

type GraphSourceIdBindingCompatibility<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TDestinationField,
  TBinding extends
    | GraphRequiredSourceIdBinding
    | GraphOptionalSourceIdBinding,
  TSources = GraphNodeSources<TGraph, TNodeId>,
> = TBinding extends Readonly<{
  sourceName: infer TSourceName extends string;
  path: infer TPath extends readonly string[];
  missing: infer TMissing extends 'reject' | 'omit';
}>
  ? TSourceName extends GraphRequiredNodeSourceKey<TSources>
    ? [
        GraphPathValue<
          GraphSourceValue<TSources[TSourceName]>,
          TPath
        >,
      ] extends [never]
      ? false
      : NonNullable<
            GraphPathValue<
              GraphSourceValue<TSources[TSourceName]>,
              TPath
            >
          > extends string | number
        ? GraphFieldKind<TDestinationField> extends 'id'
          ? string extends GraphFieldValue<TDestinationField>
            ? GraphPathMayBeMissing<
                GraphSourceValue<TSources[TSourceName]>,
                TPath
              > extends true
              ? TMissing extends 'omit'
                ? GraphFieldOptional<TDestinationField> extends true
                  ? true
                  : false
                : false
              : TMissing extends 'reject'
                ? true
                : false
            : false
          : false
        : false
    : false
  : false;

type GraphCommandBindingForField<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
  TDestinationField,
> =
  | GraphInteractionContextBinding<
      GraphCompatibleFieldKeys<
        GraphNodeContextSchema<TGraph, TNodeId>,
        TDestinationField
      >
    >
  | GraphInteractionEventBinding<
      GraphCompatibleFieldKeys<TEventSchema, TDestinationField>
    >
  | GraphRequiredSourceIdBinding
  | GraphOptionalSourceIdBinding;

export type GraphCommandInputProjection<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
  TInputSchema extends GraphCommandInputSchema,
> = Readonly<
  {
    [TKey in GraphRequiredFieldKeys<TInputSchema>]:
      GraphCommandBindingForField<
        TGraph,
        TNodeId,
        TEventSchema,
        TInputSchema[TKey]
      >;
  } & {
    [TKey in GraphOptionalFieldKeys<TInputSchema>]?:
      GraphCommandBindingForField<
        TGraph,
        TNodeId,
        TEventSchema,
        TInputSchema[TKey]
      >;
  }
>;


type GraphCommandBindingCompatibility<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
  TDestinationField,
  TBinding,
> = TBinding extends GraphInteractionContextBinding<infer TField>
  ? TField extends GraphCompatibleFieldKeys<
      GraphNodeContextSchema<TGraph, TNodeId>,
      TDestinationField
    >
    ? true
    : false
  : TBinding extends GraphInteractionEventBinding<infer TField>
    ? TField extends GraphCompatibleFieldKeys<
        TEventSchema,
        TDestinationField
      >
      ? true
      : false
    : TBinding extends
          | GraphRequiredSourceIdBinding
          | GraphOptionalSourceIdBinding
      ? GraphSourceIdBindingCompatibility<
          TGraph,
          TNodeId,
          TDestinationField,
          TBinding
        >
      : false;

type GraphInvalidCommandInputBindingKeys<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
  TInputSchema extends GraphCommandInputSchema,
  TInput extends GraphCommandInputProjection<
    TGraph,
    TNodeId,
    TEventSchema,
    TInputSchema
  >,
> = {
  [TKey in Extract<keyof TInput, keyof TInputSchema>]:
    GraphCommandBindingCompatibility<
      TGraph,
      TNodeId,
      TEventSchema,
      TInputSchema[TKey],
      Exclude<TInput[TKey], undefined>
    > extends true
      ? never
      : TKey;
}[Extract<keyof TInput, keyof TInputSchema>];

type GraphCommandInputProjectionGuard<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
  TInputSchema extends GraphCommandInputSchema,
  TInput extends GraphCommandInputProjection<
    TGraph,
    TNodeId,
    TEventSchema,
    TInputSchema
  >,
> = GraphInvalidCommandInputBindingKeys<
  TGraph,
  TNodeId,
  TEventSchema,
  TInputSchema,
  TInput
> extends never
  ? unknown
  : Readonly<{
      invalidCommandInputBinding: never;
    }>;

type GraphPresentationBindingForField<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
  TDestinationField,
> =
  | GraphInteractionContextBinding<
      GraphCompatibleFieldKeys<
        GraphNodeContextSchema<TGraph, TNodeId>,
        TDestinationField
      >
    >
  | GraphInteractionEventBinding<
      GraphCompatibleFieldKeys<TEventSchema, TDestinationField>
    >
  | GraphInteractionLiteralBinding<
      GraphFieldValue<TDestinationField>
    >;

export type GraphPresentationContextProjection<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
  TDestinationContext extends GraphContextSchema,
> = Readonly<
  {
    [TKey in GraphRequiredFieldKeys<TDestinationContext>]:
      GraphPresentationBindingForField<
        TGraph,
        TNodeId,
        TEventSchema,
        TDestinationContext[TKey]
      >;
  } & {
    [TKey in GraphOptionalFieldKeys<TDestinationContext>]?:
      GraphPresentationBindingForField<
        TGraph,
        TNodeId,
        TEventSchema,
        TDestinationContext[TKey]
      >;
  }
>;

export type GraphBackEffect = Readonly<{
  kind: 'back';
}>;

export type GraphNavigateEffect<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
> = {
  [TDestinationNodeId in GraphNodeId<TGraph>]: Readonly<{
    kind: 'navigate';
    node: TDestinationNodeId;
    context: GraphPresentationContextProjection<
      TGraph,
      TNodeId,
      TEventSchema,
      GraphNodeContextSchema<TGraph, TDestinationNodeId>
    >;
  }>;
}[GraphNodeId<TGraph>];

export type GraphPresentationEffect<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
  TEventSchema extends GraphActionEventSchema,
> =
  | GraphBackEffect
  | GraphNavigateEffect<TGraph, TNodeId, TEventSchema>;

export type GraphBusinessInteractionDefinition<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TRegistry extends GraphActionRegistryBoundary,
  TNodeId extends GraphNodeId<TGraph>,
  TActionId extends GraphBusinessActionId<TRegistry>,
  TCommand extends GraphCommandDefinitionBoundary,
  TAvailability extends GraphAvailableActionsBinding,
  TInput extends GraphCommandInputProjection<
    TGraph,
    TNodeId,
    TRegistry['business'][TActionId]['eventSchema'],
    TCommand['inputSchema']
  >,
> = Readonly<{
  kind: 'business-interaction';
  graph: TGraph;
  actions: TRegistry;
  node: TNodeId;
  action: TActionId;
  availability: TAvailability;
  command: TCommand;
  input: TInput;
  transition: GraphTransitionDefinition<
    TGraph,
    TCommand,
    GraphNodeContextSchema<TGraph, TNodeId>
  >;
}>;

export type GraphPresentationInteractionDefinition<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TRegistry extends GraphActionRegistryBoundary,
  TNodeId extends GraphNodeId<TGraph>,
  TActionId extends GraphPresentationActionId<TRegistry>,
> = Readonly<{
  kind: 'presentation-interaction';
  graph: TGraph;
  actions: TRegistry;
  node: TNodeId;
  action: TActionId;
  effect: GraphPresentationEffect<
    TGraph,
    TNodeId,
    TRegistry['presentation'][TActionId]['eventSchema']
  >;
}>;

type GraphBusinessInteractionBoundary<
  TGraph extends GraphDefinition<GraphNodeMap> = GraphDefinition<GraphNodeMap>,
  TRegistry extends GraphActionRegistryBoundary = GraphActionRegistryBoundary,
  TNodeId extends GraphNodeId<TGraph> = GraphNodeId<TGraph>,
> = Readonly<{
  kind: 'business-interaction';
  graph: TGraph;
  actions: TRegistry;
  node: TNodeId;
  action: string;
}>;

type GraphPresentationInteractionBoundary<
  TGraph extends GraphDefinition<GraphNodeMap> = GraphDefinition<GraphNodeMap>,
  TRegistry extends GraphActionRegistryBoundary = GraphActionRegistryBoundary,
  TNodeId extends GraphNodeId<TGraph> = GraphNodeId<TGraph>,
> = Readonly<{
  kind: 'presentation-interaction';
  graph: TGraph;
  actions: TRegistry;
  node: TNodeId;
  action: string;
}>;

type GraphBusinessInteractionMapFromTuple<
  TInteractions extends readonly GraphBusinessInteractionBoundary[],
> = Readonly<{
  [TInteraction in TInteractions[number] as TInteraction['action']]:
    TInteraction;
}>;

type GraphPresentationInteractionMapFromTuple<
  TInteractions extends readonly GraphPresentationInteractionBoundary[],
> = Readonly<{
  [TInteraction in TInteractions[number] as TInteraction['action']]:
    TInteraction;
}>;

declare const graphNodeInteractionsBrand: unique symbol;

export type GraphNodeInteractions<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TRegistry extends GraphActionRegistryBoundary,
  TNodeId extends GraphNodeId<TGraph>,
  TBusiness extends Readonly<Record<string, GraphBusinessInteractionBoundary>>,
  TPresentation extends Readonly<
    Record<string, GraphPresentationInteractionBoundary>
  >,
> = Readonly<{
  kind: 'graph-node-interactions';
  graph: TGraph;
  actions: TRegistry;
  node: TNodeId;
  business: TBusiness;
  presentation: TPresentation;
  readonly [graphNodeInteractionsBrand]: true;
}>;

export type GraphNodeInteractionsBoundary = GraphNodeInteractions<
  GraphDefinition<GraphNodeMap>,
  GraphActionRegistryBoundary,
  string,
  Readonly<Record<string, GraphBusinessInteractionBoundary>>,
  Readonly<Record<string, GraphPresentationInteractionBoundary>>
>;

export class GraphInteractionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphInteractionValidationError';
  }
}

export const graphInteraction = Object.freeze({
  context<const TField extends string>(
    field: TField,
  ): GraphInteractionContextBinding<TField> {
    return Object.freeze({
      source: 'context',
      field,
    });
  },

  event<const TField extends string>(
    field: TField,
  ): GraphInteractionEventBinding<TField> {
    return Object.freeze({
      source: 'event',
      field,
    });
  },

  literal<const TValue extends GraphContextScalar>(
    value: TValue,
  ): GraphInteractionLiteralBinding<TValue> {
    return Object.freeze({
      source: 'literal',
      value,
    });
  },

  availableActions<
    const TSourceName extends string,
    const TPath extends readonly [string, ...string[]],
  >(
    sourceName: TSourceName,
    ...path: TPath
  ): GraphAvailableActionsBinding<TSourceName, TPath> {
    return Object.freeze({
      source: 'available-actions',
      sourceName,
      path: Object.freeze([...path]) as unknown as TPath,
    });
  },

  sourceId<
    const TSourceName extends string,
    const TPath extends readonly [string, ...string[]],
  >(
    sourceName: TSourceName,
    ...path: TPath
  ): GraphRequiredSourceIdBinding<TSourceName, TPath> {
    return Object.freeze({
      source: 'node-source-id',
      sourceName,
      path: Object.freeze([...path]) as unknown as TPath,
      normalize: 'string',
      missing: 'reject',
    });
  },

  optionalSourceId<
    const TSourceName extends string,
    const TPath extends readonly [string, ...string[]],
  >(
    sourceName: TSourceName,
    ...path: TPath
  ): GraphOptionalSourceIdBinding<TSourceName, TPath> {
    return Object.freeze({
      source: 'node-source-id',
      sourceName,
      path: Object.freeze([...path]) as unknown as TPath,
      normalize: 'string',
      missing: 'omit',
    });
  },

  back(): GraphBackEffect {
    return Object.freeze({
      kind: 'back',
    });
  },

  navigate<
    const TNodeId extends string,
    const TContext extends Readonly<
      Record<string, GraphPresentationContextBinding>
    >,
  >(
    node: TNodeId,
    context: TContext,
  ): Readonly<{
    kind: 'navigate';
    node: TNodeId;
    context: TContext;
  }> {
    return Object.freeze({
      kind: 'navigate',
      node,
      context: Object.freeze({ ...context }),
    });
  },
});

function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw new GraphInteractionValidationError(
      `${label} must be a plain object.`,
    );
  }
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: ReadonlySet<string>,
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new GraphInteractionValidationError(
        `Unknown ${label} field "${key}".`,
      );
    }
  }
}

function validatePath(
  path: unknown,
  label: string,
): asserts path is readonly [string, ...string[]] {
  if (!Array.isArray(path) || path.length === 0) {
    throw new GraphInteractionValidationError(
      `${label} must be a non-empty field path.`,
    );
  }

  for (const segment of path) {
    if (
      typeof segment !== 'string' ||
      segment.trim().length === 0
    ) {
      throw new GraphInteractionValidationError(
        `${label} segments must be non-empty strings.`,
      );
    }
  }
}

function nodeSources(
  graph: GraphDefinition<GraphNodeMap>,
  node: string,
): Readonly<Record<string, unknown>> {
  const definition = graph.nodes[node];

  if (
    definition.kind !== 'endpoint-backed' ||
    !('sourceBundle' in definition.source)
  ) {
    throw new GraphInteractionValidationError(
      `Business interactions require endpoint-backed node "${node}".`,
    );
  }

  const sourceContract = definition.source as unknown as Readonly<{
    sourceBundle: Readonly<{
      sources: Readonly<Record<string, unknown>>;
    }>;
  }>;

  return sourceContract.sourceBundle.sources;
}

function requiredNodeSource(
  graph: GraphDefinition<GraphNodeMap>,
  node: string,
  sourceName: unknown,
): Readonly<{
  requirement: 'required';
}> {
  if (typeof sourceName !== 'string') {
    throw new GraphInteractionValidationError(
      'Graph interaction sourceName must be a string.',
    );
  }

  const sources = nodeSources(graph, node);
  const source = sources[sourceName];

  if (!isPlainRecord(source)) {
    throw new GraphInteractionValidationError(
      `Unknown graph interaction node source "${sourceName}".`,
    );
  }

  if (source.requirement !== 'required') {
    throw new GraphInteractionValidationError(
      `Graph interaction node source "${sourceName}" must be required.`,
    );
  }

  return source as Readonly<{
    requirement: 'required';
  }>;
}

function validateAvailability(
  graph: GraphDefinition<GraphNodeMap>,
  node: string,
  binding: unknown,
): void {
  assertPlainRecord(binding, 'Graph interaction availability binding');
  assertExactKeys(
    binding,
    new Set(['source', 'sourceName', 'path']),
    'graph interaction availability binding',
  );

  if (binding.source !== 'available-actions') {
    throw new GraphInteractionValidationError(
      'Graph interaction availability binding must use available-actions source.',
    );
  }

  requiredNodeSource(graph, node, binding.sourceName);
  validatePath(
    binding.path,
    'Graph interaction available_actions path',
  );
}

function validateFieldBinding(
  binding: unknown,
  destinationField: GraphContextField<
    GraphContextScalar,
    boolean,
    GraphContextFieldKind
  >,
  currentContext: GraphContextSchema,
  eventSchema: GraphActionEventSchema,
  graph: GraphDefinition<GraphNodeMap>,
  node: string,
  destinationKey: string,
): void {
  assertPlainRecord(
    binding,
    `Graph interaction binding for "${destinationKey}"`,
  );

  if (binding.source === 'context' || binding.source === 'event') {
    assertExactKeys(
      binding,
      new Set(['source', 'field']),
      'graph interaction scalar binding',
    );

    if (typeof binding.field !== 'string') {
      throw new GraphInteractionValidationError(
        `Graph interaction binding for "${destinationKey}" must name a scalar field.`,
      );
    }

    const schema =
      binding.source === 'context' ? currentContext : eventSchema;
    const sourceField = schema[binding.field];

    if (!sourceField) {
      throw new GraphInteractionValidationError(
        `Unknown graph interaction ${binding.source} field "${binding.field}".`,
      );
    }

    if (sourceField.kind !== destinationField.kind) {
      throw new GraphInteractionValidationError(
        `Graph interaction ${binding.source} field "${binding.field}" cannot bind destination "${destinationKey}" across scalar categories.`,
      );
    }

    if (sourceField.optional && !destinationField.optional) {
      throw new GraphInteractionValidationError(
        `Optional graph interaction ${binding.source} field "${binding.field}" cannot bind required destination "${destinationKey}".`,
      );
    }

    return;
  }

  if (binding.source === 'node-source-id') {
    assertExactKeys(
      binding,
      new Set([
        'source',
        'sourceName',
        'path',
        'normalize',
        'missing',
      ]),
      'graph interaction node-source ID binding',
    );

    requiredNodeSource(graph, node, binding.sourceName);
    validatePath(
      binding.path,
      'Graph interaction node-source ID path',
    );

    if (binding.normalize !== 'string') {
      throw new GraphInteractionValidationError(
        'Graph interaction node-source ID binding must use deterministic string normalization.',
      );
    }

    if (binding.missing !== 'reject' && binding.missing !== 'omit') {
      throw new GraphInteractionValidationError(
        'Graph interaction node-source ID binding must declare missing as reject or omit.',
      );
    }

    if (destinationField.kind !== 'id') {
      throw new GraphInteractionValidationError(
        `Graph interaction node-source ID can bind only destination id fields, not "${destinationKey}".`,
      );
    }

    if (
      binding.missing === 'omit' &&
      !destinationField.optional
    ) {
      throw new GraphInteractionValidationError(
        `Omitting a missing node-source ID requires optional destination "${destinationKey}".`,
      );
    }

    return;
  }

  throw new GraphInteractionValidationError(
    `Unknown graph interaction binding source "${String(binding.source)}".`,
  );
}

function validateProjection(
  projection: unknown,
  destinationSchema: GraphContextSchema,
  currentContext: GraphContextSchema,
  eventSchema: GraphActionEventSchema,
  graph: GraphDefinition<GraphNodeMap>,
  node: string,
  label: string,
): void {
  assertPlainRecord(projection, label);
  const destinationKeys = new Set(Object.keys(destinationSchema));

  assertExactKeys(
    projection,
    destinationKeys,
    'graph interaction destination',
  );

  for (const [key, field] of Object.entries(destinationSchema)) {
    const binding = projection[key];

    if (binding === undefined) {
      if (field.optional) {
        continue;
      }

      throw new GraphInteractionValidationError(
        `Missing required graph interaction destination "${key}".`,
      );
    }

    validateFieldBinding(
      binding,
      field,
      currentContext,
      eventSchema,
      graph,
      node,
      key,
    );
  }
}

function validatePresentationProjection(
  projection: unknown,
  destinationSchema: GraphContextSchema,
  currentContext: GraphContextSchema,
  eventSchema: GraphActionEventSchema,
  destinationNode: string,
): void {
  assertPlainRecord(
    projection,
    `Graph presentation navigation context for "${destinationNode}"`,
  );
  const destinationKeys = new Set(Object.keys(destinationSchema));

  assertExactKeys(
    projection,
    destinationKeys,
    'graph presentation navigation context',
  );

  for (const [key, field] of Object.entries(destinationSchema)) {
    const binding = projection[key];

    if (binding === undefined) {
      if (field.optional) {
        continue;
      }

      throw new GraphInteractionValidationError(
        `Missing required graph presentation destination context "${key}".`,
      );
    }

    assertPlainRecord(
      binding,
      `Graph presentation binding for "${key}"`,
    );

    if (binding.source === 'literal') {
      assertExactKeys(
        binding,
        new Set(['source', 'value']),
        'graph presentation literal binding',
      );

      try {
        parseGraphScalarData(
          Object.freeze({ [key]: field }),
          Object.freeze({ [key]: binding.value }),
          Object.freeze({
            container: 'Graph presentation literal',
            field: 'graph presentation literal',
          }),
        );
      } catch (error: unknown) {
        if (error instanceof GraphScalarDataValidationError) {
          throw new GraphInteractionValidationError(
            `Invalid graph presentation literal for "${key}": ${error.message}`,
          );
        }

        throw error;
      }

      continue;
    }

    if (binding.source !== 'context' && binding.source !== 'event') {
      throw new GraphInteractionValidationError(
        `Unknown graph presentation binding source "${String(binding.source)}".`,
      );
    }

    validateFieldBinding(
      binding,
      field,
      currentContext,
      eventSchema,
      Object.freeze({
        kind: 'graph-definition',
        nodes: Object.freeze({}),
      }) as GraphDefinition<GraphNodeMap>,
      '',
      key,
    );
  }
}

type GraphBusinessInteractionInput<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TRegistry extends GraphActionRegistryBoundary,
  TNodeId extends GraphNodeId<TGraph>,
  TActionId extends GraphBusinessActionId<TRegistry>,
  TCommand extends GraphCommandDefinitionBoundary,
  TAvailability extends GraphAvailableActionsBinding,
  TInput extends GraphCommandInputProjection<
    TGraph,
    TNodeId,
    TRegistry['business'][TActionId]['eventSchema'],
    TCommand['inputSchema']
  >,
> = Readonly<{
  action: TActionId;
  availability: TAvailability;
  command: TCommand;
  input: TInput;
  transition: GraphTransitionDefinition<
    TGraph,
    TCommand,
    GraphNodeContextSchema<TGraph, TNodeId>
  >;
}> &
  GraphAvailabilityBindingGuard<
    TGraph,
    TNodeId,
    TRegistry['business'][TActionId]['availableAction'],
    TAvailability
  > &
  GraphCommandInputProjectionGuard<
    TGraph,
    TNodeId,
    TRegistry['business'][TActionId]['eventSchema'],
    TCommand['inputSchema'],
    TInput
  >;

type GraphPresentationInteractionInput<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TRegistry extends GraphActionRegistryBoundary,
  TNodeId extends GraphNodeId<TGraph>,
  TActionId extends GraphPresentationActionId<TRegistry>,
> = Readonly<{
  action: TActionId;
  effect: GraphPresentationEffect<
    TGraph,
    TNodeId,
    TRegistry['presentation'][TActionId]['eventSchema']
  >;
}>;

function freezeInteractionMap<
  TInteraction extends
    | GraphBusinessInteractionBoundary
    | GraphPresentationInteractionBoundary,
>(
  interactions: readonly TInteraction[],
  expectedGraph: GraphDefinition<GraphNodeMap>,
  expectedActions: GraphActionRegistryBoundary,
  expectedNode: string,
  expectedKind: TInteraction['kind'],
): Readonly<Record<string, TInteraction>> {
  const output: Record<string, TInteraction> = {};

  for (const interaction of interactions) {
    if (interaction.kind !== expectedKind) {
      throw new GraphInteractionValidationError(
        `Graph node interaction must have kind "${expectedKind}".`,
      );
    }

    if (interaction.graph !== expectedGraph) {
      throw new GraphInteractionValidationError(
        'Graph node interaction must reference the same graph.',
      );
    }

    if (interaction.actions !== expectedActions) {
      throw new GraphInteractionValidationError(
        'Graph node interaction must reference the same action registry.',
      );
    }

    if (interaction.node !== expectedNode) {
      throw new GraphInteractionValidationError(
        `Graph interaction for node "${interaction.node}" cannot be declared under node "${expectedNode}".`,
      );
    }

    if (Object.prototype.hasOwnProperty.call(output, interaction.action)) {
      throw new GraphInteractionValidationError(
        `Duplicate graph interaction action "${interaction.action}" on node "${expectedNode}".`,
      );
    }

    output[interaction.action] = interaction;
  }

  return Object.freeze(output);
}

export function graphInteractionsFor<
  const TGraph extends GraphDefinition<GraphNodeMap>,
  const TRegistry extends GraphActionRegistryBoundary,
>(
  graph: TGraph,
  actions: TRegistry,
) {
  return Object.freeze({
    node<const TNodeId extends GraphNodeId<TGraph>>(
      node: TNodeId,
    ) {
      const nodeDefinition = graph.nodes[node];
      const currentContext = nodeDefinition.context;

      return Object.freeze({
        business<
          const TActionId extends GraphBusinessActionId<TRegistry>,
          const TCommand extends GraphCommandDefinitionBoundary,
          const TAvailability extends GraphAvailableActionsBinding,
          const TInput extends GraphCommandInputProjection<
            TGraph,
            TNodeId,
            TRegistry['business'][TActionId]['eventSchema'],
            TCommand['inputSchema']
          >,
        >(
          definition: GraphBusinessInteractionInput<
            TGraph,
            TRegistry,
            TNodeId,
            TActionId,
            TCommand,
            TAvailability,
            TInput
          >,
        ): GraphBusinessInteractionDefinition<
          TGraph,
          TRegistry,
          TNodeId,
          TActionId,
          TCommand,
          TAvailability,
          TInput
        > {
          assertPlainRecord(
            definition,
            'Graph business interaction definition',
          );
          assertExactKeys(
            definition,
            new Set([
              'action',
              'availability',
              'command',
              'input',
              'transition',
            ]),
            'graph business interaction definition',
          );

          if (
            typeof definition.action !== 'string' ||
            !(definition.action in actions.business)
          ) {
            throw new GraphInteractionValidationError(
              `Unknown graph business semantic action "${String(definition.action)}".`,
            );
          }

          const actionDefinition = actions.business[definition.action];

          assertPlainRecord(
            definition.command,
            'Graph business command',
          );
          if (definition.command.kind !== 'graph-command') {
            throw new GraphInteractionValidationError(
              'Graph business interaction requires a GraphCommand.',
            );
          }

          assertPlainRecord(
            definition.transition,
            'Graph business transition',
          );
          if (
            definition.transition.kind !==
            'graph-transition-definition'
          ) {
            throw new GraphInteractionValidationError(
              'Graph business interaction requires a GraphTransition.',
            );
          }

          validateAvailability(
            graph,
            node,
            definition.availability,
          );

          validateProjection(
            definition.input,
            definition.command.inputSchema,
            currentContext,
            actionDefinition.eventSchema,
            graph,
            node,
            'Graph business command input projection',
          );

          if (definition.transition.graph !== graph) {
            throw new GraphInteractionValidationError(
              'Graph business transition must reference the same graph.',
            );
          }

          if (definition.transition.command !== definition.command) {
            throw new GraphInteractionValidationError(
              'Graph business transition must reference the same command.',
            );
          }

          if (
            definition.transition.currentContext !== currentContext
          ) {
            throw new GraphInteractionValidationError(
              'Graph business transition must reference the current node context schema.',
            );
          }

          return Object.freeze({
            kind: 'business-interaction' as const,
            graph,
            actions,
            node,
            action: definition.action,
            availability: definition.availability,
            command: definition.command,
            input: Object.freeze({ ...definition.input }),
            transition: definition.transition,
          }) as GraphBusinessInteractionDefinition<
            TGraph,
            TRegistry,
            TNodeId,
            TActionId,
            TCommand,
            TAvailability,
            TInput
          >;
        },

        presentation<
          const TActionId extends GraphPresentationActionId<TRegistry>,
        >(
          definition: GraphPresentationInteractionInput<
            TGraph,
            TRegistry,
            TNodeId,
            TActionId
          >,
        ): GraphPresentationInteractionDefinition<
          TGraph,
          TRegistry,
          TNodeId,
          TActionId
        > {
          assertPlainRecord(
            definition,
            'Graph presentation interaction definition',
          );
          assertExactKeys(
            definition,
            new Set(['action', 'effect']),
            'graph presentation interaction definition',
          );

          if (
            typeof definition.action !== 'string' ||
            !(definition.action in actions.presentation)
          ) {
            throw new GraphInteractionValidationError(
              `Unknown graph presentation semantic action "${String(definition.action)}".`,
            );
          }

          const actionDefinition =
            actions.presentation[definition.action];
          const effect = definition.effect;

          assertPlainRecord(
            effect,
            'Graph presentation effect',
          );

          if (effect.kind === 'back') {
            assertPlainRecord(effect, 'Graph presentation back effect');
            assertExactKeys(
              effect,
              new Set(['kind']),
              'graph presentation back effect',
            );
          } else if (effect.kind === 'navigate') {
            assertPlainRecord(
              effect,
              'Graph presentation navigate effect',
            );
            assertExactKeys(
              effect,
              new Set(['kind', 'node', 'context']),
              'graph presentation navigate effect',
            );

            if (!(effect.node in graph.nodes)) {
              throw new GraphInteractionValidationError(
                `Unknown graph presentation destination node "${String(effect.node)}".`,
              );
            }

            validatePresentationProjection(
              effect.context,
              graph.nodes[effect.node].context,
              currentContext,
              actionDefinition.eventSchema,
              effect.node,
            );
          } else {
            throw new GraphInteractionValidationError(
              `Unknown graph presentation effect "${String((effect as Readonly<{ kind?: unknown }>).kind)}".`,
            );
          }

          return Object.freeze({
            kind: 'presentation-interaction' as const,
            graph,
            actions,
            node,
            action: definition.action,
            effect,
          }) as GraphPresentationInteractionDefinition<
            TGraph,
            TRegistry,
            TNodeId,
            TActionId
          >;
        },

        define<
          const TBusiness extends readonly GraphBusinessInteractionBoundary<
            TGraph,
            TRegistry,
            TNodeId
          >[],
          const TPresentation extends readonly GraphPresentationInteractionBoundary<
            TGraph,
            TRegistry,
            TNodeId
          >[],
        >(
          definition: Readonly<{
            business: TBusiness;
            presentation: TPresentation;
          }>,
        ): GraphNodeInteractions<
          TGraph,
          TRegistry,
          TNodeId,
          GraphBusinessInteractionMapFromTuple<TBusiness>,
          GraphPresentationInteractionMapFromTuple<TPresentation>
        > {
          assertPlainRecord(
            definition,
            'Graph node interaction declaration',
          );
          assertExactKeys(
            definition,
            new Set(['business', 'presentation']),
            'graph node interaction declaration',
          );

          if (
            !Array.isArray(definition.business) ||
            !Array.isArray(definition.presentation)
          ) {
            throw new GraphInteractionValidationError(
              'Graph node interaction declaration requires business and presentation arrays.',
            );
          }

          if (
            definition.business.length === 0 &&
            definition.presentation.length === 0
          ) {
            throw new GraphInteractionValidationError(
              `Graph node "${node}" interaction declaration must not be empty.`,
            );
          }

          const business = freezeInteractionMap(
            definition.business,
            graph,
            actions,
            node,
            'business-interaction',
          ) as GraphBusinessInteractionMapFromTuple<TBusiness>;

          const presentation = freezeInteractionMap(
            definition.presentation,
            graph,
            actions,
            node,
            'presentation-interaction',
          ) as GraphPresentationInteractionMapFromTuple<TPresentation>;

          return Object.freeze({
            kind: 'graph-node-interactions' as const,
            graph,
            actions,
            node,
            business,
            presentation,
          }) as GraphNodeInteractions<
            TGraph,
            TRegistry,
            TNodeId,
            GraphBusinessInteractionMapFromTuple<TBusiness>,
            GraphPresentationInteractionMapFromTuple<TPresentation>
          >;
        },
      });
    },
  });
}

type GraphNodeInteractionsRegistry<
  TInteractions extends GraphNodeInteractionsBoundary,
> = TInteractions extends GraphNodeInteractions<
  GraphDefinition<GraphNodeMap>,
  infer TRegistry,
  string,
  Readonly<Record<string, GraphBusinessInteractionBoundary>>,
  Readonly<Record<string, GraphPresentationInteractionBoundary>>
>
  ? TRegistry
  : never;

type GraphNodeInteractionsBusiness<
  TInteractions extends GraphNodeInteractionsBoundary,
> = TInteractions extends GraphNodeInteractions<
  GraphDefinition<GraphNodeMap>,
  GraphActionRegistryBoundary,
  string,
  infer TBusiness,
  Readonly<Record<string, GraphPresentationInteractionBoundary>>
>
  ? TBusiness
  : never;

type GraphNodeInteractionsPresentation<
  TInteractions extends GraphNodeInteractionsBoundary,
> = TInteractions extends GraphNodeInteractions<
  GraphDefinition<GraphNodeMap>,
  GraphActionRegistryBoundary,
  string,
  Readonly<Record<string, GraphBusinessInteractionBoundary>>,
  infer TPresentation
>
  ? TPresentation
  : never;

type GraphRegistryBusiness<
  TRegistry extends GraphActionRegistryBoundary,
> = TRegistry extends GraphActionRegistry<
  infer TBusiness,
  GraphPresentationActionMap
>
  ? TBusiness
  : never;

type GraphRegistryPresentation<
  TRegistry extends GraphActionRegistryBoundary,
> = TRegistry extends GraphActionRegistry<
  GraphBusinessActionMap,
  infer TPresentation
>
  ? TPresentation
  : never;

export type GraphBusinessActionProjection<
  TInstance,
> = readonly [] | readonly [TInstance];

export type GraphNodeActionFactory<
  TRegistry extends GraphActionRegistryBoundary,
  TBusiness extends Readonly<
    Record<string, GraphBusinessInteractionBoundary>
  >,
  TPresentation extends Readonly<
    Record<string, GraphPresentationInteractionBoundary>
  >,
> = Readonly<{
  business<
    TActionId extends Extract<
      keyof TBusiness,
      GraphBusinessActionId<TRegistry>
    >,
  >(
    actionId: TActionId,
    input: GraphActionInstanceInput<
      GraphRegistryBusiness<TRegistry>[TActionId]
    >,
    event: GraphActionInstanceEvent<
      GraphRegistryBusiness<TRegistry>[TActionId]
    >,
  ): GraphBusinessActionProjection<
    GraphBusinessActionInstance<
      TActionId,
      GraphRegistryBusiness<TRegistry>[TActionId]
    >
  >;

  presentation<
    TActionId extends Extract<
      keyof TPresentation,
      GraphPresentationActionId<TRegistry>
    >,
  >(
    actionId: TActionId,
    input: GraphActionInstanceInput<
      GraphRegistryPresentation<TRegistry>[TActionId]
    >,
    event: GraphActionInstanceEvent<
      GraphRegistryPresentation<TRegistry>[TActionId]
    >,
  ): GraphPresentationActionInstance<
    TActionId,
    GraphRegistryPresentation<TRegistry>[TActionId]
  >;
}>;

export type GraphNodeActionFactoryFor<
  TInteractions extends GraphNodeInteractionsBoundary,
> = GraphNodeActionFactory<
  GraphNodeInteractionsRegistry<TInteractions>,
  GraphNodeInteractionsBusiness<TInteractions>,
  GraphNodeInteractionsPresentation<TInteractions>
>;
