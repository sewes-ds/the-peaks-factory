import { describe, expect, it } from 'vitest';
import { createGraphActivationRuntime } from '../foundation/graphRuntime';
import { SECTION02_FIXTURE_CONTEXTS, createSection02FixtureApiClient } from './__fixtures__/section02Fixtures';
import { SECTION02_BUSINESS_ACTION_IDS } from './commands';
import { isSection02ContextScalarOnly } from './context';
import { SECTION02_FAMILIES, SECTION02_NODE_IDS } from './ids';
import { SECTION02_LOADER_ENDPOINTS } from './loaders';
import { createSection02Program } from './program';
import { SECTION02_FORWARD_TARGETS, SECTION02_NODE_REGISTRY } from './topology';

describe('Section 02 program', () => {
  it('defines exactly the canonical nodes across the seven bounded families', () => {
    const program = createSection02Program(createSection02FixtureApiClient('S02-N02'));
    expect(Object.keys(program.graph.nodes)).toEqual(SECTION02_NODE_IDS);
    expect(Object.values(SECTION02_FAMILIES).flat()).toEqual(SECTION02_NODE_IDS);
    expect(new Set(Object.values(SECTION02_FAMILIES).flat()).size).toBe(26);
  });

  it('binds every endpoint-backed node to the exact declared source endpoint set', () => {
    for (const definition of Object.values(SECTION02_NODE_REGISTRY)) {
      if (definition.loader === null) continue;
      expect(SECTION02_LOADER_ENDPOINTS[definition.loader].every((path) => path.startsWith('/operator/'))).toBe(true);
    }
  });

  it('keeps all fixture route context scalar-only', () => {
    for (const nodeId of SECTION02_NODE_IDS) expect(isSection02ContextScalarOnly(SECTION02_FIXTURE_CONTEXTS[nodeId])).toBe(true);
  });

  it('makes all canonical nodes reachable without inventing a node', () => {
    const reached = new Set<string>();
    const pending = ['S02-N01'];
    const mutationTargets: Readonly<Record<string, readonly string[]>> = {
      'S02-N01': ['S02-N02'], 'S02-SKUQR01': ['S02-N02'], 'S02-N05': ['S02-N02'], 'S02-N08': ['S02-N02'], 'S02-B01': ['S02-N02'], 'S02-B03': ['S02-N02'],
      'S02-N09': ['S02-N02'], 'S02-N27': ['S02-N28'], 'S02-N10': ['S02-N02'], 'S02-AW02': ['S02-N11'],
      'S02-AW03': ['S02-N11'], 'S02-AW04': ['S02-AW05'], 'S02-FS01': ['S02-N01'],
    };
    while (pending.length > 0) {
      const current = pending.shift()!;
      if (reached.has(current)) continue;
      reached.add(current);
      for (const target of [...(SECTION02_FORWARD_TARGETS[current as keyof typeof SECTION02_FORWARD_TARGETS] ?? []), ...(mutationTargets[current] ?? [])]) if (!reached.has(target)) pending.push(target);
    }
    expect([...reached].sort()).toEqual([...SECTION02_NODE_IDS].sort());
  });

  it.each(Object.entries(SECTION02_FAMILIES))('%s activates every family node with fresh fixture reads', async (_family, nodes) => {
    for (const nodeId of nodes) {
      const requests: import('./__fixtures__/section02Fixtures').Section02FixtureRequest[] = [];
      const runtime = createGraphActivationRuntime(createSection02Program(
        createSection02FixtureApiClient(nodeId, requests),
        { scan: async () => ({ status: 'scanned', text: `peaks-machine:v1:${'D'.repeat(32)}` }) },
      ));
      const result = await runtime.activate({ nodeId, context: SECTION02_FIXTURE_CONTEXTS[nodeId] });
      expect(result.status, nodeId).toBe('ready');
      if (SECTION02_NODE_REGISTRY[nodeId].loader !== null) expect(requests.length, nodeId).toBeGreaterThan(0);
      requests.length = 0;
      await runtime.activate({ nodeId, context: SECTION02_FIXTURE_CONTEXTS[nodeId] });
      if (SECTION02_NODE_REGISTRY[nodeId].loader !== null) expect(requests.length, nodeId).toBeGreaterThan(0);
    }
  });

  it('registers the complete mutation inventory once', () => {
    expect(SECTION02_BUSINESS_ACTION_IDS).toHaveLength(12);
    expect(new Set(SECTION02_BUSINESS_ACTION_IDS).size).toBe(12);
  });
});
