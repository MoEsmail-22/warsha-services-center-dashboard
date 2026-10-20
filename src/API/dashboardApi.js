import apiClient from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError as logErrorFor, logResponse as logResponseFor } from './devLog';

const AREA = 'Dashboard API';
const logResponse = (label, response) => logResponseFor(AREA, label, response);
const logError = (label, error) => logErrorFor(AREA, label, error);

// The responses aren't documented in Swagger: the names below follow the endpoints sheet
// first, then a few common alternatives. A value the API doesn't send stays null, so the
// page can fall back to what it counts itself.
const numberOf = (...values) => {
  const value = values.find((item) => item !== undefined && item !== null && item !== '');
  const number = Number(value);
  return value === undefined || Number.isNaN(number) ? null : number;
};

const unwrap = (result) => (result?.data !== undefined ? result.data : result) ?? {};

/** Monday of the week that contains `date`, as "YYYY-MM-DD" (local time). */
export function weekStartOf(date = new Date()) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return toDateKey(day);
}

export function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** GET /Workshop/dashboard/stats → the numbers for the four KPI cards. */
export async function getDashboardStats() {
  try {
    const response = await apiClient.get('/Workshop/dashboard/stats');
    logResponse('GET stats', response);
    const data = unwrap(assertApiSuccess(response.data, 'Failed to load the dashboard.'));
    const revenue =
      data.revenueToday && typeof data.revenueToday === 'object' ? data.revenueToday : {};

    return {
      todaysBookings: numberOf(data.todaysBookings, data.todayBookings, data.bookingsToday),
      yesterdaysBookings: numberOf(
        data.yesterdaysBookings,
        data.yesterdayBookings,
        data.bookingsYesterday
      ),
      carsInService: numberOf(data.carsInService, data.inServiceCount, data.activeJobs),
      awaitingApproval: numberOf(data.awaitingApproval, data.pendingApproval, data.pendingBookings),
      revenueToday: numberOf(
        revenue.amount,
        typeof data.revenueToday === 'object' ? undefined : data.revenueToday,
        data.todayRevenue,
        data.todaysRevenue
      ),
      revenueChangePercent: numberOf(revenue.changePercent, data.revenueChangePercent),
      averageRating: numberOf(data.averageRating, data.avgRating, data.rating),
      reviewsCount: numberOf(data.reviewsCount, data.totalReviews, data.reviewCount),
    };
  } catch (error) {
    logError('GET stats', error);
    return handleApiError(error, 'Load dashboard stats');
  }
}

/**
 * GET /Workshop/dashboard/revenue?WeekStart= → { days: 7 × { date, amount }, total }.
 * Always Monday → Sunday of that week; days the API leaves out count as 0.
 */
export async function getWeeklyRevenue(weekStart = weekStartOf()) {
  try {
    const response = await apiClient.get('/Workshop/dashboard/revenue', {
      params: { WeekStart: weekStart },
    });
    logResponse(`GET revenue ${weekStart}`, response);
    const data = unwrap(assertApiSuccess(response.data, 'Failed to load revenue.'));
    const rows = [data.days, data.items, data.dailyRevenue, data].find(Array.isArray) ?? [];

    const amounts = new Map();
    rows.forEach((row, index) => {
      // "2026-10-12" or "2026-10-12T00:00:00": the calendar day, read as written (no time zone
      // shift). Without a usable date, the n-th row is the n-th day of the week.
      const raw = String(row.date ?? row.day ?? row.dayDate ?? '');
      const key = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : `#${index}`;
      amounts.set(key, numberOf(row.amount, row.revenue, row.total, row.value) ?? 0);
    });

    const [year, month, day] = weekStart.split('-').map(Number);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(year, month - 1, day + index);
      const key = toDateKey(date);
      return { date: key, amount: amounts.get(key) ?? amounts.get(`#${index}`) ?? 0 };
    });
    const sum = days.reduce((total, item) => total + item.amount, 0);

    return { days, total: numberOf(data.total, data.totalAmount, data.weekTotal) ?? sum };
  } catch (error) {
    logError(`GET revenue ${weekStart}`, error);
    return handleApiError(error, 'Load revenue');
  }
}
