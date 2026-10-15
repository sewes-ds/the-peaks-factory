import { formatTimePresentation } from './formatter'; const value = formatTimePresentation({role:'date-time-multiline',timestamp:'2026-07-29T09:25Z'}); // @ts-expect-error immutable
value.text = 'bad'; void value;
