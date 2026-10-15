import { describe, expect, it, vi } from 'vitest';

import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
} from '../graphProtocol/action';
import {
  defineGraphContext,
  graphContext,
} from '../graphProtocol/context';
import {
  defineGraph,
  graphNodesFor,
} from '../graphProtocol/definition';
import {
  graphInteraction,
  graphInteractionsFor,
} from '../graphProtocol/interaction';
import {
  defineGraphProgram,
} from '../graphProtocol/program';
import {
  graphSourcesFor,
  type GraphOptionalSourceResult,
} from '../graphProtocol/source';
import {
  GraphActivationError,
  createGraphActivationRuntime,
} from './activation';

type EmployeeReadModel = Readonly<{
  employee_id: string;
  revision: number;
}>;

type HintReadModel = Readonly<{
  text: string;
}>;

type RuntimeContext = Readonly<{
  employee_id: string;
  mode: 'view' | 'edit';
}>;

type FixtureOptions = Readonly<{
  employeeRequest?: (
    context: RuntimeContext,
  ) => Promise<unknown>;
  hintRequest?: (
    context: RuntimeContext,
  ) => Promise<unknown>;
  employeeDecode?: (
    input: unknown,
  ) => EmployeeReadModel;
  hintDecode?: (
    input: unknown,
  ) => HintReadModel;
  endpointProject?: (
    input: Readonly<{
      context: RuntimeContext;
      employee: EmployeeReadModel;
      hint: GraphOptionalSourceResult<HintReadModel>;
    }>,
  ) => Readonly<Record<string, unknown>>;
  localProject?: (
    context: RuntimeContext,
  ) => Readonly<Record<string, unknown>>;
}>;

function decodeEmployee(input: unknown): EmployeeReadModel {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('employee_id' in input) ||
    !('revision' in input) ||
    typeof input.employee_id !== 'string' ||
    typeof input.revision !== 'number'
  ) {
    throw new Error('invalid employee');
  }

  return Object.freeze({
    employee_id: input.employee_id,
    revision: input.revision,
  });
}

function decodeHint(input: unknown): HintReadModel {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('text' in input) ||
    typeof input.text !== 'string'
  ) {
    throw new Error('invalid hint');
  }

  return Object.freeze({
    text: input.text,
  });
}

function makeFixture(options: FixtureOptions = {}) {
  const context = defineGraphContext({
    employee_id: graphContext.id(),
    mode: graphContext.mode('view', 'edit'),
  });

  const sources = graphSourcesFor<RuntimeContext>();

  const employee = sources.required<
    EmployeeReadModel,
    'employee',
    '/manager/employees/:id'
  >({
    sourceId: 'employee',
    endpoint: '/manager/employees/:id',
    request:
      options.employeeRequest ??
      (async (requestContext) => ({
        employee_id: requestContext.employee_id,
        revision: 1,
      })),
    decode: options.employeeDecode ?? decodeEmployee,
  });

  const hint = sources.optional<
    HintReadModel,
    'hint',
    '/manager/employees/:id/hint'
  >({
    sourceId: 'hint',
    endpoint: '/manager/employees/:id/hint',
    request:
      options.hintRequest ??
      (async () => ({
        text: 'ready',
      })),
    decode: options.hintDecode ?? decodeHint,
  });

  const graph = defineGraph({
    ENDPOINT: graphNodesFor(context).endpointBacked({
      source: sources.endpointBacked(
        sources.bundle({
          employee,
          hint,
        }),
      ),
      project: ({ context: currentContext, sources: currentSources }) => {
        if (options.endpointProject) {
          return options.endpointProject({
            context: currentContext,
            employee: currentSources.employee,
            hint: currentSources.hint,
          });
        }

        return {
          employeeId: currentContext.employee_id,
          revision: currentSources.employee.revision,
          hintStatus: currentSources.hint.status,
          hint:
            currentSources.hint.status === 'available'
              ? currentSources.hint.value.text
              : null,
        };
      },
    }),
    LOCAL: graphNodesFor(context).local({
      source: sources.local(),
      project: ({ context: currentContext }) =>
        options.localProject?.(currentContext) ?? {
          employeeId: currentContext.employee_id,
          mode: currentContext.mode,
        },
    }),
  });

  const noEvent = defineGraphActionEvent({});

  const actions = defineGraphActions({
    business: {},
    presentation: {
      back: graphAction.presentation(
        noEvent,
        graphAction.actionButton({
          label: 'Назад',
          icon: 'back.svg',
          variant: 'outlineBlue',
        }),
      ),
    },
  });

  const scope = graphInteractionsFor(
    graph,
    actions,
  ).node('LOCAL');

  const back = scope.presentation({
    action: 'back',
    effect: graphInteraction.back(),
  });

  const interactions = scope.define({
    business: [],
    presentation: [back],
  });

  const program = defineGraphProgram({
    graph,
    actions,
    interactions: {
      LOCAL: interactions,
    },
  });

  return {
    program,
  };
}

function deferred<TValue>() {
  let resolve!: (
    value: TValue | PromiseLike<TValue>,
  ) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<TValue>(
    (resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    },
  );

  return {
    promise,
    resolve,
    reject,
  };
}

describe('Graph Runtime activation lifecycle', () => {
  it('validates and projects a local node without endpoint loading', async () => {
    const employeeRequest = vi.fn(async () => ({
      employee_id: 'E-1',
      revision: 1,
    }));
    const hintRequest = vi.fn(async () => ({
      text: 'unused',
    }));

    const { program } = makeFixture({
      employeeRequest,
      hintRequest,
    });
    const runtime = createGraphActivationRuntime(program);

    const result = await runtime.activate({
      nodeId: 'LOCAL',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    expect(result).toMatchObject({
      status: 'ready',
      activationId: 1,
      nodeId: 'LOCAL',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
      sources: null,
      projection: {
        employeeId: 'E-1',
        mode: 'view',
      },
    });
    expect(employeeRequest).not.toHaveBeenCalled();
    expect(hintRequest).not.toHaveBeenCalled();
    expect(runtime.getState()).toBe(result);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('reports unknown nodes and invalid contexts before projection', async () => {
    const localProject = vi.fn(() => ({
      rendered: true,
    }));

    const { program } = makeFixture({
      localProject,
    });
    const runtime = createGraphActivationRuntime(program);

    const unknown = await runtime.activate({
      nodeId: 'UNKNOWN',
      context: {},
    });

    expect(unknown.status).toBe('error');
    if (unknown.status === 'error') {
      expect(unknown.error).toBeInstanceOf(
        GraphActivationError,
      );
      expect(unknown.error.code).toBe('UNKNOWN_NODE');
    }

    const invalid = await runtime.activate({
      nodeId: 'LOCAL',
      context: {
        mode: 'view',
      },
    });

    expect(invalid.status).toBe('error');
    if (invalid.status === 'error') {
      expect(invalid.error.code).toBe('INVALID_CONTEXT');
      expect(invalid.error.nodeId).toBe('LOCAL');
    }

    expect(localProject).not.toHaveBeenCalled();
    expect(runtime.getState()).toBe(invalid);
  });

  it('loads and decodes every endpoint source fresh on every activation', async () => {
    let employeeRevision = 0;
    let hintRevision = 0;

    const employeeRequest = vi.fn(async (context: RuntimeContext) => ({
      employee_id: context.employee_id,
      revision: ++employeeRevision,
    }));

    const hintRequest = vi.fn(async () => ({
      text: `hint-${++hintRevision}`,
    }));

    const { program } = makeFixture({
      employeeRequest,
      hintRequest,
    });
    const runtime = createGraphActivationRuntime(program);

    const first = await runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    const second = await runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    expect(first).toMatchObject({
      status: 'ready',
      activationId: 1,
      projection: {
        revision: 1,
        hint: 'hint-1',
      },
    });
    expect(second).toMatchObject({
      status: 'ready',
      activationId: 2,
      projection: {
        revision: 2,
        hint: 'hint-2',
      },
    });
    expect(employeeRequest).toHaveBeenCalledTimes(2);
    expect(hintRequest).toHaveBeenCalledTimes(2);
  });

  it('projects optional source failures as explicit unavailable data', async () => {
    let hintCall = 0;

    const { program } = makeFixture({
      hintRequest: async () => {
        hintCall += 1;
        if (hintCall === 1) {
          throw new Error('hint request failed');
        }

        return {
          text: 42,
        };
      },
    });
    const runtime = createGraphActivationRuntime(program);

    const requestFailure = await runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    const decodeFailure = await runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    expect(requestFailure).toMatchObject({
      status: 'ready',
      projection: {
        hintStatus: 'unavailable',
        hint: null,
      },
    });
    expect(decodeFailure).toMatchObject({
      status: 'ready',
      projection: {
        hintStatus: 'unavailable',
        hint: null,
      },
    });

    if (decodeFailure.status === 'ready') {
      expect(decodeFailure.sources).toMatchObject({
        hint: {
          status: 'unavailable',
          failure: {
            sourceId: 'hint',
          },
        },
      });
    }
  });

  it('turns required source failure into node error and skips projection', async () => {
    const endpointProject = vi.fn(() => ({
      rendered: true,
    }));

    const { program } = makeFixture({
      employeeRequest: async () => {
        throw new Error('employee unavailable');
      },
      endpointProject,
    });
    const runtime = createGraphActivationRuntime(program);

    const result = await runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe(
        'REQUIRED_SOURCE_FAILED',
      );
      expect(result.error.sourceFailure).toEqual({
        sourceId: 'employee',
        endpoint: '/manager/employees/:id',
        message: 'employee unavailable',
      });
    }

    expect(endpointProject).not.toHaveBeenCalled();
    expect(runtime.getState()).toBe(result);
  });

  it('suppresses stale completion from an earlier successful activation', async () => {
    const firstResponse = deferred<unknown>();
    let requestCount = 0;

    const { program } = makeFixture({
      employeeRequest: async (context) => {
        requestCount += 1;
        if (requestCount === 1) {
          return firstResponse.promise;
        }

        return {
          employee_id: context.employee_id,
          revision: 2,
        };
      },
    });
    const runtime = createGraphActivationRuntime(program);

    const firstPromise = runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    const second = await runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-2',
        mode: 'edit',
      },
    });

    firstResponse.resolve({
      employee_id: 'E-1',
      revision: 1,
    });

    const first = await firstPromise;

    expect(second).toMatchObject({
      status: 'ready',
      activationId: 2,
      nodeId: 'ENDPOINT',
      projection: {
        employeeId: 'E-2',
        revision: 2,
      },
    });
    expect(first).toEqual({
      status: 'stale',
      activationId: 1,
      nodeId: 'ENDPOINT',
    });
    expect(runtime.getState()).toBe(second);
  });

  it('suppresses stale required-source failure after a newer ready activation', async () => {
    const firstResponse = deferred<unknown>();
    let requestCount = 0;

    const { program } = makeFixture({
      employeeRequest: async (context) => {
        requestCount += 1;
        if (requestCount === 1) {
          return firstResponse.promise;
        }

        return {
          employee_id: context.employee_id,
          revision: 2,
        };
      },
    });
    const runtime = createGraphActivationRuntime(program);

    const firstPromise = runtime.activate({
      nodeId: 'ENDPOINT',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    const second = await runtime.activate({
      nodeId: 'LOCAL',
      context: {
        employee_id: 'E-2',
        mode: 'edit',
      },
    });

    firstResponse.reject(
      new Error('late required failure'),
    );

    const first = await firstPromise;

    expect(first).toEqual({
      status: 'stale',
      activationId: 1,
      nodeId: 'ENDPOINT',
    });
    expect(second).toMatchObject({
      status: 'ready',
      activationId: 2,
      nodeId: 'LOCAL',
    });
    expect(runtime.getState()).toBe(second);
  });

  it('gives a coordinated interaction priority over an in-flight retained refresh', async () => {
    const refreshResponse = deferred<unknown>();
    let employeeRequestCount = 0;

    const { program } = makeFixture({
      employeeRequest: async (context) => {
        employeeRequestCount += 1;
        if (employeeRequestCount === 2) return refreshResponse.promise;
        return {
          employee_id: context.employee_id,
          revision: employeeRequestCount,
        };
      },
    });
    const runtime = createGraphActivationRuntime(program);
    const initial = await runtime.activate({
      nodeId: 'ENDPOINT',
      context: { employee_id: 'E-1', mode: 'view' },
    });
    expect(initial.status).toBe('ready');
    if (initial.status !== 'ready') throw new Error('Expected ready fixture activation.');

    const refresh = runtime.refresh();
    expect(runtime.getState()).toBe(initial);

    const interactionGate = deferred<void>();
    const interaction = runtime.coordinateInteraction(
      initial,
      async () => interactionGate.promise,
    );
    expect(interaction).not.toBeNull();

    const suppressedWhilePending = await runtime.refresh();
    expect(suppressedWhilePending).toEqual({
      status: 'stale',
      activationId: initial.activationId,
      nodeId: 'ENDPOINT',
    });
    expect(employeeRequestCount).toBe(2);

    refreshResponse.resolve({ employee_id: 'E-1', revision: 2 });
    await expect(refresh).resolves.toEqual({
      status: 'stale',
      activationId: initial.activationId + 1,
      nodeId: 'ENDPOINT',
    });
    expect(runtime.getState()).toBe(initial);

    interactionGate.resolve();
    await interaction;
    const refreshedAfterSettle = await runtime.refresh();
    expect(refreshedAfterSettle).toMatchObject({
      status: 'ready',
      nodeId: 'ENDPOINT',
      projection: { revision: 3 },
    });
  });

  it('uses monotonic activation identities and keeps current state frozen', async () => {
    const { program } = makeFixture();
    const runtime = createGraphActivationRuntime(program);

    expect(runtime.getState()).toEqual({
      status: 'idle',
    });
    expect(Object.isFrozen(runtime.getState())).toBe(true);

    const first = await runtime.activate({
      nodeId: 'LOCAL',
      context: {
        employee_id: 'E-1',
        mode: 'view',
      },
    });

    const second = await runtime.activate({
      nodeId: 'LOCAL',
      context: {
        employee_id: 'E-2',
        mode: 'edit',
      },
    });

    expect(first.activationId).toBe(1);
    expect(second.activationId).toBe(2);
    expect(Object.isFrozen(second)).toBe(true);
    if (second.status === 'ready') {
      expect(Object.isFrozen(second.context)).toBe(true);
    }
    expect(runtime.getState()).toBe(second);
  });
});
