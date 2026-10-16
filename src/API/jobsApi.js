import apiClient from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError, logResponse } from './devLog';
import { STAGE_BY_BOARD_KEY } from '@/constants/jobStages';

const AREA = 'Jobs API';

/** Local "HH:mm" of the scheduled time, shown on the card. */
function toTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** One card from GET /Workshop/jobs-board → what the Jobs Board shows. */
function normalizeJob(item, stage) {
  const services = (Array.isArray(item.services) ? item.services : [])
    .map((service) => (typeof service === 'string' ? service : (service?.name ?? '')))
    .filter(Boolean);
  const customer = item.clientName ?? '';

  return {
    // Draggable ids must be strings.
    id: String(item.bookingId),
    bookingId: item.bookingId,
    number: item.bookingNumber ?? '',
    customer,
    initials: initialsOf(customer),
    vehicle: [item.carBrand, item.carModel].filter(Boolean).join(' ') || '—',
    service: services.join(', '),
    scheduledAt: item.scheduledAt ?? null,
    time: toTime(item.scheduledAt),
    hasPendingQuote: Boolean(item.hasPendingQuote),
    stage,
  };
}

/**
 * The workshop's cars grouped by stage. The API sends
 * { new: [...], diagnosing: [...], inProgress: [...], ready: [...] }; this returns one
 * flat list where each job has its `stage`.
 */
export async function getJobsBoard() {
  try {
    const response = await apiClient.get('/Workshop/jobs-board');
    logResponse(AREA, 'GET jobs board', response);
    const board = assertApiSuccess(response.data, 'Failed to load the jobs board.')?.data ?? {};
    return Object.entries(STAGE_BY_BOARD_KEY).flatMap(([boardKey, stage]) =>
      (Array.isArray(board[boardKey]) ? board[boardKey] : []).map((item) =>
        normalizeJob(item, stage)
      )
    );
  } catch (error) {
    logError(AREA, 'GET jobs board', error);
    return handleApiError(error, 'Load jobs board');
  }
}
