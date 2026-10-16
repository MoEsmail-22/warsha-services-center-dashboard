/**
 * Turns one quote from GET /Workshop/quotes into the shape the Quotes page uses.
 *
 * ⚠ The API docs don't describe the response, so each field is read from its most
 *   likely names. Once a real quote is available, trim this to the actual fields.
 */
const CUSTOMER_COLOR = '#C8730A';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

// Quote statuses the StatusBadge knows: draft, sent, accepted, rejected.
const STATUS_BY_NUMBER = { 1: 'sent', 2: 'accepted', 3: 'rejected' };

function toQuoteStatus(value) {
  if (value == null || value === '') return 'sent';
  if (STATUS_BY_NUMBER[value]) return STATUS_BY_NUMBER[value];
  const key = String(value).toLowerCase();
  if (['approved', 'accepted'].includes(key)) return 'accepted';
  if (['declined', 'rejected'].includes(key)) return 'rejected';
  if (['pending', 'sent', 'awaiting'].includes(key)) return 'sent';
  return key === 'draft' ? 'draft' : 'sent';
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function normalizeQuote(item) {
  const rawItems = item.items ?? item.quoteItems ?? item.lineItems ?? [];
  const lineItems = (Array.isArray(rawItems) ? rawItems : []).map((line, index) => ({
    id: line.id ?? `${item.id}-${index}`,
    label: line.description ?? line.label ?? line.name ?? '',
    amount: Number(line.price ?? line.amount ?? 0),
  }));

  const customerName =
    item.customerName ??
    item.clientName ??
    item.customer?.fullName ??
    item.customer?.name ??
    item.booking?.customerName ??
    'Customer';

  const vehicle =
    item.carName ??
    item.vehicle ??
    item.booking?.carName ??
    [item.carBrand ?? item.car?.brand, item.carModel ?? item.car?.model].filter(Boolean).join(' ');

  const created = item.createdAt ?? item.sentAt ?? item.createdOn;
  const createdDate = created ? new Date(created) : null;

  return {
    id: item.id ?? item.quoteId,
    bookingId: item.bookingId ?? item.booking?.id ?? null,
    // What the customer sees (e.g. WRSH-261016-647); the id above is only for the API.
    bookingNumber: item.bookingNumber ?? item.booking?.bookingNumber ?? '',
    customer: {
      name: customerName,
      initials: getInitials(customerName),
      avatarColor: CUSTOMER_COLOR,
    },
    vehicle: vehicle || '—',
    service:
      lineItems
        .map((line) => line.label)
        .filter(Boolean)
        .join(', ') ||
      item.serviceName ||
      '—',
    amount: Number(
      // extraTotal: the quote's total from the API (the extra work, not the whole booking).
      item.extraTotal ??
        item.total ??
        item.totalAmount ??
        item.totalPrice ??
        item.amount ??
        lineItems.reduce((sum, l) => sum + l.amount, 0)
    ),
    status: toQuoteStatus(item.status ?? item.quoteStatus),
    sentAt:
      createdDate && !Number.isNaN(createdDate.getTime()) ? DATE_FORMATTER.format(createdDate) : '',
    note: item.note ?? '',
    lineItems,
  };
}
