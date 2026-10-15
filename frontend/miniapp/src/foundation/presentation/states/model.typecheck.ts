import { resolveStatePresentation } from './resolver';
const value = resolveStatePresentation({ key: 'state-info', surface: 'card' });
// @ts-expect-error state presentation is immutable
value.tone = 'danger';
// @ts-expect-error nested state tokens are immutable
value.tokens.text = 'var(--peaks-blue)';
void value;
