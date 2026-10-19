import apiClient from '../client';
import { assertApiSuccess, handleApiError } from '../errors';

/** Tells the backend to cancel this session's refresh token, so it can't be used again. */
export async function logoutWorkshop(refreshToken) {
  try {
    const response = await apiClient.post('/Auth/workshop/logout', { refreshToken });
    return assertApiSuccess(response.data, 'Logout failed.');
  } catch (error) {
    return handleApiError(error, 'Logout');
  }
}
