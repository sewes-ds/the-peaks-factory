export type ReadModelKey =
  | 'operator_workplace_state'
  | 'operator_additional_work_state'
  | 'operator_salary'
  | 'operator_salary_history';

export type MutationRefetchPolicy = {
  mutation: string;
  refetch: ReadModelKey[];
};

export const mutationRefetchPolicies: MutationRefetchPolicy[] = [
  { mutation: 'POST /shifts/start', refetch: ['operator_workplace_state'] },
  { mutation: 'POST /shifts/finish', refetch: ['operator_workplace_state'] },
  { mutation: 'POST /production-operations/start', refetch: ['operator_workplace_state'] },
  { mutation: 'POST /production-operations/:production_operation_id/finish', refetch: ['operator_workplace_state'] },
  { mutation: 'POST /machine-downtimes/start', refetch: ['operator_workplace_state'] },
  { mutation: 'POST /machine-downtimes/:downtime_id/finish', refetch: ['operator_workplace_state'] },
  { mutation: 'POST /operator-breaks/start', refetch: ['operator_workplace_state'] },
  { mutation: 'POST /operator-breaks/finish', refetch: ['operator_workplace_state'] },
  {
    mutation: 'POST /additional-works/request',
    refetch: ['operator_additional_work_state', 'operator_workplace_state']
  },
  {
    mutation: 'POST /additional-works/:additional_work_id/start',
    refetch: ['operator_additional_work_state', 'operator_workplace_state']
  },
  {
    mutation: 'POST /additional-works/:additional_work_id/finish',
    refetch: ['operator_additional_work_state', 'operator_workplace_state']
  }
];
