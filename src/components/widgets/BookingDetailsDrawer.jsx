import { X, StickyNote, Ban } from 'lucide-react';
import Drawer from '../ui/Drawer';
import StatusBadge from './StatusBadge';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import BookingActions from '../bookings/BookingActions';
import BookingQuotes from '../bookings/BookingQuotes';
import { formatQuoteCurrency } from '../../utils/quotes';

/** "CashOnDelivery" → "cashOnDelivery", the key used in bookings.json → payment. */
const paymentKey = (value = '') => value.charAt(0).toLowerCase() + value.slice(1);

export default function BookingDetailsDrawer({ open, onClose, booking }) {
  const { t, i18n } = useAppTranslation('bookings');

  if (!booking) return null;

  const isArabic = i18n.language?.startsWith('ar');
  const locale = isArabic ? 'ar-EG' : 'en-US';
  const money = (amount) => formatQuoteCurrency(amount, locale, isArabic ? 'ج.م' : 'EGP');
  const formatDateTime = (value) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
      : '';
  };

  // The customer's request as a numbered list: one item per line, or per comma /
  // semicolon when written on one line ("Oil change, brakes" → 1- Oil change, 2- brakes).
  const notesText = String(booking.notes ?? '').trim();
  const requestLines = (
    notesText.includes('\n') ? notesText.split(/\r?\n/) : notesText.split(/[,،;؛]/)
  )
    .map((line) => line.replace(/^\s*(\d+\s*[-.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);

  const serviceBreakdown = booking.serviceBreakdown ?? [];
  const servicesTotal = serviceBreakdown.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  // The API's total is the source of truth; the services' sum is only a fallback.
  const total = booking.totalAmount > 0 ? booking.totalAmount : servicesTotal;

  const payment = booking.paymentType
    ? t(`payment.${paymentKey(booking.paymentType)}`, { defaultValue: booking.paymentType })
    : '—';
  const jobStage = booking.jobStatus
    ? t(`jobStage.${booking.jobStatus}`, { defaultValue: booking.jobStatus })
    : '—';

  // Timeline from the booking's own dates (only the steps that happened).
  const timeline = [
    booking.confirmedAt && {
      id: 'confirmed',
      label: t('timeline.confirmed', { defaultValue: 'Booking confirmed' }),
      at: booking.confirmedAt,
    },
    booking.completedAt && {
      id: 'completed',
      label: t('timeline.completed', { defaultValue: 'Service completed' }),
      at: booking.completedAt,
    },
    booking.status === 'cancelled' && {
      id: 'cancelled',
      label: t('timeline.cancelled', { defaultValue: 'Booking cancelled' }),
      note: booking.cancellationReason,
    },
  ].filter(Boolean);

  const info = [
    ['customer', 'Customer', booking.customer?.name ?? '—'],
    ['vehicle', 'Vehicle', booking.vehicle ?? '—'],
    ['scheduled', 'Date / Time', formatDateTime(booking.scheduledAt) || '—'],
    ['jobStage', 'Job stage', jobStage],
    ['payment', 'Payment', payment],
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title=""
      subtitle=""
      width="max-w-md"
      footer={
        <div className="rounded-lg bg-gray-50 px-4 py-3 text-center text-xs text-gray-500">
          {t(`footer.${booking.status}`, { defaultValue: '' })}
        </div>
      }
    >
      {/* ---- Header: status + booking number ---- */}
      <div className="-mx-2 -mt-2 mb-6 rounded-xl bg-[#0E5C5B] px-4 py-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <StatusBadge status={booking.status} />
            <span className="truncate text-lg font-bold">{booking.number || `#${booking.id}`}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={t('close', { defaultValue: 'Close' })}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ---- Key details ---- */}
      <dl className="mb-6 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
        {info.map(([key, fallback, value]) => (
          <div key={key} className={key === 'payment' ? 'col-span-2' : undefined}>
            <dt className="text-xs tracking-wide text-[#5A6968] uppercase">
              {t(`details.${key}`, { defaultValue: fallback })}
            </dt>
            <dd className="mt-0.5 font-semibold text-[#15201F]">{value}</dd>
          </div>
        ))}
      </dl>

      {/* ---- Service request (the customer's notes) / cancellation reason ---- */}
      {requestLines.length > 0 && (
        <div className="mb-6 flex gap-3 rounded-xl border border-[#E8E2D8] bg-[#FBF8F3] p-3">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-[#8A8074]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wide text-[#5A6968] uppercase">
              {t('details.notes', { defaultValue: 'Service request' })}
            </p>
            <ol className="mt-1 space-y-0.5 text-sm text-[#15201F]">
              {requestLines.map((line, index) => (
                <li key={index}>
                  {index + 1}- {line}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      {booking.status === 'cancelled' && booking.cancellationReason && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="text-xs font-bold tracking-wide text-red-700 uppercase">
              {t('details.cancellationReason', { defaultValue: 'Cancellation reason' })}
            </p>
            <p className="mt-0.5 text-sm text-red-800">{booking.cancellationReason}</p>
          </div>
        </div>
      )}

      {/* ---- Status / quote / voucher ---- */}
      <BookingActions booking={booking} />

      {/* ---- Quotes: the pending one + earlier ones ---- */}
      <BookingQuotes booking={booking} />

      {/* ---- Services and total ---- */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-bold tracking-wide text-[#5A6968] uppercase">
          {t('serviceBreakdown', { defaultValue: 'Services' })}
        </h3>

        {serviceBreakdown.length === 0 ? (
          <p className="text-sm text-gray-400">
            {t('details.noServices', { defaultValue: 'No service details available.' })}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {serviceBreakdown.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#15201F]">{s.label}</p>
                  {s.description && (
                    <p className="mt-0.5 text-xs text-[#5A6968]">{s.description}</p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-bold text-[#0E5C5B]">{money(s.price)}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 space-y-1.5 rounded-xl bg-gray-50 px-4 py-3">
          {booking.confirmationFee > 0 && (
            <div className="flex items-center justify-between text-sm text-[#5A6968]">
              <span>
                {t('details.confirmationFee', { defaultValue: 'Booking confirmation fee' })}
              </span>
              <span>{money(booking.confirmationFee)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#15201F]">
              {t('details.total', { defaultValue: 'Total' })}
            </span>
            <span className="text-lg font-bold text-[#0E5C5B]">{money(total)}</span>
          </div>
        </div>
      </section>

      {/* ---- Activity timeline ---- */}
      <section>
        <h3 className="mb-3 text-xs font-bold tracking-wide text-[#5A6968] uppercase">
          {t('activityTimeline', { defaultValue: 'Activity Timeline' })}
        </h3>

        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400">
            {t('details.noActivity', { defaultValue: 'No activity yet.' })}
          </p>
        ) : (
          <ol className="relative space-y-4 ps-6">
            <span
              className="absolute start-[7px] top-1 bottom-1 w-px bg-gray-200"
              aria-hidden="true"
            />
            {timeline.map((item) => (
              <li key={item.id} className="relative">
                <span className="absolute start-[-22px] top-1 flex h-3.5 w-3.5 rounded-full bg-[#0E5C5B] ring-4 ring-white" />
                <p className="text-sm font-semibold text-[#15201F]">{item.label}</p>
                {item.at && (
                  <p className="mt-0.5 text-xs text-[#5A6968]">{formatDateTime(item.at)}</p>
                )}
                {item.note && <p className="mt-1 text-xs text-[#5A6968] italic">{item.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </Drawer>
  );
}
