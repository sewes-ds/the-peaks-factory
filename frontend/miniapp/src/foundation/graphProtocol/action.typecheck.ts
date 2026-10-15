import {
  defineGraphActionEvent,
  defineGraphActions,
  graphAction,
  graphActionEvent,
  graphActionInstancesFor,
  type GraphActionInstanceEvent,
  type GraphBusinessActionId,
  type GraphPresentationActionId,
} from './action';

const noEvent = defineGraphActionEvent({});

const employeeEvent = defineGraphActionEvent({
  employee_id: graphActionEvent.id(),
});

const actions = defineGraphActions({
  business: {
    finishEmployeeBreak: graphAction.business(
      'FINISH_BREAK',
      employeeEvent,
      graphAction.actionButton({
        label: 'Завершить перерыв',
        icon: 'finish_break.svg',
        variant: 'yellow',
      }),
    ),
  },
  presentation: {
    back: graphAction.presentation(
      noEvent,
      graphAction.actionButton({
        label: 'Назад',
        icon: 'back.svg',
        variant: 'outlineBlue',
        size: 'fixed55',
      }),
    ),
    selectEmployee: graphAction.presentation(
      employeeEvent,
      graphAction.listButton({
        variant: 'blue',
      }),
    ),
  },
});

type BusinessActionId = GraphBusinessActionId<typeof actions>;
type PresentationActionId = GraphPresentationActionId<typeof actions>;
type SelectEmployeeEvent = GraphActionInstanceEvent<
  typeof actions.presentation.selectEmployee
>;

const businessActionId: BusinessActionId = 'finishEmployeeBreak';
const presentationActionId: PresentationActionId = 'back';
const selectEmployeeEvent: SelectEmployeeEvent = {
  employee_id: '1',
};

const instances = graphActionInstancesFor(actions);

instances.business(
  'finishEmployeeBreak',
  {
    instanceId: 'employee-1-break',
  },
  {
    employee_id: '1',
  },
);

instances.presentation('back', {}, {});

instances.presentation(
  'selectEmployee',
  {
    mainLine: 'Петр Васильевич Садальский',
    secondaryLine: 'Смена открыта',
  },
  {
    employee_id: '1',
  },
);

// @ts-expect-error unknown business action IDs are rejected
instances.business('unknownAction', {}, {});

// @ts-expect-error presentation actions cannot be instantiated as business actions
instances.business('back', {}, {});

// @ts-expect-error business actions cannot be instantiated as presentation actions
instances.presentation('finishEmployeeBreak', {}, {});

instances.business(
  'finishEmployeeBreak',
  {
    // @ts-expect-error semantic action visual variants cannot be overridden per instance
    variant: 'red',
  },
  { employee_id: '1' },
);

// @ts-expect-error semantic action icon/size fields cannot be overridden per instance
instances.presentation('back', { icon: 'other.svg', size: 'main70' }, {});

// @ts-expect-error list actions require their declared dynamic content
instances.presentation('selectEmployee', {}, { employee_id: '1' });

instances.presentation(
  'selectEmployee',
  {
    mainLine: 'Employee',
  },
  {
    // @ts-expect-error action event IDs are scalar values, not display snapshots
    employee_id: {
      employee_id: '1',
      full_name: 'Snapshot',
    },
  },
);

instances.presentation(
  'selectEmployee',
  {
    mainLine: 'Employee',
  },
  // @ts-expect-error required action event fields cannot be omitted
  {},
);

instances.presentation(
  'selectEmployee',
  {
    mainLine: 'Employee',
  },
  {
    employee_id: '1',
    // @ts-expect-error undeclared action event fields are rejected
    employee: 'Snapshot',
  },
);

// @ts-expect-error semantic action IDs cannot exist in both action classes
defineGraphActions({
  business: {
    duplicated: graphAction.business(
      'DOMAIN_ACTION',
      noEvent,
      graphAction.actionButton({
        label: 'Действие',
        icon: 'action.svg',
        variant: 'green',
      }),
    ),
  },
  presentation: {
    duplicated: graphAction.presentation(
      noEvent,
      graphAction.actionButton({
        label: 'Переход',
        icon: 'next.svg',
        variant: 'primaryBlue',
      }),
    ),
  },
});

// @ts-expect-error graph action registries cannot be empty
defineGraphActions({
  business: {},
  presentation: {},
});

void businessActionId;
void presentationActionId;
void selectEmployeeEvent;
