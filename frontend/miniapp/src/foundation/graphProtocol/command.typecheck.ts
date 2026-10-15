import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
  type GraphCommandInput,
  type InferGraphCommandResult,
} from './command';

const finishBlockerInput = defineGraphCommandInput({
  employee_id: graphCommandInput.id(),
  blocker_id: graphCommandInput.id(),
});

const commands = graphCommandFor(finishBlockerInput);

const finishEmployeeBlocker = commands.define({
  command: 'FINISH_EMPLOYEE_BLOCKER',
  method: 'POST',
  endpoint: '/operations/employee-blockers/finish',
  outcomes: [
    'EMPLOYEE_BLOCKERS_REMAIN',
    'EMPLOYEE_READY_TO_CLOSE_SHIFT',
  ],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
    blocker_id: graphCommandEntity.optionalId(),
  }),
  request: async (_input) => ({}) as unknown,
});

type FinishBlockerCommandInput = GraphCommandInput<
  typeof finishEmployeeBlocker
>;
type FinishBlockerResult = InferGraphCommandResult<
  typeof finishEmployeeBlocker
>;

const commandInput: FinishBlockerCommandInput = {
  employee_id: '1',
  blocker_id: '2',
};

const commandResult: FinishBlockerResult = {
  command: 'FINISH_EMPLOYEE_BLOCKER',
  outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
  entities: {
    employee_id: '1',
  },
};

const invalidInputSnapshot: FinishBlockerCommandInput = {
  // @ts-expect-error schema-backed command inputs contain scalar IDs, not snapshots
  employee_id: {
    employee_id: '1',
    full_name: 'Snapshot',
  },
  blocker_id: '2',
};

const invalidOutcome: FinishBlockerResult = {
  command: 'FINISH_EMPLOYEE_BLOCKER',
  // @ts-expect-error undeclared domain outcomes are rejected
  outcome: 'FRONTEND_DECIDED_NEXT_SCREEN',
  entities: {
    employee_id: '1',
  },
};

const invalidCommand: FinishBlockerResult = {
  // @ts-expect-error result command identity must match its definition
  command: 'OTHER_COMMAND',
  outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
  entities: {
    employee_id: '1',
  },
};

const invalidEntitySnapshot: FinishBlockerResult = {
  command: 'FINISH_EMPLOYEE_BLOCKER',
  outcome: 'EMPLOYEE_BLOCKERS_REMAIN',
  entities: {
    // @ts-expect-error command-result entities contain IDs, not entity snapshots
    employee_id: {
      employee_id: '1',
      full_name: 'Snapshot',
    },
  },
};

const invalidNodeResult: FinishBlockerResult = {
  command: 'FINISH_EMPLOYEE_BLOCKER',
  outcome: 'EMPLOYEE_READY_TO_CLOSE_SHIFT',
  entities: {
    employee_id: '1',
  },
  // @ts-expect-error frontend node IDs are not command-result envelope fields
  nodeId: 'S03-E10',
};

const invalidRouteResult: FinishBlockerResult = {
  command: 'FINISH_EMPLOYEE_BLOCKER',
  outcome: 'EMPLOYEE_READY_TO_CLOSE_SHIFT',
  entities: {
    employee_id: '1',
  },
  // @ts-expect-error frontend routes are not command-result envelope fields
  route: {
    screenId: 'S03-E10',
  },
};

const invalidVisualResult: FinishBlockerResult = {
  command: 'FINISH_EMPLOYEE_BLOCKER',
  outcome: 'EMPLOYEE_READY_TO_CLOSE_SHIFT',
  entities: {
    employee_id: '1',
  },
  // @ts-expect-error visual policy is not a command-result envelope field
  visual: {
    variant: 'green',
  },
};

commands.define({
  command: 'EMPTY_OUTCOMES',
  method: 'POST',
  endpoint: '/operations/empty',
  // @ts-expect-error command definitions require at least one domain outcome
  outcomes: [],
  entities: defineGraphCommandEntities({}),
  request: async (_input) => ({}) as unknown,
});

type UnboundedSchema = ReturnType<typeof JSON.parse>;
declare const unboundedSchema: UnboundedSchema;

// @ts-expect-error JSON.parse-derived unbounded command input schemas are rejected
graphCommandFor(unboundedSchema);

graphCommandFor({
  employee: {
    // @ts-expect-error raw display snapshot objects are not command input schema fields
    employee_id: '1',
    full_name: 'Snapshot',
  },
});

void commandInput;
void commandResult;
void invalidInputSnapshot;
void invalidOutcome;
void invalidCommand;
void invalidEntitySnapshot;
void invalidNodeResult;
void invalidRouteResult;
void invalidVisualResult;
