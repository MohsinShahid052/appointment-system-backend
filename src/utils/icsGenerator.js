// src/utils/icsGenerator.js
import { DateTime } from "luxon";

/**
 * createICS
 * - Options:
 *   {
 *     uid,            // unique id (e.g. appointment._id)
 *     title,          // event summary
 *     description,    // description / notes
 *     location,       // optional location string
 *     startUTC,       // JS Date or ISO string; absolute instant (UTC)
 *     endUTC,         // JS Date or ISO string; absolute instant (UTC)
 *     organizerEmail, // optional organizer
 *     attendees: [{ name, email }] // optional
 *   }
 *
 * Returns: { filename: 'invite.ics', content: Buffer/string }
 */
export const createICS = (opts) => {
  const {
    uid,
    title = "Appointment",
    description = "",
    location = "",
    startUTC,
    endUTC,
    organizerEmail,
    attendees = [],
  } = opts;

  // Ensure we have DateTime objects in UTC
  const s = DateTime.fromJSDate(new Date(startUTC), { zone: "utc" });
  const e = DateTime.fromJSDate(new Date(endUTC), { zone: "utc" });

  // ICS expects timestamps like: 20251201T090000Z
  const fmt = (dt) => dt.toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");

  const dtstamp = fmt(DateTime.utc());
  const dtStart = fmt(s);
  const dtEnd = fmt(e);

  // Basic escape for text fields per RFC5545 (very light)
  const esc = (str) =>
    (str || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  // Build attendees lines (optional)
  const attendeeLines = (attendees || [])
    .filter((a) => a && a.email)
    .map((a) => {
      const cn = a.name ? `;CN=${esc(a.name)}` : "";
      return `ATTENDEE;RSVP=TRUE${cn}:MAILTO:${a.email}`;
    })
    .join("\r\n");

  const organizerLine = organizerEmail ? `ORGANIZER:MAILTO:${organizerEmail}` : "";

  // UID: ensure includes domain-like suffix to be safe
  const safeUid = `${uid}@appointment-system`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "PRODID:-//YourCompany//AppointmentSystem//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTAMP:${dtstamp}`,
    `UID:${safeUid}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(location)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    organizerLine,
    attendeeLines,
    `SEQUENCE:0`,
    `STATUS:CONFIRMED`,
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // Remove any empty lines (organizer/attendees maybe empty)
  const cleaned = icsLines.filter(Boolean).join("\r\n");

return {
  filename: `appointment-${uid}.ics`,
  content: Buffer.from(cleaned, "utf-8")   // 🔥 critical fix
};

};
