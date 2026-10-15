import { STATE_PRESENTATION_ENTRIES } from './registry';
const entry = STATE_PRESENTATION_ENTRIES[0];
// @ts-expect-error registry-owned presentations are readonly
entry.key = 'state-danger';
void entry;
