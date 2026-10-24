import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppTranslation } from '@/hooks/useAppTranslation';

// At most this many page numbers are shown; the window slides with the current page.
const MAX_VISIBLE_PAGES = 5;

/**
 * The page numbers to show: up to MAX_VISIBLE_PAGES, with the current page in the middle
 * when possible (page 6 of 10 → 4 5 6 7 8; page 1 → 1–5; page 10 → 6–10).
 */
function visiblePages(currentPage, totalPages) {
  const count = Math.min(MAX_VISIBLE_PAGES, totalPages);
  const first = Math.min(Math.max(1, currentPage - Math.floor(count / 2)), totalPages - count + 1);
  return Array.from({ length: count }, (_, index) => first + index);
}

/**
 * Shared pagination for paginated dashboard lists.
 * Pass pageSizeOptions + onPageSizeChange to show a "Rows per page" picker.
 */
export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  labels = {},
  className,
}) {
  const { t } = useAppTranslation('common');
  const text = (key, fallback) => labels[key] || t('pagination.' + key, { defaultValue: fallback });
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);
  const goToPage = (page) => onPageChange(Math.min(Math.max(page, 1), totalPages));
  const showSizePicker = Boolean(pageSizeOptions?.length && onPageSizeChange);

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3',
        className
      )}
      aria-label={text('navigation', 'Pagination')}
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-[#5A6968]">
          {text('showing', 'Showing')}{' '}
          <span className="font-semibold text-[#15201F]">
            {firstItem}–{lastItem}
          </span>{' '}
          {text('of', 'of')} <span className="font-semibold text-[#15201F]">{totalItems}</span>
        </p>

        {showSizePicker && (
          <label className="flex items-center gap-2 text-xs text-[#5A6968]">
            {text('rowsPerPage', 'Rows per page')}
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-md border border-[#E8E2D8] bg-white px-2 py-1 text-xs font-semibold text-[#15201F] focus:border-[#0E5C5B] focus:outline-none"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goToPage(safePage - 1)}
          disabled={safePage === 1}
          aria-label={text('previous', 'Previous page')}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
        {visiblePages(safePage, totalPages).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => goToPage(page)}
            aria-current={safePage === page ? 'page' : undefined}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-colors',
              safePage === page ? 'bg-[#1C1712] text-white' : 'text-[#5A5045] hover:bg-[#F2EDE4]'
            )}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => goToPage(safePage + 1)}
          disabled={safePage === totalPages}
          aria-label={text('next', 'Next page')}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
