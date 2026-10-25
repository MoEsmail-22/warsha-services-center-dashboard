/**
 * Whether a payment type means cash. Bookings send text ("CashOnDelivery"); a quote's
 * payment can be text or the number from the approve step (0 / 1, where 0 is the first
 * value, cash). Returns true / false, or null when the value is missing (unknown).
 */
export function isCashPayment(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value).trim())) return Number(value) === 0;
  return /cash/i.test(String(value));
}

export default isCashPayment;
