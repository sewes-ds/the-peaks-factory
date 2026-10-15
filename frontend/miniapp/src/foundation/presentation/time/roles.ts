export const OPERATIONAL_TIME_ZONE = 'Asia/Tashkent' as const;
export const TIME_PRESENTATION_ROLES = Object.freeze(['time-only', 'date-time-multiline', 'elapsed-duration'] as const);
export type TimePresentationRole = typeof TIME_PRESENTATION_ROLES[number];
