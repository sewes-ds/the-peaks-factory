import type { QueryResultRow } from 'pg';
import { readQuery } from '../db/readQuery.js';
import type { DbPool } from '../db/pool.js';

export const managerOpenTaskUnresolvedSourcePredicateSql = `
  (
    n.cause_table_name is null
    or (
      n.cause_table_name = 'additional_works'
      and exists (
        select 1
        from app.additional_works aw
        join app.additional_work_approval_statuses aws
          on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
        left join app.additional_work_accrual_statuses awas
          on awas.additional_work_accrual_status_id = aw.additional_work_accrual_status_id
        where aw.additional_work_id = n.cause_record_id
          and aw.cancelled_at is null
          and (
            (
              aws.is_pending = true
              and aw.started_at is null
              and aw.finished_at is null
              and aw.is_assignment_finished = false
            )
            or (
              aw.finished_at is not null
              and awas.is_waiting_accrual = true
            )
          )
      )
    )
    or (
      n.cause_table_name = 'machine_downtimes'
      and exists (
        select 1
        from app.machine_downtimes md
        where md.machine_downtime_id = n.cause_record_id
          and md.is_open = true
      )
    )
    or (
      n.cause_table_name = 'production_operations'
      and exists (
        select 1
        from app.production_operations pr
        where pr.production_operation_id = n.cause_record_id
          and pr.is_open = true
      )
    )
    or (
      n.cause_table_name = 'machines'
      and exists (
        select 1
        from app.machines m
        join app.machine_use_statuses mus
          on mus.machine_use_status_id = m.machine_use_status_id
        where m.machine_id = n.cause_record_id
          and mus.is_decommissioned = false
      )
    )
  )
`;

export type EmployeeWorkplaceSnapshotRow = QueryResultRow & {
  employee_full_name: string;
  employee_shift_id: string | null;
  shift_started_at: string | null;
  production_operation_id: string | null;
  production_machine_id: string | null;
  production_machine_name: string | null;
  sku_id: string | null;
  sku_code: string | null;
  sku_name: string | null;
  linked_downtime_id: string | null;
  linked_downtime_production_operation_id: string | null;
  linked_downtime_machine_id: string | null;
  linked_downtime_machine_name: string | null;
  linked_downtime_type_id: string | null;
  linked_downtime_type_name: string | null;
  linked_downtime_class: 'OPERATIONAL' | 'CRITICAL' | null;
  operator_break_id: string | null;
  break_type_id: string | null;
  break_type_name: string | null;
  active_additional_work_id: string | null;
  active_additional_work_name: string | null;
  approved_unstarted_count: string;
};

export type AdditionalWorkStateRow = QueryResultRow & {
  additional_work_id: string;
  additional_work_type_id: string;
  display_name: string;
  assigned_by_employee_id: string;
  employee_id: string;
  is_pending: boolean;
  is_approved: boolean;
  started_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  is_assignment_finished: boolean;
};

export type AdditionalWorkTypeStateRow = QueryResultRow & {
  additional_work_type_id: string;
  display_name: string;
};

export type DowntimeTypeStateRow = QueryResultRow & {
  downtime_type_id: string;
  display_name: string;
  downtime_class: 'OPERATIONAL' | 'CRITICAL';
  ui_color_token: 'yellow' | 'scarlet';
  requires_production_operation: boolean;
  operator_requires_start_comment: boolean;
};

export type ActiveProductionStateRow = QueryResultRow & {
  production_operation_id: string;
};

export type MachineStateRow = QueryResultRow & {
  machine_id: string;
  machine_name: string;
  workshop_name: string | null;
  machine_status: string | null;
  machine_use_status: string | null;
  is_available_for_operations: boolean;
  is_decommissioned: boolean;
  is_available_for_start: boolean;
  is_running_status: boolean;
  is_downtime_status: boolean;
  is_broken_status: boolean;
  has_open_production: boolean;
  has_open_production_by_actor: boolean;
  has_open_downtime: boolean;
  has_open_critical_downtime: boolean;
  active_production_employee_full_name: string | null;
};

export type SkuStateRow = QueryResultRow & {
  sku_id: string;
  sku_code: string;
  sku_name: string | null;
  sku_unit_name: string | null;
  current_sku_tariff_uzs: string | number | null;
  is_active: boolean;
};

export type SkuQrStateRow = SkuStateRow & {
  sku_unit_is_active: boolean;
};

export type BreakTypeStateRow = QueryResultRow & {
  break_type_id: string;
  display_name: string;
};

export type SalaryTotalsStateRow = QueryResultRow & {
  today_uzs: string;
  week_uzs: string;
  month_uzs: string;
};

export type SalaryHistoryStateRow = QueryResultRow & {
  month: string;
  total_uzs: string;
  production_uzs: string;
  additional_work_uzs: string;
  corrections_uzs: string | null;
  reversals_uzs: string | null;
};

export type ManagerWorkplaceStateRow = QueryResultRow & {
  manager_employee_id: string;
  manager_full_name: string;
  machine_running_count: string;
  machine_downtime_count: string;
  machine_idle_count: string;
  machine_critical_downtime_count: string;
  machine_operational_downtime_count: string;
  employee_open_shift_count: string;
  employee_production_count: string;
  employee_downtime_count: string;
  employee_additional_work_count: string;
  employee_break_count: string;
  employee_without_work_count: string;
  employee_production_active_clear_count: string;
  employee_production_break_count: string;
  employee_production_downtime_count: string;
  employee_production_critical_downtime_count: string;
  employee_production_operational_downtime_count: string;
  employee_additional_work_active_clear_count: string;
  employee_additional_work_break_count: string;
  employee_open_shift_without_work_count: string;
  downtime_critical_count: string;
  downtime_operational_count: string;
  additional_work_requested_count: string;
  additional_work_approved_count: string;
  additional_work_active_count: string;
  additional_work_requires_accrual_count: string;
  open_tasks_count: string;
};

export type ManagerIdentityRow = QueryResultRow & {
  manager_employee_id: string;
  manager_full_name: string;
};

export type ManagerMachineReadModelRow = QueryResultRow & {
  machine_id: string;
  machine_name: string;
  active_production_operation_id: string | null;
  active_employee_id: string | null;
  active_employee_full_name: string | null;
  active_sku_id: string | null;
  active_sku_code: string | null;
  active_sku_name: string | null;
  active_break_id: string | null;
  active_break_name: string | null;
  active_downtime_id: string | null;
  downtime_type: 'operational' | 'critical' | null;
  downtime_name: string | null;
  downtime_comment: string | null;
  downtime_started_at: string | null;
  downtime_duration: string | null;
  downtime_start_comment: string | null;
  downtime_finish_comment: string | null;
  has_active_critical_downtime: boolean;
  has_active_operational_downtime: boolean;
  active_operational_downtime_id: string | null;
  is_selectable_for_manager_critical_downtime: boolean;
};

export type ManagerEmployeeReadModelRow = QueryResultRow & {
  employee_id: string;
  full_name: string;
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
  downtime_type: 'operational' | 'critical' | null;
  downtime_name: string | null;
  downtime_comment: string | null;
  downtime_started_at: string | null;
  downtime_duration: string | null;
  downtime_start_comment: string | null;
  downtime_finish_comment: string | null;
  active_additional_work_id: string | null;
  active_additional_work_name: string | null;
  additional_work_started_at: string | null;
  additional_work_duration: string | null;
};

export type ManagerAdditionalWorkRow = QueryResultRow & {
  additional_work_id: string;
  additional_work_type_id: string;
  additional_work_name: string;
  employee_id: string;
  employee_full_name: string;
  requested_at: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  status: 'requested' | 'approved' | 'active' | 'waiting_accrual';
};

export type ManagerAdditionalWorkAssignabilityRow = QueryResultRow & {
  additional_work_type_id: string;
  display_name: string;
  is_active: boolean;
  can_assign: boolean;
  blocked_code:
    | 'additional_work_assignment_already_exists'
    | 'additional_work_target_not_available'
    | 'additional_work_type_not_available'
    | null;
};

export type ManagerOpenTaskRow = QueryResultRow & {
  task_id: string;
  notification_id: string;
  created_at: string;
  entity_table: 'additional_works' | 'machine_downtimes' | 'production_operations' | 'machines' | 'general' | 'unknown';
  entity_id: string | null;
  task_kind:
    | 'ADDITIONAL_WORK_REQUESTED'
    | 'ADDITIONAL_WORK_WAITING_ACCRUAL'
    | 'CRITICAL_DOWNTIME_OPEN'
    | 'OPERATIONAL_DOWNTIME_OVER_15_MIN';
  source_table: 'additional_works' | 'machine_downtimes' | 'production_operations' | 'machines' | 'general' | 'unknown';
  source_id: string | null;
  task_type:
    | 'additional_work_request'
    | 'additional_work_waiting_accrual'
    | 'open_machine_downtime'
    | 'open_production_operation'
    | 'machine_attention'
    | 'general_notification'
    | 'unknown';
  title: string;
  description: string | null;
  sort_group: string | number;
  sort_started_at: string;
  ui_color_token: 'red' | 'yellow' | 'green' | 'gray';
  target_screen_id: 'S03-AW10' | 'S03-AW50' | 'S03-M02';
  target_context: Record<string, string | null> | string;
  display_lines: string[] | string;
};

export type ManagerCanonicalOpenTaskSourceRow = QueryResultRow & {
  task_kind:
    | 'ADDITIONAL_WORK_REQUESTED'
    | 'ADDITIONAL_WORK_WAITING_ACCRUAL'
    | 'CRITICAL_DOWNTIME_OPEN'
    | 'OPERATIONAL_DOWNTIME_OVER_15_MIN';
  source_table: 'additional_works' | 'machine_downtimes';
  source_id: string;
  source_started_at: string;
  sort_group: string | number;
  additional_work_name: string | null;
  employee_full_name: string | null;
  machine_id: string | null;
  machine_name: string | null;
  downtime_name: string | null;
  elapsed_minutes: string | number | null;
};

export const managerCanonicalOpenTaskCteSql = `
  canonical_open_tasks as (
    select
      case
        when aws.is_pending = true then 'ADDITIONAL_WORK_REQUESTED'
        else 'ADDITIONAL_WORK_WAITING_ACCRUAL'
      end as task_kind,
      'additional_works'::text as source_table,
      aw.additional_work_id::text as source_id,
      coalesce(aw.assigned_at, aw.finished_at, aw.created_at)::text as source_started_at,
      case when aws.is_pending = true then 4 else 3 end as sort_group,
      awt.additional_work_type_name as additional_work_name,
      e.full_name as employee_full_name,
      null::text as machine_id,
      null::text as machine_name,
      null::text as downtime_name,
      null::bigint as elapsed_minutes
    from app.additional_works aw
    join app.additional_work_types awt
      on awt.additional_work_type_id = aw.additional_work_type_id
    join app.employees e
      on e.employee_id = aw.employee_id
    join app.additional_work_approval_statuses aws
      on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
    left join app.additional_work_accrual_statuses awas
      on awas.additional_work_accrual_status_id = aw.additional_work_accrual_status_id
    where aw.cancelled_at is null
      and (
        (
          aws.is_pending = true
          and aw.started_at is null
          and aw.finished_at is null
          and aw.is_assignment_finished = false
        )
        or (
          aw.finished_at is not null
          and awas.is_waiting_accrual = true
        )
      )

    union all

    select
      case
        when mdbp.downtime_class = 'CRITICAL' then 'CRITICAL_DOWNTIME_OPEN'
        else 'OPERATIONAL_DOWNTIME_OVER_15_MIN'
      end as task_kind,
      'machine_downtimes'::text as source_table,
      md.machine_downtime_id::text as source_id,
      md.started_at::text as source_started_at,
      case when mdbp.downtime_class = 'CRITICAL' then 1 else 2 end as sort_group,
      null::text as additional_work_name,
      null::text as employee_full_name,
      m.machine_id::text as machine_id,
      m.machine_name,
      mdt.machine_downtime_type_name as downtime_name,
      floor(extract(epoch from (now() - md.started_at)) / 60)::bigint as elapsed_minutes
    from app.machine_downtimes md
    join app.machine_downtime_types mdt
      on mdt.machine_downtime_type_id = md.machine_downtime_type_id
    join app.machine_downtime_behavior_profiles mdbp
      on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    join app.machines m
      on m.machine_id = md.machine_id
    where md.is_open = true
      and md.started_at is not null
      and exists (
        select 1
        from app.machine_downtime_profile_notification_rules rule
        where rule.machine_downtime_behavior_profile_id = mdbp.machine_downtime_behavior_profile_id
          and rule.is_active = true
          and rule.recipient_permission_code = 'can_receive_production_notifications'
          and md.started_at <= now() - (rule.threshold_minutes * interval '1 minute')
      )
  )
`;

export type ManagerCriticalDowntimeTypeRow = QueryResultRow & {
  downtime_type_id: string;
  downtime_type_name: string;
  display_order: string | number;
};

export type ManagerSalaryCorrectionContextEmployeeRow = QueryResultRow & {
  employee_id: string;
  employee_full_name: string;
  employee_shift_id: string;
  shift_started_at: string;
  shift_finished_at: string | null;
};

export type ManagerSalaryCorrectionDefaultTypesRow = QueryResultRow & {
  default_accrual_salary_correction_type_id: string | null;
  default_withholding_salary_correction_type_id: string | null;
};

export type ManagerSalaryCorrectionTypeRow = QueryResultRow & {
  salary_correction_type_id: string;
  salary_correction_type_name: string;
};

export type ManagerCompletedWorkRow = QueryResultRow & {
  work_item_id: string;
  work_type: 'production' | 'additional_work';
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

export async function readEmployeeWorkplaceSnapshot(
  pool: DbPool,
  employeeId: string
): Promise<EmployeeWorkplaceSnapshotRow | undefined> {
  const rows = await readQuery<EmployeeWorkplaceSnapshotRow>(pool, {
    sql: `
      with
      employee_identity as (
        select e.full_name as employee_full_name
        from app.employees e
        where e.employee_id = $1
        limit 1
      ),
      active_shift as (
        select employee_shift_id::text, started_at::text as shift_started_at
        from app.employee_shifts
        where employee_id = $1
          and is_open = true
        limit 1
      ),
      active_production as (
        select
          po.production_operation_id::text,
          po.machine_id::text as production_machine_id,
          m.machine_name as production_machine_name,
          po.sku_id::text,
          s.sku_code,
          s.sku_name
        from app.production_operations po
        join app.machines m on m.machine_id = po.machine_id
        join app.skus s on s.sku_id = po.sku_id
        where po.employee_id = $1
          and po.is_open = true
        limit 1
      ),
      linked_downtime as (
        select
          md.machine_downtime_id::text as linked_downtime_id,
          md.production_operation_id::text as linked_downtime_production_operation_id,
          md.machine_id::text as linked_downtime_machine_id,
          m.machine_name as linked_downtime_machine_name,
          mdt.machine_downtime_type_id::text as linked_downtime_type_id,
          mdt.machine_downtime_type_name as linked_downtime_type_name,
          mdbp.downtime_class as linked_downtime_class
        from app.machine_downtimes md
        join app.machine_downtime_types mdt on mdt.machine_downtime_type_id = md.machine_downtime_type_id
        join app.machine_downtime_behavior_profiles mdbp
          on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
        join app.machines m on m.machine_id = md.machine_id
        join active_production ap on ap.production_machine_id = md.machine_id::text
        where md.is_open = true
        limit 1
      ),
      active_break as (
        select
          ob.operator_break_id::text,
          ob.operator_break_type_id::text as break_type_id,
          obt.operator_break_type_name as break_type_name
        from app.operator_breaks ob
        join app.operator_break_types obt on obt.operator_break_type_id = ob.operator_break_type_id
        where ob.employee_id = $1
          and ob.is_open = true
        limit 1
      ),
      active_additional_work as (
        select
          aw.additional_work_id::text as active_additional_work_id,
          awt.additional_work_type_name as active_additional_work_name
        from app.additional_works aw
        join app.additional_work_types awt
          on awt.additional_work_type_id = aw.additional_work_type_id
        where aw.employee_id = $1
          and aw.started_at is not null
          and aw.finished_at is null
          and aw.cancelled_at is null
        limit 1
      ),
      approved_unstarted as (
        select count(*)::text as approved_unstarted_count
        from app.additional_works aw
        join app.additional_work_approval_statuses aws
          on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
        where aw.employee_id = $1
          and aws.is_approved = true
          and aw.started_at is null
          and aw.finished_at is null
          and aw.cancelled_at is null
          and aw.is_assignment_finished = false
      )
      select
        employee_identity.employee_full_name,
        active_shift.employee_shift_id,
        active_shift.shift_started_at,
        active_production.production_operation_id,
        active_production.production_machine_id,
        active_production.production_machine_name,
        active_production.sku_id,
        active_production.sku_code,
        active_production.sku_name,
        linked_downtime.linked_downtime_id,
        linked_downtime.linked_downtime_production_operation_id,
        linked_downtime.linked_downtime_machine_id,
        linked_downtime.linked_downtime_machine_name,
        linked_downtime.linked_downtime_type_id,
        linked_downtime.linked_downtime_type_name,
        linked_downtime.linked_downtime_class,
        active_break.operator_break_id,
        active_break.break_type_id,
        active_break.break_type_name,
        active_additional_work.active_additional_work_id,
        active_additional_work.active_additional_work_name,
        approved_unstarted.approved_unstarted_count
      from approved_unstarted
      left join employee_identity on true
      left join active_shift on true
      left join active_production on true
      left join linked_downtime on true
      left join active_break on true
      left join active_additional_work on true
    `,
    params: [employeeId]
  });

  return rows[0];
}

export async function readManagerWorkplaceState(
  pool: DbPool,
  managerEmployeeId: string
): Promise<ManagerWorkplaceStateRow | undefined> {
  const rows = await readQuery<ManagerWorkplaceStateRow>(pool, {
    sql: `
      with
      manager_actor as (
        select distinct
          e.employee_id::text as manager_employee_id,
          e.full_name as manager_full_name
        from app.employees e
        join app.employee_statuses es
          on es.employee_status_id = e.employee_status_id
        join app.employee_roles er
          on er.employee_id = e.employee_id
         and er.revoked_at is null
        join app.roles r
          on r.role_id = er.role_id
        where e.employee_id = $1
          and es.is_active_for_login = true
          and r.is_active = true
          and r.can_manage_production = true
        limit 1
      ),
      production_operators as (
        select distinct e.employee_id
        from app.employees e
        join app.employee_statuses es
          on es.employee_status_id = e.employee_status_id
        join app.positions p
          on p.position_id = e.position_id
        join app.employee_roles er
          on er.employee_id = e.employee_id
         and er.revoked_at is null
        join app.roles r
          on r.role_id = er.role_id
        where es.is_active_for_login = true
          and p.is_production_position = true
          and r.is_active = true
          and r.can_work_as_operator = true
      ),
      active_machine_state as (
        select
          m.machine_id,
          exists (
            select 1
            from app.machine_downtimes md
            where md.machine_id = m.machine_id
              and md.is_open = true
          ) as has_open_downtime,
          exists (
            select 1
            from app.machine_downtimes md
            join app.machine_downtime_types mdt
              on mdt.machine_downtime_type_id = md.machine_downtime_type_id
            join app.machine_downtime_behavior_profiles mdbp
              on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
            where md.machine_id = m.machine_id
              and md.is_open = true
              and mdbp.downtime_class = 'CRITICAL'
          ) as has_open_critical_downtime,
          exists (
            select 1
            from app.machine_downtimes md
            join app.machine_downtime_types mdt
              on mdt.machine_downtime_type_id = md.machine_downtime_type_id
            join app.machine_downtime_behavior_profiles mdbp
              on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
            where md.machine_id = m.machine_id
              and md.is_open = true
              and mdbp.downtime_class = 'OPERATIONAL'
          ) as has_open_operational_downtime,
          exists (
            select 1
            from app.production_operations po
            where po.machine_id = m.machine_id
              and po.is_open = true
          ) as has_open_production
        from app.machines m
        join app.machine_use_statuses mus
          on mus.machine_use_status_id = m.machine_use_status_id
        where mus.is_available_for_operations = true
          and mus.is_decommissioned = false
      ),
      active_shifts as (
        select distinct esh.employee_id
        from app.employee_shifts esh
        join production_operators po
          on po.employee_id = esh.employee_id
        where esh.is_open = true
      ),
      active_breaks as (
        select distinct ob.employee_id
        from app.operator_breaks ob
        join production_operators po
          on po.employee_id = ob.employee_id
        where ob.is_open = true
      ),
      active_productions as (
        select distinct
          pr.employee_id,
          pr.production_operation_id,
          pr.machine_id
        from app.production_operations pr
        join production_operators po
          on po.employee_id = pr.employee_id
        where pr.is_open = true
      ),
      active_production_downtimes as (
        select distinct
          ap.employee_id,
          md.machine_downtime_id,
          mdbp.downtime_class
        from active_productions ap
        join app.machine_downtimes md
          on md.machine_id = ap.machine_id
         and md.is_open = true
        join app.machine_downtime_types mdt
          on mdt.machine_downtime_type_id = md.machine_downtime_type_id
        join app.machine_downtime_behavior_profiles mdbp
          on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
      ),
      active_additional_works as (
        select distinct aw.employee_id
        from app.additional_works aw
        join app.additional_work_approval_statuses aws
          on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
        join production_operators po
          on po.employee_id = aw.employee_id
        where aws.is_approved = true
          and aw.started_at is not null
          and aw.finished_at is null
          and aw.cancelled_at is null
          and aw.is_assignment_finished = false
      ),
      all_open_downtimes as (
        select
          md.machine_downtime_id,
          mdbp.downtime_class
        from app.machine_downtimes md
        join app.machine_downtime_types mdt
          on mdt.machine_downtime_type_id = md.machine_downtime_type_id
        join app.machine_downtime_behavior_profiles mdbp
          on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
        where md.is_open = true
      ),
      additional_work_summary_source as (
        select
          aw.additional_work_id,
          aws.is_pending,
          aws.is_approved,
          aw.started_at,
          aw.finished_at,
          aw.cancelled_at,
          aw.is_assignment_finished,
          awas.is_waiting_accrual
        from app.additional_works aw
        join app.additional_work_approval_statuses aws
          on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
        left join app.additional_work_accrual_statuses awas
          on awas.additional_work_accrual_status_id = aw.additional_work_accrual_status_id
      ),
      ${managerCanonicalOpenTaskCteSql}
      select
        ma.manager_employee_id,
        ma.manager_full_name,
        count(*) filter (
          where ams.has_open_downtime = false
            and ams.has_open_production = true
        )::text as machine_running_count,
        count(*) filter (where ams.has_open_downtime = true)::text as machine_downtime_count,
        count(*) filter (
          where ams.has_open_downtime = false
            and ams.has_open_production = false
        )::text as machine_idle_count,
        count(*) filter (where ams.has_open_critical_downtime = true)::text as machine_critical_downtime_count,
        count(*) filter (
          where ams.has_open_operational_downtime = true
            and ams.has_open_critical_downtime = false
        )::text as machine_operational_downtime_count,
        (select count(*)::text from active_shifts) as employee_open_shift_count,
        (select count(distinct employee_id)::text from active_productions) as employee_production_count,
        (select count(distinct employee_id)::text from active_production_downtimes) as employee_downtime_count,
        (select count(distinct employee_id)::text from active_additional_works) as employee_additional_work_count,
        (select count(distinct employee_id)::text from active_breaks) as employee_break_count,
        (
          select count(*)::text
          from active_shifts ash
          where not exists (select 1 from active_productions ap where ap.employee_id = ash.employee_id)
            and not exists (select 1 from active_additional_works aaw where aaw.employee_id = ash.employee_id)
            and not exists (select 1 from active_breaks ab where ab.employee_id = ash.employee_id)
            and not exists (select 1 from active_production_downtimes apd where apd.employee_id = ash.employee_id)
        ) as employee_without_work_count,
        (
          select count(distinct ap.employee_id)::text
          from active_productions ap
          where not exists (select 1 from active_breaks ab where ab.employee_id = ap.employee_id)
            and not exists (select 1 from active_production_downtimes apd where apd.employee_id = ap.employee_id)
        ) as employee_production_active_clear_count,
        (
          select count(distinct ap.employee_id)::text
          from active_productions ap
          where exists (select 1 from active_breaks ab where ab.employee_id = ap.employee_id)
        ) as employee_production_break_count,
        (
          select count(distinct ap.employee_id)::text
          from active_productions ap
          where exists (select 1 from active_production_downtimes apd where apd.employee_id = ap.employee_id)
        ) as employee_production_downtime_count,
        (
          select count(*)::text
          from active_production_downtimes apd
          where apd.downtime_class = 'CRITICAL'
        ) as employee_production_critical_downtime_count,
        (
          select count(*)::text
          from active_production_downtimes apd
          where apd.downtime_class = 'OPERATIONAL'
        ) as employee_production_operational_downtime_count,
        (
          select count(*)::text
          from active_additional_works aaw
          where not exists (select 1 from active_breaks ab where ab.employee_id = aaw.employee_id)
        ) as employee_additional_work_active_clear_count,
        (
          select count(*)::text
          from active_additional_works aaw
          where exists (select 1 from active_breaks ab where ab.employee_id = aaw.employee_id)
        ) as employee_additional_work_break_count,
        (
          select count(*)::text
          from active_shifts ash
          where not exists (select 1 from active_productions ap where ap.employee_id = ash.employee_id)
            and not exists (select 1 from active_additional_works aaw where aaw.employee_id = ash.employee_id)
            and not exists (select 1 from active_breaks ab where ab.employee_id = ash.employee_id)
            and not exists (select 1 from active_production_downtimes apd where apd.employee_id = ash.employee_id)
        ) as employee_open_shift_without_work_count,
        (
          select count(*)::text
          from all_open_downtimes aod
          where aod.downtime_class = 'CRITICAL'
        ) as downtime_critical_count,
        (
          select count(*)::text
          from all_open_downtimes aod
          where aod.downtime_class = 'OPERATIONAL'
        ) as downtime_operational_count,
        (
          select count(*)::text
          from additional_work_summary_source aws
          where aws.is_pending = true
            and aws.started_at is null
            and aws.finished_at is null
            and aws.cancelled_at is null
            and aws.is_assignment_finished = false
        ) as additional_work_requested_count,
        (
          select count(*)::text
          from additional_work_summary_source aws
          where aws.is_approved = true
            and aws.started_at is null
            and aws.finished_at is null
            and aws.cancelled_at is null
            and aws.is_assignment_finished = false
        ) as additional_work_approved_count,
        (
          select count(*)::text
          from additional_work_summary_source aws
          where aws.is_approved = true
            and aws.started_at is not null
            and aws.finished_at is null
            and aws.cancelled_at is null
            and aws.is_assignment_finished = false
        ) as additional_work_active_count,
        (
          select count(*)::text
          from additional_work_summary_source aws
          where aws.finished_at is not null
            and aws.cancelled_at is null
            and aws.is_waiting_accrual = true
        ) as additional_work_requires_accrual_count,
        (select count(*)::text from canonical_open_tasks) as open_tasks_count
      from manager_actor ma
      left join active_machine_state ams on true
      group by ma.manager_employee_id, ma.manager_full_name
    `,
    params: [managerEmployeeId]
  });

  return rows[0];
}

export async function readManagerIdentity(
  pool: DbPool,
  managerEmployeeId: string
): Promise<ManagerIdentityRow | undefined> {
  const rows = await readQuery<ManagerIdentityRow>(pool, {
    sql: `
      select distinct
        e.employee_id::text as manager_employee_id,
        e.full_name as manager_full_name
      from app.employees e
      join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
      join app.employee_roles er
        on er.employee_id = e.employee_id
       and er.revoked_at is null
      join app.roles r
        on r.role_id = er.role_id
      where e.employee_id = $1
        and es.is_active_for_login = true
        and r.is_active = true
        and r.can_manage_production = true
      limit 1
    `,
    params: [managerEmployeeId]
  });

  return rows[0];
}

const managerMachineReadModelSql = `
  with
  active_production as (
    select
      po.production_operation_id::text as active_production_operation_id,
      po.machine_id,
      po.employee_id,
      e.employee_id::text as active_employee_id,
      e.full_name as active_employee_full_name,
      s.sku_id::text as active_sku_id,
      s.sku_code as active_sku_code,
      s.sku_name as active_sku_name
    from app.production_operations po
    join app.employees e
      on e.employee_id = po.employee_id
    join app.skus s
      on s.sku_id = po.sku_id
    where po.is_open = true
  ),
  active_break as (
    select
      ob.employee_id,
      ob.operator_break_id::text as active_break_id,
      obt.operator_break_type_name as active_break_name
    from app.operator_breaks ob
    join app.operator_break_types obt
      on obt.operator_break_type_id = ob.operator_break_type_id
    where ob.is_open = true
  ),
  active_downtime as (
    select
      md.machine_id,
      md.machine_downtime_id::text as active_downtime_id,
      case
        when mdbp.downtime_class = 'CRITICAL' then 'critical'
        when mdbp.downtime_class = 'OPERATIONAL' then 'operational'
        else null
      end as downtime_type,
      mdt.machine_downtime_type_name as downtime_name,
      md.finish_comment as downtime_comment,
      md.started_at::text as downtime_started_at,
      case when md.started_at is null then null else concat(floor(extract(epoch from (now() - md.started_at)) / 3600)::int, ' ч ', floor(mod(extract(epoch from (now() - md.started_at)), 3600) / 60)::int, ' мин') end as downtime_duration,
      (
        select mse.reason
        from app.machine_status_events mse
        where mse.cause_table_name = 'machine_downtimes'
          and mse.cause_record_id = md.machine_downtime_id
          and mse.reason is not null
        order by mse.changed_at asc, mse.machine_status_event_id asc
        limit 1
      ) as downtime_start_comment,
      md.finish_comment as downtime_finish_comment
    from app.machine_downtimes md
    join app.machine_downtime_types mdt
      on mdt.machine_downtime_type_id = md.machine_downtime_type_id
    join app.machine_downtime_behavior_profiles mdbp
      on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    where md.is_open = true
  )
  select
    m.machine_id::text,
    m.machine_name,
    ap.active_production_operation_id,
    ap.active_employee_id,
    ap.active_employee_full_name,
    ap.active_sku_id,
    ap.active_sku_code,
    ap.active_sku_name,
    ab.active_break_id,
    ab.active_break_name,
    ad.active_downtime_id,
    ad.downtime_type,
    ad.downtime_name,
    ad.downtime_comment,
    ad.downtime_started_at,
    ad.downtime_duration,
    ad.downtime_start_comment,
    ad.downtime_finish_comment,
    (ad.downtime_type = 'critical') as has_active_critical_downtime,
    (ad.downtime_type = 'operational') as has_active_operational_downtime,
    case when ad.downtime_type = 'operational' then ad.active_downtime_id else null end as active_operational_downtime_id,
    (ad.active_downtime_id is null) as is_selectable_for_manager_critical_downtime
  from app.machines m
  join app.machine_use_statuses mus
    on mus.machine_use_status_id = m.machine_use_status_id
  left join active_production ap
    on ap.machine_id = m.machine_id
  left join active_break ab
    on ab.employee_id = ap.employee_id
  left join active_downtime ad
    on ad.machine_id = m.machine_id
  where mus.is_available_for_operations = true
    and mus.is_decommissioned = false
`;

export function readManagerMachineReadModelRows(pool: DbPool): Promise<ManagerMachineReadModelRow[]> {
  return readQuery<ManagerMachineReadModelRow>(pool, {
    sql: `${managerMachineReadModelSql}
      order by m.machine_name, m.machine_id
    `
  });
}

export async function readManagerMachineReadModelRow(
  pool: DbPool,
  machineId: string
): Promise<ManagerMachineReadModelRow | undefined> {
  const rows = await readQuery<ManagerMachineReadModelRow>(pool, {
    sql: `${managerMachineReadModelSql}
      and m.machine_id = $1
      limit 1
    `,
    params: [machineId]
  });

  return rows[0];
}

const managerEmployeeReadModelSql = `
  with
  production_operators as (
    select distinct
      e.employee_id,
      e.employee_id::text as employee_id_text,
      e.full_name
    from app.employees e
    join app.employee_statuses es
      on es.employee_status_id = e.employee_status_id
    join app.positions p
      on p.position_id = e.position_id
    join app.employee_roles er
      on er.employee_id = e.employee_id
     and er.revoked_at is null
    join app.roles r
      on r.role_id = er.role_id
    where es.is_active_for_login = true
      and p.is_production_position = true
      and r.is_active = true
      and r.can_work_as_operator = true
  ),
  active_shift as (
    select
      esh.employee_id,
      esh.employee_shift_id::text as open_shift_id,
      esh.started_at::text as shift_started_at
    from app.employee_shifts esh
    where esh.is_open = true
  ),
  active_production as (
    select
      po.production_operation_id,
      po.production_operation_id::text as active_production_operation_id,
      po.machine_id,
      po.employee_id,
      po.started_at::text as production_started_at,
      m.machine_id::text as active_machine_id,
      m.machine_name as active_machine_name,
      s.sku_id::text as active_sku_id,
      s.sku_code as active_sku_code,
      s.sku_name as active_sku_name
    from app.production_operations po
    join app.machines m
      on m.machine_id = po.machine_id
    join app.skus s
      on s.sku_id = po.sku_id
    where po.is_open = true
  ),
  active_break as (
    select
      ob.employee_id,
      ob.operator_break_id::text as active_break_id,
      obt.operator_break_type_name as active_break_name,
      ob.started_at::text as break_started_at,
      case when ob.started_at is null then null else concat(floor(extract(epoch from (now() - ob.started_at)) / 3600)::int, ' ч ', floor(mod(extract(epoch from (now() - ob.started_at)), 3600) / 60)::int, ' мин') end as break_duration
    from app.operator_breaks ob
    join app.operator_break_types obt
      on obt.operator_break_type_id = ob.operator_break_type_id
    where ob.is_open = true
  ),
  active_downtime as (
    select
      md.machine_id,
      md.production_operation_id,
      md.machine_downtime_id::text as active_downtime_id,
      case
        when mdbp.downtime_class = 'CRITICAL' then 'critical'
        when mdbp.downtime_class = 'OPERATIONAL' then 'operational'
        else null
      end as downtime_type,
      mdt.machine_downtime_type_name as downtime_name,
      md.finish_comment as downtime_comment,
      md.started_at::text as downtime_started_at,
      case when md.started_at is null then null else concat(floor(extract(epoch from (now() - md.started_at)) / 3600)::int, ' ч ', floor(mod(extract(epoch from (now() - md.started_at)), 3600) / 60)::int, ' мин') end as downtime_duration,
      (
        select mse.reason
        from app.machine_status_events mse
        where mse.cause_table_name = 'machine_downtimes'
          and mse.cause_record_id = md.machine_downtime_id
          and mse.reason is not null
        order by mse.changed_at asc, mse.machine_status_event_id asc
        limit 1
      ) as downtime_start_comment,
      md.finish_comment as downtime_finish_comment
    from app.machine_downtimes md
    join app.machine_downtime_types mdt
      on mdt.machine_downtime_type_id = md.machine_downtime_type_id
    join app.machine_downtime_behavior_profiles mdbp
      on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
    where md.is_open = true
  ),
  active_additional_work as (
    select
      aw.employee_id,
      aw.additional_work_id::text as active_additional_work_id,
      awt.additional_work_type_name as active_additional_work_name,
      aw.started_at::text as additional_work_started_at,
      case when aw.started_at is null then null else concat(floor(extract(epoch from (now() - aw.started_at)) / 3600)::int, ' ч ', floor(mod(extract(epoch from (now() - aw.started_at)), 3600) / 60)::int, ' мин') end as additional_work_duration
    from app.additional_works aw
    join app.additional_work_types awt
      on awt.additional_work_type_id = aw.additional_work_type_id
    join app.additional_work_approval_statuses aws
      on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
    where aws.is_approved = true
      and aw.started_at is not null
      and aw.finished_at is null
      and aw.cancelled_at is null
      and aw.is_assignment_finished = false
  )
  select
    po.employee_id_text as employee_id,
    po.full_name,
    ash.open_shift_id,
    ash.shift_started_at,
    ap.active_production_operation_id,
    ap.production_started_at,
    ap.active_machine_id,
    ap.active_machine_name,
    ap.active_sku_id,
    ap.active_sku_code,
    ap.active_sku_name,
    ab.active_break_id,
    ab.active_break_name,
    ab.break_started_at,
    ab.break_duration,
    case
      when ab.active_break_id is not null and ap.active_production_operation_id is not null then 'production'
      when ab.active_break_id is not null and aaw.active_additional_work_id is not null then 'additional_work'
      else 'none'
    end as break_context_type,
    ad.active_downtime_id,
    ad.downtime_type,
    ad.downtime_name,
    ad.downtime_comment,
    ad.downtime_started_at,
    ad.downtime_duration,
    ad.downtime_start_comment,
    ad.downtime_finish_comment,
    aaw.active_additional_work_id,
    aaw.active_additional_work_name,
    aaw.additional_work_started_at,
    aaw.additional_work_duration
  from production_operators po
  left join active_shift ash
    on ash.employee_id = po.employee_id
  left join active_production ap
    on ap.employee_id = po.employee_id
  left join active_break ab
    on ab.employee_id = po.employee_id
  left join active_downtime ad
    on ad.machine_id = ap.machine_id
  left join active_additional_work aaw
    on aaw.employee_id = po.employee_id
`;

export function readManagerEmployeeReadModelRows(pool: DbPool): Promise<ManagerEmployeeReadModelRow[]> {
  return readQuery<ManagerEmployeeReadModelRow>(pool, {
    sql: `${managerEmployeeReadModelSql}
      order by
        case
          when ad.downtime_type = 'critical' then 1
          when ad.downtime_type = 'operational' then 2
          when ap.active_production_operation_id is not null then 3
          when ab.active_break_id is not null then 4
          when aaw.active_additional_work_id is not null then 5
          when ash.open_shift_id is not null then 6
          else 7
        end,
        po.full_name,
        po.employee_id
    `
  });
}

export async function readManagerEmployeeReadModelRow(
  pool: DbPool,
  employeeId: string
): Promise<ManagerEmployeeReadModelRow | undefined> {
  const rows = await readQuery<ManagerEmployeeReadModelRow>(pool, {
    sql: `${managerEmployeeReadModelSql}
      where po.employee_id_text = $1
      limit 1
    `,
    params: [employeeId]
  });

  return rows[0];
}

export function readManagerAdditionalWorkRows(pool: DbPool): Promise<ManagerAdditionalWorkRow[]> {
  return readQuery<ManagerAdditionalWorkRow>(pool, {
    sql: `
      with
      production_operators as (
        select distinct
          e.employee_id,
          e.full_name
        from app.employees e
        join app.employee_statuses es
          on es.employee_status_id = e.employee_status_id
        join app.positions p
          on p.position_id = e.position_id
        join app.employee_roles er
          on er.employee_id = e.employee_id
         and er.revoked_at is null
        join app.roles r
          on r.role_id = er.role_id
        where es.is_active_for_login = true
          and p.is_production_position = true
          and r.is_active = true
          and r.can_work_as_operator = true
      )
      select
        aw.additional_work_id::text,
        aw.additional_work_type_id::text,
        awt.additional_work_type_name as additional_work_name,
        po.employee_id::text,
        po.full_name as employee_full_name,
        case when aws.is_pending = true then aw.assigned_at::text else null end as requested_at,
        aw.created_at::text,
        aw.started_at::text,
        aw.finished_at::text,
        case
          when aws.is_pending = true
            and aw.started_at is null
            and aw.finished_at is null
            and aw.cancelled_at is null
            and aw.is_assignment_finished = false then 'requested'
          when aws.is_approved = true
            and aw.started_at is null
            and aw.finished_at is null
            and aw.cancelled_at is null
            and aw.is_assignment_finished = false then 'approved'
          when aws.is_approved = true
            and aw.started_at is not null
            and aw.finished_at is null
            and aw.cancelled_at is null
            and aw.is_assignment_finished = false then 'active'
          when aw.finished_at is not null
            and aw.cancelled_at is null
            and awas.is_waiting_accrual = true then 'waiting_accrual'
          else null
        end as status
      from app.additional_works aw
      join app.additional_work_types awt
        on awt.additional_work_type_id = aw.additional_work_type_id
      join app.additional_work_approval_statuses aws
        on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
      left join app.additional_work_accrual_statuses awas
        on awas.additional_work_accrual_status_id = aw.additional_work_accrual_status_id
      join production_operators po
        on po.employee_id = aw.employee_id
      where (
          aws.is_pending = true
          and aw.started_at is null
          and aw.finished_at is null
          and aw.cancelled_at is null
          and aw.is_assignment_finished = false
        )
        or (
          aws.is_approved = true
          and aw.started_at is null
          and aw.finished_at is null
          and aw.cancelled_at is null
          and aw.is_assignment_finished = false
        )
        or (
          aws.is_approved = true
          and aw.started_at is not null
          and aw.finished_at is null
          and aw.cancelled_at is null
          and aw.is_assignment_finished = false
        )
        or (
          aw.finished_at is not null
          and aw.cancelled_at is null
          and awas.is_waiting_accrual = true
        )
      order by
        case
          when aws.is_pending = true then 1
          when aws.is_approved = true and aw.started_at is null then 2
          when aws.is_approved = true and aw.started_at is not null and aw.finished_at is null then 3
          else 4
        end,
        aw.assigned_at desc,
        aw.additional_work_id desc
    `
  });
}

export function readManagerCanonicalOpenTaskSourceRows(
  pool: DbPool
): Promise<ManagerCanonicalOpenTaskSourceRow[]> {
  return readQuery<ManagerCanonicalOpenTaskSourceRow>(pool, {
    sql: `
      with
      ${managerCanonicalOpenTaskCteSql}
      select
        task_kind,
        source_table,
        source_id,
        source_started_at,
        sort_group,
        additional_work_name,
        employee_full_name,
        machine_id,
        machine_name,
        downtime_name,
        elapsed_minutes
      from canonical_open_tasks
      order by sort_group, source_started_at, source_id
    `
  });
}

export function readManagerOpenTaskRows(pool: DbPool, managerEmployeeId: string): Promise<ManagerOpenTaskRow[]> {
  return readQuery<ManagerOpenTaskRow>(pool, {
    sql: `
      with
      manager_actor as (
        select distinct
          e.employee_id::text as manager_employee_id
        from app.employees e
        join app.employee_statuses es
          on es.employee_status_id = e.employee_status_id
        join app.employee_roles er
          on er.employee_id = e.employee_id
         and er.revoked_at is null
        join app.roles r
          on r.role_id = er.role_id
        where e.employee_id = $1
          and es.is_active_for_login = true
          and r.is_active = true
          and r.can_manage_production = true
        limit 1
      ),
      source_enriched as (
        select distinct
          n.notification_id::text,
          n.created_at::text,
          case
            when n.cause_table_name is null then 'general'
            when n.cause_table_name in ('additional_works', 'machine_downtimes', 'production_operations', 'machines')
              then n.cause_table_name
            else 'unknown'
          end as entity_table,
          n.cause_record_id::text as entity_id,
          n.title,
          n.message_text as description,
          aw.additional_work_id::text as aw_id,
          awt.additional_work_type_name as aw_name,
          awe.full_name as aw_employee_full_name,
          aws.is_pending as aw_is_pending,
          awas.is_waiting_accrual as aw_is_waiting_accrual,
          aw.assigned_at::text as aw_assigned_at,
          md.machine_downtime_id::text as downtime_id,
          md.started_at::text as downtime_started_at,
          md.machine_id::text as downtime_machine_id,
          m.machine_name as downtime_machine_name,
          mdt.machine_downtime_type_name as downtime_name,
          greatest(
            0,
            floor(extract(epoch from (now() - md.started_at)) / 60)::integer
          )::text as downtime_elapsed_minutes,
          mdbp.downtime_class
        from manager_actor ma
        join app.notifications n
          on n.recipient_employee_id::text = ma.manager_employee_id
        join app.notification_statuses ns
          on ns.notification_status_id = n.notification_status_id
        left join app.additional_works aw
          on n.cause_table_name = 'additional_works'
         and aw.additional_work_id = n.cause_record_id
        left join app.additional_work_types awt
          on awt.additional_work_type_id = aw.additional_work_type_id
        left join app.employees awe
          on awe.employee_id = aw.employee_id
        left join app.additional_work_approval_statuses aws
          on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
        left join app.additional_work_accrual_statuses awas
          on awas.additional_work_accrual_status_id = aw.additional_work_accrual_status_id
        left join app.machine_downtimes md
          on n.cause_table_name = 'machine_downtimes'
         and md.machine_downtime_id = n.cause_record_id
        left join app.machine_downtime_types mdt
          on mdt.machine_downtime_type_id = md.machine_downtime_type_id
        left join app.machine_downtime_behavior_profiles mdbp
          on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
        left join app.machines m
          on m.machine_id = md.machine_id
        where ns.is_cancelled = false
          and ns.is_read = false
          and n.hidden_from_chat_at is null
          and ${managerOpenTaskUnresolvedSourcePredicateSql}
      ),
      normalized as (
        select
          notification_id,
          created_at,
          entity_table,
          entity_id,
          case
            when entity_table = 'additional_works' and aw_is_pending = true then 'ADDITIONAL_WORK_REQUESTED'
            when entity_table = 'additional_works' then 'ADDITIONAL_WORK_WAITING_ACCRUAL'
            when entity_table = 'machine_downtimes'
              and downtime_class = 'CRITICAL' then 'CRITICAL_DOWNTIME_OPEN'
            when entity_table = 'machine_downtimes' then 'OPERATIONAL_DOWNTIME_OVER_15_MIN'
            else null
          end as task_kind,
          title,
          description,
          aw_id,
          aw_name,
          aw_employee_full_name,
          aw_assigned_at,
          downtime_id,
          downtime_started_at,
          downtime_machine_id,
          downtime_machine_name,
          downtime_name,
          downtime_elapsed_minutes
        from source_enriched
      )
      select
        notification_id as task_id,
        notification_id,
        created_at,
        entity_table,
        entity_id,
        task_kind,
        entity_table as source_table,
        entity_id as source_id,
        case
          when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 'additional_work_request'
          when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 'additional_work_waiting_accrual'
          when task_kind in ('CRITICAL_DOWNTIME_OPEN', 'OPERATIONAL_DOWNTIME_OVER_15_MIN') then 'open_machine_downtime'
          else 'unknown'
        end as task_type,
        coalesce(title, case
          when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 'Запрошена доп. работа'
          when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 'Доп. работа требует начисления'
          when task_kind = 'CRITICAL_DOWNTIME_OPEN' then 'Критический простой'
          when task_kind = 'OPERATIONAL_DOWNTIME_OVER_15_MIN' then 'Операционный простой более 15 минут'
          else 'Открытая задача'
        end) as title,
        description,
        case
          when task_kind = 'CRITICAL_DOWNTIME_OPEN' then 1
          when task_kind = 'OPERATIONAL_DOWNTIME_OVER_15_MIN' then 2
          when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 3
          when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 4
          else 99
        end::text as sort_group,
        coalesce(downtime_started_at, aw_assigned_at, created_at) as sort_started_at,
        case
          when task_kind = 'CRITICAL_DOWNTIME_OPEN' then 'red'
          when task_kind = 'OPERATIONAL_DOWNTIME_OVER_15_MIN' then 'yellow'
          when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 'gray'
          when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 'green'
          else 'gray'
        end as ui_color_token,
        case
          when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 'S03-AW10'
          when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 'S03-AW50'
          else 'S03-M02'
        end as target_screen_id,
        case
          when task_kind in ('ADDITIONAL_WORK_REQUESTED', 'ADDITIONAL_WORK_WAITING_ACCRUAL')
            then jsonb_build_object('additional_work_id', aw_id)
          else jsonb_build_object('machine_id', downtime_machine_id, 'downtime_id', downtime_id)
        end as target_context,
        array_remove(array[
          case
            when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 'Запрошена доп. работа'
            when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 'Доп. работа требует начисления'
            when task_kind in ('CRITICAL_DOWNTIME_OPEN', 'OPERATIONAL_DOWNTIME_OVER_15_MIN') then downtime_name
            else 'Открытая задача'
          end,
          case
            when task_kind in ('ADDITIONAL_WORK_REQUESTED', 'ADDITIONAL_WORK_WAITING_ACCRUAL') then aw_employee_full_name
            else downtime_machine_name
          end,
          case
            when task_kind in ('CRITICAL_DOWNTIME_OPEN', 'OPERATIONAL_DOWNTIME_OVER_15_MIN')
              then downtime_elapsed_minutes || ' мин'
            else null
          end
        ], null)::text[] as display_lines
      from normalized
      where task_kind is not null
      order by
        case
          when task_kind = 'CRITICAL_DOWNTIME_OPEN' then 1
          when task_kind = 'OPERATIONAL_DOWNTIME_OVER_15_MIN' then 2
          when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 3
          when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 4
          else 99
        end,
        coalesce(downtime_started_at, aw_assigned_at, created_at) asc,
        notification_id desc
    `,
    params: [managerEmployeeId]
  });
}

export function readEmployeeAdditionalWorkStateRows(pool: DbPool, employeeId: string): Promise<AdditionalWorkStateRow[]> {
  return readQuery<AdditionalWorkStateRow>(pool, {
    sql: `
      select
        aw.additional_work_id::text,
        aw.additional_work_type_id::text,
        awt.additional_work_type_name as display_name,
        aw.assigned_by_employee_id::text,
        aw.employee_id::text,
        aws.is_pending,
        aws.is_approved,
        aw.started_at::text,
        aw.finished_at::text,
        aw.cancelled_at::text,
        aw.is_assignment_finished
      from app.additional_works aw
      join app.additional_work_types awt on awt.additional_work_type_id = aw.additional_work_type_id
      join app.additional_work_approval_statuses aws
        on aws.additional_work_approval_status_id = aw.additional_work_approval_status_id
      where aw.employee_id = $1
        and aw.cancelled_at is null
        and aw.finished_at is null
        and aw.is_assignment_finished = false
        and (aws.is_pending = true or aws.is_approved = true)
      order by aw.assigned_at desc, aw.additional_work_id desc
    `,
    params: [employeeId]
  });
}

export function readActiveAdditionalWorkTypeRows(pool: DbPool): Promise<AdditionalWorkTypeStateRow[]> {
  return readQuery<AdditionalWorkTypeStateRow>(pool, {
    sql: `
      select
        additional_work_type_id::text,
        additional_work_type_name as display_name
      from app.additional_work_types
      where is_active = true
      order by additional_work_type_id
    `
  });
}

/**
 * Mirrors the unfinished-assignment predicate enforced by
 * app.request_additional_work and its partial unique index. This is a
 * presentation read only; PostgreSQL remains the final concurrency authority.
 */
export function readOperatorAvailableAdditionalWorkTypeRows(
  pool: DbPool,
  employeeId: string
): Promise<AdditionalWorkTypeStateRow[]> {
  return readQuery<AdditionalWorkTypeStateRow>(pool, {
    sql: `
      select
        awt.additional_work_type_id::text,
        awt.additional_work_type_name as display_name
      from app.additional_work_types awt
      where awt.is_active = true
        and not exists (
          select 1
          from app.additional_works aw
          where aw.employee_id = $1
            and aw.additional_work_type_id = awt.additional_work_type_id
            and aw.is_assignment_finished = false
        )
      order by awt.additional_work_type_id
    `,
    params: [employeeId]
  });
}

/**
 * Mirrors the accepted app.assign_additional_work target/type/unfinished predicates
 * as one read-only snapshot. PostgreSQL remains the authority; this query does not
 * attempt to predict serialization or unique-index races.
 */
export function readManagerAdditionalWorkAssignabilityRows(
  pool: DbPool,
  employeeId: string,
  selectedAdditionalWorkTypeId?: string
): Promise<ManagerAdditionalWorkAssignabilityRow[]> {
  return readQuery<ManagerAdditionalWorkAssignabilityRow>(pool, {
    sql: `
      with target as (
        select exists (
          select 1
          from app.employees e
          join app.employee_statuses es
            on es.employee_status_id = e.employee_status_id
          where e.employee_id = $1
            and es.is_active = true
            and es.is_active_for_login = true
            and exists (
              select 1
              from app.employee_roles er
              join app.roles r
                on r.role_id = er.role_id
              where er.employee_id = e.employee_id
                and er.revoked_at is null
                and r.is_active = true
                and r.can_work_as_operator = true
            )
        ) as is_available
      ), candidate_types as (
        select
          awt.additional_work_type_id::text as additional_work_type_id,
          awt.additional_work_type_name,
          awt.is_active
        from app.additional_work_types awt
        where awt.is_active = true
          or awt.additional_work_type_id::text = $2
      )
      select
        awt.additional_work_type_id,
        awt.additional_work_type_name as display_name,
        awt.is_active,
        (
          target.is_available = true
          and awt.is_active = true
          and not exists (
            select 1
            from app.additional_works aw
            where aw.employee_id = $1
              and aw.additional_work_type_id::text = awt.additional_work_type_id
              and aw.is_assignment_finished = false
          )
        ) as can_assign,
        case
          when target.is_available = false then 'additional_work_target_not_available'
          when awt.is_active = false then 'additional_work_type_not_available'
          when exists (
            select 1
            from app.additional_works aw
            where aw.employee_id = $1
              and aw.additional_work_type_id::text = awt.additional_work_type_id
              and aw.is_assignment_finished = false
          ) then 'additional_work_assignment_already_exists'
          else null
        end as blocked_code
      from candidate_types awt
      cross join target
      union all
      select
        $2 as additional_work_type_id,
        'Выбранный вид доп. работы' as display_name,
        false as is_active,
        false as can_assign,
        'additional_work_type_not_available' as blocked_code
      where $2 is not null
        and not exists (
          select 1
          from app.additional_work_types selected
          where selected.additional_work_type_id::text = $2
        )
      order by is_active desc, additional_work_type_id
    `,
    params: [employeeId, selectedAdditionalWorkTypeId ?? null]
  });
}

export function readManagerCriticalDowntimeTypeRows(pool: DbPool): Promise<ManagerCriticalDowntimeTypeRow[]> {
  return readQuery<ManagerCriticalDowntimeTypeRow>(pool, {
    sql: `
      select
        machine_downtime_type_id::text as downtime_type_id,
        machine_downtime_type_name as downtime_type_name,
        display_order::text
      from app.machine_downtime_types
      where is_active = true
        and downtime_class = 'CRITICAL'
      order by display_order, machine_downtime_type_id
    `
  });
}

export function readManagerSalaryCorrectionContextEmployees(
  pool: DbPool
): Promise<ManagerSalaryCorrectionContextEmployeeRow[]> {
  return readQuery<ManagerSalaryCorrectionContextEmployeeRow>(pool, {
    sql: `
      with today_shifts as (
        select distinct on (esh.employee_id)
          esh.employee_id,
          esh.employee_shift_id,
          esh.started_at,
          esh.finished_at
        from app.employee_shifts esh
        where timezone('Asia/Tashkent', esh.started_at)::date = timezone('Asia/Tashkent', now())::date
        order by esh.employee_id, esh.started_at desc, esh.employee_shift_id desc
      )
      select
        e.employee_id::text,
        e.full_name as employee_full_name,
        ts.employee_shift_id::text,
        ts.started_at::text as shift_started_at,
        ts.finished_at::text as shift_finished_at
      from today_shifts ts
      join app.employees e
        on e.employee_id = ts.employee_id
      join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
      join app.positions p
        on p.position_id = e.position_id
      join app.employee_roles er
        on er.employee_id = e.employee_id
       and er.revoked_at is null
      join app.roles r
        on r.role_id = er.role_id
      where es.is_active_for_login = true
        and p.is_production_position = true
        and r.is_active = true
        and r.can_work_as_operator = true
      order by e.full_name, e.employee_id
    `
  });
}

export async function readManagerSalaryCorrectionDefaultTypes(
  pool: DbPool
): Promise<ManagerSalaryCorrectionDefaultTypesRow> {
  const rows = await readQuery<ManagerSalaryCorrectionDefaultTypesRow>(pool, {
    sql: `
      select
        (
          select salary_correction_type_id::text
          from app.salary_correction_types
          where is_active = true
            and salary_correction_type_name ilike '%начис%'
          order by salary_correction_type_id
          limit 1
        ) as default_accrual_salary_correction_type_id,
        (
          select salary_correction_type_id::text
          from app.salary_correction_types
          where is_active = true
            and salary_correction_type_name ilike '%удерж%'
          order by salary_correction_type_id
          limit 1
        ) as default_withholding_salary_correction_type_id
    `
  });

  return rows[0] ?? {
    default_accrual_salary_correction_type_id: null,
    default_withholding_salary_correction_type_id: null
  };
}

export function readManagerSalaryCorrectionTypeRows(pool: DbPool): Promise<ManagerSalaryCorrectionTypeRow[]> {
  return readQuery<ManagerSalaryCorrectionTypeRow>(pool, {
    sql: `
      select
        salary_correction_type_id::text,
        salary_correction_type_name
      from app.salary_correction_types
      where is_active = true
      order by salary_correction_type_id
    `
  });
}

const managerCompletedWorksBaseSql = `
  with
  period_bounds as (
    select
      case $2
        when 'today' then timezone('Asia/Tashkent', now())::date
        when 'week' then (
          timezone('Asia/Tashkent', now())::date
          - ((extract(isodow from timezone('Asia/Tashkent', now())::date)::integer - 1) * interval '1 day')
        )::date
        when 'month' then date_trunc('month', timezone('Asia/Tashkent', now())::date)::date
        when 'last_30_days' then (timezone('Asia/Tashkent', now())::date - interval '29 days')::date
        else timezone('Asia/Tashkent', now())::date
      end as from_date,
      timezone('Asia/Tashkent', now())::date as to_date
  ),
  production_rows as (
    select
      concat('production:', mod.production_operation_id::text) as work_item_id,
      'production' as work_type,
      mod.production_operation_id::text as operation_id,
      mod.employee_id::text,
      mod.employee_full_name,
      mod.event_date::text as completed_date,
      mod.production_operation_id::text,
      null::text as additional_work_id,
      mod.machine_id::text,
      mod.machine_name,
      coalesce(mod.sku_name, mod.sku_code) as sku_name,
      mod.sku_code,
      mod.quantity_produced::text as quantity,
      null::text as additional_work_name,
      mod.salary_entry_id::text,
      coalesce(mod.salary_amount_uzs, 0)::text as salary_amount_uzs,
      coalesce(mod.salary_amount_uzs, 0)::text as amount_uzs,
      mod.quantity_produced::text as old_quantity,
      coalesce(mod.corrected_total_quantity_produced, mod.quantity_produced)::text as correction_base_quantity,
      coalesce(mod.corrected_total_quantity_produced, mod.quantity_produced)::text as current_quantity,
      (mod.production_operation_id is not null) as can_correct,
      (
        mod.salary_entry_id is not null
        and not exists (
          select 1
          from app.employee_salary_entries se
          where se.employee_salary_entry_id = mod.salary_entry_id
            and se.reversed_salary_entry_id is not null
        )
        and not exists (
          select 1
          from app.employee_salary_entries rev
          where rev.reversed_salary_entry_id = mod.salary_entry_id
        )
      ) as can_storno,
      exists (
        select 1
        from app.employee_salary_entries rev
        where rev.reversed_salary_entry_id = mod.salary_entry_id
      ) as is_reversed,
      (
        select rev.employee_salary_entry_id::text
        from app.employee_salary_entries rev
        where rev.reversed_salary_entry_id = mod.salary_entry_id
        order by rev.employee_salary_entry_id
        limit 1
      ) as reversal_id
    from app.machine_output_details mod
    cross join period_bounds pb
    where mod.employee_id::text = $1
      and mod.event_date between pb.from_date and pb.to_date
  ),
  additional_work_rows as (
    select
      concat('additional_work:', awd.additional_work_id::text) as work_item_id,
      'additional_work' as work_type,
      awd.additional_work_id::text as operation_id,
      awd.employee_id::text,
      awd.employee_full_name,
      awd.event_date::text as completed_date,
      null::text as production_operation_id,
      awd.additional_work_id::text,
      null::text as machine_id,
      null::text as machine_name,
      null::text as sku_name,
      null::text as sku_code,
      null::text as quantity,
      awd.additional_work_type_name as additional_work_name,
      awd.salary_entry_id::text,
      coalesce(awd.amount_uzs, 0)::text as salary_amount_uzs,
      coalesce(awd.amount_uzs, 0)::text as amount_uzs,
      null::text as old_quantity,
      null::text as correction_base_quantity,
      null::text as current_quantity,
      false as can_correct,
      (
        awd.salary_entry_id is not null
        and not exists (
          select 1
          from app.employee_salary_entries se
          where se.employee_salary_entry_id = awd.salary_entry_id
            and se.reversed_salary_entry_id is not null
        )
        and not exists (
          select 1
          from app.employee_salary_entries rev
          where rev.reversed_salary_entry_id = awd.salary_entry_id
        )
      ) as can_storno,
      exists (
        select 1
        from app.employee_salary_entries rev
        where rev.reversed_salary_entry_id = awd.salary_entry_id
      ) as is_reversed,
      (
        select rev.employee_salary_entry_id::text
        from app.employee_salary_entries rev
        where rev.reversed_salary_entry_id = awd.salary_entry_id
        order by rev.employee_salary_entry_id
        limit 1
      ) as reversal_id
    from app.additional_work_details awd
    cross join period_bounds pb
    where awd.employee_id::text = $1
      and awd.event_date between pb.from_date and pb.to_date
      and awd.salary_entry_id is not null
  )
`;

export function readManagerEmployeeCompletedWorks(
  pool: DbPool,
  employeeId: string,
  period: string,
  typeFilter: 'all' | 'production' | 'additional_work' = 'all'
): Promise<ManagerCompletedWorkRow[]> {
  return readQuery<ManagerCompletedWorkRow>(pool, {
    sql: `${managerCompletedWorksBaseSql}
      select *
      from (
        select * from production_rows
        union all
        select * from additional_work_rows
      ) works
      where ($3::text = 'all' or work_type = $3::text)
      order by completed_date desc, operation_id desc
    `,
    params: [employeeId, period, typeFilter]
  });
}

export async function readManagerEmployeeCompletedWorkCard(
  pool: DbPool,
  employeeId: string,
  workType: 'production' | 'additional_work',
  operationId: string
): Promise<ManagerCompletedWorkRow | undefined> {
  const rows = await readQuery<ManagerCompletedWorkRow>(pool, {
    sql: `
      with
      production_rows as (
        select
          concat('production:', mod.production_operation_id::text) as work_item_id,
          'production' as work_type,
          mod.production_operation_id::text as operation_id,
          mod.employee_id::text,
          mod.employee_full_name,
          mod.event_date::text as completed_date,
          mod.production_operation_id::text,
          null::text as additional_work_id,
          mod.machine_id::text,
          mod.machine_name,
          coalesce(mod.sku_name, mod.sku_code) as sku_name,
          mod.sku_code,
          mod.quantity_produced::text as quantity,
          null::text as additional_work_name,
          mod.salary_entry_id::text,
          coalesce(mod.salary_amount_uzs, 0)::text as salary_amount_uzs,
          coalesce(mod.salary_amount_uzs, 0)::text as amount_uzs,
          mod.quantity_produced::text as old_quantity,
          coalesce(mod.corrected_total_quantity_produced, mod.quantity_produced)::text as correction_base_quantity,
          coalesce(mod.corrected_total_quantity_produced, mod.quantity_produced)::text as current_quantity,
          (mod.production_operation_id is not null) as can_correct,
          (
            mod.salary_entry_id is not null
            and not exists (
              select 1
              from app.employee_salary_entries se
              where se.employee_salary_entry_id = mod.salary_entry_id
                and se.reversed_salary_entry_id is not null
            )
            and not exists (
              select 1
              from app.employee_salary_entries rev
              where rev.reversed_salary_entry_id = mod.salary_entry_id
            )
          ) as can_storno,
          exists (
            select 1
            from app.employee_salary_entries rev
            where rev.reversed_salary_entry_id = mod.salary_entry_id
          ) as is_reversed,
          (
            select rev.employee_salary_entry_id::text
            from app.employee_salary_entries rev
            where rev.reversed_salary_entry_id = mod.salary_entry_id
            order by rev.employee_salary_entry_id
            limit 1
          ) as reversal_id
        from app.machine_output_details mod
        where mod.employee_id::text = $1
      ),
      additional_work_rows as (
        select
          concat('additional_work:', awd.additional_work_id::text) as work_item_id,
          'additional_work' as work_type,
          awd.additional_work_id::text as operation_id,
          awd.employee_id::text,
          awd.employee_full_name,
          awd.event_date::text as completed_date,
          null::text as production_operation_id,
          awd.additional_work_id::text,
          null::text as machine_id,
          null::text as machine_name,
          null::text as sku_name,
          null::text as sku_code,
          null::text as quantity,
          awd.additional_work_type_name as additional_work_name,
          awd.salary_entry_id::text,
          coalesce(awd.amount_uzs, 0)::text as salary_amount_uzs,
          coalesce(awd.amount_uzs, 0)::text as amount_uzs,
          null::text as old_quantity,
          null::text as correction_base_quantity,
          null::text as current_quantity,
          false as can_correct,
          (
            awd.salary_entry_id is not null
            and not exists (
              select 1
              from app.employee_salary_entries se
              where se.employee_salary_entry_id = awd.salary_entry_id
                and se.reversed_salary_entry_id is not null
            )
            and not exists (
              select 1
              from app.employee_salary_entries rev
              where rev.reversed_salary_entry_id = awd.salary_entry_id
            )
          ) as can_storno,
          exists (
            select 1
            from app.employee_salary_entries rev
            where rev.reversed_salary_entry_id = awd.salary_entry_id
          ) as is_reversed,
          (
            select rev.employee_salary_entry_id::text
            from app.employee_salary_entries rev
            where rev.reversed_salary_entry_id = awd.salary_entry_id
            order by rev.employee_salary_entry_id
            limit 1
          ) as reversal_id
        from app.additional_work_details awd
        where awd.employee_id::text = $1
          and awd.salary_entry_id is not null
      )
      select *
      from (
        select * from production_rows
        union all
        select * from additional_work_rows
      ) works
      where work_type = $2::text
        and operation_id = $3::text
      limit 1
    `,
    params: [employeeId, workType, operationId]
  });

  return rows[0];
}

export function readManagerMachineCompletedProductionOperations(
  pool: DbPool,
  machineId: string,
  period: string
): Promise<ManagerCompletedWorkRow[]> {
  return readQuery<ManagerCompletedWorkRow>(pool, {
    sql: `
      with
      period_bounds as (
        select
          case $2
            when 'today' then timezone('Asia/Tashkent', now())::date
            when 'week' then (
              timezone('Asia/Tashkent', now())::date
              - ((extract(isodow from timezone('Asia/Tashkent', now())::date)::integer - 1) * interval '1 day')
            )::date
            when 'month' then date_trunc('month', timezone('Asia/Tashkent', now())::date)::date
            when 'last_30_days' then (timezone('Asia/Tashkent', now())::date - interval '29 days')::date
            else timezone('Asia/Tashkent', now())::date
          end as from_date,
          timezone('Asia/Tashkent', now())::date as to_date
      )
      select
        concat('production:', mod.production_operation_id::text) as work_item_id,
        'production' as work_type,
        mod.production_operation_id::text as operation_id,
        mod.employee_id::text,
        mod.employee_full_name,
        mod.event_date::text as completed_date,
        mod.production_operation_id::text,
        null::text as additional_work_id,
        mod.machine_id::text,
        mod.machine_name,
        coalesce(mod.sku_name, mod.sku_code) as sku_name,
        mod.sku_code,
        mod.quantity_produced::text as quantity,
        null::text as additional_work_name,
        mod.salary_entry_id::text,
        coalesce(mod.salary_amount_uzs, 0)::text as salary_amount_uzs,
        coalesce(mod.salary_amount_uzs, 0)::text as amount_uzs,
        mod.quantity_produced::text as old_quantity,
        coalesce(mod.corrected_total_quantity_produced, mod.quantity_produced)::text as correction_base_quantity,
        coalesce(mod.corrected_total_quantity_produced, mod.quantity_produced)::text as current_quantity,
        (mod.production_operation_id is not null) as can_correct,
        (
          mod.salary_entry_id is not null
          and not exists (
            select 1
            from app.employee_salary_entries se
            where se.employee_salary_entry_id = mod.salary_entry_id
              and se.reversed_salary_entry_id is not null
          )
          and not exists (
            select 1
            from app.employee_salary_entries rev
            where rev.reversed_salary_entry_id = mod.salary_entry_id
          )
        ) as can_storno,
        exists (
          select 1
          from app.employee_salary_entries rev
          where rev.reversed_salary_entry_id = mod.salary_entry_id
        ) as is_reversed,
        (
          select rev.employee_salary_entry_id::text
          from app.employee_salary_entries rev
          where rev.reversed_salary_entry_id = mod.salary_entry_id
          order by rev.employee_salary_entry_id
          limit 1
        ) as reversal_id
      from app.machine_output_details mod
      cross join period_bounds pb
      where mod.machine_id::text = $1
        and mod.event_date between pb.from_date and pb.to_date
      order by mod.event_date desc, mod.production_operation_id desc
    `,
    params: [machineId, period]
  });
}

export async function readEmployeeActiveProduction(
  pool: DbPool,
  employeeId: string
): Promise<ActiveProductionStateRow | undefined> {
  const rows = await readQuery<ActiveProductionStateRow>(pool, {
    sql: `
      select production_operation_id::text
      from app.production_operations
      where employee_id = $1
        and is_open = true
      limit 1
    `,
    params: [employeeId]
  });

  return rows[0];
}

export function readActiveDowntimeTypes(pool: DbPool): Promise<DowntimeTypeStateRow[]> {
  return readQuery<DowntimeTypeStateRow>(pool, {
    sql: `
      select
        mdt.machine_downtime_type_id::text as downtime_type_id,
        mdt.machine_downtime_type_name as display_name,
        mdbp.downtime_class,
        mdbp.ui_color_token,
        mdbp.requires_production_operation,
        mdbp.operator_requires_start_comment
      from app.machine_downtime_types mdt
      join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
      where mdt.is_active = true
        and mdbp.is_active = true
      order by
        case when mdbp.downtime_class = 'CRITICAL' then 0 else 1 end,
        mdt.display_order,
        mdt.machine_downtime_type_id
    `
  });
}

export function readMachineStateRows(
  pool: DbPool,
  actorEmployeeId: string,
  qrToken?: string
): Promise<MachineStateRow[]> {
  return readQuery<MachineStateRow>(pool, {
    sql: `
      select
        m.machine_id::text,
        m.machine_name,
        m.workshop_name,
        ms.machine_status_name as machine_status,
        mus.machine_use_status_name as machine_use_status,
        mus.is_available_for_operations,
        mus.is_decommissioned,
        ms.is_available_for_start,
        ms.is_running_status,
        ms.is_downtime_status,
        ms.is_broken_status,
        exists (
          select 1
          from app.production_operations po
          where po.machine_id = m.machine_id
            and po.is_open = true
        ) as has_open_production,
        exists (
          select 1
          from app.production_operations po
          where po.machine_id = m.machine_id
            and po.employee_id = $1
            and po.is_open = true
        ) as has_open_production_by_actor,
        exists (
          select 1
          from app.machine_downtimes md
          where md.machine_id = m.machine_id
            and md.is_open = true
        ) as has_open_downtime,
        exists (
          select 1
          from app.machine_downtimes md
          join app.machine_downtime_types mdt on mdt.machine_downtime_type_id = md.machine_downtime_type_id
          join app.machine_downtime_behavior_profiles mdbp
            on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
          where md.machine_id = m.machine_id
            and md.is_open = true
            and mdt.is_active = true
            and mdbp.is_active = true
            and mdbp.downtime_class = 'CRITICAL'
        ) as has_open_critical_downtime,
        active_production.employee_full_name as active_production_employee_full_name
      from app.machines m
      join app.machine_statuses ms on ms.machine_status_id = m.machine_status_id
      join app.machine_use_statuses mus on mus.machine_use_status_id = m.machine_use_status_id
      left join lateral (
        select e.full_name as employee_full_name
        from app.production_operations po
        join app.employees e on e.employee_id = po.employee_id
        where po.machine_id = m.machine_id
          and po.is_open = true
        order by po.started_at, po.production_operation_id
        limit 1
      ) active_production on true
      where ($2::text is null or m.machine_qr_token = $2)
      order by m.machine_name
    `,
    params: [actorEmployeeId, qrToken ?? null]
  });
}

export function readActiveSkuRows(pool: DbPool): Promise<SkuStateRow[]> {
  return readQuery<SkuStateRow>(pool, {
    sql: `
      select
        s.sku_id::text,
        s.sku_code,
        s.sku_name,
        su.sku_unit_name,
        s.current_sku_tariff_uzs::text,
        s.is_active
      from app.skus s
      join app.sku_units su on su.sku_unit_id = s.sku_unit_id
      where s.is_active = true
        and su.is_active = true
      order by s.sku_code
    `
  });
}

export function readSkuQrStateRows(pool: DbPool, qrToken: string): Promise<SkuQrStateRow[]> {
  return readQuery<SkuQrStateRow>(pool, {
    sql: `
      select
        s.sku_id::text,
        s.sku_code,
        s.sku_name,
        su.sku_unit_name,
        s.current_sku_tariff_uzs::text,
        s.is_active,
        su.is_active as sku_unit_is_active
      from app.skus s
      join app.sku_units su on su.sku_unit_id = s.sku_unit_id
      where s.sku_qr_token = $1
      limit 1
    `,
    params: [qrToken]
  });
}

export function readActiveBreakTypeRows(pool: DbPool): Promise<BreakTypeStateRow[]> {
  return readQuery<BreakTypeStateRow>(pool, {
    sql: `
      select
        operator_break_type_id::text as break_type_id,
        operator_break_type_name as display_name
      from app.operator_break_types
      where is_active = true
      order by display_order, operator_break_type_id
    `
  });
}

export async function readEmployeeSalaryTotals(
  pool: DbPool,
  employeeId: string
): Promise<SalaryTotalsStateRow | undefined> {
  const rows = await readQuery<SalaryTotalsStateRow>(pool, {
    sql: `
      select
        coalesce(sum(total_salary_uzs) filter (where event_date = timezone('Asia/Tashkent', now())::date), 0)::text as today_uzs,
        coalesce(sum(total_salary_uzs) filter (
          where event_date >= (
            timezone('Asia/Tashkent', now())::date
            - ((extract(isodow from timezone('Asia/Tashkent', now())::date)::integer - 1) * interval '1 day')
          )::date
            and event_date <= timezone('Asia/Tashkent', now())::date
        ), 0)::text as week_uzs,
        coalesce(sum(total_salary_uzs) filter (
          where event_date >= date_trunc('month', timezone('Asia/Tashkent', now())::date)::date
            and event_date <= timezone('Asia/Tashkent', now())::date
        ), 0)::text as month_uzs
      from app.salary_summary
      where employee_id = $1
    `,
    params: [employeeId]
  });

  return rows[0];
}

export function readEmployeeSalaryHistory(pool: DbPool, employeeId: string): Promise<SalaryHistoryStateRow[]> {
  return readQuery<SalaryHistoryStateRow>(pool, {
    sql: `
      select
        date_trunc('month', event_date)::date::text as month,
        coalesce(sum(total_salary_uzs), 0)::text as total_uzs,
        coalesce(sum(production_salary_uzs), 0)::text as production_uzs,
        coalesce(sum(additional_work_salary_uzs), 0)::text as additional_work_uzs,
        nullif(coalesce(sum(salary_correction_uzs + production_correction_uzs), 0), 0)::text as corrections_uzs,
        nullif(coalesce(sum(reversal_uzs), 0), 0)::text as reversals_uzs
      from app.salary_summary
      where employee_id = $1
        and event_date <= timezone('Asia/Tashkent', now())::date
      group by date_trunc('month', event_date)::date
      order by month desc
    `,
    params: [employeeId]
  });
}
