import type {
  ManagerEmployeeCard,
  ManagerEmployees,
  ManagerEmployee,
  ManagerMachineCard,
  ManagerMachine,
  ManagerMachines,
  ManagerWorkplaceState,
  OperationIdResponse,
  ManagerMachineCompletedProductionOperationsResponse,
  ManagerProductionCompletedOperationsResponse,
  ManagerOpenTasksResponse,
  Section03ExportRunResponse,
} from './contracts';

const actions: readonly string[] = Object.freeze(['OPEN_MACHINE_CARD']);

const machine: ManagerMachine = Object.freeze({
  machine_id: 'M-1',
  machine_name: 'Станок 1',
  ui_state: 'running',
  ui_variant: 'green',
  active_production_operation_id: 'P-1',
  active_employee_id: 'E-1',
  active_employee_full_name: 'Operator One',
  active_sku_id: 'SKU-1',
  active_sku_code: 'SKU',
  active_sku_name: 'Part',
  active_break_id: null,
  active_break_name: null,
  active_downtime_id: 'D-1',
  downtime_type: 'operational',
  downtime_name: 'Наладка',
  downtime_comment: null,
  downtime_start_comment: null,
  downtime_finish_comment: null,
  downtime_started_at: '10:00',
  downtime_duration: '5 мин',
  has_active_critical_downtime: false,
  has_active_operational_downtime: true,
  active_operational_downtime_id: 'D-1',
  is_selectable_for_manager_critical_downtime: true,
  available_actions: actions,
});

const workplace: ManagerWorkplaceState = Object.freeze({
  section: 'S03',
  screen: 'S03-N01',
  manager: Object.freeze({ employee_id: 'E-9', full_name: 'Manager One' }),
  sections: Object.freeze({
    machines: Object.freeze({ title: 'Станки', running_count: 1, downtime_count: 1, idle_count: 0, downtime_severity: 'operational', ui_variant: 'light_blue', available_actions: actions }),
    employees: Object.freeze({ title: 'Сотрудники', open_shift_count: 1, production_count: 1, downtime_count: 0, additional_work_count: 0, break_count: 0, without_work_count: 0, production_downtime_severity: 'none', ui_variant: 'light_blue', available_actions: actions }),
    downtimes: Object.freeze({ title: 'Простои', critical_count: 0, operational_count: 1, ui_variant: 'light_blue', available_actions: actions }),
    additional_works: Object.freeze({ title: 'Доп. работы', requested_count: 0, approved_count: 0, active_count: 0, requires_accrual_count: 0, ui_variant: 'grey', available_actions: actions }),
    corrections: Object.freeze({ title: 'Корректировки', ui_variant: 'light_blue', available_actions: actions }),
    notifications: Object.freeze({ title: 'Уведомления', open_tasks_count: 0, ui_variant: 'light_blue', available_actions: actions }),
    reports: Object.freeze({ title: 'Отчеты', ui_variant: 'light_blue', is_placeholder: true, available_actions: Object.freeze([]) as readonly [] }),
  }),
});

const machines: ManagerMachines = Object.freeze({ section: 'S03', screen: 'S03-M01', title: 'Станки', machines: Object.freeze([machine]), available_actions: actions });
const card: ManagerMachineCard = Object.freeze({ section: 'S03', screen: 'S03-M02', machine, available_actions: actions });
const operation: OperationIdResponse = Object.freeze({ id: 'D-1' });
declare const employee: ManagerEmployee;
declare const employees: ManagerEmployees;
declare const employeeCard: ManagerEmployeeCard;
declare const productionOperations: ManagerProductionCompletedOperationsResponse;
declare const machineProductionOperations: ManagerMachineCompletedProductionOperationsResponse;
declare const openTasks: ManagerOpenTasksResponse;
const exportRun: Section03ExportRunResponse = Object.freeze({ export_run_id: '42' });

// @ts-expect-error reports placeholder must be exactly true while export is unavailable
workplace.sections.reports.is_placeholder satisfies false;
// @ts-expect-error machine variant is a closed backend variant union
machine.ui_variant satisfies 'blue';
// @ts-expect-error operation response exposes only normalized ID
operation.reason;
// @ts-expect-error machines response cannot be treated as a card response
machines.machine;
// @ts-expect-error card response cannot be treated as a list response
card.machines;
// @ts-expect-error employee variants are closed backend values
employee.ui_variant satisfies 'blue';
// @ts-expect-error employee list does not expose a card object
employees.employee;
// @ts-expect-error employee card does not expose a list array
employeeCard.employees;
// @ts-expect-error closed union does not expose both branches without narrowing
productionOperations.operations;
// @ts-expect-error machine operation quantity cannot be numeric
machineProductionOperations.operations[0]!.quantity satisfies number;
// @ts-expect-error notification target context is a closed union
openTasks.tasks[0]!.target_context.employee_id;
// @ts-expect-error notification color token is closed
openTasks.tasks[0]!.ui_color_token satisfies 'blue';
// @ts-expect-error export response exposes only the strict export_run_id
exportRun.id;

void workplace;
void machines;
void card;
void operation;
void employee;
void exportRun;
void employees;
void employeeCard;
void productionOperations;
void machineProductionOperations;
void openTasks;
