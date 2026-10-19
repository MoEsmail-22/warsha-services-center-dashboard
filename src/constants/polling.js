/**
 * How often background data is checked (see hooks/usePolling.js).
 * The backend has no real-time channel (no SignalR / WebSocket), so new notifications and
 * bookings are found by checking often, also while the tab is in the background.
 * `max` is the slowest the check gets after repeated server errors.
 */
export const POLLING = {
  // New booking requests have a 5-minute answer window, so they're checked every 3 s.
  notifications: { intervalMs: 5_000, maxIntervalMs: 60_000 },
  bookings: { intervalMs: 3_000, maxIntervalMs: 60_000 },
  // Quotes and the Jobs Board don't need to be instant.
  quotes: { intervalMs: 30_000, maxIntervalMs: 240_000 },
  jobs: { intervalMs: 30_000, maxIntervalMs: 240_000 },
};
