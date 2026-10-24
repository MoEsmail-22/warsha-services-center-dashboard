import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import FormHookInput from '../../components/ui/FormHookInput';
import { forgotPassword } from '../../API/Auth/ForgotPassword';
import { resetPassword } from '../../API/Auth/ResetPassword';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotify } from '../../hooks/useNotify';
import { useErrorMessage } from '../../hooks/useErrorMessage';
import { useServerFieldErrors } from '../../hooks/useServerFieldErrors';

const passwordRules = {
  required: 'Password is required',
  pattern: {
    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[@&-]).{8,}$/,
    message:
      'Use at least 8 characters, including one lowercase letter, one uppercase letter, one number, and one special character (@, -, or &).',
  },
};

export default function ResetPasswordPage() {
  const { dir } = useLanguage();
  const { lang = 'en' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const notify = useNotify();
  const showFieldErrors = useServerFieldErrors();
  const { getErrorMessage } = useErrorMessage();

  const {
    register: registerField,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      email: location.state?.email || '',
      otp: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const email = watch('email');

  const onResend = async () => {
    try {
      await forgotPassword(email);
      notify.success('codeSent');
    } catch (error) {
      setError('email', { type: 'server', message: getErrorMessage(error, 'auth.forgot') });
    }
  };

  const onSubmit = async (formData) => {
    try {
      await resetPassword({
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });
      notify.success('passwordReset');
      navigate(`/${lang}/login`, { replace: true });
    } catch (error) {
      const fields = ['email', 'otp', 'newPassword', 'confirmPassword'];
      if (!showFieldErrors(error, setError, { fields })) notify.error(error, 'auth.reset');
    }
  };

  return (
    <div dir={dir} className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Create a new password</h1>
          <p className="mt-1 text-sm text-gray-500">Enter the code sent to your email.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormHookInput
            id="reset-email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            autoComplete="email"
            error={errors.email?.message}
            register={registerField}
            name="email"
            rules={{ required: 'Email is required' }}
          />
          <FormHookInput
            id="reset-otp"
            type="text"
            inputMode="numeric"
            label="Verification code"
            placeholder="123456"
            autoComplete="one-time-code"
            error={errors.otp?.message}
            register={registerField}
            name="otp"
            rules={{ required: 'Verification code is required' }}
          />

          <div className="relative">
            <FormHookInput
              id="reset-new-password"
              type={showPassword ? 'text' : 'password'}
              label="New password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.newPassword?.message}
              className="pe-16"
              register={registerField}
              name="newPassword"
              rules={passwordRules}
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
              At least 8 characters with lowercase, uppercase, a number, and @, -, or &.
            </p>
          </div>

          <div className="relative">
            <FormHookInput
              id="reset-confirm-password"
              type={showPassword ? 'text' : 'password'}
              label="Confirm new password"
              placeholder="••••••••"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              className="pe-16"
              register={registerField}
              name="confirmPassword"
              rules={{
                required: 'Please confirm your password',
                validate: (value, values) =>
                  value === values.newPassword || 'Passwords do not match',
                deps: ['newPassword'],
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
            type="button"
            onClick={onResend}
            disabled={!email || isSubmitting}
            className="w-full rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Resend code
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Resetting password...' : 'Reset password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to={`/${lang}/login`} className="font-semibold text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
