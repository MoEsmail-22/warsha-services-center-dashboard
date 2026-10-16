import apiClient from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError as logErrorFor, logResponse as logResponseFor } from './devLog';

const AREA = 'Bookings API';
const logResponse = (label, response) => logResponseFor(AREA, label, response);
const logError = (label, error) => logErrorFor(AREA, label, error);

/** One page of the workshop's bookings (note: lowercase page/pageSize, unlike services). */
export async function getBookings({ page = 1, pageSize = 100 } = {}) {
  try {
    const response = await apiClient.get('/Workshop/bookings', { params: { page, pageSize } });
    logResponse('GET bookings list', response);
    return assertApiSuccess(response.data, 'Failed to load bookings.');
  } catch (error) {
    logError('GET bookings list', error);
    return handleApiError(error, 'Load bookings');
  }
}

export async function getBooking(id) {
  try {
    const response = await apiClient.get(`/Workshop/bookings/${id}`);
    logResponse(`GET booking ${id}`, response);
    return assertApiSuccess(response.data, 'Failed to load the booking.');
  } catch (error) {
    logError(`GET booking ${id}`, error);
    return handleApiError(error, 'Load booking');
  }
}

/**
 * Changes a booking's status. The API expects just the status number as the
 * body (e.g. 3), not an object — see bookingStatuses.js for what each number means.
 */
export async function updateBookingStatus(id, statusNumber) {
  try {
    const response = await apiClient.patch(`/Workshop/bookings/${id}/status`, statusNumber);
    logResponse(`PATCH booking ${id} status → ${statusNumber}`, response);
    return assertApiSuccess(response.data, 'Failed to update the booking status.');
  } catch (error) {
    logError(`PATCH booking ${id} status → ${statusNumber}`, error);
    return handleApiError(error, 'Update booking status');
  }
}

/** Accepts a pending booking request (no body). */
export async function acceptBooking(id) {
  try {
    const response = await apiClient.patch(`/Workshop/bookings/${id}/accept`);
    logResponse(`PATCH booking ${id} accept`, response);
    return assertApiSuccess(response.data, 'Failed to accept the booking.');
  } catch (error) {
    logError(`PATCH booking ${id} accept`, error);
    return handleApiError(error, 'Accept booking');
  }
}

/**
 * Rejects a pending booking request. The body is just the reason, as a JSON string
 * ("Fully booked that day"); JSON.stringify keeps a reason like "5" from being sent as a number.
 */
export async function rejectBooking(id, reason) {
  try {
    const response = await apiClient.patch(
      `/Workshop/bookings/${id}/reject`,
      JSON.stringify(reason.trim())
    );
    logResponse(`PATCH booking ${id} reject`, response);
    return assertApiSuccess(response.data, 'Failed to reject the booking.');
  } catch (error) {
    logError(`PATCH booking ${id} reject`, error);
    return handleApiError(error, 'Reject booking');
  }
}
