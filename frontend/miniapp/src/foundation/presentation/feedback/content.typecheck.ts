import type { ContentFeedbackRequest } from './content';
import { resolveContentFeedback } from './content';

const request: ContentFeedbackRequest = { kind: 'recoverable-error' };
const result = resolveContentFeedback(request);

// @ts-expect-error kind is closed
const invalidKind: ContentFeedbackRequest['kind'] = 'warning';
// @ts-expect-error output is readonly
result.ariaBusy = true;
// @ts-expect-error feedback has no application text
result.text;

void invalidKind;
