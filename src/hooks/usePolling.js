import { useEffect, useRef } from 'react';

/**
 * Runs `task` every `intervalMs` while `enabled`, with three safeguards:
 *   1. Pauses while the tab is hidden, and runs right away when it's shown again.
 *      `runWhenHidden: true` keeps it going in the background (for desktop notifications;
 *      browsers may slow background timers to about once a minute).
 *   2. Never starts a new run while the previous one is still waiting.
 *   3. Slows down after failures (×2 each time, up to `maxIntervalMs`) and goes
 *      back to normal after the next success.
 *
 * `task` must return a promise that rejects when the request fails.
 */
export function usePolling(
  task,
  { intervalMs, maxIntervalMs = intervalMs * 4, enabled = true, runWhenHidden = false }
) {
  // Always call the latest task without restarting the timer when it changes.
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return undefined;

    let timer = null;
    let running = false;
    let delay = intervalMs;
    let stopped = false;

    const schedule = () => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (running || (!runWhenHidden && document.visibilityState !== 'visible')) return schedule();
      running = true;
      try {
        await taskRef.current();
        delay = intervalMs; // healthy again → normal speed
      } catch {
        delay = Math.min(delay * 2, maxIntervalMs); // server trouble → back off
      } finally {
        running = false;
        schedule();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs, maxIntervalMs, runWhenHidden]);
}

export default usePolling;
