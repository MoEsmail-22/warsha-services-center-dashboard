import apiClient from './client';
import { assertApiSuccess, handleApiError } from './errors';
import { logError as logErrorFor, logResponse as logResponseFor } from './devLog';

const AREA = 'Reviews API';
const logResponse = (label, response) => logResponseFor(AREA, label, response);
const logError = (label, error) => logErrorFor(AREA, label, error);

/** GET /Workshop/reviews?type= — 1 = reviews of the workshop itself, 2 = reviews of a service. */
export const REVIEW_TYPES = { workshop: 1, service: 2 };

const firstText = (...values) =>
  values.find((value) => typeof value === 'string' && value.trim())?.trim() ?? '';

/** One review in the shape the page uses; the response format isn't documented, so this is lenient. */
export function normalizeReview(review = {}, index = 0) {
  const client = review.client ?? review.customer ?? review.user ?? {};
  const service = review.workshopService ?? review.service ?? {};

  return {
    id: String(review.id ?? review.reviewId ?? `${review.bookingId ?? 'review'}-${index}`),
    type: Number(review.type ?? review.reviewType) || null,
    rating: Math.min(5, Math.max(0, Math.round(Number(review.rating ?? review.stars ?? 0)))),
    comment: firstText(review.comment, review.text, review.content),
    customerName: firstText(
      review.clientName,
      review.customerName,
      review.userName,
      review.reviewerName,
      client.name,
      client.fullName
    ),
    serviceName: firstText(
      review.serviceName,
      review.workshopServiceName,
      review.serviceNameEn,
      service.name,
      service.nameEn
    ),
    bookingId: review.bookingId ?? null,
    bookingNumber: firstText(review.bookingNumber),
    createdAt: review.createdAt ?? review.createdOn ?? review.date ?? null,
    reply: firstText(review.reply, review.workshopReply, review.response) || null,
  };
}

/** One page of reviews: { items, totalCount, totalPages }. */
export async function getReviews({ type = REVIEW_TYPES.workshop, page = 1, pageSize = 50 } = {}) {
  const label = `GET reviews type ${type} page ${page}`;
  try {
    const response = await apiClient.get('/Workshop/reviews', {
      params: { type, page, pageSize },
    });
    logResponse(label, response);
    const result = assertApiSuccess(response.data, 'Failed to load reviews.');

    // The list may come as data: [...] or data: { items: [...], totalCount, totalPages }.
    const rows =
      [result?.data, result?.data?.items, result?.data?.reviews, result?.items, result].find(
        Array.isArray
      ) ?? [];
    const meta = result?.data && !Array.isArray(result.data) ? result.data : (result ?? {});

    return {
      items: rows.map(normalizeReview),
      totalCount: Number(meta.totalCount ?? meta.total) || rows.length,
      totalPages: Number(meta.totalPages) || null,
    };
  } catch (error) {
    logError(label, error);
    return handleApiError(error, 'Load reviews');
  }
}

/** Every review of one type (page by page, at most 10 pages). */
export async function getAllReviews(type) {
  const pageSize = 50;
  const items = [];
  for (let page = 1; page <= 10; page += 1) {
    const result = await getReviews({ type, page, pageSize });
    items.push(...result.items);

    const lastPage = result.totalPages ?? Math.ceil(result.totalCount / pageSize);
    if (result.items.length < pageSize || page >= lastPage) break;
  }
  return items;
}
