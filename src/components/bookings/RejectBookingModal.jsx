import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { Spinner } from '@/components/ui/Spinner';
import { useAppTranslation } from '@/hooks/useAppTranslation';

/**
 * Asks why a pending booking request is rejected; the reason is sent to the backend and
 * shown to the customer. Used by the Bookings table and the booking details drawer.
 *
 *   <RejectBookingModal open itemName="WRSH-261010-921" busy={saving}
 *     onClose={...} onConfirm={(reason) => ...} />
 */
export default function RejectBookingModal({ open, itemName, busy = false, onClose, onConfirm }) {
  const { t } = useAppTranslation('bookings');
  const [reason, setReason] = useState('');
  const [showRequired, setShowRequired] = useState(false);

  // Start empty each time the window opens.
  useEffect(() => {
    if (open) {
      setReason('');
      setShowRequired(false);
    }
  }, [open]);

  const submit = () => {
    if (busy) return;
    if (!reason.trim()) {
      setShowRequired(true);
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={t('rejection.title', { defaultValue: 'Reject booking request?' })}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t('rejection.keep', { defaultValue: 'Keep request' })}
          </Button>
          <Button type="button" variant="danger" onClick={submit} disabled={busy}>
            {busy && <Spinner size="sm" className="border-white/30 border-t-white" />}
            {t('rejection.confirm', { defaultValue: 'Reject request' })}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-amber-900">
            {t('rejection.message', {
              name: itemName,
              defaultValue: 'The customer will be told that {{name}} was rejected.',
            })}
          </p>
        </div>

        <div>
          <label htmlFor="reject-reason" className="label">
            {t('rejection.reasonLabel', { defaultValue: 'Reason' })}
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (event.target.value.trim()) setShowRequired(false);
            }}
            rows={3}
            maxLength={500}
            placeholder={t('rejection.reasonPlaceholder', {
              defaultValue: 'e.g. Fully booked that day',
            })}
            aria-invalid={showRequired}
            className="input min-h-[88px] py-2"
          />
          {showRequired && (
            <p role="alert" className="mt-1.5 text-sm text-red-600">
              {t('rejection.reasonRequired', { defaultValue: 'Please write a reason.' })}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
