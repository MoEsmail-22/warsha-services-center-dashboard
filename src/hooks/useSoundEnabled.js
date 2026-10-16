import { useCallback, useEffect, useState } from 'react';
import {
  isSoundEnabled,
  playChime,
  setSoundEnabled,
  SOUND_SETTING_CHANGED,
} from '@/utils/notificationSound';

/** The sound on/off switch: { soundOn, toggleSound } (turning it on plays a sample). */
export function useSoundEnabled() {
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  useEffect(() => {
    const update = () => setSoundOn(isSoundEnabled());
    window.addEventListener(SOUND_SETTING_CHANGED, update);
    return () => window.removeEventListener(SOUND_SETTING_CHANGED, update);
  }, []);

  const toggleSound = useCallback(() => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    if (next) playChime('notification', { force: true }); // so the user hears what it sounds like
  }, []);

  return { soundOn, toggleSound };
}

export default useSoundEnabled;
