/**
 * Turns one booking from GET /Workshop/bookings into the shape the Bookings page,
 * the details drawer and the Dashboard already use.
 *
 * Confirmed from GET /Workshop/bookings/{id}: carBrand, carModel, carYear, scheduledAt,
 * services [{ name, price }], bookingStatus ("Confirmed"), jobStatus ("New"),
 * bookingNumber, totalAmount, paymentType, customerNotes, confirmedAt, completedAt.
 * The list (GET /Workshop/bookings) may use other names, so a few alternatives are kept.
 * The API sends no customer name yet.
 */
import { toStatusKey } from '@/constants/bookingStatuses';
import { normalizeQuote } from '@/utils/normalizeQuote';

const CUSTOMER_COLOR = '#C8730A';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "InProgress" / "In Progress" / "in_progress" → "in_progress"; "New" → "new". */
function toJobStage(value) {
  if (!value) return '';
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
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

function toDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Local "YYYY-MM-DD" and "HH:mm", matching what the page's filters compare against. */
function toLocalDateAndTime(date) {
  if (!date) return { date: '', time: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function formatMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return '';
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return [hours && `${hours}h`, rest && `${rest}m`].filter(Boolean).join(' ');
}

export function normalizeBooking(item) {
  const id = item.id ?? item.bookingId;

  const realCustomerName =
    item.customerName ??
    item.clientName ??
    item.customer?.fullName ??
    item.customer?.name ??
    item.client?.fullName ??
    item.client?.name ??
    null;
  const customerName = realCustomerName ?? 'Customer';

  const car = typeof item.car === 'object' && item.car ? item.car : {};
  const vehicle =
    item.carName ??
    (typeof item.car === 'string' ? item.car : null) ??
    (typeof item.vehicle === 'string' ? item.vehicle : null) ??
    [
      car.brand ?? car.brandName ?? item.carBrand ?? item.brandName,
      car.model ?? car.modelName ?? item.carModel ?? item.modelName,
      car.year ?? item.carYear,
    ]
      .filter(Boolean)
      .join(' ');

  // Services may come as objects ({ name, price }) or as plain names.
  const services = (Array.isArray(item.services) ? item.services : []).map((s) =>
    typeof s === 'string' ? { name: s } : s
  );
  const serviceNames = services.map((s) => s.nameEn ?? s.name ?? s.serviceName).filter(Boolean);
  const service =
    item.serviceName ??
    (Array.isArray(item.serviceNames) ? item.serviceNames.join(', ') : null) ??
    (serviceNames.length ? serviceNames.join(', ') : 'Service');

  // The appointment time is scheduledAt (bookingDate / date only if an older response lacks it).
  const scheduled = toDate(item.scheduledAt ?? item.bookingDate ?? item.date ?? item.startAt);
  const created = toDate(item.createdAt ?? item.createdOn);
  // The day the booking arrived. The API sends no creation date yet; a booking is
  // confirmed when it's placed (the customer pays the confirmation fee), so confirmedAt
  // is the closest date until it does.
  const received = created ?? toDate(item.confirmedAt);
  const notes = item.customerNotes ?? item.notes ?? '';

  return {
    id,
    customer: {
      name: customerName,
      initials: getInitials(customerName),
      avatarColor: CUSTOMER_COLOR,
    },
    // false = "Customer" is only a placeholder (the API sent no name).
    hasCustomerName: Boolean(realCustomerName),
    vehicle: vehicle || '—',
    service,
    ...toLocalDateAndTime(scheduled),
    // Local "YYYY-MM-DD" the booking arrived (for the dashboard's "Today's bookings").
    receivedDate: toLocalDateAndTime(received).date,
    status: toStatusKey(item.status ?? item.bookingStatus),
    // Job stage on the workshop floor ("New", "InProgress", …) — quotes need "in_progress".
    jobStatus: toJobStage(item.jobStatus),
    number: item.bookingNumber ?? '',
    totalAmount: Number(item.totalAmount ?? 0),
    paymentType: item.paymentType ?? '',
    // Fee the customer paid to confirm the booking (part of the total).
    confirmationFee: Number(item.confirmationFeeAmount ?? 0),
    // Why it was cancelled, or the reason the workshop gave when rejecting the request.
    cancellationReason: item.cancellationReason ?? item.rejectionReason ?? item.rejectReason ?? '',
    // Raw ISO dates; the drawer formats them in the current language.
    confirmedAt: item.confirmedAt ?? null,
    completedAt: item.completedAt ?? null,
    scheduledAt: item.scheduledAt ?? null,
    // The quote waiting for the customer's answer (only in GET /Workshop/bookings/{id}).
    pendingQuote: item.pendingQuote
      ? normalizeQuote({ bookingId: id, ...item.pendingQuote })
      : null,
    createdAt: created ? DATE_TIME_FORMATTER.format(created) : '',
    createdAtIso: item.createdAt ?? item.createdOn ?? null,
    // When the 5-minute answer window ends (see bookingStatuses.js → approvalDeadlineOf).
    approvalDeadline: item.approvalDeadline ?? item.approvalExpiresAt ?? null,
    notes,
    serviceBreakdown: services.map((s) => ({
      label: s.nameEn ?? s.name ?? s.serviceName ?? 'Service',
      description: s.descriptionEn ?? s.description ?? '',
      price: s.price ?? s.minPrice ?? 0,
      duration: formatMinutes(s.duration ?? s.durationMinutes),
    })),
    timeline: [
      {
        id: `${id}-received`,
        label: 'Booking Received',
        timestamp: created ? DATE_TIME_FORMATTER.format(created) : '',
        note: notes,
        done: true,
      },
    ],
  };
}
