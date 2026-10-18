/**
 * Input — text input with optional label + error.
 *
 * `error` is the message shown under the field. Pass `true` to only highlight the
 * field, e.g. when one message for several fields is shown elsewhere in the form.
 */
import { cn } from '@/utils/cn';

export function Input({ label, error, id, className, ...props }) {
  const message = typeof error === 'string' ? error : '';
  const errorId = message && id ? `${id}-error` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'input',
          error && 'border-red-500 bg-red-50/40 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {message && (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}

export default Input;
