import { describe, expect, it } from 'vitest';
import type { ActorContext } from '../../src/auth/actorContext.js';
import type { DbPool } from '../../src/db/pool.js';
import { getManagerOpenTasks } from '../../src/readModels/managerReadModels.js';
import {
  readManagerCanonicalOpenTaskSourceRows,
  readManagerOpenTaskRows,
  readManagerWorkplaceState
} from '../../src/readModels/sharedQueries.js';

const actor: ActorContext = { employeeId: 2n, telegramUserId: 2000n };

function poolFor(
  rowsByQuery: Array<readonly Record<string, unknown>[]>,
  sql: string[]
): DbPool {
  return {
    query: async (statement: string) => {
      sql.push(statement);
      return { rows: rowsByQuery.shift() ?? [] };
    }
  } as unknown as DbPool;
}

const manager = { manager_employee_id: '2', manager_full_name: 'Manager' };
const requested = {
  task_kind: 'ADDITIONAL_WORK_REQUESTED', source_table: 'additional_works', source_id: 'AW-1',
  source_started_at: '2026-08-08 10:00:00+03', sort_group: '4',
  additional_work_name: 'Проверка', employee_full_name: 'Оператор', machine_id: null,
  machine_name: null, downtime_name: null, elapsed_minutes: null
};

describe('D-169 canonical Section 03 open-task source contract', () => {
  it('C4-S03-OPERATIONAL-THRESHOLD-01 uses the active profile notification threshold', async () => {
    const sql: string[] = [];
    await readManagerCanonicalOpenTaskSourceRows(poolFor([[]], sql));
    expect(sql[0]).toContain('app.machine_downtime_profile_notification_rules');
    expect(sql[0]).toContain("md.started_at <= now() - (rule.threshold_minutes * interval '1 minute')");
    expect(sql[0]).toContain("rule.recipient_permission_code = 'can_receive_production_notifications'");
    expect(sql[0]).toContain("then 'CRITICAL_DOWNTIME_OPEN'");
    expect(sql[0]).toContain("else 'OPERATIONAL_DOWNTIME_OVER_15_MIN'");
  });

  it('C4-S03-NOTIFICATION-STATUS-INDEPENDENCE-01 does not read delivery lifecycle rows', async () => {
    const sql: string[] = [];
    await readManagerCanonicalOpenTaskSourceRows(poolFor([[]], sql));
    expect(sql[0]).not.toMatch(/app\.notifications|notification_statuses|hidden_from_chat_at|is_read|is_cancelled/);
    expect(sql[0]).toMatch(/app\.additional_works/);
    expect(sql[0]).toMatch(/app\.machine_downtimes/);
  });

  it('C4-S03-TASK-DEDUPE-01 dedupes by kind, source table and source id', async () => {
    const response = await getManagerOpenTasks(
      poolFor([[manager], [requested, { ...requested }]], []),
      actor
    );
    expect(response.tasks).toHaveLength(1);
    expect(response.open_tasks).toEqual(response.tasks);
    expect(response.open_tasks_count).toBe(1);
  });

  it('C4-S03-TASK-COUNT-01 uses the same canonical CTE for workplace count', async () => {
    const sql: string[] = [];
    await readManagerWorkplaceState(poolFor([[]], sql), '2');
    expect(sql[0]).toContain('canonical_open_tasks as');
    expect(sql[0]).toContain('(select count(*)::text from canonical_open_tasks) as open_tasks_count');
    expect(sql[0]).not.toMatch(/app\.notifications|notification_statuses|hidden_from_chat_at/);
  });

  it('PASS01-S03-NOT01-PERSISTED-01 keeps persisted lines equivalent to the canonical Owner contract', async () => {
    const sql: string[] = [];
    await readManagerOpenTaskRows(poolFor([[]], sql), '2');
    const displayProjection = sql[0]!.slice(
      sql[0]!.indexOf('array_remove(array['),
      sql[0]!.indexOf('], null)::text[] as display_lines')
    );
    expect(displayProjection).toContain("when task_kind = 'ADDITIONAL_WORK_REQUESTED' then 'Запрошена доп. работа'");
    expect(displayProjection).toContain("when task_kind = 'ADDITIONAL_WORK_WAITING_ACCRUAL' then 'Доп. работа требует начисления'");
    expect(displayProjection).toContain("then downtime_name");
    expect(displayProjection).toContain("then downtime_elapsed_minutes || ' мин'");
    expect(displayProjection).not.toMatch(/aw_name|description|Критический простой|Операционный простой более 15 минут/);
    expect(sql[0]).not.toMatch(/\binsert\b|\bupdate\b|\bdelete\b|\balter\b|\bgrant\b|\brevoke\b/i);
  });
});
