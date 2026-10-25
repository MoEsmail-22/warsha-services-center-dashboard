import apiClient from './client';
import { assertApiSuccess, createLocalError, handleApiError } from './errors';

/**
 * Converts the Offers form values into the body the API expects.
 *   serviceId          → "12" (select value)
 *   allServices        → true to apply the offer to every service (serviceId is left out)
 *   discountPercentage → "15" (0–100)
 *   startAt / endAt    → "2026-10-07T10:00" (datetime-local, user's local time)
 * Returns { serviceId?, discountPercentage, startAt, endAt } with numbers and UTC ISO dates.
 */
export function toOfferPayload({ serviceId, allServices, discountPercentage, startAt, endAt }) {
  const id = Number(serviceId);
  const discount = Number(discountPercentage);
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (!allServices && (!Number.isInteger(id) || id <= 0))
    throw createLocalError('offer.serviceRequired', 'Choose a service for this offer.');
  if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
    throw createLocalError(
      'offer.invalidDiscount',
      'Discount must be more than 0 and at most 100.'
    );
  }
  if (Number.isNaN(start.getTime()))
    throw createLocalError('form.invalidStart', 'Enter a valid start date and time.');
  if (Number.isNaN(end.getTime()))
    throw createLocalError('form.invalidEnd', 'Enter a valid end date and time.');
  if (end <= start)
    throw createLocalError('form.endBeforeStart', 'The end time must be after the start time.');

  return {
    // No serviceId → the backend applies the offer to all services.
    ...(allServices ? {} : { serviceId: id }),
    discountPercentage: discount,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

/** One backend offer → { id, serviceId, serviceName, discountPercentage, startAt, endAt }. */
function normalizeOffer(offer) {
  return {
    id: offer.id ?? offer.offerId,
    serviceId: offer.serviceId ?? offer.workshopServiceId ?? offer.service?.id ?? null,
    serviceName: {
      en: offer.serviceNameEn ?? offer.service?.nameEn ?? offer.serviceName ?? '',
      ar: offer.serviceNameAr ?? offer.service?.nameAr ?? offer.serviceName ?? '',
    },
    discountPercentage: Number(offer.discountPercentage ?? offer.discount ?? 0),
    startAt: offer.startAt ?? offer.startDate,
    endAt: offer.endAt ?? offer.endDate,
  };
}

export async function getOffers() {
  try {
    const response = await apiClient.get('/Workshop/offers');
    const result = assertApiSuccess(response.data, 'Failed to load offers.');
    // The list may come as data: [...] or data: { items: [...] }
    const rows = [result?.data, result?.data?.items, result?.items, result].find(Array.isArray);
    return (rows ?? []).map(normalizeOffer);
  } catch (error) {
    return handleApiError(error, 'Load offers');
  }
}

export async function deleteOffer(offerId) {
  try {
    const response = await apiClient.delete(`/Workshop/offers/${offerId}`);
    return assertApiSuccess(response.data, 'Failed to delete offer.');
  } catch (error) {
    return handleApiError(error, 'Delete offer');
  }
}

/**
 * Changes an offer: PUT /Workshop/offers/{offerId}
 *   { offerId, serviceId (null = all services), discountPercentage, startAt, endAt }
 */
export async function updateOffer(offerId, form) {
  try {
    const payload = toOfferPayload(form);
    const response = await apiClient.put(`/Workshop/offers/${offerId}`, {
      offerId: Number(offerId),
      serviceId: payload.serviceId ?? null,
      discountPercentage: payload.discountPercentage,
      startAt: payload.startAt,
      endAt: payload.endAt,
    });
    return assertApiSuccess(response.data, 'Failed to update the offer.');
  } catch (error) {
    return handleApiError(error, 'Update offer');
  }
}

export async function createOffer(form) {
  try {
    const response = await apiClient.post('/Workshop/offer', toOfferPayload(form));
    return assertApiSuccess(response.data, 'Failed to create offer.');
  } catch (error) {
    return handleApiError(error, 'Create offer');
  }
}
