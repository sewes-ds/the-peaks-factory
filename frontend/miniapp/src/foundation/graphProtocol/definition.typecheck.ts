import {
  defineGraphContext,
  graphContext,
  type InferGraphContext,
} from './context';
import {
  defineGraph,
  graphNodesFor,
  type GraphNodeId,
} from './definition';
import { graphSourcesFor } from './source';

const employeeContextSchema = defineGraphContext({
  employee_id: graphContext.id(),
});

type EmployeeContext = InferGraphContext<
  typeof employeeContextSchema
>;

const employeeSources = graphSourcesFor<EmployeeContext>();

const employeeBundle = employeeSources.bundle({
  employee: employeeSources.required({
    sourceId: 'manager.employee',
    endpoint: '/manager/employees/:employee_id',
    request: async () => ({}),
    decode: (input: unknown) => ({
      raw: input,
    }),
  }),
});

const employeeNodes = graphNodesFor(employeeContextSchema);

const graph = defineGraph({
  'S03-E02': employeeNodes.endpointBacked({
    source: employeeSources.endpointBacked(employeeBundle),
    project: ({ context, sources }) => ({
      employeeId: context.employee_id,
      rawEmployee: sources.employee.raw,
    }),
  }),
  'S03-E10': employeeNodes.local({
    source: employeeSources.local(),
    project: ({ context }) => ({
      employeeId: context.employee_id,
    }),
  }),
});

type NodeId = GraphNodeId<typeof graph>;

const validNodeId: NodeId = 'S03-E02';

// @ts-expect-error unknown node IDs are not part of canonical graph identity
const invalidNodeId: NodeId = 'S03-X99';

employeeNodes.endpointBacked({
  source: employeeSources.endpointBacked(employeeBundle),
  project: () => ({
    // @ts-expect-error projector output cannot declare a second nodeId
    nodeId: 'S03-E02',
  }),
});

employeeNodes.endpointBacked({
  // @ts-expect-error endpoint-backed nodes require endpoint-backed source contracts
  source: employeeSources.local(),
  project: () => ({
    title: 'invalid',
  }),
});

employeeNodes.local({
  // @ts-expect-error local nodes require local source contracts
  source: employeeSources.endpointBacked(employeeBundle),
  project: () => ({
    title: 'invalid',
  }),
});

employeeNodes.local({
  // @ts-expect-error node definitions do not own canonical IDs
  id: 'S03-E10',
  source: employeeSources.local(),
  project: () => ({
    title: 'invalid',
  }),
});

// @ts-expect-error canonical graphs cannot be empty
defineGraph({});

void validNodeId;
void invalidNodeId;
