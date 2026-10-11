/**
 * SettingsContext — provides workshop settings + preferences + update actions.
 *
 * Used by: Settings page (form + toggle preferences), Topbar (workshop name).
 *
 * Exposes:
 *   { data, loading, error, updateWorkshop, updatePreferences, togglePreference }
 */
import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { getProfile, updateProfile, updateSettings, uploadWorkshopImage } from '@/API/Service';
import { isDemoMode } from '@/API/client';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

/**
 * The API wants times as "hh:mm AM/PM" (e.g. "09:00 AM", "09:30 PM"),
 * but the working-hours editor uses 24-hour "HH:mm" (e.g. "21:30").
 */
export function toApiTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
  if (!match) return '';
  const hours = Number(match[1]);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // 0 → 12 AM, 13 → 1 PM
  return `${String(hours12).padStart(2, '0')}:${match[2]} ${period}`;
}

/** "09:30 PM" (API) → "21:30" (working-hours editor). Already 24-hour values pass through. */
export function fromApiTime(value) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec((value || '').trim());
  if (!match) return '';
  let hours = Number(match[1]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

/** Returns the URL whether the API sends a string or { imageUrl } / { url }. */
function readImageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.imageUrl ?? value.image ?? value.url ?? value.profileImage ?? value.logo ?? '';
}

/** GET /Workshop/profile → the workshop fields the Settings page uses. Missing values are left out. */
function profileToWorkshop(profile, currentWorkingHours) {
  if (!profile || typeof profile !== 'object') return {};

  const lat = Number(profile.lat ?? profile.latitude);
  const lng = Number(profile.lng ?? profile.longitude);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
  const googleMapsUrl = profile.googleMapsLink ?? profile.googleMapsUrl ?? '';

  const values = {
    name: profile.name,
    phone: profile.phone ?? profile.phoneNumber,
    addressEn: profile.addressEn ?? profile.address,
    addressAr: profile.addressAr,
    descriptionEn: profile.descriptionEn,
    descriptionAr: profile.descriptionAr,
    imageUrl: readImageUrl(
      profile.imageUrl ?? profile.image ?? profile.profileImage ?? profile.logo
    ),
    location:
      hasPin || googleMapsUrl
        ? { ...(hasPin ? { latitude: lat, longitude: lng } : {}), googleMapsUrl }
        : undefined,
  };

  // The API has one opening/closing time; use it for open days that have no hours yet.
  const open = fromApiTime(profile.openingTime);
  const close = fromApiTime(profile.closingTime);
  if (open && close && currentWorkingHours) {
    values.workingHours = Object.fromEntries(
      Object.entries(currentWorkingHours).map(([day, hours]) => [
        day,
        hours.enabled && !hours.open && !hours.close ? { ...hours, open, close } : hours,
      ])
    );
  }

  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  );
}

const SETTINGS_STORAGE_KEY = 'workshop_settings';

const EMPTY_DAY = { enabled: true, open: '', close: '' };

/**
 * Starting values until the workshop saves its own settings. No made-up data:
 * the API has no GET for settings yet, so real values only exist once saved.
 */
const DEFAULT_SETTINGS = {
  workshop: {
    name: '',
    addressEn: '',
    addressAr: '',
    phone: '',
    descriptionEn: '',
    descriptionAr: '',
    imageUrl: '',
    location: null,
    workingHours: {
      saturday: EMPTY_DAY,
      sunday: EMPTY_DAY,
      monday: EMPTY_DAY,
      tuesday: EMPTY_DAY,
      wednesday: EMPTY_DAY,
      thursday: EMPTY_DAY,
      friday: { ...EMPTY_DAY, enabled: false },
    },
  },
  preferences: {
    acceptOnlineBookings: false,
    showPrices: false,
    autoSendServiceUpdates: false,
  },
};

/** Saved settings win; anything missing falls back to the logged-in user's data. */
function buildSettings(saved, user) {
  const workshop = { ...DEFAULT_SETTINGS.workshop, ...saved?.workshop };

  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    workshop: {
      ...workshop,
      name: workshop.name || user?.name || '',
      phone: workshop.phone || user?.phone || '',
      // Older saved settings had one "address" field.
      addressEn: workshop.addressEn || workshop.address || user?.address || '',
    },
    preferences: { ...DEFAULT_SETTINGS.preferences, ...saved?.preferences },
  };
}

const initialState = {
  data: null, // null because it's an object, not an array
  loading: true,
  error: null,
  ownerKey: null, // storage key of the account this data belongs to
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_SUCCESS':
      return { data: action.payload, loading: false, error: null, ownerKey: action.ownerKey };
    case 'RESET':
      return initialState;
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'UPDATE_WORKSHOP':
      return {
        ...state,
        data: { ...state.data, workshop: { ...state.data.workshop, ...action.payload } },
      };
    case 'MERGE_PROFILE':
      if (!state.data || state.ownerKey !== action.ownerKey) return state;
      return {
        ...state,
        data: {
          ...state.data,
          workshop: {
            ...state.data.workshop,
            ...profileToWorkshop(action.payload, state.data.workshop.workingHours),
          },
        },
      };
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        data: {
          ...state.data,
          preferences: { ...state.data.preferences, ...action.payload },
        },
      };
    case 'TOGGLE_PREFERENCE':
      return {
        ...state,
        data: {
          ...state.data,
          preferences: {
            ...state.data.preferences,
            [action.payload]: !state.data.preferences[action.payload],
          },
        },
      };
    default:
      return state;
  }
}

export function SettingsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { user, updateUser } = useAuth();
  const accountId = user?.id ?? user?.userId ?? null;
  // Each account gets its own saved settings so nothing leaks between logins.
  const storageKey = accountId != null ? `${SETTINGS_STORAGE_KEY}:${accountId}` : null;
  // Read the latest user without reloading settings on every user update (e.g. a rename).
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!storageKey) {
      dispatch({ type: 'RESET' });
      return;
    }

    try {
      // The old shared key held mock data for every account; drop it.
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      const stored = localStorage.getItem(storageKey);
      dispatch({
        type: 'LOAD_SUCCESS',
        payload: buildSettings(stored ? JSON.parse(stored) : null, userRef.current),
        ownerKey: storageKey,
      });
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', payload: err.message });
      return;
    }

    if (isDemoMode()) return;

    // The saved copy shows instantly; the backend profile then fills in the real values.
    let cancelled = false;
    getProfile()
      .then((result) => {
        if (!cancelled) {
          dispatch({
            type: 'MERGE_PROFILE',
            payload: result?.data ?? result,
            ownerKey: storageKey,
          });
        }
      })
      .catch((err) => console.error('Could not load workshop profile:', err.details ?? err));

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    // Only write data that was loaded for the current account.
    if (state.data && state.ownerKey === storageKey) {
      const { imageUrl } = state.data.workshop;
      // A blob: preview URL dies on reload, so don't keep it.
      const toSave = imageUrl?.startsWith('blob:')
        ? { ...state.data, workshop: { ...state.data.workshop, imageUrl: '' } }
        : state.data;
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    }
  }, [state.data, state.ownerKey, storageKey]);

  const updateWorkshop = (updates) => dispatch({ type: 'UPDATE_WORKSHOP', payload: updates });
  const saveWorkshopProfile = async (updates, profileData = updates) => {
    // The backend reads the workshop from the token, so no ID is sent.
    const requestBody = {
      name: profileData.name || '',
      phone: profileData.phone || '',
      googleMapsLink: profileData.googleMapsLink || '',
      addressEn: profileData.addressEn || '',
      addressAr: profileData.addressAr || '',
      descriptionEn: profileData.descriptionEn || '',
      descriptionAr: profileData.descriptionAr || '',
      lat: Number(profileData.lat) || 0,
      lng: Number(profileData.lng) || 0,
      openingTime: toApiTime(profileData.openingTime),
      closingTime: toApiTime(profileData.closingTime),
    };

    const result = await updateProfile(requestBody);
    dispatch({ type: 'UPDATE_WORKSHOP', payload: updates });
    // Keep the Topbar name in sync with the saved workshop name.
    if (updates.name && updates.name !== user?.name) updateUser({ name: updates.name });

    // Reload what the backend actually saved. The save already worked, so a
    // failed reload only gets logged instead of showing an error.
    if (!isDemoMode()) {
      try {
        const profile = await getProfile();
        dispatch({
          type: 'MERGE_PROFILE',
          payload: profile?.data ?? profile,
          ownerKey: storageKey,
        });
      } catch (err) {
        console.error('Could not reload workshop profile:', err.details ?? err);
      }
    }

    return result;
  };
  /** Uploads the workshop image and returns the URL to show. */
  const saveWorkshopImage = async (file) => {
    const result = await uploadWorkshopImage(file);
    // Use the backend URL when it sends one; otherwise show the picked file.
    const imageUrl = readImageUrl(result?.data) || URL.createObjectURL(file);
    dispatch({ type: 'UPDATE_WORKSHOP', payload: { imageUrl } });
    return imageUrl;
  };

  const savePreferences = async (preferences) => {
    const storedUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
    const workshopId = storedUser?.userId || storedUser?.id;
    const previousPreferences = state.data.preferences;

    if (!workshopId) throw new Error('Workshop ID is missing from the saved session.');

    const settingsData = {
      workshopId,
      acceptOnlineBookings: Boolean(preferences.acceptOnlineBookings),
      showPricesToCustomers: Boolean(preferences.showPrices),
      autoSendUpdates: Boolean(preferences.autoSendServiceUpdates),
    };

    dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
    try {
      return await updateSettings(workshopId, settingsData);
    } catch (error) {
      dispatch({ type: 'UPDATE_PREFERENCES', payload: previousPreferences });
      throw error;
    }
  };

  const updatePreferences = (updates) => savePreferences({ ...state.data.preferences, ...updates });
  const togglePreference = (key) =>
    savePreferences({
      ...state.data.preferences,
      [key]: !state.data.preferences[key],
    });

  const value = {
    ...state,
    updateWorkshop,
    saveWorkshopProfile,
    saveWorkshopImage,
    savePreferences,
    updatePreferences,
    togglePreference,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside a <SettingsProvider>');
  return ctx;
}
