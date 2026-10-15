import {
  defineGraphContext,
  graphContext,
  parseGraphContext,
  type GraphContextScalar,
  type GraphContextValueDecoder,
  type InferGraphContext,
} from './context';

const schema = defineGraphContext({
  employee_id: graphContext.id(),
  comment: graphContext.optionalTextInput(),
  period: graphContext.period('today', 'week'),
  mode: graphContext.optionalMode('view', 'edit'),
});

type EmployeeContext = InferGraphContext<typeof schema>;

const validContext: EmployeeContext = {
  employee_id: '1',
  period: 'today',
};

// @ts-expect-error display snapshots are not GraphContextScalar values
const invalidScalar: GraphContextScalar = { employee_id: '1' };

// @ts-expect-error decoders cannot emit display snapshot objects
const invalidDecoder: GraphContextValueDecoder<{ employee_id: string }> = (
  value: unknown,
) => ({ employee_id: String(value) });

// @ts-expect-error context fields cannot be raw display snapshot objects
defineGraphContext({ employee: { employee_id: '1', full_name: 'Snapshot' } });

parseGraphContext(schema, validContext);
void invalidScalar;
void invalidDecoder;
