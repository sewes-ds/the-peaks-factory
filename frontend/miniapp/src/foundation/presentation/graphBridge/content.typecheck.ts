import {
  resolvePresentationGraphContent,
  type PresentationGraphContentInput,
} from './content';

const text: PresentationGraphContentInput = { kind: 'text', text: 'Text' };
const time: PresentationGraphContentInput = {
  kind: 'time',
  request: {
    role: 'date-time-multiline',
    timestamp: '2026-07-29T09:25Z',
  },
};
const resolved = resolvePresentationGraphContent(time);

const invalidKind: PresentationGraphContentInput = {
  // @ts-expect-error closed content kind
  kind: 'html',
  text: 'x',
};
const invalidDate: PresentationGraphContentInput = {
  kind: 'time',
  request: {
    role: 'time-only',
    // @ts-expect-error raw Date is forbidden
    timestamp: new Date(),
  },
};
const invalidFormatter: PresentationGraphContentInput = {
  kind: 'text',
  text: 'x',
  // @ts-expect-error formatter callbacks are forbidden
  formatter: () => 'x',
};
// @ts-expect-error resolved content is readonly
resolved.text = 'other';

void text;
void invalidKind;
void invalidDate;
void invalidFormatter;
