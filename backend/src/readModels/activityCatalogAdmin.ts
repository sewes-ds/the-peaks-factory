import { ApiError } from '../db/errors.js';
import type { DbPool } from '../db/pool.js';
import { readQuery } from '../db/readQuery.js';

type AuthorizationRow = {
  can_manage_dictionaries: boolean;
};

export type OperatorBreakProfileRow = {
  behavior_profile_id: string;
  technical_code: string;
  profile_name: string;
  requires_open_shift: boolean;
  allows_during_open_production: boolean;
  blocks_production_start: boolean;
  blocks_self_production_finish: boolean;
  blocks_additional_work_start: boolean;
  blocks_shift_finish: boolean;
  is_active: boolean;
};

export type OperatorBreakTypeAdminRow = {
  break_type_id: string;
  technical_code: string;
  display_name: string;
  display_order: number;
  behavior_profile_id: string;
  behavior_profile_code: string;
  is_active: boolean;
};

export type DowntimeProfileAdminRow = {
  behavior_profile_id: string;
  technical_code: string;
  profile_name: string;
  downtime_class: 'OPERATIONAL' | 'CRITICAL';
  requires_production_operation: boolean;
  operator_requires_start_comment: boolean;
  privileged_actor_requires_start_reason: boolean;
  blocks_production_finish: boolean;
  blocks_shift_finish: boolean;
  machine_status_effect: 'DOWNTIME' | 'BROKEN';
  ui_color_token: 'yellow' | 'scarlet';
  is_active: boolean;
};

export type DowntimeTypeAdminRow = {
  downtime_type_id: string;
  technical_code: string;
  display_name: string;
  display_order: number;
  downtime_class: 'OPERATIONAL' | 'CRITICAL';
  behavior_profile_id: string;
  behavior_profile_code: string;
  is_active: boolean;
};

export type DowntimeNotificationRuleAdminRow = {
  notification_rule_id: string;
  behavior_profile_id: string;
  technical_code: string;
  threshold_minutes: number;
  recipient_permission_code: string;
  notification_kind: 'TYPE_IMMEDIATE' | 'ELAPSED_THRESHOLD';
  priority: number;
  is_active: boolean;
};

export async function assertCanManageDictionaries(pool: DbPool, actorEmployeeId: string): Promise<void> {
  const rows = await readQuery<AuthorizationRow>(pool, {
    sql: `
      select coalesce(bool_or(r.can_manage_dictionaries), false) as can_manage_dictionaries
      from app.employees e
      join app.employee_statuses es
        on es.employee_status_id = e.employee_status_id
       and es.is_active = true
       and es.is_active_for_login = true
      left join app.employee_roles er
        on er.employee_id = e.employee_id
       and er.revoked_at is null
      left join app.roles r
        on r.role_id = er.role_id
       and r.is_active = true
      where e.employee_id = $1
    `,
    params: [actorEmployeeId]
  });

  if (!rows[0]?.can_manage_dictionaries) {
    throw new ApiError(403, 'forbidden', 'Actor lacks can_manage_dictionaries');
  }
}

export function readOperatorBreakProfiles(pool: DbPool): Promise<OperatorBreakProfileRow[]> {
  return readQuery<OperatorBreakProfileRow>(pool, {
    sql: `
      select
        operator_break_behavior_profile_id::text as behavior_profile_id,
        technical_code,
        profile_name,
        requires_open_shift,
        allows_during_open_production,
        blocks_production_start,
        blocks_self_production_finish,
        blocks_additional_work_start,
        blocks_shift_finish,
        is_active
      from app.operator_break_behavior_profiles
      order by is_active desc, operator_break_behavior_profile_id
    `
  });
}

export function readOperatorBreakTypesForAdmin(pool: DbPool): Promise<OperatorBreakTypeAdminRow[]> {
  return readQuery<OperatorBreakTypeAdminRow>(pool, {
    sql: `
      select
        obt.operator_break_type_id::text as break_type_id,
        obt.technical_code,
        obt.operator_break_type_name as display_name,
        obt.display_order,
        obt.operator_break_behavior_profile_id::text as behavior_profile_id,
        obbp.technical_code as behavior_profile_code,
        obt.is_active
      from app.operator_break_types obt
      join app.operator_break_behavior_profiles obbp
        on obbp.operator_break_behavior_profile_id = obt.operator_break_behavior_profile_id
      order by obt.is_active desc, obt.display_order, obt.operator_break_type_id
    `
  });
}

export function readDowntimeProfiles(
  pool: DbPool,
  downtimeClass: 'OPERATIONAL' | 'CRITICAL'
): Promise<DowntimeProfileAdminRow[]> {
  return readQuery<DowntimeProfileAdminRow>(pool, {
    sql: `
      select
        machine_downtime_behavior_profile_id::text as behavior_profile_id,
        technical_code,
        profile_name,
        downtime_class,
        requires_production_operation,
        operator_requires_start_comment,
        privileged_actor_requires_start_reason,
        blocks_production_finish,
        blocks_shift_finish,
        machine_status_effect,
        ui_color_token,
        is_active
      from app.machine_downtime_behavior_profiles
      where downtime_class = $1
      order by is_active desc, machine_downtime_behavior_profile_id
    `,
    params: [downtimeClass]
  });
}

export function readDowntimeTypesForAdmin(
  pool: DbPool,
  downtimeClass: 'OPERATIONAL' | 'CRITICAL'
): Promise<DowntimeTypeAdminRow[]> {
  return readQuery<DowntimeTypeAdminRow>(pool, {
    sql: `
      select
        mdt.machine_downtime_type_id::text as downtime_type_id,
        mdt.technical_code,
        mdt.machine_downtime_type_name as display_name,
        mdt.display_order,
        mdt.downtime_class,
        mdt.machine_downtime_behavior_profile_id::text as behavior_profile_id,
        mdbp.technical_code as behavior_profile_code,
        mdt.is_active
      from app.machine_downtime_types mdt
      join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = mdt.machine_downtime_behavior_profile_id
      where mdt.downtime_class = $1
      order by mdt.is_active desc, mdt.display_order, mdt.machine_downtime_type_id
    `,
    params: [downtimeClass]
  });
}

export function readDowntimeNotificationRules(
  pool: DbPool,
  downtimeClass: 'OPERATIONAL' | 'CRITICAL'
): Promise<DowntimeNotificationRuleAdminRow[]> {
  return readQuery<DowntimeNotificationRuleAdminRow>(pool, {
    sql: `
      select
        rule.machine_downtime_profile_notification_rule_id::text as notification_rule_id,
        rule.machine_downtime_behavior_profile_id::text as behavior_profile_id,
        rule.technical_code,
        rule.threshold_minutes,
        rule.recipient_permission_code,
        rule.notification_kind,
        rule.priority,
        rule.is_active
      from app.machine_downtime_profile_notification_rules rule
      join app.machine_downtime_behavior_profiles mdbp
        on mdbp.machine_downtime_behavior_profile_id = rule.machine_downtime_behavior_profile_id
      where mdbp.downtime_class = $1
      order by
        rule.is_active desc,
        rule.machine_downtime_behavior_profile_id,
        rule.priority,
        rule.machine_downtime_profile_notification_rule_id
    `,
    params: [downtimeClass]
  });
}
