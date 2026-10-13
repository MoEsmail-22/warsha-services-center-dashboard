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
import CancelBookingModal from '../components/bookings/CancelBookingModal';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { useNotify } from '../hooks/useNotify';
import { useErrorMessage } from '../hooks/useErrorMessage';

export default function BookingsPage() {
  const { t } = useAppTranslation('bookings');
  const { bookings, loading, error, refresh, cancelBooking } = useBookings();
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
  const [cancelTarget, setCancelTarget] = useState(null);

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
        }
      : null;
  // Opening a booking adds a history entry, so the browser's Back button closes it.
  const openBooking = (booking) => updateParams({ booking: booking.id }, { addToHistory: true });
  const closeBooking = () => updateParams({ booking: null });

  const filtered = useMemo(
    () => filterBookings(bookings, { tab: activeTab, search, advanced: advancedFilters }),
    [bookings, activeTab, search, advancedFilters]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

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
          <table className={paginated.length ? 'w-full min-w-[900px]' : 'w-full'}>
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                {[
                  ['booking', 'Booking'],
                  ['customer', 'Customer'],
                  ['vehicle', 'Vehicle'],
                  ['service', 'Service'],
                  ['datetime', 'Date/Time'],
                  ['status', 'Status'],
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
              {loading && bookings.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <LoadingScreen variant="section" />
                  </td>
                </tr>
              ) : error && bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center">
                    <p className="text-sm text-red-600">{getErrorMessage(error, 'booking.load')}</p>
                    <button
                      type="button"
                      onClick={() => refresh()}
                      className="mt-3 rounded-lg border border-[#E8E2D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#5A5045] hover:bg-[#F2EDE4]"
                    >
                      {t('retry', { defaultValue: 'Try again' })}
                    </button>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7}>
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
                          initials={booking.customer.initials}
                          name={booking.customer.name}
                          color={booking.customer.avatarColor}
                          size={32}
                        />
                        <span className="text-sm font-medium text-[#15201F]">
                          {booking.customer.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#15201F]">{booking.vehicle}</td>
                    <td className="px-4 py-3.5 text-sm text-[#15201F]">{booking.service}</td>
                    <td className="px-4 py-3.5 text-sm text-[#15201F]">
                      <div>
                        <p>{formatBookingDate(booking.date)}</p>
                        <p className="text-xs text-[#5A6968]">{booking.time}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {booking.status === 'pending' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation(); // don't also open the booking
                              setCancelTarget(booking);
                            }}
                            className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                          >
                            {t('cancellation.button')}
                          </button>
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
      <CancelBookingModal
        open={Boolean(cancelTarget)}
        itemName={cancelTarget ? `#${cancelTarget.id}` : ''}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          try {
            await cancelBooking(cancelTarget.id);
            notify.success('bookingCancelled');
          } catch (err) {
            notify.error(err, 'booking.cancel');
          } finally {
            setCancelTarget(null);
          }
        }}
      />
    </div>
  );
}
