import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, MoreHorizontal, CalendarX2 } from 'lucide-react';
import { useBookings } from '../contexts/BookingsContext';
import { getBooking } from '../API/bookingsApi';
import { normalizeBooking } from '../utils/normalizeBooking';
import { useAppTranslation } from '../hooks/useAppTranslation';
import { PAGE_SIZE_OPTIONS, usePaginationParams } from '../hooks/usePaginationParams';
import StatusBadge from '../components/widgets/StatusBadge';
import Avatar from '../components/ui/Avatar';
import FilterBookingsDrawer from '../components/widgets/FilterBookingsDrawer';
import BookingDetailsDrawer from '../components/widgets/BookingDetailsDrawer';
import Pagination from '../components/widgets/Pagination';
import { EmptyState } from '../components/widgets/EmptyState';
import { BOOKING_FILTER_TABS } from '../constants/bookingFilters';
import { filterBookings, formatBookingDate } from '../utils/bookingHelpers';
import { isAwaitingWorkshop } from '@/constants/bookingStatuses';
import RejectBookingModal from '../components/bookings/RejectBookingModal';
import { useJobs } from '../contexts/JobsContext';
import ApprovalCountdown from '../components/bookings/ApprovalCountdown';
import PendingRequestsBanner from '../components/bookings/PendingRequestsBanner';
import { useNow } from '../hooks/useNow';
import { formatQuoteCurrency } from '../utils/quotes';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { useNotify } from '../hooks/useNotify';
import { useErrorMessage } from '../hooks/useErrorMessage';

// Statuses the backend can filter by (GET /Workshop/bookings?status=). "In Progress" is a job
// stage, not a booking status, so it stays a filter on screen.
const SERVER_STATUS = {
  Pending: 'PendingApproval',
  Confirmed: 'Confirmed',
  Completed: 'Completed',
};
// Wait this long after the last key press before searching.
const SEARCH_DELAY_MS = 400;

export default function BookingsPage() {
  const { t, i18n } = useAppTranslation('bookings');
  const {
    bookings,
    loading,
    error,
    refresh,
    loadDetails,
    acceptBooking,
    rejectBooking,
    searchBookings,
    withBookingDetails,
  } = useBookings();
  // The jobs board sends the customer's name (the bookings API doesn't yet).
  const { jobs } = useJobs();
  const notify = useNotify();
  const { getErrorMessage } = useErrorMessage();
  // ?page=2&size=20 in the URL.
  const {
    page: currentPage,
    pageSize,
    setPage: setCurrentPage,
    setPageSize,
  } = usePaginationParams();

  /*
   * Everything that decides what the page shows lives in the URL, so a link or a
   * refresh opens the same view:
   *   ?tab=today&q=ahmed&status=pending&from=2026-10-01&to=2026-10-31
   *    &services=Oil%20Change,Engine&customer=ali&booking=B-001
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = BOOKING_FILTER_TABS.some((tab) => tab.key === requestedTab)
    ? requestedTab
    : 'all';
  const search = searchParams.get('q') ?? '';
  const selectedBookingId = searchParams.get('booking');

  const advancedFilters = useMemo(() => {
    const filters = {
      search: searchParams.get('customer') ?? '',
      services: searchParams.get('services')?.split(',').filter(Boolean) ?? [],
      status: searchParams.get('status') ?? '',
      dateFrom: searchParams.get('from') ?? '',
      dateTo: searchParams.get('to') ?? '',
    };
    const anySet =
      filters.search ||
      filters.services.length ||
      filters.status ||
      filters.dateFrom ||
      filters.dateTo;
    return anySet ? filters : null;
  }, [searchParams]);

  /**
   * Changes several URL values in ONE update (separate calls in the same click can
   * overwrite each other). null / '' removes the key. Filter changes go back to page 1.
   */
  const updateParams = useCallback(
    (changes, { resetPage = false, addToHistory = false } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => {
            if (value == null || value === '') next.delete(key);
            else next.set(key, String(value));
          });
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: !addToHistory }
      );
    },
    [setSearchParams]
  );

  // ---- Drawer state ----
  const [filterOpen, setFilterOpen] = useState(false);
  // Accept / reject a pending booking request from its row.
  const [acceptingId, setAcceptingId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejecting, setRejecting] = useState(false);

  const handleAccept = async (booking) => {
    if (acceptingId) return;
    setAcceptingId(booking.id);
    try {
      await acceptBooking(booking.id);
      notify.success('bookingAccepted');
    } catch (err) {
      notify.error(err, 'booking.accept');
    } finally {
      setAcceptingId(null);
    }
  };

  const bookingFromList = selectedBookingId
    ? (bookings.find((booking) => String(booking.id) === selectedBookingId) ?? null)
    : null;

  // The list sends fewer fields than GET /Workshop/bookings/{id} (car, services, totals),
  // and ?booking=13 may point to a booking not in the loaded list. So opening a booking
  // always loads its full details; the list row is shown until they arrive.
  const [fetchedBooking, setFetchedBooking] = useState(null);
  useEffect(() => {
    if (!selectedBookingId) return undefined;
    if (fetchedBooking && String(fetchedBooking.id) === selectedBookingId) return undefined;

    let cancelled = false;
    getBooking(selectedBookingId)
      .then((result) => {
        const raw = result?.data ?? result;
        if (!cancelled && raw && typeof raw === 'object') setFetchedBooking(normalizeBooking(raw));
      })
      .catch((err) => {
        if (cancelled) return;
        notify.error(err, 'booking.load');
        // Keep the drawer open with the list row if there is one.
        if (!bookingFromList) updateParams({ booking: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify/updateParams are stable enough here
  }, [selectedBookingId]);

  const details =
    fetchedBooking && String(fetchedBooking.id) === selectedBookingId ? fetchedBooking : null;
  // Details win over the list row; the list row fills anything the details lack.
  // The list's status wins: it is updated right away when the status is changed or cancelled.
  const selectedBooking =
    bookingFromList || details
      ? {
          ...bookingFromList,
          ...details,
          ...(bookingFromList && { status: bookingFromList.status }),
          // Same for the job stage, once the list has one (changed from the drawer or the board).
          ...(bookingFromList?.jobStatus && { jobStatus: bookingFromList.jobStatus }),
        }
      : null;
  // Opening a booking adds a history entry, so the browser's Back button closes it.
  const openBooking = (booking) => updateParams({ booking: booking.id }, { addToHistory: true });
  const closeBooking = () => updateParams({ booking: null });

  /*
   * Search, status and dates are sent to the backend, which filters ALL the workshop's
   * bookings (the list kept on screen only has the latest 100). The week tabs, the service
   * filter and "In Progress" still filter the result on screen.
   */
  const serverText = (search || advancedFilters?.search || '').trim();
  const serverStatus = SERVER_STATUS[advancedFilters?.status] ?? '';
  const serverFrom = advancedFilters?.dateFrom
    ? new Date(`${advancedFilters.dateFrom}T00:00:00`).toISOString()
    : '';
  const serverTo = advancedFilters?.dateTo
    ? new Date(`${advancedFilters.dateTo}T23:59:59`).toISOString()
    : '';
  const serverKey = [serverText, serverStatus, serverFrom, serverTo].join('|');
  const usesServer = serverKey !== '|||';

  const [serverRows, setServerRows] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [serverAttempt, setServerAttempt] = useState(0);
  useEffect(() => {
    // While a new search runs, the previous matches stay on screen (no flicker while typing).
    setServerError(null);
    if (!usesServer) {
      setServerRows(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      searchBookings({ search: serverText, status: serverStatus, from: serverFrom, to: serverTo })
        .then((rows) => !cancelled && setServerRows(rows))
        .catch((err) => !cancelled && setServerError(err));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serverKey holds the four values
  }, [serverKey, serverAttempt, searchBookings]);

  // The backend's matches, using the live row (status, countdown, details) when it's on screen.
  const baseBookings = useMemo(() => {
    if (!usesServer) return bookings;
    const live = new Map(bookings.map((booking) => [String(booking.id), booking]));
    return (serverRows ?? []).map((row) => live.get(String(row.id)) ?? withBookingDetails(row));
  }, [usesServer, bookings, serverRows, withBookingDetails]);

  const filtered = useMemo(() => {
    if (!usesServer) {
      return filterBookings(bookings, { tab: activeTab, search, advanced: advancedFilters });
    }
    // What the backend already checked isn't checked again (it may match on fields the
    // list doesn't send). When both search boxes are used, the backend got the top one.
    const advanced = advancedFilters && {
      ...advancedFilters,
      search: search ? advancedFilters.search : '',
      dateFrom: '',
      dateTo: '',
    };
    return filterBookings(baseBookings, { tab: activeTab, search: '', advanced });
  }, [usesServer, bookings, baseBookings, activeTab, search, advancedFilters]);

  const listLoading = usesServer
    ? serverRows === null && !serverError
    : loading && bookings.length === 0;
  const listError = usesServer ? serverError : bookings.length === 0 ? error : null;
  const retryList = () => (usesServer ? setServerAttempt((n) => n + 1) : refresh());

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  // One clock for every row's countdown; it only ticks while a request is waiting.
  const now = useNow(bookings.some((booking) => booking.status === 'pending'));

  // The list sends only a few fields: load the details of the rows on this page.
  const pageIds = paginated.map((booking) => booking.id).join(',');
  useEffect(() => {
    if (pageIds) loadDetails(pageIds.split(','));
  }, [pageIds, loadDetails]);

  const customerNames = useMemo(
    () =>
      new Map(
        jobs.filter((job) => job.customer).map((job) => [String(job.bookingId), job.customer])
      ),
    [jobs]
  );
  const customerOf = (booking) => {
    const name = booking.hasCustomerName
      ? booking.customer.name
      : (customerNames.get(String(booking.id)) ?? booking.customer.name);
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return { ...booking.customer, name, initials };
  };

  const isArabic = i18n.language?.startsWith('ar');
  const money = (amount) =>
    formatQuoteCurrency(amount, isArabic ? 'ar-EG' : 'en-US', isArabic ? 'ج.م' : 'EGP');
  const loadingText = (
    <span className="text-xs text-gray-400">
      {t('table.loadingDetails', { defaultValue: 'Loading…' })}
    </span>
  );

  const handleApplyFilters = (filters) => {
    updateParams(
      {
        customer: filters.search?.trim(),
        services: filters.services?.length ? filters.services.join(',') : null,
        status: filters.status,
        from: filters.dateFrom,
        to: filters.dateTo,
      },
      { resetPage: true }
    );
  };

  const isFiltering = Boolean(search || activeTab !== 'all' || advancedFilters);
  const clearAllFilters = () =>
    updateParams(
      { tab: null, q: null, customer: null, services: null, status: null, from: null, to: null },
      { resetPage: true }
    );

  const handleClearFilters = () => {
    updateParams(
      { customer: null, services: null, status: null, from: null, to: null },
      { resetPage: true }
    );
  };

  // Check if advanced filters are active
  const hasActiveFilters =
    !!advancedFilters &&
    (advancedFilters.search?.trim() ||
      advancedFilters.services?.length > 0 ||
      advancedFilters.status ||
      advancedFilters.dateFrom ||
      advancedFilters.dateTo);

  return (
    <div className="flex h-full flex-col">
      {/* ============ HEADER ============ */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[#15201F]"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {t('title', { defaultValue: 'Bookings' })}
          </h1>
          <p className="mt-1 text-sm text-[#5A6968]">
            {t('subtitle', { defaultValue: 'Manage and schedule incoming service requests.' })}
          </p>
        </div>
      </div>

      {/* New booking requests waiting for an answer (5-minute window) */}
      <PendingRequestsBanner />

      {/* ============ FILTERS + SEARCH ============ */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {BOOKING_FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                updateParams({ tab: tab.key === 'all' ? null : tab.key }, { resetPage: true })
              }
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-[#1C1712] bg-[#1C1712] text-white'
                  : 'border-[#E8E2D8] bg-white text-[#5A5045] hover:bg-[#F2EDE4]'
              }`}
            >
              {t(`tabs.${tab.key}`, { defaultValue: tab.label })}
            </button>
          ))}

          <button
            onClick={() => setFilterOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              hasActiveFilters
                ? 'border-[#E08B2F] bg-[#FDF1DE] text-[#C8730A]'
                : 'border-[#E8E2D8] bg-white text-[#5A5045] hover:bg-[#F2EDE4]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t('filters', { defaultValue: 'Filters' })}
            {hasActiveFilters && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E08B2F] px-1 text-[10px] font-bold text-white">
                ●
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => updateParams({ q: e.target.value }, { resetPage: true })}
            placeholder={t('search', { defaultValue: 'Search bookings...' })}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0E5C5B] focus:ring-2 focus:ring-[#0E5C5B]/10 focus:outline-none"
          />
        </div>
      </div>

      {/* ============ TABLE ============ */}
      <div
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
        style={{ borderRadius: '16px' }}
      >
        <div className="overflow-x-auto">
          <table className={paginated.length ? 'w-full min-w-[1150px]' : 'w-full'}>
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                {[
                  ['booking', 'Booking'],
                  ['customer', 'Customer'],
                  ['vehicle', 'Vehicle'],
                  ['service', 'Service'],
                  ['datetime', 'Date/Time'],
                  ['total', 'Total'],
                  ['jobStage', 'Job stage'],
                  ['status', 'Customer status'],
                  ['actions', 'Actions'],
                ].map(([key, fallback]) => (
                  <th
                    key={key}
                    className={`px-4 py-3 text-xs font-semibold tracking-wide text-[#5A6968] uppercase ${
                      key === 'actions' ? 'text-end' : 'text-start'
                    }`}
                  >
                    {t(`columns.${key}`, { defaultValue: fallback })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td colSpan={9}>
                    <LoadingScreen variant="section" />
                  </td>
                </tr>
              ) : listError ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center">
                    <p className="text-sm text-red-600">
                      {getErrorMessage(listError, 'booking.load')}
                    </p>
                    <button
                      type="button"
                      onClick={retryList}
                      className="mt-3 rounded-lg border border-[#E8E2D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A5045] hover:bg-[#F2EDE4]"
                    >
                      {t('retry', { defaultValue: 'Try again' })}
                    </button>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    {isFiltering ? (
                      <EmptyState
                        icon={<Search />}
                        title={t('empty.noMatchTitle', {
                          defaultValue: 'No bookings match your filters',
                        })}
                        description={t('empty.noMatchDescription', {
                          defaultValue: 'Try another search, tab or filter.',
                        })}
                        action={
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="rounded-lg border border-[#E8E2D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A5045] hover:bg-[#F2EDE4]"
                          >
                            {t('empty.clearAll', { defaultValue: 'Clear search and filters' })}
                          </button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={<CalendarX2 />}
                        title={t('empty.title', { defaultValue: 'No bookings yet' })}
                        description={t('empty.description', {
                          defaultValue: 'New bookings from customers will appear here.',
                        })}
                      />
                    )}
                  </td>
                </tr>
              ) : (
                paginated.map((booking) => (
                  <tr
                    key={booking.id}
                    // Clicking anywhere on the row opens the booking, same as the ⋯ button.
                    onClick={() => openBooking(booking)}
                    className="cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3.5 text-sm font-medium whitespace-nowrap text-[#5A6968]">
                      {/* e.g. WRSH-261009-474; the numeric id only if the API sent no number */}
                      {booking.number || `#${booking.id}`}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={customerOf(booking).initials}
                          name={customerOf(booking).name}
                          color={booking.customer.avatarColor}
                          size={32}
                        />
                        <span className="text-sm font-medium text-[#15201F]">
                          {customerOf(booking).name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#15201F]">
                      {booking.detailsLoaded || booking.vehicle !== '—'
                        ? booking.vehicle
                        : loadingText}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3.5 text-sm text-[#15201F]"
                      title={booking.service}
                    >
                      {booking.detailsLoaded ? booking.service : loadingText}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#15201F]">
                      <div>
                        <p>{formatBookingDate(booking.date)}</p>
                        <p className="text-xs text-[#5A6968]">{booking.time}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold whitespace-nowrap text-[#0E5C5B]">
                      {booking.totalAmount > 0
                        ? money(booking.totalAmount)
                        : booking.detailsLoaded
                          ? '—'
                          : loadingText}
                    </td>
                    <td className="px-4 py-3.5 text-sm whitespace-nowrap text-[#15201F]">
                      {/* Same pill as the customer status; names match the Jobs Board columns. */}
                      {booking.jobStatus ? (
                        <StatusBadge status={booking.jobStatus}>
                          {t(`jobStage.${booking.jobStatus}`, { defaultValue: booking.jobStatus })}
                        </StatusBadge>
                      ) : booking.detailsLoaded ? (
                        '—'
                      ) : (
                        loadingText
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={booking.status} />
                        <ApprovalCountdown booking={booking} now={now} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* A pending request is accepted or rejected (stopPropagation: don't also open it). */}
                        {isAwaitingWorkshop(booking, now) && (
                          <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAccept(booking);
                              }}
                              disabled={acceptingId === booking.id}
                              className="rounded-md bg-[#0E5C5B] px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                              {t('requestActions.accept', { defaultValue: 'Accept' })}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setRejectTarget(booking);
                              }}
                              className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                            >
                              {t('requestActions.reject', { defaultValue: 'Reject' })}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation(); // the row would open it a second time
                            openBooking(booking);
                          }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          aria-label="View details"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <Pagination
            currentPage={currentPageSafe}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={setPageSize}
            labels={{
              showing: t('showing', { defaultValue: 'Showing' }),
              of: t('of', { defaultValue: 'of' }),
              previous: t('previousPage', { defaultValue: 'Previous page' }),
              next: t('nextPage', { defaultValue: 'Next page' }),
            }}
          />
        )}
      </div>

      {/* ============ DRAWERS ============ */}
      <FilterBookingsDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
        value={advancedFilters}
      />
      <BookingDetailsDrawer
        open={!!selectedBooking}
        onClose={closeBooking}
        booking={selectedBooking}
      />
      <RejectBookingModal
        open={Boolean(rejectTarget)}
        itemName={rejectTarget ? rejectTarget.number || `#${rejectTarget.id}` : ''}
        busy={rejecting}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          setRejecting(true);
          try {
            await rejectBooking(rejectTarget.id, reason);
            notify.success('bookingRejected');
            setRejectTarget(null);
          } catch (err) {
            notify.error(err, 'booking.reject');
          } finally {
            setRejecting(false);
          }
        }}
      />
    </div>
  );
}
