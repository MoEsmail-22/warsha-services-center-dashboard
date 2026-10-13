import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { searchPlaces, SEARCH_AS_YOU_TYPE } from '@/utils/placeSearch';

const MINIMUM_QUERY_LENGTH = 3;
// Searching as you type waits this long after the last key, so each letter isn't a request.
const TYPING_DELAY_MS = 350;
// Zoom used after picking a result: close enough to see the nearby shops and streets.
const RESULT_ZOOM = 17;

/**
 * Place search for the location picker; the parent map owns the selected pin.
 * With a Geoapify key it searches as you type; without one it uses Nominatim and
 * searches on Enter or the Search button (see utils/placeSearch.js).
 */
export default function LocationSearch({ position, onLocationSelect }) {
  const { t, i18n } = useAppTranslation('settings');
  const [query, setQuery] = useState('');
  // null = nothing searched yet; [] = searched, nothing found.
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  // The running search; a newer one cancels it so old results never replace new ones.
  const runningSearch = useRef(null);

  const lang = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const { lat, lng } = position;
  const queryIsLongEnough = query.trim().length >= MINIMUM_QUERY_LENGTH;

  const runSearch = useCallback(
    async (text) => {
      runningSearch.current?.abort();
      const controller = new AbortController();
      runningSearch.current = controller;
      setIsSearching(true);
      setSearchError('');

      try {
        const places = await searchPlaces(text, {
          lang,
          position: { lat, lng },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setResults(places);
      } catch {
        if (controller.signal.aborted) return;
        setResults(null);
        setSearchError(t('locationSearchError'));
      } finally {
        if (runningSearch.current === controller) setIsSearching(false);
      }
    },
    [lang, lat, lng, t]
  );

  // Search as you type (Geoapify only).
  useEffect(() => {
    if (!SEARCH_AS_YOU_TYPE) return undefined;
    const text = query.trim();
    if (text.length < MINIMUM_QUERY_LENGTH) return undefined;

    const timer = setTimeout(() => runSearch(text), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  // Stop a running search when the picker closes.
  useEffect(() => () => runningSearch.current?.abort(), []);

  const searchNow = () => {
    if (queryIsLongEnough) runSearch(query.trim());
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;

    // This input sits inside the Settings page form. Prevent that outer form
    // from saving and closing the picker when the user intends to search.
    event.preventDefault();
    event.stopPropagation();
    searchNow();
  };

  const handleQueryChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setSearchError('');
    // Typing search keeps the list until new results arrive (no flicker);
    // Enter-to-search clears the old results, which no longer match the text.
    if (!SEARCH_AS_YOU_TYPE || value.trim().length < MINIMUM_QUERY_LENGTH) {
      runningSearch.current?.abort();
      setIsSearching(false);
      setResults(null);
    }
  };

  const selectResult = (place) => {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return;

    onLocationSelect({ lat: place.lat, lng: place.lng, zoom: RESULT_ZOOM });
    setQuery('');
    setResults(null);
  };

  const clearSearch = () => {
    runningSearch.current?.abort();
    setIsSearching(false);
    setQuery('');
    setResults(null);
    setSearchError('');
  };

  return (
    <div className="relative mb-3">
      <label htmlFor="location-search" className="sr-only">
        {t('searchLocation')}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 rtl:right-3 rtl:left-auto"
            aria-hidden="true"
          />
          <input
            id="location-search"
            type="search"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder={t('searchLocationPlaceholder')}
            // Hide the browser's own clear (×) button; the one below is used instead.
            className="input h-11 ps-10 pe-10 [&::-webkit-search-cancel-button]:appearance-none"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 rtl:right-auto rtl:left-2"
              aria-label={t('clearLocationSearch')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0"
          onClick={searchNow}
          disabled={!queryIsLongEnough || isSearching}
        >
          {isSearching ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-label={t('searchingLocation')} />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{t('searchLocationButton')}</span>
        </Button>
      </div>

      {results?.length > 0 && (
        <ul
          className="absolute z-[1100] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
          role="listbox"
        >
          {results.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => selectResult(place)}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-start text-sm hover:bg-gray-50 focus:bg-gray-50"
              >
                <MapPin className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{place.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {results?.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">{t('locationSearchNoResults')}</p>
      )}

      {searchError && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {searchError}
        </p>
      )}
    </div>
  );
}
