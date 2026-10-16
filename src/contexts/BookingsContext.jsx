/**
 * BookingsContext — the workshop's bookings from GET /Workshop/bookings.
 *
 * Keeps itself up to date: checks for new bookings every POLLING.bookings.intervalMs, also
 * while the tab is in the background, and right away when the user comes back to the tab;
 * a new booking shows a toast (or a desktop notification when the tab is in the background).
 *
 * Exposes:
 *   { bookings, loading, error, refresh, loadDetails, todaysBookings, newTodayCount, newYesterdayCount,
 *     newBookingsDifference, acceptBooking, rejectBooking, changeJobStage, updateBookingStatus }
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  acceptBooking as acceptBookingRequest,
  rejectBooking as rejectBookingRequest,
  getBooking,
  getBookings,
  updateBookingStatus as updateBookingStatusRequest,
} from '@/API/bookingsApi';
import { isDemoMode } from '@/API/client';
import { approvalDeadlineOf } from '@/constants/bookingStatuses';
import { STAGE_NUMBER, stagesBetween } from '@/constants/jobStages';
import { normalizeBooking } from '@/utils/normalizeBooking';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { usePolling } from '@/hooks/usePolling';
import { notifyInBackground } from '@/utils/browserNotifications';
import { playChime } from '@/utils/notificationSound';
import { POLLING } from '@/constants/polling';

const BookingsContext = createContext(null);

function readBookingRows(result) {
  const data = result?.data ?? result;
  const rows = Array.isArray(data) ? data : (data?.items ?? data?.bookings ?? []);
  return Array.isArray(rows) ? rows : [];
}

/** Local "YYYY-MM-DD", the same format normalizeBooking uses for booking.date. */
/**
 * A list row completed with its details (GET /Workshop/bookings/{id}). The details fill what
 * the list doesn't send (car, services, total, payment…); the list keeps the fields it
 * updates on screen right away (status, job stage) and the placeholders are replaced.
 */
function withDetails(row, details) {
  if (!details) return { ...row, detailsLoaded: false };
  return {
    ...details,
    ...row,
    detailsLoaded: true,
    customer: row.hasCustomerName ? row.customer : details.customer,
    hasCustomerName: row.hasCustomerName || details.hasCustomerName,
    vehicle: details.vehicle !== '—' ? details.vehicle : row.vehicle,
    service: details.serviceBreakdown.length ? details.service : row.service,
    serviceBreakdown: details.serviceBreakdown,
    totalAmount: details.totalAmount || row.totalAmount,
    confirmationFee: details.confirmationFee || row.confirmationFee,
    paymentType: details.paymentType || row.paymentType,
    notes: details.notes || row.notes,
    pendingQuote: details.pendingQuote,
    number: row.number || details.number,
    jobStatus: row.jobStatus || details.jobStatus,
    // The appointment time: scheduledAt from GET /bookings/{id} wins over the list's date.
    date: details.scheduledAt ? details.date : row.date,
    time: details.scheduledAt ? details.time : row.time,
    scheduledAt: details.scheduledAt || row.scheduledAt,
    confirmedAt: row.confirmedAt || details.confirmedAt,
    completedAt: row.completedAt || details.completedAt,
    cancellationReason: row.cancellationReason || details.cancellationReason,
    approvalDeadline: row.approvalDeadline || details.approvalDeadline,
    createdAtIso: row.createdAtIso || details.createdAtIso,
  };
}

function localDay(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function BookingsProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation('common', { useSuspense: false });

  const [rows, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Full details (GET /Workshop/bookings/{id}) by booking id. The list only sends a few
  // fields, so the table loads the details of the rows it shows (see loadDetails).
  const [detailsById, setDetailsById] = useState({});
  const requestedDetails = useRef(new Set());

  /** Loads the details of these bookings (each one once, 4 at a time). */
  const loadDetails = useCallback(async (ids) => {
    const missing = ids.map(String).filter((id) => !requestedDetails.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requestedDetails.current.add(id));

    const queue = [...missing];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const result = await getBooking(id);
          const raw = result?.data ?? result;
          if (raw && typeof raw === 'object') {
            setDetailsById((current) => ({ ...current, [id]: normalizeBooking(raw) }));
          }
        } catch {
          requestedDetails.current.delete(id); // try again next time the row is shown
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, missing.length) }, worker));
  }, []);

  /** Drops a booking's details so they load again (after it changed). */
  const forgetDetails = useCallback((bookingId) => {
    const id = String(bookingId);
    requestedDetails.current.delete(id);
    setDetailsById((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  // Each row = the list's fields, completed with its details once they're loaded.
  const bookings = useMemo(
    () => rows.map((row) => withDetails(row, detailsById[String(row.id)])),
    [rows, detailsById]
  );

  // IDs seen so far, to spot new requests; null until the first load finishes.
  const knownIds = useRef(null);
  const firstSeenAt = useRef(new Map());
  const latestRequest = useRef(0);

  const enabled = Boolean(user) && !isDemoMode();

  /** Loads the list. `silent` refreshes in the background without the loading state. */
  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = ++latestRequest.current;
      if (!silent) setLoading(true);

      try {
        const next = readBookingRows(await getBookings({ page: 1, pageSize: 100 })).map(
          normalizeBooking
        );
        if (requestId !== latestRequest.current) return true;

        if (knownIds.current) {
          const fresh = next.filter((booking) => !knownIds.current.has(booking.id));
          if (fresh.length > 0) {
            playChime('booking');
            const message = t('notifications.newBookings', {
              count: fresh.length,
              defaultValue:
                fresh.length === 1 ? 'New booking request' : `${fresh.length} new booking requests`,
            });
            // Tab in the background → desktop notification; otherwise (or if that fails) the toast.
            const shown = notifyInBackground({
              tag: `bookings-${fresh.map((booking) => booking.id).join('-')}`,
              title: message,
              body: fresh
                .map((booking) =>
                  [booking.number, booking.vehicle !== '—' && booking.vehicle]
                    .filter(Boolean)
                    .join(' · ')
                )
                .filter(Boolean)
                .join('\n'),
            });
            if (!shown) showToast('success', message);
          }
        }
        knownIds.current = new Set(next.map((booking) => booking.id));
        // When this screen first saw each booking: the 5-minute window starts there when the
        // API sends no approvalDeadline / createdAt (see bookingStatuses.js → approvalDeadlineOf).
        const seenAt = Date.now();
        next.forEach((booking) => {
          if (!firstSeenAt.current.has(booking.id)) firstSeenAt.current.set(booking.id, seenAt);
        });
        setBookings(
          next.map((booking) => ({ ...booking, firstSeenAt: firstSeenAt.current.get(booking.id) }))
        );
        setError(null);
        return true;
      } catch (err) {
        // A failed background check keeps the current list; only a first load shows the error.
        if (requestId === latestRequest.current && !silent) setError(err);
        return false;
      } finally {
        if (requestId === latestRequest.current && !silent) setLoading(false);
      }
    },
    [showToast, t]
  );

  useEffect(() => {
    if (!enabled) {
      // Signed out: forget the previous account's bookings.
      setBookings([]);
      setDetailsById({});
      requestedDetails.current = new Set();
      setError(null);
      knownIds.current = null;
      firstSeenAt.current = new Map();
      return undefined;
    }

    refresh();
    return undefined;
  }, [enabled, user?.id, refresh]);

  // Background checks: every POLLING.bookings.intervalMs, slower after errors, never overlapping.
  // Always checking, also while the tab is in the background (no real-time channel).
  usePolling(
    async () => {
      if (!(await refresh({ silent: true }))) throw new Error('Bookings check failed');
    },
    { ...POLLING.bookings, enabled, runWhenHidden: true }
  );

  // When a booking's 5-minute answer window ends, reload right away (2 s later, to give the
  // backend time to auto-reject it) instead of waiting for the next check.
  const nextApprovalDeadline = useMemo(() => {
    const now = Date.now();
    const deadlines = rows
      .filter((row) => row.status === 'pending')
      .map((row) => approvalDeadlineOf(withDetails(row, detailsById[String(row.id)])))
      .filter((deadline) => deadline != null && deadline > now);
    return deadlines.length ? Math.min(...deadlines) : null;
  }, [rows, detailsById]);

  useEffect(() => {
    if (!enabled || nextApprovalDeadline == null) return undefined;
    const timer = setTimeout(
      () => refresh({ silent: true }),
      nextApprovalDeadline - Date.now() + 2000
    );
    return () => clearTimeout(timer);
  }, [enabled, nextApprovalDeadline, refresh]);

  /** Updates a booking on screen only (after accept / reject, until the list reloads). */
  const updateBookingStatus = useCallback((bookingId, status, extra = {}) => {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, ...extra, status } : booking
      )
    );
  }, []);

  /**
   * Moves the job to another stage (PATCH .../status takes the stage number), e.g.
   * changeJobStage(12, 'in_progress'). Used by the booking drawer and the Jobs Board.
   */
  const changeJobStage = useCallback(async (bookingId, stage, fromStage) => {
    if (!STAGE_NUMBER[stage]) throw new Error(`Unknown job stage: ${stage}`);
    const setLocalStage = (value) =>
      setBookings((current) =>
        current.map((booking) =>
          String(booking.id) === String(bookingId) ? { ...booking, jobStatus: value } : booking
        )
      );

    // The backend only allows one step forward at a time. A jump forward (e.g. New → Ready)
    // is sent as each step in order; anything else is sent directly and the backend decides.
    const steps = stagesBetween(fromStage, stage);
    let reached = fromStage;
    for (const step of steps) {
      try {
        await updateBookingStatusRequest(bookingId, STAGE_NUMBER[step]);
      } catch (err) {
        // Some steps may already be saved: tell the caller where the job really is.
        if (reached && reached !== fromStage) setLocalStage(reached);
        err.reachedStage = reached;
        throw err;
      }
      reached = step;
    }
    setLocalStage(stage);
  }, []);

  /**
   * Runs accept / reject. If the backend says the 5 minutes are over (or the booking isn't
   * waiting anymore), the buttons are hidden for that booking and it reloads; the error is
   * still thrown so the page shows the message.
   */
  const answerRequest = useCallback(
    async (bookingId, request, statusOnSuccess) => {
      try {
        await request();
        updateBookingStatus(bookingId, statusOnSuccess, { awaitingWorkshop: false });
      } catch (err) {
        if (
          /deadline has expired|not awaiting workshop approval/i.test(err?.details ?? err?.message)
        ) {
          setBookings((current) =>
            current.map((booking) =>
              String(booking.id) === String(bookingId)
                ? { ...booking, awaitingWorkshop: false }
                : booking
            )
          );
          forgetDetails(bookingId);
          refresh({ silent: true });
        }
        throw err;
      }
      forgetDetails(bookingId);
      refresh({ silent: true });
    },
    [updateBookingStatus, refresh, forgetDetails]
  );

  /** Accepts a pending request; the list then reloads to show the server's exact status. */
  const acceptBooking = useCallback(
    (bookingId) => answerRequest(bookingId, () => acceptBookingRequest(bookingId), 'confirmed'),
    [answerRequest]
  );

  /** Rejects a pending request with the reason the customer will see. */
  const rejectBooking = useCallback(
    (bookingId, reason) =>
      answerRequest(bookingId, () => rejectBookingRequest(bookingId, reason), 'cancelled'),
    [answerRequest]
  );

  const contextValue = useMemo(() => {
    const today = localDay(0);
    const yesterday = localDay(-1);
    // Scheduled for today (the dashboard's schedule list).
    const todaysBookings = bookings.filter((booking) => booking.date === today);
    // Received today / yesterday (the "Today's bookings" card).
    const newTodayCount = bookings.filter((booking) => booking.receivedDate === today).length;
    const newYesterdayCount = bookings.filter(
      (booking) => booking.receivedDate === yesterday
    ).length;

    return {
      bookings,
      loading,
      error,
      refresh,
      todaysBookings,
      newTodayCount,
      newYesterdayCount,
      newBookingsDifference: newTodayCount - newYesterdayCount,
      loadDetails,
      acceptBooking,
      rejectBooking,
      changeJobStage,
      updateBookingStatus,
    };
  }, [
    bookings,
    loading,
    error,
    refresh,
    loadDetails,
    acceptBooking,
    rejectBooking,
    changeJobStage,
    updateBookingStatus,
  ]);

  return <BookingsContext.Provider value={contextValue}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const context = useContext(BookingsContext);
  if (!context) throw new Error('useBookings must be used inside a <BookingsProvider>');
  return context;
}
