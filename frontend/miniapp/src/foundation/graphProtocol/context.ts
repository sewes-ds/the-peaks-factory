export type GraphContextScalar = string | number | boolean | null;

export type GraphContextFieldKind = 'id' | 'input' | 'period' | 'mode';

export type GraphContextValueDecoder<TValue extends GraphContextScalar> = (
  value: unknown,
) => TValue;

export type GraphContextField<
  TValue extends GraphContextScalar,
  TOptional extends boolean = false,
  TKind extends GraphContextFieldKind = GraphContextFieldKind,
> = Readonly<{
  kind: TKind;
  optional: TOptional;
  decode: GraphContextValueDecoder<TValue>;
}>;

export type GraphContextSchema = Readonly<
  Record<
    string,
    GraphContextField<
      GraphContextScalar,
      boolean,
      GraphContextFieldKind
    >
  >
>;

type GraphContextFieldValue<TField> =
  TField extends GraphContextField<infer TValue, boolean> ? TValue : never;

type GraphContextRequiredKeys<TSchema extends GraphContextSchema> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphContextField<
    GraphContextScalar,
    true
  >
    ? never
    : TKey;
}[keyof TSchema];

type GraphContextOptionalKeys<TSchema extends GraphContextSchema> = {
  [TKey in keyof TSchema]-?: TSchema[TKey] extends GraphContextField<
    GraphContextScalar,
    true
  >
    ? TKey
    : never;
}[keyof TSchema];

export type InferGraphContext<TSchema extends GraphContextSchema> = Readonly<
  {
    [TKey in GraphContextRequiredKeys<TSchema>]: GraphContextFieldValue<
      TSchema[TKey]
    >;
  } & {
    [TKey in GraphContextOptionalKeys<TSchema>]?: GraphContextFieldValue<
      TSchema[TKey]
    >;
  }
>;

export class GraphContextValidationError extends Error {
  readonly field: string | null;

  constructor(message: string, field: string | null = null) {
    super(message);
    this.name = 'GraphContextValidationError';
    this.field = field;
  }
}

function requiredField<
  TValue extends GraphContextScalar,
  TKind extends GraphContextFieldKind,
>(
  kind: TKind,
  decode: GraphContextValueDecoder<TValue>,
): GraphContextField<TValue, false, TKind> {
  return Object.freeze({
    kind,
    optional: false,
    decode,
  });
}

function optionalField<
  TValue extends GraphContextScalar,
  TKind extends GraphContextFieldKind,
>(
  kind: TKind,
  decode: GraphContextValueDecoder<TValue>,
): GraphContextField<TValue, true, TKind> {
  return Object.freeze({
    kind,
    optional: true,
    decode,
  });
}

function decodeNonEmptyString(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GraphContextValidationError('Expected a non-empty string.');
  }

  return value;
}

function decodeString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new GraphContextValidationError('Expected a string.');
  }

  return value;
}

function enumDecoder<const TValue extends string>(
  values: readonly [TValue, ...TValue[]],
): GraphContextValueDecoder<TValue> {
  const allowed = new Set<string>(values);

  return (value: unknown): TValue => {
    if (typeof value !== 'string' || !allowed.has(value)) {
      throw new GraphContextValidationError(
        `Expected one of: ${values.join(', ')}.`,
      );
    }

    return value as TValue;
  };
}

function isGraphContextScalar(value: unknown): value is GraphContextScalar {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export const graphContext = Object.freeze({
  id(): GraphContextField<string, false, 'id'> {
    return requiredField('id', decodeNonEmptyString);
  },

  optionalId(): GraphContextField<string, true, 'id'> {
    return optionalField('id', decodeNonEmptyString);
  },

  textInput(): GraphContextField<string, false, 'input'> {
    return requiredField('input', decodeString);
  },

  optionalTextInput(): GraphContextField<string, true, 'input'> {
    return optionalField('input', decodeString);
  },

  scalarInput<TValue extends GraphContextScalar>(
    decode: GraphContextValueDecoder<TValue>,
  ): GraphContextField<TValue, false, 'input'> {
    return requiredField('input', decode);
  },

  optionalScalarInput<TValue extends GraphContextScalar>(
    decode: GraphContextValueDecoder<TValue>,
  ): GraphContextField<TValue, true, 'input'> {
    return optionalField('input', decode);
  },

  period<const TValue extends string>(
    ...values: readonly [TValue, ...TValue[]]
  ): GraphContextField<TValue, false, 'period'> {
    return requiredField('period', enumDecoder(values));
  },

  optionalPeriod<const TValue extends string>(
    ...values: readonly [TValue, ...TValue[]]
  ): GraphContextField<TValue, true, 'period'> {
    return optionalField('period', enumDecoder(values));
  },

  mode<const TValue extends string>(
    ...values: readonly [TValue, ...TValue[]]
  ): GraphContextField<TValue, false, 'mode'> {
    return requiredField('mode', enumDecoder(values));
  },

  optionalMode<const TValue extends string>(
    ...values: readonly [TValue, ...TValue[]]
  ): GraphContextField<TValue, true, 'mode'> {
    return optionalField('mode', enumDecoder(values));
  },
});

export function defineGraphContext<
  const TSchema extends GraphContextSchema,
>(schema: TSchema): TSchema {
  return Object.freeze({ ...schema });
}

function isContextRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export type GraphScalarDataLabels = Readonly<{
  container: string;
  field: string;
}>;

export class GraphScalarDataValidationError extends Error {
  readonly field: string | null;

  constructor(message: string, field: string | null = null) {
    super(message);
    this.name = 'GraphScalarDataValidationError';
    this.field = field;
  }
}

export function parseGraphScalarData<
  const TSchema extends GraphContextSchema,
>(
  schema: TSchema,
  input: unknown,
  labels: GraphScalarDataLabels,
): InferGraphContext<TSchema> {
  if (!isContextRecord(input)) {
    throw new GraphScalarDataValidationError(
      `${labels.container} must be a plain object.`,
    );
  }

  const schemaKeys = new Set(Object.keys(schema));
  for (const key of Object.keys(input)) {
    if (!schemaKeys.has(key)) {
      throw new GraphScalarDataValidationError(
        `Unknown ${labels.field} field "${key}".`,
        key,
      );
    }
  }

  const output: Record<string, GraphContextScalar> = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = input[key];

    if (value === undefined) {
      if (field.optional) {
        continue;
      }

      throw new GraphScalarDataValidationError(
        `Missing required ${labels.field} field "${key}".`,
        key,
      );
    }

    let decoded: GraphContextScalar;
    try {
      decoded = field.decode(value);
    } catch (error: unknown) {
      if (error instanceof GraphContextValidationError) {
        throw new GraphScalarDataValidationError(
          `Invalid ${labels.field} field "${key}": ${error.message}`,
          key,
        );
      }

      throw error;
    }

    if (!isGraphContextScalar(decoded)) {
      throw new GraphScalarDataValidationError(
        `Invalid ${labels.field} field "${key}": decoder returned a non-scalar value.`,
        key,
      );
    }

    output[key] = decoded;
  }

  return Object.freeze(output) as InferGraphContext<TSchema>;
}

export function parseGraphContext<const TSchema extends GraphContextSchema>(
  schema: TSchema,
  input: unknown,
): InferGraphContext<TSchema> {
  try {
    return parseGraphScalarData(
      schema,
      input,
      Object.freeze({
        container: 'Graph context',
        field: 'graph context',
      }),
    );
  } catch (error: unknown) {
    if (error instanceof GraphScalarDataValidationError) {
      throw new GraphContextValidationError(
        error.message,
        error.field,
      );
    }

    throw error;
  }
}
