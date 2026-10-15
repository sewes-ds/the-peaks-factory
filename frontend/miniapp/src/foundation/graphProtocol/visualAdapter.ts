export type GraphVisualStateTuple<
  TState extends string = string,
> = readonly [TState, ...TState[]];

export type GraphVisualStateMapping<
  TStates extends GraphVisualStateTuple,
  TVariant extends string,
> = Readonly<Record<TStates[number], TVariant>>;

export type GraphVisualAdapter<
  TStates extends GraphVisualStateTuple,
  TVariant extends string,
> = Readonly<{
  kind: 'graph-visual-adapter';
  states: TStates;
  mapping: GraphVisualStateMapping<TStates, TVariant>;
  decode: (input: unknown) => TStates[number];
  adapt: (state: TStates[number]) => TVariant;
  fromUnknown: (input: unknown) => TVariant;
}>;

export type GraphVisualState<TAdapter> =
  TAdapter extends Readonly<{
    states: infer TStates;
  }>
    ? TStates extends GraphVisualStateTuple
      ? TStates[number]
      : never
    : never;

export type GraphRendererVariant<TAdapter> =
  TAdapter extends Readonly<{
    adapt: (...args: never[]) => infer TVariant;
  }>
    ? TVariant extends string
      ? TVariant
      : never
    : never;

export class GraphVisualStateValidationError extends Error {
  readonly value: unknown;

  constructor(message: string, value: unknown) {
    super(message);
    this.name = 'GraphVisualStateValidationError';
    this.value = value;
  }
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

export function graphVisualAdapterFor<
  TVariant extends string,
>() {
  return Object.freeze({
    define<
      const TStates extends GraphVisualStateTuple,
    >(
      definition: Readonly<{
        states: TStates;
        mapping: GraphVisualStateMapping<
          NoInfer<TStates>,
          TVariant
        >;
      }>,
    ): GraphVisualAdapter<TStates, TVariant> {
      const states = [...definition.states];

      if (states.length === 0) {
        throw new Error(
          'Graph visual adapter must declare at least one source state.',
        );
      }

      const stateSet = new Set<string>();

      for (const state of states) {
        if (state.trim().length === 0) {
          throw new Error(
            'Graph visual states must be non-empty strings.',
          );
        }

        if (stateSet.has(state)) {
          throw new Error(
            `Duplicate graph visual state "${state}".`,
          );
        }

        stateSet.add(state);
      }

      if (!isPlainRecord(definition.mapping)) {
        throw new Error(
          'Graph visual adapter mapping must be a plain object.',
        );
      }

      for (const state of states) {
        if (!(state in definition.mapping)) {
          throw new Error(
            `Missing graph visual mapping for state "${state}".`,
          );
        }
      }

      const runtimeMapping = definition.mapping as Readonly<
        Record<string, unknown>
      >;

      for (const key of Object.keys(runtimeMapping)) {
        if (!stateSet.has(key)) {
          throw new Error(
            `Unknown graph visual mapping state "${key}".`,
          );
        }

        const variant = runtimeMapping[key];

        if (
          typeof variant !== 'string' ||
          variant.trim().length === 0
        ) {
          throw new Error(
            `Graph visual mapping for state "${key}" must name a non-empty renderer variant.`,
          );
        }
      }

      const frozenStates = Object.freeze([
        ...states,
      ]) as unknown as TStates;

      const frozenMapping = Object.freeze({
        ...definition.mapping,
      }) as GraphVisualStateMapping<TStates, TVariant>;

      const decode = (
        input: unknown,
      ): TStates[number] => {
        if (
          typeof input !== 'string' ||
          !stateSet.has(input)
        ) {
          throw new GraphVisualStateValidationError(
            `Unknown graph visual state "${String(input)}".`,
            input,
          );
        }

        return input as TStates[number];
      };

      const adapt = (
        state: TStates[number],
      ): TVariant => {
        const decodedState = decode(state);
        return frozenMapping[decodedState];
      };

      const fromUnknown = (
        input: unknown,
      ): TVariant => adapt(decode(input));

      return Object.freeze({
        kind: 'graph-visual-adapter' as const,
        states: frozenStates,
        mapping: frozenMapping,
        decode,
        adapt,
        fromUnknown,
      });
    },
  });
}
