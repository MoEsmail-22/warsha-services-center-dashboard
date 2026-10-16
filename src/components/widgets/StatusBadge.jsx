/**
 * StatusBadge — colored pill for booking/job/quote/review statuses.
 *
 * Uses SOFT TINTS (light background + colored text) — matches Phase 1 design.
 * Pill shape (rounded-full), white space-agnostic, works in LTR + RTL.
 */
import { cn } from '@/utils/cn';
import { useAppTranslation } from '@/hooks/useAppTranslation';

const STATUS_STYLES = {
  // Booking statuses — soft tints
  pending: 'bg-status-pending/10 text-status-pending',
  confirmed: 'bg-status-confirmed/10 text-status-confirmed',
  cancelled: 'bg-status-cancelled/10 text-status-cancelled',
  completed: 'bg-status-completed/10 text-status-completed',
  quote_pending: 'bg-status-pending/10 text-status-pending',
  billing: 'bg-accent/10 text-accent-dark',
  billing_in_progress: 'bg-accent/10 text-accent-dark',

  // Job statuses
  new: 'bg-accent/10 text-accent-dark',
  diagnosing: 'bg-status-confirmed/10 text-status-confirmed', // shown as "Confirmed"
  in_progress: 'bg-status-completed/10 text-status-completed',
  inProgress: 'bg-status-completed/10 text-status-completed',
  in_service: 'bg-primary/10 text-primary-700',
  ready: 'bg-[#0E5C5B]/10 text-[#0E5C5B]', // brand teal: ready for pickup
  delayed: 'bg-status-delayed/10 text-status-delayed',
  urgent: 'bg-status-urgent/10 text-status-urgent',

  // Quote statuses
  draft: 'bg-status-draft/10 text-status-draft',
  sent: 'bg-gray-100 text-gray-600',
  accepted: 'bg-status-completed/10 text-status-completed',
  awaiting: 'bg-status-pending/10 text-status-pending',
  approved: 'bg-status-completed/10 text-status-completed',
  rejected: 'bg-status-cancelled/10 text-status-cancelled',
  expired: 'bg-gray-400/10 text-gray-500',

  // Technician statuses
  available: 'bg-status-completed/10 text-status-completed',
  busy: 'bg-status-confirmed/10 text-status-confirmed',
  break: 'bg-status-pending/10 text-status-pending',
  off: 'bg-gray-400/10 text-gray-500',
};

const DEFAULT_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  quote_pending: 'Quote Pending',
  billing: 'Billing',
  billing_in_progress: 'Billing in Progress',
  new: 'New',
  in_progress: 'In Progress',
  inProgress: 'In Progress',
  in_service: 'In Service',
  ready: 'Ready',
  delayed: 'Delayed',
  urgent: 'Urgent',
  draft: 'Draft',
  sent: 'Sent - awaiting',
  accepted: 'Approved',
  awaiting: 'Awaiting',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
  available: 'Available',
  busy: 'Busy',
  break: 'On Break',
  off: 'Off',
};

export function StatusBadge({ status, children, className }) {
  const { t } = useAppTranslation('common');
  const styleClass = STATUS_STYLES[status] ?? 'bg-gray-400/10 text-gray-500';
  // A shared status label keeps every page consistent and follows AR/EN selection.
  const label =
    children ?? t(`status.${status}`, { defaultValue: DEFAULT_LABELS[status] ?? status });

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        styleClass,
        className
      )}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
