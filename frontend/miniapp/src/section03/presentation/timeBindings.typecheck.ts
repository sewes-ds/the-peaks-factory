import type {
  PresentationGraphContentInput,
} from '../../foundation/presentation';
import {
  normalizeSection03ZonedTimestamp,
  parseSection03DurationMinutes,
  section03DowntimeDurationContent,
  section03DowntimeStartContent,
} from './timeBindings';

const timestamp: string =
  normalizeSection03ZonedTimestamp('2026-07-31T10:00:00Z');
const minutes: number = parseSection03DurationMinutes('5 мин');
const start: PresentationGraphContentInput | null =
  section03DowntimeStartContent({
    downtime_started_at: timestamp,
    downtime_type: 'operational',
  });
const duration: PresentationGraphContentInput | null =
  section03DowntimeDurationContent({ downtime_duration: '5 мин' });

void minutes;
void start;
void duration;
