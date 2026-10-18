/**
 * Finds which form fields a rejected request (400/422/409) is about, so the form
 * can highlight them instead of showing only a toast.
 *
 * The backend reports this in two ways:
 *   - ASP.NET validation: { errors: { Email: ["..."], PhoneNumber: ["..."] } }
 *   - a single sentence:  { message: "Email already exists" }
 *
 *   fieldsFromApiError(error, { email: ['email'], phone: ['phone', 'phonenumber'] })
 *   → [{ field: 'email', reason: 'taken' }]
 *
 * `fields` maps each form field to the names/words the backend may use for it
 * (lowercase). `reason` is 'taken' when the value is already used by another
 * account, otherwise 'invalid'.
 */
const TAKEN = /already|exist|taken|in use|registered|duplicate/i;

const normalizeKey = (key) =>
  String(key)
    .toLowerCase()
    .replace(/^\$\./, '')
    .replace(/^(request|dto|model)\./, '')
    .replace(/[^a-z]/g, '');

export function fieldsFromApiError(error, fields) {
  const payload = error?.payload;
  const found = new Map();

  const add = (field, text) => {
    const reason = TAKEN.test(text) ? 'taken' : 'invalid';
    // 'taken' wins: it's the more specific message.
    if (!found.has(field) || reason === 'taken') found.set(field, reason);
  };

  const validation = payload?.errors;
  if (validation && typeof validation === 'object' && !Array.isArray(validation)) {
    for (const [key, messages] of Object.entries(validation)) {
      const name = normalizeKey(key);
      const field = Object.keys(fields).find((candidate) => fields[candidate].includes(name));
      if (field) add(field, [].concat(messages).join(' '));
    }
  }

  // No field names: look for a field mentioned in the message(s) themselves.
  if (found.size === 0) {
    const texts = [error?.details, payload?.message, ...[].concat(payload?.errors ?? [])].filter(
      (text) => typeof text === 'string' && text
    );
    for (const text of texts) {
      // "Email address already exists" is about the email, not the address field.
      const lower = text.toLowerCase().replace(/e-?mail address/g, 'email');
      for (const [field, words] of Object.entries(fields)) {
        if (words.some((word) => lower.includes(word))) add(field, text);
      }
    }
  }

  return [...found].map(([field, reason]) => ({ field, reason }));
}
