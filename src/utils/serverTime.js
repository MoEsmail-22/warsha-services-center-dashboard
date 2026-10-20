/**
 * Reads a date-time from the backend. The API stores times in UTC but often sends them
 * without a time zone ("2026-10-20T19:11:32.417"), which browsers would read as local time
 * (3 hours off in Egypt). A date-time without a zone is therefore read as UTC.
 * Returns a Date, or null if the value isn't a valid date.
 */
export function parseServerTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const date = new Date(hasZone || !text.includes('T') ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
