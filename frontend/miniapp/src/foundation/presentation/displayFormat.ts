const DISPLAY_DATE = /^(\d{2})\.(\d{2})\.(\d{4})(?:[ T]|$)/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/;
export class DisplayFormatError extends Error {
  constructor(readonly code: 'INVALID_DATE' | 'INVALID_NUMBER') {
    super(code);
    this.name = 'DisplayFormatError';
  }
}

function validCalendarDate(day: string, month: string, year: string): boolean {
  const candidate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return candidate.getUTCFullYear() === Number(year)
    && candidate.getUTCMonth() === Number(month) - 1
    && candidate.getUTCDate() === Number(day);
}

export function formatDisplayDate(value: string): string {
  const input = value.trim();
  const display = DISPLAY_DATE.exec(input);
  if (display !== null && validCalendarDate(display[1]!, display[2]!, display[3]!)) {
    return `${display[1]}.${display[2]}.${display[3]}`;
  }
  const iso = ISO_DATE.exec(input);
  if (iso !== null && validCalendarDate(iso[3]!, iso[2]!, iso[1]!)) {
    return `${iso[3]}.${iso[2]}.${iso[1]}`;
  }
  throw new DisplayFormatError('INVALID_DATE');
}

export function formatDisplayInteger(value: string | number): string {
  const input = typeof value === 'number' ? String(value) : value.trim().replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/u.test(input)) throw new DisplayFormatError('INVALID_NUMBER');
  const negative = input.startsWith('-');
  const unsigned = input.replace(/^[+-]/u, '');
  const [whole = '0', fraction = ''] = unsigned.split('.');
  let rounded = BigInt(whole);
  if ((fraction[0] ?? '0') >= '5') rounded += 1n;
  if (negative && rounded !== 0n) return `-${rounded}`;
  return rounded.toString();
}

export function formatPersonName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/u).filter((part) => part.length > 0);
  if (parts.length <= 1) return parts[0] ?? '';
  const initials = parts.slice(1, 3).map((part) => `${Array.from(part)[0] ?? ''}.`).join('');
  return `${parts[0]} ${initials}`.trim();
}
