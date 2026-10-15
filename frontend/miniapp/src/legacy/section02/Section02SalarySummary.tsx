import { PeaksGraphNodeRenderer, type PeaksGraphObject } from '../../foundation/graphRenderer';
import type { OperatorSalaryStateResponse } from '../../section02/operatorWorkplace';

export type Section02SalarySummaryProps = {
  salary: OperatorSalaryStateResponse;
  pending?: boolean;
  onOpenHistory?: () => void;
  onBack?: () => void;
};

function salaryValue(value: string): string {
  return `${value} сум`;
}

function salaryRow(label: string, value: string) {
  return (
    <div className="peaks-salary-row" key={label}>
      <div className="peaks-salary-label">{label}</div>
      <div className="peaks-salary-value">{salaryValue(value)}</div>
    </div>
  );
}

export function Section02SalarySummary({
  salary,
  pending = false,
  onOpenHistory,
  onBack
}: Section02SalarySummaryProps) {
  const fixedTopObjects: PeaksGraphObject[] = [
    {
      kind: 'custom',
      id: 'salary-summary-title',
      node: <section className="peaks-salary-title" aria-label="Описание действия">Зарплата</section>
    }
  ];

  const scrollObjects: PeaksGraphObject[] = [
    {
      kind: 'custom',
      id: 'salary-summary-card',
      node: (
        <section className="peaks-salary-card" aria-label="Итоги зарплаты">
          {salaryRow('Сегодня', salary.totals.today_uzs)}
          {salaryRow('Неделя', salary.totals.week_uzs)}
          {salaryRow('Месяц', salary.totals.month_uzs)}
        </section>
      )
    }
  ];

  const fixedBottomObjects: PeaksGraphObject[] = [
    {
      kind: 'custom',
      id: 'salary-history-action',
      node: (
        <button
          className="peaks-salary-action-button peaks-salary-action-button--large peaks-salary-action-button--outline-blue"
          type="button"
          disabled={pending}
          aria-disabled={pending}
          onClick={onOpenHistory}
        >
          <span className="peaks-salary-icon-slot" aria-hidden="true" />
          <span className="peaks-salary-button-label">История зарплаты</span>
        </button>
      )
    },
    {
      kind: 'custom',
      id: 'salary-back-action',
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
        nodeId: 'S02-SAL01',
        className: 'peaks-salary-screen peaks-salary-summary-screen',
        ariaLabel: 'Зарплата',
        focusOnEntry: true,
        ariaBusy: pending,
        fixedTopObjects,
        scrollObjects,
        fixedBottomObjects
      }}
    />
  );
}
