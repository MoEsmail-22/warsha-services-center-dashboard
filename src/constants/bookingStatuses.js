/**
 * Booking statuses (the customer's side: Pending, Confirmed, …) as the words the UI uses
 * (statusStyles.js, filters, badges).
 *
 * PATCH /Workshop/bookings/{id}/status does NOT take these: it moves the job stage
 * (see jobStages.js). The numbers below are only used if the API ever sends a status as a number.
 */
export const STATUS_BY_NUMBER = {
  1: 'pending',
  2: 'confirmed',
  3: 'in_progress',
  4: 'completed',
  5: 'cancelled',
};

/**
 * The 5-minute answer window (flow from the backend team): a new booking waits for the
 * workshop to accept or reject it; after 5 minutes without an answer the backend rejects it.
 *
 * ⚠ Field names agreed as placeholders until the backend confirms them:
 *   - status while waiting: "PendingApproval" (read as "pending" below)
 *   - approvalDeadline: when the 5 minutes end (ISO with timezone)
 *   If only createdAt is sent, the deadline is createdAt + 5 minutes.
 * Statuses that mean "waiting for the workshop", and statuses an auto-rejected booking may get:
 */
export const APPROVAL_WINDOW_MS = 5 * 60 * 1000;
const WAITING_STATUSES = ['pending_approval', 'awaiting_approval', 'awaiting_workshop_approval'];
const REJECTED_STATUSES = ['rejected', 'expired', 'auto_rejected'];

/**
 * When the answer window ends (ms since epoch). Best: the API's approvalDeadline; then
 * createdAt + 5 min; last: 5 min after this screen first saw the booking (firstSeenAt, set by
 * BookingsContext; new bookings are found within ~10 s). Null only for a booking never listed.
 */
export function approvalDeadlineOf(booking) {
  const deadline = Date.parse(booking?.approvalDeadline ?? '');
  if (!Number.isNaN(deadline)) return deadline;
  const created = Date.parse(booking?.createdAtIso ?? '');
  if (!Number.isNaN(created)) return created + APPROVAL_WINDOW_MS;
  return Number.isFinite(booking?.firstSeenAt) ? booking.firstSeenAt + APPROVAL_WINDOW_MS : null;
}

/**
 * True while the workshop can still accept or reject the booking: it is waiting
 * (pending) and its 5 minutes haven't run out. Without a deadline from the API the
 * buttons stay and the backend decides.
 * `awaitingWorkshop: false` is set on screen right after Accept / Reject, until the list reloads.
 */
export function isAwaitingWorkshop(booking, now = Date.now()) {
  if (!booking || booking.awaitingWorkshop === false || booking.status !== 'pending') return false;
  const deadline = approvalDeadlineOf(booking);
  return deadline == null || now < deadline;
}

/** Waiting, but the 5 minutes are over: the backend is rejecting it (until the list reloads). */
export function isApprovalExpired(booking, now = Date.now()) {
  if (!booking || booking.awaitingWorkshop === false || booking.status !== 'pending') return false;
  const deadline = approvalDeadlineOf(booking);
  return deadline != null && now >= deadline;
}

/** Seconds left to answer (0 when over), or null without a deadline. */
export function approvalSecondsLeft(booking, now = Date.now()) {
  const deadline = approvalDeadlineOf(booking);
  return deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** 272 → "4:32". */
export const formatCountdown = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Accepts 3, "3", "InProgress", "in progress" or "in_progress" → "in_progress". */
export function toStatusKey(value) {
  if (value == null || value === '') return 'pending';
  if (STATUS_BY_NUMBER[value]) return STATUS_BY_NUMBER[value];

  const key = String(value)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
  // Waiting for the workshop's answer ("PendingApproval") is shown as Pending.
  if (WAITING_STATUSES.includes(key)) return 'pending';
  // A rejected request (by the workshop, or automatically after 5 minutes) is shown as Cancelled.
  if (REJECTED_STATUSES.includes(key)) return 'cancelled';
  return Object.values(STATUS_BY_NUMBER).includes(key) ? key : 'pending';
}
