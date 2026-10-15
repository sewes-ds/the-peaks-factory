import { SECTION03_REPORT_TIME_ZONE, resolveSection03ExplicitReportRange, resolveSection03PredefinedReportRange } from './reportDates';

const timeZone: 'Asia/Tashkent' = SECTION03_REPORT_TIME_ZONE;
const predefined: Readonly<{ period: import('./context').Section03Period; from_date: string; to_date: string }> = resolveSection03PredefinedReportRange('today', 0);
const explicit: Readonly<{ from_date: string; to_date: string }> = resolveSection03ExplicitReportRange('2026-08-01', '2026-08-04');

void timeZone;
void predefined;
void explicit;
