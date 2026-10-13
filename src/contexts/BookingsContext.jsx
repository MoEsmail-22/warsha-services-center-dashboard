/**
 * BookingsContext — the workshop's bookings from GET /Workshop/bookings.
 *
 * Keeps itself up to date: checks for new bookings every POLLING.bookings.intervalMs while
 * the tab is visible, right away when the user comes back to the tab, and shows
 * a toast when a new booking request arrives.
 *
 * Exposes:
 *   { bookings, loading, error, refresh, todaysBookings, newTodayCount, newYesterdayCount,
 *     newBookingsDifference, cancelBooking, changeBookingStatus, updateBookingStatus }
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
  cancelBooking as cancelBookingRequest,
  getBookings,
  updateBookingStatus as updateBookingStatusRequest,
} from '@/API/bookingsApi';
import { isDemoMode } from '@/API/client';
import { NUMBER_BY_STATUS } from '@/constants/bookingStatuses';
import { normalizeBooking } from '@/utils/normalizeBooking';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { usePolling } from '@/hooks/usePolling';
import { useBrowserNotificationPermission } from '@/hooks/useBrowserNotificationPermission';
import { notifyInBackground } from '@/utils/browserNotifications';
import { POLLING } from '@/constants/polling';

const BookingsContext = createContext(null);

function readBookingRows(result) {
  const data = result?.data ?? result;
  const rows = Array.isArray(data) ? data : (data?.items ?? data?.bookings ?? []);
  return Array.isArray(rows) ? rows : [];
}

/** Local "YYYY-MM-DD", the same format normalizeBooking uses for booking.date. */
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

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // IDs seen so far, to spot new requests; null until the first load finishes.
  const knownIds = useRef(null);
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
        setBookings(next);
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
      setError(null);
      knownIds.current = null;
      return undefined;
    }

    refresh();
    return undefined;
  }, [enabled, user?.id, refresh]);

  // Background checks: every 30 s while visible, slower after errors, never overlapping.
  // With desktop notifications allowed, keep checking while the tab is in the background.
  const { permission } = useBrowserNotificationPermission();
  usePolling(
    async () => {
      if (!(await refresh({ silent: true }))) throw new Error('Bookings check failed');
    },
    { ...POLLING.bookings, enabled, runWhenHidden: permission === 'granted' }
  );

  /** Local-only change, used by the Jobs board workflow (it has its own step names). */
  const updateBookingStatus = useCallback((bookingId, status, extra = {}) => {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, ...extra, status } : booking
      )
    );
  }, []);

  /** Changes the status on the backend, e.g. changeBookingStatus(12, 'confirmed'). */
  const changeBookingStatus = useCallback(
    async (bookingId, status) => {
      const statusNumber = NUMBER_BY_STATUS[status];
      if (!statusNumber) throw new Error(`Unknown booking status: ${status}`);
      await updateBookingStatusRequest(bookingId, statusNumber);
      updateBookingStatus(bookingId, status);
    },
    [updateBookingStatus]
  );

  const cancelBooking = useCallback(
    async (bookingId) => {
      await cancelBookingRequest(bookingId);
      updateBookingStatus(bookingId, 'cancelled');
    },
    [updateBookingStatus]
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
      cancelBooking,
      changeBookingStatus,
      updateBookingStatus,
    };
  }, [bookings, loading, error, refresh, cancelBooking, changeBookingStatus, updateBookingStatus]);

  return <BookingsContext.Provider value={contextValue}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const context = useContext(BookingsContext);
  if (!context) throw new Error('useBookings must be used inside a <BookingsProvider>');
  return context;
}
