import type { StatePresentationKey, StatePresentationSurface } from './keys';
const key: StatePresentationKey = 'state-info'; const surface: StatePresentationSurface = 'card';
// @ts-expect-error domain labels are not global state keys
const invalidKey: StatePresentationKey = 'production';
// @ts-expect-error unsupported surface
const invalidSurface: StatePresentationSurface = 'action-button';
void key; void surface; void invalidKey; void invalidSurface;
