/**
 * main.jsx — THE ENTRY POINT
 *
 * Wraps the app in this order (outer → inner):
 *   1. AuthProvider       → provides login state
 *   2. Active entity providers → provides mock data
 *   3. RouterProvider     → provides routing
 *
 * Order matters: the entity providers must be INSIDE AuthProvider (so they
 * can read the auth state if needed) and OUTSIDE RouterProvider (so pages
 * can access them via the hooks).
 *
 * LanguageProvider is NOT here — it's nested inside AppLayout and AuthLayout
 * because it needs useNavigate/useLocation from react-router.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './i18n';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { router } from './routes';
import { preloadCurrentPage } from './routes/lazyPages';
import {
  BookingsProvider,
  JobsProvider,
  QuotesProvider,
  ServicesProvider,
  ReviewsProvider,
  SettingsProvider,
} from './contexts';

// Download the opened page's code now, in parallel with the session and translations.
preloadCurrentPage();

// Development only: `await __compareTokens()` in the console (see utils/devTokenCheck.js).
if (import.meta.env.DEV) import('./utils/devTokenCheck');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <LoadingProvider>
        <AuthProvider>
          <NotificationsProvider>
            {/* Only active feature providers are mounted globally. */}
            <BookingsProvider>
              <JobsProvider>
                <QuotesProvider>
                  <ServicesProvider>
                    <ReviewsProvider>
                      <SettingsProvider>
                        <RouterProvider router={router} />
                      </SettingsProvider>
                    </ReviewsProvider>
                  </ServicesProvider>
                </QuotesProvider>
              </JobsProvider>
            </BookingsProvider>
          </NotificationsProvider>
        </AuthProvider>
      </LoadingProvider>
    </ToastProvider>
  </StrictMode>
);
