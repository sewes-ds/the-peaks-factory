import { describe, expect, it } from 'vitest';
import type { ApiRequestOptions } from '../foundation/apiClient';
import { createGraphActivationRuntime, createGraphPresentationExecutionRuntime } from '../foundation/graphRuntime';
import { SECTION02_FIXTURE_CONTEXTS, createSection02FixtureApiClient, type Section02FixtureRequest } from './__fixtures__/section02Fixtures';
import type { Section02BusinessActionId } from './commands';
import type { Section02Context } from './context';
import type { Section02NodeId } from './ids';
import { createSection02Program } from './program';
import { createSection02RuntimeBinding } from './runtimeBinding';

type Case = Readonly<{
  actionId: Section02BusinessActionId;
  nodeId: Section02NodeId;
  destination: Section02NodeId;
  path: string;
  body: unknown;
  context?: Partial<Section02Context>;
}>;

const cases: readonly Case[] = Object.freeze([
  { actionId: 'START_SHIFT', nodeId: 'S02-N01', destination: 'S02-N02', path: '/shifts/start', body: {} },
  { actionId: 'START_PRODUCTION', nodeId: 'S02-N05', destination: 'S02-N02', path: '/production-operations/start', body: { machine_id: '11', sku_id: '21' } },
  { actionId: 'FINISH_PRODUCTION', nodeId: 'S02-N08', destination: 'S02-N02', path: '/production-operations/31/finish', body: { quantity_produced: '12.5' } },
  { actionId: 'START_BREAK', nodeId: 'S02-B01', destination: 'S02-N02', path: '/operator-breaks/start', body: { break_type_id: '41' } },
  { actionId: 'FINISH_BREAK', nodeId: 'S02-B03', destination: 'S02-N02', path: '/operator-breaks/finish', body: {} },
  { actionId: 'START_OPERATIONAL_DOWNTIME', nodeId: 'S02-N09', destination: 'S02-N02', path: '/machine-downtimes/start', body: { machine_id: '11', downtime_type_id: '62', production_operation_id: '31', comment: null }, context: { downtime_type_id: '62', downtime_type_name: 'Наладка оборудования', downtime_class: 'OPERATIONAL' } },
  { actionId: 'START_CRITICAL_DOWNTIME', nodeId: 'S02-N27', destination: 'S02-N28', path: '/machine-downtimes/start', body: { machine_id: '11', downtime_type_id: '61', production_operation_id: '31', comment: 'Остановлен электропривод, требуется диагностика.' } },
  { actionId: 'FINISH_DOWNTIME', nodeId: 'S02-N10', destination: 'S02-N02', path: '/machine-downtimes/51/finish', body: {} },
  { actionId: 'REQUEST_ADDITIONAL_WORK', nodeId: 'S02-AW02', destination: 'S02-N11', path: '/additional-works/request', body: { additional_work_type_id: '81' } },
  { actionId: 'START_ADDITIONAL_WORK', nodeId: 'S02-AW03', destination: 'S02-N11', path: '/additional-works/72/start', body: {}, context: { additional_work_id: '72', additional_work_type_id: '82', additional_work_name: 'Помощь упаковке' } },
  { actionId: 'FINISH_ADDITIONAL_WORK', nodeId: 'S02-AW04', destination: 'S02-AW05', path: '/additional-works/71/finish', body: {} },
  { actionId: 'FINISH_SHIFT', nodeId: 'S02-FS01', destination: 'S02-N01', path: '/shifts/finish', body: {} },
]);

type BusinessFactory = Readonly<{
  business: (actionId: string, input: Readonly<{ instanceId: string; ariaLabel: string }>, event: Section02Context) => readonly object[];
}>;

async function setup(testCase: Case, options: Readonly<{ mutationGate?: Promise<void>; failMutation?: boolean }> = {}) {
  const requests: Section02FixtureRequest[] = [];
  const context = Object.freeze({ ...SECTION02_FIXTURE_CONTEXTS[testCase.nodeId], ...testCase.context });
  const program = createSection02Program(createSection02FixtureApiClient(testCase.nodeId, requests, options));
  const runtime = createGraphActivationRuntime(program);
  const activation = await runtime.activate({ nodeId: testCase.nodeId, context });
  expect(activation.status).toBe('ready');
  const binding = createSection02RuntimeBinding({ runtime, presentationExecution: createGraphPresentationExecutionRuntime(runtime), nodeId: testCase.nodeId, onInteractionStateChange: () => undefined });
  const instances = (binding.actionFactory as unknown as BusinessFactory).business(testCase.actionId, { instanceId: `test-${testCase.actionId}`, ariaLabel: testCase.actionId }, context);
  expect(instances).toHaveLength(1);
  return { binding, instance: instances[0]!, requests, runtime };
}

describe('Section 02 mutation contracts', () => {
  it.each(cases)('$nodeId $actionId binds exact body and fresh deterministic destination', async (testCase) => {
    const current = await setup(testCase);
    const result = await current.binding.execute(current.instance);
    expect(result.result.status).toBe('ready');
    const mutationIndex = current.requests.findIndex((request) => request.method === 'POST');
    expect(current.requests[mutationIndex]).toEqual({ method: 'POST', path: testCase.path, body: testCase.body });
    const destination = current.runtime.getState();
    expect(destination.status).toBe('ready');
    if (destination.status === 'ready') expect(destination.nodeId).toBe(testCase.destination);
    expect(current.requests.slice(mutationIndex + 1).some((request) => request.method === 'GET')).toBe(true);
  });

  it.each(cases)('$nodeId $actionId suppresses a duplicate while pending', async (testCase) => {
    let release!: () => void;
    const mutationGate = new Promise<void>((resolve) => { release = resolve; });
    const current = await setup(testCase, { mutationGate });
    const first = current.binding.execute(current.instance);
    await Promise.resolve();
    const second = current.binding.execute(current.instance);
    await Promise.resolve();
    expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    release();
    await first;
    const secondResult = await second;
    expect(secondResult.result.status).toBe('ready');
  });

  it('prioritizes START_SHIFT over an already in-flight auto-refresh', async () => {
    let releaseRefresh!: () => void;
    let releaseMutation!: () => void;
    const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const mutationGate = new Promise<void>((resolve) => { releaseMutation = resolve; });
    const requests: Section02FixtureRequest[] = [];
    const apiClient = createSection02FixtureApiClient('S02-N01', requests, { mutationGate });
    const request = apiClient.request.bind(apiClient);
    let workplaceReads = 0;
    apiClient.request = async <TResponse,>(path: string, options?: ApiRequestOptions) => {
      const response = request<TResponse>(path, options);
      if (path === '/operator/workplace-state') {
        workplaceReads += 1;
        if (workplaceReads === 2) await refreshGate;
      }
      return response;
    };
    const program = createSection02Program(apiClient);
    const runtime = createGraphActivationRuntime(program);
    const context = SECTION02_FIXTURE_CONTEXTS['S02-N01'];
    const initial = await runtime.activate({ nodeId: 'S02-N01', context });
    expect(initial.status).toBe('ready');
    const binding = createSection02RuntimeBinding({
      runtime,
      presentationExecution: createGraphPresentationExecutionRuntime(runtime),
      nodeId: 'S02-N01',
      onInteractionStateChange: () => undefined,
    });
    const instances = (binding.actionFactory as unknown as BusinessFactory).business(
      'START_SHIFT',
      { instanceId: 'start-shift-refresh-race', ariaLabel: 'START_SHIFT' },
      context,
    );
    expect(instances).toHaveLength(1);

    const refresh = runtime.refresh();
    const execution = binding.execute(instances[0]!);
    await Promise.resolve();
    expect(requests.filter((item) => item.method === 'POST' && item.path === '/shifts/start')).toHaveLength(1);

    releaseRefresh();
    await expect(refresh).resolves.toMatchObject({ status: 'stale', nodeId: 'S02-N01' });
    releaseMutation();
    const result = await execution;

    expect(result.result.status).toBe('ready');
    expect(requests.filter((item) => item.method === 'POST' && item.path === '/shifts/start')).toHaveLength(1);
    const destination = runtime.getState();
    expect(destination.status).toBe('ready');
    if (destination.status === 'ready') expect(destination.nodeId).toBe('S02-N02');
  });

  it.each(cases)('$nodeId $actionId does not retry and retains ready source/context on failure', async (testCase) => {
    const current = await setup(testCase, { failMutation: true });
    const before = current.runtime.getState();
    const result = await current.binding.execute(current.instance);
    expect(result.result.status).toBe('error');
    expect(current.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
    const after = current.runtime.getState();
    expect(after.status).toBe('ready');
    if (after.status === 'ready') expect(after.nodeId).toBe(testCase.nodeId);
    if (before.status === 'ready' && after.status === 'ready') expect(after.context).toEqual(before.context);
    if (testCase.actionId === 'START_ADDITIONAL_WORK') {
      const mutationIndex = current.requests.findIndex((request) => request.method === 'POST');
      expect(current.requests.slice(mutationIndex + 1).filter((request) => request.method === 'GET').length).toBeGreaterThan(0);
    }
  });
});
