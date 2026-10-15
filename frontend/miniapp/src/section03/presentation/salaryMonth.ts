const SECTION03_SALARY_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/;

const RUSSIAN_MONTH_NAMES = Object.freeze([
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const);

export class Section03SalaryMonthFormatError extends Error {
  readonly code = 'INVALID_SECTION03_SALARY_MONTH';
  readonly value: string;

  constructor(value: string) {
    super(`Invalid Section 03 salary month: ${value}.`);
    this.name = 'Section03SalaryMonthFormatError';
    this.value = value;
    Object.freeze(this);
  }
}

export function formatSection03SalaryMonth(value: string): string {
  const match = SECTION03_SALARY_MONTH_PATTERN.exec(value);
  if (match === null) throw new Section03SalaryMonthFormatError(value);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isSafeInteger(year) || year < 1 || monthIndex < 0 || monthIndex > 11) {
    throw new Section03SalaryMonthFormatError(value);
  }
  return `${RUSSIAN_MONTH_NAMES[monthIndex]} ${year}`;
}
