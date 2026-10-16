/**
 * How often background data is checked (see hooks/usePolling.js).
 * The backend has no real-time channel (no SignalR / WebSocket), so new notifications and
 * bookings are found by checking often, also while the tab is in the background.
 * `max` is the slowest the check gets after repeated server errors.
 */
export const POLLING = {
  notifications: { intervalMs: 10_000, maxIntervalMs: 120_000 },
  bookings: { intervalMs: 10_000, maxIntervalMs: 120_000 },
  // Quotes and the Jobs Board don't need to be instant.
  quotes: { intervalMs: 30_000, maxIntervalMs: 240_000 },
  jobs: { intervalMs: 30_000, maxIntervalMs: 240_000 },
};
