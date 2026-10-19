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
const RING = [
  [523.25, 0], // C5
  [659.25, 0.15], // E5
  [783.99, 0.3], // G5
  [1046.5, 0.45], // C6
];
const CHIMES = {
  // Two notes for a notification.
  notification: [
    [659.25, 0], // E5
    [880, 0.16], // A5
    [1318.5, 0.32], // E6
  ],
  // A new booking rings twice, 1.5 s apart: it has to be answered within 5 minutes.
  booking: [0, 1.5].flatMap((repeat) =>
    RING.map(([frequency, offset]) => [frequency, repeat + offset])
  ),
};
// How loud (0–1) and how long each note rings, in seconds.
const STYLE = {
  notification: { volume: 0.6, length: 0.6 },
  booking: { volume: 0.9, length: 0.7 },
};

let audioContext = null;
const lastPlayedAt = { notification: 0, booking: 0 };

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
 * Plays the chime for 'notification' or 'booking'. Does nothing when sound is off or before
 * the first click. A new booking and its notification usually arrive together, so the
 * booking ring wins: the notification chime is skipped while a booking is ringing.
 */
export function playChime(kind = 'notification', { force = false } = {}) {
  if (!force && !isSoundEnabled()) return;
  const context = getAudioContext();
  if (!context || context.state !== 'running') return;

  const now = Date.now();
  if (!force) {
    if (now - lastPlayedAt.booking < 3500) return; // a booking is (still) ringing
    if (kind === 'notification' && now - lastPlayedAt.notification < 2000) return;
  }
  lastPlayedAt[kind === 'booking' ? 'booking' : 'notification'] = now;

  const { volume, length } = STYLE[kind] ?? STYLE.notification;
  // Overlapping notes are evened out by a compressor, so the loud ring doesn't crackle.
  const output = context.createDynamicsCompressor();
  output.threshold.value = -6;
  output.knee.value = 6;
  output.ratio.value = 8;
  output.connect(context.destination);

  const start = context.currentTime;
  for (const [frequency, offset] of CHIMES[kind] ?? CHIMES.notification) {
    // A sine plus a quieter triangle an octave up: fuller and easier to hear than a plain sine.
    [
      ['sine', frequency, volume],
      ['triangle', frequency * 2, volume * 0.35],
    ].forEach(([type, pitch, peak]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = pitch;
      // Quick fade in, then a ring that fades out.
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(peak, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + length);
      oscillator.connect(gain).connect(output);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + length + 0.05);
    });
  }
}
