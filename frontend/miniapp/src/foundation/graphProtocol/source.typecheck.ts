
import type {
  GraphNodeSourceContract,
  GraphOptionalSourceResult,
  InferGraphSourceBundleData,
} from './source';
import { graphSourcesFor } from './source';

type EmployeeContext = Readonly<{
  employee_id: string;
}>;

type EmployeeDto = Readonly<{
  employee_id: string;
  full_name: string;
}>;

const sourceFactory = graphSourcesFor<EmployeeContext>();

const employee = sourceFactory.required({
  sourceId: 'manager.employee.card',
  endpoint: '/manager/employees/:employee_id',
  request: async ({ employee_id }) => ({ employee_id }),
  decode: (input: unknown): EmployeeDto => {
    const value = input as Record<string, unknown>;
    return {
      employee_id: String(value.employee_id),
      full_name: String(value.full_name),
    };
  },
});

const hint = sourceFactory.optional({
  sourceId: 'manager.employee.hint',
  endpoint: '/manager/employees/:employee_id/hint',
  request: async ({ employee_id }) => ({ employee_id }),
  decode: (input: unknown): string => String(input),
});

const bundle = sourceFactory.bundle({
  employee,
  hint,
});

type BundleData = InferGraphSourceBundleData<typeof bundle.sources>;

const validBundleData: BundleData = {
  employee: {
    employee_id: '1',
    full_name: 'Петр',
  },
  hint: {
    status: 'unavailable',
    failure: {
      sourceId: 'manager.employee.hint',
      endpoint: '/manager/employees/:employee_id/hint',
      message: 'unavailable',
    },
  },
};

const availableHint: GraphOptionalSourceResult<string> = {
  status: 'available',
  value: 'hint',
};

const endpointContract: GraphNodeSourceContract<EmployeeContext> =
  sourceFactory.endpointBacked(bundle);

const localContract: GraphNodeSourceContract<EmployeeContext> =
  sourceFactory.local();

// @ts-expect-error endpoint-backed nodes cannot omit a source bundle
const missingEndpointSources: GraphNodeSourceContract<EmployeeContext> = {
  kind: 'endpoint-backed',
};

// @ts-expect-error source decoders are required at the HTTP unknown boundary
sourceFactory.required({
  sourceId: 'manager.employee.raw',
  endpoint: '/manager/employees/:employee_id',
  request: async ({ employee_id }) => ({ employee_id }),
});

// @ts-expect-error endpoint-backed source bundles cannot be empty
sourceFactory.bundle({});

// @ts-expect-error optional source data must preserve explicit availability state
const invalidOptionalHint: BundleData['hint'] = 'silent fallback';

void validBundleData;
void availableHint;
void endpointContract;
void localContract;
void missingEndpointSources;
void invalidOptionalHint;
