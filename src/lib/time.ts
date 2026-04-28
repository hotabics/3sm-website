import { fromZonedTime, toZonedTime, format } from "date-fns-tz";
import { addDays, nextThursday, setHours, setMinutes, setSeconds, setMilliseconds, isThursday, isAfter } from "date-fns";

export const RIGA_TZ = "Europe/Riga";

/**
 * Tagadējais laiks Rīgas joslā.
 */
export function nowRiga(): Date {
  return toZonedTime(new Date(), RIGA_TZ);
}

/**
 * Nākamā ceturtdiena 20:00 Rīgas laikā kā UTC `Date`.
 * Ja šodien ir ceturtdiena un treniņš vēl nav sācies, atgriež šodienu.
 */
export function nextTrainingDate(): Date {
  const riga = nowRiga();
  let target: Date;

  if (isThursday(riga)) {
    const today2000 = setMilliseconds(setSeconds(setMinutes(setHours(riga, 20), 0), 0), 0);
    target = isAfter(riga, today2000) ? nextThursday(addDays(riga, 1)) : today2000;
  } else {
    target = nextThursday(riga);
  }

  target = setMilliseconds(setSeconds(setMinutes(setHours(target, 20), 0), 0), 0);
  return fromZonedTime(target, RIGA_TZ);
}

/**
 * Treniņa reģistrācija aizveras tā paša datuma 17:00 Rīgas laikā.
 */
export function closesAtFor(trainingDate: Date): Date {
  const riga = toZonedTime(trainingDate, RIGA_TZ);
  const close = setMilliseconds(setSeconds(setMinutes(setHours(riga, 17), 0), 0), 0);
  return fromZonedTime(close, RIGA_TZ);
}

/**
 * Reģistrācija atveras nedēļu pirms — iepriekšējā ceturtdienā 21:30.
 */
export function opensAtFor(trainingDate: Date): Date {
  const riga = toZonedTime(trainingDate, RIGA_TZ);
  const open = setMilliseconds(setSeconds(setMinutes(setHours(addDays(riga, -7), 21), 30), 0), 0);
  return fromZonedTime(open, RIGA_TZ);
}

export function formatRiga(date: Date | string, pattern = "EEEE, d. MMMM, HH:mm"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(toZonedTime(d, RIGA_TZ), pattern, { timeZone: RIGA_TZ });
}

export function formatDateOnly(date: string): string {
  return formatRiga(new Date(date + "T20:00:00Z"), "EEEE, d. MMMM");
}

/**
 * "ceturtdien plkst. 20:00" vai "šovakar plkst. 20:00".
 */
export function isoDateRiga(date: Date): string {
  return format(toZonedTime(date, RIGA_TZ), "yyyy-MM-dd", { timeZone: RIGA_TZ });
}
