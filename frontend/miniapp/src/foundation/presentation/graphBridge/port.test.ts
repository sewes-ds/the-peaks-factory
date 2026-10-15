import { describe, expect, it, vi } from 'vitest';

import {
  PRESENTATION_GRAPH_EXECUTION_PORT_ERROR_CODES,
  PresentationGraphExecutionPortError,
  definePresentationGraphExecutionPort,
  isPresentationGraphExecutionPortOwned,
} from './port';

function code(input: unknown): string {
  try {
    definePresentationGraphExecutionPort(input);
  } catch (error) {
    expect(error).toBeInstanceOf(PresentationGraphExecutionPortError);
    return (error as PresentationGraphExecutionPortError).code;
  }
  throw new Error('Expected port error.');
}

describe('presentation Graph execution port', () => {
  it('creates an exact frozen owned port without mutating input', () => {
    const input = {
      activationId: 7,
      nodeId: ' NODE ',
      describe: vi.fn(),
      execute: vi.fn(async () => undefined),
    };
    const port = definePresentationGraphExecutionPort(input);
    expect(port).toEqual({
      activationId: 7,
      nodeId: 'NODE',
      describe: input.describe,
      execute: input.execute,
    });
    expect(Object.isFrozen(port)).toBe(true);
    expect(isPresentationGraphExecutionPortOwned(port)).toBe(true);
    expect(isPresentationGraphExecutionPortOwned({ ...port })).toBe(false);
    expect(input.nodeId).toBe(' NODE ');
  });

  it('rejects every invalid boundary with exact codes', () => {
    const valid = {
      activationId: 1,
      nodeId: 'NODE',
      describe: vi.fn(),
      execute: vi.fn(async () => undefined),
    };
    expect(code(null)).toBe('INVALID_GRAPH_EXECUTION_PORT');
    expect(code([])).toBe('INVALID_GRAPH_EXECUTION_PORT');
    expect(code({ ...valid, extra: true })).toBe(
      'UNKNOWN_GRAPH_EXECUTION_PORT_FIELD',
    );
    for (const activationId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(code({ ...valid, activationId })).toBe(
        'INVALID_GRAPH_ACTIVATION_ID',
      );
    }
    expect(code({ ...valid, nodeId: ' ' })).toBe('INVALID_GRAPH_NODE_ID');
    expect(code({ ...valid, describe: null })).toBe(
      'INVALID_GRAPH_DESCRIBE',
    );
    expect(code({ ...valid, execute: null })).toBe('INVALID_GRAPH_EXECUTE');
  });

  it('has the exact frozen closed error taxonomy', () => {
    expect(PRESENTATION_GRAPH_EXECUTION_PORT_ERROR_CODES).toEqual([
      'INVALID_GRAPH_EXECUTION_PORT',
      'UNKNOWN_GRAPH_EXECUTION_PORT_FIELD',
      'INVALID_GRAPH_ACTIVATION_ID',
      'INVALID_GRAPH_NODE_ID',
      'INVALID_GRAPH_DESCRIBE',
      'INVALID_GRAPH_EXECUTE',
      'GRAPH_EXECUTION_PORT_NOT_OWNED',
    ]);
    expect(Object.isFrozen(
      PRESENTATION_GRAPH_EXECUTION_PORT_ERROR_CODES,
    )).toBe(true);
  });
});
