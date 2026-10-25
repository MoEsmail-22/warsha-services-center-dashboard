import apiClient from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError, logResponse } from './devLog';

/**
 * Future repairs / recommendations for a booking, sent with its quote:
 *   POST   /Workshop/recommendations                                { bookingId, title, description, priority }
 *   PUT    /Workshop/recommendations/{id}?bookingId=                { bookingId, recommendationId, title, description, priority }
 *   DELETE /Workshop/recommendations/{id}?bookingId=
 * priority: 1 = low, 2 = medium, 3 = high (Swagger only lists 1-3; confirm with the backend).
 */
export const RECOMMENDATION_PRIORITIES = [1, 2, 3];
export const DEFAULT_PRIORITY = 2;

const AREA = 'Recommendations API';

/** One recommendation from the API → { id, title, description, priority }. */
export function normalizeRecommendation(item = {}, index = 0) {
  const priority = Number(item.priority ?? item.priorityLevel);
  return {
    id: item.id ?? item.recommendationId ?? `recommendation-${index}`,
    // true when it exists on the backend (it has a real id), so edits use PUT / DELETE
    saved: item.id != null || item.recommendationId != null,
    title: item.title ?? item.name ?? '',
    description: item.description ?? item.details ?? '',
    priority: RECOMMENDATION_PRIORITIES.includes(priority) ? priority : DEFAULT_PRIORITY,
  };
}

const bodyOf = (bookingId, { title, description, priority }) => ({
  bookingId: Number(bookingId),
  title: title.trim(),
  description: description?.trim() || null,
  priority: Number(priority) || DEFAULT_PRIORITY,
});

export async function createRecommendation(bookingId, recommendation) {
  const label = `POST recommendation for booking ${bookingId}`;
  try {
    const response = await apiClient.post(
      '/Workshop/recommendations',
      bodyOf(bookingId, recommendation)
    );
    logResponse(AREA, label, response);
    return assertApiSuccess(response.data, 'Failed to save the recommendation.');
  } catch (error) {
    logError(AREA, label, error);
    return handleApiError(error, 'Save recommendation');
  }
}

export async function updateRecommendation(bookingId, recommendationId, recommendation) {
  const label = `PUT recommendation ${recommendationId}`;
  try {
    const response = await apiClient.put(
      `/Workshop/recommendations/${recommendationId}`,
      { ...bodyOf(bookingId, recommendation), recommendationId: Number(recommendationId) },
      { params: { bookingId: Number(bookingId) } }
    );
    logResponse(AREA, label, response);
    return assertApiSuccess(response.data, 'Failed to update the recommendation.');
  } catch (error) {
    logError(AREA, label, error);
    return handleApiError(error, 'Update recommendation');
  }
}

export async function deleteRecommendation(bookingId, recommendationId) {
  const label = `DELETE recommendation ${recommendationId}`;
  try {
    const response = await apiClient.delete(`/Workshop/recommendations/${recommendationId}`, {
      params: { bookingId: Number(bookingId) },
    });
    logResponse(AREA, label, response);
    return assertApiSuccess(response.data, 'Failed to delete the recommendation.');
  } catch (error) {
    logError(AREA, label, error);
    return handleApiError(error, 'Delete recommendation');
  }
}

/**
 * Makes the backend match `next` (the rows on screen) for one booking:
 * new rows are created, changed ones updated, removed ones deleted.
 * `previous` = the saved rows the form started from. Rows without a title are skipped.
 * Returns the number of requests that failed (the others still go through).
 */
export async function syncRecommendations(bookingId, next, previous = []) {
  const filled = next.filter((row) => row.title.trim());
  const keptIds = new Set(filled.filter((row) => row.saved).map((row) => String(row.id)));
  const before = new Map(previous.filter((row) => row.saved).map((row) => [String(row.id), row]));
  const changed = (row) => {
    const old = before.get(String(row.id));
    return (
      !old ||
      old.title !== row.title.trim() ||
      (old.description || '') !== (row.description?.trim() || '') ||
      Number(old.priority) !== Number(row.priority)
    );
  };

  const requests = [
    ...filled.filter((row) => !row.saved).map((row) => () => createRecommendation(bookingId, row)),
    ...filled
      .filter((row) => row.saved && changed(row))
      .map((row) => () => updateRecommendation(bookingId, row.id, row)),
    ...[...before.keys()]
      .filter((id) => !keptIds.has(id))
      .map((id) => () => deleteRecommendation(bookingId, id)),
  ];

  let failed = 0;
  for (const send of requests) {
    try {
      await send();
    } catch {
      failed += 1;
    }
  }
  return failed;
}
