import { useEffect, useState } from 'react';
import { TicketPercent } from 'lucide-react';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNotify } from '@/hooks/useNotify';
import { redeemVoucher } from '@/API/vouchersApi';
import { createLocalError } from '@/API/errors';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Redeem a customer's promo code / voucher for a booking. Used in the booking drawer and
 * on the Quotes page; both show it only once the booking has been accepted.
 */
export default function VoucherRedeemForm({ bookingId }) {
  const { t } = useAppTranslation('bookings');
  const notify = useNotify();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Start empty for each booking.
  useEffect(() => setCode(''), [bookingId]);

  const submit = async (event) => {
    event.preventDefault();
    event.stopPropagation(); // the Quotes page form must not send the quote
    if (redeeming) return;
    if (!code.trim()) {
      notify.error(createLocalError('voucher.codeRequired', 'Enter the voucher code.'));
      return;
    }
    setRedeeming(true);
    try {
      await redeemVoucher(code);
      notify.success('voucherRedeemed');
      setCode('');
    } catch (err) {
      notify.error(err, 'voucher.redeem');
    } finally {
      setRedeeming(false);
    }
  };

  const inputId = `booking-voucher-${bookingId ?? 'new'}`;
  return (
    // A <div> (not a nested <form>): on the Quotes page it sits inside the quote's form.
    <div
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target.id === inputId) submit(event);
      }}
    >
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-xs font-bold tracking-wide text-[#5A6968] uppercase"
      >
        {t('actions.voucher', { defaultValue: 'Customer voucher' })}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <TicketPercent className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id={inputId}
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder={t('actions.voucherPlaceholder', { defaultValue: 'Enter voucher code' })}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 ps-9 pe-3 text-sm text-gray-900 uppercase placeholder:text-gray-400 placeholder:normal-case focus:border-[#0E5C5B] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={redeeming}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E8E2D8] bg-white px-4 text-sm font-semibold text-[#1C1712] hover:bg-[#F2EDE4] disabled:opacity-50"
        >
          {redeeming && <Spinner size="sm" />}
          {t('actions.redeem', { defaultValue: 'Redeem' })}
        </button>
      </div>
    </div>
  );
}
