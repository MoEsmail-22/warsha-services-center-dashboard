/**
 * Development only: two token checks to run in the browser console.
 *
 *   await __compareTokens()     right after logging in: every GET endpoint with the login
 *                               token vs. a freshly refreshed token, plus both tokens' claims.
 *   await __testExpiredToken()  what the app does when its token has expired: does each
 *                               endpoint get refreshed and retried, or does it just fail?
 *
 * Only GET requests are sent (nothing is changed). New tokens are saved like a normal
 * refresh, so the app keeps working afterwards.
 */
import axios from 'axios';
import apiClient, { persistAuthTokens } from '@/API/client';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const REFRESH_PATH = import.meta.env.VITE_REFRESH_TOKEN_PATH || '/Auth/client/refresh-token';

/** The claims inside a JWT, with the long .NET claim names shortened. */
function readClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return Object.fromEntries(
      Object.entries(claims).map(([key, value]) => [key.split('/').pop(), value])
    );
  } catch {
    return null;
  }
}

async function callEndpoint(path, token) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => null);
    const ok = response.ok && body?.isSuccess !== false;
    return `${ok ? '✅' : '❌'} ${response.status}${ok ? '' : ` ${body?.message ?? body?.title ?? ''}`}`;
  } catch (error) {
    return `❌ ${error.message}`;
  }
}

async function checkAll(token, bookingId) {
  const paths = [
    '/Workshop/bookings?page=1&pageSize=1',
    bookingId != null ? `/Workshop/bookings/${bookingId}` : null,
    '/Workshop/quotes',
    '/Workshop/jobs-board',
    '/Workshop/notifications?page=1&pageSize=1',
    '/Workshop/service?PageNumber=1&PageSize=1',
    '/Workshop/service-categories',
    '/Workshop/profile',
    '/Workshop/offers',
    '/CarCatalog/car-brands',
  ].filter(Boolean);

  const results = {};
  for (const path of paths) results[path.split('?')[0]] = await callEndpoint(path, token);
  return results;
}

async function firstBookingId(token) {
  try {
    const response = await fetch(`${API_BASE}/Workshop/bookings?page=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    const data = body?.data;
    const rows = [data, data?.items, data?.bookings].find(Array.isArray) ?? [];
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function compareTokens() {
  const loginToken = localStorage.getItem('auth_token');
  const refreshToken = localStorage.getItem('auth_refresh_token');
  if (!loginToken) return 'Not logged in. Log in first, then run this right away.';
  if (!refreshToken) return 'No refresh token was saved at login, so there is nothing to compare.';

  console.log('[Token check] 1/3 calling every endpoint with the login token…');
  const bookingId = await firstBookingId(loginToken);
  const withLogin = await checkAll(loginToken, bookingId);

  console.log('[Token check] 2/3 refreshing the token…');
  const response = await fetch(`${API_BASE}/${REFRESH_PATH.replace(/^\//, '')}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.isSuccess !== true) {
    return `Refresh failed: ${response.status} ${result?.message ?? ''}`;
  }
  const { accessToken: newToken } = persistAuthTokens(result);
  if (!newToken) return 'The refresh answered, but returned no access token.';

  console.log('[Token check] 3/3 calling every endpoint with the new token…');
  const withRefreshed = await checkAll(newToken, bookingId);

  // Endpoints side by side.
  console.table(
    Object.keys(withLogin).map((endpoint) => ({
      endpoint,
      'login token': withLogin[endpoint],
      'refreshed token': withRefreshed[endpoint] ?? '—',
      same: withLogin[endpoint].slice(0, 1) === withRefreshed[endpoint]?.slice(0, 1) ? '✅' : '❌',
    }))
  );

  // What is inside each token. exp/iat/nbf always differ; anything else that differs matters.
  const loginClaims = readClaims(loginToken) ?? {};
  const refreshedClaims = readClaims(newToken) ?? {};
  const timeClaims = new Set(['exp', 'iat', 'nbf', 'jti']);
  const claimRows = [
    ...new Set([...Object.keys(loginClaims), ...Object.keys(refreshedClaims)]),
  ].map((claim) => {
    const before = loginClaims[claim];
    const after = refreshedClaims[claim];
    return {
      claim,
      'login token': before ?? '❌ MISSING',
      'refreshed token': after ?? '❌ MISSING',
      same: timeClaims.has(claim) ? '(time)' : String(before) === String(after) ? '✅' : '❌',
    };
  });
  console.table(claimRows);

  const brokenEndpoints = Object.keys(withLogin).filter(
    (endpoint) => withLogin[endpoint].startsWith('✅') && !withRefreshed[endpoint]?.startsWith('✅')
  );
  const differentClaims = claimRows.filter((row) => row.same === '❌').map((row) => row.claim);
  return brokenEndpoints.length || differentClaims.length
    ? `❌ Not the same. Endpoints broken after refresh: ${brokenEndpoints.join(', ') || 'none'}. ` +
        `Claims different or missing in the refreshed token: ${differentClaims.join(', ') || 'none'}.`
    : '✅ The refreshed token works exactly like the login token for every endpoint.';
}

window.__compareTokens = compareTokens;

/**
 * `await __testExpiredToken()`: what the app does when its token has expired.
 * Before each endpoint it puts a fake expired token in place of the saved one (the refresh
 * token is kept), then calls the endpoint through the app's own client, the same
 * refresh-and-retry code the pages use, and reports every request that was sent.
 */
async function testExpiredToken() {
  if (!localStorage.getItem('auth_token')) return 'Not logged in. Log in first.';
  if (!localStorage.getItem('auth_refresh_token')) return 'No refresh token saved. Log in again.';

  const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.expired-test-token';
  const endpoints = [
    ['/Workshop/bookings', { page: 1, pageSize: 1 }],
    ['/Workshop/quotes'],
    ['/Workshop/jobs-board'],
    ['/Workshop/notifications', { page: 1, pageSize: 1 }],
    ['/Workshop/service', { PageNumber: 1, PageSize: 1 }],
    ['/Workshop/profile'],
    ['/Workshop/offers'],
    ['/CarCatalog/car-brands'],
  ];

  // Record every request the client really sends (first try and retry).
  const sendRequest = axios.getAdapter(apiClient.defaults.adapter);
  const originalAdapter = apiClient.defaults.adapter;
  let attempts = [];
  apiClient.defaults.adapter = async (config) => {
    const which = String(config.headers?.Authorization ?? '').includes('expired-test-token')
      ? 'expired token'
      : 'new token';
    try {
      const response = await sendRequest(config);
      attempts.push(`${which} → ${response.status}`);
      return response;
    } catch (error) {
      attempts.push(
        `${which} → ${error.response?.status ?? 'no answer'} ${error.response?.data?.message ?? ''}`
      );
      throw error;
    }
  };

  let lastGoodToken = localStorage.getItem('auth_token');
  let lastGoodExpiry = localStorage.getItem('auth_token_expires_at');

  // Does the app read the expiry right? The saved "expiresAt" text vs. the token's own exp.
  const tokenExp = readClaims(lastGoodToken)?.exp;
  const expiryCheck =
    `Expiry: saved expiresAt = "${lastGoodExpiry}" → read as ` +
    `${lastGoodExpiry ? new Date(lastGoodExpiry).toLocaleString() : 'nothing'}; ` +
    `the token itself says ${tokenExp ? new Date(tokenExp * 1000).toLocaleString() : 'unknown'}`;
  const rows = [];
  try {
    for (const [path, params] of endpoints) {
      attempts = [];
      localStorage.setItem('auth_token', expiredToken);
      // Make the app believe the token is still valid, so the server's answer decides.
      localStorage.setItem(
        'auth_token_expires_at',
        new Date(Date.now() + 5 * 60 * 1000).toISOString()
      );

      let result;
      try {
        await apiClient.get(path, { params });
        result = '✅ worked';
      } catch (error) {
        result = `❌ failed: ${error.response?.status ?? ''} ${error.response?.data?.message ?? error.message}`;
      }

      if (localStorage.getItem('auth_token') !== expiredToken) {
        lastGoodToken = localStorage.getItem('auth_token');
        lastGoodExpiry = localStorage.getItem('auth_token_expires_at');
      }
      rows.push({
        endpoint: path,
        'requests sent': attempts.join('  ⟶  '),
        'refreshed + retried': attempts.length > 1 ? 'yes' : 'NO',
        result,
      });
    }
  } finally {
    apiClient.defaults.adapter = originalAdapter;
    // Never leave the fake token behind: put back the newest real one.
    if (localStorage.getItem('auth_token') === expiredToken && lastGoodToken) {
      localStorage.setItem('auth_token', lastGoodToken);
      if (lastGoodExpiry) localStorage.setItem('auth_token_expires_at', lastGoodExpiry);
    }
  }

  console.table(rows);
  const failed = rows.filter((row) => row.result.startsWith('❌')).map((row) => row.endpoint);
  const summary = failed.length
    ? `❌ After the token expired, these did NOT recover: ${failed.join(', ')}`
    : '✅ Every endpoint recovered by itself after the token expired.';
  // Also as plain text, easy to copy from the console in one go.
  return [
    summary,
    ...rows.map((row) => `${row.endpoint}: ${row['requests sent']}  |  ${row.result}`),
    expiryCheck,
  ].join('\n');
}

window.__testExpiredToken = testExpiredToken;
