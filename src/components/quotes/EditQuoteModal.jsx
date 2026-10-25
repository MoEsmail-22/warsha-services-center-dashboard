import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useAppTranslation } from '@/hooks/useAppTranslation';
import { useNotify } from '@/hooks/useNotify';
import { useQuotes } from '@/contexts/QuotesContext';
import { createLocalError } from '@/API/errors';
import { getBooking } from '@/API/bookingsApi';
import { normalizeBooking } from '@/utils/normalizeBooking';
import { formatQuoteCurrency } from '@/utils/quotes';
import QuoteLineItemRow from './QuoteLineItemRow';
import RecommendationRows from './RecommendationRows';

const newRow = () => ({ id: `${Date.now()}-${Math.random()}`, label: '', amount: 0 });

/** The quote's lines to start from. A quote listed without its lines starts as one line. */
function rowsOf(quote) {
  if (quote.lineItems?.length) return quote.lineItems.map((line) => ({ ...line }));
  if (quote.amount > 0) {
    return [
      { ...newRow(), label: quote.service === '—' ? '' : quote.service, amount: quote.amount },
    ];
  }
  return [newRow()];
}

/**
 * Edits a quote that's still waiting for the customer's answer:
 * PUT /Workshop/quotes/{id} with the lines and the note.
 */
export default function EditQuoteModal({ quote, onClose, locale, currency }) {
  const { t } = useAppTranslation('quotes');
  const notify = useNotify();
  const { editQuote } = useQuotes();
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  // The booking's recommendations: what's on screen, and what the backend had (to know
  // which ones were changed or removed when saving).
  const [recommendations, setRecommendations] = useState([]);
  const [savedRecommendations, setSavedRecommendations] = useState([]);

  // Start from the quote each time another one is opened. Only the id counts: the quotes
  // list reloads in the background every 30 s, and that mustn't wipe unsaved changes.
  //
  // PUT replaces ALL the quote's lines, so every original line must be in the form. The
  // quotes list may send lines without their description, so the full quote is loaded from
  // the booking (GET /Workshop/bookings/{id} → pendingQuote) and its lines are used instead.
  const quoteId = quote?.id ?? null;
  useEffect(() => {
    if (!quote) return undefined;
    setRows(rowsOf(quote));
    setNote(quote.note ?? '');
    setRecommendations([]);
    setSavedRecommendations([]);
    if (!quote.bookingId) return undefined;

    let cancelled = false;
    setLoadingLines(true);
    getBooking(quote.bookingId)
      .then((result) => {
        const raw = result?.data ?? result;
        const booking = raw && typeof raw === 'object' ? normalizeBooking(raw) : null;
        if (!cancelled && booking) {
          setRecommendations(booking.recommendations.map((item) => ({ ...item })));
          setSavedRecommendations(booking.recommendations);
        }
        const pending = booking?.pendingQuote ?? null;
        const sameQuote =
          pending && (pending.id == null || String(pending.id) === String(quote.id));
        if (cancelled || !sameQuote || !pending.lineItems.length) return;
        setRows(pending.lineItems.map((line) => ({ ...line })));
        if (pending.note) setNote(pending.note);
      })
      .catch(() => {
        // Keep the lines from the quotes list; saving still refuses lines without a description.
      })
      .finally(() => {
        if (!cancelled) setLoadingLines(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per quote id, see above
  }, [quoteId]);

  const updateRow = (id, field, value) =>
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: field === 'amount' ? Number(value) || 0 : value } : row
      )
    );
  const removeRow = (id) => setRows((current) => current.filter((row) => row.id !== id));
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  const close = () => {
    if (!saving) onClose();
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving || loadingLines || !quote) return;

    // Lines left completely empty are skipped. Any other line must be complete: PUT replaces
    // all the lines, so dropping one quietly would delete it from the quote.
    const filled = rows.filter((row) => row.label.trim() || Number(row.amount) > 0);
    if (filled.some((row) => !row.label.trim() || !(Number(row.amount) > 0))) {
      notify.error(
        createLocalError(
          'quote.lineIncomplete',
          'Every line needs a description and a price. Fill them in or remove the line.'
        )
      );
      return;
    }
    if (filled.length === 0) {
      notify.error(
        createLocalError(
          'quote.itemsRequired',
          'Add at least one item with a description and a price.'
        )
      );
      return;
    }

    setSaving(true);
    try {
      const { recommendationsFailed } = await editQuote(quote.id, {
        items: filled,
        note: note.trim(),
        bookingId: quote.bookingId,
        recommendations,
        previousRecommendations: savedRecommendations,
      });
      notify.success('quoteUpdated');
      if (recommendationsFailed > 0) {
        notify.error(
          createLocalError(
            'quote.recommendationsFailed',
            "The quote was saved, but some recommendations couldn't be saved."
          )
        );
      }
      onClose();
    } catch (error) {
      notify.error(error, 'quote.update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(quote)}
      onClose={close}
      title={t('edit.title', { defaultValue: 'Edit quote' })}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            {t('edit.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button type="submit" form="edit-quote-form" disabled={saving || loadingLines}>
            {saving
              ? t('edit.saving', { defaultValue: 'Saving…' })
              : t('edit.save', { defaultValue: 'Save changes' })}
          </Button>
        </>
      }
    >
      <form id="edit-quote-form" onSubmit={save} className="space-y-4">
        <p className="text-sm text-[#5A6968]">
          {t('edit.hint', {
            defaultValue: 'The customer sees the updated quote. You can edit it until they answer.',
          })}
        </p>

        {loadingLines && (
          <p className="text-xs text-[#5A6968]">
            {t('edit.loadingLines', { defaultValue: 'Loading the quote lines…' })}
          </p>
        )}
        <div className={`space-y-2 ${loadingLines ? 'pointer-events-none opacity-50' : ''}`}>
          {rows.map((row) => (
            <QuoteLineItemRow
              key={row.id}
              item={row}
              onChange={updateRow}
              onRemove={removeRow}
              descriptionPlaceholder={t('itemPlaceholder', { defaultValue: 'Service description' })}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((current) => [...current, newRow()])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-[#5A6968] transition-colors hover:border-[#0E5C5B] hover:text-[#0E5C5B]"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('addLineItem', { defaultValue: 'Add line item' })}
        </button>

        <div>
          <label htmlFor="edit-quote-note" className="label">
            {t('notes', { defaultValue: 'Notes' })}
          </label>
          <input
            id="edit-quote-note"
            type="text"
            className="input"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('notePlaceholder', {
              defaultValue: 'Notes or details for the customer',
            })}
          />
        </div>

        {/* The booking's recommendations: saved with the quote (POST / PUT / DELETE) */}
        <RecommendationRows
          rows={recommendations}
          onChange={setRecommendations}
          disabled={loadingLines || saving}
        />

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className="text-xs tracking-wide text-[#5A6968] uppercase">
            {t('total', { defaultValue: 'Total' })}
          </span>
          <span
            className="text-lg font-bold text-[#0E5C5B]"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {formatQuoteCurrency(total, locale, currency)}
          </span>
        </div>
      </form>
    </Modal>
  );
}
