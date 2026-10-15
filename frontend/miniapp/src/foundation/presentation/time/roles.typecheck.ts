import type { TimePresentationRole } from './roles'; const role: TimePresentationRole = 'time-only'; // @ts-expect-error closed roles
const invalid: TimePresentationRole = 'date-only'; void role; void invalid;
