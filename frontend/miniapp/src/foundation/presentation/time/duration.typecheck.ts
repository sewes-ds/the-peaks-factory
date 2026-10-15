import { formatElapsedDuration } from './duration'; const output = formatElapsedDuration(60); // @ts-expect-error number only
formatElapsedDuration('60'); void output;
