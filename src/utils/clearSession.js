/**
 * Ends the session completely: removes everything the app saved in the browser
 * (tokens, user, settings, offers, busy times, vehicle brands, …) and reloads on
 * the login page, so no data from the previous account stays in memory either.
 *
 * Only the language and sound choices are kept.
 */
// Also the sound on/off choice (notificationSound.js), a preference of this browser, not account data.
const KEEP_KEYS = ['warcha_lang', 'warcha_sound'];

export function clearSessionAndReload() {
  try {
    const kept = KEEP_KEYS.map((key) => [key, localStorage.getItem(key)]);
    localStorage.clear();
    kept.forEach(([key, value]) => value != null && localStorage.setItem(key, value));
    sessionStorage.clear();
  } catch {
    // Storage may be unavailable (private mode); the reload still resets the app.
  }

  const lang = window.location.pathname.split('/')[1] === 'ar' ? 'ar' : 'en';
  // A full reload (not a router navigation) also empties every context's state.
  window.location.replace(`/${lang}/login`);
}
