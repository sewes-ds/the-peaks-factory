export type DowntimeClass = 'OPERATIONAL' | 'CRITICAL';
export type DowntimeSlotState = 'NONE' | 'OPERATIONAL_ACTIVE' | 'CRITICAL_ACTIVE';
export type AdditionalWorkGroup = 'ACTIVE' | 'APPROVED' | 'PENDING_APPROVAL';
export type FinishShiftBlocker = 'OPERATIONAL_DOWNTIME' | 'BREAK' | 'ADDITIONAL_WORK' | 'PRODUCTION';
export type FinishShiftWarning = 'APPROVED_ADDITIONAL_WORKS_NOT_STARTED';
export type AdditionalWorkStartBlocker =
  | 'NO_OPEN_SHIFT'
  | 'ACTIVE_PRODUCTION'
  | 'ACTIVE_BREAK'
  | 'OTHER_ADDITIONAL_WORK_RUNNING'
  | 'SELECTED_WORK_NOT_APPROVED'
  | 'SELECTED_WORK_NOT_STARTABLE';
export type UiColorToken = 'blue' | 'yellow' | 'scarlet' | 'green' | 'gray' | 'gray_green' | 'white_gray_inactive';
export type DowntimeUiColorToken = 'blue' | 'yellow' | 'scarlet';
export type AvailableDowntimeUiColorToken = 'yellow' | 'scarlet';
export type OperatorPipeline =
  | 'START_SHIFT'
  | 'FINISH_SHIFT'
  | 'START_PRODUCTION'
  | 'FINISH_PRODUCTION'
  | 'START_DOWNTIME'
  | 'FINISH_DOWNTIME'
  | 'START_BREAK'
  | 'FINISH_BREAK'
  | 'OPEN_ADDITIONAL_WORK'
  | 'START_ADDITIONAL_WORK'
  | 'FINISH_ADDITIONAL_WORK'
  | 'REQUEST_ADDITIONAL_WORK'
  | 'VIEW_SALARY';
export type FinishShiftNextPipeline =
  | 'FINISH_DOWNTIME'
  | 'FINISH_BREAK'
  | 'FINISH_ADDITIONAL_WORK'
  | 'FINISH_PRODUCTION'
  | 'CONFIRM_FINISH_SHIFT'
  | 'CONFIRM_FINISH_SHIFT_WITH_WARNING'
  | null;
export type MachineUiStatusToken = 'normal' | 'busy' | 'critical' | 'unavailable';
export type ManagerWorkplaceSeverity = 'none' | 'operational' | 'critical';
export type ManagerWorkplaceUiVariant = 'light_blue' | 'grey';
export type ManagerMachineUiState = 'idle' | 'running' | 'warning' | 'critical';
export type ManagerMachineUiVariant = 'light_blue' | 'green' | 'yellow' | 'red';
export type ManagerMachineDowntimeType = 'operational' | 'critical';
export type ManagerEmployeeUiState =
  | 'shift_not_started'
  | 'shift_idle'
  | 'production'
  | 'break'
  | 'operational_down'
  | 'critical_down'
  | 'additional_work';
export type ManagerEmployeeUiVariant = 'white' | 'light_blue' | 'green' | 'yellow' | 'red' | 'grey';
export type ManagerAdditionalWorkStatus = 'requested' | 'approved' | 'active' | 'waiting_accrual';
export type ManagerOpenTaskSourceTable =
  | 'additional_works'
  | 'machine_downtimes'
  | 'production_operations'
  | 'machines'
  | 'general'
  | 'unknown';
export type ManagerOpenTaskType =
  | 'additional_work_request'
  | 'additional_work_waiting_accrual'
  | 'open_machine_downtime'
  | 'open_production_operation'
  | 'machine_attention'
  | 'general_notification'
  | 'unknown';

type ActiveProductionState = {
  is_active: true;
  production_operation_id: string;
  machine_id: string;
  machine_name: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  can_finish_production: boolean;
};

type InactiveProductionState = {
  is_active: false;
  production_operation_id: null;
  machine_id: null;
  machine_name: null;
  sku_id: null;
  sku_code: null;
  sku_name: null;
  can_finish_production: false;
};

export type OperatorWorkplaceStateResponse = {
  actor_employee_id: string;
  actor_full_name: string;
  shift: {
    is_active: boolean;
    employee_shift_id: string | null;
    started_at: string | null;
  };
  production: ActiveProductionState | InactiveProductionState;
  break: {
    is_active: boolean;
    operator_break_id: string | null;
    break_type_id: string | null;
    break_type_name: string | null;
    can_finish_break: boolean;
  };
  downtime: {
    slot_state: DowntimeSlotState;
    downtime_id: string | null;
    production_operation_id: string | null;
    machine_id: string | null;
    machine_name: string | null;
    downtime_type_id: string | null;
    downtime_type_name: string | null;
    downtime_class: DowntimeClass | null;
    ui_color_token: DowntimeUiColorToken | null;
    can_start_downtime: boolean;
    can_finish_downtime: boolean;
  };
  additional_work_summary: {
    has_active_additional_work: boolean;
    active_additional_work_id: string | null;
    active_additional_work_name: string | null;
  };
  additional_work_start: {
    blockers: AdditionalWorkStartBlocker[];
  };
  salary: {
    can_view_salary: boolean;
  };
  finish_shift: {
    can_finish_now: boolean;
    blockers: FinishShiftBlocker[];
    warnings: FinishShiftWarning[];
    next_required_pipeline: FinishShiftNextPipeline;
  };
  available_pipelines: OperatorPipeline[];
};

export type OperatorAdditionalWorkStateResponse = {
  actor_employee_id: string;
  active_additional_works: Array<{
    additional_work_id: string;
    additional_work_type_id: string;
    display_name: string;
    ui_group: 'ACTIVE';
    ui_color_token: 'green';
    action: 'FINISH_ADDITIONAL_WORK';
  }>;
  approved_additional_works: Array<{
    additional_work_id: string;
    additional_work_type_id: string;
    display_name: string;
    origin: 'OPERATOR_REQUEST_APPROVED' | 'MANAGER_ASSIGNED';
    ui_group: 'APPROVED';
    ui_color_token: 'gray_green';
    action: 'START_ADDITIONAL_WORK';
  }>;
  pending_approval_additional_works: Array<{
    additional_work_id: string;
    additional_work_type_id: string;
    display_name: string;
    ui_group: 'PENDING_APPROVAL';
    ui_color_token: 'white_gray_inactive';
    action: null;
  }>;
};

export type AdditionalWorkTypesAvailableResponse = {
  additional_work_types: Array<{
    additional_work_type_id: string;
    display_name: string;
  }>;
};

export type AvailableDowntimeTypesResponse = {
  active_production_operation_id: string | null;
  available_downtime_types: Array<{
    downtime_type_id: string;
    display_name: string;
    downtime_class: DowntimeClass;
    ui_color_token: AvailableDowntimeUiColorToken;
    requires_production_operation: boolean;
    requires_comment: boolean;
  }>;
};

export type MachineItem = {
  machine_id: string;
  machine_name: string;
  workshop_name: string | null;
  machine_status: string | null;
  machine_use_status: string | null;
  is_selectable_for_production: boolean;
  is_selectable_for_critical_downtime: boolean;
  ui_status_token: MachineUiStatusToken;
};

export type MachineListResponse = {
  machines: MachineItem[];
};

export type MachineQrLookupResponse =
  | {
      found: true;
      machine: MachineItem & {
        production_unavailability:
          | { code: 'OCCUPIED_BY_OPERATOR'; operator_full_name: string }
          | { code: 'MACHINE_BROKEN' }
          | { code: 'MACHINE_DOWNTIME' }
          | { code: 'MACHINE_OUT_OF_SERVICE' }
          | { code: 'MACHINE_NOT_READY'; machine_status: string | null }
          | null;
      };
    }
  | {
      found: false;
      error_code: 'MACHINE_QR_NOT_FOUND';
    };

export type SkuListResponse = {
  skus: Array<{
    sku_id: string;
    sku_code: string;
    sku_name: string;
    sku_unit_name: string | null;
    current_sku_tariff_uzs: number | null;
    is_active: boolean;
  }>;
};

export type SkuQrLookupResponse =
  | {
      found: true;
      sku: SkuListResponse['skus'][number] & {
        is_selectable_for_production: boolean;
        production_unavailability: { code: 'SKU_INACTIVE' } | null;
      };
    }
  | {
      found: false;
      error_code: 'SKU_QR_NOT_FOUND';
    };

export type BreakTypesResponse = {
  break_types: Array<{
    break_type_id: string;
    display_name: string;
  }>;
};

export type SalaryTotalsResponse = {
  employee_id: string;
  totals: {
    today_uzs: number;
    week_uzs: number;
    month_uzs: number;
  };
  breakdown?: {
    production_uzs: number;
    additional_work_uzs: number;
    corrections_uzs: number | null;
    reversals_uzs: number | null;
  };
};

export type SalaryHistoryResponse = {
  employee_id: string;
  months: Array<{
    month: string;
    total_uzs: number;
    production_uzs: number;
    additional_work_uzs: number;
    corrections_uzs: number | null;
    reversals_uzs: number | null;
  }>;
};

export type ManagerAdditionalWorkAction =
  | 'OPEN_ADDITIONAL_WORK_CARD'
  | 'APPROVE_ADDITIONAL_WORK_REQUEST'
  | 'REJECT_ADDITIONAL_WORK_REQUEST'
  | 'CANCEL_ADDITIONAL_WORK'
  | 'FINISH_ADDITIONAL_WORK'
  | 'ACCRUE_ADDITIONAL_WORK_SALARY'
  | 'MARK_WITHOUT_ACCRUAL';

export type ManagerOpenTaskKind =
  | 'ADDITIONAL_WORK_REQUESTED'
  | 'ADDITIONAL_WORK_WAITING_ACCRUAL'
  | 'CRITICAL_DOWNTIME_OPEN'
  | 'OPERATIONAL_DOWNTIME_OVER_15_MIN';

export type ManagerOpenTaskTargetScreenId = 'S03-AW10' | 'S03-AW50' | 'S03-M02';

export type ManagerWorkplaceStateResponse = {
  section: 'S03';
  screen: 'S03-N01';
  manager: {
    employee_id: string;
    full_name: string;
  };
  sections: {
    machines: {
      title: 'Станки';
      running_count: number;
      downtime_count: number;
      idle_count: number;
      downtime_severity: ManagerWorkplaceSeverity;
      ui_variant: 'light_blue';
      available_actions: ['OPEN_MACHINES'];
    };
    employees: {
      title: 'Сотрудники';
      open_shift_count: number;
      production_count: number;
      downtime_count: number;
      additional_work_count: number;
      break_count: number;
      without_work_count: number;
      production_downtime_severity: ManagerWorkplaceSeverity;
      /**
       * Backward-compatible fields retained for existing preview clients.
       * New S03 v17 UI must use the UI-oriented fields above.
       */
      production_active_clear_count: number;
      production_break_count: number;
      production_downtime_count: number;
      additional_work_active_clear_count: number;
      additional_work_break_count: number;
      open_shift_without_work_count: number;
      ui_variant: 'light_blue';
      available_actions: ['OPEN_EMPLOYEES'];
    };
    downtimes: {
      title: 'Простои';
      critical_count: number;
      operational_count: number;
      ui_variant: 'light_blue';
      available_actions: ['OPEN_DOWNTIMES', 'START_CRITICAL_DOWNTIME'];
    };
    additional_works: {
      title: 'Доп. работы';
      requested_count: number;
      approved_count: number;
      active_count: number;
      requires_accrual_count: number;
      ui_variant: 'grey';
      available_actions: ['OPEN_ADDITIONAL_WORKS'];
    };
    corrections: {
      title: 'Корректировки';
      ui_variant: 'light_blue';
      available_actions: ['OPEN_CORRECTIONS'];
    };
    notifications: {
      title: 'Уведомления';
      open_tasks_count: number;
      ui_variant: 'light_blue';
      available_actions: ['OPEN_NOTIFICATIONS'];
    };
    reports: {
      title: 'Отчёты';
      ui_variant: 'light_blue';
      is_placeholder: true;
      available_actions: [];
    };
  };
};

export type ManagerMachineReadModelItem = {
  machine_id: string;
  machine_name: string;
  ui_state: ManagerMachineUiState;
  ui_variant: ManagerMachineUiVariant;
  active_production_operation_id: string | null;
  active_employee_id: string | null;
  active_employee_full_name: string | null;
  active_sku_id: string | null;
  active_sku_code: string | null;
  active_sku_name: string | null;
  active_break_id: string | null;
  active_break_name: string | null;
  active_downtime_id: string | null;
  downtime_type: ManagerMachineDowntimeType | null;
  downtime_name: string | null;
  /** @deprecated use downtime_start_comment/downtime_finish_comment */
  downtime_comment: string | null;
  downtime_started_at: string | null;
  downtime_duration: string | null;
  downtime_start_comment: string | null;
  downtime_finish_comment: string | null;
  has_active_critical_downtime: boolean;
  has_active_operational_downtime: boolean;
  active_operational_downtime_id: string | null;
  is_selectable_for_manager_critical_downtime: boolean;
  available_actions: ['OPEN_MACHINE_CARD'];
};

export type ManagerMachinesResponse = {
  section: 'S03';
  screen: 'S03-M01';
  title: 'Станки';
  machines: ManagerMachineReadModelItem[];
  available_actions: ['BACK'];
};

export type ManagerMachineCardResponse = {
  section: 'S03';
  screen: 'S03-M02';
  machine: Omit<ManagerMachineReadModelItem, 'available_actions'> & {
    available_actions: Array<'FINISH_DOWNTIME' | 'START_CRITICAL_DOWNTIME'>;
  };
  available_actions: ['BACK'];
};

export type ManagerDowntimeReadModelItem = {
  machine_id: string;
  machine_name: string;
  active_downtime_id: string;
  downtime_type: ManagerMachineDowntimeType;
  downtime_name: string;
  /** @deprecated use downtime_start_comment/downtime_finish_comment */
  downtime_comment: string | null;
  downtime_started_at: string | null;
  downtime_duration: string | null;
  downtime_start_comment: string | null;
  downtime_finish_comment: string | null;
  active_production_operation_id: string | null;
  active_employee_id: string | null;
  active_employee_full_name: string | null;
  active_sku_id: string | null;
  active_sku_code: string | null;
  active_sku_name: string | null;
  ui_state: 'warning' | 'critical';
  ui_variant: 'yellow' | 'red';
  available_actions: ['OPEN_MACHINE_CARD'];
};

export type ManagerDowntimesResponse = {
  section: 'S03';
  screen: 'S03-D01';
  title: 'Простои';
  downtimes: ManagerDowntimeReadModelItem[];
  available_actions: ['START_CRITICAL_DOWNTIME', 'BACK'];
};

export type ManagerEmployeeReadModelItem = {
  employee_id: string;
  full_name: string;
  ui_state: ManagerEmployeeUiState;
  ui_variant: ManagerEmployeeUiVariant;
  open_shift_id: string | null;
  shift_started_at: string | null;
  active_production_operation_id: string | null;
  production_started_at: string | null;
  active_machine_id: string | null;
  active_machine_name: string | null;
  active_sku_id: string | null;
  active_sku_code: string | null;
  active_sku_name: string | null;
  active_break_id: string | null;
  active_break_name: string | null;
  break_started_at: string | null;
  break_duration: string | null;
  break_context_type: 'production' | 'additional_work' | 'none';
  active_downtime_id: string | null;
  downtime_type: ManagerMachineDowntimeType | null;
  downtime_name: string | null;
  /** @deprecated use downtime_start_comment/downtime_finish_comment */
  downtime_comment: string | null;
  downtime_started_at: string | null;
  downtime_duration: string | null;
  downtime_start_comment: string | null;
  downtime_finish_comment: string | null;
  active_additional_work_id: string | null;
  active_additional_work_name: string | null;
  additional_work_started_at: string | null;
  additional_work_duration: string | null;
  available_actions: ['OPEN_EMPLOYEE_CARD'];
};

export type ManagerEmployeesResponse = {
  section: 'S03';
  screen: 'S03-E01';
  title: 'Сотрудники';
  employees: ManagerEmployeeReadModelItem[];
  available_actions: ['BACK'];
};

export type ManagerShiftBlockerSet = {
  production: {
    production_operation_id: string;
    machine_id: string | null;
    machine_name: string | null;
    sku_name: string | null;
  } | null;
  break: {
    target_employee_id: string;
    operator_break_id: string;
  } | null;
  additional_work: {
    additional_work_id: string;
  } | null;
};

export type ManagerEmployeeCardResponse = {
  section: 'S03';
  screen: 'S03-E02';
  employee: Omit<ManagerEmployeeReadModelItem, 'available_actions'> & {
    blockers: ManagerShiftBlockerSet;
    completed_shift_production_summary_by_sku: Array<{
      sku_id: string;
      sku_name: string;
      quantity: string;
    }>;
    completed_shift_additional_work_items: Array<{
      additional_work_id: string;
      additional_work_name: string;
    }>;
    available_actions: Array<'VIEW_SALARY' | 'VIEW_COMPLETED_WORKS' | 'FINISH_EMPLOYEE_SHIFT_BY_MANAGER'>;
  };
  available_actions: ['BACK'];
};

export type ManagerEmployeeSalaryResponse = {
  section: 'S03';
  screen: 'S03-SAL01';
  employee: {
    employee_id: string;
    full_name: string;
  };
} & SalaryTotalsResponse;

export type ManagerEmployeeSalaryHistoryResponse = {
  section: 'S03';
  screen: 'S03-SAL02';
  employee: {
    employee_id: string;
    full_name: string;
  };
} & SalaryHistoryResponse;

export type ManagerAdditionalWorkItem = {
  additional_work_id: string;
  additional_work_type_id: string;
  additional_work_name: string;
  employee_id: string;
  employee_full_name: string;
  requested_at: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: ManagerAdditionalWorkStatus;
  ui_state: ManagerAdditionalWorkStatus;
  ui_variant: 'grey' | 'green' | 'yellow';
  available_actions: ManagerAdditionalWorkAction[];
};

export type ManagerAdditionalWorksResponse = {
  section: 'S03';
  screen: 'S03-AW01';
  title: 'Доп. работы';
  groups: {
    requested: ManagerAdditionalWorkItem[];
    approved: ManagerAdditionalWorkItem[];
    active: ManagerAdditionalWorkItem[];
    waiting_accrual: ManagerAdditionalWorkItem[];
  };
  available_actions: ['ASSIGN_ADDITIONAL_WORK', 'BACK'];
};

export type ManagerOpenTaskItem = {
  task_id: string;
  notification_id: string;
  created_at: string;
  task_kind: ManagerOpenTaskKind;
  entity_table: ManagerOpenTaskSourceTable;
  entity_id: string | null;
  sort_group: number;
  sort_started_at: string;
  ui_color_token: 'red' | 'yellow' | 'green' | 'gray';
  target_screen_id: ManagerOpenTaskTargetScreenId;
  target_context: Record<string, string | null>;
  display_lines: string[];
  /**
   * Backward-compatible fields retained for the old preview client.
   */
  source_table: ManagerOpenTaskSourceTable;
  source_id: string | null;
  task_type: ManagerOpenTaskType;
  title: string;
  description: string | null;
  ui_state: 'open';
  ui_variant: 'light_blue' | 'yellow' | 'red' | 'green' | 'grey';
  available_actions: ['OPEN_TASK_SOURCE'];
};

export type ManagerOpenTasksResponse = {
  section: 'S03';
  screen: 'S03-NOT01';
  title: 'Уведомления';
  tasks: ManagerOpenTaskItem[];
  open_tasks: ManagerOpenTaskItem[];
  open_tasks_count: number;
  available_actions: ['BACK'];
};

export type ManagerCriticalDowntimeTypesResponse = {
  section: 'S03';
  screen: 'S03-D10';
  downtime_types: Array<{
    downtime_type_id: string;
    downtime_type_name: string;
    severity: 'critical';
    is_active: true;
    display_order: number;
  }>;
  available_actions: ['BACK'];
};

export type ManagerAdditionalWorkTypesAvailableResponse = {
  section: 'S03';
  screen: 'S03-AW41';
  additional_work_types: Array<{
    additional_work_type_id: string;
    additional_work_name: string;
    is_active: true;
    display_order: number;
  }>;
  available_actions: ['BACK'];
};

export type ManagerAdditionalWorkAssignabilityResponse = {
  section: 'S03';
  screen: 'S03-AW41';
  assignability_employee_id: string;
  assignability_additional_work_type_id: string | null;
  additional_work_types: Array<{
    additional_work_type_id: string;
    additional_work_name: string;
    is_active: boolean;
    display_order: number;
    can_assign: boolean;
    blocked_code: import('../additionalWorkAssignmentContract.js').AdditionalWorkAssignmentBlockedCode | null;
    blocked_message: string | null;
  }>;
  available_actions: ['ASSIGN_ADDITIONAL_WORK', 'BACK'] | ['BACK'];
};

export type ManagerSalaryCorrectionContextResponse = {
  section: 'S03';
  screen: 'S03-CF10';
  employees_with_today_shift: Array<{
    employee_id: string;
    employee_full_name: string;
    employee_shift_id: string;
    shift_started_at: string;
    shift_finished_at: string | null;
  }>;
  default_accrual_salary_correction_type_id: string;
  default_withholding_salary_correction_type_id: string;
  available_actions: ['BACK'];
};

export type ManagerSalaryCorrectionTypesAvailableResponse = {
  section: 'S03';
  screen: 'S03-CF11';
  salary_correction_types: Array<{
    salary_correction_type_id: string;
    salary_correction_type_name: string;
    is_active: true;
  }>;
  available_actions: ['BACK'];
};

export type ManagerCompletedWorkType = 'production' | 'additional_work';

export type ManagerCompletedWorkItem = {
  work_item_id: string;
  work_type: ManagerCompletedWorkType;
  operation_id: string;
  employee_id: string;
  employee_full_name: string;
  completed_date: string;
  production_operation_id: string | null;
  additional_work_id: string | null;
  machine_id: string | null;
  machine_name: string | null;
  sku_name: string | null;
  sku_code: string | null;
  quantity: string | null;
  additional_work_name: string | null;
  salary_entry_id: string | null;
  salary_amount_uzs: string;
  amount_uzs: string;
  old_quantity: string | null;
  correction_base_quantity: string | null;
  current_quantity: string | null;
  can_correct: boolean;
  can_storno: boolean;
  is_reversed: boolean;
  reversal_id: string | null;
};

export type ManagerCompletedWorksResponse = {
  section: 'S03';
  screen: 'S03-E21' | 'S03-CF22' | 'S03-CP12';
  employee: {
    employee_id: string;
    full_name: string;
  };
  works: ManagerCompletedWorkItem[];
  available_actions: ['BACK'];
};

export type ManagerCompletedWorkCardResponse = {
  section: 'S03';
  screen: 'S03-E22' | 'S03-CF23';
  employee: {
    employee_id: string;
    full_name: string;
  };
  work: ManagerCompletedWorkItem;
  available_actions: ['BACK'];
};

export type ManagerMachineCompletedProductionOperationsResponse = {
  section: 'S03';
  screen: 'S03-CP12';
  machine: {
    machine_id: string;
    machine_name: string;
  };
  operations: ManagerCompletedWorkItem[];
  available_actions: ['BACK'];
};
