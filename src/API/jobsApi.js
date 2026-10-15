import apiClient from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError, logResponse } from './devLog';

/**
 * The workshop's jobs board (cars grouped by stage).
 *
 * Not connected to the Jobs board page yet: its response format and how its
 * stages map to booking statuses (moving a card changes the real booking's
 * status) still need to be confirmed with the backend.
 */
export async function getJobsBoard() {
  try {
    const response = await apiClient.get('/Workshop/jobs-board');
    logResponse('Jobs API', 'GET jobs board', response);
    return assertApiSuccess(response.data, 'Failed to load the jobs board.');
  } catch (error) {
    logError('Jobs API', 'GET jobs board', error);
    return handleApiError(error, 'Load jobs board');
  }
}
