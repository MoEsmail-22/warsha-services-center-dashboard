import apiClient from './client';
import { assertApiSuccess, createLocalError, handleApiError } from './errors';
import { parseServerTime } from '@/utils/serverTime';

/**
 * Converts the Busy Mode form values into the body the API expects.
 *   startAt → "2026-10-06T21:00" (datetime-local input, user's local time)
 *   endAt   → "2026-10-06T23:00"
 * Returns { busyFrom, busyUntil } as UTC ISO strings.
 */
export function toBusyPayload({ startAt, endAt }) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()))
    throw createLocalError('form.invalidStart', 'Enter a valid start date and time.');
  if (Number.isNaN(end.getTime()))
    throw createLocalError('form.invalidEnd', 'Enter a valid end date and time.');
  if (end <= start)
    throw createLocalError('form.endBeforeStart', 'The end time must be after the start time.');

  return {
    busyFrom: start.toISOString(),
    busyUntil: end.toISOString(),
  };
}

/** One busy period from the API → { id, busyFrom, busyUntil } (ISO strings), or null if it has none. */
function normalizeBusyPeriod(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  // The API sends these in UTC without a zone ("2026-10-20T19:11:32.417"): read as UTC,
  // otherwise they'd be 3 hours early in Egypt and a current period would look finished.
  const start = parseServerTime(
    item.busyFrom ?? item.startAt ?? item.from ?? item.start ?? item.busyStart
  );
  const end = parseServerTime(
    item.busyUntil ?? item.endAt ?? item.until ?? item.end ?? item.busyEnd
  );
  if (!start || !end || end <= start) return null;
  return {
    id: String(item.id ?? `busy-${index}`),
    busyFrom: start.toISOString(),
    busyUntil: end.toISOString(),
  };
}

/**
 * The workshop's busy period(s), as a list (empty when not busy). Periods that have
 * already ended are left out: the workshop isn't busy any more.
 * The response format isn't documented, so a single object, a list or { items } all work.
 */
export async function getWorkshopBusy() {
  try {
    const response = await apiClient.get('/Workshop/busy');
    const result = assertApiSuccess(response.data, 'Failed to load busy time.');
    const data = result?.data !== undefined ? result.data : result;
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : data && typeof data === 'object'
          ? [data]
          : [];
    const now = Date.now();
    return rows
      .map(normalizeBusyPeriod)
      .filter((period) => period && Date.parse(period.busyUntil) > now);
  } catch (error) {
    return handleApiError(error, 'Load busy time');
  }
}

export async function setWorkshopBusy(form) {
  try {
    const response = await apiClient.post('/Workshop/busy', toBusyPayload(form));
    return assertApiSuccess(response.data, 'Failed to set busy time.');
  } catch (error) {
    return handleApiError(error, 'Set busy time');
  }
}

/** Ends the workshop's busy time. The API takes no ID: it clears the current busy period. */
export async function clearWorkshopBusy() {
  try {
    const response = await apiClient.delete('/Workshop/busy');
    return assertApiSuccess(response.data, 'Failed to remove busy time.');
  } catch (error) {
    return handleApiError(error, 'Remove busy time');
  }
}
