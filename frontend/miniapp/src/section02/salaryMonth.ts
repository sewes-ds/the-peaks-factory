const MONTH_NAMES = Object.freeze([
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const);

const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/u;
const DISPLAY_MONTH = new RegExp(`^(${MONTH_NAMES.join('|')})\\s+(\\d{4})$`, 'u');

export class Section02SalaryMonthFormatError extends Error {
  constructor() {
    super('Invalid Section 02 salary month.');
    this.name = 'Section02SalaryMonthFormatError';
  }
}

export function formatSection02SalaryMonth(value: string): string {
  const input = value.trim();
  const iso = ISO_MONTH.exec(input);
  if (iso !== null) return `${MONTH_NAMES[Number(iso[2]) - 1]} ${Number(iso[1])}`;
  const display = DISPLAY_MONTH.exec(input);
  if (display !== null && Number(display[2]) >= 1) return input;
  throw new Section02SalaryMonthFormatError();
}
