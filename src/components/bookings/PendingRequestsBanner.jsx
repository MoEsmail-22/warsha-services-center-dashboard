import { Link, useParams } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { useBookings } from '@/contexts/BookingsContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNow } from '@/hooks/useNow';
import {
  approvalSecondsLeft,
  formatCountdown,
  isAwaitingWorkshop,
} from '@/constants/bookingStatuses';

/**
 * Banner shown while booking requests are waiting for an answer (5-minute window), on the
 * Dashboard and the Bookings page: "New booking request: answer within 4:32" + Open.
 * Hidden when nothing is waiting.
 */
export default function PendingRequestsBanner() {
  const { t } = useAppTranslation('bookings');
  const { lang = 'en' } = useParams();
  const { bookings } = useBookings();

  const hasPending = bookings.some((booking) => booking.status === 'pending');
  const now = useNow(hasPending);
  const waiting = bookings
    .filter((booking) => isAwaitingWorkshop(booking, now))
    .sort(
      (a, b) =>
        (approvalSecondsLeft(a, now) ?? Infinity) - (approvalSecondsLeft(b, now) ?? Infinity)
    );
  if (waiting.length === 0) return null;

  const first = waiting[0];
  const seconds = approvalSecondsLeft(first, now);
  const time = seconds == null ? null : formatCountdown(seconds);
  const message =
    time == null
      ? t('approval.bannerNoTime', {
          count: waiting.length,
          defaultValue: 'New booking requests are waiting for your answer',
        })
      : t('approval.banner', {
          count: waiting.length,
          time,
          defaultValue: `New booking request: answer within ${time}`,
        });

  return (
    <div
      role="status"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        seconds != null && seconds <= 60
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold tabular-nums">
        <BellRing className="h-4 w-4 shrink-0" aria-hidden="true" />
        {message}
      </p>
      <Link
        to={`/${lang}/bookings?booking=${encodeURIComponent(first.id)}`}
        className="rounded-lg bg-[#0E5C5B] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        {t('approval.open', { defaultValue: 'Open' })}
      </Link>
    </div>
  );
}
