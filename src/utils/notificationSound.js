/**
 * Short chimes for new notifications and new bookings, made with the Web Audio API
 * (no sound files to download).
 *
 * Browsers only allow sound after the user has clicked or pressed a key on the page once,
 * so the audio is unlocked on the first interaction (logging in counts). After that, it also
 * plays while the tab is in the background.
 *
 * The on/off choice is kept in localStorage (`warcha_sound`, on by default) and survives logout.
 */
export const SOUND_STORAGE_KEY = 'warcha_sound';
export const SOUND_SETTING_CHANGED = 'warcha-sound:changed';

// Notes for each chime: [frequency in Hz, start in seconds].
const CHIMES = {
  // Two soft notes for a notification.
  notification: [
    [659.25, 0], // E5
    [880, 0.14], // A5
  ],
  // Three rising notes for a new booking: easier to notice.
  booking: [
    [523.25, 0], // C5
    [659.25, 0.13], // E5
    [783.99, 0.26], // G5
  ],
};

let audioContext = null;
let lastPlayedAt = 0;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext = new AudioContextClass();
  return audioContext;
}

// Unlock the audio on the first click / key press (browsers block sound before that).
if (typeof window !== 'undefined') {
  const unlock = () => {
    getAudioContext()
      ?.resume()
      .catch(() => {});
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export function isSoundEnabled() {
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage unavailable: the choice only lasts until reload.
  }
  window.dispatchEvent(new Event(SOUND_SETTING_CHANGED));
}

/**
 * Plays the chime for 'notification' or 'booking'. Does nothing when sound is off, before
 * the first click, or if a chime played less than 2 s ago (a new booking and its
 * notification usually arrive together: one sound is enough).
 */
export function playChime(kind = 'notification', { force = false } = {}) {
  if (!force && !isSoundEnabled()) return;
  const context = getAudioContext();
  if (!context || context.state !== 'running') return;
  if (!force && Date.now() - lastPlayedAt < 2000) return;
  lastPlayedAt = Date.now();

  const start = context.currentTime;
  for (const [frequency, offset] of CHIMES[kind] ?? CHIMES.notification) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    // Quick fade in, gentle fade out: a soft "ding" instead of a beep.
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.5);
  }
}
