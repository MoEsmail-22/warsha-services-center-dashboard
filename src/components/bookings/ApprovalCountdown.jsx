import { Clock, TimerOff } from 'lucide-react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import {
  approvalSecondsLeft,
  formatCountdown,
  isApprovalExpired,
  isAwaitingWorkshop,
} from '@/constants/bookingStatuses';
import { cn } from '@/utils/cn';

/**
 * Time left to accept or reject a new booking ("Answer within 4:32"), red in the last
 * minute, and "Time's up" once the 5 minutes are over. Shows nothing for other bookings.
 * `now` comes from the parent's useNow, so one clock drives every row.
 */
export default function ApprovalCountdown({ booking, now, className }) {
  const { t } = useAppTranslation('bookings');

  if (isApprovalExpired(booking, now)) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500',
          className
        )}
      >
        <TimerOff className="h-3.5 w-3.5" aria-hidden="true" />
        {t('approval.timeUp', { defaultValue: "Time's up: auto-rejected" })}
      </span>
    );
  }

  if (!isAwaitingWorkshop(booking, now)) return null;
  const seconds = approvalSecondsLeft(booking, now);
  if (seconds == null) return null;

  const urgent = seconds <= 60;
  return (
    <span
      role="timer"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        urgent ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700',
        className
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      {t('approval.answerWithin', {
        time: formatCountdown(seconds),
        defaultValue: `Answer within ${formatCountdown(seconds)}`,
      })}
    </span>
  );
}
