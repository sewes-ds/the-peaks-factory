import type { ControlSemanticKey, ControlSurface } from './keys';

const key: ControlSemanticKey = 'action-positive';
const surface: ControlSurface = 'action-button';

// @ts-expect-error control keys reject section/domain action identities
const invalidKey: ControlSemanticKey = 'finish-downtime';
// @ts-expect-error controls do not support non-control presentation surfaces
const invalidSurface: ControlSurface = 'card';

void key;
void surface;
void invalidKey;
void invalidSurface;
