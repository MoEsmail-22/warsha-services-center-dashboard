import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import FormHookInput from '../../components/ui/FormHookInput';
import { useNotify } from '../../hooks/useNotify';
import { useErrorMessage } from '../../hooks/useErrorMessage';
import { ERROR_CODES, createLocalError } from '../../API/errors';
import { fieldsFromApiError } from '../../utils/formServerErrors';

// The names/words the backend may use for each form field (lowercase).
const SERVER_FIELDS = {
  name: ['name', 'workshopname', 'fullname'],
  email: ['email'],
  phone: ['phone', 'phonenumber', 'mobile'],
  address: ['address'],
  password: ['password'],
};
// Fields with an "already used by another account" message (errors.json register.*.taken).
const CAN_BE_TAKEN = ['email', 'phone'];

// A field with an error is highlighted even when the rule has no message (the password hint).
const fieldError = (error) => (error ? error.message || true : undefined);

export default function RegisterPage() {
  const { register } = useAuth();
  const { dir } = useLanguage();
  const { t } = useAppTranslation('common');
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const notify = useNotify();
  const { getErrorMessage } = useErrorMessage();
  // Stays on screen (with a link to login) until the admin verifies the account.
  const [pendingVerification, setPendingVerification] = useState(false);
  const { lang = 'en' } = useParams();

  const {
    register: registerField,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (formData) => {
    setPendingVerification(false);

    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        password: formData.password,
      });

      // The .NET backend does NOT return a JWT on workshop registration — the
      // account must first be verified by an admin (POST /api/v1/Admin/verify-workshop/{id}).
      // So we do NOT auto-login. Show a clear banner and send the user to /login.
      if (result?.pendingVerification) {
        setPendingVerification(true);
        // Keep the user on the register page so they see the banner; offer a link to /login.
        return;
      }

      // If the backend DID return a token (some configurations do), go to the dashboard.
      notify.success('registered');
      navigate(`/${lang}/`, { replace: true });
    } catch (err) {
      // A rejected request (400/422/409) highlights the fields it is about.
      const fields = [ERROR_CODES.validation, ERROR_CODES.conflict].includes(err.code)
        ? fieldsFromApiError(err, SERVER_FIELDS)
        : [];

      if (fields.length === 0) {
        notify.error(err, 'auth.register');
        return;
      }

      fields.forEach(({ field, reason }, index) => {
        const key = `register.${field}.${reason === 'taken' && CAN_BE_TAKEN.includes(field) ? 'taken' : 'invalid'}`;
        setFieldError(
          field,
          { type: 'server', message: getErrorMessage(createLocalError(key)) },
          { shouldFocus: index === 0 }
        );
      });
      notify.error(createLocalError('register.fieldsInvalid'));
    }
  };

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('register.title', { defaultValue: 'Create your account' })}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('register.subtitle', { defaultValue: 'Get started with your dashboard' })}
          </p>
        </div>

        {pendingVerification && (
          <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {t('register.pendingVerification', {
              defaultValue: 'Account created. An admin must verify it before you can sign in.',
            })}{' '}
            <Link to={`/${lang}/login`} className="font-semibold underline">
              {t('register.goToLogin', { defaultValue: 'Go to login' })}
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormHookInput
            id="register-name"
            type="text"
            label={t('register.name', { defaultValue: 'Full name' })}
            autoComplete="name"
            error={fieldError(errors.name)}
            register={registerField}
            name="name"
            rules={{ required: 'Name is required' }}
          />

          <FormHookInput
            id="register-email"
            type="email"
            label={t('register.email', { defaultValue: 'Email address' })}
            autoComplete="email"
            error={fieldError(errors.email)}
            register={registerField}
            name="email"
            rules={{ required: 'Email is required' }}
          />

          <FormHookInput
            id="register-phone"
            type="tel"
            label="Phone"
            autoComplete="tel"
            error={fieldError(errors.phone)}
            register={registerField}
            name="phone"
            rules={{
              required: 'Phone is required',
              pattern: {
                // Egyptian mobile: 01 followed by 9 digits (e.g. 01012345678)
                value: /^01[0-9]{9}$/,
                message: 'Enter a valid Egyptian mobile (e.g. 01012345678)',
              },
            }}
          />

          <FormHookInput
            id="register-address"
            type="text"
            label="Address"
            autoComplete="street-address"
            error={fieldError(errors.address)}
            register={registerField}
            name="address"
            rules={{ required: 'Address is required' }}
          />

          <div className="relative">
            <FormHookInput
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              label={t('register.password', { defaultValue: 'Password ' })}
              autoComplete="new-password"
              error={fieldError(errors.password)}
              className="pe-16"
              register={registerField}
              name="password"
              rules={{
                required: 'Password is required',
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@&-]).{8,}$/,
                  message: '',
                },
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute end-2 top-8 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <p className="mt-1 text-xs text-gray-500">
              Use at least 8 characters, including one lowercase letter, one uppercase letter, one
              number, and one special character (@, -, or &).
            </p>
          </div>

          <div className="relative">
            <FormHookInput
              id="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              label={t('register.confirmPassword', { defaultValue: 'Confirm password' })}
              autoComplete="new-password"
              error={fieldError(errors.confirmPassword)}
              className="pe-16"
              register={registerField}
              name="confirmPassword"
              rules={{
                required: 'Please confirm your password',
                validate: (value, formValues) =>
                  value === formValues.password || 'Passwords do not match',
                deps: ['password'],
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute end-2 top-8 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t('register.loading', { defaultValue: 'Creating account…' })
              : t('register.submit', { defaultValue: 'Create account' })}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {t('register.hasAccount', { defaultValue: 'Already have an account?' })}{' '}
          <Link to={`/${lang}/login`} className="font-semibold text-blue-600 hover:underline">
            {t('register.loginLink', { defaultValue: 'Sign in' })}
          </Link>
        </p>
      </div>
    </div>
  );
}
