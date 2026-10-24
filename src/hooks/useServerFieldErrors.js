import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createLocalError } from '@/API/errors';
import { useNotify } from '@/hooks/useNotify';

/**
 * The backend's form check answers 400 with one message per field:
 *   { "errors": { "AddressAr": ["The AddressAr field is required."] } }
 * Returns them with form-style names: { addressAr: 'The AddressAr field is required.' }.
 * "Items[0].Price" becomes "items.0.price"; "$.phone" (JSON errors) becomes "phone".
 */
export function readFieldErrors(error) {
  const errors = error?.payload?.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return {};

  const fields = {};
  for (const [key, value] of Object.entries(errors)) {
    const message = Array.isArray(value) ? value[0] : value;
    const field = key
      .replace(/^\$\.?/, '')
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)
      .map((part) => part.charAt(0).toLowerCase() + part.slice(1))
      .join('.');
    if (field && message) fields[field] = String(message);
  }
  return fields;
}

// The backend's English messages that have a translation (errors.json → field.*).
const KNOWN_MESSAGES = [
  {
    pattern: /field is required|is required/i,
    key: 'field.required',
    fallback: 'This field is required.',
  },
  {
    pattern: /not a valid e-?mail/i,
    key: 'field.invalidEmail',
    fallback: 'Enter a valid email address.',
  },
  {
    pattern: /minimum length of '?(\d+)'?/i,
    key: 'field.minLength',
    fallback: 'Use at least {{count}} characters.',
  },
  {
    pattern: /maximum length of '?(\d+)'?/i,
    key: 'field.maxLength',
    fallback: 'Use at most {{count}} characters.',
  },
  {
    pattern: /could not be converted|is not valid|invalid/i,
    key: 'field.invalid',
    fallback: 'This value is not valid.',
  },
];

/**
 * Shows the backend's per-field errors on a react-hook-form form: the input gets a red
 * border and the message under it, the first one is focused, and a toast says to fix them.
 *
 *   const showFieldErrors = useServerFieldErrors();
 *   catch (err) {
 *     if (!showFieldErrors(err, setError, { fields: ['name', 'email'] })) notify.error(err, 'x');
 *   }
 *
 * - fields: the form's field names; errors for other names are ignored.
 * - fieldMap: backend name → form name when they differ ({ googleMapsLink: 'googleMapsUrl' }).
 * Returns true if at least one field was marked (otherwise show the usual error toast).
 */
export function useServerFieldErrors() {
  const { t } = useTranslation('errors');
  const notify = useNotify();

  return useCallback(
    (error, setError, { fields, fieldMap = {} } = {}) => {
      const marked = Object.entries(readFieldErrors(error))
        .map(([field, message]) => [fieldMap[field] ?? field, message])
        .filter(([field]) => !fields || fields.includes(field))
        // In form order, so the cursor goes to the first highlighted field on screen.
        .sort(([a], [b]) => (fields ? fields.indexOf(a) - fields.indexOf(b) : 0));

      marked.forEach(([field, message], index) => {
        const known = KNOWN_MESSAGES.find(({ pattern }) => pattern.test(message));
        const count = known && message.match(known.pattern)?.[1];
        setError(
          field,
          {
            type: 'server',
            message: known
              ? t(known.key, { defaultValue: known.fallback, count: Number(count) || undefined })
              : message,
          },
          { shouldFocus: index === 0 }
        );
      });

      if (marked.length > 0) {
        notify.error(createLocalError('form.fixHighlighted', 'Please fix the highlighted fields.'));
      }
      return marked.length > 0;
    },
    [t, notify]
  );
}

export default useServerFieldErrors;
