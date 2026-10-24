import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useParams } from 'react-router-dom';
import FormHookInput from '../../components/ui/FormHookInput';
import { forgotPassword } from '../../API/Auth/ForgotPassword';
import { useNotify } from '../../hooks/useNotify';
import { useErrorMessage } from '../../hooks/useErrorMessage';
import { findKnownBackendError } from '../../utils/knownBackendErrors';
import { useServerFieldErrors } from '../../hooks/useServerFieldErrors';

export default function LoginPage() {
  const { login, loginAsDemo } = useAuth();
  const { dir } = useLanguage();
  const { t } = useAppTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const notify = useNotify();
  const showFieldErrors = useServerFieldErrors();
  const { getErrorMessage } = useErrorMessage();
  const [forgotLoading, setForgotLoading] = useState(false);
  const { lang = 'en' } = useParams();

  const {
    register: registerField,
    handleSubmit,
    getValues,
    setError: setFieldError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const from = location.state?.from?.pathname || `/${lang}/`;

  const handleDemoLogin = () => {
    loginAsDemo();
    navigate(from, { replace: true });
  };

  const handleForgotPassword = async () => {
    const currentEmail = getValues('email').trim();

    if (!currentEmail) {
      setFieldError('email', { type: 'manual', message: t('login.emailRequired') });
      return;
    }

    setForgotLoading(true);
    try {
      await forgotPassword(currentEmail);
      notify.success('codeSent');
      navigate(`/${lang}/reset-password`, {
        state: { email: currentEmail },
      });
    } catch (err) {
      // Shown under the email field, since the problem is usually the email itself.
      setFieldError('email', { type: 'server', message: getErrorMessage(err, 'auth.forgot') });
    } finally {
      setForgotLoading(false);
    }
  };

  const onSubmit = async (formData) => {
    clearErrors(['email', 'password']);
    try {
      await login(formData);
      navigate(from, { replace: true });
    } catch (err) {
      if (showFieldErrors(err, setFieldError, { fields: ['email', 'password'] })) return;
      const message = getErrorMessage(err, 'auth.login');
      const knownError = findKnownBackendError(err.details)?.key;

      // Wrong credentials belong next to the fields; anything else is a toast.
      if (knownError === 'auth.invalidCredentials') {
        setFieldError('email', { type: 'server', message });
        setFieldError('password', { type: 'server', message });
      } else if (knownError === 'auth.userNotFound') {
        setFieldError('email', { type: 'server', message });
      } else {
        notify.error(err, 'auth.login');
      }
    }
  };

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('login.title', { defaultValue: 'Welcome back' })}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('login.subtitle', { defaultValue: 'Sign in to your dashboard' })}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormHookInput
            id="login-email"
            type="email"
            label={t('login.email', { defaultValue: 'Email address' })}
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            register={registerField}
            name="email"
            rules={{ required: t('login.emailRequired') }}
          />

          <div className="relative">
            <FormHookInput
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              label={t('login.password', { defaultValue: 'Password' })}
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              className="pe-16"
              register={registerField}
              name="password"
              rules={{ required: t('login.passwordRequired') }}
            />
            <div className="absolute end-2 top-8">
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t('login.loading', { defaultValue: 'Signing in…' })
              : t('login.submit', { defaultValue: 'Sign in' })}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          {t('login.noAccount', { defaultValue: "Don't have an account?" })}{' '}
          <Link to={`/${lang}/register`} className="font-semibold text-blue-600 hover:underline">
            {t('login.registerLink', { defaultValue: 'Create one' })}
          </Link>
          <span className="mx-2 text-gray-300">|</span>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={forgotLoading}
            className="font-semibold text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {forgotLoading ? t('login.sendingCode') : t('login.forgotPassword')}
          </button>
        </p>
      </div>
    </div>
  );
}
