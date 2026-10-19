import apiClient from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError, logResponse } from './devLog';

/** One brand from the API → { id, name, icon }. A few field names are accepted until the response is confirmed. */
export function normalizeCarBrand(brand) {
  return {
    id: brand.id ?? brand.carBrandId ?? brand.brandId,
    name: brand.name ?? brand.nameEn ?? brand.brandName ?? '',
    icon: brand.icon ?? brand.logo ?? brand.logoUrl ?? brand.iconUrl ?? brand.imageUrl ?? null,
  };
}

/**
 * One of the workshop's brands. Its id must be the catalog brand id (DELETE uses it), so
 * carBrandId comes before id, which may be the link's own id; the brand may also be nested.
 */
function normalizeWorkshopCarBrand(item) {
  const nested = item.carBrand ?? item.brand ?? {};
  const brand = normalizeCarBrand({ ...nested, ...item });
  return {
    ...brand,
    id: item.carBrandId ?? item.brandId ?? nested.id ?? item.id,
    name: brand.name || nested.name || item.carBrandName || '',
  };
}

/** The brands this workshop services: GET /Workshop/me/car-brands. */
export async function getWorkshopCarBrands() {
  try {
    const response = await apiClient.get('/Workshop/me/car-brands');
    logResponse('Car Brands API', 'GET workshop car brands', response);
    const result = assertApiSuccess(response.data, 'Failed to load your car brands.');
    const rows = [result?.data, result?.data?.items, result?.items, result].find(Array.isArray);
    return (rows ?? []).map(normalizeWorkshopCarBrand).filter((brand) => brand.id != null);
  } catch (error) {
    logError('Car Brands API', 'GET workshop car brands', error);
    return handleApiError(error, 'Load workshop car brands');
  }
}

/** All car brands in the catalog (the list the workshop picks from). */
export async function getCarBrands() {
  try {
    const response = await apiClient.get('/CarCatalog/car-brands');
    logResponse('Car Brands API', 'GET car brands', response);
    const result = assertApiSuccess(response.data, 'Failed to load car brands.');
    // The list may come as data: [...] or data: { items: [...] }
    const rows = [result?.data, result?.data?.items, result?.items, result].find(Array.isArray);
    return (rows ?? []).map(normalizeCarBrand).filter((brand) => brand.id != null);
  } catch (error) {
    logError('Car Brands API', 'GET car brands', error);
    return handleApiError(error, 'Load car brands');
  }
}

/** Adds a catalog brand to the brands this workshop services. */
export async function addWorkshopCarBrand(carBrandId) {
  try {
    const response = await apiClient.post('/Workshop/me/car-brands', {
      carBrandId: Number(carBrandId),
    });
    logResponse('Car Brands API', 'POST workshop car brand', response);
    return assertApiSuccess(response.data, 'Failed to add the car brand.');
  } catch (error) {
    logError('Car Brands API', 'POST workshop car brand', error);
    return handleApiError(error, 'Add car brand');
  }
}

/** Removes a brand from the brands this workshop services. */
export async function removeWorkshopCarBrand(carBrandId) {
  try {
    const response = await apiClient.delete(`/Workshop/me/car-brands/${carBrandId}`);
    logResponse('Car Brands API', 'DELETE workshop car brand', response);
    return assertApiSuccess(response.data, 'Failed to remove the car brand.');
  } catch (error) {
    logError('Car Brands API', 'DELETE workshop car brand', error);
    return handleApiError(error, 'Remove car brand');
  }
}
