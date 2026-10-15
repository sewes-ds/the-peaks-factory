import type {
  GraphContextScalar,
  GraphContextSchema,
  InferGraphContext,
} from './context';
import type {
  GraphEndpointBackedNodeSourceContract,
  GraphLocalNodeSourceContract,
  GraphSourceMap,
  InferGraphSourceBundleData,
} from './source';

export type GraphNodeProjection = Readonly<
  Record<string, unknown> & {
    nodeId?: never;
  }
>;

type GraphNodeContext<TSchema extends GraphContextSchema> =
  InferGraphContext<TSchema>;

export type GraphLocalNodeProjector<
  TContext extends Readonly<Record<string, GraphContextScalar>>,
> = (
  input: Readonly<{
    context: TContext;
  }>,
) => GraphNodeProjection;

export type GraphEndpointBackedNodeProjector<
  TContext extends Readonly<Record<string, GraphContextScalar>>,
  TSources extends GraphSourceMap<TContext>,
> = (
  input: Readonly<{
    context: TContext;
    sources: InferGraphSourceBundleData<TSources>;
  }>,
) => GraphNodeProjection;

export type GraphLocalNodeDefinition<
  TSchema extends GraphContextSchema,
> = Readonly<{
  kind: 'local';
  context: TSchema;
  source: GraphLocalNodeSourceContract;
  project: GraphLocalNodeProjector<GraphNodeContext<TSchema>>;
}>;

export type GraphEndpointBackedNodeDefinition<
  TSchema extends GraphContextSchema,
  TSources extends GraphSourceMap<GraphNodeContext<TSchema>>,
> = Readonly<{
  kind: 'endpoint-backed';
  context: TSchema;
  source: GraphEndpointBackedNodeSourceContract<
    GraphNodeContext<TSchema>,
    TSources
  >;
  project: GraphEndpointBackedNodeProjector<
    GraphNodeContext<TSchema>,
    TSources
  >;
}>;

type GraphEndpointBackedNodeSourceIdentity = Readonly<{
  kind: 'endpoint-backed';
  sourceBundle: Readonly<{
    kind: 'source-bundle';
  }>;
}>;

type GraphLocalNodeDefinitionIdentity = Readonly<{
  kind: 'local';
  context: GraphContextSchema;
  source: GraphLocalNodeSourceContract;
  project: (...args: never[]) => GraphNodeProjection;
}>;

type GraphEndpointBackedNodeDefinitionIdentity = Readonly<{
  kind: 'endpoint-backed';
  context: GraphContextSchema;
  source: GraphEndpointBackedNodeSourceIdentity;
  project: (...args: never[]) => GraphNodeProjection;
}>;

export type GraphNodeDefinition =
  | GraphLocalNodeDefinitionIdentity
  | GraphEndpointBackedNodeDefinitionIdentity;

export type GraphNodeMap = Readonly<
  Record<string, GraphNodeDefinition>
>;

declare const graphDefinitionBrand: unique symbol;

export type GraphDefinition<
  TNodes extends GraphNodeMap = GraphNodeMap,
> = Readonly<{
  kind: 'graph-definition';
  nodes: TNodes;
  readonly [graphDefinitionBrand]: true;
}>;

export type GraphNodeId<
  TGraph extends GraphDefinition<GraphNodeMap>,
> = Extract<keyof TGraph['nodes'], string>;

type NonEmptyGraphNodeMap<TNodes extends GraphNodeMap> =
  keyof TNodes extends never ? never : TNodes;

export function graphNodesFor<
  const TSchema extends GraphContextSchema,
>(context: TSchema) {
  type TContext = GraphNodeContext<TSchema>;

  return Object.freeze({
    local(
      definition: Readonly<{
        source: GraphLocalNodeSourceContract;
        project: GraphLocalNodeProjector<TContext>;
      }>,
    ): GraphLocalNodeDefinition<TSchema> {
      return Object.freeze({
        kind: 'local',
        context,
        source: definition.source,
        project: definition.project,
      });
    },

    endpointBacked<
      const TSources extends GraphSourceMap<TContext>,
    >(
      definition: Readonly<{
        source: GraphEndpointBackedNodeSourceContract<
          TContext,
          TSources
        >;
        project: GraphEndpointBackedNodeProjector<
          TContext,
          TSources
        >;
      }>,
    ): GraphEndpointBackedNodeDefinition<TSchema, TSources> {
      return Object.freeze({
        kind: 'endpoint-backed',
        context,
        source: definition.source,
        project: definition.project,
      });
    },
  });
}

export function defineGraph<
  const TNodes extends GraphNodeMap,
>(
  nodes: NonEmptyGraphNodeMap<TNodes>,
): GraphDefinition<TNodes> {
  const entries = Object.entries(nodes);

  if (entries.length === 0) {
    throw new Error(
      'Graph definition must contain at least one node.',
    );
  }

  for (const [nodeId] of entries) {
    if (nodeId.trim().length === 0) {
      throw new Error(
        'Graph node IDs must be non-empty strings.',
      );
    }
  }

  return Object.freeze({
    kind: 'graph-definition' as const,
    nodes: Object.freeze({ ...nodes }) as TNodes,
  }) as GraphDefinition<TNodes>;
}
