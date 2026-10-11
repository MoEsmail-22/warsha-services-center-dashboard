import apiClient, { isDemoMode } from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError, logResponse } from './devLog';

function getBackendServiceId(id) {
  const numericId = Number(id);
  if (isDemoMode()) return id;
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error(
      'This service has no valid backend ID. Refresh the service list and try again.'
    );
  }
  return numericId;
}

/** The backend returns services one page at a time: { items, totalCount, totalPages, ... }. */

export async function getServiceCategories() {
  try {
    const response = await apiClient.get('/Workshop/service-categories');
    logResponse('Services API', 'GET service categories', response);
    return assertApiSuccess(response.data, 'Failed to get service categories.');
  } catch (error) {
    logError('Services API', 'GET service categories', error);
    return handleApiError(error, 'get service categories error');
  }
}

export async function getServices({ pageNumber = 1, pageSize = 10 } = {}) {
  try {
    const response = await apiClient.get('/Workshop/service', {
      params: { PageNumber: pageNumber, PageSize: pageSize },
    });
    logResponse('Services API', 'GET services list', response);
    return assertApiSuccess(response.data, 'Failed to load services.');
  } catch (error) {
    logError('Services API', 'GET services list', error);
    return handleApiError(error, 'Load services');
  }
}

export async function createService(serviceData) {
  try {
    const response = await apiClient.post('/Workshop/service', serviceData, { skipDemoMode: true });
    logResponse('Services API', 'POST create service', response);
    return assertApiSuccess(response.data, 'Failed to create service.');
  } catch (error) {
    logError('Services API', 'POST create service', error);
    return handleApiError(error, 'Create service');
  }
}

export async function editService(id, serviceData) {
  try {
    const serviceId = getBackendServiceId(id);
    const requestBody = isDemoMode()
      ? serviceData
      : { ...serviceData, workshopServiceId: Number(serviceData.workshopServiceId ?? serviceId) };
    const response = await apiClient.put(`/Workshop/service/${serviceId}`, requestBody);
    logResponse('Services API', 'PUT edit service', response);
    return assertApiSuccess(response.data, 'Failed to update service.');
  } catch (error) {
    logError('Services API', 'PUT edit service', error);
    return handleApiError(error, 'Update service');
  }
}

export async function toggleServiceVisibility(id) {
  try {
    const serviceId = getBackendServiceId(id);
    const response = await apiClient.put(`/Workshop/service/toggle-visibility/${serviceId}`);
    logResponse('Services API', 'PUT toggle visibility', response);
    return assertApiSuccess(response.data, 'Failed to change service visibility.');
  } catch (error) {
    logError('Services API', 'PUT toggle visibility', error);
    return handleApiError(error, 'Change service visibility');
  }
}

export async function removeService(id) {
  try {
    const serviceId = getBackendServiceId(id);
    const response = await apiClient.delete(`/Workshop/service/${serviceId}`);
    logResponse('Services API', 'DELETE service', response);
    return assertApiSuccess(response.data, 'Failed to delete service.');
  } catch (error) {
    logError('Services API', 'DELETE service', error);
    return handleApiError(error, 'Delete service');
  }
}

export async function getProfile() {
  try {
    const response = await apiClient.get('/Workshop/profile');
    logResponse('Services API', 'GET profile', response);
    return assertApiSuccess(response.data, 'Failed to load profile.');
  } catch (error) {
    logError('Services API', 'GET profile', error);
    return handleApiError(error, 'Load profile');
  }
}

/** profileData: { name, phone, googleMapsLink, addressEn, addressAr, descriptionEn, descriptionAr, lat, lng, openingTime, closingTime } */
export async function updateProfile(profileData) {
  try {
    const response = await apiClient.post('/Workshop/update-profile', profileData);
    logResponse('Services API', 'POST update profile', response);
    return assertApiSuccess(response.data, 'Failed to update profile.');
  } catch (error) {
    logError('Services API', 'POST update profile', error);
    return handleApiError(error, 'Update profile');
  }
}

export async function uploadWorkshopImage(file) {
  try {
    const formData = new FormData();
    formData.append('image', file);

    // Let the browser set multipart/form-data with its boundary.
    const response = await apiClient.put('/Workshop/image', formData, {
      headers: { 'Content-Type': undefined },
    });
    logResponse('Services API', 'PUT workshop image', response);
    return assertApiSuccess(response.data, 'Failed to upload image.');
  } catch (error) {
    logError('Services API', 'PUT workshop image', error);
    return handleApiError(error, 'Upload workshop image');
  }
}

export async function updateSettings(id, settingsData) {
  try {
    const response = await apiClient.post(`/Workshop/update-settings/${id}`, settingsData);
    logResponse('Services API', 'POST update settings', response);
    return assertApiSuccess(response.data, 'Failed to update settings.');
  } catch (error) {
    logError('Services API', 'POST update settings', error);
    return handleApiError(error, 'Update settings');
  }
}
