import { env } from '../config/env.js';

/** Today's date as 'YYYY-MM-DD' in the configured business time zone. */
export function todayIso(timeZone: string = env.APP_TIMEZONE): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
