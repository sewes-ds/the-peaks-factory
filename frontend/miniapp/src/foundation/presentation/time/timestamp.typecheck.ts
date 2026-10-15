import { formatZonedTimestamp } from './timestamp'; const value = formatZonedTimestamp('2026-07-29T09:25Z'); // @ts-expect-error readonly
value.date = 'bad'; void value;
