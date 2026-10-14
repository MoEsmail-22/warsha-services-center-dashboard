import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const refreshTokenPath = import.meta.env.VITE_REFRESH_TOKEN_PATH || '/Auth/client/refresh-token';
// Tokens last 10 minutes, so renew every 9 (a 401 also triggers a refresh).
const REFRESH_INTERVAL_MS = 9 * 60 * 1000;

const apiClient = axios.create({
  baseURL,
  headers: {
    Accept: '*/*',
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

const getTokenValue = (payload, keys) => {
  const sources = [payload?.data?.tokens, payload?.data, payload?.tokens, payload];

  for (const source of sources) {
    for (const key of keys) {
      if (typeof source?.[key] === 'string' && source[key]) return source[key];
    }
  }

  return null;
};

function getTokenData(payload) {
  return payload?.data?.tokens || payload?.data || payload?.tokens || payload || {};
}

export function persistAuthTokens(payload) {
  const accessToken = getTokenValue(payload, ['accessToken', 'access_token', 'token']);
  const refreshToken = getTokenValue(payload, ['refreshToken', 'refresh_token']);
  const tokenData = getTokenData(payload);
  const expiresAt = getTokenValue(payload, ['expiresAt', 'expires_at']);
  const refreshTokenExpiresAt = getTokenValue(payload, [
    'refreshTokenExpiresAt',
    'refresh_token_expires_at',
  ]);

  if (accessToken) localStorage.setItem('auth_token', accessToken);
  if (refreshToken) localStorage.setItem('auth_refresh_token', refreshToken);
  if (expiresAt) localStorage.setItem('auth_token_expires_at', expiresAt);
  else if (accessToken) localStorage.removeItem('auth_token_expires_at');
  if (refreshTokenExpiresAt) {
    localStorage.setItem('auth_refresh_token_expires_at', refreshTokenExpiresAt);
  }

  return { accessToken, refreshToken };
}

function clearSavedSession() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_expires_at');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_refresh_token_expires_at');
    localStorage.removeItem('auth_user');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:session-expired'));
  }
}

async function refreshAccessToken(refreshToken) {
  const response = await axios.post(
    `${baseURL}/${refreshTokenPath.replace(/^\//, '')}`,
    { refreshToken },
    {
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
    }
  );
  const result = response.data;

  if (result?.isSuccess !== true) {
    throw new Error(result?.message || 'Unable to refresh the session.');
  }

  const tokens = persistAuthTokens(result);
  if (!tokens.accessToken) throw new Error('The refresh endpoint returned no access token.');

  return tokens.accessToken;
}

function getSharedRefreshPromise(refreshToken) {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(refreshToken).finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export const isDemoMode = () =>
  typeof localStorage !== 'undefined' && localStorage.getItem('demo_mode') === 'true';

function parseExpiry(value) {
  if (value == null || value === '') return null;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
  }

  const parsedValue = Date.parse(value);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function getAccessTokenExpiry() {
  const storedExpiry = parseExpiry(localStorage.getItem('auth_token_expires_at'));
  if (storedExpiry) return storedExpiry;

  const accessToken = localStorage.getItem('auth_token');
  const encodedPayload = accessToken?.split('.')[1];
  if (!encodedPayload) return null;

  try {
    const base64Payload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, '=');
    const payload = JSON.parse(atob(paddedPayload));
    return parseExpiry(payload.exp ?? payload.expiresAt);
  } catch {
    return null;
  }
}

function isAccessTokenExpiring() {
  const expiresAt = getAccessTokenExpiry();
  return expiresAt == null || expiresAt <= Date.now() + 60_000;
}

async function refreshSavedSession(force = false) {
  if (
    typeof localStorage === 'undefined' ||
    isDemoMode() ||
    (import.meta.env.VITE_ENABLE_DEV_AUTH === 'true' && import.meta.env.VITE_DEV_ACCESS_TOKEN)
  ) {
    return;
  }

  const accessToken = localStorage.getItem('auth_token');
  const refreshToken = localStorage.getItem('auth_refresh_token');
  if (!accessToken || !refreshToken || (!force && !isAccessTokenExpiring())) return;

  try {
    await getSharedRefreshPromise(refreshToken);
  } catch (error) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    clearSavedSession();
  }
}

if (typeof window !== 'undefined' && !window.__warshaAuthRefreshTimer) {
  window.__warshaAuthRefreshTimer = window.setInterval(() => {
    void refreshSavedSession(true);
  }, REFRESH_INTERVAL_MS);
  void refreshSavedSession();
}

apiClient.interceptors.request.use(async (config) => {
  // Keep demo mode local while returning the API response envelope.
  if (isDemoMode()) {
    config.adapter = async (requestConfig) => ({
      data: { isSuccess: true, data: [], message: 'demo' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
      request: {},
    });
    return config;
  }

  const devAuthEnabled = import.meta.env.VITE_ENABLE_DEV_AUTH === 'true';
  const devToken = devAuthEnabled ? import.meta.env.VITE_DEV_ACCESS_TOKEN : null;
  const token =
    devToken ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null);

  if (!devToken && token && typeof localStorage !== 'undefined') {
    const refreshToken = localStorage.getItem('auth_refresh_token');
    if (refreshToken && isAccessTokenExpiring()) {
      try {
        const refreshedToken = await getSharedRefreshPromise(refreshToken);
        config.headers.Authorization = `Bearer ${refreshedToken}`;
        return config;
      } catch (error) {
        console.error('Pre-request token refresh failed:', error.response?.data || error.message);
        clearSavedSession();
        return Promise.reject(error);
      }
    }
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshRequest = originalRequest?.url?.includes('/Auth/client/refresh-token');
    const devAuthEnabled = import.meta.env.VITE_ENABLE_DEV_AUTH === 'true';
    const responseMessage =
      error.response?.data?.message ||
      error.response?.data?.title ||
      error.response?.data?.detail ||
      (typeof error.response?.data === 'string' ? error.response.data : '');
    const isBackendExpiredToken400 =
      error.response?.status === 400 && /nullable object must have a value/i.test(responseMessage);

    if (
      (error.response?.status !== 401 && !isBackendExpiredToken400) ||
      !originalRequest ||
      originalRequest._retry ||
      isRefreshRequest ||
      isDemoMode() ||
      (devAuthEnabled && import.meta.env.VITE_DEV_ACCESS_TOKEN)
    ) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('auth_refresh_token');
    if (!refreshToken) {
      clearSavedSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await getSharedRefreshPromise(refreshToken);
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      clearSavedSession();
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
