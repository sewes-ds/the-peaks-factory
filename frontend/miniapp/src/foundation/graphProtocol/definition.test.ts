import { describe, expect, it } from 'vitest';

import {
  defineGraphContext,
  graphContext,
  type InferGraphContext,
} from './context';
import {
  defineGraph,
  graphNodesFor,
} from './definition';
import { graphSourcesFor } from './source';

describe('Graph Protocol definition identity', () => {
  const contextSchema = defineGraphContext({
    employee_id: graphContext.id(),
  });

  type EmployeeContext = InferGraphContext<
    typeof contextSchema
  >;

  const sources = graphSourcesFor<EmployeeContext>();

  const sourceBundle = sources.bundle({
    employee: sources.required({
      sourceId: 'manager.employee',
      endpoint: '/manager/employees/:employee_id',
      request: async () => ({}),
      decode: (input: unknown) => ({
        employee_id: String(
          (input as { employee_id?: unknown }).employee_id ?? '',
        ),
      }),
    }),
  });

  const nodes = graphNodesFor(contextSchema);

  const localNode = nodes.local({
    source: sources.local(),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  });

  const endpointNode = nodes.endpointBacked({
    source: sources.endpointBacked(sourceBundle),
    project: ({ context, sources: sourceData }) => ({
      contextEmployeeId: context.employee_id,
      sourceEmployeeId: sourceData.employee.employee_id,
    }),
  });

  it('owns canonical node identity only through graph map keys', () => {
    const graph = defineGraph({
      'S03-E02': endpointNode,
      'S03-E10': localNode,
    });

    expect(Object.keys(graph.nodes)).toEqual([
      'S03-E02',
      'S03-E10',
    ]);
    expect('id' in graph.nodes['S03-E02']).toBe(false);
    expect('nodeId' in graph.nodes['S03-E02']).toBe(false);
    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.nodes)).toBe(true);
  });

  it('keeps local nodes coupled to local sources and context-only projection', () => {
    expect(localNode.kind).toBe('local');
    expect(localNode.source.kind).toBe('local');
    expect(
      localNode.project({
        context: {
          employee_id: '1',
        },
      }),
    ).toEqual({
      employeeId: '1',
    });
  });

  it('keeps endpoint-backed nodes coupled to typed source-bundle projection', () => {
    expect(endpointNode.kind).toBe('endpoint-backed');
    expect(endpointNode.source.kind).toBe('endpoint-backed');

    expect(
      endpointNode.project({
        context: {
          employee_id: '1',
        },
        sources: {
          employee: {
            employee_id: '1',
          },
        },
      }),
    ).toEqual({
      contextEmployeeId: '1',
      sourceEmployeeId: '1',
    });
  });

  it('rejects an empty graph at runtime even across an unsafe cast boundary', () => {
    expect(() => defineGraph({} as never)).toThrow(
      'Graph definition must contain at least one node.',
    );
  });

  it('rejects blank canonical node IDs at runtime', () => {
    expect(() =>
      defineGraph({
        '   ': localNode,
      }),
    ).toThrow(
      'Graph node IDs must be non-empty strings.',
    );
  });
});
