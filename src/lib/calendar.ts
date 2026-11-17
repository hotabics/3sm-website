import { fromZonedTime } from "date-fns-tz";
import { RIGA_TZ } from "@/lib/time";

/**
 * Treniņa sākuma/beigu datumu konvertē uz UTC, izmantojot Rīgas joslu, lai
 * iCal/Google Calendar eksports atrāda pareizo lokālo laiku visiem
 * lietotājiem neatkarīgi no viņu pārlūka joslas.
 */
function toUtcRange(date: string, startTime: string, endTime: string) {
  const start = fromZonedTime(`${date}T${startTime}`, RIGA_TZ);
  const end = fromZonedTime(`${date}T${endTime}`, RIGA_TZ);
  return { start, end };
}

function toIcsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildGoogleCalendarUrl(args: {
  trainingId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  appUrl: string;
}): string {
  const { start, end } = toUtcRange(args.date, args.startTime, args.endTime);
  const text = "3SM treniņš";
  const details = `Detalizēta info: ${args.appUrl}/training/${args.trainingId}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text,
    dates: `${toIcsStamp(start)}/${toIcsStamp(end)}`,
    details,
    location: args.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcs(args: {
  trainingId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  appUrl: string;
}): string {
  const { start, end } = toUtcRange(args.date, args.startTime, args.endTime);
  const uid = `training-${args.trainingId}@3sm.lv`;
  const url = `${args.appUrl}/training/${args.trainingId}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//3sm.lv//Trainings//LV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    `SUMMARY:${escapeIcsText("3SM treniņš")}`,
    `DESCRIPTION:${escapeIcsText(`Detalizēta info: ${url}`)}`,
    `LOCATION:${escapeIcsText(args.location)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
