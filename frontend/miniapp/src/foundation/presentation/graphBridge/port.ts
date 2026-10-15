import type {
  GraphRuntimeActionDescriptor,
} from '../../graphRuntime';

export type PresentationGraphExecutionPort = Readonly<{
  activationId: number;
  nodeId: string;
  describe: (action: object) => GraphRuntimeActionDescriptor;
  execute: (action: object) => Promise<unknown>;
}>;

export const PRESENTATION_GRAPH_EXECUTION_PORT_ERROR_CODES = Object.freeze([
  'INVALID_GRAPH_EXECUTION_PORT',
  'UNKNOWN_GRAPH_EXECUTION_PORT_FIELD',
  'INVALID_GRAPH_ACTIVATION_ID',
  'INVALID_GRAPH_NODE_ID',
  'INVALID_GRAPH_DESCRIBE',
  'INVALID_GRAPH_EXECUTE',
  'GRAPH_EXECUTION_PORT_NOT_OWNED',
] as const);

export type PresentationGraphExecutionPortErrorCode =
  typeof PRESENTATION_GRAPH_EXECUTION_PORT_ERROR_CODES[number];

export class PresentationGraphExecutionPortError extends Error {
  readonly code: PresentationGraphExecutionPortErrorCode;

  constructor(code: PresentationGraphExecutionPortErrorCode) {
    super(code);
    this.name = 'PresentationGraphExecutionPortError';
    this.code = code;
    Object.freeze(this);
  }
}

const ownedPorts = new WeakSet<object>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function definePresentationGraphExecutionPort(
  input: unknown,
): PresentationGraphExecutionPort {
  if (!isPlainObject(input)) {
    throw new PresentationGraphExecutionPortError(
      'INVALID_GRAPH_EXECUTION_PORT',
    );
  }
  for (const field of Object.keys(input)) {
    if (
      field !== 'activationId' &&
      field !== 'nodeId' &&
      field !== 'describe' &&
      field !== 'execute'
    ) {
      throw new PresentationGraphExecutionPortError(
        'UNKNOWN_GRAPH_EXECUTION_PORT_FIELD',
      );
    }
  }
  if (
    typeof input.activationId !== 'number' ||
    !Number.isSafeInteger(input.activationId) ||
    input.activationId <= 0
  ) {
    throw new PresentationGraphExecutionPortError(
      'INVALID_GRAPH_ACTIVATION_ID',
    );
  }
  if (
    typeof input.nodeId !== 'string' ||
    input.nodeId.trim().length === 0
  ) {
    throw new PresentationGraphExecutionPortError('INVALID_GRAPH_NODE_ID');
  }
  if (typeof input.describe !== 'function') {
    throw new PresentationGraphExecutionPortError('INVALID_GRAPH_DESCRIBE');
  }
  if (typeof input.execute !== 'function') {
    throw new PresentationGraphExecutionPortError('INVALID_GRAPH_EXECUTE');
  }

  const output = Object.freeze({
    activationId: input.activationId,
    nodeId: input.nodeId.trim(),
    describe: input.describe as PresentationGraphExecutionPort['describe'],
    execute: input.execute as PresentationGraphExecutionPort['execute'],
  });
  ownedPorts.add(output);
  return output;
}

export function isPresentationGraphExecutionPortOwned(
  value: unknown,
): value is PresentationGraphExecutionPort {
  return (
    typeof value === 'object' &&
    value !== null &&
    ownedPorts.has(value)
  );
}
