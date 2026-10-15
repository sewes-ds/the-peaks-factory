import {
  GraphScalarDataValidationError,
  defineGraphContext,
  graphContext,
  parseGraphScalarData,
  type GraphContextSchema,
  type InferGraphContext,
} from './context';

export type GraphCommandMutationMethod =
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE';

export type GraphCommandEntityId = string | number;

export type GraphCommandInputSchema = GraphContextSchema;

export type InferGraphCommandInput<
  TSchema extends GraphCommandInputSchema,
> = InferGraphContext<TSchema>;

export type GraphCommandEntityField<
  TOptional extends boolean = false,
> = Readonly<{
  kind: 'entity-id';
  optional: TOptional;
}>;

export type GraphCommandEntitySchema = Readonly<
  Record<string, GraphCommandEntityField<boolean>>
>;

type GraphCommandRequiredEntityKeys<
  TSchema extends GraphCommandEntitySchema,
> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphCommandEntityField<
    true
  >
    ? never
    : TKey;
}[keyof TSchema];

type GraphCommandOptionalEntityKeys<
  TSchema extends GraphCommandEntitySchema,
> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphCommandEntityField<
    true
  >
    ? TKey
    : never;
}[keyof TSchema];

export type InferGraphCommandEntities<
  TSchema extends GraphCommandEntitySchema,
> = Readonly<
  {
    [TKey in GraphCommandRequiredEntityKeys<TSchema>]: GraphCommandEntityId;
  } & {
    [TKey in GraphCommandOptionalEntityKeys<TSchema>]?: GraphCommandEntityId;
  }
>;

export type GraphDomainCommandResult<
  TCommand extends string,
  TOutcome extends string,
  TEntities extends Readonly<
    Record<string, GraphCommandEntityId | undefined>
  >,
> = Readonly<{
  command: TCommand;
  outcome: TOutcome;
  entities: TEntities;
}>;

export type GraphCommandRequest<TInput> = (
  input: TInput,
) => Promise<unknown>;

export type GraphCommandValidatedRequest = (
  input: unknown,
) => Promise<unknown>;

export type GraphCommandInputDecoder<TInput> = (
  input: unknown,
) => TInput;

export type GraphCommandResultDecoder<TResult> = (
  input: unknown,
) => TResult;

declare const graphCommandDefinitionBrand: unique symbol;

export type GraphCommandDefinition<
  TInputSchema extends GraphCommandInputSchema,
  TCommand extends string,
  TOutcomes extends readonly [string, ...string[]],
  TEntitySchema extends GraphCommandEntitySchema,
  TMethod extends GraphCommandMutationMethod = GraphCommandMutationMethod,
  TEndpoint extends string = string,
> = Readonly<{
  kind: 'graph-command';
  command: TCommand;
  method: TMethod;
  endpoint: TEndpoint;
  inputSchema: TInputSchema;
  outcomes: TOutcomes;
  entitySchema: TEntitySchema;
  parseInput: GraphCommandInputDecoder<
    InferGraphCommandInput<TInputSchema>
  >;
  request: GraphCommandValidatedRequest;
  decode: GraphCommandResultDecoder<
    GraphDomainCommandResult<
      TCommand,
      TOutcomes[number],
      InferGraphCommandEntities<TEntitySchema>
    >
  >;
  readonly [graphCommandDefinitionBrand]: true;
}>;

type GraphCommandDefinitionBoundary = GraphCommandDefinition<
  GraphCommandInputSchema,
  string,
  readonly [string, ...string[]],
  GraphCommandEntitySchema
>;

export type GraphCommandInput<
  TDefinition extends GraphCommandDefinitionBoundary,
> = TDefinition extends GraphCommandDefinition<
  infer TInputSchema,
  string,
  readonly [string, ...string[]],
  GraphCommandEntitySchema
>
  ? InferGraphCommandInput<TInputSchema>
  : never;

export type InferGraphCommandResult<
  TDefinition extends GraphCommandDefinitionBoundary,
> = ReturnType<TDefinition['decode']>;

type GraphCommandInputGuard<TInput> = 0 extends 1 & TInput
  ? [forbiddenUnboundedInputSchema: never]
  : unknown extends TInput
    ? [forbiddenUnboundedInputSchema: never]
    : [];

type GraphCommandDefinitionInput<
  TInputSchema extends GraphCommandInputSchema,
  TCommand extends string,
  TOutcomes extends readonly [string, ...string[]],
  TEntitySchema extends GraphCommandEntitySchema,
  TMethod extends GraphCommandMutationMethod,
  TEndpoint extends string,
> = Readonly<{
  command: TCommand;
  method: TMethod;
  endpoint: TEndpoint;
  outcomes: TOutcomes;
  entities: TEntitySchema;
  request: GraphCommandRequest<
    InferGraphCommandInput<TInputSchema>
  >;
}>;

export class GraphCommandValidationError extends Error {
  readonly field: string | null;

  constructor(message: string, field: string | null = null) {
    super(message);
    this.name = 'GraphCommandValidationError';
    this.field = field;
  }
}

export const graphCommandInput = graphContext;

export function defineGraphCommandInput<
  const TSchema extends GraphCommandInputSchema,
>(schema: TSchema): TSchema {
  return defineGraphContext(schema);
}

function parseGraphCommandInput<
  const TSchema extends GraphCommandInputSchema,
>(
  schema: TSchema,
  input: unknown,
): InferGraphCommandInput<TSchema> {
  try {
    return parseGraphScalarData(
      schema,
      input,
      Object.freeze({
        container: 'Graph command input',
        field: 'graph command input',
      }),
    );
  } catch (error: unknown) {
    if (error instanceof GraphScalarDataValidationError) {
      throw new GraphCommandValidationError(
        error.message,
        error.field,
      );
    }

    throw error;
  }
}

export const graphCommandEntity = Object.freeze({
  id(): GraphCommandEntityField<false> {
    return Object.freeze({
      kind: 'entity-id',
      optional: false,
    });
  },

  optionalId(): GraphCommandEntityField<true> {
    return Object.freeze({
      kind: 'entity-id',
      optional: true,
    });
  },
});

export function defineGraphCommandEntities<
  const TSchema extends GraphCommandEntitySchema,
>(schema: TSchema): TSchema {
  for (const key of Object.keys(schema)) {
    if (key.trim().length === 0) {
      throw new Error(
        'Graph command entity field names must be non-empty strings.',
      );
    }
  }

  return Object.freeze({ ...schema });
}

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

function isEntityId(value: unknown): value is GraphCommandEntityId {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  return typeof value === 'number' && Number.isFinite(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  label: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new GraphCommandValidationError(
        `Unknown ${label} field "${key}".`,
        key,
      );
    }
  }
}

function decodeGraphCommandResult<
  TCommand extends string,
  TOutcomes extends readonly [string, ...string[]],
  TEntitySchema extends GraphCommandEntitySchema,
>(
  command: TCommand,
  outcomes: TOutcomes,
  entitySchema: TEntitySchema,
  input: unknown,
): GraphDomainCommandResult<
  TCommand,
  TOutcomes[number],
  InferGraphCommandEntities<TEntitySchema>
> {
  if (!isPlainRecord(input)) {
    throw new GraphCommandValidationError(
      'Graph command result must be a plain object.',
    );
  }

  assertExactKeys(
    input,
    new Set(['command', 'outcome', 'entities']),
    'graph command result',
  );

  if (input.command !== command) {
    throw new GraphCommandValidationError(
      `Graph command result command must be "${command}".`,
      'command',
    );
  }

  if (
    typeof input.outcome !== 'string' ||
    !outcomes.includes(input.outcome)
  ) {
    throw new GraphCommandValidationError(
      `Unknown graph command outcome "${String(input.outcome)}".`,
      'outcome',
    );
  }

  if (!isPlainRecord(input.entities)) {
    throw new GraphCommandValidationError(
      'Graph command result entities must be a plain object.',
      'entities',
    );
  }

  const entityKeys = new Set(Object.keys(entitySchema));
  assertExactKeys(
    input.entities,
    entityKeys,
    'graph command entity',
  );

  const entities: Record<string, GraphCommandEntityId> = {};

  for (const [key, field] of Object.entries(entitySchema)) {
    const value = input.entities[key];

    if (value === undefined) {
      if (field.optional) {
        continue;
      }

      throw new GraphCommandValidationError(
        `Missing required graph command entity "${key}".`,
        key,
      );
    }

    if (!isEntityId(value)) {
      throw new GraphCommandValidationError(
        `Graph command entity "${key}" must be a non-empty string or finite number ID.`,
        key,
      );
    }

    entities[key] = value;
  }

  return Object.freeze({
    command,
    outcome: input.outcome as TOutcomes[number],
    entities: Object.freeze(entities) as InferGraphCommandEntities<
      TEntitySchema
    >,
  });
}

export function graphCommandFor<
  const TInputSchema extends GraphCommandInputSchema,
>(
  inputSchema: TInputSchema,
  ..._guard: GraphCommandInputGuard<TInputSchema>
) {
  const frozenInputSchema = Object.freeze({
    ...inputSchema,
  }) as TInputSchema;

  return Object.freeze({
    define<
      const TCommand extends string,
      const TOutcomes extends readonly [string, ...string[]],
      const TEntitySchema extends GraphCommandEntitySchema,
      const TMethod extends GraphCommandMutationMethod,
      const TEndpoint extends string,
    >(
      definition: GraphCommandDefinitionInput<
        TInputSchema,
        TCommand,
        TOutcomes,
        TEntitySchema,
        TMethod,
        TEndpoint
      >,
    ): GraphCommandDefinition<
      TInputSchema,
      TCommand,
      TOutcomes,
      TEntitySchema,
      TMethod,
      TEndpoint
    > {
      if (definition.command.trim().length === 0) {
        throw new Error(
          'Graph command identity must be a non-empty string.',
        );
      }

      if (!definition.endpoint.startsWith('/')) {
        throw new Error(
          'Graph command endpoint must start with "/".',
        );
      }

      const outcomeSet = new Set<string>();

      for (const outcome of definition.outcomes) {
        if (outcome.trim().length === 0) {
          throw new Error(
            'Graph command outcomes must be non-empty strings.',
          );
        }

        if (outcomeSet.has(outcome)) {
          throw new Error(
            `Duplicate graph command outcome "${outcome}".`,
          );
        }

        outcomeSet.add(outcome);
      }

      const outcomes = Object.freeze([
        ...definition.outcomes,
      ]) as unknown as TOutcomes;

      const entitySchema = Object.freeze({
        ...definition.entities,
      }) as TEntitySchema;

      const parseInput: GraphCommandInputDecoder<
        InferGraphCommandInput<TInputSchema>
      > = (input: unknown) =>
        parseGraphCommandInput(
          frozenInputSchema,
          input,
        );

      const request: GraphCommandValidatedRequest = async (
        input: unknown,
      ) => definition.request(parseInput(input));

      const decode: GraphCommandResultDecoder<
        GraphDomainCommandResult<
          TCommand,
          TOutcomes[number],
          InferGraphCommandEntities<TEntitySchema>
        >
      > = (input: unknown) =>
        decodeGraphCommandResult(
          definition.command,
          outcomes,
          entitySchema,
          input,
        );

      return Object.freeze({
        kind: 'graph-command' as const,
        command: definition.command,
        method: definition.method,
        endpoint: definition.endpoint,
        inputSchema: frozenInputSchema,
        outcomes,
        entitySchema,
        parseInput,
        request,
        decode,
      }) as GraphCommandDefinition<
        TInputSchema,
        TCommand,
        TOutcomes,
        TEntitySchema,
        TMethod,
        TEndpoint
      >;
    },
  });
}
