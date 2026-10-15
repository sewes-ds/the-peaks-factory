import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Section02SalaryHistory } from './Section02SalaryHistory';
import { getOperatorSalaryState } from '../../section02/operatorWorkplace';
import type { ApiClient } from '../../foundation/apiClient';
import type { OperatorSalaryStateResponse } from '../../section02/operatorWorkplace';

describe('Section 02 salary runtime contract', () => {
  it('builds salary state from split backend summary and history endpoints', async () => {
    const calls: string[] = [];
    const apiClient = {
      async request(path: string): Promise<unknown> {
        calls.push(path);
        if (path === '/operator/salary/history') {
          return {
            months: [
              {
                month: '2026-06',
                production_uzs: 250000,
                additional_work_uzs: '50000',
                corrections_uzs: null,
                reversals_uzs: null,
                total_uzs: 300000
              }
            ]
          };
        }

        return {
          totals: {
            today_uzs: 10000,
            week_uzs: '70000',
            month_uzs: 300000
          }
        };
      }
    } as ApiClient;

    const salary = await getOperatorSalaryState(apiClient);

    expect(calls).toContain('/operator/salary');
    expect(calls).toContain('/operator/salary/history');
    expect(salary.totals.today_uzs).toBe('10000');
    expect(salary.totals.month_uzs).toBe('300000');
    expect(salary.months).toHaveLength(1);
    expect(salary.months[0].production_uzs).toBe('250000');
    expect(salary.months[0].corrections_uzs).toBeNull();
  });

  it('does not hard-crash salary history when months is absent in malformed runtime payload', () => {
    const malformed = {
      totals: { today_uzs: '0', week_uzs: '0', month_uzs: '0' }
    } as unknown as OperatorSalaryStateResponse;

    const markup = renderToStaticMarkup(<Section02SalaryHistory salary={malformed} />);

    expect(markup).toContain('История зарплаты');
    expect(markup).not.toContain('Производство');
  });
});
