/**
 * QuoteLineItemRow renders one editable service/price entry in a quote.
 * State remains in QuotesPage/QuotesContext; this component reports user
 * actions through the supplied callbacks so it can be reused elsewhere.
 */
import { Trash2 } from 'lucide-react';

export function QuoteLineItemRow({ item, onChange, onRemove, descriptionPlaceholder }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2 py-1.5">
      <input
        type="text"
        value={item.label}
        onChange={(event) => onChange(item.id, 'label', event.target.value)}
        placeholder={descriptionPlaceholder}
        className="h-7 flex-1 rounded border border-transparent bg-transparent px-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0E5C5B] focus:bg-white focus:ring-1 focus:ring-[#0E5C5B]/10 focus:outline-none"
      />

      <div className="flex h-7 w-28 items-center overflow-hidden rounded border border-transparent bg-gray-50 focus-within:border-[#0E5C5B] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#0E5C5B]/10">
        <span className="pl-2 text-xs text-gray-400">EGP</span>
        <input
          type="number"
          min="0"

          value={item.amount}
          onChange={(event) => onChange(item.id, 'amount', event.target.value)}
          className="h-full w-full bg-transparent px-1.5 text-right text-sm font-semibold text-gray-900 focus:outline-none"
        />
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        aria-label="Remove item"
        title="Remove item"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default QuoteLineItemRow;
