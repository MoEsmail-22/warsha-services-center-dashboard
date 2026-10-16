/**
 * Backend messages we recognise, mapped to keys in public/locales/{lang}/errors.json.
 * The API only replies in English, so known sentences get our own translated text.
 * Keys are lowercase, without the trailing period.
 */
export const KNOWN_BACKEND_ERRORS = {
  'invalid email or password': 'auth.invalidCredentials',
  'user not found': 'auth.userNotFound',
  'invalid token': 'auth.sessionInvalid',
  // A refreshed token without workshopId makes every /Workshop endpoint fail like this.
  'nullable object must have a value': 'auth.sessionInvalid',
  // accept / reject answer these when the token is missing or expired.
  'current user is not associated with a workshop': 'auth.sessionInvalid',
  'current user is not a workshop': 'auth.sessionInvalid',
  'invalid otp': 'auth.invalidOtp',
  'invalid or expired otp': 'auth.invalidOtp',
  'can only create quotes for in-progress jobs': 'quote.jobNotInProgress',
  'booking is not awaiting workshop approval': 'booking.notAwaitingApproval',
  'the workshop response deadline has expired': 'booking.deadlineExpired',
};

/**
 * Messages with a changing part (e.g. a name). Each captured group becomes a
 * value for the translated text: "Service 'adlf' already exists…" → { name: 'adlf' }.
 */
export const KNOWN_BACKEND_PATTERNS = [
  {
    // PATCH .../status refuses a skipped job stage, e.g. "Invalid transition: New → InProgress".
    pattern: /^invalid transition: (.+?) (?:→|->) (.+)$/i,
    key: 'jobs.invalidTransition',
    values: (match) => ({ from: match[1], to: match[2] }),
  },
  {
    pattern: /^service ['"](.+)['"] already exists in this workshop$/i,
    key: 'service.alreadyExists',
    values: (match) => ({ name: match[1] }),
  },
];

/** Returns { key, values } for a recognised backend message, or null. */
export function findKnownBackendError(details) {
  if (!details) return null;
  const text = String(details).trim().replace(/\.$/, '');

  const exactKey = KNOWN_BACKEND_ERRORS[text.toLowerCase()];
  if (exactKey) return { key: exactKey, values: {} };

  for (const { pattern, key, values } of KNOWN_BACKEND_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { key, values: values(match) };
  }

  return null;
}
