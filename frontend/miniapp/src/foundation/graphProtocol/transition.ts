import type {
  GraphCommandDefinition,
  GraphCommandEntityField,
  GraphCommandEntitySchema,
  GraphCommandInputSchema,
  InferGraphCommandResult,
} from './command';
import type {
  GraphContextField,
  GraphContextFieldKind,
  GraphContextScalar,
  GraphContextSchema,
} from './context';
import type {
  GraphDefinition,
  GraphNodeId,
  GraphNodeMap,
} from './definition';

type GraphCommandDefinitionBoundary = GraphCommandDefinition<
  GraphCommandInputSchema,
  string,
  readonly [string, ...string[]],
  GraphCommandEntitySchema
>;

type GraphCommandOutcome<
  TCommand extends GraphCommandDefinitionBoundary,
> = Extract<InferGraphCommandResult<TCommand>['outcome'], string>;

type GraphCommandEntities<
  TCommand extends GraphCommandDefinitionBoundary,
> = TCommand['entitySchema'];

type GraphNodeContextSchema<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TNodeId extends GraphNodeId<TGraph>,
> = TGraph['nodes'][TNodeId]['context'] extends infer TSchema
  ? TSchema extends GraphContextSchema
    ? TSchema
    : never
  : never;

type GraphContextFieldValue<TField> =
  TField extends GraphContextField<
    infer TValue,
    boolean,
    GraphContextFieldKind
  >
    ? TValue
    : never;

type GraphContextFieldCategory<TField> =
  TField extends GraphContextField<
    GraphContextScalar,
    boolean,
    infer TKind
  >
    ? TKind
    : never;

type GraphContextFieldOptional<TField> =
  TField extends GraphContextField<
    GraphContextScalar,
    infer TOptional,
    GraphContextFieldKind
  >
    ? TOptional
    : never;

type GraphCommandEntityOptional<TField> =
  TField extends GraphCommandEntityField<infer TOptional>
    ? TOptional
    : never;

type IsCurrentContextFieldCompatible<
  TSourceField,
  TDestinationField,
> = GraphContextFieldCategory<TSourceField> extends GraphContextFieldCategory<
  TDestinationField
>
  ? GraphContextFieldCategory<TDestinationField> extends GraphContextFieldCategory<
      TSourceField
    >
    ? GraphContextFieldOptional<TSourceField> extends true
      ? GraphContextFieldOptional<TDestinationField> extends true
        ? GraphContextFieldValue<TSourceField> extends GraphContextFieldValue<
            TDestinationField
          >
          ? true
          : false
        : false
      : GraphContextFieldValue<TSourceField> extends GraphContextFieldValue<
            TDestinationField
          >
        ? true
        : false
    : false
  : false;

type CompatibleCurrentContextFieldKeys<
  TCurrentContext extends GraphContextSchema,
  TDestinationField,
> = Extract<
  {
    [TKey in keyof TCurrentContext]-?: IsCurrentContextFieldCompatible<
      TCurrentContext[TKey],
      TDestinationField
    > extends true
      ? TKey
      : never;
  }[keyof TCurrentContext],
  string
>;

type IsCommandEntityCompatible<
  TEntityField,
  TDestinationField,
> = GraphContextFieldCategory<TDestinationField> extends 'id'
  ? string extends GraphContextFieldValue<TDestinationField>
    ? GraphCommandEntityOptional<TEntityField> extends true
      ? GraphContextFieldOptional<TDestinationField> extends true
        ? true
        : false
      : true
    : false
  : false;

type CompatibleCommandEntityKeys<
  TEntities extends GraphCommandEntitySchema,
  TDestinationField,
> = Extract<
  {
    [TKey in keyof TEntities]-?: IsCommandEntityCompatible<
      TEntities[TKey],
      TDestinationField
    > extends true
      ? TKey
      : never;
  }[keyof TEntities],
  string
>;

type GraphRequiredContextKeys<TSchema extends GraphContextSchema> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphContextField<
    GraphContextScalar,
    true,
    GraphContextFieldKind
  >
    ? never
    : TKey;
}[keyof TSchema];

type GraphOptionalContextKeys<TSchema extends GraphContextSchema> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphContextField<
    GraphContextScalar,
    true,
    GraphContextFieldKind
  >
    ? TKey
    : never;
}[keyof TSchema];

export type GraphCurrentContextBinding<
  TField extends string = string,
> = Readonly<{
  source: 'context';
  field: TField;
}>;

export type GraphCommandEntityIdBinding<
  TField extends string = string,
> = Readonly<{
  source: 'command-entity';
  field: TField;
  normalize: 'string';
}>;

export type GraphTransitionContextBinding =
  | GraphCurrentContextBinding
  | GraphCommandEntityIdBinding;

type GraphTransitionBindingForField<
  TCurrentContext extends GraphContextSchema,
  TEntities extends GraphCommandEntitySchema,
  TDestinationField,
> =
  | GraphCurrentContextBinding<
      CompatibleCurrentContextFieldKeys<
        TCurrentContext,
        TDestinationField
      >
    >
  | GraphCommandEntityIdBinding<
      CompatibleCommandEntityKeys<TEntities, TDestinationField>
    >;

export type GraphTransitionContextProjection<
  TCurrentContext extends GraphContextSchema,
  TEntities extends GraphCommandEntitySchema,
  TDestinationContext extends GraphContextSchema,
> = Readonly<
  {
    [TKey in GraphRequiredContextKeys<TDestinationContext>]:
      GraphTransitionBindingForField<
        TCurrentContext,
        TEntities,
        TDestinationContext[TKey]
      >;
  } & {
    [TKey in GraphOptionalContextKeys<TDestinationContext>]?:
      GraphTransitionBindingForField<
        TCurrentContext,
        TEntities,
        TDestinationContext[TKey]
      >;
  }
>;

export type GraphTransitionTarget<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TCurrentContext extends GraphContextSchema,
  TEntities extends GraphCommandEntitySchema,
> = {
  [TNodeId in GraphNodeId<TGraph>]: Readonly<{
    node: TNodeId;
    context: GraphTransitionContextProjection<
      TCurrentContext,
      TEntities,
      GraphNodeContextSchema<TGraph, TNodeId>
    >;
  }>;
}[GraphNodeId<TGraph>];

export type GraphTransitionMap<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TCommand extends GraphCommandDefinitionBoundary,
  TCurrentContext extends GraphContextSchema,
> = Readonly<{
  [TOutcome in GraphCommandOutcome<TCommand>]: GraphTransitionTarget<
    TGraph,
    TCurrentContext,
    GraphCommandEntities<TCommand>
  >;
}>;

declare const graphTransitionDefinitionBrand: unique symbol;

export type GraphTransitionDefinition<
  TGraph extends GraphDefinition<GraphNodeMap>,
  TCommand extends GraphCommandDefinitionBoundary,
  TCurrentContext extends GraphContextSchema,
> = Readonly<{
  kind: 'graph-transition-definition';
  graph: TGraph;
  command: TCommand;
  currentContext: TCurrentContext;
  transitions: GraphTransitionMap<
    TGraph,
    TCommand,
    TCurrentContext
  >;
  readonly [graphTransitionDefinitionBrand]: true;
}>;

export const graphTransition = Object.freeze({
  context<const TField extends string>(
    field: TField,
  ): GraphCurrentContextBinding<TField> {
    return Object.freeze({
      source: 'context',
      field,
    });
  },

  entityId<const TField extends string>(
    field: TField,
  ): GraphCommandEntityIdBinding<TField> {
    return Object.freeze({
      source: 'command-entity',
      field,
      normalize: 'string',
    });
  },
});

function assertPlainRecord(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(`${label} must be a plain object.`);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object.`);
  }
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  allowedKeys: ReadonlySet<string>,
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unknown ${label} field "${key}".`);
    }
  }
}

function validateBinding(
  binding: unknown,
  currentContext: GraphContextSchema,
  entities: GraphCommandEntitySchema,
  destinationField: GraphContextField<
    GraphContextScalar,
    boolean,
    GraphContextFieldKind
  >,
  destinationKey: string,
): void {
  assertPlainRecord(
    binding,
    `Graph transition binding for "${destinationKey}"`,
  );

  if (binding.source === 'context') {
    assertExactKeys(
      binding,
      new Set(['source', 'field']),
      'graph transition context binding',
    );

    if (typeof binding.field !== 'string') {
      throw new Error(
        `Graph transition context binding for "${destinationKey}" must name a context field.`,
      );
    }

    const sourceField = currentContext[binding.field];
    if (!sourceField) {
      throw new Error(
        `Unknown graph transition context field "${binding.field}".`,
      );
    }

    if (sourceField.kind !== destinationField.kind) {
      throw new Error(
        `Graph transition context field "${binding.field}" cannot bind to destination "${destinationKey}" across context categories.`,
      );
    }

    if (sourceField.optional && !destinationField.optional) {
      throw new Error(
        `Optional graph transition context field "${binding.field}" cannot bind required destination "${destinationKey}".`,
      );
    }

    return;
  }

  if (binding.source === 'command-entity') {
    assertExactKeys(
      binding,
      new Set(['source', 'field', 'normalize']),
      'graph transition command-entity binding',
    );

    if (typeof binding.field !== 'string') {
      throw new Error(
        `Graph transition command-entity binding for "${destinationKey}" must name an entity field.`,
      );
    }

    const entityField = entities[binding.field];
    if (!entityField) {
      throw new Error(
        `Unknown graph transition command entity "${binding.field}".`,
      );
    }

    if (binding.normalize !== 'string') {
      throw new Error(
        `Graph transition command entity "${binding.field}" must use deterministic string normalization.`,
      );
    }

    if (destinationField.kind !== 'id') {
      throw new Error(
        `Graph transition command entity "${binding.field}" can bind only destination id fields.`,
      );
    }

    if (entityField.optional && !destinationField.optional) {
      throw new Error(
        `Optional graph transition command entity "${binding.field}" cannot bind required destination "${destinationKey}".`,
      );
    }

    return;
  }

  throw new Error(
    `Unknown graph transition binding source "${String(binding.source)}".`,
  );
}

function validateTransitionTarget(
  target: unknown,
  graph: GraphDefinition<GraphNodeMap>,
  currentContext: GraphContextSchema,
  entities: GraphCommandEntitySchema,
  outcome: string,
): void {
  assertPlainRecord(target, `Graph transition target for "${outcome}"`);
  assertExactKeys(
    target,
    new Set(['node', 'context']),
    'graph transition target',
  );

  if (
    typeof target.node !== 'string' ||
    !(target.node in graph.nodes)
  ) {
    throw new Error(
      `Unknown graph transition destination node "${String(target.node)}".`,
    );
  }

  assertPlainRecord(
    target.context,
    `Graph transition context for "${outcome}"`,
  );

  const destinationContext = graph.nodes[target.node].context;
  const destinationKeys = new Set(Object.keys(destinationContext));

  assertExactKeys(
    target.context,
    destinationKeys,
    'graph transition destination context',
  );

  for (const [key, field] of Object.entries(destinationContext)) {
    const binding = target.context[key];

    if (binding === undefined) {
      if (field.optional) {
        continue;
      }

      throw new Error(
        `Missing required graph transition destination context "${key}".`,
      );
    }

    validateBinding(
      binding,
      currentContext,
      entities,
      field,
      key,
    );
  }
}

export function defineGraphTransitions<
  const TGraph extends GraphDefinition<GraphNodeMap>,
  const TCommand extends GraphCommandDefinitionBoundary,
  const TCurrentContext extends GraphContextSchema,
>(
  definition: Readonly<{
    graph: TGraph;
    command: TCommand;
    currentContext: TCurrentContext;
    transitions: GraphTransitionMap<
      NoInfer<TGraph>,
      NoInfer<TCommand>,
      NoInfer<TCurrentContext>
    >;
  }>,
): GraphTransitionDefinition<
  TGraph,
  TCommand,
  TCurrentContext
> {
  const transitions = definition.transitions as Readonly<
    Record<string, unknown>
  >;

  const outcomeKeys = new Set<string>(definition.command.outcomes);

  assertExactKeys(
    transitions,
    outcomeKeys,
    'graph transition outcome',
  );

  for (const outcome of definition.command.outcomes) {
    const target = transitions[outcome];

    if (target === undefined) {
      throw new Error(
        `Missing graph transition for command outcome "${outcome}".`,
      );
    }

    validateTransitionTarget(
      target,
      definition.graph,
      definition.currentContext,
      definition.command.entitySchema,
      outcome,
    );
  }

  return Object.freeze({
    kind: 'graph-transition-definition' as const,
    graph: definition.graph,
    command: definition.command,
    currentContext: definition.currentContext,
    transitions: Object.freeze({
      ...definition.transitions,
    }) as GraphTransitionMap<
      TGraph,
      TCommand,
      TCurrentContext
    >,
  }) as GraphTransitionDefinition<
    TGraph,
    TCommand,
    TCurrentContext
  >;
}
