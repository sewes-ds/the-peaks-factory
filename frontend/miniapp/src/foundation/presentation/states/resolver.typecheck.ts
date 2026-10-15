import { resolveStatePresentation } from './resolver';
const state = resolveStatePresentation({ key: 'state-positive', surface: 'message' });
// @ts-expect-error no action presentation exists on state output
state.intent;
void state;
