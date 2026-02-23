import { DateTime } from "luxon";
import dotenv from "dotenv";
dotenv.config();

const DEFAULT_ZONE = process.env.DEFAULT_TIMEZONE || "Europe/Amsterdam";

/**
 * Make a DateTime from date string (YYYY-MM-DD) and time string (HH:mm) in given zone.
 * Returns Luxon DateTime (not JS Date).
 */
export const dtFromDateAndTime = (dateStr, timeStr, zone = DEFAULT_ZONE) => {
  // dateStr: '2025-01-10', timeStr: '09:30'
  return DateTime.fromISO(`${dateStr}T${timeStr}`, { zone }).set({ second: 0, millisecond: 0 });
};

/**
 * Parse an ISO datetime or JS Date into DateTime in given zone.
 */
export const dtFromJSDate = (d, zone = DEFAULT_ZONE) => {
  if (!d) return null;
  return DateTime.fromJSDate(new Date(d), { zone }).set({ millisecond: 0 });
};

/**
 * Convert Luxon DateTime to JS Date (UTC instant)
 */
export const toJSDate = (dt) => dt.toJSDate();

/**
 * Start of day / end of day DateTime in zone
 */
export const dayStartEnd = (dateStr, zone = DEFAULT_ZONE) => {
  const start = DateTime.fromISO(dateStr, { zone }).startOf("day");
  const end = start.endOf("day");
  return { start, end };
};

export { DEFAULT_ZONE };
