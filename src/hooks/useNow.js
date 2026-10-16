import { useEffect, useState } from 'react';

/**
 * The current time (ms), updated every `intervalMs` while `enabled`.
 * Used for countdowns, so it only ticks while something is counting down.
 */
export function useNow(enabled = true, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return now;
}

export default useNow;
