import { Link } from 'react-router-dom';
import { CalendarCheck, Car, Wallet, Star, Plus, ChevronRight, CalendarX2 } from 'lucide-react';
import { EmptyState } from '../../components/widgets/EmptyState';
import { useBookings } from '../../contexts/BookingsContext';
import { useReviews } from '../../contexts/ReviewsContext';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useAuth } from '../../contexts/AuthContext';
import StatCard from '../../components/widgets/StatCard';
import PendingRequestsBanner from '../../components/bookings/PendingRequestsBanner';
import { statusStyles } from '../../constants/statusStyles';
import {
  getCustomerInitials,
  getGreeting,
  getCustomerName,
  getCustomerColor,
} from '@/utils/dashboardHelpers';
import { KPI_CARD_DEFINITIONS } from '@/constants/dashboardKpis';

export default function DashboardPage() {
  const { t } = useAppTranslation('dashboard');
  const { user } = useAuth();

  // Live page data still comes from its active feature contexts.
  const {
    bookings = [],
    todaysBookings = [],
    newTodayCount = 0,
    newBookingsDifference = 0,
  } = useBookings() ?? {};
  const { avgRating = 0, totalReviews = 0 } = useReviews() ?? {};

  // Cars in service = accepted bookings that aren't finished: confirmed or in progress
  // (cancelled and completed ones don't count). Awaiting approval = still pending.
  const carsInServiceCount = bookings.filter(
    (booking) => booking.status === 'confirmed' || booking.status === 'in_progress'
  ).length;
  const awaitingApprovalCount = bookings.filter((booking) => booking.status === 'pending').length;
  // There is no revenue endpoint yet, so revenue shows "—" instead of made-up numbers.
  const currency = 'EGP';

  const currentHour = new Date().getHours();
  const greeting = getGreeting(currentHour, t);
  const userName = user?.name || '';
  const kpiIcons = {
    calendar: <CalendarCheck className="h-5 w-5 text-[#0E5C5B]" />,
    car: <Car className="h-5 w-5 text-[#0E5C5B]" />,
    wallet: <Wallet className="h-5 w-5 text-[#0E5C5B]" />,
    star: <Star className="h-5 w-5 fill-amber-400 text-amber-400" />,
  };
  const kpiCardValues = {
    'todays-bookings': {
      // Bookings received today, compared with yesterday.
      value: String(newTodayCount),
      // "+2", "-1" or "0" — the arrow follows the sign.
      change: `${newBookingsDifference > 0 ? '+' : ''}${newBookingsDifference} ${t('vsYesterday', { defaultValue: 'vs yesterday' })}`,
      trend: newBookingsDifference > 0 ? 'up' : newBookingsDifference < 0 ? 'down' : 'neutral',
    },
    'cars-in-service': {
      value: String(carsInServiceCount),
      subtext: `${awaitingApprovalCount} ${t('awaitingApproval', { defaultValue: 'awaiting approval' })}`,
    },
    'revenue-today': {
      value: '—',
      subtext: t('revenue.notAvailable', { defaultValue: 'Not available yet' }),
    },
    'average-rating': {
      value: String(avgRating),
      subtext: `${totalReviews} ${t('reviews', { defaultValue: 'reviews' })}`,
    },
  };
  const kpiCards = KPI_CARD_DEFINITIONS.map(({ key, labelKey, defaultLabel, icon, iconBg }) => ({
    key,
    label: t(labelKey, { defaultValue: defaultLabel }),
    icon: kpiIcons[icon],
    iconBg,
    ...kpiCardValues[key],
  }));

  return (
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* New booking requests waiting for an answer (5-minute window) */}
      <PendingRequestsBanner />

      {/* ============ HEADER ============ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl leading-none font-bold tracking-tight text-[#15201F]"
            style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: '24px',
              fontWeight: 700,
              letterSpacing: '-0.48px',
              lineHeight: '100%',
            }}
          >
            {greeting}
            {userName ? `${t('greetingSeparator', { defaultValue: ', ' })}${userName}` : ''} 👋
          </h1>
          <p
            className="mt-1.5 text-[#5A6968]"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: '100%',
              letterSpacing: '0%',
            }}
          >
            {t('subtitle', {
              defaultValue: "Here's what's happening at your workshop today.",
            })}
          </p>
        </div>
      </div>

      {/* ============ KPI CARDS ============ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ key, ...cardProps }) => (
          <StatCard key={key} {...cardProps} />
        ))}
      </div>

      {/* ============ TWO-COLUMN ============ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ---- Schedule ---- */}
        <div
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-3"
          style={{ borderRadius: '16px' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2
              className="text-lg font-semibold text-[#15201F]"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              {t('schedule.title', { defaultValue: "Today's Schedule" })}
            </h2>
            <Link
              to="/en/bookings"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 p-2 text-sm font-medium text-[#0E5C5B] transition-colors hover:bg-gray-100 hover:shadow-sm"
            >
              {t('schedule.viewAll', { defaultValue: 'View all' })}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th
                    style={{ fontFamily: "'Sora', sans-serif" }}
                    className="pb-3 text-left text-xs font-semibold tracking-wide text-[#9AA7A6] uppercase"
                  >
                    {t('schedule.customer', { defaultValue: 'Customer' })}
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold tracking-wide text-[#9AA7A6] uppercase">
                    {t('schedule.service', { defaultValue: 'Service' })}
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold tracking-wide text-[#9AA7A6] uppercase">
                    {t('schedule.time', { defaultValue: 'Time' })}
                  </th>
                  <th className="pb-3 text-left text-xs font-semibold tracking-wide text-[#9AA7A6] uppercase">
                    {t('schedule.status', { defaultValue: 'Status' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {todaysBookings.slice(0, 6).map((booking) => (
                  <tr
                    key={booking.id}
                    className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/50"
                  >
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: getCustomerColor(booking.customer) }}
                        >
                          {getCustomerInitials(booking.customer)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#15201F]">
                            {getCustomerName(booking.customer)}
                          </p>
                          <p className="truncate text-xs text-[#5A6968]">{booking.vehicle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 text-sm text-[#15201F]">{booking.service}</td>
                    <td className="py-3.5 text-sm font-medium text-[#5A6968]">{booking.time}</td>
                    <td className="py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          statusStyles[booking.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {t(`status.${booking.status}`, {
                          defaultValue: booking.status.replace('_', ' '),
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
                {todaysBookings.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        compact
                        icon={<CalendarX2 />}
                        title={t('schedule.emptyTitle', { defaultValue: 'No bookings today' })}
                        description={t('schedule.emptyDescription', {
                          defaultValue: "Today's bookings will show up here.",
                        })}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Revenue Chart ---- */}
        <div
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2"
          style={{ borderRadius: '16px' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2
                className="text-lg font-semibold text-[#15201F]"
                style={{ fontFamily: "'Sora', sans-serif" }}
              >
                {t('revenue.title', { defaultValue: 'Revenue this week' })}
              </h2>
            </div>
          </div>

          <div className="mb-4">
            <p
              className="text-2xl font-bold text-[#15201F]"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              — <span className="text-sm font-medium text-[#5A6968]">{currency}</span>
            </p>
            <p className="mt-0.5 text-xs text-[#5A6968]">
              {t('revenue.totalLabel', { defaultValue: 'Total this week' })}
            </p>
          </div>

          <EmptyState
            compact
            icon={<Wallet />}
            title={t('revenue.emptyTitle', { defaultValue: 'No revenue data yet' })}
            description={t('revenue.emptyDescription', {
              defaultValue: 'Revenue will appear here once it is available from the system.',
            })}
          />
        </div>
      </div>
    </div>
  );
}
