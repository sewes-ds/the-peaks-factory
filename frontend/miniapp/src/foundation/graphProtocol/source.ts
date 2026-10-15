
import type { GraphContextScalar } from './context';

export type GraphSourceContext = Readonly<Record<string, GraphContextScalar>>;

export type GraphSourceRequirement = 'required' | 'optional';

export type GraphSourceDecoder<TValue> = (input: unknown) => TValue;

export type GraphSourceRequest<TContext extends GraphSourceContext> = (
  context: Readonly<TContext>,
) => Promise<unknown>;

export type GraphSourceDefinition<
  TContext extends GraphSourceContext,
  TValue,
  TRequirement extends GraphSourceRequirement,
  TSourceId extends string = string,
  TEndpoint extends string = string,
> = Readonly<{
  kind: 'endpoint';
  method: 'GET';
  sourceId: TSourceId;
  endpoint: TEndpoint;
  requirement: TRequirement;
  request: GraphSourceRequest<TContext>;
  decode: GraphSourceDecoder<TValue>;
}>;

export type GraphRequiredSourceDefinition<
  TContext extends GraphSourceContext,
  TValue,
  TSourceId extends string = string,
  TEndpoint extends string = string,
> = GraphSourceDefinition<
  TContext,
  TValue,
  'required',
  TSourceId,
  TEndpoint
>;

export type GraphOptionalSourceDefinition<
  TContext extends GraphSourceContext,
  TValue,
  TSourceId extends string = string,
  TEndpoint extends string = string,
> = GraphSourceDefinition<
  TContext,
  TValue,
  'optional',
  TSourceId,
  TEndpoint
>;

export type GraphSourceFailure = Readonly<{
  sourceId: string;
  endpoint: string;
  message: string;
}>;

export type GraphOptionalSourceResult<TValue> =
  | Readonly<{
      status: 'available';
      value: TValue;
    }>
  | Readonly<{
      status: 'unavailable';
      failure: GraphSourceFailure;
    }>;

type GraphSourceDefinitionForContext<TContext extends GraphSourceContext> = GraphSourceDefinition<
  TContext,
  unknown,
  GraphSourceRequirement,
  string,
  string
>;

export type GraphSourceMap<TContext extends GraphSourceContext> = Readonly<
  Record<string, GraphSourceDefinitionForContext<TContext>>
>;

type GraphSourceResultShape = Readonly<{
  requirement: GraphSourceRequirement;
  decode: GraphSourceDecoder<unknown>;
}>;

type GraphSourceValue<TSource> =
  TSource extends Readonly<{
    decode: GraphSourceDecoder<infer TValue>;
  }>
    ? TValue
    : never;

type GraphSourceResult<TSource> =
  TSource extends Readonly<{
    requirement: infer TRequirement;
  }>
    ? TRequirement extends 'required'
      ? GraphSourceValue<TSource>
      : TRequirement extends 'optional'
        ? GraphOptionalSourceResult<GraphSourceValue<TSource>>
        : never
    : never;

export type InferGraphSourceBundleData<
  TSources extends Readonly<Record<string, GraphSourceResultShape>>,
> = Readonly<{
  [TName in keyof TSources]: GraphSourceResult<TSources[TName]>;
}>;

declare const graphSourceBundleBrand: unique symbol;

export type GraphSourceBundle<
  TContext extends GraphSourceContext,
  TSources extends GraphSourceMap<TContext>,
> = Readonly<{
  kind: 'source-bundle';
  sources: TSources;
  readonly [graphSourceBundleBrand]: true;
}>;

export type GraphLocalNodeSourceContract = Readonly<{
  kind: 'local';
}>;

export type GraphEndpointBackedNodeSourceContract<
  TContext extends GraphSourceContext,
  TSources extends GraphSourceMap<TContext> = GraphSourceMap<TContext>,
> = Readonly<{
  kind: 'endpoint-backed';
  sourceBundle: GraphSourceBundle<TContext, TSources>;
}>;

export type GraphNodeSourceContract<
  TContext extends GraphSourceContext,
  TSources extends GraphSourceMap<TContext> = GraphSourceMap<TContext>,
> =
  | GraphLocalNodeSourceContract
  | GraphEndpointBackedNodeSourceContract<TContext, TSources>;

type NonEmptyGraphSourceMap<
  TContext extends GraphSourceContext,
  TSources extends GraphSourceMap<TContext>,
> = keyof TSources extends never ? never : TSources;

type RequiredSourceInput<
  TContext extends GraphSourceContext,
  TValue,
  TSourceId extends string,
  TEndpoint extends string,
> = Readonly<{
  sourceId: TSourceId;
  endpoint: TEndpoint;
  request: GraphSourceRequest<TContext>;
  decode: GraphSourceDecoder<TValue>;
}>;

function defineSource<
  TContext extends GraphSourceContext,
  TValue,
  TRequirement extends GraphSourceRequirement,
  TSourceId extends string,
  TEndpoint extends string,
>(
  requirement: TRequirement,
  definition: RequiredSourceInput<
    TContext,
    TValue,
    TSourceId,
    TEndpoint
  >,
): GraphSourceDefinition<
  TContext,
  TValue,
  TRequirement,
  TSourceId,
  TEndpoint
> {
  if (definition.sourceId.trim().length === 0) {
    throw new Error('Graph sourceId must be a non-empty string.');
  }

  if (!definition.endpoint.startsWith('/')) {
    throw new Error('Graph source endpoint must start with "/".');
  }

  return Object.freeze({
    kind: 'endpoint',
    method: 'GET',
    sourceId: definition.sourceId,
    endpoint: definition.endpoint,
    requirement,
    request: definition.request,
    decode: definition.decode,
  });
}

export function graphSourcesFor<TContext extends GraphSourceContext>() {
  return Object.freeze({
    required<
      TValue,
      const TSourceId extends string,
      const TEndpoint extends string,
    >(
      definition: RequiredSourceInput<
        TContext,
        TValue,
        TSourceId,
        TEndpoint
      >,
    ): GraphRequiredSourceDefinition<
      TContext,
      TValue,
      TSourceId,
      TEndpoint
    > {
      return defineSource('required', definition);
    },

    optional<
      TValue,
      const TSourceId extends string,
      const TEndpoint extends string,
    >(
      definition: RequiredSourceInput<
        TContext,
        TValue,
        TSourceId,
        TEndpoint
      >,
    ): GraphOptionalSourceDefinition<
      TContext,
      TValue,
      TSourceId,
      TEndpoint
    > {
      return defineSource('optional', definition);
    },

    bundle<const TSources extends GraphSourceMap<TContext>>(
      sources: NonEmptyGraphSourceMap<TContext, TSources>,
    ): GraphSourceBundle<TContext, TSources> {
      const entries = Object.entries(sources);
      if (entries.length === 0) {
        throw new Error(
          'An endpoint-backed graph source bundle must contain at least one named source.',
        );
      }

      const sourceIds = new Set<string>();
      for (const [name, source] of entries) {
        if (name.trim().length === 0) {
          throw new Error('Graph source bundle names must be non-empty.');
        }
        if (sourceIds.has(source.sourceId)) {
          throw new Error(
            `Duplicate graph sourceId "${source.sourceId}" in one source bundle.`,
          );
        }
        sourceIds.add(source.sourceId);
      }

      const frozenSources = Object.freeze({ ...sources }) as TSources;
      return Object.freeze({
        kind: 'source-bundle' as const,
        sources: frozenSources,
      }) as GraphSourceBundle<TContext, TSources>;
    },

    endpointBacked<const TSources extends GraphSourceMap<TContext>>(
      sourceBundle: GraphSourceBundle<TContext, TSources>,
    ): GraphEndpointBackedNodeSourceContract<TContext, TSources> {
      return Object.freeze({
        kind: 'endpoint-backed',
        sourceBundle,
      });
    },

    local(): GraphLocalNodeSourceContract {
      return Object.freeze({
        kind: 'local',
      });
    },
  });
}

export function decodeGraphSource<
  TContext extends GraphSourceContext,
  TValue,
  TRequirement extends GraphSourceRequirement,
  TSourceId extends string,
  TEndpoint extends string,
>(
  source: GraphSourceDefinition<
    TContext,
    TValue,
    TRequirement,
    TSourceId,
    TEndpoint
  >,
  input: unknown,
): TValue {
  return source.decode(input);
}
