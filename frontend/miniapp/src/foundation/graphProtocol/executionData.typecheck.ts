import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
  graphActionInstancesFor,
  type GraphActionInstanceEvent,
} from './action';
import {
  defineGraphCommandEntities,
  defineGraphCommandInput,
  graphCommandEntity,
  graphCommandFor,
  graphCommandInput,
  type GraphCommandInput,
} from './command';

const correctionInput = defineGraphCommandInput({
  employee_id: graphCommandInput.id(),
  quantity: graphCommandInput.scalarInput((value: unknown) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      throw new Error('Expected a finite number.');
    }

    return value;
  }),
  period: graphCommandInput.period('today', 'week'),
  mode: graphCommandInput.mode('manual', 'scan'),
});

const correctionCommand = graphCommandFor(correctionInput).define({
  command: 'CORRECT_PRODUCTION',
  method: 'POST',
  endpoint: '/operations/production/correct',
  outcomes: ['CORRECTION_RECORDED'],
  entities: defineGraphCommandEntities({
    employee_id: graphCommandEntity.id(),
  }),
  request: async (input) => {
    const employeeId: string = input.employee_id;
    const quantity: number = input.quantity;
    const period: 'today' | 'week' = input.period;
    const mode: 'manual' | 'scan' = input.mode;

    void employeeId;
    void quantity;
    void period;
    void mode;

    return {} as unknown;
  },
});

type CorrectionInput = GraphCommandInput<
  typeof correctionCommand
>;

const validCommandInput: CorrectionInput = {
  employee_id: '1',
  quantity: 5,
  period: 'today',
  mode: 'manual',
};

const invalidCommandSnapshot: CorrectionInput = {
  // @ts-expect-error schema-backed command IDs cannot carry display snapshots
  employee_id: {
    employee_id: '1',
    full_name: 'Snapshot',
  },
  quantity: 5,
  period: 'today',
  mode: 'manual',
};

const invalidCommandField: CorrectionInput = {
  employee_id: '1',
  quantity: 5,
  period: 'today',
  mode: 'manual',
  // @ts-expect-error undeclared command input fields are rejected
  machine_id: '2',
};

const employeeEvent = defineGraphActionEvent({
  employee_id: graphActionEvent.id(),
  mode: graphActionEvent.mode('view', 'edit'),
});

const noEvent = defineGraphActionEvent({});

const actions = defineGraphActions({
  business: {},
  presentation: {
    selectEmployee: graphAction.presentation(
      employeeEvent,
      graphAction.listButton({
        variant: 'blue',
      }),
    ),
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

type SelectEmployeeEvent = GraphActionInstanceEvent<
  typeof actions.presentation.selectEmployee
>;

const validActionEvent: SelectEmployeeEvent = {
  employee_id: '1',
  mode: 'view',
};

const invalidActionSnapshot: SelectEmployeeEvent = {
  // @ts-expect-error action event IDs cannot carry display snapshots
  employee_id: {
    employee_id: '1',
    full_name: 'Snapshot',
  },
  mode: 'view',
};

const invalidActionEventField: SelectEmployeeEvent = {
  employee_id: '1',
  mode: 'view',
  // @ts-expect-error undeclared action event fields are rejected
  employee: 'Snapshot',
};

const instances = graphActionInstancesFor(actions);

instances.presentation(
  'selectEmployee',
  {
    mainLine: 'Employee',
    // @ts-expect-error execution event data cannot be mixed into visual instance input
    employee_id: '1',
  },
  {
    employee_id: '1',
    mode: 'view',
  },
);

instances.presentation(
  'selectEmployee',
  {
    mainLine: 'Employee',
  },
  // @ts-expect-error required action event fields cannot be omitted
  {
    employee_id: '1',
  },
);

type UnboundedEventSchema = ReturnType<typeof JSON.parse>;
declare const unboundedEventSchema: UnboundedEventSchema;

// @ts-expect-error JSON.parse-derived unbounded action event schemas are rejected
defineGraphActionEvent(unboundedEventSchema);

void validCommandInput;
void invalidCommandSnapshot;
void invalidCommandField;
void validActionEvent;
void invalidActionSnapshot;
void invalidActionEventField;
