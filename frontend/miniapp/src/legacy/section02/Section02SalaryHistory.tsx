import { PeaksGraphNodeRenderer, type PeaksGraphObject } from '../../foundation/graphRenderer';
import type { OperatorSalaryHistoryMonth, OperatorSalaryStateResponse } from '../../section02/operatorWorkplace';

export type Section02SalaryHistoryProps = {
  salary: OperatorSalaryStateResponse;
  pending?: boolean;
  onBack?: () => void;
};

function salaryValue(value: string): string {
  return `${value} сум`;
}

function monthRow(label: string, value: string, className?: string) {
  return (
    <div className={['peaks-salary-month-row', className ?? ''].filter(Boolean).join(' ')} key={label}>
      <div className="peaks-salary-month-label">{label}</div>
      <div className="peaks-salary-month-value">{salaryValue(value)}</div>
    </div>
  );
}

function monthCard(month: OperatorSalaryHistoryMonth, index: number) {
  const rows = [
    monthRow('Производство', month.production_uzs),
    monthRow('Доп.Работы', month.additional_work_uzs)
  ];

  if (month.corrections_uzs !== null) {
    rows.push(monthRow('Корректировки', month.corrections_uzs));
  }

  if (month.reversals_uzs !== null) {
    rows.push(monthRow('Сторно', month.reversals_uzs));
  }

  rows.push(monthRow('Всего', month.total_uzs, 'peaks-salary-month-row--total'));

  return (
    <section className="peaks-salary-month-card" aria-label="Месяц зарплаты" key={`${month.month}-${index}`}>
      <h2 className="peaks-salary-month-title">{month.month}</h2>
      {rows}
    </section>
  );
}

export function Section02SalaryHistory({ salary, pending = false, onBack }: Section02SalaryHistoryProps) {
  const months = Array.isArray(salary.months) ? salary.months : [];

  const fixedTopObjects: PeaksGraphObject[] = [
    {
      kind: 'custom',
      id: 'salary-history-title',
      node: <section className="peaks-salary-title" aria-label="Описание действия">История зарплаты</section>
    }
  ];

  const scrollObjects: PeaksGraphObject[] = [
    {
      kind: 'custom',
      id: 'salary-history-months',
      node: <>{months.map(monthCard)}</>
    }
  ];

  const fixedBottomObjects: PeaksGraphObject[] = [
    {
      kind: 'custom',
      id: 'salary-history-back-action',
      node: (
        <button
          className="peaks-salary-action-button peaks-salary-action-button--back peaks-salary-action-button--outline-blue"
          type="button"
          disabled={pending}
          aria-disabled={pending}
          onClick={onBack}
        >
          <span className="peaks-salary-icon-slot" aria-hidden="true" />
          <span className="peaks-salary-button-label">Назад</span>
        </button>
      )
    }
  ];

  return (
    <PeaksGraphNodeRenderer
      view={{
        nodeId: 'S02-SAL02',
        className: 'peaks-salary-screen peaks-salary-history-screen',
        ariaLabel: 'История зарплаты',
        focusOnEntry: true,
        ariaBusy: pending,
        fixedTopObjects,
        scrollObjects,
        fixedBottomObjects
      }}
    />
  );
}
