/**
 * BookingActions — the actions section of the booking details drawer:
 * accept or reject a pending request, move an accepted job to another stage,
 * start a quote for this booking, and redeem a customer's voucher.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, FilePlus2, X } from 'lucide-react';
import { useBookings } from '@/contexts/BookingsContext';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNotify } from '@/hooks/useNotify';
import { isAwaitingWorkshop } from '@/constants/bookingStatuses';
import { Spinner } from '@/components/ui/Spinner';
import RejectBookingModal from './RejectBookingModal';
import VoucherRedeemForm from './VoucherRedeemForm';
import ApprovalCountdown from './ApprovalCountdown';
import { useNow } from '@/hooks/useNow';

// Job stages the dropdown offers (the Jobs Board columns + Completed). The backend only
// allows one step at a time and explains a refused move. "new" is the starting stage.
const STAGE_OPTIONS = ['new', 'diagnosing', 'in_progress', 'ready', 'completed'];

export default function BookingActions({ booking }) {
  const { t } = useAppTranslation('bookings');
  const { lang = 'en' } = useParams();
  const { changeJobStage, acceptBooking, rejectBooking } = useBookings();
  const notify = useNotify();

  const currentStage = booking.jobStatus || 'new';
  const [stage, setStage] = useState(currentStage);
  const [savingStage, setSavingStage] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Waiting for the workshop's answer (job stage "New"), not the customer's booking status.
  // Ticks every second while this booking waits, so the buttons go away when time is up.
  const now = useNow(booking.status === 'pending');
  const isPending = isAwaitingWorkshop(booking, now);

  const accept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      await acceptBooking(booking.id);
      notify.success('bookingAccepted');
    } catch (err) {
      notify.error(err, 'booking.accept');
    } finally {
      setAccepting(false);
    }
  };

  const reject = async (reason) => {
    setRejecting(true);
    try {
      await rejectBooking(booking.id, reason);
      notify.success('bookingRejected');
      setRejectOpen(false);
    } catch (err) {
      notify.error(err, 'booking.reject');
    } finally {
      setRejecting(false);
    }
  };

  // Show the booking's current stage again when another booking is opened.
  useEffect(() => {
    setStage(currentStage);
  }, [booking.id, currentStage]);

  const isClosed = ['cancelled', 'completed'].includes(booking.status);
  // Accepted = not waiting for the workshop's answer, and not cancelled.
  const isAccepted = !isPending && booking.status !== 'pending' && booking.status !== 'cancelled';

  const saveStage = async () => {
    if (stage === currentStage || savingStage) return;
    setSavingStage(true);
    try {
      await changeJobStage(booking.id, stage, currentStage);
      notify.success('jobStageChanged');
    } catch (err) {
      setStage(err.reachedStage ?? currentStage);
      notify.error(err, 'booking.status');
    } finally {
      setSavingStage(false);
    }
  };

  return (
    <section className="mb-6 space-y-4 rounded-xl border border-[#E8E2D8] bg-[#FBF8F3] p-4">
      {/* Time left to answer, or "Time's up" once the 5 minutes are over */}
      <ApprovalCountdown booking={booking} now={now} />

      {/* New request: accept or reject it */}
      {isPending && (
        <div>
          <p className="mb-1.5 text-xs font-bold tracking-wide text-[#5A6968] uppercase">
            {t('requestActions.title', { defaultValue: 'New booking request' })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={accepting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0E5C5B] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? (
                <Spinner size="sm" className="border-white/30 border-t-white" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              {t('requestActions.accept', { defaultValue: 'Accept' })}
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              disabled={accepting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t('requestActions.reject', { defaultValue: 'Reject' })}
            </button>
          </div>
        </div>
      )}

      {/* Job stage (once the request is accepted) */}
      {!isPending && (
        <div>
          <label
            htmlFor={`booking-status-${booking.id}`}
            className="mb-1.5 block text-xs font-bold tracking-wide text-[#5A6968] uppercase"
          >
            {t('actions.jobStage', { defaultValue: 'Job stage' })}
          </label>
          <div className="flex gap-2">
            <select
              id={`booking-status-${booking.id}`}
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              disabled={isClosed || savingStage}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#0E5C5B] focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
            >
              {STAGE_OPTIONS.map((key) => (
                <option key={key} value={key}>
                  {t(`jobStage.${key}`, { defaultValue: key })}
                </option>
              ))}
              {!STAGE_OPTIONS.includes(currentStage) && (
                <option value={currentStage}>
                  {t(`jobStage.${currentStage}`, { defaultValue: currentStage })}
                </option>
              )}
            </select>
            <button
              type="button"
              onClick={saveStage}
              disabled={isClosed || stage === currentStage || savingStage}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0E5C5B] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingStage && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {t('actions.updateStatus', { defaultValue: 'Update' })}
            </button>
          </div>
        </div>
      )}

      {/* Quote */}
      {/* The backend only accepts quotes while the job is in progress. */}
      {!isClosed && booking.jobStatus === 'in_progress' && (
        <Link
          to={`/${lang}/quotes?booking=${encodeURIComponent(booking.id)}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#0E5C5B] bg-white px-4 py-2 text-sm font-semibold text-[#0E5C5B] transition-colors hover:bg-[#EDF7F5]"
        >
          <FilePlus2 className="h-4 w-4" />
          {t('actions.createQuote', { defaultValue: 'Create quote for this booking' })}
        </Link>
      )}

      {/* Promo code / voucher: only once the booking has been accepted */}
      {isAccepted && <VoucherRedeemForm bookingId={booking.id} />}

      <RejectBookingModal
        open={rejectOpen}
        itemName={booking.number || `#${booking.id}`}
        busy={rejecting}
        onClose={() => setRejectOpen(false)}
        onConfirm={reject}
      />
    </section>
  );
}
