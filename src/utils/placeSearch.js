/**
 * Place search for the location picker. Every provider returns the same shape:
 *   [{ id, label, lat, lng }]
 *
 * - With VITE_GEOAPIFY_API_KEY: Geoapify Autocomplete (free key, no card; search as you type).
 * - Without it: OpenStreetMap's Nominatim (no key; its rules allow only one search per
 *   second and no search-as-you-type, so the picker searches on Enter / the Search button).
 *
 * Plain axios on purpose: apiClient would send our login token to another company's server.
 */
import axios from 'axios';

export const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

/** True when results can be fetched while the user types. */
export const SEARCH_AS_YOU_TYPE = Boolean(GEOAPIFY_API_KEY);

// Results within about 50 km of the pin come first (Nominatim; Geoapify biases by distance).
const NEARBY_DEGREES = 0.5;

async function geoapifySearch(text, { lang, position, signal }) {
  const response = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
    params: {
      text,
      lang,
      limit: 5,
      format: 'json',
      filter: 'countrycode:eg',
      bias: `proximity:${position.lng},${position.lat}`,
      apiKey: GEOAPIFY_API_KEY,
    },
    signal,
  });

  return (response.data?.results ?? []).map((place) => ({
    id: place.place_id,
    label: place.formatted ?? [place.address_line1, place.address_line2].filter(Boolean).join(', '),
    lat: Number(place.lat),
    lng: Number(place.lon),
  }));
}

async function nominatimSearch(text, { lang, position, signal }) {
  const response = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      q: text,
      format: 'jsonv2',
      limit: 5,
      countrycodes: 'eg',
      'accept-language': lang,
      // left, top, right, bottom around the current pin
      viewbox: [
        position.lng - NEARBY_DEGREES,
        position.lat + NEARBY_DEGREES,
        position.lng + NEARBY_DEGREES,
        position.lat - NEARBY_DEGREES,
      ].join(','),
    },
    signal,
  });

  return (Array.isArray(response.data) ? response.data : []).map((place) => ({
    id: place.place_id,
    label: place.display_name,
    lat: Number(place.lat),
    lng: Number(place.lon),
  }));
}

/** Searches places in Egypt near `position` ({ lat, lng }); `lang` is 'ar' or 'en'. */
export function searchPlaces(text, options) {
  return GEOAPIFY_API_KEY ? geoapifySearch(text, options) : nominatimSearch(text, options);
}
