import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Section02SalaryHistory } from './Section02SalaryHistory';
import { Section02SalarySummary } from './Section02SalarySummary';
import type { OperatorSalaryStateResponse } from '../../section02/operatorWorkplace';

const salary: OperatorSalaryStateResponse = {
  totals: {
    today_uzs: '10000',
    week_uzs: '70000',
    month_uzs: '300000'
  },
  months: [
    {
      month: '2026-06',
      production_uzs: '250000',
      additional_work_uzs: '50000',
      corrections_uzs: null,
      reversals_uzs: null,
      total_uzs: '300000'
    }
  ]
};

describe('Section 02 salary screens', () => {
  it('renders the approved salary summary labels and backend totals', () => {
    const markup = renderToStaticMarkup(<Section02SalarySummary salary={salary} />);

    expect(markup).toContain('Зарплата');
    expect(markup).toContain('Сегодня');
    expect(markup).toContain('10000 сум');
    expect(markup).toContain('Неделя');
    expect(markup).toContain('70000 сум');
    expect(markup).toContain('Месяц');
    expect(markup).toContain('300000 сум');
    expect(markup).toContain('История зарплаты');
    expect(markup).toContain('Назад');
  });

  it('hides corrections and reversals rows when backend fields are null', () => {
    const markup = renderToStaticMarkup(<Section02SalaryHistory salary={salary} />);

    expect(markup).toContain('История зарплаты');
    expect(markup).toContain('Производство');
    expect(markup).toContain('Доп.Работы');
    expect(markup).toContain('Всего');
    expect(markup).not.toContain('Корректировки');
    expect(markup).not.toContain('Сторно');
    expect(markup).not.toMatch(/Корректировки[\s\S]*0 сум/);
    expect(markup).not.toMatch(/Сторно[\s\S]*0 сум/);
  });

  it('shows corrections and reversals rows only when backend fields are not null', () => {
    const withOptionalRows: OperatorSalaryStateResponse = {
      ...salary,
      months: [
        {
          month: '2026-05',
          production_uzs: '210000',
          additional_work_uzs: '40000',
          corrections_uzs: '5000',
          reversals_uzs: '-3000',
          total_uzs: '252000'
        }
      ]
    };

    const markup = renderToStaticMarkup(<Section02SalaryHistory salary={withOptionalRows} />);

    expect(markup).toContain('Корректировки');
    expect(markup).toContain('5000 сум');
    expect(markup).toContain('Сторно');
    expect(markup).toContain('-3000 сум');
  });
});
